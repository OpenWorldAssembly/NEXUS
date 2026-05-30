/**
 * File: trusted_packet_workflow_coordinator.ts
 * Description: Trusted runtime coordinator for live generic packet workflow promotion.
 */

import { getPacketUnsignedDigestCandidates } from '@core/auth/mutation-digests';
import type {
  MutationIntent,
  PreparedMutation,
} from '@core/auth/mutation-corridor';
import type { MutationActionId } from '@core/auth/write-policy';
import type { ReactionService } from '@core/contracts';
import { buildPacketVoteReactionPacket } from '@core/packets/discussion';
import type {
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import {
  planAssociationRelationPackets,
  planFollowRelationPackets,
  planResidenceRelationPackets,
  planRoleParticipationRelationPackets,
  type ScopeRelationPacketPlan,
} from '@runtime/nexus/server/elemental-scope-relation-planner';
import type { MutationPolicyGate } from '@runtime/nexus/server/mutation-policy-gate';
import {
  getPacketWorkflowAlignmentCoverage,
} from '@runtime/nexus/server/packet-workflow-alignment-audit';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export type LiveGenericWorkflowMutationIntent = Extract<
  MutationIntent['kind'],
  | 'relation.association.add'
  | 'relation.association.clear'
  | 'relation.residence.add'
  | 'relation.follow.add'
  | 'relation.follow.clear'
  | 'relation.participation.add'
  | 'relation.participation.clear'
  | 'reaction.vote.set'
>;

export type LiveGenericWorkflowEnrollment = {
  enrollment_id: string;
  mutation_intent: LiveGenericWorkflowMutationIntent;
  packet_type: 'Relation' | 'Claim' | 'Reaction';
  packet_subtype: string;
  workflow_plan_id: string;
  operation_kind:
    | 'relation.set'
    | 'relation.clear'
    | 'reaction.set'
    | 'reaction.clear';
  policy_action_ids: MutationActionId[];
  dependency_ids: string[];
  trusted_capability_ids: string[];
  dispatch_prepare_adapter:
    | 'prepareAssociationRelation'
    | 'prepareHomeLocalityRelation'
    | 'prepareFollowRelation'
    | 'prepareRoleParticipationRelation'
    | 'preparePacketVoteReaction';
  dispatch_finalize_adapter:
    | 'finalizeAssociationRelationUpdate'
    | 'finalizeHomeLocalityRelation'
    | 'finalizeFollowRelationUpdate'
    | 'finalizeRoleParticipationRelationUpdate'
    | 'finalizePacketVoteReaction';
  live_mode: 'trusted_generic_workflow';
  notes: string;
};

export type TrustedRelationOperationPlan = {
  plan_kind: 'trusted_relation_operation_plan';
  mutation_intent: Extract<
    LiveGenericWorkflowMutationIntent,
    | 'relation.association.add'
    | 'relation.association.clear'
    | 'relation.residence.add'
    | 'relation.follow.add'
    | 'relation.follow.clear'
    | 'relation.participation.add'
    | 'relation.participation.clear'
  >;
  operation_kind: 'relation.set' | 'relation.clear';
  workflow_plan_id: string;
  packet_type: 'Relation';
  packet_subtype: 'association' | 'residence' | 'follow' | 'participation';
  policy_action_ids: MutationActionId[];
  dependency_ids: string[];
  trusted_capability_ids: string[];
  target_scope_packet: PacketEnvelopeByType['Element'] | null;
  governing_scope_packet: PacketEnvelopeByType['Element'] | null;
  relation_plan: ScopeRelationPacketPlan;
};

export type TrustedReactionOperationPlan = {
  plan_kind: 'trusted_reaction_operation_plan';
  mutation_intent: 'reaction.vote.set';
  operation_kind: 'reaction.set' | 'reaction.clear';
  workflow_plan_id: string;
  packet_type: 'Reaction';
  packet_subtype: 'reaction';
  policy_action_ids: MutationActionId[];
  dependency_ids: string[];
  trusted_capability_ids: string[];
  target_packet: PacketEnvelopeByType['Discussion'];
  governing_scope_packet: PacketEnvelopeByType['Element'] | null;
  reaction_packet: PacketEnvelopeByType['Reaction'];
};

export type TrustedPacketWorkflowMutationInput = {
  packetStore: NodeSQLitePacketStore;
  policyGate: MutationPolicyGate;
  reactionService?: ReactionService;
  actorKey?: string;
  actorPacket: PacketEnvelopeByType['Element'];
  intent:
    | Extract<MutationIntent, { kind: 'relation.association.add' }>
    | Extract<MutationIntent, { kind: 'relation.association.clear' }>
    | Extract<MutationIntent, { kind: 'relation.residence.add' }>
    | Extract<MutationIntent, { kind: 'relation.follow.add' }>
    | Extract<MutationIntent, { kind: 'relation.follow.clear' }>
    | Extract<MutationIntent, { kind: 'relation.participation.add' }>
    | Extract<MutationIntent, { kind: 'relation.participation.clear' }>
    | Extract<MutationIntent, { kind: 'reaction.vote.set' }>;
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
  'relation.association.add',
  'relation.association.clear',
  'relation.residence.add',
  'relation.follow.add',
  'relation.follow.clear',
  'relation.participation.add',
  'relation.participation.clear',
  'reaction.vote.set',
] as const satisfies readonly LiveGenericWorkflowMutationIntent[];

function isClaimedActorPacket(actorPacket: PacketEnvelopeByType['Element']): boolean {
  return actorPacket.body.identity?.claim_status === 'claimed';
}

function requireLiveGenericEnrollment(
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

  if (!packet || packet.header.type !== 'Element') {
    throw new Error(`Unknown Element packet: ${input.packetId}`);
  }

  return packet as PacketEnvelopeByType['Element'];
}

async function requireRolePacket(input: {
  packetStore: NodeSQLitePacketStore;
  packetId: string;
}): Promise<PacketEnvelopeByType['Role']> {
  const packet = await input.packetStore.fetchByPacket({
    packet_id: input.packetId,
  });

  if (!packet || packet.header.type !== 'Role') {
    throw new Error(`Unknown Role packet: ${input.packetId}`);
  }

  return packet as PacketEnvelopeByType['Role'];
}

async function requireDiscussionTargetPacket(input: {
  packetStore: NodeSQLitePacketStore;
  packetId: string;
}): Promise<PacketEnvelopeByType['Discussion']> {
  const packet = await input.packetStore.fetchByPacket({
    packet_id: input.packetId,
  });

  if (!packet || packet.header.type !== 'Discussion') {
    throw new Error(`Unknown packet vote target: ${input.packetId}`);
  }

  return packet as PacketEnvelopeByType['Discussion'];
}

function relationEnrollmentConfig(
  mutationIntent: LiveGenericWorkflowMutationIntent
) {
  if (mutationIntent === 'relation.association.add') {
    return {
      packet_subtype: 'association' as const,
      workflow_plan_id: 'relation.association.add.workflow.v0',
      operation_kind: 'relation.set' as const,
      policy_action_ids: ['relation.association.add'] as MutationActionId[],
      dispatch_prepare_adapter: 'prepareAssociationRelation' as const,
      dispatch_finalize_adapter: 'finalizeAssociationRelationUpdate' as const,
    };
  }

  if (mutationIntent === 'relation.association.clear') {
    return {
      packet_subtype: 'association' as const,
      workflow_plan_id: 'relation.association.clear.workflow.v0',
      operation_kind: 'relation.clear' as const,
      policy_action_ids: ['relation.association.clear'] as MutationActionId[],
      dispatch_prepare_adapter: 'prepareAssociationRelation' as const,
      dispatch_finalize_adapter: 'finalizeAssociationRelationUpdate' as const,
    };
  }

  if (mutationIntent === 'relation.residence.add') {
    return {
      packet_subtype: 'residence' as const,
      workflow_plan_id: 'relation.residence.add.workflow.v0',
      operation_kind: 'relation.set' as const,
      policy_action_ids: [
        'relation.residence.add',
        'relation.residence.clear',
      ] as MutationActionId[],
      dispatch_prepare_adapter: 'prepareHomeLocalityRelation' as const,
      dispatch_finalize_adapter: 'finalizeHomeLocalityRelation' as const,
    };
  }

  if (mutationIntent === 'relation.follow.add') {
    return {
      packet_subtype: 'follow' as const,
      workflow_plan_id: 'relation.follow.add.workflow.v0',
      operation_kind: 'relation.set' as const,
      policy_action_ids: ['relation.follow.add'] as MutationActionId[],
      dispatch_prepare_adapter: 'prepareFollowRelation' as const,
      dispatch_finalize_adapter: 'finalizeFollowRelationUpdate' as const,
    };
  }

  if (mutationIntent === 'relation.follow.clear') {
    return {
      packet_subtype: 'follow' as const,
      workflow_plan_id: 'relation.follow.clear.workflow.v0',
      operation_kind: 'relation.clear' as const,
      policy_action_ids: ['relation.follow.clear'] as MutationActionId[],
      dispatch_prepare_adapter: 'prepareFollowRelation' as const,
      dispatch_finalize_adapter: 'finalizeFollowRelationUpdate' as const,
    };
  }

  if (mutationIntent === 'relation.participation.add') {
    return {
      packet_subtype: 'participation' as const,
      workflow_plan_id: 'relation.participation.add.workflow.v0',
      operation_kind: 'relation.set' as const,
      policy_action_ids: ['relation.participation.add'] as MutationActionId[],
      dispatch_prepare_adapter: 'prepareRoleParticipationRelation' as const,
      dispatch_finalize_adapter: 'finalizeRoleParticipationRelationUpdate' as const,
    };
  }

  if (mutationIntent === 'relation.participation.clear') {
    return {
      packet_subtype: 'participation' as const,
      workflow_plan_id: 'relation.participation.clear.workflow.v0',
      operation_kind: 'relation.clear' as const,
      policy_action_ids: ['relation.participation.clear'] as MutationActionId[],
      dispatch_prepare_adapter: 'prepareRoleParticipationRelation' as const,
      dispatch_finalize_adapter: 'finalizeRoleParticipationRelationUpdate' as const,
    };
  }

  return null;
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
      `Live generic workflow enrollment is not definition-aligned: ${mutationIntent}`
    );
  }

  const relationConfig = relationEnrollmentConfig(mutationIntent);

  if (relationConfig) {
    return {
      enrollment_id: `live.generic.workflow.${mutationIntent}`,
      mutation_intent: mutationIntent,
      packet_type: 'Relation',
      packet_subtype: relationConfig.packet_subtype,
      workflow_plan_id: relationConfig.workflow_plan_id,
      operation_kind: relationConfig.operation_kind,
      policy_action_ids: relationConfig.policy_action_ids,
      dependency_ids: [...alignment.dependency_ids],
      trusted_capability_ids: [...alignment.trusted_capability_ids],
      dispatch_prepare_adapter: relationConfig.dispatch_prepare_adapter,
      dispatch_finalize_adapter: relationConfig.dispatch_finalize_adapter,
      live_mode: 'trusted_generic_workflow',
      notes:
        'Trusted generic relation workflow: local Relation planner executes definition-declared relation operation metadata inside the existing Dispatch prepare/finalize corridor.',
    };
  }

  return {
    enrollment_id: `live.generic.workflow.${mutationIntent}`,
    mutation_intent: mutationIntent,
    packet_type: 'Reaction',
    packet_subtype: 'reaction',
    workflow_plan_id: 'reaction.vote.set.workflow.v0',
    operation_kind: 'reaction.set',
    policy_action_ids: [
      'reaction.vote.set',
      'reaction.vote.clear',
    ],
    dependency_ids: [...alignment.dependency_ids],
    trusted_capability_ids: [...alignment.trusted_capability_ids],
    dispatch_prepare_adapter: 'preparePacketVoteReaction',
    dispatch_finalize_adapter: 'finalizePacketVoteReaction',
    live_mode: 'trusted_generic_workflow',
    notes:
      'Trusted generic reaction workflow: local Reaction planner executes definition-declared packet vote metadata inside the existing Dispatch corridor.',
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
        message: `${enrollment.mutation_intent} is live generic-enrolled before its definition workflow dry-run is ready.`,
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
  const enrollment = requireLiveGenericEnrollment(input.intent.kind);

  if (input.intent.kind === 'relation.association.add') {
    const targetPacket = await requireElementPacket({
      packetStore: input.packetStore,
      packetId: input.intent.target_packet_id,
    });
    const relationPlan = await planAssociationRelationPackets({
      packetStore: input.packetStore,
      actorPacket: input.actorPacket,
      targetScopePacket: targetPacket,
      mode: 'set',
      note: input.intent.note ?? null,
    });

    return {
      plan_kind: 'trusted_relation_operation_plan',
      mutation_intent: input.intent.kind,
      operation_kind: 'relation.set',
      workflow_plan_id: enrollment.workflow_plan_id,
      packet_type: 'Relation',
      packet_subtype: 'association',
      policy_action_ids: ['relation.association.add'],
      dependency_ids: [...enrollment.dependency_ids],
      trusted_capability_ids: [...enrollment.trusted_capability_ids],
      target_scope_packet: targetPacket,
      governing_scope_packet: targetPacket,
      relation_plan: relationPlan,
    };
  }

  if (input.intent.kind === 'relation.association.clear') {
    const targetPacket = await requireElementPacket({
      packetStore: input.packetStore,
      packetId: input.intent.target_packet_id,
    });
    const relationPlan = await planAssociationRelationPackets({
      packetStore: input.packetStore,
      actorPacket: input.actorPacket,
      targetScopePacket: targetPacket,
      mode: 'clear',
    });

    return {
      plan_kind: 'trusted_relation_operation_plan',
      mutation_intent: input.intent.kind,
      operation_kind: 'relation.clear',
      workflow_plan_id: enrollment.workflow_plan_id,
      packet_type: 'Relation',
      packet_subtype: 'association',
      policy_action_ids: ['relation.association.clear'],
      dependency_ids: [...enrollment.dependency_ids],
      trusted_capability_ids: [...enrollment.trusted_capability_ids],
      target_scope_packet: targetPacket,
      governing_scope_packet: targetPacket,
      relation_plan: relationPlan,
    };
  }

  if (input.intent.kind === 'relation.residence.add') {
    const residenceScopePacket = input.intent.residence_scope_packet_id
      ? await requireElementPacket({
          packetStore: input.packetStore,
          packetId: input.intent.residence_scope_packet_id,
        })
      : null;
    const relationPlan = await planResidenceRelationPackets({
      packetStore: input.packetStore,
      actorPacket: input.actorPacket,
      residenceScopePacket,
      forceSelectedRevision: true,
    });

    return {
      plan_kind: 'trusted_relation_operation_plan',
      mutation_intent: input.intent.kind,
      operation_kind: residenceScopePacket ? 'relation.set' : 'relation.clear',
      workflow_plan_id: enrollment.workflow_plan_id,
      packet_type: 'Relation',
      packet_subtype: 'residence',
      policy_action_ids: [
        residenceScopePacket
          ? 'relation.residence.add'
          : 'relation.residence.clear',
      ],
      dependency_ids: [...enrollment.dependency_ids],
      trusted_capability_ids: [...enrollment.trusted_capability_ids],
      target_scope_packet: residenceScopePacket,
      governing_scope_packet: relationPlan.governingScopePacket,
      relation_plan: relationPlan,
    };
  }

  if (
    input.intent.kind !== 'relation.follow.add' &&
    input.intent.kind !== 'relation.follow.clear'
  ) {
    throw new Error(
      `Unsupported relation workflow mutation intent: ${input.intent.kind}`
    );
  }

  if (!isClaimedActorPacket(input.actorPacket)) {
    throw new Error('Follow relations require a claimed identity.');
  }

  const targetScopePacket = await requireElementPacket({
    packetStore: input.packetStore,
    packetId: input.intent.target_scope_packet_id,
  });
  const isSetIntent = input.intent.kind === 'relation.follow.add';
  const relationPlan = await planFollowRelationPackets({
    packetStore: input.packetStore,
    actorPacket: input.actorPacket,
    targetScopePacket,
    mode: isSetIntent ? 'set' : 'clear',
  });

  return {
    plan_kind: 'trusted_relation_operation_plan',
    mutation_intent: input.intent.kind,
    operation_kind: isSetIntent ? 'relation.set' : 'relation.clear',
    workflow_plan_id: enrollment.workflow_plan_id,
    packet_type: 'Relation',
    packet_subtype: 'follow',
    policy_action_ids: [
      isSetIntent ? 'relation.follow.add' : 'relation.follow.clear',
    ],
    dependency_ids: [...enrollment.dependency_ids],
    trusted_capability_ids: [...enrollment.trusted_capability_ids],
    target_scope_packet: targetScopePacket,
    governing_scope_packet: targetScopePacket,
    relation_plan: relationPlan,
  };
}

