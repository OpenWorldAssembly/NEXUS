/**
 * File: resolve_trusted_dependency_plan.ts
 * Description: Resolves definition, workflow, and runtime dependency requirements for trusted packet planning.
 */

import {
  listPacketDependencyRequirementDescriptorsFromDefinitions,
  type PacketDependencyRequirementDescriptor,
} from '@core/packets/packet-policy-dependency.ts';
import {
  listPacketDependencySemanticDescriptors,
} from '@core/packets/packet-policy-semantics.ts';
import {
  resolvePacketWorkflowDryRunPlan,
} from '@core/packets/packet-workflow-planner.ts';
import { trustedDefinitionCoordinator } from '@runtime/trusted_coordinators/trusted_definition_coordinator';
import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  createPlanningRequirement,
  missingDefinitionParts,
  planningTrace,
  uniqueSorted,
} from '../trusted_planning_internal.ts';
import {
  TRUSTED_PLANNING_COORDINATOR_ID,
  type ResolveTrustedDependencyPlanInput,
  type TrustedDependencyPlan,
  type TrustedPlanningRequirement,
} from '../trusted_planning_types.ts';

function filterDependencyRequirements(input: {
  requirements: readonly PacketDependencyRequirementDescriptor[];
  packetType?: string | null;
}): PacketDependencyRequirementDescriptor[] {
  return input.requirements.filter(
    (requirement) =>
      !input.packetType ||
      requirement.packet_type === input.packetType ||
      requirement.packet_type === null
  );
}

export function resolveTrustedDependencyPlan(
  input: ResolveTrustedDependencyPlanInput
): TrustedRuntimeCoordinatorResult<TrustedDependencyPlan> {
  const operationKind = input.operation_kind ?? 'dependency_resolution';
  const packetType = input.packet_type ?? input.definition?.packet_type ?? null;
  const definitions = input.definitions ?? (input.definition ? [input.definition] : trustedDefinitionCoordinator.listPacketDefinitions({
    context_mode: input.context_mode ?? 'reseed',
    node_element_id: input.node_element_id,
    preferences: input.preferences,
    packet_type_filters: packetType ? [packetType] : undefined,
  }).value ?? []);
  const packetSubtype = input.packet_subtype ?? input.definition?.default_subtype ?? null;
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];
  const requirements = filterDependencyRequirements({
    requirements: listPacketDependencyRequirementDescriptorsFromDefinitions({ definitions }),
    packetType,
  });
  const semanticDescriptors = listPacketDependencySemanticDescriptors({ definitions }).filter(
    (descriptor) => !packetType || descriptor.packet_type === packetType || descriptor.packet_type === null
  );
  const missingParts = input.definition ? missingDefinitionParts(input.definition) : [];
  const workflowDryRun = input.definition && input.workflow_plan_id
    ? resolvePacketWorkflowDryRunPlan({
        definition: input.definition,
        workflowPlanId: input.workflow_plan_id,
      })
    : null;

  if (workflowDryRun && !workflowDryRun.ready_for_interpretation) {
    blockers.push(`Workflow ${workflowDryRun.workflow_plan_id} is not ready for interpretation.`);
    issues.push(...workflowDryRun.findings.map((finding) => trustedIssue({
      severity: finding.severity,
      code: finding.code,
      path: finding.path,
      message: finding.message,
    })));
  }

  const blockingRequirements: TrustedPlanningRequirement[] = requirements
    .filter((requirement) => !requirement.runtime_metadata_only)
    .map((requirement) => createPlanningRequirement({
      requirement_id: requirement.dependency_id,
      requirement_kind: 'dependency',
      strength: requirement.anchor_kind === 'trusted_runtime_capability' ? 'advisory' : 'blocking',
      source:
        requirement.anchor_kind === 'packet_definition_part'
          ? 'definition_part'
          : requirement.anchor_kind === 'policy_packet_semantics'
            ? 'semantic_descriptor'
            : requirement.anchor_kind === 'workflow_resolver'
              ? 'workflow_plan'
              : requirement.anchor_kind === 'trusted_runtime_capability'
                ? 'trusted_runtime_capability'
                : 'semantic_descriptor',
      packet_type: requirement.packet_type,
      packet_subtype: packetSubtype,
      operation_kind: operationKind,
      notes: requirement.notes,
    }));
  const advisoryRequirements: TrustedPlanningRequirement[] = requirements
    .filter((requirement) => requirement.runtime_metadata_only)
    .map((requirement) => createPlanningRequirement({
      requirement_id: requirement.dependency_id,
      requirement_kind: 'dependency',
      strength: 'advisory',
      source: requirement.anchor_kind === 'workflow_resolver' ? 'workflow_plan' : 'trusted_runtime_capability',
      packet_type: requirement.packet_type,
      packet_subtype: packetSubtype,
      operation_kind: operationKind,
      notes: requirement.notes,
    }));

  if (missingParts.length > 0) {
    warnings.push(`Required Definition parts are missing: ${missingParts.join(', ')}.`);
  }

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_PLANNING_COORDINATOR_ID,
    coordinator_kind: 'dependency',
    value: {
      plan_kind: 'trusted.dependency_plan',
      packet_type: packetType,
      packet_subtype: packetSubtype,
      operation_kind: operationKind,
      workflow_plan_id: input.workflow_plan_id ?? workflowDryRun?.workflow_plan_id ?? null,
      workflow_dry_run: workflowDryRun,
      requirements,
      semantic_descriptors: semanticDescriptors,
      blocking_requirements: blockingRequirements.filter((requirement) => requirement.strength === 'blocking'),
      advisory_requirements: [
        ...advisoryRequirements,
        ...blockingRequirements.filter((requirement) => requirement.strength !== 'blocking'),
      ],
      runtime_metadata_dependency_ids: uniqueSorted(
        requirements
          .filter((requirement) => requirement.runtime_metadata_only)
          .map((requirement) => requirement.dependency_id)
      ),
      packet_backed_dependency_ids: uniqueSorted(
        requirements
          .filter((requirement) => !requirement.runtime_metadata_only)
          .map((requirement) => requirement.dependency_id)
      ),
      missing_required_definition_parts: missingParts,
      blockers,
      warnings,
    },
    issues,
    trace: [
      planningTrace({
        step_id: 'planning.dependencies.resolve',
        status: blockers.length > 0 ? 'blocked' : missingParts.length > 0 ? 'partial' : 'ok',
        preset_ids: ['resolution.dependency_gate.v0'],
        notes: `Resolved ${requirements.length} dependency requirements for ${packetType ?? operationKind}.`,
      }),
    ],
  });
}
