/**
 * File: inspect_plan_alignment.ts
 * Description: Checks whether a build result faithfully points back to the frozen operation plan tree.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  flattenPlanTree,
  indexPlanTree,
  inspectionIssue,
  inspectionTrace,
  uniqueSorted,
} from '../trusted_inspection_internal.ts';
import {
  TRUSTED_INSPECTION_COORDINATOR_ID,
  type InspectTrustedPlanAlignmentInput,
  type TrustedPlanAlignmentInspection,
} from '../trusted_inspection_types.ts';

export function inspectTrustedPlanAlignment(
  input: InspectTrustedPlanAlignmentInput
): TrustedRuntimeCoordinatorResult<TrustedPlanAlignmentInspection> {
  const plan = input.plan;
  const buildResult = input.build_result;
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const planNodes = flattenPlanTree(plan);
  const planIndex = indexPlanTree(plan);
  const candidateNodes = buildResult.candidate_graph.candidate_nodes;
  const candidatesByPlanId = new Map(
    candidateNodes
      .filter((candidate) => candidate.source_plan_id)
      .map((candidate) => [candidate.source_plan_id as string, candidate])
  );
  const unplannedCandidateIds: string[] = [];
  const missingPlanNodeIds: string[] = [];
  let childAlignmentIssueCount = 0;

  if (buildResult.source_plan_id !== plan.plan_id) {
    blockers.push('Build result source plan ID does not match the inspected plan.');
    issues.push(inspectionIssue({
      severity: 'error',
      code: 'build_result_plan_id_mismatch',
      path: 'build_result.source_plan_id',
      message: `Build result source plan ${buildResult.source_plan_id ?? 'null'} does not match plan ${plan.plan_id}.`,
    }));
  }

  if (buildResult.candidate_graph.source_plan_id !== plan.plan_id) {
    blockers.push('Candidate graph source plan ID does not match the inspected plan.');
    issues.push(inspectionIssue({
      severity: 'error',
      code: 'candidate_graph_plan_id_mismatch',
      path: 'build_result.candidate_graph.source_plan_id',
      message: `Candidate graph source plan ${buildResult.candidate_graph.source_plan_id ?? 'null'} does not match plan ${plan.plan_id}.`,
    }));
  }

  for (const candidateNode of candidateNodes) {
    if (!candidateNode.source_plan_id || !planIndex.has(candidateNode.source_plan_id)) {
      unplannedCandidateIds.push(candidateNode.candidate_id);
      issues.push(inspectionIssue({
        severity: 'error',
        code: 'candidate_source_plan_unknown',
        path: `candidate_nodes.${candidateNode.candidate_id}.source_plan_id`,
        message: `Candidate ${candidateNode.candidate_id} points to an unknown source plan node.`,
      }));
    }
  }

  for (const planNode of planNodes) {
    if (planNode.blockers.length === 0 && !candidatesByPlanId.has(planNode.plan_id)) {
      missingPlanNodeIds.push(planNode.plan_id);
      issues.push(inspectionIssue({
        severity: 'error',
        code: 'candidate_for_plan_node_missing',
        path: `plan_nodes.${planNode.plan_id}`,
        message: `Non-blocked plan node ${planNode.plan_id} did not produce a candidate node.`,
      }));
    }
  }

  for (const planNode of planNodes) {
    const candidateNode = candidatesByPlanId.get(planNode.plan_id);
    if (!candidateNode) continue;

    const plannedChildIds = new Set(planNode.child_packet_plans?.child_plans.map((childPlan) => childPlan.plan_id) ?? []);
    const candidateChildPlanIds = new Set(
      candidateNode.child_candidate_ids
        .map((candidateId) => candidateNodes.find((child) => child.candidate_id === candidateId)?.source_plan_id ?? null)
        .filter((sourcePlanId): sourcePlanId is string => Boolean(sourcePlanId))
    );

    for (const plannedChildId of plannedChildIds) {
      const childPlan = planIndex.get(plannedChildId);
      if (childPlan?.blockers.length === 0 && !candidateChildPlanIds.has(plannedChildId)) {
        childAlignmentIssueCount += 1;
        warnings.push(`Candidate for plan ${planNode.plan_id} is missing child candidate for child plan ${plannedChildId}.`);
      }
    }

    for (const childPlanId of candidateChildPlanIds) {
      if (!plannedChildIds.has(childPlanId)) {
        childAlignmentIssueCount += 1;
        blockers.push(`Candidate for plan ${planNode.plan_id} includes unplanned child plan ${childPlanId}.`);
      }
    }
  }

  const valid = blockers.length === 0 && missingPlanNodeIds.length === 0 && unplannedCandidateIds.length === 0 && !issues.some((issue) => issue.severity === 'error');

  traceEntries.push(inspectionTrace({
    step_id: 'inspection.plan_alignment.inspect',
    status: valid ? 'ok' : blockers.length > 0 || issues.some((issue) => issue.severity === 'error') ? 'blocked' : 'partial',
    preset_ids: ['trusted.plan_alignment_inspection.v0'],
    notes: `Inspected alignment between ${planNodes.length} plan node(s) and ${candidateNodes.length} candidate node(s).`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_INSPECTION_COORDINATOR_ID,
    coordinator_kind: 'inspection',
    value: {
      inspection_kind: 'trusted.plan_alignment_inspection',
      source_plan_id: plan.plan_id,
      build_result_plan_id: buildResult.source_plan_id,
      valid,
      planned_node_count: planNodes.length,
      candidate_node_count: candidateNodes.length,
      missing_plan_node_ids: uniqueSorted(missingPlanNodeIds),
      unplanned_candidate_ids: uniqueSorted(unplannedCandidateIds),
      child_alignment_issue_count: childAlignmentIssueCount,
      blockers: uniqueSorted(blockers),
      warnings: uniqueSorted(warnings),
      issues,
      trace: traceEntries,
    },
    issues,
    trace: traceEntries,
    mode: input.context_mode,
  });
}
