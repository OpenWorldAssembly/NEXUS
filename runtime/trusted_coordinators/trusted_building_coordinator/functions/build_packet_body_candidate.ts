/**
 * File: build_packet_body_candidate.ts
 * Description: Materializes a generic packet body candidate from a resolved trusted operation plan.
 */

import {
  createScopedRelationPacket,
} from '@core/packets/relations.ts';
import type { PacketEnvelope } from '@core/schema/packet-schema';
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

function buildRelationFollowPacketEnvelope(input: {
  plan: BuildTrustedPacketBodyCandidateInput['plan'];
  actor_packet: BuildTrustedPacketBodyCandidateInput['actor_packet'];
  body_values: Record<string, unknown>;
  blockers: string[];
  issues: TrustedRuntimeCoordinatorIssue[];
}): PacketEnvelope | null {
  if (input.plan.packet_type !== 'Relation' || input.plan.packet_subtype !== 'follow') {
    return null;
  }

  const mutationIntent = input.body_values.kind ?? input.plan.workflow_plan_id;

  if (mutationIntent !== 'relation.follow.add' && mutationIntent !== 'relation.follow.add.workflow.v0') {
    return null;
  }

  const targetRef = input.body_values.target_ref as { packet_id?: unknown } | null;
  const scopeRef = input.body_values.scope_ref as { packet_id?: unknown } | null;
  const targetScopePacketId = typeof input.body_values.target_scope_packet_id === 'string'
    ? input.body_values.target_scope_packet_id
    : typeof targetRef?.packet_id === 'string'
      ? targetRef.packet_id
      : null;
  const scopePacketId = typeof scopeRef?.packet_id === 'string'
    ? scopeRef.packet_id
    : targetScopePacketId;

  if (!input.actor_packet?.header?.packet_id) {
    input.blockers.push('Follow relation materialization requires an actor packet.');
    input.issues.push(buildingIssue({
      severity: 'error',
      code: 'building.actor_packet_missing',
      path: 'actor_packet',
      message: 'Building cannot materialize a follow relation packet without an actor packet.',
    }));
    return null;
  }

  if (typeof targetScopePacketId !== 'string' || targetScopePacketId.length === 0) {
    input.blockers.push('Follow relation materialization requires a target scope packet id.');
    input.issues.push(buildingIssue({
      severity: 'error',
      code: 'building.target_packet_missing',
      path: 'plan.body_input_plan.resolved_input_values.target_scope_packet_id',
      message: 'Building cannot materialize a follow relation packet without target_scope_packet_id.',
    }));
    return null;
  }

  return createScopedRelationPacket({
    subtype: 'follow',
    subjectPacketId: input.actor_packet.header.packet_id,
    targetPacketId: targetScopePacketId,
    scopePacketId,
    applicableScopeRefs: scopePacketId ? [{ packet_id: scopePacketId }] : [],
    createdByPacketId: input.actor_packet.header.packet_id,
    createdAt:
      typeof input.body_values.created_at === 'string'
        ? input.body_values.created_at
        : undefined,
    status: 'active',
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

  const materializationStatus = blockers.length > 0
    ? 'blocked'
    : warnings.length > 0
      ? 'partial'
      : 'candidate';
  const bodyValues = plan.body_input_plan?.resolved_input_values ?? {};
  const packetEnvelope = blockers.length === 0
    ? buildRelationFollowPacketEnvelope({
        plan,
        actor_packet: input.actor_packet,
        body_values: bodyValues,
        blockers,
        issues,
      })
    : null;
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
