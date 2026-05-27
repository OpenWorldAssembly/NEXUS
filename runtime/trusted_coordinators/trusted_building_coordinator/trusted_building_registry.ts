/**
 * File: trusted_building_registry.ts
 * Description: Internal operation registry for the Trusted Building Coordinator.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import type { TrustedBuildingCoordinatorRequest } from './trusted_building_types.ts';
import { auditTrustedBuildingReadiness } from './functions/audit_trusted_building_readiness.ts';
import { buildTrustedCandidateGraph } from './functions/build_candidate_graph.ts';
import { buildTrustedDefinitionPartCandidates } from './functions/build_definition_part_candidates.ts';
import { buildTrustedFromOperationPlan } from './functions/build_from_operation_plan.ts';
import { buildTrustedPacketBodyCandidate } from './functions/build_packet_body_candidate.ts';
import { buildTrustedPacketTypeBodyCandidate } from './functions/build_packet_type_body_candidate.ts';

type TrustedBuildingHandler = (request: TrustedBuildingCoordinatorRequest) => TrustedRuntimeCoordinatorResult<unknown>;

const TRUSTED_BUILDING_REGISTRY: Record<TrustedBuildingCoordinatorRequest['operation'], TrustedBuildingHandler> = {
  build_from_operation_plan: (request) => {
    if (request.operation !== 'build_from_operation_plan') {
      throw new Error('Invalid Trusted Building operation dispatch.');
    }
    return buildTrustedFromOperationPlan(request.input);
  },
  build_packet_body_candidate: (request) => {
    if (request.operation !== 'build_packet_body_candidate') {
      throw new Error('Invalid Trusted Building operation dispatch.');
    }
    return buildTrustedPacketBodyCandidate(request.input);
  },
  build_packet_type_body_candidate: (request) => {
    if (request.operation !== 'build_packet_type_body_candidate') {
      throw new Error('Invalid Trusted Building operation dispatch.');
    }
    return buildTrustedPacketTypeBodyCandidate(request.input);
  },
  build_definition_part_candidates: (request) => {
    if (request.operation !== 'build_definition_part_candidates') {
      throw new Error('Invalid Trusted Building operation dispatch.');
    }
    return buildTrustedDefinitionPartCandidates(request.input);
  },
  build_candidate_graph: (request) => {
    if (request.operation !== 'build_candidate_graph') {
      throw new Error('Invalid Trusted Building operation dispatch.');
    }
    return buildTrustedCandidateGraph(request.input);
  },
  audit_readiness: (request) => {
    if (request.operation !== 'audit_readiness') {
      throw new Error('Invalid Trusted Building operation dispatch.');
    }
    return auditTrustedBuildingReadiness(request.input);
  },
};

export function runTrustedBuildingOperation(
  request: TrustedBuildingCoordinatorRequest
): TrustedRuntimeCoordinatorResult<unknown> {
  return TRUSTED_BUILDING_REGISTRY[request.operation](request);
}
