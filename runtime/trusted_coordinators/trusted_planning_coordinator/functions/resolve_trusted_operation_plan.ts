/**
 * File: resolve_trusted_operation_plan.ts
 * Description: Orchestrates trusted packet operation planning across definition, builder, defaults, dependencies, policy, and child-plan seams.
 */

import type { MutationActionId } from '@core/auth/write-policy.ts';
import type { PacketTypeDefinition } from '@core/packets/definitions/packet-definition-types.ts';
import { trustedDefinitionCoordinator } from '@runtime/trusted_coordinators/trusted_definition_coordinator';
import { trustedRegulationCoordinator } from '@runtime/trusted_coordinators/trusted_regulation_coordinator';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  inferActionIds,
  issueForMissingDefinition,
  issueForMissingParts,
  missingDefinitionParts,
  planningTrace,
  uniqueSorted,
} from '../trusted_planning_internal.ts';
import {
  TRUSTED_PLANNING_COORDINATOR_ID,
  type ResolveTrustedOperationPlanInput,
  type TrustedOperationPlan,
} from '../trusted_planning_types.ts';
import { selectTrustedBuilderDescriptor } from './select_trusted_builder_descriptor.ts';
import { resolveTrustedDefaultPlan } from './resolve_trusted_default_plan.ts';
import { resolveTrustedDependencyPlan } from './resolve_trusted_dependency_plan.ts';
import { resolveTrustedChildPacketPlans } from './resolve_trusted_child_packet_plans.ts';

function resolvePlanningDefinition(input: ResolveTrustedOperationPlanInput): {
  definition: PacketTypeDefinition | null;
  definitions: readonly PacketTypeDefinition[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
} {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];

  if (input.definition) {
    return {
      definition: input.definition,
      definitions: input.definitions ?? [input.definition],
      issues,
      trace,
    };
  }

  if (!input.packet_type) {
    issues.push(issueForMissingDefinition({
      packet_type: input.packet_type,
      operation_kind: input.operation_kind ?? 'reseed',
    }));
    return { definition: null, definitions: input.definitions ?? [], issues, trace };
  }

  const definitionResult = trustedDefinitionCoordinator.resolvePacketDefinition({
    context_mode: input.context_mode ?? 'reseed',
    node_element_id: input.node_element_id,
    preferences: input.preferences,
    packet_type: input.packet_type,
    packet_subtype: input.packet_subtype,
  });
  issues.push(...definitionResult.issues);
  trace.push(...definitionResult.trace);

  return {
    definition: definitionResult.value,
    definitions: input.definitions ?? (definitionResult.value ? [definitionResult.value] : []),
    issues,
    trace,
  };
}

function isMutationActionId(actionId: string): actionId is MutationActionId {
  return actionId.includes('.');
}