export async function resolveTrustedRoleParticipationRelationOperationPlan(
  input: TrustedPacketWorkflowMutationInput
): Promise<TrustedRelationOperationPlan> {
  if (
    input.intent.kind !== 'relation.participation.add' &&
    input.intent.kind !== 'relation.participation.clear'
  ) {
    throw new Error(
      `Unsupported role participation workflow mutation intent: ${input.intent.kind}`
    );
  }

  const enrollment = requireLiveGenericEnrollment(input.intent.kind);
  const rolePacket = await requireRolePacket({
    packetStore: input.packetStore,
    packetId: input.intent.role_packet_id,
  });
  const scopePacket = await requireElementPacket({
    packetStore: input.packetStore,
    packetId: input.intent.scope_id,
  });
  const isSetIntent = input.intent.kind === 'relation.participation.add';
  const relationPlan = await planRoleParticipationRelationPackets({
    packetStore: input.packetStore,
    actorPacket: input.actorPacket,
    rolePacket,
    scopePacket,
    mode: isSetIntent ? 'set' : 'clear',
    note: input.intent.note ?? null,
  });

  return {
    plan_kind: 'trusted_relation_operation_plan',
    mutation_intent: input.intent.kind,
    operation_kind: isSetIntent ? 'relation.set' : 'relation.clear',
    workflow_plan_id: enrollment.workflow_plan_id,
    packet_type: 'Relation',
    packet_subtype: 'participation',
    policy_action_ids: [
      isSetIntent ? 'relation.participation.add' : 'relation.participation.clear',
    ],
    dependency_ids: [...enrollment.dependency_ids],
    trusted_capability_ids: [...enrollment.trusted_capability_ids],
    target_scope_packet: scopePacket,
    governing_scope_packet: scopePacket,
    relation_plan: relationPlan,
  };
}

