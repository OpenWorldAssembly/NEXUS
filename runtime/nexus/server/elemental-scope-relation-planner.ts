/**
 * File: elemental-scope-relation-planner.ts
 * Description: Plans actor-to-scope relation packets for fortress mutations without persisting them.
 */

import {
  createClaimPacketId,
  createRelationAssertionClaimPacket,
} from '@core/packets/claims';
import {
  createRelationPacketId,
  createScopedRelationPacket,
} from '@core/packets/relations';
import type {
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import {
  filterClaimPackets,
  listClaimPackets,
} from '@runtime/nexus/server/claim-utils';
import {
  filterRelationPackets,
  listRelationPackets,
} from '@runtime/nexus/server/relation-utils';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export type PreparedElementPacketsById = Map<
  string,
  PacketEnvelopeByType['Element']
>;

export type ScopeRelationPacketPlan = {
  packets: PacketEnvelope[];
  governingScopePacket: PacketEnvelopeByType['Element'] | null;
};

function getApplicableScopeRefs(scopePacket: PacketEnvelopeByType['Element']) {
  return scopePacket.header.applicable_scope_refs.length > 0
    ? scopePacket.header.applicable_scope_refs
    : [{ packet_id: scopePacket.header.packet_id }];
}

export async function requireElementPacketFromStoreOrPrepared(input: {
  packetStore: NodeSQLitePacketStore;
  packetId: string;
  preparedElementPacketsById: PreparedElementPacketsById;
}): Promise<PacketEnvelopeByType['Element']> {
  const preparedElementPacket = input.preparedElementPacketsById.get(input.packetId) ?? null;

  if (preparedElementPacket) {
    return preparedElementPacket;
  }

  const existingPacket = await input.packetStore.fetchByPacket({
    packet_id: input.packetId,
  });

  if (!existingPacket || existingPacket.header.family !== 'Element') {
    throw new Error(`Unknown Element packet: ${input.packetId}`);
  }

  return existingPacket as PacketEnvelopeByType['Element'];
}

export async function planAssemblyAssociationRelationPackets(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacket: PacketEnvelopeByType['Element'];
  targetScopePacket: PacketEnvelopeByType['Element'];
  mode: 'set' | 'clear';
  note?: string | null;
  skipIfAlreadyActive?: boolean;
}): Promise<ScopeRelationPacketPlan> {
  const applicableScopeRefs = getApplicableScopeRefs(input.targetScopePacket);
  const relationPacketId = createRelationPacketId({
    subtype: 'assembly_association',
    subjectPacketId: input.actorPacket.header.packet_id,
    targetPacketId: input.targetScopePacket.header.packet_id,
    scopePacketId: input.targetScopePacket.header.packet_id,
  });
  const claimPacketId = createClaimPacketId({
    claimKind: 'assembly_association',
    subjectPacketId: input.actorPacket.header.packet_id,
    targetPacketId: input.targetScopePacket.header.packet_id,
    scopePacketId: input.targetScopePacket.header.packet_id,
  });
  const [
    existingPreferredRelationRevision,
    existingPreferredClaimRevision,
    existingPreferredRelationPacket,
    existingPreferredClaimPacket,
  ] = await Promise.all([
    input.packetStore.fetchPreferredRevision({ packet_id: relationPacketId }),
    input.packetStore.fetchPreferredRevision({ packet_id: claimPacketId }),
    input.packetStore.fetchByPacket({ packet_id: relationPacketId }),
    input.packetStore.fetchByPacket({ packet_id: claimPacketId }),
  ]);
  const existingRelationPacket =
    existingPreferredRelationPacket?.header.family === 'Relation'
      ? (existingPreferredRelationPacket as PacketEnvelopeByType['Relation'])
      : null;
  const existingClaimPacket =
    existingPreferredClaimPacket?.header.family === 'Claim'
      ? (existingPreferredClaimPacket as PacketEnvelopeByType['Claim'])
      : null;
  const isSetMode = input.mode === 'set';

  if (
    input.skipIfAlreadyActive &&
    isSetMode &&
    existingRelationPacket?.body.status === 'active' &&
    existingClaimPacket?.body.status === 'active'
  ) {
    return {
      packets: [],
      governingScopePacket: input.targetScopePacket,
    };
  }

  const packets: PacketEnvelope[] = [];

  if (isSetMode || existingRelationPacket) {
    packets.push(
      createScopedRelationPacket({
        subtype: 'assembly_association',
        subjectPacketId: input.actorPacket.header.packet_id,
        targetPacketId: input.targetScopePacket.header.packet_id,
        scopePacketId: input.targetScopePacket.header.packet_id,
        applicableScopeRefs,
        createdByPacketId: input.actorPacket.header.packet_id,
        note: isSetMode
          ? input.note ?? null
          : existingRelationPacket?.body.note ?? null,
        status: isSetMode ? 'active' : 'withdrawn',
        packetId: relationPacketId,
        parentRevisionRefs: existingPreferredRelationRevision
          ? [existingPreferredRelationRevision]
          : [],
        supportingRefs: existingRelationPacket?.body.supporting_refs ?? [],
        policyRef: existingRelationPacket?.body.policy_ref ?? null,
        termsRef: existingRelationPacket?.body.terms_ref ?? null,
      })
    );
  }

  if (isSetMode || existingClaimPacket) {
    packets.push(
      createRelationAssertionClaimPacket({
        claimKind: 'assembly_association',
        subjectPacketId: input.actorPacket.header.packet_id,
        relationPacketId,
        assertedTargetPacketId: input.targetScopePacket.header.packet_id,
        scopePacketId: input.targetScopePacket.header.packet_id,
        applicableScopeRefs,
        createdByPacketId: input.actorPacket.header.packet_id,
        note: isSetMode
          ? input.note ?? null
          : existingClaimPacket?.body.claim_markdown ?? existingClaimPacket?.body.note ?? null,
        status: isSetMode ? 'active' : 'withdrawn',
        packetId: claimPacketId,
        parentRevisionRefs: existingPreferredClaimRevision
          ? [existingPreferredClaimRevision]
          : [],
      })
    );
  }

  return {
    packets,
    governingScopePacket: input.targetScopePacket,
  };
}

