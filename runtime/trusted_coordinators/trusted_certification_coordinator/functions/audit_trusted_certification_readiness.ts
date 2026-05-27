/**
 * File: audit_trusted_certification_readiness.ts
 * Description: Audits whether inspected build results can open certification tickets for the next archive seam.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { trustedPlanningCoordinator } from '@runtime/trusted_coordinators/trusted_planning_coordinator/index.ts';
import { trustedBuildingCoordinator } from '@runtime/trusted_coordinators/trusted_building_coordinator/index.ts';
import { trustedInspectionCoordinator } from '@runtime/trusted_coordinators/trusted_inspection_coordinator/index.ts';
import { certificationTrace } from '../trusted_certification_internal.ts';
import {
  TRUSTED_CERTIFICATION_COORDINATOR_ID,
  type AuditTrustedCertificationReadinessInput,
  type TrustedCertificationPackage,
  type TrustedCertificationReadinessReport,
} from '../trusted_certification_types.ts';
import { prepareTrustedCertificationTicket } from './prepare_certification_ticket.ts';

export function auditTrustedCertificationReadiness(
  input: AuditTrustedCertificationReadinessInput = {}
): TrustedRuntimeCoordinatorResult<TrustedCertificationReadinessReport> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const mode = input.context_mode ?? 'reseed';
  const planning = trustedPlanningCoordinator.auditReadiness({
    context_mode: mode,
    node_element_id: input.node_element_id ?? null,
    packet_type_filters: input.packet_type_filters,
    operation_kind: 'debug_audit',
  });

  issues.push(...planning.issues);
  trace.push(...planning.trace);

  const packages: TrustedCertificationPackage[] = [];
  for (const plan of planning.value?.plans ?? []) {
    const build = trustedBuildingCoordinator.buildFromOperationPlan({
      plan,
      context_mode: mode,
    });
    issues.push(...build.issues);
    trace.push(...build.trace);

    if (!build.value) {
      continue;
    }

    const inspection = trustedInspectionCoordinator.inspectBuildResult({
      plan,
      build_result: build.value,
      context_mode: mode,
    });
    issues.push(...inspection.issues);
    trace.push(...inspection.trace);

    if (!inspection.value) {
      continue;
    }

    const certificationPackage = prepareTrustedCertificationTicket({
      plan,
      build_result: build.value,
      inspection_report: inspection.value,
      actor_packet_id: input.node_element_id ?? null,
      node_element_id: input.node_element_id ?? null,
      operation_id: plan.plan_id,
      context_mode: mode,
    });

    issues.push(...certificationPackage.issues);
    trace.push(...certificationPackage.trace);

    if (certificationPackage.value) {
      packages.push(certificationPackage.value);
    }
  }

  const blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length +
    packages.reduce((total, entry) => total + entry.blockers.length, 0);
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length +
    packages.reduce((total, entry) => total + entry.warnings.length, 0);

  trace.push(certificationTrace({
    step_id: 'certification.readiness.audit',
    status: blockingIssueCount > 0 ? 'blocked' : warningCount > 0 ? 'partial' : 'ok',
    preset_ids: ['trusted.certification_readiness.v0'],
    notes: `Audited certification readiness across ${packages.length} package candidate(s).`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
    coordinator_kind: 'certification',
    value: {
      report_kind: 'trusted.certification_readiness_report',
      mode,
      ready: blockingIssueCount === 0,
      checked_inspection_count: packages.length,
      prepared_ticket_count: packages.length,
      certifiable_ticket_count: packages.filter((entry) => entry.signature_requests.length > 0).length,
      blocking_issue_count: blockingIssueCount,
      warning_count: warningCount,
      packages,
    },
    issues,
    trace,
    status: blockingIssueCount > 0 ? 'blocked' : warningCount > 0 ? 'partial' : 'ok',
    mode,
  });
}
