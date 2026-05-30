/**
 * File: packet-workflow-planner.ts
 * Description: Definition-mode declarative workflow planner contract for packet-definition driven generic operations.
 */

import {
  getPacketOperationDefinition,
  type PacketOperationKind,
} from '@core/packets/packet-operation-ontology.ts';
import type { PacketTypeDefinition } from '@core/packets/definitions/packet-definition-types.ts';
import { listResolutionDslPresets } from '@core/packets/resolution-dsl.ts';
import type {
  ResolutionConditionDescriptor,
  ResolutionValueBinding,
} from '@core/packets/resolution-dsl.ts';

export type PacketWorkflowAvailability = 'runtime_ready' | 'canonical';

export type PacketWorkflowValueBinding = ResolutionValueBinding;

export type PacketWorkflowConditionDescriptor = ResolutionConditionDescriptor;

export type PacketWorkflowOperationStepDescriptor = {
  step_id: string;
  step_kind: 'operation';
  operation_kind: PacketOperationKind;
  packet_type: string;
  packet_subtype: string | null;
  resolver_ids: readonly string[];
  resolver_preset_ids?: readonly string[];
  input_bindings: Readonly<Record<string, PacketWorkflowValueBinding>>;
  policy_action_ids: readonly string[];
  dependency_ids: readonly string[];
  output_key: string;
  on_failure: 'abort_workflow' | 'skip_step';
  notes: string;
};

export type PacketWorkflowConditionStepDescriptor = {
  step_id: string;
  step_kind: 'condition';
  condition: PacketWorkflowConditionDescriptor;
  then_steps: readonly PacketWorkflowStepDescriptor[];
  else_steps: readonly PacketWorkflowStepDescriptor[];
  output_key?: string;
  on_failure: 'abort_workflow' | 'skip_step';
  notes: string;
};

export type PacketWorkflowStepDescriptor =
  | PacketWorkflowOperationStepDescriptor
  | PacketWorkflowConditionStepDescriptor;

export type PacketWorkflowResolverDescriptor = {
  resolver_id: string;
  resolver_kind:
    | 'actor_ref'
    | 'packet_ref_lookup'
    | 'existing_active_relation_lookup'
    | 'target_summary_lookup'
    | 'current_projection_lookup'
    | 'discussion_parent_thread_lookup'
    | 'role_scope_lookup'
    | 'compatibility_projection_lookup'
    | 'input_value'
    | 'static_value'
    | 'preset';
  availability: PacketWorkflowAvailability;
  notes: string;
};

export type TrustedPlannerCapabilityDescriptor = {
  capability_id: string;
  capability_kind:
    | 'planner'
    | 'resolver'
    | 'builder'
    | 'projection'
    | 'compatibility_bridge';
  source_module: string;
  dependency_ids: readonly string[];
  notes: string;
};

export type PacketWorkflowPlanDescriptor = {
  workflow_plan_id: string;
  packet_type: string;
  packet_subtype: string | null;
  planner_id: string;
  mutation_intents: readonly string[];
  operation_kinds: readonly PacketOperationKind[];
  resolver_ids: readonly string[];
  resolver_preset_ids?: readonly string[];
  policy_action_ids: readonly string[];
  dependency_ids: readonly string[];
  steps: readonly PacketWorkflowStepDescriptor[];
  availability: PacketWorkflowAvailability;
  notes: string;
};

export type PacketWorkflowAuditFinding = {
  severity: 'error' | 'warning';
  code: string;
  packet_type: string;
  workflow_plan_id: string;
  path: string;
  message: string;
};

export type PacketWorkflowAuditReport = {
  status: 'pass' | 'fail';
  packet_type: string;
  workflow_plan_id: string;
  checked_step_ids: string[];
  findings: PacketWorkflowAuditFinding[];
};

