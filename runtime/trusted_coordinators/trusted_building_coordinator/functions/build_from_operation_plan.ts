/**
 * File: build_from_operation_plan.ts
 * Description: Main trusted building entry point for materializing packet candidates from a trusted operation plan.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  buildingTrace,
  uniqueSorted,
} from '../trusted_building_internal.ts';
import {
  TRUSTED_BUILDING_COORDINATOR_ID,
  type ResolveTrustedBuildFromOperationPlanInput,
  type TrustedBodyCandidate,
  type TrustedBuildResult,
} from '../trusted_building_types.ts';
import { buildTrustedCandidateGraph } from './build_candidate_graph.ts';

export function buildTrustedFromOperationPlan(
  input: ResolveTrustedBuildFromOperationPlanInput
): TrustedRuntimeCoordinatorResult<TrustedBuildResult> {
  const graphResult = buildTrustedCandidateGraph({ plan: input.plan });
  const issues: TrustedRuntimeCoordinatorIssue[] = [...graphResult.issues];
  const graph = graphResult.value;
  const bodyCandidates: TrustedBodyCandidate[] = graph?.candidate_nodes
    .map((node) => node.body_candidate)
    .filter((candidate): candidate is TrustedBodyCandidate => Boolean(candidate)) ?? [];
  const rootCandidate = graph?.candidate_nodes.find((node) => node.candidate_id === graph.root_candidate_id) ?? null;
  const blockers = uniqueSorted([
    ...(input.plan.blockers ?? []),
    ...(graph?.blockers ?? []),
  ]);
  const warnings = uniqueSorted([
    ...(input.plan.warnings ?? []),
    ...(graph?.warnings ?? []),
  ]);

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_BUILDING_COORDINATOR_ID,
    coordinator_kind: 'building',
    value: graph
      ? {
          result_kind: 'trusted.build_result',
          source_plan_id: input.plan.plan_id,
          root_candidate: rootCandidate,
          candidate_graph: graph,
          body_candidates: bodyCandidates,
          blockers,
          warnings,
        }
      : null,
    issues,
    trace: [
      ...graphResult.trace,
      buildingTrace({
        step_id: 'building.operation_plan.build',
        status: blockers.length > 0 || issues.some((issue) => issue.severity === 'error')
          ? 'blocked'
          : warnings.length > 0
            ? 'partial'
            : 'ok',
        preset_ids: ['trusted.operation_plan.build.v0'],
        notes: `Built ${bodyCandidates.length} body candidate(s) from operation plan ${input.plan.plan_id}.`,
      }),
    ],
    mode: input.context_mode ?? input.plan.context_mode,
  });
}
