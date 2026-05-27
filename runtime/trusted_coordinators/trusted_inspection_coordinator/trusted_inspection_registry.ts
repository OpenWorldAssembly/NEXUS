/**
 * File: trusted_inspection_registry.ts
 * Description: Internal operation registry for the Trusted Inspection Coordinator.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import type { TrustedInspectionCoordinatorRequest } from './trusted_inspection_types.ts';
import { auditTrustedInspectionReadiness } from './functions/audit_trusted_inspection_readiness.ts';
import { inspectTrustedBuildResult } from './functions/inspect_build_result.ts';
import { inspectTrustedCandidateGraph } from './functions/inspect_candidate_graph.ts';
import { inspectTrustedPacketBodyCandidate } from './functions/inspect_packet_body_candidate.ts';
import { inspectTrustedPlanAlignment } from './functions/inspect_plan_alignment.ts';

type TrustedInspectionHandler = (request: TrustedInspectionCoordinatorRequest) => TrustedRuntimeCoordinatorResult<unknown>;

const TRUSTED_INSPECTION_REGISTRY: Record<TrustedInspectionCoordinatorRequest['operation'], TrustedInspectionHandler> = {
  inspect_build_result: (request) => {
    if (request.operation !== 'inspect_build_result') throw new Error('Invalid Trusted Inspection operation dispatch.');
    return inspectTrustedBuildResult(request.input);
  },
  inspect_candidate_graph: (request) => {
    if (request.operation !== 'inspect_candidate_graph') throw new Error('Invalid Trusted Inspection operation dispatch.');
    return inspectTrustedCandidateGraph(request.input);
  },
  inspect_packet_body_candidate: (request) => {
    if (request.operation !== 'inspect_packet_body_candidate') throw new Error('Invalid Trusted Inspection operation dispatch.');
    return inspectTrustedPacketBodyCandidate(request.input);
  },
  inspect_plan_alignment: (request) => {
    if (request.operation !== 'inspect_plan_alignment') throw new Error('Invalid Trusted Inspection operation dispatch.');
    return inspectTrustedPlanAlignment(request.input);
  },
  audit_readiness: (request) => {
    if (request.operation !== 'audit_readiness') throw new Error('Invalid Trusted Inspection operation dispatch.');
    return auditTrustedInspectionReadiness(request.input);
  },
};

export function runTrustedInspectionOperation(
  request: TrustedInspectionCoordinatorRequest
): TrustedRuntimeCoordinatorResult<unknown> {
  return TRUSTED_INSPECTION_REGISTRY[request.operation](request);
}