export async function resolveTrustedReactionOperationPlan(
  input: TrustedPacketWorkflowMutationInput
): Promise<TrustedReactionOperationPlan> {
  if (input.intent.kind !== 'reaction.vote.set') {
    throw new Error(
      `Unsupported reaction workflow mutation intent: ${input.intent.kind}`
    );
  }

  if (!input.reactionService || !input.actorKey) {
    throw new Error('Packet vote planning requires a reaction service and actor key.');
  }

  const enrollment = requireLiveGenericEnrollment(input.intent.kind);
  const targetPacket = await requireDiscussionTargetPacket({
    packetStore: input.packetStore,
    packetId: input.intent.target_packet_id,
  });
  const summary = await input.reactionService.getTargetSummary({
    target_packet_id: input.intent.target_packet_id,
    viewer_actor_key: input.actorKey,
  });
  const reactionPacket = buildPacketVoteReactionPacket({
    scopeId: input.intent.scope_id,
    actorPacket: input.actorPacket,
    targetPost: {
      packet: { packet_id: targetPacket.header.packet_id },
      authority_scope_packet_id:
        targetPacket.header.authority_scope_ref?.packet_id ?? null,
      applicable_scope_packet_ids: targetPacket.header.applicable_scope_refs.map(
        (scopeRef) => scopeRef.packet_id
      ),
      vote_summary: summary,
    },
    value: input.intent.value,
    createdAt: input.intent.created_at ?? new Date().toISOString(),
  });

  if (!reactionPacket) {
    throw new Error('The packet vote is already cleared.');
  }

  const governingScopePacket = targetPacket.header.authority_scope_ref
    ? await requireElementPacket({
        packetStore: input.packetStore,
        packetId: targetPacket.header.authority_scope_ref.packet_id,
      })
    : null;
  const actionId: MutationActionId =
    input.intent.value === null
      ? 'reaction.vote.clear'
      : 'reaction.vote.set';

  return {
    plan_kind: 'trusted_reaction_operation_plan',
    mutation_intent: input.intent.kind,
    operation_kind:
      input.intent.value === null ? 'reaction.clear' : 'reaction.set',
    workflow_plan_id: enrollment.workflow_plan_id,
    packet_type: 'Reaction',
    packet_subtype: 'reaction',
    policy_action_ids: [actionId],
    dependency_ids: [...enrollment.dependency_ids],
    trusted_capability_ids: [...enrollment.trusted_capability_ids],
    target_packet: targetPacket,
    governing_scope_packet: governingScopePacket,
    reaction_packet: reactionPacket,
  };
}