export type PacketWorkflowDryRunStep = {
  step_id: string;
  step_kind: PacketWorkflowStepDescriptor['step_kind'];
  operation_kind: PacketOperationKind | null;
  packet_type: string | null;
  packet_subtype: string | null;
  policy_action_ids: string[];
  dependency_ids: string[];
  resolver_ids: string[];
  resolver_preset_ids: string[];
  output_key: string | null;
};

export type PacketWorkflowDryRunPlan = {
  dry_run_kind: 'packet.workflow_plan.runtime_dry_run';
  packet_type: string;
  workflow_plan_id: string;
  mutation_intents: string[];
  operation_kinds: PacketOperationKind[];
  step_order: string[];
  steps: PacketWorkflowDryRunStep[];
  policy_action_ids: string[];
  dependency_ids: string[];
  resolver_ids: string[];
  resolver_preset_ids: string[];
  ready_for_interpretation: boolean;
  findings: PacketWorkflowAuditFinding[];
};

export const PACKET_WORKFLOW_PLANNER_CAPABILITIES = [
  {
    resolver_id: 'actor.ref',
    resolver_kind: 'actor_ref',
    availability: 'runtime_ready',
    notes: 'Binds the claimed runtime actor packet ref into a workflow input.',
  },
  {
    resolver_id: 'input.packet_ref',
    resolver_kind: 'packet_ref_lookup',
    availability: 'runtime_ready',
    notes: 'Validates and binds packet refs supplied by a runtime request.',
  },
  {
    resolver_id: 'input.value',
    resolver_kind: 'input_value',
    availability: 'runtime_ready',
    notes: 'Binds scalar or object values supplied by a runtime request.',
  },
  {
    resolver_id: 'static.value',
    resolver_kind: 'static_value',
    availability: 'runtime_ready',
    notes: 'Binds definition-declared constants into a workflow input.',
  },
  {
    resolver_id: 'resolution.preset',
    resolver_kind: 'preset',
    availability: 'runtime_ready',
    notes: 'Binds standard resolution DSL presets into a trusted coordinator workflow.',
  },
  {
    resolver_id: 'relation.active_lookup',
    resolver_kind: 'existing_active_relation_lookup',
    availability: 'runtime_ready',
    notes: 'Looks up an existing active relation before set/clear planning.',
  },
  {
    resolver_id: 'reaction.target_summary',
    resolver_kind: 'target_summary_lookup',
    availability: 'runtime_ready',
    notes: 'Loads a target summary needed by reaction planners.',
  },
  {
    resolver_id: 'projection.current',
    resolver_kind: 'current_projection_lookup',
    availability: 'runtime_ready',
    notes: 'Reads current projection state for no-op and supersedes planning.',
  },
  {
    resolver_id: 'discussion.parent_thread',
    resolver_kind: 'discussion_parent_thread_lookup',
    availability: 'runtime_ready',
    notes: 'Resolves discussion reply parent, thread, forum, and scope context.',
  },
  {
    resolver_id: 'role.scope',
    resolver_kind: 'role_scope_lookup',
    availability: 'runtime_ready',
    notes: 'Resolves the governing scope for role participation relation planning.',
  },
  {
    resolver_id: 'compatibility.projection',
    resolver_kind: 'compatibility_projection_lookup',
    availability: 'runtime_ready',
    notes: 'Describes compatibility projection support while legacy surfaces remain present.',
  },
] as const satisfies readonly PacketWorkflowResolverDescriptor[];

