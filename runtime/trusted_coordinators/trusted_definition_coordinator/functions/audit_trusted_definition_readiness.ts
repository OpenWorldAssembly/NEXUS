/**
 * File: audit_trusted_definition_readiness.ts
 * Description: Produces readiness reports from trusted definition runtime views.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_DEFINITION_COORDINATOR_ID,
  type AuditTrustedDefinitionReadinessInput,
  type TrustedDefinitionReadinessReport,
} from '../trusted_definition_types.ts';
import { definitionTrace } from '../trusted_definition_internal.ts';
import { compileTrustedDefinitionRuntimeViews } from './compile_trusted_definition_runtime_view.ts';

export function auditTrustedDefinitionReadiness(
  input: AuditTrustedDefinitionReadinessInput = {}
): TrustedRuntimeCoordinatorResult<TrustedDefinitionReadinessReport> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const viewSetResult = compileTrustedDefinitionRuntimeViews(input);
  issues.push(...viewSetResult.issues);

  if (!viewSetResult.value) {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
      coordinator_kind: 'definition',
      value: null,
      issues,
      trace: viewSetResult.trace,
    });
  }

  const missingRequiredPartCount = viewSetResult.value.views.reduce(
    (sum, view) => sum + view.regulation_profile.missing_required_definition_parts.length,
    0
  );
  const ready =
    viewSetResult.value.ready_view_count === viewSetResult.value.view_count &&
    missingRequiredPartCount === 0 &&
    !issues.some((issue) => issue.severity === 'error');

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
    coordinator_kind: 'definition',
    value: {
      report_kind: 'trusted.definition_readiness_report',
      mode: input.context_mode ?? 'reseed',
      ready,
      checked_packet_type_count: viewSetResult.value.view_count,
      missing_required_part_count: missingRequiredPartCount,
      issue_count: issues.length,
      runtime_view_set: viewSetResult.value,
    },
    issues,
    trace: [
      ...viewSetResult.trace,
      definitionTrace({
        step_id: 'definition.readiness.audit',
        status: ready ? 'ok' : issues.some((issue) => issue.severity === 'error') ? 'error' : 'partial',
        notes: `Trusted definition readiness audit checked ${viewSetResult.value.view_count} packet types.`,
      }),
    ],
  });
}
