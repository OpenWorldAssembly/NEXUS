/**
 * File: audit_trusted_planning_readiness.ts
 * Description: Audits trusted planning readiness across active packet definitions before reseed.
 */

import { trustedDefinitionCoordinator } from '@runtime/trusted_coordinators/trusted_definition_coordinator';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { planningTrace } from '../trusted_planning_internal.ts';
import {
  TRUSTED_PLANNING_COORDINATOR_ID,
  type AuditTrustedPlanningReadinessInput,
  type TrustedOperationPlan,
  type TrustedPlanningReadinessReport,
} from '../trusted_planning_types.ts';
import { resolveTrustedOperationPlan } from './resolve_trusted_operation_plan.ts';

export function auditTrustedPlanningReadiness(
  input: AuditTrustedPlanningReadinessInput = {}
): TrustedRuntimeCoordinatorResult<TrustedPlanningReadinessReport> {
  const contextMode = input.context_mode ?? 'reseed';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const plans: TrustedOperationPlan[] = [];
  const definitionsResult = trustedDefinitionCoordinator.listPacketDefinitions({
    context_mode: contextMode,
    node_element_id: input.node_element_id,
    preferences: input.preferences,
    packet_type_filters: input.packet_type_filters ?? (input.packet_type ? [input.packet_type] : undefined),
  });
  issues.push(...definitionsResult.issues);
  traceEntries.push(...definitionsResult.trace);

  const definitions = definitionsResult.value ?? [];

  for (const definition of definitions) {
    const planResult = resolveTrustedOperationPlan({
      ...input,
      context_mode: contextMode,
      operation_kind: input.operation_kind ?? 'reseed',
      definition,
      definitions,
      packet_type: definition.packet_type,
      packet_subtype: definition.default_subtype,
      include_write_policy_gate: false,
    });
    issues.push(...planResult.issues);
    traceEntries.push(...planResult.trace);

    if (planResult.value) {
      plans.push(planResult.value);
    }
  }

  const blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length;
  const advisoryIssueCount = issues.length - blockingIssueCount;
  const blockerCount = plans.reduce((total, plan) => total + plan.blockers.length, 0);
  const warningCount = plans.reduce((total, plan) => total + plan.warnings.length, 0);
  const ready = blockingIssueCount === 0 && blockerCount === 0;

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_PLANNING_COORDINATOR_ID,
    coordinator_kind: 'workflow',
    value: {
      report_kind: 'trusted.planning_readiness_report',
      mode: contextMode,
      ready,
      checked_packet_type_count: definitions.length,
      plan_count: plans.length,
      blocking_issue_count: blockingIssueCount,
      advisory_issue_count: advisoryIssueCount,
      blocker_count: blockerCount,
      warning_count: warningCount,
      plans,
    },
    issues,
    trace: [
      ...traceEntries,
      planningTrace({
        step_id: 'planning.readiness.audit',
        status: ready ? 'ok' : 'blocked',
        notes: `Trusted planning readiness checked ${plans.length}/${definitions.length} packet definition(s).`,
      }),
    ],
  });
}
