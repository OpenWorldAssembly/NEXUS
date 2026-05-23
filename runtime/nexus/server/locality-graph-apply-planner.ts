/**
 * File: locality-graph-apply-planner.ts
 * Description: Plans the composite locality graph apply packet bundle before fortress signing.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import type { MutationActionId } from '@core/auth/write-policy';
import type {
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import {
  planCanonicalLocalityGraphWithPacketStore,
  type LocalityCreatePathEntry,
  type LocalityGraphPlanResult,
} from '@runtime/nexus/server/locality-directory-service';
import {
  planAssemblyAssociationRelationPackets,
  planFollowRelationPackets,
  planHomeLocalityRelationPackets,
  requireElementPacketFromStoreOrPrepared,
} from '@runtime/nexus/server/elemental-scope-relation-planner';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export type LocalityGraphApplyPreparedResult = LocalityGraphPlanResult;

export type LocalityGraphApplyPacketPlan = {
  plannedResult: LocalityGraphApplyPreparedResult;
  createdPackets: PacketEnvelope[];
  actionIds: MutationActionId[];
  governingScopes: {
    scopePacket: PacketEnvelopeByType['Element'] | null;
    actionIds: MutationActionId[];
  }[];
  preferredGoverningScopePacket: PacketEnvelopeByType['Element'] | null;
};

function isClaimedActorPacket(actorPacket: PacketEnvelopeByType['Element']): boolean {
  return actorPacket.body.identity?.claim_status === 'claimed';
}

function getParentPacketId(packet: PacketEnvelopeByType['Element']): string | null {
  return (
    packet.header.edges.find((edge) => edge.edge_type === 'parent_scope')?.target.packet_id ??
    null
  );
}

function getResolvedLocalityScopePacketId(entry: {
  existing_result?: { scope_id?: string | null } | null;
  planned_scope_packet_id?: string | null;
}): string | null {
  return entry.existing_result?.scope_id ?? entry.planned_scope_packet_id ?? null;
}

export function collectHomeBranchScopePacketIds(input: {
  preparedResult: LocalityGraphApplyPreparedResult | undefined;
  homeScopePacketId: string | null;
}): string[] {
  if (!input.homeScopePacketId) {
    return [];
  }

  for (const pathResult of input.preparedResult?.path_results ?? []) {
    const pathScopePacketIds = (pathResult.resolved_path ?? [])
      .map((entry) => getResolvedLocalityScopePacketId(entry))
      .filter((scopeId): scopeId is string => Boolean(scopeId));
    const homeIndex = pathScopePacketIds.indexOf(input.homeScopePacketId);

    if (homeIndex >= 0) {
      return pathScopePacketIds.slice(0, homeIndex + 1);
    }
  }

  return [input.homeScopePacketId];
}

export function collectEligibleMainScopePacketIds(input: {
  intent: Extract<MutationIntent, { kind: 'locality.graph.apply' }>;
  preparedResult: LocalityGraphApplyPreparedResult | undefined;
}): string[] {
  return Array.from(
    new Set([
      ...collectHomeBranchScopePacketIds({
        preparedResult: input.preparedResult,
        homeScopePacketId: input.intent.home_scope_packet_id ?? null,
      }),
      ...(input.intent.associated_scope_packet_ids ?? []),
      ...(input.intent.followed_scope_packet_ids ?? []),
    ])
  );
}

async function validateHardSelectedScopeTargets(input: {
  packetStore: NodeSQLitePacketStore;
  selectedScopePacketIds: Set<string>;
  preparedElementPacketsById: Map<string, PacketEnvelopeByType['Element']>;
}) {
  for (const scopePacketId of input.selectedScopePacketIds) {
    if (input.preparedElementPacketsById.has(scopePacketId)) {
      continue;
    }

    const existingPacket = await input.packetStore.fetchByPacket({
      packet_id: scopePacketId,
    });

    if (!existingPacket || existingPacket.header.type !== 'Element') {
      throw new Error(`Unknown scope selection target: ${scopePacketId}`);
    }
  }
}

export async function planLocalityGraphApplyPackets(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacket: PacketEnvelopeByType['Element'];
  intent: Extract<MutationIntent, { kind: 'locality.graph.apply' }>;
}): Promise<LocalityGraphApplyPacketPlan> {
  if (!isClaimedActorPacket(input.actorPacket)) {
    throw new Error('Locality graph apply requires a claimed identity.');
  }

  const plannedResult = await planCanonicalLocalityGraphWithPacketStore({
    packetStore: input.packetStore,
    actorPacketId: input.actorPacket.header.packet_id,
    paths: input.intent.paths as LocalityCreatePathEntry[][],
    createAnyway: input.intent.create_anyway,
  });
  const preparedElementPacketsById = new Map(
    plannedResult.created_packets
      .filter(
        (packet): packet is PacketEnvelopeByType['Element'] =>
          packet.header.type === 'Element'
      )
      .map((packet) => [packet.header.packet_id, packet])
  );
  const selectedScopePacketIds = new Set(
    [
      input.intent.home_scope_packet_id ?? null,
      ...(input.intent.associated_scope_packet_ids ?? []),
      ...(input.intent.followed_scope_packet_ids ?? []),
    ].filter((packetId): packetId is string => typeof packetId === 'string')
  );

  await validateHardSelectedScopeTargets({
    packetStore: input.packetStore,
    selectedScopePacketIds,
    preparedElementPacketsById,
  });

  const homeScopePacket = input.intent.home_scope_packet_id
    ? await requireElementPacketFromStoreOrPrepared({
        packetStore: input.packetStore,
        packetId: input.intent.home_scope_packet_id,
        preparedElementPacketsById,
      })
    : null;
  const homePackets = await planHomeLocalityRelationPackets({
    packetStore: input.packetStore,
    actorPacket: input.actorPacket,
    homeScopePacket,
    forceSelectedRevision: false,
  });
  const associationPackets: PacketEnvelope[] = [];
  const associationPolicyScopes: PacketEnvelopeByType['Element'][] = [];

  for (const targetScopePacketId of Array.from(
    new Set(input.intent.associated_scope_packet_ids ?? [])
  )) {
    const targetScopePacket = await requireElementPacketFromStoreOrPrepared({
      packetStore: input.packetStore,
      packetId: targetScopePacketId,
      preparedElementPacketsById,
    });
    const associationResult = await planAssemblyAssociationRelationPackets({
      packetStore: input.packetStore,
      actorPacket: input.actorPacket,
      targetScopePacket,
      mode: 'set',
      skipIfAlreadyActive: true,
    });

    associationPackets.push(...associationResult.packets);

    if (associationResult.packets.length > 0 && associationResult.governingScopePacket) {
      associationPolicyScopes.push(associationResult.governingScopePacket);
    }
  }

  const followPackets: PacketEnvelope[] = [];
  const followPolicyScopes: PacketEnvelopeByType['Element'][] = [];

  for (const targetScopePacketId of Array.from(
    new Set(input.intent.followed_scope_packet_ids ?? [])
  )) {
    const targetScopePacket = await requireElementPacketFromStoreOrPrepared({
      packetStore: input.packetStore,
      packetId: targetScopePacketId,
      preparedElementPacketsById,
    });
    const followResult = await planFollowRelationPackets({
      packetStore: input.packetStore,
      actorPacket: input.actorPacket,
      targetScopePacket,
      mode: 'set',
      skipIfAlreadyActive: true,
    });

    followPackets.push(...followResult.packets);

    if (followResult.packets.length > 0 && followResult.governingScopePacket) {
      followPolicyScopes.push(followResult.governingScopePacket);
    }
  }

  const createdPackets = [
    ...plannedResult.created_packets,
    ...homePackets.packets,
    ...associationPackets,
    ...followPackets,
  ];
  const actionIds: MutationActionId[] = [
    ...(plannedResult.created_packets.length > 0 ? ['locality.element.create' as const] : []),
    ...(homePackets.packets.length > 0 ? ['home_locality.relation.set' as const] : []),
    ...(associationPackets.length > 0 ? ['assembly_association.relation.set' as const] : []),
    ...(followPackets.length > 0 ? ['follows.relation.set' as const] : []),
  ];
  const firstCreatedScopePacket = plannedResult.created_packets.find(
    (packet): packet is PacketEnvelopeByType['Element'] => packet.header.type === 'Element'
  );
  const localityGoverningScopePacket = firstCreatedScopePacket
    ? await requireElementPacketFromStoreOrPrepared({
        packetStore: input.packetStore,
        packetId: getParentPacketId(firstCreatedScopePacket) ?? firstCreatedScopePacket.header.packet_id,
        preparedElementPacketsById,
      })
    : null;
  const governingScopes = [
    {
      scopePacket: localityGoverningScopePacket,
      actionIds:
        plannedResult.created_packets.length > 0
          ? (['locality.element.create'] as MutationActionId[])
          : [],
    },
    {
      scopePacket: homePackets.governingScopePacket,
      actionIds:
        homePackets.packets.length > 0
          ? (['home_locality.relation.set'] as MutationActionId[])
          : [],
    },
    ...associationPolicyScopes.map((scopePacket) => ({
      scopePacket,
      actionIds: ['assembly_association.relation.set'] as MutationActionId[],
    })),
    ...followPolicyScopes.map((scopePacket) => ({
      scopePacket,
      actionIds: ['follows.relation.set'] as MutationActionId[],
    })),
  ].filter((entry) => entry.actionIds.length > 0);

  return {
    plannedResult,
    createdPackets,
    actionIds,
    governingScopes,
    preferredGoverningScopePacket:
      homePackets.governingScopePacket ?? localityGoverningScopePacket,
  };
}
