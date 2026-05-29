/**
 * File: build_packet_body_candidate.ts
 * Description: Materializes a generic packet body candidate from a resolved trusted operation plan.
 */

import {
  createReactionPacket,
} from '@core/packets/builders';
import {
  createDiscussionRevisionId,
  createReactionPacketId,
} from '@core/packets/discussion.ts';
import {
  createScopedRelationPacket,
} from '@core/packets/relations.ts';
import type { PacketEnvelope, PacketRef } from '@core/schema/packet-schema';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  buildingIssue,
  buildingTrace,
  candidateIdForPlan,
} from '../trusted_building_internal.ts';
import {
  TRUSTED_BUILDING_COORDINATOR_ID,
  type BuildTrustedPacketBodyCandidateInput,
  type TrustedGenericBodyCandidate,
  type TrustedPacketCandidateNode,
} from '../trusted_building_types.ts';

function packetIdFromRef(value: unknown): string | null {
  return value && typeof value === 'object' && typeof (value as { packet_id?: unknown }).packet_id === 'string'
    ? (value as { packet_id: string }).packet_id
    : null;
}

function packetRefFromValue(value: unknown): PacketRef | null {
  const packetId = packetIdFromRef(value);

  return packetId ? { packet_id: packetId } : null;
}

function packetRefsFromValue(value: unknown): PacketRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => packetRefFromValue(entry))
    .filter((entry): entry is PacketRef => Boolean(entry));
}

function trustedHeaderValuesFromBodyValues(
  bodyValues: Record<string, unknown>
): Record<string, unknown> {
  const headerValues = bodyValues.__trusted_header_values;

  return headerValues && typeof headerValues === 'object'
    ? (headerValues as Record<string, unknown>)
    : {};
}

function buildScopedRelationPacketEnvelope(input: {
  plan: BuildTrustedPacketBodyCandidateInput['plan'];
  actor_packet: BuildTrustedPacketBodyCandidateInput['actor_packet'];
  body_values: Record<string, unknown>;
  blockers: string[];
  issues: TrustedRuntimeCoordinatorIssue[];
}): PacketEnvelope | null {
  if (input.plan.packet_type !== 'Relation') {
    return null;
  }

  const relationSubtype = input.plan.packet_subtype;
  if (relationSubtype !== 'follow' && relationSubtype !== 'association') {
    return null;
  }

  const mutationIntent = input.body_values.kind ?? input.plan.workflow_plan_id;
  const expectedMutationIntent = `relation.${relationSubtype}.add`;
  const expectedWorkflowPlanId = `${expectedMutationIntent}.workflow.v0`;

  if (mutationIntent !== expectedMutationIntent && mutationIntent !== expectedWorkflowPlanId) {
    return null;
  }

  const targetPacketId =
    typeof input.body_values.target_packet_id === 'string'
      ? input.body_values.target_packet_id
      : typeof input.body_values.target_scope_packet_id === 'string'
        ? input.body_values.target_scope_packet_id
        : packetIdFromRef(input.body_values.target_ref);
  const scopePacketId = packetIdFromRef(input.body_values.scope_ref) ?? targetPacketId;

  if (!input.actor_packet?.header?.packet_id) {
    input.blockers.push(`${relationSubtype} relation materialization requires an actor packet.`);
    input.issues.push(buildingIssue({
      severity: 'error',
      code: 'building.actor_packet_missing',
      path: 'actor_packet',
      message: `Building cannot materialize a ${relationSubtype} relation packet without an actor packet.`,
    }));
    return null;
  }

  if (typeof targetPacketId !== 'string' || targetPacketId.length === 0) {
    input.blockers.push(`${relationSubtype} relation materialization requires a target packet id.`);
    input.issues.push(buildingIssue({
      severity: 'error',
      code: 'building.target_packet_missing',
      path: 'plan.body_input_plan.resolved_input_values.target_ref',
      message: `Building cannot materialize a ${relationSubtype} relation packet without a target packet id.`,
    }));
    return null;
  }

  return createScopedRelationPacket({
    subtype: relationSubtype,
    subjectPacketId: input.actor_packet.header.packet_id,
    targetPacketId,
    scopePacketId,
    applicableScopeRefs: scopePacketId ? [{ packet_id: scopePacketId }] : [],
    createdByPacketId: input.actor_packet.header.packet_id,
    createdAt:
      typeof input.body_values.created_at === 'string'
        ? input.body_values.created_at
        : undefined,
    note:
      typeof input.body_values.note === 'string'
        ? input.body_values.note
        : null,
    status: 'active',
  });
}

