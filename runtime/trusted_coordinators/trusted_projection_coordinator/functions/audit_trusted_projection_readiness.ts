/**
 * File: audit_trusted_projection_readiness.ts
 * Description: Audits trusted packet definitions for basic projection descriptor coverage.
 */

import { trustedDefinitionCoordinator } from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { projectionIssue, projectionTrace } from '../trusted_projection_internal.ts';
import {
  TRUSTED_PROJECTION_COORDINATOR_ID,
  type AuditTrustedProjectionReadinessInput,
  type TrustedProjectionReadinessReport,
} from '../trusted_projection_types.ts';

export function auditTrustedProjectionReadiness(
  input: AuditTrustedProjectionReadinessInput = {}
): TrustedRuntimeCoordinatorResult<TrustedProjectionReadinessReport> {
  const contextMode = input.context_mode ?? 'debug_audit';
  const definitionsResult = trustedDefinitionCoordinator.listPacketDefinitions({
    packet_type_filters: input.packet_type_filters,
    node_element_id: input.node_element_id,
    context_mode: contextMode,
  });
  const definitions = definitionsResult.value ?? [];
  const packetTypesWithoutProjection = definitions
    .filter((definition) => definition.projections.length === 0)
    .map((definition) => definition.packet_type)
    .sort((left, right) => left.localeCompare(right));
  const issues: TrustedRuntimeCoordinatorIssue[] = [
    ...definitionsResult.issues,
    ...packetTypesWithoutProjection.map((packetType) => projectionIssue({
      severity: 'warning' as const,
      code: 'trusted_projection_descriptor_missing',
      path: `definitions.${packetType}.projections`,
      message: `${packetType} has no projection descriptor and will rely on fallback archive/search cards.`,
    })),
  ];
  const projectionDescriptorCount = definitions.reduce(
    (total, definition) => total + definition.projections.length,
    0
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_PROJECTION_COORDINATOR_ID,
    coordinator_kind: 'projection',
    value: {
      report_kind: 'trusted.projection_readiness_report',
      mode: contextMode,
      ready: !issues.some((issue) => issue.severity === 'error'),
      checked_packet_type_count: definitions.length,
      packet_types_without_projection: packetTypesWithoutProjection,
      projection_descriptor_count: projectionDescriptorCount,
      blocking_issue_count: issues.filter((issue) => issue.severity === 'error').length,
      warning_count: issues.filter((issue) => issue.severity === 'warning').length,
    },
    issues,
    trace: [
      ...definitionsResult.trace,
      projectionTrace({
        step_id: 'projection.readiness.audit',
        status: issues.some((issue) => issue.severity === 'error') ? 'error' : packetTypesWithoutProjection.length > 0 ? 'partial' : 'ok',
        preset_ids: ['trusted.projection.readiness.v0'],
        notes: `Audited projection descriptor coverage for ${definitions.length} packet type(s).`,
      }),
    ],
    mode: contextMode,
    operation_id: input.operation_id,
    request_id: input.request_id,
  });
}