export const TRUSTED_PACKET_PLANNER_CAPABILITIES = [
  {
    capability_id: 'runtime.planner.scoped_relation',
    capability_kind: 'planner',
    source_module: 'runtime/nexus/server/elemental-scope-relation-planner.ts',
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.policy_gate',
      'generic.operation.relation',
      'generic.resolver.relation_lookup',
      'generic.compatibility_projection',
    ],
    notes:
      'Existing local planner for association, residence, follow, and role participation relation packets.',
  },
  {
    capability_id: 'runtime.planner.discussion_reply',
    capability_kind: 'planner',
    source_module: 'runtime/nexus/server/discussion-service.ts',
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.policy_gate',
      'generic.operation.discussion',
      'generic.resolver.discussion_thread',
    ],
    notes:
      'Existing local discussion reply prepare path, awaiting extraction into a reusable discussion reply planner.',
  },
  {
    capability_id: 'runtime.resolver.role_scope',
    capability_kind: 'resolver',
    source_module: 'runtime/nexus/server/elemental-scope-relation-planner.ts',
    dependency_ids: [
      'runtime.packet_store.read',
      'generic.resolver.role_scope',
    ],
    notes:
      'Existing role participation relation resolver for authority scope and applicable scope refs.',
  },
  {
    capability_id: 'runtime.resolver.target_summary',
    capability_kind: 'resolver',
    source_module: 'runtime/nexus/server/reaction-service.ts',
    dependency_ids: [
      'runtime.packet_store.read',
      'generic.resolver.target_summary',
    ],
    notes:
      'Existing packet-signal target summary dependency used by Reaction planning.',
  },
  {
    capability_id: 'runtime.projection.compatibility',
    capability_kind: 'compatibility_bridge',
    source_module: 'runtime/nexus/server/scope-graph-compatibility.ts',
    dependency_ids: [
      'generic.compatibility_projection',
      'generic.operation.projection',
    ],
    notes:
      'Existing compatibility projection bridge for legacy claim/relation surfaces while canonical relations settle.',
  },
  {
    capability_id: 'runtime.planner.preference_element',
    capability_kind: 'planner',
    source_module: 'runtime/nexus/server/preference-runtime-connectors.ts',
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.policy_gate',
      'generic.preference.builder',
      'generic.preference.latest_active_planner',
      'runtime.scope_display_projection',
      'runtime.shell_chrome_projection',
    ],
    notes:
      'Trusted local Preference.element planner for latest-active interface preference revisions and compatibility-cache projection.',
  },
] as const satisfies readonly TrustedPlannerCapabilityDescriptor[];

export const PACKET_WORKFLOW_DEPENDENCY_IDS = [
  'runtime.trusted_coordinator.resolution',
  'runtime.packet_store.read',
  'runtime.policy_gate',
  'generic.operation.relation',
  'generic.operation.claim',
  'generic.operation.reaction',
  'generic.operation.discussion',
  'generic.operation.projection',
  'generic.resolver.actor_ref',
  'generic.resolver.packet_ref',
  'generic.resolver.input_value',
  'generic.resolver.static_value',
  'generic.resolver.relation_lookup',
  'generic.resolver.target_summary',
  'generic.resolver.discussion_thread',
  'generic.resolver.role_scope',
  'generic.resolver.projection',
  'generic.resolver.resolution_preset',
  'generic.compatibility_projection',
  'generic.preference.builder',
  'generic.preference.latest_active_planner',
  'runtime.scope_display_projection',
  'runtime.shell_chrome_projection',
  'runtime.discussion_service.read',
  'runtime.planner.scoped_relation',
  'runtime.planner.discussion_reply',
  'runtime.planner.preference_element',
] as const;

export const PACKET_WORKFLOW_POLICY_ACTION_IDS = [
  'reaction.vote.set',
  'reaction.vote.clear',
  'relation.participation.add',
  'relation.participation.clear',
  'reaction.attestation.set',
  'reaction.attestation.clear',
  'relation.follow.add',
  'relation.follow.clear',
  'relation.association.add',
  'relation.association.clear',
  'relation.residence.add',
  'relation.residence.clear',
  'discussion.reply.create',
  'relation.generic.write',
  'discussion.generic.write',
  'claim.generic.write',
  'reaction.generic.write',
  'preference.element.write',
  'definition.part.write',
  'bundle.packet_set.write',
  'bundle.packet_set.import',
  'bundle.packet_set.export',
] as const;

