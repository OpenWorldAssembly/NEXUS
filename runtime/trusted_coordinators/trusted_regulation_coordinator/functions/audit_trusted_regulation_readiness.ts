/**
 * File: audit_trusted_regulation_readiness.ts
 * Description: Audits whether trusted regulation contexts can resolve for active packet definitions.
 */

import { trustedDefinitionCoordinator } from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorTraceEntry,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { regulationTrace } from '../trusted_regulation_internal.ts';
import {
  TRUSTED_REGULATION_COORDINATOR_ID,
  type AuditTrustedRegulationReadinessInput,
  type TrustedRegulationContext,
  type TrustedRegulationReadinessReport,
} from '../trusted_regulation_types.ts';
import { resolveTrustedRegulationContext } from './resolve_trusted_regulation_context.ts';

export function auditTrustedRegulationReadiness(
  input: AuditTrustedRegulationReadinessInput = {}
): TrustedRuntimeCoordinatorResult<TrustedRegulationReadinessReport> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const contexts: TrustedRegulationContext[] = [];
  const definitionsResult = trustedDefinitionCoordinator.listPacketDefinitions({
    context_mode: input.context_mode ?? 'reseed',
    node_element_id: input.node_element_id,
    preferences: input.preferences,
    packet_type_filters: input.packet_type_filters,
  });

  issues.push(...definitionsResult.issues);
  traceEntries.push(...definitionsResult.trace);

  for (const definition of definitionsResult.value ?? []) {
    const contextResult = resolveTrustedRegulationContext({
      ...input,
      definition,
      definitions: definitionsResult.value ?? [definition],
      packet_type: definition.packet_type,
      packet_subtype: definition.default_subtype,
      operation_kind: input.operation_kind ?? 'reseed',
      context_mode: input.context_mode ?? 'reseed',
    });
    issues.push(...contextResult.issues);
    traceEntries.push(...contextResult.trace);

    if (contextResult.value) {
      contexts.push(contextResult.value);
    }
  }

  const blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length;
  const advisoryIssueCount = issues.length - blockingIssueCount;
  const missingRequiredPartCount = contexts.reduce(
    (count, context) => count + context.missing_required_definition_parts.length,
    0
  );

  traceEntries.push(regulationTrace({
    step_id: 'regulation.readiness.audit',
    status: blockingIssueCount > 0 ? 'error' : advisoryIssueCount > 0 ? 'partial' : 'ok',
    notes: `Audited trusted regulation readiness for ${contexts.length} packet type(s).`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_REGULATION_COORDINATOR_ID,
    coordinator_kind: 'regulation',
    value: {
      report_kind: 'trusted.regulation_readiness_report',
      mode: input.context_mode ?? 'reseed',
      ready: blockingIssueCount === 0,
      checked_packet_type_count: definitionsResult.value?.length ?? 0,
      context_count: contexts.length,
      blocking_issue_count: blockingIssueCount,
      advisory_issue_count: advisoryIssueCount,
      missing_required_part_count: missingRequiredPartCount,
      contexts,
    },
    issues,
    trace: traceEntries,
  });
}
