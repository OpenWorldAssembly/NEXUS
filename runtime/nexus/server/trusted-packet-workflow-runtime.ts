/**
 * File: trusted-packet-workflow-runtime.ts
 * Description: Trusted local execution seam for live generic packet workflow promotion.
 */

import { getPacketUnsignedDigestCandidates } from '@core/auth/mutation-digests';
import type {
  MutationIntent,
  PreparedMutation,
} from '@core/auth/mutation-corridor';
import type { MutationActionId } from '@core/auth/write-policy';
import type {
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import {
  planFollowRelationPackets,
  type ScopeRelationPacketPlan,
} from '@runtime/nexus/server/elemental-scope-relation-planner';
import type { MutationPolicyGate } from '@runtime/nexus/server/mutation-policy-gate';
import {
  getPacketWorkflowAlignmentCoverage,
} from '@runtime/nexus/server/packet-workflow-alignment-audit';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export type LiveGenericWorkflowEnrollment = {
  enrollment_id: string;
  mutation_intent: Extract<
    MutationIntent['kind'],
    'follows.relation.set' | 'follows.relation.clear'
  >;
  packet_type: 'Relation';
  packet_subtype: 'follows';
  workflow_plan_id: string;
  operation_kind: 'relation.set' | 'relation.clear';
  policy_action_ids: MutationActionId[];
  dependency_ids: string[];
  trusted_capability_ids: string[];
  fortress_prepare_handler: 'prepareFollowRelation';
  fortress_finalize_handler: 'finalizeFollowRelationUpdate';
  live_mode: 'trusted_generic_workflow';
  notes: string;
};

export type TrustedRelationOperationPlan = {
  plan_kind: 'trusted_relation_operation_plan';
  mutation_intent: LiveGenericWorkflowEnrollment['mutation_intent'];
  operation_kind: LiveGenericWorkflowEnrollment['operation_kind'];
  workflow_plan_id: string;
  packet_type: 'Relation';
  packet_subtype: 'follows';
  policy_action_ids: MutationActionId[];
  dependency_ids: string[];
  trusted_capability_ids: string[];
  target_scope_packet: PacketEnvelopeByType['Element'];
  governing_scope_packet: PacketEnvelopeByType['Element'];
  relation_plan: ScopeRelationPacketPlan;
};

export type TrustedPacketWorkflowMutationInput = {
  packetStore: NodeSQLitePacketStore;
  policyGate: MutationPolicyGate;
  actorPacket: PacketEnvelopeByType['Element'];
  intent:
    | Extract<MutationIntent, { kind: 'follows.relation.set' }>
    | Extract<MutationIntent, { kind: 'follows.relation.clear' }>;
};

export type LiveGenericWorkflowEnrollmentAuditFinding = {
  severity: 'error';
  code: string;
  enrollment_id: string;
  message: string;
};

export type LiveGenericWorkflowEnrollmentAuditReport = {
  status: 'pass' | 'fail';
  checked_enrollment_ids: string[];
  findings: LiveGenericWorkflowEnrollmentAuditFinding[];
};

const LIVE_GENERIC_WORKFLOW_INTENTS = [
  'follows.relation.set',
  'follows.relation.clear',
] as const;

function isClaimedActorPacket(actorPacket: PacketEnvelopeByType['Element']): boolean {
  return actorPacket.body.identity?.claim_status === 'claimed';
}

function requireFollowEnrollment(
  mutationIntent: MutationIntent['kind']
): LiveGenericWorkflowEnrollment {
  const enrollment = listLiveGenericWorkflowEnrollments().find(
    (candidate) => candidate.mutation_intent === mutationIntent
  );

  if (!enrollment) {
    throw new Error(
      `Unsupported live generic workflow mutation intent: ${mutationIntent}`
    );
  }

  return enrollment;
}

async function requireElementPacket(input: {
  packetStore: NodeSQLitePacketStore;
  packetId: string;
}): Promise<PacketEnvelopeByType['Element']> {
  const packet = await input.packetStore.fetchByPacket({
    packet_id: input.packetId,
  });

  if (!packet || packet.header.family !== 'Element') {
    throw new Error(`Unknown Element packet: ${input.packetId}`);
  }

  return packet as PacketEnvelopeByType['Element'];
}

function createEnrollment(
  mutationIntent: (typeof LIVE_GENERIC_WORKFLOW_INTENTS)[number]
): LiveGenericWorkflowEnrollment {
  const alignment = getPacketWorkflowAlignmentCoverage(mutationIntent);

  if (
    !alignment ||
    alignment.workflow_alignment_status !== 'workflow_aligned' ||
    !alignment.dry_run_ready
  ) {
    throw new Error(
      `Live generic workflow enrollment is not shadow-aligned: ${mutationIntent}`
    );
  }

  const operationKind =
    mutationIntent === 'follows.relation.set' ? 'relation.set' : 'relation.clear';

  return {
    enrollment_id: `live.generic.workflow.${mutationIntent}`,
    mutation_intent: mutationIntent,
    packet_type: 'Relation',
    packet_subtype: 'follows',
    workflow_plan_id:
      mutationIntent === 'follows.relation.set'
        ? 'relation.follows.set.workflow.v0'
        : 'relation.follows.clear.workflow.v0',
    operation_kind: operationKind,
    policy_action_ids: [mutationIntent],
    dependency_ids: [...alignment.dependency_ids],
    trusted_capability_ids: [...alignment.trusted_capability_ids],
    fortress_prepare_handler: 'prepareFollowRelation',
    fortress_finalize_handler: 'finalizeFollowRelationUpdate',
    live_mode: 'trusted_generic_workflow',
    notes:
      'First promoted generic workflow: trusted local Relation planner executes definition-declared follow set/clear workflow metadata inside the existing fortress prepare/finalize corridor.',
  };
}

export function listLiveGenericWorkflowEnrollments(): LiveGenericWorkflowEnrollment[] {
  return LIVE_GENERIC_WORKFLOW_INTENTS.map(createEnrollment);
}

export function auditLiveGenericWorkflowEnrollments(): LiveGenericWorkflowEnrollmentAuditReport {
  const findings: LiveGenericWorkflowEnrollmentAuditFinding[] = [];
  const enrollments = listLiveGenericWorkflowEnrollments();

  for (const enrollment of enrollments) {
    const alignment = getPacketWorkflowAlignmentCoverage(enrollment.mutation_intent);

    if (!alignment) {
      findings.push({
        severity: 'error',
        code: 'missing_workflow_alignment',
        enrollment_id: enrollment.enrollment_id,
        message: `${enrollment.mutation_intent} is live generic-enrolled without workflow alignment coverage.`,
      });
      continue;
    }

    if (
      alignment.workflow_alignment_status !== 'workflow_aligned' ||
      !alignment.dry_run_ready
    ) {
      findings.push({
        severity: 'error',
        code: 'workflow_not_ready',
        enrollment_id: enrollment.enrollment_id,
        message: `${enrollment.mutation_intent} is live generic-enrolled before its shadow workflow dry-run is ready.`,
      });
    }

    if (!alignment.workflow_plan_ids.includes(enrollment.workflow_plan_id)) {
      findings.push({
        severity: 'error',
        code: 'workflow_plan_mismatch',
        enrollment_id: enrollment.enrollment_id,
        message: `${enrollment.enrollment_id} points at ${enrollment.workflow_plan_id}, which is not in alignment coverage.`,
      });
    }

    if (!alignment.operation_kinds.includes(enrollment.operation_kind)) {
      findings.push({
        severity: 'error',
        code: 'operation_kind_mismatch',
        enrollment_id: enrollment.enrollment_id,
        message: `${enrollment.enrollment_id} points at ${enrollment.operation_kind}, which is not in alignment coverage.`,
      });
    }

    if (
      enrollment.policy_action_ids.length === 0 ||
      enrollment.dependency_ids.length === 0 ||
      enrollment.trusted_capability_ids.length === 0
    ) {
      findings.push({
        severity: 'error',
        code: 'incomplete_live_generic_metadata',
        enrollment_id: enrollment.enrollment_id,
        message: `${enrollment.enrollment_id} is missing policy, dependency, or trusted capability metadata.`,
      });
    }
  }

  return {
    status: findings.length > 0 ? 'fail' : 'pass',
    checked_enrollment_ids: enrollments.map(
      (enrollment) => enrollment.enrollment_id
    ),
    findings,
  };
}

export async function resolveTrustedRelationOperationPlan(
  input: TrustedPacketWorkflowMutationInput
): Promise<TrustedRelationOperationPlan> {
  if (!isClaimedActorPacket(input.actorPacket)) {
    throw new Error('Follow relations require a claimed identity.');
  }

  const enrollment = requireFollowEnrollment(input.intent.kind);
  const targetScopePacket = await requireElementPacket({
    packetStore: input.packetStore,
    packetId: input.intent.target_scope_packet_id,
  });
  const relationPlan = await planFollowRelationPackets({
    packetStore: input.packetStore,
    actorPacket: input.actorPacket,
    targetScopePacket,
    mode: input.intent.kind === 'follows.relation.set' ? 'set' : 'clear',
  });

  return {
    plan_kind: 'trusted_relation_operation_plan',
    mutation_intent: enrollment.mutation_intent,
    operation_kind: enrollment.operation_kind,
    workflow_plan_id: enrollment.workflow_plan_id,
    packet_type: enrollment.packet_type,
    packet_subtype: enrollment.packet_subtype,
    policy_action_ids: [...enrollment.policy_action_ids],
    dependency_ids: [...enrollment.dependency_ids],
    trusted_capability_ids: [...enrollment.trusted_capability_ids],
    target_scope_packet: targetScopePacket,
    governing_scope_packet: targetScopePacket,
    relation_plan: relationPlan,
  };
}

export async function runTrustedPacketWorkflowMutation(
  input: TrustedPacketWorkflowMutationInput
): Promise<PreparedMutation> {
  const operationPlan = await resolveTrustedRelationOperationPlan(input);
  const policyDecision = await input.policyGate.resolveScopePolicyDecision({
    governingScopePacket: operationPlan.governing_scope_packet,
    actorPacket: input.actorPacket,
    actionIds: operationPlan.policy_action_ids,
  });
  const preparedPackets = await Promise.all(
    operationPlan.relation_plan.packets.map(async (packet: PacketEnvelope) => {
      const digests = await getPacketUnsignedDigestCandidates(packet);

      return {
        packet,
        unsigned_digest: digests[0]?.digest ?? '',
      };
    })
  );

  return {
    kind: input.intent.kind,
    ...policyDecision,
    governing_scope_packet_id:
      operationPlan.governing_scope_packet.header.packet_id,
    prepared_packets: preparedPackets,
  };
}
