import assert from 'node:assert/strict';
import test from 'node:test';

import { createAssemblyPacket, createRolePacket } from '@core/packets/builders';
import { createPersonIdentityPacket } from '@core/packets/identity';
import type {
  MutationIntent,
  PreparedMutation,
} from '@core/auth/mutation-corridor';
import type { MutationActionId } from '@core/auth/write-policy';
import type { PacketEnvelope, PacketEnvelopeByType } from '@core/schema/packet-schema';
import { createIdentityKeyBinding } from '@runtime/nexus/identity-crypto';
import {
  planAssociationRelationPackets,
  planFollowRelationPackets,
  planResidenceRelationPackets,
} from '@runtime/nexus/server/elemental-scope-relation-planner';
import type { MutationPolicyGate } from '@runtime/nexus/server/mutation-policy-gate';
import {
  auditLiveGenericWorkflowEnrollments,
  listLiveGenericWorkflowEnrollments,
  resolveTrustedRoleParticipationRelationOperationPlan,
  resolveTrustedRelationOperationPlan,
  runTrustedPacketWorkflowMutation,
} from './trusted_packet_workflow_coordinator.ts';

async function createClaimedActor() {
  return createPersonIdentityPacket({
    alias: 'Claimed Actor',
    claimStatus: 'claimed',
    packetId: 'nexus:element/claimed-actor',
    createdAt: '2026-05-19T00:00:00.000Z',
    publicKeyBinding: await createIdentityKeyBinding({
      publicJwk: {
        kty: 'EC',
        crv: 'P-256',
        x: 'x-local',
        y: 'y-local',
      },
      addedAt: '2026-05-19T00:00:00.000Z',
    }),
  });
}

function createTargetScope() {
  return createAssemblyPacket({
    packet_id: 'nexus:element/target-scope',
    created_at: '2026-05-19T00:01:00.000Z',
    name: 'Target Scope',
    subtype: 'assembly',
    locality_label: 'Target Scope',
  });
}

function createFakeStore(input: {
  targetScopePacket: PacketEnvelope;
  extraPackets?: PacketEnvelope[];
  existingRelationPacket?: PacketEnvelope | null;
  existingClaimRevision?: { packet_id: string; revision_id: string } | null;
}) {
  const packetsById = new Map(
    [input.targetScopePacket, ...(input.extraPackets ?? [])].map((packet) => [
      packet.header.packet_id,
      packet,
    ])
  );

  return {
    async fetchByPacket({ packet_id }: { packet_id: string }) {
      if (packet_id === input.existingRelationPacket?.header.packet_id) {
        return input.existingRelationPacket;
      }

      return packetsById.get(packet_id) ?? null;
    },
    async fetchPreferredRevision({ packet_id }: { packet_id: string }) {
      if (packet_id === input.existingClaimRevision?.packet_id) {
        return input.existingClaimRevision;
      }

      if (packet_id === input.existingRelationPacket?.header.packet_id) {
        return {
          packet_id,
          revision_id: input.existingRelationPacket.header.revision_id,
        };
      }

      return null;
    },
    async listPreferredPacketsByType(type: string) {
      return [
        input.existingRelationPacket,
        ...(input.extraPackets ?? []),
      ].filter(
        (packet): packet is PacketEnvelope =>
          !!packet && packet.header.type === type
      );
    },
  };
}

function createPolicyGate() {
  return {
    async resolveScopePolicyDecision(input: {
      governingScopePacket: PacketEnvelope | null;
      actionIds: MutationActionId[];
    }) {
      return {
        action_ids: input.actionIds,
        required_proof_level: 'claimed_session' as const,
        accepted_proof_methods: ['claimed_session' as const],
        source_policy_packet_ids: ['nexus:policy/write-lock'],
        governing_scope_packet_id: input.governingScopePacket?.header.packet_id ?? null,
      };
    },
  } as unknown as MutationPolicyGate;
}

function normalizeGeneratedTimestamps(packet: PacketEnvelope) {
  return JSON.parse(
    JSON.stringify(packet).replace(
      /20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z/g,
      '<generated>'
    )
  );
}

test('live generic workflow enrollment includes relation and reaction direct operations', () => {
  assert.deepEqual(
    listLiveGenericWorkflowEnrollments().map(
      (enrollment) => enrollment.mutation_intent
    ),
    [
      'relation.association.add',
      'relation.association.clear',
      'relation.residence.add',
      'relation.follow.add',
      'relation.follow.clear',
      'relation.participation.add',
      'relation.participation.clear',
      'reaction.vote.set',
    ]
  );

  const report = auditLiveGenericWorkflowEnrollments();
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.findings, []);
});