export function resolveTrustedOperationPlan(
  input: ResolveTrustedOperationPlanInput
): TrustedRuntimeCoordinatorResult<TrustedOperationPlan> {
  const contextMode = input.context_mode ?? 'reseed';
  const operationKind = input.operation_kind ?? 'reseed';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const definitionResolution = resolvePlanningDefinition(input);
  const definition = definitionResolution.definition;
  const definitions = input.definitions ?? definitionResolution.definitions;
  issues.push(...definitionResolution.issues);
  traceEntries.push(...definitionResolution.trace);

  if (!definition) {
    const plan: TrustedOperationPlan = {
      plan_kind: 'trusted.operation_plan',
      plan_id: `trusted.operation_plan.${input.packet_type ?? 'unknown'}.${operationKind}`,
      context_mode: contextMode,
      node_element_id: input.node_element_id ?? null,
      packet_type: input.packet_type ?? null,
      packet_subtype: input.packet_subtype ?? null,
      operation_kind: operationKind,
      action_ids: [],
      workflow_plan_id: input.workflow_plan_id ?? null,
      definition: null,
      builder_selection: null,
      default_plan: null,
      dependency_plan: null,
      policy_context: null,
      write_policy_gate: null,
      child_packet_plans: null,
      blockers: ['Missing active packet definition.'],
      warnings,
      issues,
      trace: traceEntries,
    };

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_PLANNING_COORDINATOR_ID,
      coordinator_kind: 'workflow',
      value: plan,
      issues,
      trace: [
        ...traceEntries,
        planningTrace({
          step_id: 'planning.operation.resolve',
          status: 'blocked',
          notes: `Trusted operation plan blocked because no definition resolved for ${input.packet_type ?? operationKind}.`,
        }),
      ],
    });
  }

  const packetType = input.packet_type ?? definition.packet_type;
  const packetSubtype = input.packet_subtype ?? definition.default_subtype ?? null;
  const actionIds = inferActionIds({
    definition,
    operation_kind: operationKind,
    explicit_action_ids: input.action_ids,
  });
  const missingParts = missingDefinitionParts(definition);

  if (missingParts.length > 0) {
    issues.push(issueForMissingParts({
      packet_type: definition.packet_type,
      missing_parts: missingParts,
    }));
    blockers.push(`Missing required Definition parts: ${missingParts.join(', ')}.`);
  }

  const builderResult = selectTrustedBuilderDescriptor({
    ...input,
    definition,
    definitions,
    packet_type: packetType,
    packet_subtype: packetSubtype,
    operation_kind: operationKind,
    action_ids: actionIds,
  });
  issues.push(...builderResult.issues);
  traceEntries.push(...builderResult.trace);
  blockers.push(...(builderResult.value?.blockers ?? []));
  warnings.push(...(builderResult.value?.warnings ?? []));

  const defaultResult = input.include_defaults === false
    ? null
    : resolveTrustedDefaultPlan({
        ...input,
        definition,
        definitions,
        packet_type: packetType,
        packet_subtype: packetSubtype,
        operation_kind: operationKind,
      });
  if (defaultResult) {
    issues.push(...defaultResult.issues);
    traceEntries.push(...defaultResult.trace);
    blockers.push(...(defaultResult.value?.blockers ?? []));
    warnings.push(...(defaultResult.value?.warnings ?? []));
  }

  const dependencyResult = input.include_dependencies === false
    ? null
    : resolveTrustedDependencyPlan({
        ...input,
        definition,
        definitions,
        packet_type: packetType,
        packet_subtype: packetSubtype,
        operation_kind: operationKind,
      });
  if (dependencyResult) {
    issues.push(...dependencyResult.issues);
    traceEntries.push(...dependencyResult.trace);
    blockers.push(...(dependencyResult.value?.blockers ?? []));
    warnings.push(...(dependencyResult.value?.warnings ?? []));
  }

  const policyResult = input.include_regulation === false
    ? null
    : trustedRegulationCoordinator.resolvePolicyContext({
        ...input,
        definition,
        definitions,
        packet_type: packetType,
        packet_subtype: packetSubtype,
        operation_kind: operationKind,
        context_mode: contextMode,
      });
  if (policyResult) {
    issues.push(...policyResult.issues);
    traceEntries.push(...policyResult.trace);
  }

  const gateActionIds = actionIds.filter(isMutationActionId);
  const writePolicyGateResult = input.include_regulation === false || input.include_write_policy_gate !== true || gateActionIds.length === 0
    ? null
    : trustedRegulationCoordinator.resolveWritePolicyGate({
        ...input,
        definition,
        definitions,
        packet_type: packetType,
        packet_subtype: packetSubtype,
        operation_kind: operationKind,
        context_mode: contextMode,
        action_ids: gateActionIds,
      });
  if (writePolicyGateResult) {
    issues.push(...writePolicyGateResult.issues);
    traceEntries.push(...writePolicyGateResult.trace);
    if (writePolicyGateResult.value?.satisfied === false) {
      blockers.push(...writePolicyGateResult.value.action_ids.map((actionId) => `Write policy gate blocks ${actionId}.`));
    }
  }

  const childResult = resolveTrustedChildPacketPlans({
    ...input,
    definition,
    definitions,
    packet_type: packetType,
    packet_subtype: packetSubtype,
    operation_kind: operationKind,
    depth: input.depth ?? 0,
    max_depth: input.max_depth ?? 3,
  });
  issues.push(...childResult.issues);
  traceEntries.push(...childResult.trace);
  blockers.push(...(childResult.value?.blockers ?? []));
  warnings.push(...(childResult.value?.warnings ?? []));

  const cleanBlockers = uniqueSorted(blockers);
  const cleanWarnings = uniqueSorted(warnings);
  const plan: TrustedOperationPlan = {
    plan_kind: 'trusted.operation_plan',
    plan_id: `trusted.operation_plan.${packetType}.${packetSubtype ?? 'default'}.${operationKind}`,
    context_mode: contextMode,
    node_element_id: input.node_element_id ?? null,
    packet_type: packetType,
    packet_subtype: packetSubtype,
    operation_kind: operationKind,
    action_ids: actionIds,
    workflow_plan_id: input.workflow_plan_id ?? null,
    definition,
    builder_selection: builderResult.value,
    default_plan: defaultResult?.value ?? null,
    dependency_plan: dependencyResult?.value ?? null,
    policy_context: policyResult?.value ?? null,
    write_policy_gate: writePolicyGateResult?.value ?? null,
    child_packet_plans: childResult.value,
    blockers: cleanBlockers,
    warnings: cleanWarnings,
    issues,
    trace: traceEntries,
  };

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_PLANNING_COORDINATOR_ID,
    coordinator_kind: 'workflow',
    value: plan,
    issues,
    trace: [
      ...traceEntries,
      planningTrace({
        step_id: 'planning.operation.resolve',
        status: cleanBlockers.length > 0 || issues.some((issue) => issue.severity === 'error')
          ? 'blocked'
          : cleanWarnings.length > 0 || issues.length > 0
            ? 'partial'
            : 'ok',
        notes: `Resolved trusted operation plan for ${packetType}.${packetSubtype ?? '*'} with ${actionIds.length} action binding(s).`,
      }),
    ],
  });
}
