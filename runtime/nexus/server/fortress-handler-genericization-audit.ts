/**
 * File: fortress-handler-genericization-audit.ts
 * Description: Audit registry for extracted fortress handlers and their genericization path.
 */

import type { MutationActionId } from '@core/auth/write-policy';
import type { MutationIntent } from '@core/auth/mutation-corridor';
import {
  getPacketOperationDefinition,
  type PacketOperationKind,
} from '@core/packets/packet-operation-ontology';
import type { PacketType } from '@core/schema/packet-schema';
import type {
  FortressHandlerDomain,
} from '@runtime/nexus/server/fortress-handler-contracts';
import type {
  MutationFinalizeHandlerKey,
  MutationPrepareHandlerKey,
} from '@runtime/nexus/server/mutation-intent-registry';
import { listMutationIntentDescriptors } from '@runtime/nexus/server/mutation-intent-registry';

export type FortressGenericizationStatus =
  | 'generic_ready'
  | 'planner_extraction_needed'
  | 'workflow_specific'
  | 'legacy_bridge';

export type FortressOperationMappingStatus =
  | 'directly_mapped'
  | 'planner_extraction_gap'
  | 'runtime_workflow_gap'
  | 'legacy_bridge_gap';

export type FortressHandlerGenericizationEntry = {
  mutation_intent: MutationIntent['kind'];
  domain: FortressHandlerDomain;
  prepare_handler: MutationPrepareHandlerKey;
  finalize_handler: MutationFinalizeHandlerKey;
  packet_types_touched: readonly PacketType[];
  policy_action_ids: readonly MutationActionId[];
  operation_kinds: readonly PacketOperationKind[];
  operation_mapping_status: FortressOperationMappingStatus;
  genericization_status: FortressGenericizationStatus;
  next_step: string;
  canonical_intent?: MutationIntent['kind'];
  notes: string;
};