test('trusted association planner matches the existing relation planner oracle', async () => {
  const actorPacket = await createClaimedActor();
  const targetScopePacket = createTargetScope();
  const packetStore = createFakeStore({ targetScopePacket });
  const intent: Extract<
    MutationIntent,
    { kind: 'relation.association.add' }
  > = {
    kind: 'relation.association.add',
    scope_id: 'target-scope',
    target_packet_id: targetScopePacket.header.packet_id,
    note: 'Joining the assembly',
  };

  const trustedPlan = await resolveTrustedRelationOperationPlan({
    packetStore: packetStore as never,
    policyGate: createPolicyGate(),
    actorPacket,
    intent,
  });
  const oraclePlan = await planAssociationRelationPackets({
    packetStore: packetStore as never,
    actorPacket,
    targetScopePacket,
    mode: 'set',
    note: intent.note,
  });

  assert.equal(trustedPlan.operation_kind, 'relation.set');
  assert.equal(
    trustedPlan.workflow_plan_id,
    'relation.association.add.workflow.v0'
  );
  assert.deepEqual(
    trustedPlan.relation_plan.packets.map(normalizeGeneratedTimestamps),
    oraclePlan.packets.map(normalizeGeneratedTimestamps)
  );
  assert.deepEqual(
    trustedPlan.relation_plan.packets.map((packet) => packet.header.type),
    ['Relation']
  );
});

test('trusted home locality planner matches the existing relation planner oracle', async () => {
  const actorPacket = await createClaimedActor();
  const targetScopePacket = createTargetScope();
  const packetStore = createFakeStore({ targetScopePacket });
  const intent: Extract<MutationIntent, { kind: 'relation.residence.add' }> = {
    kind: 'relation.residence.add',
    residence_scope_packet_id: targetScopePacket.header.packet_id,
  };

  const trustedPlan = await resolveTrustedRelationOperationPlan({
    packetStore: packetStore as never,
    policyGate: createPolicyGate(),
    actorPacket,
    intent,
  });
  const oraclePlan = await planResidenceRelationPackets({
    packetStore: packetStore as never,
    actorPacket,
    residenceScopePacket: targetScopePacket,
    forceSelectedRevision: true,
  });

  assert.equal(trustedPlan.operation_kind, 'relation.set');
  assert.deepEqual(
    trustedPlan.relation_plan.packets.map(normalizeGeneratedTimestamps),
    oraclePlan.packets.map(normalizeGeneratedTimestamps)
  );
  assert.deepEqual(
    trustedPlan.relation_plan.packets.map((packet) => packet.header.type),
    ['Relation']
  );
});

test('trusted follow set planner matches the existing relation planner oracle', async () => {
  const actorPacket = await createClaimedActor();
  const targetScopePacket = createTargetScope();
  const packetStore = createFakeStore({ targetScopePacket });
  const intent: Extract<MutationIntent, { kind: 'relation.follow.add' }> = {
    kind: 'relation.follow.add',
    scope_id: 'target-scope',
    target_scope_packet_id: targetScopePacket.header.packet_id,
  };

  const trustedPlan = await resolveTrustedRelationOperationPlan({
    packetStore: packetStore as never,
    policyGate: createPolicyGate(),
    actorPacket,
    intent,
  });
  const oraclePlan = await planFollowRelationPackets({
    packetStore: packetStore as never,
    actorPacket,
    targetScopePacket,
    mode: 'set',
  });

  assert.equal(trustedPlan.operation_kind, 'relation.set');
  assert.equal(trustedPlan.workflow_plan_id, 'relation.follow.add.workflow.v0');
  assert.deepEqual(
    trustedPlan.relation_plan.packets.map(normalizeGeneratedTimestamps),
    oraclePlan.packets.map(normalizeGeneratedTimestamps)
  );
});

test('trusted follow clear planner matches withdrawn relation oracle', async () => {
  const actorPacket = await createClaimedActor();
  const targetScopePacket = createTargetScope();
  const setStore = createFakeStore({ targetScopePacket });
  const setOracle = await planFollowRelationPackets({
    packetStore: setStore as never,
    actorPacket,
    targetScopePacket,
    mode: 'set',
  });
  const existingRelationPacket = setOracle.packets[0];
  assert.ok(existingRelationPacket);

  const clearStore = createFakeStore({
    targetScopePacket,
    existingRelationPacket,
  });
  const intent: Extract<MutationIntent, { kind: 'relation.follow.clear' }> = {
    kind: 'relation.follow.clear',
    scope_id: 'target-scope',
    target_scope_packet_id: targetScopePacket.header.packet_id,
  };
  const trustedPlan = await resolveTrustedRelationOperationPlan({
    packetStore: clearStore as never,
    policyGate: createPolicyGate(),
    actorPacket,
    intent,
  });
  const oraclePlan = await planFollowRelationPackets({
    packetStore: clearStore as never,
    actorPacket,
    targetScopePacket,
    mode: 'clear',
  });

  assert.equal(trustedPlan.operation_kind, 'relation.clear');
  assert.deepEqual(
    trustedPlan.relation_plan.packets.map(normalizeGeneratedTimestamps),
    oraclePlan.packets.map(normalizeGeneratedTimestamps)
  );
  const withdrawnRelationPacket = trustedPlan.relation_plan
    .packets[0] as PacketEnvelopeByType['Relation'] | undefined;
  assert.equal(withdrawnRelationPacket?.body.status, 'withdrawn');
});

