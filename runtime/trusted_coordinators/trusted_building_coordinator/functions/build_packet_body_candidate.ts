/**
 * File: build_packet_body_candidate.ts
 * Description: Materializes a generic packet body candidate from a resolved trusted operation plan.
 */

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
  const bodyCandidate: TrustedGenericBodyCandidate | null = plan.packet_type
    ? {
        candidate_kind: 'trusted.generic_body_candidate',
        builder_id: plan.body_input_plan?.builder_id ?? plan.builder_selection?.builder?.builder_id ?? null,
        packet_type: plan.packet_type,
        packet_subtype: plan.packet_subtype,
        schema_version: plan.definition?.current_schema_version ?? null,
        storage_class: plan.definition?.storage_class ?? null,
        revision_behavior: plan.definition?.revision_behavior ?? null,
        body: {
          subtype: plan.packet_subtype,
          ...(plan.body_input_plan?.resolved_input_values ?? {}),
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
