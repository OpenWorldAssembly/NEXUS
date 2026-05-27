/**
 * File: trusted_building_coordinator.ts
 * Description: Gated public Trusted Building Coordinator surface for packet candidate materialization.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { runTrustedBuildingOperation } from './trusted_building_registry.ts';
import {
  TRUSTED_BUILDING_COORDINATOR_ID,
  type AuditTrustedBuildingReadinessInput,
  type BuildTrustedCandidateGraphInput,
  type BuildTrustedDefinitionPartCandidatesInput,
  type BuildTrustedPacketBodyCandidateInput,
  type BuildTrustedPacketTypeBodyCandidateInput,
  type ResolveTrustedBuildFromOperationPlanInput,
  type TrustedBodyCandidate,
  type TrustedBuildResult,
  type TrustedBuildingReadinessReport,
  type TrustedDefinitionPartBuildPlan,
  type TrustedPacketCandidateGraph,
  type TrustedPacketCandidateNode,
} from './trusted_building_types.ts';

function castResult<TValue>(result: TrustedRuntimeCoordinatorResult<unknown>): TrustedRuntimeCoordinatorResult<TValue> {
  return result as TrustedRuntimeCoordinatorResult<TValue>;
}

export const trustedBuildingCoordinator = {
  id: 'trusted_building_coordinator.v0',

  buildFromOperationPlan(
    input: ResolveTrustedBuildFromOperationPlanInput
  ): TrustedRuntimeCoordinatorResult<TrustedBuildResult> {
    return castResult(runTrustedBuildingOperation({
      operation: 'build_from_operation_plan',
      input,
    }));
  },

  buildPacketBodyCandidate(
    input: BuildTrustedPacketBodyCandidateInput
  ): TrustedRuntimeCoordinatorResult<TrustedPacketCandidateNode> {
    return castResult(runTrustedBuildingOperation({
      operation: 'build_packet_body_candidate',
      input,
    }));
  },

  buildPacketTypeBodyCandidate(
    input: BuildTrustedPacketTypeBodyCandidateInput
  ): TrustedRuntimeCoordinatorResult<TrustedBodyCandidate> {
    return castResult(runTrustedBuildingOperation({
      operation: 'build_packet_type_body_candidate',
      input,
    }));
  },

  buildDefinitionPartCandidates(
    input: BuildTrustedDefinitionPartCandidatesInput
  ): TrustedRuntimeCoordinatorResult<TrustedDefinitionPartBuildPlan> {
    return castResult(runTrustedBuildingOperation({
      operation: 'build_definition_part_candidates',
      input,
    }));
  },

  buildCandidateGraph(
    input: BuildTrustedCandidateGraphInput
  ): TrustedRuntimeCoordinatorResult<TrustedPacketCandidateGraph> {
    return castResult(runTrustedBuildingOperation({
      operation: 'build_candidate_graph',
      input,
    }));
  },

  auditReadiness(
    input?: AuditTrustedBuildingReadinessInput
  ): TrustedRuntimeCoordinatorResult<TrustedBuildingReadinessReport> {
    return castResult(runTrustedBuildingOperation({
      operation: 'audit_readiness',
      input,
    }));
  },
} as const satisfies {
  id: typeof TRUSTED_BUILDING_COORDINATOR_ID;
  buildFromOperationPlan(input: ResolveTrustedBuildFromOperationPlanInput): TrustedRuntimeCoordinatorResult<TrustedBuildResult>;
  buildPacketBodyCandidate(input: BuildTrustedPacketBodyCandidateInput): TrustedRuntimeCoordinatorResult<TrustedPacketCandidateNode>;
  buildPacketTypeBodyCandidate(input: BuildTrustedPacketTypeBodyCandidateInput): TrustedRuntimeCoordinatorResult<TrustedBodyCandidate>;
  buildDefinitionPartCandidates(input: BuildTrustedDefinitionPartCandidatesInput): TrustedRuntimeCoordinatorResult<TrustedDefinitionPartBuildPlan>;
  buildCandidateGraph(input: BuildTrustedCandidateGraphInput): TrustedRuntimeCoordinatorResult<TrustedPacketCandidateGraph>;
  auditReadiness(input?: AuditTrustedBuildingReadinessInput): TrustedRuntimeCoordinatorResult<TrustedBuildingReadinessReport>;
};