const RESOLVER_IDS = new Set<string>(
  PACKET_WORKFLOW_PLANNER_CAPABILITIES.map((capability) => capability.resolver_id)
);
const RESOLVER_PRESET_IDS = new Set<string>(
  listResolutionDslPresets().map((preset) => preset.preset_id)
);
const DEPENDENCY_IDS = new Set<string>(PACKET_WORKFLOW_DEPENDENCY_IDS);
const POLICY_ACTION_IDS = new Set<string>(PACKET_WORKFLOW_POLICY_ACTION_IDS);
const CONDITION_KINDS = new Set([
  'equals',
  'not_equals',
  'present',
  'absent',
]);

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function getWorkflowPlans(definition: PacketTypeDefinition): readonly PacketWorkflowPlanDescriptor[] {
  return definition.workflow_plans ?? [];
}

export function listPacketWorkflowPlannerCapabilities(): PacketWorkflowResolverDescriptor[] {
  return [...PACKET_WORKFLOW_PLANNER_CAPABILITIES];
}

export function listTrustedPacketPlannerCapabilities(): TrustedPlannerCapabilityDescriptor[] {
  return [...TRUSTED_PACKET_PLANNER_CAPABILITIES];
}

export function listPacketWorkflowPlanDescriptorsFromDefinitions(input: {
  definitions: readonly PacketTypeDefinition[];
  packetType?: string | null;
}): PacketWorkflowPlanDescriptor[] {
  return input.definitions
    .filter(
      (definition) =>
        !input.packetType || definition.packet_type === input.packetType
    )
    .flatMap((definition) => [...getWorkflowPlans(definition)]);
}

export function getPacketWorkflowPlanDescriptorFromDefinitions(input: {
  definitions: readonly PacketTypeDefinition[];
  packetType: string;
  workflowPlanId: string;
}): PacketWorkflowPlanDescriptor | null {
  return (
    listPacketWorkflowPlanDescriptorsFromDefinitions({
      definitions: input.definitions,
      packetType: input.packetType,
    }).find((plan) => plan.workflow_plan_id === input.workflowPlanId) ?? null
  );
}

function pushFinding(input: {
  findings: PacketWorkflowAuditFinding[];
  definition: PacketTypeDefinition;
  workflowPlan: PacketWorkflowPlanDescriptor;
  code: string;
  path: string;
  message: string;
}): void {
  input.findings.push({
    severity: 'error',
    packet_type: input.definition.packet_type,
    workflow_plan_id: input.workflowPlan.workflow_plan_id,
    code: input.code,
    path: input.path,
    message: input.message,
  });
}

function validateBinding(input: {
  binding: PacketWorkflowValueBinding;
  path: string;
  availableStepIds: Set<string>;
  findings: PacketWorkflowAuditFinding[];
  definition: PacketTypeDefinition;
  workflowPlan: PacketWorkflowPlanDescriptor;
}): void {
  if (input.binding.binding_kind !== 'step_output') {
    return;
  }

  if (input.availableStepIds.has(input.binding.step_id)) {
    return;
  }

  pushFinding({
    findings: input.findings,
    definition: input.definition,
    workflowPlan: input.workflowPlan,
    code: 'unknown_workflow_step_output_reference',
    path: input.path,
    message: `Workflow binding references unknown or later step ${input.binding.step_id}.`,
  });
}

function validateCondition(input: {
  condition: PacketWorkflowConditionDescriptor;
  path: string;
  availableStepIds: Set<string>;
  findings: PacketWorkflowAuditFinding[];
  definition: PacketTypeDefinition;
  workflowPlan: PacketWorkflowPlanDescriptor;
}): void {
  if (!CONDITION_KINDS.has(input.condition.condition_kind)) {
    pushFinding({
      findings: input.findings,
      definition: input.definition,
      workflowPlan: input.workflowPlan,
      code: 'unknown_workflow_condition_kind',
      path: `${input.path}.condition_kind`,
      message: `Workflow condition uses unsupported operator ${input.condition.condition_kind}.`,
    });
  }

  validateBinding({
    binding: input.condition.left,
    path: `${input.path}.left`,
    availableStepIds: input.availableStepIds,
    findings: input.findings,
    definition: input.definition,
    workflowPlan: input.workflowPlan,
  });

  if (input.condition.right) {
    validateBinding({
      binding: input.condition.right,
      path: `${input.path}.right`,
      availableStepIds: input.availableStepIds,
      findings: input.findings,
      definition: input.definition,
      workflowPlan: input.workflowPlan,
    });
  }
}