export async function planFollowRelationPackets(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacket: PacketEnvelopeByType['Element'];
  targetScopePacket: PacketEnvelopeByType['Element'];
  mode: 'set' | 'clear';
  skipIfAlreadyActive?: boolean;
}): Promise<ScopeRelationPacketPlan> {
  const applicableScopeRefs = getApplicableScopeRefs(input.targetScopePacket);
  const relationPacketId = createRelationPacketId({
    subtype: 'follows',
    subjectPacketId: input.actorPacket.header.packet_id,
    targetPacketId: input.targetScopePacket.header.packet_id,
    scopePacketId: input.targetScopePacket.header.packet_id,
  });
  const [existingPreferredRelationRevision, existingPreferredRelationPacket] =
    await Promise.all([
      input.packetStore.fetchPreferredRevision({ packet_id: relationPacketId }),
      input.packetStore.fetchByPacket({ packet_id: relationPacketId }),
    ]);
  const existingRelationPacket =
    existingPreferredRelationPacket?.header.family === 'Relation'
      ? (existingPreferredRelationPacket as PacketEnvelopeByType['Relation'])
      : null;
  const isSetMode = input.mode === 'set';

  if (
    input.skipIfAlreadyActive &&
    isSetMode &&
    existingRelationPacket?.body.status === 'active'
  ) {
    return {
      packets: [],
      governingScopePacket: input.targetScopePacket,
    };
  }

  const packets: PacketEnvelope[] = [];

  if (isSetMode || existingRelationPacket) {
    packets.push(
      createScopedRelationPacket({
        subtype: 'follows',
        subjectPacketId: input.actorPacket.header.packet_id,
        targetPacketId: input.targetScopePacket.header.packet_id,
        scopePacketId: input.targetScopePacket.header.packet_id,
        applicableScopeRefs,
        createdByPacketId: input.actorPacket.header.packet_id,
        note: existingRelationPacket?.body.note ?? null,
        status: isSetMode ? 'active' : 'withdrawn',
        packetId: relationPacketId,
        parentRevisionRefs: existingPreferredRelationRevision
          ? [existingPreferredRelationRevision]
          : [],
        supportingRefs: existingRelationPacket?.body.supporting_refs ?? [],
        policyRef: existingRelationPacket?.body.policy_ref ?? null,
        termsRef: existingRelationPacket?.body.terms_ref ?? null,
      })
    );
  }

  return {
    packets,
    governingScopePacket: input.targetScopePacket,
  };
}