function buildReactionPacketEnvelope(input: {
  plan: BuildTrustedPacketBodyCandidateInput['plan'];
  actor_packet: BuildTrustedPacketBodyCandidateInput['actor_packet'];
  body_values: Record<string, unknown>;
  blockers: string[];
  issues: TrustedRuntimeCoordinatorIssue[];
}): PacketEnvelope | null {
  if (input.plan.packet_type !== 'Reaction' || input.plan.packet_subtype !== 'reaction') {
    return null;
  }

  const mutationIntent = input.body_values.kind ?? input.plan.workflow_plan_id;
  if (mutationIntent !== 'reaction.vote.set' && mutationIntent !== 'reaction.vote.set.workflow.v0') {
    return null;
  }

  if (!input.actor_packet?.header?.packet_id) {
    input.blockers.push('Reaction materialization requires an actor packet.');
    input.issues.push(buildingIssue({
      severity: 'error',
      code: 'building.actor_packet_missing',
      path: 'actor_packet',
      message: 'Building cannot materialize a reaction packet without an actor packet.',
    }));
    return null;
  }

  const targetPacketId = packetIdFromRef(input.body_values.target_ref)
    ?? (typeof input.body_values.target_packet_id === 'string' ? input.body_values.target_packet_id : null);

  if (!targetPacketId) {
    input.blockers.push('Reaction materialization requires a target packet id.');
    input.issues.push(buildingIssue({
      severity: 'error',
      code: 'building.target_packet_missing',
      path: 'plan.body_input_plan.resolved_input_values.target_ref',
      message: 'Building cannot materialize a reaction packet without a target packet id.',
    }));
    return null;
  }

  const status = input.body_values.status === 'cleared' ? 'cleared' : 'active';
  const voteValue = input.body_values.vote_value === 'up' || input.body_values.vote_value === 'down'
    ? input.body_values.vote_value
    : null;
  const contextRef = packetRefFromValue(input.body_values.context_ref);
  const headerValues = trustedHeaderValuesFromBodyValues(input.body_values);
  const authorityScopeRef = packetRefFromValue(headerValues.authority_scope_ref);
  const applicableScopeRefs = packetRefsFromValue(headerValues.applicable_scope_refs);
  const createdAt = typeof headerValues.created_at === 'string' && headerValues.created_at.length > 0
    ? headerValues.created_at
    : new Date().toISOString();
  const reactionPacketId = createReactionPacketId({
    targetPacketId,
    actorPacketId: input.actor_packet.header.packet_id,
    contextPacketId: contextRef?.packet_id ?? null,
  });

  return createReactionPacket({
    packet_id: reactionPacketId,
    revision_id: createDiscussionRevisionId(reactionPacketId, createdAt),
    created_at: createdAt,
    authority_scope_ref: authorityScopeRef,
    applicable_scope_refs: applicableScopeRefs.length > 0
      ? applicableScopeRefs
      : authorityScopeRef
        ? [authorityScopeRef]
        : [],
    adapter: 'trusted-dispatch',
    created_by: { packet_id: input.actor_packet.header.packet_id },
    metadata_tags: ['reaction', 'vote'],
    metadata_summary: status === 'cleared'
      ? `Cleared vote on ${targetPacketId}`
      : `${voteValue ?? 'neutral'} vote on ${targetPacketId}`,
    subtype: 'reaction',
    target_ref: { packet_id: targetPacketId },
    vote_value: voteValue,
    attestation_value: null,
    emoji_keys: [],
    status,
    context_ref: contextRef,
    supporting_refs: packetRefsFromValue(input.body_values.supporting_refs),
    note: typeof input.body_values.note === 'string' ? input.body_values.note : null,
    supersedes_ref: packetRefFromValue(input.body_values.supersedes_ref),
  });
}

