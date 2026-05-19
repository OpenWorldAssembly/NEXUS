import assert from 'node:assert/strict';
import test from 'node:test';

import { createAssemblyPacket } from '@core/packets/builders';
import { createPersonIdentityPacket } from '@core/packets/identity';
import type {
  MutationIntent,
  PreparedMutation,
} from '@core/auth/mutation-corridor';
import type { MutationActionId } from '@core/auth/write-policy';
import type { PacketEnvelope } from '@core/schema/packet-schema';
import { createIdentityKeyBinding } from '@runtime/nexus/identity-crypto';
import { planFollowRelationPackets } from './elemental-scope-relation-planner.ts';
import type { MutationPolicyGate } from './mutation-policy-gate.ts';
import {
  auditLiveGenericWorkflowEnrollments,
  listLiveGenericWorkflowEnrollments,
  resolveTrustedRelationOperationPlan,
  runTrustedPacketWorkflowMutation,
} from './trusted-packet-workflow-runtime.ts';

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
  existingRelationPacket?: PacketEnvelope | null;
}) {
  return {
    async fetchByPacket({ packet_id }: { packet_id: string }) {
      if (packet_id === input.targetScopePacket.header.packet_id) {
        return input.targetScopePacket;
      }

      if (packet_id === input.existingRelationPacket?.header.packet_id) {
        return input.existingRelationPacket;
      }

      return null;
    },
    async fetchPreferredRevision({ packet_id }: { packet_id: string }) {
      if (packet_id === input.existingRelationPacket?.header.packet_id) {
        return {
          packet_id,
          revision_id: input.existingRelationPacket.header.revision_id,
        };
      }

      return null;
    },
  };
}

function createPolicyGate() {
  return {
    async resolveScopePolicyDecision(input: {
      governingScopePacket: PacketEnvelope;
      actionIds: MutationActionId[];
    }) {
      return {
        action_ids: input.actionIds,
        required_proof_level: 'claimed_session' as const,
        accepted_proof_methods: ['claimed_session' as const],
        source_policy_packet_ids: ['nexus:policy/write-lock'],
        governing_scope_packet_id: input.governingScopePacket.header.packet_id,
      };
    },
  } as MutationPolicyGate;
}

function normalizeGeneratedTimestamps(packet: PacketEnvelope) {
  return JSON.parse(
    JSON.stringify(packet).replace(
      /20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z/g,
      '<generated>'
    )
  );
}

test('live generic workflow enrollment includes only follow set and clear', () => {
  assert.deepEqual(
    listLiveGenericWorkflowEnrollments().map(
      (enrollment) => enrollment.mutation_intent
    ),
    ['follows.relation.set', 'follows.relation.clear']
  );

  const report = auditLiveGenericWorkflowEnrollments();
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.findings, []);
});

test('trusted follow set planner matches the existing relation planner oracle', async () => {
  const actorPacket = await createClaimedActor();
  const targetScopePacket = createTargetScope();
  const packetStore = createFakeStore({ targetScopePacket });
  const intent: Extract<MutationIntent, { kind: 'follows.relation.set' }> = {
    kind: 'follows.relation.set',
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
  assert.equal(trustedPlan.workflow_plan_id, 'relation.follows.set.workflow.v0');
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
  const intent: Extract<MutationIntent, { kind: 'follows.relation.clear' }> = {
    kind: 'follows.relation.clear',
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
  assert.equal(
    trustedPlan.relation_plan.packets[0]?.body.status,
    'withdrawn'
  );
});

test('trusted workflow mutation returns existing fortress prepare shape', async () => {
  const actorPacket = await createClaimedActor();
  const targetScopePacket = createTargetScope();
  const preparedMutation: PreparedMutation = await runTrustedPacketWorkflowMutation({
    packetStore: createFakeStore({ targetScopePacket }) as never,
    policyGate: createPolicyGate(),
    actorPacket,
    intent: {
      kind: 'follows.relation.set',
      scope_id: 'target-scope',
      target_scope_packet_id: targetScopePacket.header.packet_id,
    },
  });

  assert.equal(preparedMutation.kind, 'follows.relation.set');
  assert.deepEqual(preparedMutation.action_ids, ['follows.relation.set']);
  assert.equal(
    preparedMutation.governing_scope_packet_id,
    targetScopePacket.header.packet_id
  );
  assert.equal(preparedMutation.prepared_packets.length, 1);
  assert.equal(
    preparedMutation.prepared_packets[0].packet.header.family,
    'Relation'
  );
  assert.ok(preparedMutation.prepared_packets[0].unsigned_digest);
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
          kind: 'home_locality.relation.set',
          home_scope_packet_id: targetScopePacket.header.packet_id,
        } as never,
      }),
    /Unsupported live generic workflow mutation intent/
  );
});