function auditSteps(input: {
  steps: readonly PacketWorkflowStepDescriptor[];
  path: string;
  availableStepIds: Set<string>;
  seenStepIds: Set<string>;
  checkedStepIds: string[];
  findings: PacketWorkflowAuditFinding[];
  definition: PacketTypeDefinition;
  workflowPlan: PacketWorkflowPlanDescriptor;
}): void {
  for (const step of input.steps) {
    const stepPath = `${input.path}.${step.step_id}`;

    if (input.seenStepIds.has(step.step_id)) {
      pushFinding({
        findings: input.findings,
        definition: input.definition,
        workflowPlan: input.workflowPlan,
        code: 'duplicate_workflow_step_id',
        path: stepPath,
        message: `Duplicate workflow step id ${step.step_id}.`,
      });
    }

    input.seenStepIds.add(step.step_id);
    input.checkedStepIds.push(step.step_id);

    if (step.step_kind === 'operation') {
      if (!getPacketOperationDefinition(step.operation_kind)) {
        pushFinding({
          findings: input.findings,
          definition: input.definition,
          workflowPlan: input.workflowPlan,
          code: 'unknown_workflow_operation_kind',
          path: `${stepPath}.operation_kind`,
          message: `Workflow step ${step.step_id} references unknown operation ${step.operation_kind}.`,
        });
      }

      for (const resolverId of step.resolver_ids) {
        if (RESOLVER_IDS.has(resolverId)) {
          continue;
        }

        pushFinding({
          findings: input.findings,
          definition: input.definition,
          workflowPlan: input.workflowPlan,
          code: 'unknown_workflow_resolver_id',
          path: `${stepPath}.resolver_ids`,
          message: `Workflow step ${step.step_id} references unknown resolver ${resolverId}.`,
        });
      }

      for (const presetId of step.resolver_preset_ids ?? []) {
        if (RESOLVER_PRESET_IDS.has(presetId)) {
          continue;
        }

        pushFinding({
          findings: input.findings,
          definition: input.definition,
          workflowPlan: input.workflowPlan,
          code: 'unknown_workflow_resolver_preset_id',
          path: `${stepPath}.resolver_preset_ids`,
          message: `Workflow step ${step.step_id} references unknown resolver preset ${presetId}.`,
        });
      }

      for (const dependencyId of step.dependency_ids) {
        if (DEPENDENCY_IDS.has(dependencyId)) {
          continue;
        }

        pushFinding({
          findings: input.findings,
          definition: input.definition,
          workflowPlan: input.workflowPlan,
          code: 'unknown_workflow_dependency_id',
          path: `${stepPath}.dependency_ids`,
          message: `Workflow step ${step.step_id} references unknown dependency ${dependencyId}.`,
        });
      }

      for (const policyActionId of step.policy_action_ids) {
        if (
          POLICY_ACTION_IDS.has(policyActionId) &&
          input.workflowPlan.policy_action_ids.includes(policyActionId)
        ) {
          continue;
        }

        pushFinding({
          findings: input.findings,
          definition: input.definition,
          workflowPlan: input.workflowPlan,
          code: 'unknown_workflow_policy_action_id',
          path: `${stepPath}.policy_action_ids`,
          message: `Workflow step ${step.step_id} references undeclared or unknown policy action ${policyActionId}.`,
        });
      }

      for (const [bindingKey, binding] of Object.entries(step.input_bindings)) {
        validateBinding({
          binding,
          path: `${stepPath}.input_bindings.${bindingKey}`,
          availableStepIds: input.availableStepIds,
          findings: input.findings,
          definition: input.definition,
          workflowPlan: input.workflowPlan,
        });
      }
    } else {
      validateCondition({
        condition: step.condition,
        path: `${stepPath}.condition`,
        availableStepIds: input.availableStepIds,
        findings: input.findings,
        definition: input.definition,
        workflowPlan: input.workflowPlan,
      });

      auditSteps({
        ...input,
        steps: step.then_steps,
        path: `${stepPath}.then_steps`,
        availableStepIds: new Set(input.availableStepIds),
      });
      auditSteps({
        ...input,
        steps: step.else_steps,
        path: `${stepPath}.else_steps`,
        availableStepIds: new Set(input.availableStepIds),
      });
    }

    input.availableStepIds.add(step.step_id);
  }
}