export function buildTrustedPacketBodyCandidate(
  input: BuildTrustedPacketBodyCandidateInput
): TrustedRuntimeCoordinatorResult<TrustedPacketCandidateNode> {
  const plan = input.plan;
  const issues: TrustedRuntimeCoordinatorIssue[] = [...plan.issues];
  const blockers = [...plan.blockers];
  const warnings = [...plan.warnings];

  if (!plan.body_input_plan) {
    blockers.push('Operation plan does not include a body input plan.');
    issues.push(buildingIssue({
      severity: 'error',
      code: 'body_input_plan_missing',
      path: 'plan.body_input_plan',
      message: 'Building requires Planning to provide a body input plan before packet materialization.',
    }));
  }

  if (!plan.packet_type) {
    blockers.push('Operation plan has no packet type.');
    issues.push(buildingIssue({
      severity: 'error',
      code: 'plan_packet_type_missing',
      path: 'plan.packet_type',
      message: 'Building cannot materialize a packet candidate without a packet type.',
    }));
  }

  const bodyValues = plan.body_input_plan?.resolved_input_values ?? {};
  const packetEnvelope = blockers.length === 0
    ? buildScopedRelationPacketEnvelope({
        plan,
        actor_packet: input.actor_packet,
        body_values: bodyValues,
        blockers,
        issues,
      }) ?? buildReactionPacketEnvelope({
        plan,
        actor_packet: input.actor_packet,
        body_values: bodyValues,
        blockers,
        issues,
      })
    : null;
  const materializationStatus = blockers.length > 0
    ? 'blocked'
    : warnings.length > 0
      ? 'partial'
      : 'candidate';
  const bodyCandidate: TrustedGenericBodyCandidate | null = plan.packet_type
    ? {
        candidate_kind: 'trusted.generic_body_candidate',
        builder_id: plan.body_input_plan?.builder_id ?? plan.builder_selection?.builder?.builder_id ?? null,
        packet_type: plan.packet_type,
        packet_subtype: plan.packet_subtype,
        schema_version: plan.definition?.current_schema_version ?? null,
        storage_class: plan.definition?.storage_class ?? null,
        revision_behavior: plan.definition?.revision_behavior ?? null,
        body: packetEnvelope?.body ?? {
          subtype: plan.packet_subtype,
          ...bodyValues,
        },
        source_plan_id: plan.plan_id,
        materialization_status: materializationStatus,
        notes: [
          'Generic body candidates are pre-inspection artifacts. Inspection/Certification must validate them before archival.',
        ],
      }
    : null;

  const node: TrustedPacketCandidateNode = {
    candidate_id: candidateIdForPlan({
      plan_id: plan.plan_id,
      packet_type: plan.packet_type,
      packet_subtype: plan.packet_subtype,
      suffix: 'candidate',
    }),
    candidate_kind: 'trusted.packet_candidate_node',
    source_plan_id: plan.plan_id,
    packet_type: plan.packet_type,
    packet_subtype: plan.packet_subtype,
    builder_id: bodyCandidate?.builder_id ?? null,
    body_candidate: bodyCandidate,
    packet_envelope: packetEnvelope,
    parent_candidate_id: input.parent_candidate_id ?? null,
    child_candidate_ids: [],
    blockers,
    warnings,
    issues,
    trace: [
      buildingTrace({
        step_id: 'building.packet_body_candidate.materialize',
        status: blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'partial' : 'ok',
        preset_ids: ['trusted.operation_plan.materialization.v0'],
        notes: bodyCandidate
          ? `Materialized generic body candidate for ${bodyCandidate.packet_type}.${bodyCandidate.packet_subtype ?? '*'}.`
          : 'Could not materialize a generic body candidate.',
      }),
    ],
  };

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_BUILDING_COORDINATOR_ID,
    coordinator_kind: 'building',
    value: node,
    issues,
    trace: node.trace,
  });
}
