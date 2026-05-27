/**
 * File: inspect_build_result.ts
 * Description: Main trusted inspection entry point for checking a build result against its source plan snapshot.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { inspectionTrace, uniqueSorted } from '../trusted_inspection_internal.ts';
import {
  TRUSTED_INSPECTION_COORDINATOR_ID,
  type InspectTrustedBuildResultInput,
  type TrustedInspectionReport,
} from '../trusted_inspection_types.ts';
import { inspectTrustedCandidateGraph } from './inspect_candidate_graph.ts';
import { inspectTrustedPlanAlignment } from './inspect_plan_alignment.ts';

export function inspectTrustedBuildResult(
  input: InspectTrustedBuildResultInput
): TrustedRuntimeCoordinatorResult<TrustedInspectionReport> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const graphInspection = inspectTrustedCandidateGraph({
    plan: input.plan,
    candidate_graph: input.build_result.candidate_graph,
    context_mode: input.context_mode,
  });
  const planAlignment = inspectTrustedPlanAlignment({
    plan: input.plan,
    build_result: input.build_result,
    context_mode: input.context_mode,
  });

  issues.push(...graphInspection.issues, ...planAlignment.issues);
  traceEntries.push(...graphInspection.trace, ...planAlignment.trace);

  const bodyInspections = graphInspection.value?.body_inspections ?? [];
  const blockers = uniqueSorted([
    ...(input.build_result.blockers ?? []),
    ...(graphInspection.value?.blockers ?? []),
    ...(planAlignment.value?.blockers ?? []),
  ]);
  const warnings = uniqueSorted([
    ...(input.build_result.warnings ?? []),
    ...(graphInspection.value?.warnings ?? []),
    ...(planAlignment.value?.warnings ?? []),
  ]);
  const validCandidateCount = bodyInspections.filter((inspection) => inspection.valid).length;
  const invalidCandidateCount = bodyInspections.length - validCandidateCount;

  traceEntries.push(inspectionTrace({
    step_id: 'inspection.build_result.inspect',
    status: blockers.length > 0 || issues.some((issue) => issue.severity === 'error')
      ? 'blocked'
      : warnings.length > 0 || invalidCandidateCount > 0
        ? 'partial'
        : 'ok',
    preset_ids: ['trusted.build_result_inspection.v0'],
    notes: `Inspected build result for plan ${input.plan.plan_id} with ${bodyInspections.length} candidate body inspection(s).`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_INSPECTION_COORDINATOR_ID,
    coordinator_kind: 'inspection',
    value: {
      report_kind: 'trusted.inspection_report',
      source_plan_id: input.plan.plan_id,
      source_build_result_plan_id: input.build_result.source_plan_id,
      inspected_candidate_count: bodyInspections.length,
      valid_candidate_count: validCandidateCount,
      invalid_candidate_count: invalidCandidateCount,
      graph_alignment: graphInspection.value,
      plan_alignment: planAlignment.value,
      body_schema_inspections: bodyInspections,
      blockers,
      warnings,
      issues,
      trace: traceEntries,
    },
    issues,
    trace: traceEntries,
    mode: input.context_mode ?? input.plan.context_mode,
  });
}