export function auditPacketWorkflowPlanDescriptor(
  definition: PacketTypeDefinition,
  workflowPlan: PacketWorkflowPlanDescriptor
): PacketWorkflowAuditReport {
  const findings: PacketWorkflowAuditFinding[] = [];
  const checkedStepIds: string[] = [];

  if (workflowPlan.packet_type !== definition.packet_type) {
    pushFinding({
      findings,
      definition,
      workflowPlan,
      code: 'workflow_packet_type_mismatch',
      path: 'packet_type',
      message: `Workflow plan ${workflowPlan.workflow_plan_id} defines ${workflowPlan.packet_type}, not ${definition.packet_type}.`,
    });
  }

  if (
    workflowPlan.packet_subtype !== null &&
    !definition.declared_subtypes.includes(workflowPlan.packet_subtype)
  ) {
    pushFinding({
      findings,
      definition,
      workflowPlan,
      code: 'workflow_unknown_packet_subtype',
      path: 'packet_subtype',
      message: `Workflow plan ${workflowPlan.workflow_plan_id} references undeclared subtype ${workflowPlan.packet_subtype}.`,
    });
  }

  for (const operationKind of workflowPlan.operation_kinds) {
    if (getPacketOperationDefinition(operationKind)) {
      continue;
    }

    pushFinding({
      findings,
      definition,
      workflowPlan,
      code: 'unknown_workflow_operation_kind',
      path: 'operation_kinds',
      message: `Workflow plan references unknown operation ${operationKind}.`,
    });
  }

  for (const resolverId of workflowPlan.resolver_ids) {
    if (RESOLVER_IDS.has(resolverId)) {
      continue;
    }

    pushFinding({
      findings,
      definition,
      workflowPlan,
      code: 'unknown_workflow_resolver_id',
      path: 'resolver_ids',
      message: `Workflow plan references unknown resolver ${resolverId}.`,
    });
  }

  for (const presetId of workflowPlan.resolver_preset_ids ?? []) {
    if (RESOLVER_PRESET_IDS.has(presetId)) {
      continue;
    }

    pushFinding({
      findings,
      definition,
      workflowPlan,
      code: 'unknown_workflow_resolver_preset_id',
      path: 'resolver_preset_ids',
      message: `Workflow plan references unknown resolver preset ${presetId}.`,
    });
  }

  for (const dependencyId of workflowPlan.dependency_ids) {
    if (DEPENDENCY_IDS.has(dependencyId)) {
      continue;
    }

    pushFinding({
      findings,
      definition,
      workflowPlan,
      code: 'unknown_workflow_dependency_id',
      path: 'dependency_ids',
      message: `Workflow plan references unknown dependency ${dependencyId}.`,
    });
  }

  for (const policyActionId of workflowPlan.policy_action_ids) {
    if (POLICY_ACTION_IDS.has(policyActionId)) {
      continue;
    }

    pushFinding({
      findings,
      definition,
      workflowPlan,
      code: 'unknown_workflow_policy_action_id',
      path: 'policy_action_ids',
      message: `Workflow plan references unknown policy action ${policyActionId}.`,
    });
  }

  auditSteps({
    steps: workflowPlan.steps,
    path: 'steps',
    availableStepIds: new Set<string>(),
    seenStepIds: new Set<string>(),
    checkedStepIds,
    findings,
    definition,
    workflowPlan,
  });

  return {
    status: findings.some((finding) => finding.severity === 'error')
      ? 'fail'
      : 'pass',
    packet_type: definition.packet_type,
    workflow_plan_id: workflowPlan.workflow_plan_id,
    checked_step_ids: checkedStepIds,
    findings,
  };
}