export async function planHomeLocalityRelationPackets(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacket: PacketEnvelopeByType['Element'];
  homeScopePacket: PacketEnvelopeByType['Element'] | null;
  forceSelectedRevision?: boolean;
}): Promise<ScopeRelationPacketPlan> {
  const [claimPackets, relationPackets] = await Promise.all([
    listClaimPackets(input.packetStore),
    listRelationPackets(input.packetStore),
  ]);
  const activeHomeClaims = filterClaimPackets({
    claims: claimPackets,
    claimKind: 'home_locality',
    subjectPacketId: input.actorPacket.header.packet_id,
    activeOnly: true,
  });
  const activeHomeRelations = filterRelationPackets({
    relations: relationPackets,
    relationSubtype: 'home_locality',
    subjectPacketId: input.actorPacket.header.packet_id,
    activeOnly: true,
  });
  const packets: PacketEnvelope[] = [];
  let fallbackGoverningScopePacket: PacketEnvelopeByType['Element'] | null = null;

  for (const activeHomeRelation of activeHomeRelations) {
    if (
      input.homeScopePacket &&
      activeHomeRelation.body.target_ref.packet_id === input.homeScopePacket.header.packet_id
    ) {
      continue;
    }

    if (!fallbackGoverningScopePacket) {
      const targetPacket = await input.packetStore.fetchByPacket({
        packet_id: activeHomeRelation.body.target_ref.packet_id,
      });
      fallbackGoverningScopePacket =
        targetPacket?.header.family === 'Element'
          ? (targetPacket as PacketEnvelopeByType['Element'])
          : null;
    }

    packets.push(
      createScopedRelationPacket({
        subtype: 'home_locality',
        subjectPacketId: input.actorPacket.header.packet_id,
        targetPacketId: activeHomeRelation.body.target_ref.packet_id,
        scopePacketId:
          activeHomeRelation.body.scope_ref?.packet_id ??
          activeHomeRelation.body.target_ref.packet_id,
        applicableScopeRefs: activeHomeRelation.header.applicable_scope_refs,
        createdByPacketId: input.actorPacket.header.packet_id,
        note: activeHomeRelation.body.note,
        status: 'withdrawn',
        packetId: activeHomeRelation.header.packet_id,
        parentRevisionRefs: [
          {
            packet_id: activeHomeRelation.header.packet_id,
            revision_id: activeHomeRelation.header.revision_id,
          },
        ],
        supportingRefs: activeHomeRelation.body.supporting_refs,
        policyRef: activeHomeRelation.body.policy_ref,
        termsRef: activeHomeRelation.body.terms_ref,
      })
    );
  }

  for (const activeHomeClaim of activeHomeClaims) {
    const activeHomeClaimTargetPacketId =
      activeHomeClaim.body.relation_assertion?.target_ref.packet_id ??
      activeHomeClaim.body.target_ref.packet_id;

    if (
      input.homeScopePacket &&
      activeHomeClaimTargetPacketId === input.homeScopePacket.header.packet_id
    ) {
      continue;
    }

    if (!fallbackGoverningScopePacket) {
      const targetPacket = await input.packetStore.fetchByPacket({
        packet_id: activeHomeClaimTargetPacketId,
      });
      fallbackGoverningScopePacket =
        targetPacket?.header.family === 'Element'
          ? (targetPacket as PacketEnvelopeByType['Element'])
          : null;
    }

    packets.push(
      createRelationAssertionClaimPacket({
        claimKind: 'home_locality',
        subjectPacketId: input.actorPacket.header.packet_id,
        relationPacketId: activeHomeClaim.body.target_ref.packet_id,
        assertedTargetPacketId: activeHomeClaimTargetPacketId,
        scopePacketId: activeHomeClaim.body.scope_ref.packet_id,
        applicableScopeRefs: activeHomeClaim.header.applicable_scope_refs,
        createdByPacketId: input.actorPacket.header.packet_id,
        note: activeHomeClaim.body.claim_markdown ?? activeHomeClaim.body.note ?? null,
        status: 'withdrawn',
        packetId: activeHomeClaim.header.packet_id,
        parentRevisionRefs: [
          {
            packet_id: activeHomeClaim.header.packet_id,
            revision_id: activeHomeClaim.header.revision_id,
          },
        ],
      })
    );
  }

  if (!input.homeScopePacket) {
    return {
      packets,
      governingScopePacket: fallbackGoverningScopePacket,
    };
  }

  const applicableScopeRefs = getApplicableScopeRefs(input.homeScopePacket);
  const homeRelationPacketId = createRelationPacketId({
    subtype: 'home_locality',
    subjectPacketId: input.actorPacket.header.packet_id,
    targetPacketId: input.homeScopePacket.header.packet_id,
    scopePacketId: input.homeScopePacket.header.packet_id,
  });
  const homeClaimPacketId = createClaimPacketId({
    claimKind: 'home_locality',
    subjectPacketId: input.actorPacket.header.packet_id,
    targetPacketId: input.homeScopePacket.header.packet_id,
    scopePacketId: input.homeScopePacket.header.packet_id,
  });
  const [
    existingPreferredRelationRevision,
    existingPreferredClaimRevision,
    existingPreferredRelationPacket,
    existingPreferredClaimPacket,
  ] = await Promise.all([
    input.packetStore.fetchPreferredRevision({ packet_id: homeRelationPacketId }),
    input.packetStore.fetchPreferredRevision({ packet_id: homeClaimPacketId }),
    input.packetStore.fetchByPacket({ packet_id: homeRelationPacketId }),
    input.packetStore.fetchByPacket({ packet_id: homeClaimPacketId }),
  ]);
  const existingRelationPacket =
    existingPreferredRelationPacket?.header.family === 'Relation'
      ? (existingPreferredRelationPacket as PacketEnvelopeByType['Relation'])
      : null;
  const existingClaimPacket =
    existingPreferredClaimPacket?.header.family === 'Claim'
      ? (existingPreferredClaimPacket as PacketEnvelopeByType['Claim'])
      : null;

  if (input.forceSelectedRevision || existingRelationPacket?.body.status !== 'active') {
    packets.push(
      createScopedRelationPacket({
        subtype: 'home_locality',
        subjectPacketId: input.actorPacket.header.packet_id,
        targetPacketId: input.homeScopePacket.header.packet_id,
        scopePacketId: input.homeScopePacket.header.packet_id,
        applicableScopeRefs,
        createdByPacketId: input.actorPacket.header.packet_id,
        status: 'active',
        packetId: homeRelationPacketId,
        parentRevisionRefs: existingPreferredRelationRevision
          ? [existingPreferredRelationRevision]
          : [],
      })
    );
  }

  if (input.forceSelectedRevision || existingClaimPacket?.body.status !== 'active') {
    packets.push(
      createRelationAssertionClaimPacket({
        claimKind: 'home_locality',
        subjectPacketId: input.actorPacket.header.packet_id,
        relationPacketId: homeRelationPacketId,
        assertedTargetPacketId: input.homeScopePacket.header.packet_id,
        scopePacketId: input.homeScopePacket.header.packet_id,
        applicableScopeRefs,
        createdByPacketId: input.actorPacket.header.packet_id,
        status: 'active',
        packetId: homeClaimPacketId,
        parentRevisionRefs: existingPreferredClaimRevision
          ? [existingPreferredClaimRevision]
          : [],
      })
    );
  }

  return {
    packets,
    governingScopePacket: input.homeScopePacket,
  };
}