export const FORTRESS_HANDLER_GENERICIZATION_ENTRIES = [
  {
    mutation_intent: 'locality.path.create',
    domain: 'locality',
    prepare_handler: 'prepareLocalityPathCreate',
    finalize_handler: 'finalizeLocalityPathCreate',
    packet_types_touched: ['Element', 'Location', 'Relation'],
    policy_action_ids: ['locality.element.create'],
    operation_kinds: ['workflow.compose'],
    operation_mapping_status: 'planner_extraction_gap',
    genericization_status: 'planner_extraction_needed',
    next_step:
      'Promote locality path planning into a reusable manifest-aware planner before routing through generic prepare.',
    notes:
      'Creates a coordinated path of locality elements and related records with duplicate handling.',
  },
  {
    mutation_intent: 'locality.graph.apply',
    domain: 'locality',
    prepare_handler: 'prepareLocalityGraphApply',
    finalize_handler: 'finalizeLocalityGraphApply',
    packet_types_touched: ['Element', 'Location', 'Relation', 'Claim'],
    policy_action_ids: [
      'locality.element.create',
      'relation.residence.add',
      'relation.residence.clear',
      'relation.association.add',
      'relation.association.clear',
      'relation.follow.add',
      'relation.follow.clear',
    ],
    operation_kinds: ['workflow.compose'],
    operation_mapping_status: 'runtime_workflow_gap',
    genericization_status: 'workflow_specific',
    next_step:
      'Split structural packet planning from shell preference side effects, then enroll each packet operation behind generic planners.',
    notes:
      'Composite workflow spans locality creation, relation writes, compatibility preferences, and shell refresh projection.',
  },
  {
    mutation_intent: 'discussion.thread_post.create',
    domain: 'discussion',
    prepare_handler: 'prepareDiscussionThreadPost',
    finalize_handler: 'finalizeDiscussionThreadPost',
    packet_types_touched: ['Discussion', 'Discussion', 'Discussion'],
    policy_action_ids: ['discussion.thread.create', 'discussion.post.create'],
    operation_kinds: ['workflow.compose'],
    operation_mapping_status: 'planner_extraction_gap',
    genericization_status: 'planner_extraction_needed',
    next_step:
      'Extract discussion mirror/compatibility planning before replacing thread/post preparation with generic Discussion planners.',
    notes:
      'Still bridges legacy split discussion types and canonical Discussion packets.',
  },
  {
    mutation_intent: 'discussion.reply.create',
    domain: 'discussion',
    prepare_handler: 'prepareDiscussionReply',
    finalize_handler: 'finalizeDiscussionReply',
    packet_types_touched: ['Discussion', 'Discussion', 'Discussion'],
    policy_action_ids: ['discussion.reply.create'],
    operation_kinds: ['single_packet.create'],
    operation_mapping_status: 'planner_extraction_gap',
    genericization_status: 'planner_extraction_needed',
    next_step:
      'Extract parent/thread/forum resolution into a reusable discussion reply planner.',
    notes:
      'Reply creation is mostly generic packet preparation after discussion target compatibility is isolated.',
  },
  {
    mutation_intent: 'discussion.surfaces.ensure',
    domain: 'discussion',
    prepare_handler: 'prepareDiscussionSurfacesEnsure',
    finalize_handler: 'finalizeDiscussionSurfacesEnsure',
    packet_types_touched: ['Discussion'],
    policy_action_ids: ['discussion.surfaces.ensure'],
    operation_kinds: ['workflow.compose'],
    operation_mapping_status: 'runtime_workflow_gap',
    genericization_status: 'workflow_specific',
    next_step:
      'Decide whether default surfaces remain seed/bootstrap workflow or become manifest-declared scope fixtures.',
    notes:
      'Ensures multiple default discussion surfaces for a scope and refreshes discussion projections.',
  },
  {
    mutation_intent: 'reaction.vote.set',
    domain: 'reaction',
    prepare_handler: 'preparePacketVoteReaction',
    finalize_handler: 'finalizePacketVoteReaction',
    packet_types_touched: ['Reaction', 'Discussion'],
    policy_action_ids: [
      'reaction.vote.set',
      'reaction.vote.clear',
    ],
    operation_kinds: ['reaction.set', 'reaction.clear'],
    operation_mapping_status: 'directly_mapped',
    genericization_status: 'generic_ready',
    next_step:
      'Enroll packet-signal reaction as a manifest-backed Reaction planner once target summary lookup is isolated.',
    notes:
      'Single Reaction write with a small target-summary read dependency.',
  },
  {
    mutation_intent: 'assembly.element.create',
    domain: 'assembly',
    prepare_handler: 'prepareAssemblyElementCreate',
    finalize_handler: 'finalizeAssemblyElementCreate',
    packet_types_touched: ['Element', 'Relation', 'Discussion'],
    policy_action_ids: ['assembly.element.create', 'discussion.surfaces.ensure'],
    operation_kinds: ['workflow.compose'],
    operation_mapping_status: 'runtime_workflow_gap',
    genericization_status: 'workflow_specific',
    next_step:
      'Separate assembly element creation from optional default discussions and optional association relation workflow.',
    notes:
      'Creates an assembly scope and may also seed discussion surfaces and association packets.',
  },
  {
    mutation_intent: 'relation.association.add',
    domain: 'relation',
    prepare_handler: 'prepareAssociationRelation',
    finalize_handler: 'finalizeAssociationRelationUpdate',
    packet_types_touched: ['Relation'],
    policy_action_ids: ['relation.association.add'],
    operation_kinds: ['relation.set'],
    operation_mapping_status: 'planner_extraction_gap',
    genericization_status: 'planner_extraction_needed',
    next_step:
      'Promote scoped relation planner outputs into generic Relation write plans while preserving explicit legacy Claim cleanup.',
    notes:
      'Relation-first association write now emits only Relation packets for fresh set flows and keeps legacy Claim withdrawal cleanup explicit.',
  },
  {
    mutation_intent: 'relation.association.clear',
    domain: 'relation',
    prepare_handler: 'prepareAssociationRelation',
    finalize_handler: 'finalizeAssociationRelationUpdate',
    packet_types_touched: ['Relation', 'Claim'],
    policy_action_ids: ['relation.association.clear'],
    operation_kinds: ['relation.clear'],
    operation_mapping_status: 'planner_extraction_gap',
    genericization_status: 'planner_extraction_needed',
    next_step:
      'Use the same scoped relation planner as set mode with generic withdrawn revisions.',
    notes:
      'Clear mode is canonical relation-first behavior with withdrawal projection.',
  },
  {
    mutation_intent: 'relation.residence.add',
    domain: 'relation',
    prepare_handler: 'prepareHomeLocalityRelation',
    finalize_handler: 'finalizeHomeLocalityRelation',
    packet_types_touched: ['Relation', 'Claim'],
    policy_action_ids: ['relation.residence.add', 'relation.residence.clear'],
    operation_kinds: ['relation.set', 'relation.clear'],
    operation_mapping_status: 'planner_extraction_gap',
    genericization_status: 'planner_extraction_needed',
    next_step:
      'Promote home-locality relation planning into the generic Relation planner while keeping legacy Claim cleanup explicit.',
    notes:
      'Canonical relation-first home locality write with legacy relation/claim cleanup during replacement or clear flows.',
  },
  {
    mutation_intent: 'relation.follow.add',
    domain: 'relation',
    prepare_handler: 'prepareFollowRelation',
    finalize_handler: 'finalizeFollowRelationUpdate',
    packet_types_touched: ['Relation'],
    policy_action_ids: ['relation.follow.add'],
    operation_kinds: ['relation.set'],
    operation_mapping_status: 'directly_mapped',
    genericization_status: 'generic_ready',
    next_step:
      'Enroll follow set as a generic Relation revision after planner output is manifest-described.',
    notes: 'Single relation planner output with claimed-actor guard.',
  },
  {
    mutation_intent: 'relation.follow.clear',
    domain: 'relation',
    prepare_handler: 'prepareFollowRelation',
    finalize_handler: 'finalizeFollowRelationUpdate',
    packet_types_touched: ['Relation'],
    policy_action_ids: ['relation.follow.clear'],
    operation_kinds: ['relation.clear'],
    operation_mapping_status: 'directly_mapped',
    genericization_status: 'generic_ready',
    next_step:
      'Enroll follow clear as a generic Relation withdrawn revision after planner output is manifest-described.',
    notes: 'Single relation planner output with claimed-actor guard.',
  },
  {
    mutation_intent: 'relation.participation.add',
    domain: 'role',
    prepare_handler: 'prepareRoleParticipationRelation',
    finalize_handler: 'finalizeRoleParticipationRelationUpdate',
    packet_types_touched: ['Role', 'Claim'],
    policy_action_ids: [
      'relation.participation.add',
      'relation.participation.clear',
    ],
    operation_kinds: ['claim.assert', 'claim.withdraw'],
    operation_mapping_status: 'directly_mapped',
    genericization_status: 'generic_ready',
    next_step:
      'Enroll role participation as a generic Relation revision after role scope resolution is isolated.',
    notes: 'Single Claim write with Role authority-scope lookup.',
  },
  {
    mutation_intent: 'reaction.attestation.set',
    domain: 'role',
    prepare_handler: 'prepareReactionAttestation',
    finalize_handler: 'finalizeReactionAttestation',
    packet_types_touched: ['Claim', 'Reaction'],
    policy_action_ids: [
      'reaction.attestation.set',
      'reaction.attestation.set',
      'reaction.attestation.clear',
    ],
    operation_kinds: ['reaction.set', 'reaction.clear', 'workflow.compose'],
    operation_mapping_status: 'runtime_workflow_gap',
    genericization_status: 'workflow_specific',
    next_step:
      'Extract support/dispute mutual-exclusion planning before generic Reaction enrollment.',
    notes:
      'Can emit multiple Reaction revisions to clear opposing state and compute projection counts.',
  },
  {
    mutation_intent: 'actor.write_policy.update',
    domain: 'actor_policy',
    prepare_handler: 'prepareActorWritePolicyUpdate',
    finalize_handler: 'finalizeActorWritePolicyUpdate',
    packet_types_touched: ['Policy', 'Element'],
    policy_action_ids: ['actor.write_policy.update'],
    operation_kinds: ['workflow.compose'],
    operation_mapping_status: 'runtime_workflow_gap',
    genericization_status: 'workflow_specific',
    next_step:
      'Keep actor-policy changes behind an explicit runtime workflow until policy self-modification rules are manifest-ready.',
    notes:
      'Updates the actor write policy and may publish a new actor Element policy-ref revision.',
  },
  {
    mutation_intent: 'preference.element.set',
    domain: 'preference',
    prepare_handler: 'preparePreferenceElementSet',
    finalize_handler: 'finalizePreferenceElementSet',
    packet_types_touched: ['Preference'],
    policy_action_ids: ['preference.element.write'],
    operation_kinds: ['single_packet.revise'],
    operation_mapping_status: 'directly_mapped',
    genericization_status: 'generic_ready',
    next_step:
      'Keep Preference.element on the trusted fortress workflow and use seeded Definition material for reseed verification.',
    notes:
      'Single private Preference.element revision with latest-active lookup and compatibility cache projection.',
  },
] as const satisfies readonly FortressHandlerGenericizationEntry[];

