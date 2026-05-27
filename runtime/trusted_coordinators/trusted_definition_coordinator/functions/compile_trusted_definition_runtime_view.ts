/**
 * File: compile_trusted_definition_runtime_view.ts
 * Description: Compiles coordinator-facing trusted definition runtime views for reseed and runtime readiness checks.
 */

import type { PacketTypeDefinition } from '@core/packets/definitions/packet-definition-types.ts';
import type { PacketTypeBodyCandidate } from '@core/packets/packet-type-body-builders.ts';
import {
  trustedBuildingCoordinator,
} from '@runtime/trusted_coordinators/trusted_building_coordinator/index.ts';
import {
  trustedRegulationCoordinator,
} from '@runtime/trusted_coordinators/trusted_regulation_coordinator/index.ts';
import {
  trustedPlanningCoordinator,
} from '@runtime/trusted_coordinators/trusted_planning_coordinator/index.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_DEFINITION_COORDINATOR_ID,
  type CompileTrustedDefinitionRuntimeViewInput,
  type CompileTrustedDefinitionRuntimeViewsInput,
  type TrustedDefinitionRuntimeView,
  type TrustedDefinitionRuntimeViewSet,
} from '../trusted_definition_types.ts';
import { definitionTrace } from '../trusted_definition_internal.ts';
import { resolveTrustedPacketDefinition } from './resolve_trusted_packet_definition.ts';
import { listTrustedPacketDefinitions } from './list_trusted_packet_definitions.ts';

function candidateHasErrors(candidateResultIssues: readonly TrustedRuntimeCoordinatorIssue[]): boolean {
  return candidateResultIssues.some((issue) => issue.severity === 'error');
}

function hasDefinitionPartCandidate(input: {
  candidates: readonly PacketTypeBodyCandidate[];
  partSubtype: string;
}): boolean {
  return input.candidates.some(
    (candidate) => candidate.packet_type === 'Definition' && candidate.packet_subtype === input.partSubtype
  );
}

function requiredPartCountForDefinition(definition: PacketTypeDefinition): number {
  return (definition.packet_definition_parts ?? []).filter((part) => part.required).length;
}

