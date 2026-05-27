/**
 * File: trusted_inspection_coordinator.ts
 * Description: Gated public Trusted Inspection Coordinator surface for build-result quality gates.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { runTrustedInspectionOperation } from './trusted_inspection_registry.ts';
import {
  TRUSTED_INSPECTION_COORDINATOR_ID,
  type AuditTrustedInspectionReadinessInput,
  type InspectTrustedBuildResultInput,
  type InspectTrustedCandidateGraphInput,
  type InspectTrustedPacketBodyCandidateInput,
  type InspectTrustedPlanAlignmentInput,
  type TrustedCandidateGraphInspection,
  type TrustedInspectionReadinessReport,
  type TrustedInspectionReport,
  type TrustedPacketBodyInspection,
  type TrustedPlanAlignmentInspection,
} from './trusted_inspection_types.ts';

function castResult<TValue>(result: TrustedRuntimeCoordinatorResult<unknown>): TrustedRuntimeCoordinatorResult<TValue> {
  return result as TrustedRuntimeCoordinatorResult<TValue>;
}

export const trustedInspectionCoordinator = {
  id: 'trusted_inspection_coordinator.v0',

  inspectBuildResult(
    input: InspectTrustedBuildResultInput
  ): TrustedRuntimeCoordinatorResult<TrustedInspectionReport> {
    return castResult(runTrustedInspectionOperation({
      operation: 'inspect_build_result',
      input,
    }));
  },

  inspectCandidateGraph(
    input: InspectTrustedCandidateGraphInput
  ): TrustedRuntimeCoordinatorResult<TrustedCandidateGraphInspection> {
    return castResult(runTrustedInspectionOperation({
      operation: 'inspect_candidate_graph',
      input,
    }));
  },

  inspectPacketBodyCandidate(
    input: InspectTrustedPacketBodyCandidateInput
  ): TrustedRuntimeCoordinatorResult<TrustedPacketBodyInspection> {
    return castResult(runTrustedInspectionOperation({
      operation: 'inspect_packet_body_candidate',
      input,
    }));
  },

  inspectPlanAlignment(
    input: InspectTrustedPlanAlignmentInput
  ): TrustedRuntimeCoordinatorResult<TrustedPlanAlignmentInspection> {
    return castResult(runTrustedInspectionOperation({
      operation: 'inspect_plan_alignment',
      input,
    }));
  },

  auditReadiness(
    input?: AuditTrustedInspectionReadinessInput
  ): TrustedRuntimeCoordinatorResult<TrustedInspectionReadinessReport> {
    return castResult(runTrustedInspectionOperation({
      operation: 'audit_readiness',
      input,
    }));
  },
} as const satisfies {
  id: typeof TRUSTED_INSPECTION_COORDINATOR_ID;
  inspectBuildResult(input: InspectTrustedBuildResultInput): TrustedRuntimeCoordinatorResult<TrustedInspectionReport>;
  inspectCandidateGraph(input: InspectTrustedCandidateGraphInput): TrustedRuntimeCoordinatorResult<TrustedCandidateGraphInspection>;
  inspectPacketBodyCandidate(input: InspectTrustedPacketBodyCandidateInput): TrustedRuntimeCoordinatorResult<TrustedPacketBodyInspection>;
  inspectPlanAlignment(input: InspectTrustedPlanAlignmentInput): TrustedRuntimeCoordinatorResult<TrustedPlanAlignmentInspection>;
  auditReadiness(input?: AuditTrustedInspectionReadinessInput): TrustedRuntimeCoordinatorResult<TrustedInspectionReadinessReport>;
};
