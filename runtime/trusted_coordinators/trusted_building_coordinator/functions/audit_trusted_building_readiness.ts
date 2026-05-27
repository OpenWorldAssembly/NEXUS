/**
 * File: audit_trusted_building_readiness.ts
 * Description: Audits whether trusted operation plans can materialize candidate packet graphs.
 */

import { trustedPlanningCoordinator } from '@runtime/trusted_coordinators/trusted_planning_coordinator/index.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { buildingTrace } from '../trusted_building_internal.ts';
import {
  TRUSTED_BUILDING_COORDINATOR_ID,
  type AuditTrustedBuildingReadinessInput,
  type TrustedBuildingReadinessReport,
  type TrustedBuildResult,
} from '../trusted_building_types.ts';
import { buildTrustedFromOperationPlan } from './build_from_operation_plan.ts';

export function auditTrustedBuildingReadiness(
  input: AuditTrustedBuildingReadinessInput = {}
): TrustedRuntimeCoordinatorResult<TrustedBuildingReadinessReport> {
  const contextMode = input.context_mode ?? 'reseed';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const buildResults: TrustedBuildResult[] = [];
  const planningResult = trustedPlanningCoordinator.auditReadiness({
    context_mode: contextMode,
    node_element_id: input.node_element_id,
    definitions: input.definitions,
    preferences: input.preferences,
    packet_type_filters: input.packet_type_filters,
  });

  issues.push(...planningResult.issues);
  traceEntries.push(...planningResult.trace);

  for (const plan of planningResult.value?.plans ?? []) {
    const buildResult = buildTrustedFromOperationPlan({
      plan,
      context_mode: contextMode,
    });
    issues.push(...buildResult.issues);
    traceEntries.push(...buildResult.trace);

    if (buildResult.value) {
      buildResults.push(buildResult.value);
    }
  }

  const blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length +
    buildResults.reduce((total, result) => total + result.warnings.length, 0);
  const bodyCandidateCount = buildResults.reduce((total, result) => total + result.body_candidates.length, 0);
  const ready =
    blockingIssueCount === 0 &&
    buildResults.every((result) => result.blockers.length === 0 && result.body_candidates.length > 0);

  traceEntries.push(buildingTrace({
    step_id: 'building.readiness.audit',
    status: ready ? 'ok' : blockingIssueCount > 0 ? 'error' : 'partial',
    preset_ids: ['trusted.building_readiness.v0'],
    notes: `Audited ${buildResults.length} trusted build result(s).`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_BUILDING_COORDINATOR_ID,
    coordinator_kind: 'building',
    value: {
      report_kind: 'trusted.building_readiness_report',
      mode: contextMode,
      ready,
      checked_plan_count: planningResult.value?.plan_count ?? 0,
      built_graph_count: buildResults.length,
      body_candidate_count: bodyCandidateCount,
      blocking_issue_count: blockingIssueCount,
      warning_count: warningCount,
      build_results: buildResults,
    },
    issues,
    trace: traceEntries,
    mode: contextMode,
  });
}