export async function runTrustedPacketWorkflowMutation(
  input: TrustedPacketWorkflowMutationInput
): Promise<PreparedMutation> {
  if (
    input.intent.kind === 'relation.association.add' ||
    input.intent.kind === 'relation.association.clear' ||
    input.intent.kind === 'relation.residence.add' ||
    input.intent.kind === 'relation.follow.add' ||
    input.intent.kind === 'relation.follow.clear' ||
    input.intent.kind === 'relation.participation.add' ||
    input.intent.kind === 'relation.participation.clear'
  ) {
    const operationPlan =
      input.intent.kind === 'relation.participation.add' ||
      input.intent.kind === 'relation.participation.clear'
        ? await resolveTrustedRoleParticipationRelationOperationPlan(input)
        : await resolveTrustedRelationOperationPlan(input);
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
        operationPlan.governing_scope_packet?.header.packet_id ??
        input.actorPacket.header.packet_id,
      prepared_packets: preparedPackets,
    };
  }


  const operationPlan = await resolveTrustedReactionOperationPlan(input);
  const policyDecision = await input.policyGate.resolveScopePolicyDecision({
    governingScopePacket: operationPlan.governing_scope_packet,
    actorPacket: input.actorPacket,
    actionIds: operationPlan.policy_action_ids,
  });
  const digests = await getPacketUnsignedDigestCandidates(
    operationPlan.reaction_packet
  );

  return {
    kind: input.intent.kind,
    ...policyDecision,
    governing_scope_packet_id:
      operationPlan.reaction_packet.header.authority_scope_ref?.packet_id ??
      operationPlan.governing_scope_packet?.header.packet_id ??
      null,
    prepared_packets: [
      {
        packet: operationPlan.reaction_packet,
        unsigned_digest: digests[0]?.digest ?? '',
      },
    ],
  };
}