function compileForDefinition(input: {
  definition: PacketTypeDefinition;
  allDefinitions?: readonly PacketTypeDefinition[];
  inheritedIssues: readonly TrustedRuntimeCoordinatorIssue[];
  inheritedTrace: readonly TrustedRuntimeCoordinatorTraceEntry[];
}): TrustedRuntimeCoordinatorResult<TrustedDefinitionRuntimeView> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [...input.inheritedIssues];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [...input.inheritedTrace];
  const regulationResult = trustedRegulationCoordinator.resolveContext({
    definition: input.definition,
    definitions: input.allDefinitions ?? [input.definition],
    packet_type: input.definition.packet_type,
    packet_subtype: input.definition.default_subtype,
    operation_kind: 'reseed',
    context_mode: 'reseed',
  });
  const planningResult = trustedPlanningCoordinator.resolveOperationPlan({
    definition: input.definition,
    definitions: input.allDefinitions ?? [input.definition],
    packet_type: input.definition.packet_type,
    packet_subtype: input.definition.default_subtype,
    operation_kind: 'reseed',
    context_mode: 'reseed',
    include_write_policy_gate: false,
  });
  const buildResult = trustedBuildingCoordinator.buildDefinitionPartCandidates({ definition: input.definition });

  issues.push(...regulationResult.issues, ...planningResult.issues, ...buildResult.issues);
  traceEntries.push(...regulationResult.trace, ...planningResult.trace, ...buildResult.trace);

  if (!regulationResult.value || !planningResult.value || !buildResult.value) {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
      coordinator_kind: 'workflow',
      value: null,
      issues,
      trace: traceEntries,
    });
  }

  const hasProjectionCandidate = hasDefinitionPartCandidate({
    candidates: buildResult.value.candidates,
    partSubtype: 'packet_projection_descriptor',
  });
  const hasBuilderCandidate = hasDefinitionPartCandidate({
    candidates: buildResult.value.candidates,
    partSubtype: 'packet_builder_descriptor',
  });
  const hasDefaultsCandidate = hasDefinitionPartCandidate({
    candidates: buildResult.value.candidates,
    partSubtype: 'defaults_definition',
  });
  const hasDependenciesCandidate = hasDefinitionPartCandidate({
    candidates: buildResult.value.candidates,
    partSubtype: 'dependencies_definition',
  });

  if (!hasProjectionCandidate) {
    issues.push(trustedIssue({
      severity: 'warning',
      code: 'projection_definition_candidate_missing',
      path: `${input.definition.packet_type}.packet_projection_descriptor`,
      message: `${input.definition.packet_type} does not currently build a packet projection Definition candidate.`,
    }));
  }

  const readyForReseed =
    !candidateHasErrors(issues) &&
    buildResult.value.candidates.length >= requiredPartCountForDefinition(input.definition) &&
    hasBuilderCandidate &&
    hasDefaultsCandidate &&
    hasDependenciesCandidate &&
    hasProjectionCandidate &&
    planningResult.value.blockers.length === 0;

  traceEntries.push(
    definitionTrace({
      step_id: 'definition.runtime_view.compile',
      status: readyForReseed ? 'ok' : issues.some((issue) => issue.severity === 'error') ? 'error' : 'partial',
      notes: `${input.definition.packet_type} trusted definition runtime view ${readyForReseed ? 'is' : 'is not'} ready for reseed packaging.`,
    })
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
    coordinator_kind: 'workflow',
    value: {
      view_kind: 'trusted.definition_runtime_view',
      packet_type: input.definition.packet_type,
      schema_version: input.definition.current_schema_version,
      action_count: input.definition.actions.length,
      builder_count: input.definition.builders.length,
      planner_count: input.definition.planners.length,
      workflow_plan_count: input.definition.workflow_plans?.length ?? 0,
      projection_count: input.definition.projections.length,
      index_count: input.definition.indexes.length,
      definition_part_count: input.definition.packet_definition_parts?.length ?? 0,
      required_definition_part_count: requiredPartCountForDefinition(input.definition),
      regulation_profile: regulationResult.value,
      planning_profile: planningResult.value,
      definition_part_build_plan: buildResult.value,
      ready_for_reseed: readyForReseed,
    },
    issues,
    trace: traceEntries,
  });
}

export function compileTrustedDefinitionRuntimeView(
  input: CompileTrustedDefinitionRuntimeViewInput
): TrustedRuntimeCoordinatorResult<TrustedDefinitionRuntimeView> {
  const definitionResult = resolveTrustedPacketDefinition(input);

  if (!definitionResult.value) {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
      coordinator_kind: 'workflow',
      value: null,
      issues: definitionResult.issues,
      trace: definitionResult.trace,
    });
  }

  return compileForDefinition({
    definition: definitionResult.value,
    inheritedIssues: definitionResult.issues,
    inheritedTrace: definitionResult.trace,
  });
}

export function compileTrustedDefinitionRuntimeViews(
  input: CompileTrustedDefinitionRuntimeViewsInput = {}
): TrustedRuntimeCoordinatorResult<TrustedDefinitionRuntimeViewSet> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const views: TrustedDefinitionRuntimeView[] = [];

  const definitionsResult = listTrustedPacketDefinitions(input);
  issues.push(...definitionsResult.issues);
  traceEntries.push(...definitionsResult.trace);

  if (!definitionsResult.value) {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
      coordinator_kind: 'workflow',
      value: null,
      issues,
      trace: traceEntries,
    });
  }

  for (const definition of definitionsResult.value) {
    const result = compileForDefinition({
      definition,
      allDefinitions: definitionsResult.value,
      inheritedIssues: [],
      inheritedTrace: [],
    });

    issues.push(...result.issues);
    traceEntries.push(...result.trace);

    if (result.value) {
      views.push(result.value);
    }
  }

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
    coordinator_kind: 'workflow',
    value: {
      view_set_kind: 'trusted.definition_runtime_view_set',
      manifest_version: 'trusted_definition_context.v0',
      view_count: views.length,
      ready_view_count: views.filter((view) => view.ready_for_reseed).length,
      views,
    },
    issues,
    trace: traceEntries,
  });
}