function flattenSteps(steps: readonly PacketWorkflowStepDescriptor[]): PacketWorkflowDryRunStep[] {
  return steps.flatMap((step): PacketWorkflowDryRunStep[] => {
    if (step.step_kind === 'operation') {
      return [
        {
          step_id: step.step_id,
          step_kind: step.step_kind,
          operation_kind: step.operation_kind,
          packet_type: step.packet_type,
          packet_subtype: step.packet_subtype,
          policy_action_ids: [...step.policy_action_ids],
          dependency_ids: [...step.dependency_ids],
          resolver_ids: [...step.resolver_ids],
          resolver_preset_ids: [...(step.resolver_preset_ids ?? [])],
          output_key: step.output_key,
        },
      ];
    }

    return [
      {
        step_id: step.step_id,
        step_kind: step.step_kind,
        operation_kind: null,
        packet_type: null,
        packet_subtype: null,
        policy_action_ids: [],
        dependency_ids: [],
        resolver_ids: [],
        resolver_preset_ids: [],
        output_key: step.output_key ?? null,
      },
      ...flattenSteps(step.then_steps),
      ...flattenSteps(step.else_steps),
    ];
  });
}

export function resolvePacketWorkflowDryRunPlan(input: {
  definition: PacketTypeDefinition;
  workflowPlanId: string;
}): PacketWorkflowDryRunPlan {
  const workflowPlan =
    getWorkflowPlans(input.definition).find(
      (plan) => plan.workflow_plan_id === input.workflowPlanId
    ) ?? null;

  if (!workflowPlan) {
    return {
      dry_run_kind: 'packet.workflow_plan.runtime_dry_run',
      packet_type: input.definition.packet_type,
      workflow_plan_id: input.workflowPlanId,
      mutation_intents: [],
      operation_kinds: [],
      step_order: [],
      steps: [],
      policy_action_ids: [],
      dependency_ids: [],
      resolver_ids: [],
      ready_for_interpretation: false,
      resolver_preset_ids: [],
      findings: [
        {
          severity: 'error',
          code: 'unknown_workflow_plan',
          packet_type: input.definition.packet_type,
          workflow_plan_id: input.workflowPlanId,
          path: 'workflow_plan_id',
          message: `Unknown workflow plan ${input.workflowPlanId}.`,
        },
      ],
    };
  }

  const audit = auditPacketWorkflowPlanDescriptor(input.definition, workflowPlan);
  const steps = flattenSteps(workflowPlan.steps);

  return {
    dry_run_kind: 'packet.workflow_plan.runtime_dry_run',
    packet_type: input.definition.packet_type,
    workflow_plan_id: workflowPlan.workflow_plan_id,
    mutation_intents: [...workflowPlan.mutation_intents],
    operation_kinds: [...workflowPlan.operation_kinds],
    step_order: steps.map((step) => step.step_id),
    steps,
    policy_action_ids: uniqueSorted([
      ...workflowPlan.policy_action_ids,
      ...steps.flatMap((step) => step.policy_action_ids),
    ]),
    dependency_ids: uniqueSorted([
      ...workflowPlan.dependency_ids,
      ...steps.flatMap((step) => step.dependency_ids),
    ]),
    resolver_ids: uniqueSorted([
      ...workflowPlan.resolver_ids,
      ...steps.flatMap((step) => step.resolver_ids),
    ]),
    resolver_preset_ids: uniqueSorted([
      ...(workflowPlan.resolver_preset_ids ?? []),
      ...steps.flatMap((step) => step.resolver_preset_ids),
    ]),
    ready_for_interpretation: audit.status === 'pass',
    findings: audit.findings,
  };
}
