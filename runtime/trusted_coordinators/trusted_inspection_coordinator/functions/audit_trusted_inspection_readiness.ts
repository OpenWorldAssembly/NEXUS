/**
 * File: audit_trusted_inspection_readiness.ts
 * Description: Runs the planning -> building -> inspection chain for reseed/debug readiness without using live re-planning to judge built artifacts.
 */

import { trustedBuildingCoordinator } from '@runtime/trusted_coordinators/trusted_building_coordinator/index.ts';
import { trustedPlanningCoordinator } from '@runtime/trusted_coordinators/trusted_planning_coordinator/index.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { inspectionTrace } from '../trusted_inspection_internal.ts';
import {
  TRUSTED_INSPECTION_COORDINATOR_ID,
  type AuditTrustedInspectionReadinessInput,
  type TrustedInspectionReadinessReport,
  type TrustedInspectionReport,
} from '../trusted_inspection_types.ts';
import { inspectTrustedBuildResult } from './inspect_build_result.ts';

export function auditTrustedInspectionReadiness(
  input: AuditTrustedInspectionReadinessInput = {}
): TrustedRuntimeCoordinatorResult<TrustedInspectionReadinessReport> {
  const contextMode = input.context_mode ?? 'reseed';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const reports: TrustedInspectionReport[] = [];
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
    const buildResult = trustedBuildingCoordinator.buildFromOperationPlan({
      plan,
      context_mode: contextMode,
    });

    issues.push(...buildResult.issues);
    traceEntries.push(...buildResult.trace);

    if (!buildResult.value) continue;

    const inspection = inspectTrustedBuildResult({
      plan,
      build_result: buildResult.value,
      context_mode: contextMode,
    });

    issues.push(...inspection.issues);
    traceEntries.push(...inspection.trace);

    if (inspection.value) {
      reports.push(inspection.value);
    }
  }

  const inspectedCandidateCount = reports.reduce((total, report) => total + report.inspected_candidate_count, 0);
  const validCandidateCount = reports.reduce((total, report) => total + report.valid_candidate_count, 0);
  const invalidCandidateCount = reports.reduce((total, report) => total + report.invalid_candidate_count, 0);
  const blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length +
    reports.reduce((total, report) => total + report.blockers.length, 0);
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length +
    reports.reduce((total, report) => total + report.warnings.length, 0);
  const ready =
    blockingIssueCount === 0 &&
    invalidCandidateCount === 0 &&
    reports.every((report) => report.blockers.length === 0);

  traceEntries.push(inspectionTrace({
    step_id: 'inspection.readiness.audit',
    status: ready ? 'ok' : blockingIssueCount > 0 ? 'blocked' : 'partial',
    preset_ids: ['trusted.inspection_readiness.v0'],
    notes: `Audited ${reports.length} trusted inspection report(s).`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_INSPECTION_COORDINATOR_ID,
    coordinator_kind: 'inspection',
    value: {
      report_kind: 'trusted.inspection_readiness_report',
      mode: contextMode,
      ready,
      checked_plan_count: planningResult.value?.plan_count ?? 0,
      inspected_build_count: reports.length,
      inspected_candidate_count: inspectedCandidateCount,
      valid_candidate_count: validCandidateCount,
      invalid_candidate_count: invalidCandidateCount,
      blocking_issue_count: blockingIssueCount,
      warning_count: warningCount,
      reports,
    },
    issues,
    trace: traceEntries,
    mode: contextMode,
  });
}