export type FortressHandlerGenericizationAuditFinding = {
  severity: 'error' | 'warning';
  code: string;
  mutation_intent: string;
  message: string;
};

export type FortressHandlerGenericizationAuditReport = {
  status: 'pass' | 'fail';
  checked_mutation_intents: string[];
  findings: FortressHandlerGenericizationAuditFinding[];
};

export function listFortressHandlerGenericizationEntries(): readonly FortressHandlerGenericizationEntry[] {
  return FORTRESS_HANDLER_GENERICIZATION_ENTRIES;
}

export function auditFortressHandlerGenericization(): FortressHandlerGenericizationAuditReport {
  const descriptors = listMutationIntentDescriptors();
  const entriesByIntent = new Map(
    FORTRESS_HANDLER_GENERICIZATION_ENTRIES.map((entry) => [
      entry.mutation_intent,
      entry,
    ])
  );
  const findings: FortressHandlerGenericizationAuditFinding[] = [];

  for (const descriptor of descriptors) {
    const entry = entriesByIntent.get(descriptor.kind);

    if (!entry) {
      findings.push({
        severity: 'error',
        code: 'missing_genericization_entry',
        mutation_intent: descriptor.kind,
        message: `Missing fortress genericization classification for ${descriptor.kind}.`,
      });
      continue;
    }

    if (entry.prepare_handler !== descriptor.prepare) {
      findings.push({
        severity: 'error',
        code: 'prepare_handler_mismatch',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} classification points at ${entry.prepare_handler}, but registry uses ${descriptor.prepare}.`,
      });
    }

    if (entry.finalize_handler !== descriptor.finalize) {
      findings.push({
        severity: 'error',
        code: 'finalize_handler_mismatch',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} classification points at ${entry.finalize_handler}, but registry uses ${descriptor.finalize}.`,
      });
    }

    if (entry.next_step.trim().length === 0) {
      findings.push({
        severity: 'error',
        code: 'missing_next_step',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} classification must name the next genericization step.`,
      });
    }

    if (entry.genericization_status === 'legacy_bridge' && !entry.canonical_intent) {
      findings.push({
        severity: 'error',
        code: 'legacy_bridge_missing_canonical_intent',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} is a legacy bridge and must name its canonical intent.`,
      });
    }

    if (entry.operation_kinds.length === 0) {
      findings.push({
        severity: 'error',
        code: 'missing_packet_operation_mapping',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} must map to at least one packet operation kind or workflow operation.`,
      });
    }

    for (const operationKind of entry.operation_kinds) {
      if (getPacketOperationDefinition(operationKind)) {
        continue;
      }

      findings.push({
        severity: 'error',
        code: 'unknown_packet_operation_mapping',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} references unknown packet operation ${operationKind}.`,
      });
    }

    if (
      entry.genericization_status === 'generic_ready' &&
      entry.operation_mapping_status !== 'directly_mapped'
    ) {
      findings.push({
        severity: 'error',
        code: 'generic_ready_not_directly_mapped',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} is generic-ready and must map directly to concrete packet operations.`,
      });
    }

    if (
      entry.genericization_status === 'planner_extraction_needed' &&
      entry.operation_mapping_status !== 'planner_extraction_gap'
    ) {
      findings.push({
        severity: 'error',
        code: 'planner_gap_mapping_mismatch',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} needs planner extraction and must keep an explicit planner extraction operation gap.`,
      });
    }

    if (
      entry.genericization_status === 'workflow_specific' &&
      entry.operation_mapping_status !== 'runtime_workflow_gap'
    ) {
      findings.push({
        severity: 'error',
        code: 'workflow_gap_mapping_mismatch',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} is runtime-owned workflow composition and must keep a workflow operation gap.`,
      });
    }

    if (
      entry.genericization_status === 'legacy_bridge' &&
      entry.operation_mapping_status !== 'legacy_bridge_gap'
    ) {
      findings.push({
        severity: 'error',
        code: 'legacy_bridge_mapping_mismatch',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} is a legacy bridge and must point at a canonical operation direction.`,
      });
    }

    if (entry.genericization_status === 'workflow_specific' && entry.notes.trim().length < 20) {
      findings.push({
        severity: 'error',
        code: 'workflow_specific_missing_reason',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} workflow-specific classification must document why orchestration remains runtime-owned.`,
      });
    }
  }

  return {
    status: findings.some((finding) => finding.severity === 'error')
      ? 'fail'
      : 'pass',
    checked_mutation_intents: descriptors.map((descriptor) => descriptor.kind),
    findings,
  };
}
