/**
 * File: elemental-scope-relation-planner.ts
 * Description: Plans actor-to-scope relation packets for Dispatch-owned mutations without persisting them.
 */

import {
  createRelationPacketId,
  createScopedRelationPacket,
} from '@core/packets/relations';
import type {
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
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

  if (!existingPacket || existingPacket.header.type !== 'Element') {
    throw new Error(`Unknown Element packet: ${input.packetId}`);
  }

  return existingPacket as PacketEnvelopeByType['Element'];
}

export async function planAssociationRelationPackets(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacket: PacketEnvelopeByType['Element'];
  targetScopePacket: PacketEnvelopeByType['Element'];
  mode: 'set' | 'clear';
  note?: string | null;
  skipIfAlreadyActive?: boolean;
}): Promise<ScopeRelationPacketPlan> {
  const applicableScopeRefs = getApplicableScopeRefs(input.targetScopePacket);
  const relationPacketId = createRelationPacketId({
    subtype: 'association',
    subjectPacketId: input.actorPacket.header.packet_id,
    targetPacketId: input.targetScopePacket.header.packet_id,
    scopePacketId: input.targetScopePacket.header.packet_id,
  });
  const [existingPreferredRelationRevision, existingPreferredRelationPacket] = await Promise.all([
    input.packetStore.fetchPreferredRevision({ packet_id: relationPacketId }),
    input.packetStore.fetchByPacket({ packet_id: relationPacketId }),
  ]);
  const existingRelationPacket =
    existingPreferredRelationPacket?.header.type === 'Relation'
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
        subtype: 'association',
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
    subtype: 'follow',
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
    existingPreferredRelationPacket?.header.type === 'Relation'
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
        subtype: 'follow',
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


export async function planRoleParticipationRelationPackets(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacket: PacketEnvelopeByType['Element'];
  rolePacket: PacketEnvelopeByType['Role'];
  scopePacket: PacketEnvelopeByType['Element'];
  mode: 'set' | 'clear';
  note?: string | null;
}): Promise<ScopeRelationPacketPlan> {
  const applicableScopeRefs = getApplicableScopeRefs(input.scopePacket);
  const relationPacketId = createRelationPacketId({
    subtype: 'participation',
    subjectPacketId: input.actorPacket.header.packet_id,
    targetPacketId: input.rolePacket.header.packet_id,
    scopePacketId: input.scopePacket.header.packet_id,
  });
  const [existingPreferredRelationRevision, existingPreferredRelationPacket] =
    await Promise.all([
      input.packetStore.fetchPreferredRevision({ packet_id: relationPacketId }),
      input.packetStore.fetchByPacket({ packet_id: relationPacketId }),
    ]);
  const existingRelationPacket =
    existingPreferredRelationPacket?.header.type === 'Relation'
      ? (existingPreferredRelationPacket as PacketEnvelopeByType['Relation'])
      : null;
  const isSetMode = input.mode === 'set';
  const packets: PacketEnvelope[] = [];

  if (isSetMode || existingRelationPacket) {
    packets.push(
      createScopedRelationPacket({
        subtype: 'participation',
        subjectPacketId: input.actorPacket.header.packet_id,
        targetPacketId: input.rolePacket.header.packet_id,
        scopePacketId: input.scopePacket.header.packet_id,
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

  return {
    packets,
    governingScopePacket: input.scopePacket,
  };
}

export async function planResidenceRelationPackets(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacket: PacketEnvelopeByType['Element'];
  residenceScopePacket: PacketEnvelopeByType['Element'] | null;
  forceSelectedRevision?: boolean;
}): Promise<ScopeRelationPacketPlan> {
  const relationPackets = await listRelationPackets(input.packetStore);
  const activeHomeRelations = filterRelationPackets({
    relations: relationPackets,
    relationSubtype: 'residence',
    subjectPacketId: input.actorPacket.header.packet_id,
    activeOnly: true,
  });
  const packets: PacketEnvelope[] = [];
  let fallbackGoverningScopePacket: PacketEnvelopeByType['Element'] | null = null;

  for (const activeHomeRelation of activeHomeRelations) {
    if (
      input.residenceScopePacket &&
      activeHomeRelation.body.target_ref.packet_id === input.residenceScopePacket.header.packet_id
    ) {
      continue;
    }

    if (!fallbackGoverningScopePacket) {
      const targetPacket = await input.packetStore.fetchByPacket({
        packet_id: activeHomeRelation.body.target_ref.packet_id,
      });
      fallbackGoverningScopePacket =
        targetPacket?.header.type === 'Element'
          ? (targetPacket as PacketEnvelopeByType['Element'])
          : null;
    }

    packets.push(
      createScopedRelationPacket({
        subtype: 'residence',
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

  if (!input.residenceScopePacket) {
    return {
      packets,
      governingScopePacket: fallbackGoverningScopePacket,
    };
  }

  const applicableScopeRefs = getApplicableScopeRefs(input.residenceScopePacket);
  const homeRelationPacketId = createRelationPacketId({
    subtype: 'residence',
    subjectPacketId: input.actorPacket.header.packet_id,
    targetPacketId: input.residenceScopePacket.header.packet_id,
    scopePacketId: input.residenceScopePacket.header.packet_id,
  });
  const [
    existingPreferredRelationRevision,
    existingPreferredRelationPacket,
  ] = await Promise.all([
    input.packetStore.fetchPreferredRevision({ packet_id: homeRelationPacketId }),
    input.packetStore.fetchByPacket({ packet_id: homeRelationPacketId }),
  ]);
  const existingRelationPacket =
    existingPreferredRelationPacket?.header.type === 'Relation'
      ? (existingPreferredRelationPacket as PacketEnvelopeByType['Relation'])
      : null;
  if (input.forceSelectedRevision || existingRelationPacket?.body.status !== 'active') {
    packets.push(
      createScopedRelationPacket({
        subtype: 'residence',
        subjectPacketId: input.actorPacket.header.packet_id,
        targetPacketId: input.residenceScopePacket.header.packet_id,
        scopePacketId: input.residenceScopePacket.header.packet_id,
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

  return {
    packets,
    governingScopePacket: input.residenceScopePacket,
  };
}