test('trusted workflow mutation returns existing Dispatch prepare shape', async () => {
  const actorPacket = await createClaimedActor();
  const targetScopePacket = createTargetScope();
  const preparedMutation: PreparedMutation = await runTrustedPacketWorkflowMutation({
    packetStore: createFakeStore({ targetScopePacket }) as never,
    policyGate: createPolicyGate(),
    actorPacket,
    intent: {
      kind: 'relation.follow.add',
      scope_id: targetScopePacket.header.packet_id,
      target_scope_packet_id: targetScopePacket.header.packet_id,
    },
  });

  assert.equal(preparedMutation.kind, 'relation.follow.add');
  assert.deepEqual(preparedMutation.action_ids, ['relation.follow.add']);
  assert.equal(
    preparedMutation.governing_scope_packet_id,
    targetScopePacket.header.packet_id
  );
  assert.equal(preparedMutation.prepared_packets.length, 1);
  assert.equal(
    preparedMutation.prepared_packets[0].packet.header.type,
    'Relation'
  );
  assert.ok(preparedMutation.prepared_packets[0].unsigned_digest);
});

test('trusted role claim planner creates assert and withdraw operations from packet-defined values', async () => {
  const actorPacket = await createClaimedActor();
  const targetScopePacket = createTargetScope();
  const rolePacket = createRolePacket({
    packet_id: 'nexus:role/facilitator',
    created_at: '2026-05-19T00:02:00.000Z',
    authority_scope_ref: { packet_id: targetScopePacket.header.packet_id },
    applicable_scope_refs: [{ packet_id: targetScopePacket.header.packet_id }],
    created_by: { packet_id: actorPacket.header.packet_id },
    title: 'Facilitator',
    subtype: 'facilitator',
    status: 'active',
  });
  const packetStore = createFakeStore({
    targetScopePacket,
    extraPackets: [rolePacket],
  });

  const setPlan = await resolveTrustedRoleParticipationRelationOperationPlan({
    packetStore: packetStore as never,
    policyGate: createPolicyGate(),
    actorPacket,
    intent: {
      kind: 'relation.participation.add',
      role_packet_id: rolePacket.header.packet_id,
      scope_id: targetScopePacket.header.packet_id,
    } as never,
  });
  const existingParticipationRelation = setPlan.relation_plan.packets[0] as PacketEnvelopeByType['Relation'];
  assert.ok(existingParticipationRelation);
  const withdrawPacketStore = createFakeStore({
    targetScopePacket,
    extraPackets: [rolePacket],
    existingRelationPacket: existingParticipationRelation,
  });
  const withdrawPlan = await resolveTrustedRoleParticipationRelationOperationPlan({
    packetStore: withdrawPacketStore as never,
    policyGate: createPolicyGate(),
    actorPacket,
    intent: {
      kind: 'relation.participation.clear',
      role_packet_id: rolePacket.header.packet_id,
      scope_id: targetScopePacket.header.packet_id,
    } as never,
  });

  assert.equal(setPlan.operation_kind, 'relation.set');
  assert.equal(existingParticipationRelation.body.status, 'active');
  const withdrawnParticipationRelation = withdrawPlan.relation_plan.packets[0] as PacketEnvelopeByType['Relation'];
  assert.equal(withdrawPlan.operation_kind, 'relation.clear');
  assert.equal(withdrawnParticipationRelation.body.status, 'withdrawn');
  assert.equal(setPlan.target_scope_packet?.header.packet_id, targetScopePacket.header.packet_id);
});

test('unsupported generic workflow requests fail closed', async () => {
  const actorPacket = await createClaimedActor();
  const targetScopePacket = createTargetScope();

  await assert.rejects(
    () =>
      resolveTrustedRelationOperationPlan({
        packetStore: createFakeStore({ targetScopePacket }) as never,
        policyGate: createPolicyGate(),
        actorPacket,
        intent: {
          kind: 'relation.participation.add',
          role_packet_id: 'nexus:role/facilitator',
          
        } as never,
      }),
    /Unsupported relation workflow mutation intent/
  );
});
