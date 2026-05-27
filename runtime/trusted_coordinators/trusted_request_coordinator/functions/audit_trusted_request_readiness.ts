/**
 * File: audit_trusted_request_readiness.ts
 * Description: Audits request-intake enrollment readiness through the Trusted Request Coordinator.
 */

import {
  auditPacketClientIntentEnrollments,
} from '@runtime/nexus/server/packet-client-intent-enrollment';
import {
  createTrustedRuntimeCoordinatorResult,
  createTrustedTraceEntry,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import type {
  AuditTrustedRequestReadinessInput,
  TrustedRequestReadinessReport,
} from '../trusted_request_types.ts';

export function auditTrustedRequestReadiness(
  input: AuditTrustedRequestReadinessInput = {}
): TrustedRuntimeCoordinatorResult<TrustedRequestReadinessReport> {
  const report = auditPacketClientIntentEnrollments();
  const issues: TrustedRuntimeCoordinatorIssue[] = report.findings.map((finding) =>
    trustedIssue({
      severity: finding.severity,
      code: finding.code,
      path: finding.enrollment_id,
      message: finding.message,
    })
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: 'trusted_request_coordinator.v0',
    coordinator_kind: 'request',
    value: {
      ...report,
      report_kind: 'trusted.request_readiness',
    },
    issues,
    mode: input.mode ?? 'debug_audit',
    trace: [
      createTrustedTraceEntry({
        step_id: 'request.readiness.audit',
        coordinator_id: 'trusted_request_coordinator.v0',
        status: report.status === 'pass' ? 'ok' : 'error',
        notes: `Audited ${report.checked_enrollment_ids.length} request enrollments.`,
      }),
    ],
  });
}
