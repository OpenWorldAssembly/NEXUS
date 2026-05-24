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
import type { AttestationService } from '@core/contracts';
import {
  createAssociationClaimPacket,
  createClaimPacketId,
} from '@core/packets/claims';
import { buildPacketSignalAttestationPacket } from '@core/packets/discussion';
import type {
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import {
  planAssociationRelationPackets,
  planFollowRelationPackets,
  planResidenceRelationPackets,
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
  | 'role_association.claim.set'
  | 'attestation.packet_signal.set'
>;

export type LiveGenericWorkflowEnrollment = {
  enrollment_id: string;
  mutation_intent: LiveGenericWorkflowMutationIntent;
  packet_type: 'Relation' | 'Claim' | 'Attestation';
  packet_subtype: string;
  workflow_plan_id: string;
  operation_kind:
    | 'relation.set'
    | 'relation.clear'
    | 'claim.assert'
    | 'claim.withdraw'
    | 'attestation.set'
    | 'attestation.clear';
  policy_action_ids: MutationActionId[];
  dependency_ids: string[];
  trusted_capability_ids: string[];
  fortress_prepare_handler:
    | 'prepareAssociationRelation'
    | 'prepareHomeLocalityRelation'
    | 'prepareFollowRelation'
    | 'prepareRoleAssociationClaim'
    | 'preparePacketSignal';
  fortress_finalize_handler:
    | 'finalizeAssociationRelationUpdate'
    | 'finalizeHomeLocalityRelation'
    | 'finalizeFollowRelationUpdate'
    | 'finalizeClaimUpdate'
    | 'finalizePacketSignal';
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
  >;
  operation_kind: 'relation.set' | 'relation.clear';
  workflow_plan_id: string;
  packet_type: 'Relation';
  packet_subtype: 'association' | 'residence' | 'follow';
  policy_action_ids: MutationActionId[];
  dependency_ids: string[];
  trusted_capability_ids: string[];
  target_scope_packet: PacketEnvelopeByType['Element'] | null;
  governing_scope_packet: PacketEnvelopeByType['Element'] | null;
  relation_plan: ScopeRelationPacketPlan;
};

export type TrustedClaimOperationPlan = {
  plan_kind: 'trusted_claim_operation_plan';
  mutation_intent: 'role_association.claim.set';
  operation_kind: 'claim.assert' | 'claim.withdraw';
  workflow_plan_id: string;
  packet_type: 'Claim';
  packet_subtype: 'relation_assertion';
  policy_action_ids: MutationActionId[];
  dependency_ids: string[];
  trusted_capability_ids: string[];
  role_packet: PacketEnvelopeByType['Role'];
  governing_scope_packet: PacketEnvelopeByType['Element'] | null;
  scope_packet_id: string;
  claim_packet: PacketEnvelopeByType['Claim'];
};

export type TrustedAttestationOperationPlan = {
  plan_kind: 'trusted_attestation_operation_plan';
  mutation_intent: 'attestation.packet_signal.set';
  operation_kind: 'attestation.set' | 'attestation.clear';
  workflow_plan_id: string;
  packet_type: 'Attestation';
  packet_subtype: 'packet_signal';
  policy_action_ids: MutationActionId[];
  dependency_ids: string[];
  trusted_capability_ids: string[];
  target_packet:
    | PacketEnvelopeByType['Discussion']
    | PacketEnvelopeByType['Discussion']
    | PacketEnvelopeByType['Discussion'];
  governing_scope_packet: PacketEnvelopeByType['Element'] | null;
  attestation_packet: PacketEnvelopeByType['Attestation'];
};

export type TrustedPacketWorkflowMutationInput = {
  packetStore: NodeSQLitePacketStore;
  policyGate: MutationPolicyGate;
  attestationService?: AttestationService;
  actorKey?: string;
  actorPacket: PacketEnvelopeByType['Element'];
  intent:
    | Extract<MutationIntent, { kind: 'relation.association.add' }>
    | Extract<MutationIntent, { kind: 'relation.association.clear' }>
    | Extract<MutationIntent, { kind: 'relation.residence.add' }>
    | Extract<MutationIntent, { kind: 'relation.follow.add' }>
    | Extract<MutationIntent, { kind: 'relation.follow.clear' }>
    | Extract<MutationIntent, { kind: 'role_association.claim.set' }>
    | Extract<MutationIntent, { kind: 'attestation.packet_signal.set' }>;
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
  'role_association.claim.set',
  'attestation.packet_signal.set',
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
      fortress_prepare_handler: 'prepareAssociationRelation' as const,
      fortress_finalize_handler: 'finalizeAssociationRelationUpdate' as const,
    };
  }

  if (mutationIntent === 'relation.association.clear') {
    return {
      packet_subtype: 'association' as const,
      workflow_plan_id: 'relation.association.clear.workflow.v0',
      operation_kind: 'relation.clear' as const,
      policy_action_ids: ['relation.association.clear'] as MutationActionId[],
      fortress_prepare_handler: 'prepareAssociationRelation' as const,
      fortress_finalize_handler: 'finalizeAssociationRelationUpdate' as const,
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
      fortress_prepare_handler: 'prepareHomeLocalityRelation' as const,
      fortress_finalize_handler: 'finalizeHomeLocalityRelation' as const,
    };
  }

  if (mutationIntent === 'relation.follow.add') {
    return {
      packet_subtype: 'follow' as const,
      workflow_plan_id: 'relation.follow.add.workflow.v0',
      operation_kind: 'relation.set' as const,
      policy_action_ids: ['relation.follow.add'] as MutationActionId[],
      fortress_prepare_handler: 'prepareFollowRelation' as const,
      fortress_finalize_handler: 'finalizeFollowRelationUpdate' as const,
    };
  }

  if (mutationIntent === 'relation.follow.clear') {
    return {
      packet_subtype: 'follow' as const,
      workflow_plan_id: 'relation.follow.clear.workflow.v0',
      operation_kind: 'relation.clear' as const,
      policy_action_ids: ['relation.follow.clear'] as MutationActionId[],
      fortress_prepare_handler: 'prepareFollowRelation' as const,
      fortress_finalize_handler: 'finalizeFollowRelationUpdate' as const,
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
      fortress_prepare_handler: relationConfig.fortress_prepare_handler,
      fortress_finalize_handler: relationConfig.fortress_finalize_handler,
      live_mode: 'trusted_generic_workflow',
      notes:
        'Trusted generic relation workflow: local Relation planner executes definition-declared relation operation metadata inside the existing fortress prepare/finalize corridor.',
    };
  }

  if (mutationIntent === 'role_association.claim.set') {
    return {
      enrollment_id: `live.generic.workflow.${mutationIntent}`,
      mutation_intent: mutationIntent,
      packet_type: 'Claim',
      packet_subtype: 'relation_assertion',
      workflow_plan_id: 'claim.role_association.set.workflow.v0',
      operation_kind: 'claim.assert',
      policy_action_ids: [
        'role_association.claim.set',
        'role_association.claim.withdraw',
      ],
      dependency_ids: [...alignment.dependency_ids],
      trusted_capability_ids: [...alignment.trusted_capability_ids],
      fortress_prepare_handler: 'prepareRoleAssociationClaim',
      fortress_finalize_handler: 'finalizeClaimUpdate',
      live_mode: 'trusted_generic_workflow',
      notes:
        'Trusted generic claim workflow: local Claim planner executes definition-declared role association claim metadata inside the existing fortress corridor.',
    };
  }

  return {
    enrollment_id: `live.generic.workflow.${mutationIntent}`,
    mutation_intent: mutationIntent,
    packet_type: 'Attestation',
    packet_subtype: 'packet_signal',
    workflow_plan_id: 'attestation.packet_signal.set.workflow.v0',
    operation_kind: 'attestation.set',
    policy_action_ids: [
      'attestation.packet_signal.set',
      'attestation.packet_signal.clear',
    ],
    dependency_ids: [...alignment.dependency_ids],
    trusted_capability_ids: [...alignment.trusted_capability_ids],
    fortress_prepare_handler: 'preparePacketSignal',
    fortress_finalize_handler: 'finalizePacketSignal',
    live_mode: 'trusted_generic_workflow',
    notes:
      'Trusted generic attestation workflow: local Attestation planner executes definition-declared packet signal metadata inside the existing fortress corridor.',
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

export async function resolveTrustedClaimOperationPlan(
  input: TrustedPacketWorkflowMutationInput
): Promise<TrustedClaimOperationPlan> {
  if (input.intent.kind !== 'role_association.claim.set') {
    throw new Error(
      `Unsupported claim workflow mutation intent: ${input.intent.kind}`
    );
  }

  const enrollment = requireLiveGenericEnrollment(input.intent.kind);
  const rolePacket = await requireRolePacket({
    packetStore: input.packetStore,
    packetId: input.intent.role_packet_id,
  });
  const governingScopePacket = rolePacket.header.authority_scope_ref
    ? await requireElementPacket({
        packetStore: input.packetStore,
        packetId: rolePacket.header.authority_scope_ref.packet_id,
      })
    : null;
  const scopePacketId =
    governingScopePacket?.header.packet_id ??
    rolePacket.header.authority_scope_ref?.packet_id ??
    input.actorPacket.header.packet_id;
  const claimPacketId = createClaimPacketId({
    claimKind: 'role_association',
    subjectPacketId: input.actorPacket.header.packet_id,
    targetPacketId: rolePacket.header.packet_id,
    scopePacketId,
  });
  const existingPreferredRevision = await input.packetStore.fetchPreferredRevision({
    packet_id: claimPacketId,
  });
  const claimPacket = createAssociationClaimPacket({
    claimKind: 'role_association',
    subjectPacketId: input.actorPacket.header.packet_id,
    targetPacketId: rolePacket.header.packet_id,
    scopePacketId,
    applicableScopeRefs:
      governingScopePacket?.header.applicable_scope_refs.length
        ? governingScopePacket.header.applicable_scope_refs
        : rolePacket.header.applicable_scope_refs.length > 0
          ? rolePacket.header.applicable_scope_refs
          : [{ packet_id: scopePacketId }],
    createdByPacketId: input.actorPacket.header.packet_id,
    status: input.intent.claimed ? 'active' : 'withdrawn',
    packetId: claimPacketId,
    parentRevisionRefs: existingPreferredRevision ? [existingPreferredRevision] : [],
  });

  return {
    plan_kind: 'trusted_claim_operation_plan',
    mutation_intent: input.intent.kind,
    operation_kind: input.intent.claimed ? 'claim.assert' : 'claim.withdraw',
    workflow_plan_id: enrollment.workflow_plan_id,
    packet_type: 'Claim',
    packet_subtype: 'relation_assertion',
    policy_action_ids: [
      input.intent.claimed
        ? 'role_association.claim.set'
        : 'role_association.claim.withdraw',
    ],
    dependency_ids: [...enrollment.dependency_ids],
    trusted_capability_ids: [...enrollment.trusted_capability_ids],
    role_packet: rolePacket,
    governing_scope_packet: governingScopePacket,
    scope_packet_id: scopePacketId,
    claim_packet: claimPacket,
  };
}

export async function resolveTrustedAttestationOperationPlan(
  input: TrustedPacketWorkflowMutationInput
): Promise<TrustedAttestationOperationPlan> {
  if (input.intent.kind !== 'attestation.packet_signal.set') {
    throw new Error(
      `Unsupported attestation workflow mutation intent: ${input.intent.kind}`
    );
  }

  if (!input.attestationService || !input.actorKey) {
    throw new Error('Packet signal planning requires an attestation service and actor key.');
  }

  const enrollment = requireLiveGenericEnrollment(input.intent.kind);
  const targetPacket = await requireDiscussionTargetPacket({
    packetStore: input.packetStore,
    packetId: input.intent.target_packet_id,
  });
  const summary = await input.attestationService.getTargetSummary({
    target_packet_id: input.intent.target_packet_id,
    viewer_actor_key: input.actorKey,
  });
  const attestationPacket = buildPacketSignalAttestationPacket({
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

  if (!attestationPacket) {
    throw new Error('The packet vote is already cleared.');
  }

  const governingScopePacket = targetPacket.header.authority_scope_ref
    ? await requireElementPacket({
        packetStore: input.packetStore,
        packetId: targetPacket.header.authority_scope_ref.packet_id,
      })
    : null;
  const actionId: MutationActionId =
    input.intent.value === 0
      ? 'attestation.packet_signal.clear'
      : 'attestation.packet_signal.set';

  return {
    plan_kind: 'trusted_attestation_operation_plan',
    mutation_intent: input.intent.kind,
    operation_kind:
      input.intent.value === 0 ? 'attestation.clear' : 'attestation.set',
    workflow_plan_id: enrollment.workflow_plan_id,
    packet_type: 'Attestation',
    packet_subtype: 'packet_signal',
    policy_action_ids: [actionId],
    dependency_ids: [...enrollment.dependency_ids],
    trusted_capability_ids: [...enrollment.trusted_capability_ids],
    target_packet: targetPacket,
    governing_scope_packet: governingScopePacket,
    attestation_packet: attestationPacket,
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
    input.intent.kind === 'relation.follow.clear'
  ) {
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
        operationPlan.governing_scope_packet?.header.packet_id ??
        input.actorPacket.header.packet_id,
      prepared_packets: preparedPackets,
    };
  }

  if (input.intent.kind === 'role_association.claim.set') {
    const operationPlan = await resolveTrustedClaimOperationPlan(input);
    const policyDecision = await input.policyGate.resolveScopePolicyDecision({
      governingScopePacket: operationPlan.governing_scope_packet,
      actorPacket: input.actorPacket,
      actionIds: operationPlan.policy_action_ids,
    });
    const digests = await getPacketUnsignedDigestCandidates(
      operationPlan.claim_packet
    );

    return {
      kind: input.intent.kind,
      ...policyDecision,
      governing_scope_packet_id: operationPlan.scope_packet_id,
      prepared_packets: [
        {
          packet: operationPlan.claim_packet,
          unsigned_digest: digests[0]?.digest ?? '',
        },
      ],
    };
  }

  const operationPlan = await resolveTrustedAttestationOperationPlan(input);
  const policyDecision = await input.policyGate.resolveScopePolicyDecision({
    governingScopePacket: operationPlan.governing_scope_packet,
    actorPacket: input.actorPacket,
    actionIds: operationPlan.policy_action_ids,
  });
  const digests = await getPacketUnsignedDigestCandidates(
    operationPlan.attestation_packet
  );

  return {
    kind: input.intent.kind,
    ...policyDecision,
    governing_scope_packet_id:
      operationPlan.attestation_packet.header.authority_scope_ref?.packet_id ??
      operationPlan.governing_scope_packet?.header.packet_id ??
      null,
    prepared_packets: [
      {
        packet: operationPlan.attestation_packet,
        unsigned_digest: digests[0]?.digest ?? '',
      },
    ],
  };
}
