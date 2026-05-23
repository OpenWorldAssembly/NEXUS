/**
 * File: packet-policy-dependency.ts
 * Description: Packet-backed policy and dependency audit descriptors for definition workflow plans.
 */

import { MUTATION_ACTION_IDS } from '@core/auth/write-policy.ts';
import type { PacketDefinitionPartDescriptor, PacketTypeDefinition } from '@core/packets/definitions/packet-definition-types.ts';
import {
  PACKET_WORKFLOW_DEPENDENCY_IDS,
  PACKET_WORKFLOW_POLICY_ACTION_IDS,
  listPacketWorkflowPlanDescriptorsFromDefinitions,
  listTrustedPacketPlannerCapabilities,
  resolvePacketWorkflowDryRunPlan,
  type PacketWorkflowPlanDescriptor,
} from '@core/packets/packet-workflow-planner.ts';
import {
  auditPacketDependencySemanticAuthority,
  resolvePacketDependencySemanticDescriptor,
} from '@core/packets/packet-policy-semantics.ts';

export type PacketPolicyRequirementDescriptor = {
  policy_requirement_id: string;
  policy_action_id: string;
  semantic_anchor:
    | 'policy_packet.write_lock'
    | 'packet_definition.action_registry'
    | 'manifest_runtime_action';
  packet_type: string | null;
  workflow_plan_ids: string[];
  live_write_policy_action: boolean;
  notes: string;
};

export type PacketDependencyRequirementDescriptor = {
  dependency_id: string;
  anchor_kind:
    | 'packet_definition_part'
    | 'policy_packet_semantics'
    | 'trusted_runtime_capability'
    | 'operation_ontology'
    | 'workflow_resolver';
  packet_type: string | null;
  packet_definition_part_ids: string[];
  trusted_capability_ids: string[];
  runtime_metadata_only: boolean;
  notes: string;
};

export type PacketPolicyDependencyAuditFinding = {
  severity: 'error';
  code: string;
  subject_id: string;
  message: string;
};

export type PacketPolicyDependencyAuditReport = {
  status: 'pass' | 'fail';
  checked_workflow_plan_ids: string[];
  checked_policy_action_ids: string[];
  checked_dependency_ids: string[];
  findings: PacketPolicyDependencyAuditFinding[];
};

const PACKET_TYPE_BY_OPERATION_DEPENDENCY: Record<string, string> = {
  'generic.operation.relation': 'Relation',
  'generic.operation.claim': 'Claim',
  'generic.operation.attestation': 'Attestation',
  'generic.operation.discussion': 'Discussion',
  'generic.operation.projection': 'Definition',
  'generic.compatibility_projection': 'Definition',
};

const WORKFLOW_RESOLVER_DEPENDENCY_IDS = new Set([
  'generic.resolver.actor_ref',
  'generic.resolver.packet_ref',
  'generic.resolver.input_value',
  'generic.resolver.static_value',
  'generic.resolver.relation_lookup',
  'generic.resolver.target_summary',
  'generic.resolver.discussion_thread',
  'generic.resolver.role_scope',
  'generic.resolver.projection',
]);

const POLICY_PACKET_DEPENDENCY_IDS = new Set([
  'runtime.policy_gate',
]);

const TRUSTED_RUNTIME_DEPENDENCY_IDS = new Set([
  'runtime.packet_store.read',
  'runtime.discussion_service.read',
  'runtime.planner.scoped_relation',
  'runtime.planner.discussion_reply',
]);

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function getPacketDependencyPart(
  definition: PacketTypeDefinition | null
): PacketDefinitionPartDescriptor | null {
  return (
    definition?.packet_definition_parts?.find(
      (part) => part.part_subtype === 'packet_dependency'
    ) ?? null
  );
}

function getDefinitionByPacketType(
  definitions: readonly PacketTypeDefinition[],
  packetType: string | null
): PacketTypeDefinition | null {
  if (!packetType) {
    return null;
  }

  return definitions.find((definition) => definition.packet_type === packetType) ?? null;
}

function workflowPlansByPolicyAction(
  workflows: readonly PacketWorkflowPlanDescriptor[]
): Map<string, string[]> {
  const planIdsByPolicyAction = new Map<string, string[]>();

  for (const workflow of workflows) {
    for (const policyActionId of workflow.policy_action_ids) {
      planIdsByPolicyAction.set(policyActionId, [
        ...(planIdsByPolicyAction.get(policyActionId) ?? []),
        workflow.workflow_plan_id,
      ]);
    }
  }

  return planIdsByPolicyAction;
}

export function listPacketPolicyRequirementDescriptorsFromDefinitions(input: {
  definitions: readonly PacketTypeDefinition[];
}): PacketPolicyRequirementDescriptor[] {
  const workflows = listPacketWorkflowPlanDescriptorsFromDefinitions({
    definitions: input.definitions,
  });
  const planIdsByPolicyAction = workflowPlansByPolicyAction(workflows);
  const actionPacketType = new Map<string, string>();

  for (const definition of input.definitions) {
    for (const action of definition.actions) {
      if (action.policy_action_id) {
        actionPacketType.set(action.policy_action_id, definition.packet_type);
      }
    }

    for (const planner of definition.planners) {
      for (const policyActionId of planner.policy_action_ids) {
        actionPacketType.set(policyActionId, definition.packet_type);
      }
    }
  }

  return uniqueSorted([
    ...PACKET_WORKFLOW_POLICY_ACTION_IDS,
    ...MUTATION_ACTION_IDS,
  ]).map((policyActionId) => {
    const liveWritePolicyAction = (MUTATION_ACTION_IDS as readonly string[]).includes(
      policyActionId
    );
    const packetType = actionPacketType.get(policyActionId) ?? null;

    return {
      policy_requirement_id: `policy.requirement.${policyActionId}`,
      policy_action_id: policyActionId,
      semantic_anchor: liveWritePolicyAction
        ? 'policy_packet.write_lock'
        : packetType
          ? 'packet_definition.action_registry'
          : 'manifest_runtime_action',
      packet_type: packetType,
      workflow_plan_ids: uniqueSorted(planIdsByPolicyAction.get(policyActionId) ?? []),
      live_write_policy_action: liveWritePolicyAction,
      notes: liveWritePolicyAction
        ? 'Live fortress policy enforcement is resolved from Policy.write_lock packets by MutationPolicyGate.'
        : 'Definition policy action is packet-definition metadata until live write-policy enrollment is scoped.',
    };
  });
}

export function listPacketDependencyRequirementDescriptorsFromDefinitions(input: {
  definitions: readonly PacketTypeDefinition[];
}): PacketDependencyRequirementDescriptor[] {
  const trustedCapabilities = listTrustedPacketPlannerCapabilities();

  return [...PACKET_WORKFLOW_DEPENDENCY_IDS].map((dependencyId) => {
    const operationPacketType = PACKET_TYPE_BY_OPERATION_DEPENDENCY[dependencyId] ?? null;
    const operationDefinition = getDefinitionByPacketType(
      input.definitions,
      operationPacketType
    );
    const operationDependencyPart = getPacketDependencyPart(operationDefinition);
    const trustedCapabilityIds = trustedCapabilities
      .filter(
        (capability) =>
          capability.capability_id === dependencyId ||
          capability.dependency_ids.includes(dependencyId)
      )
      .map((capability) => capability.capability_id);

    if (POLICY_PACKET_DEPENDENCY_IDS.has(dependencyId)) {
      const policyDefinition = getDefinitionByPacketType(input.definitions, 'Policy');
      const policyDependencyPart = getPacketDependencyPart(policyDefinition);

      return {
        dependency_id: dependencyId,
        anchor_kind: 'policy_packet_semantics',
        packet_type: 'Policy',
        packet_definition_part_ids: policyDependencyPart
          ? [policyDependencyPart.part_id]
          : [],
        trusted_capability_ids: trustedCapabilityIds,
        runtime_metadata_only: false,
        notes:
          'Anchored to Policy packet write-lock semantics; MutationPolicyGate remains the live resolver.',
      };
    }

    if (operationPacketType) {
      return {
        dependency_id: dependencyId,
        anchor_kind: 'packet_definition_part',
        packet_type: operationPacketType,
        packet_definition_part_ids: operationDependencyPart
          ? [operationDependencyPart.part_id]
          : [],
        trusted_capability_ids: trustedCapabilityIds,
        runtime_metadata_only: false,
        notes:
          'Anchored to the target packet type dependency Definition part and interpreted by trusted local planners.',
      };
    }

    if (WORKFLOW_RESOLVER_DEPENDENCY_IDS.has(dependencyId)) {
      return {
        dependency_id: dependencyId,
        anchor_kind: 'workflow_resolver',
        packet_type: null,
        packet_definition_part_ids: [],
        trusted_capability_ids: trustedCapabilityIds,
        runtime_metadata_only: true,
        notes:
          'Resolver dependency is local runtime metadata and must be backed by the workflow resolver allowlist.',
      };
    }

    return {
      dependency_id: dependencyId,
      anchor_kind: 'trusted_runtime_capability',
      packet_type: null,
      packet_definition_part_ids: [],
      trusted_capability_ids: trustedCapabilityIds,
      runtime_metadata_only: TRUSTED_RUNTIME_DEPENDENCY_IDS.has(dependencyId),
      notes:
        'Trusted local capability dependency; it may index packet semantics but does not define packet meaning.',
    };
  });
}

export function auditPacketPolicyDependencyCoverageFromDefinitions(input: {
  definitions: readonly PacketTypeDefinition[];
}): PacketPolicyDependencyAuditReport {
  const findings: PacketPolicyDependencyAuditFinding[] = [];
  const policyDescriptors = listPacketPolicyRequirementDescriptorsFromDefinitions(input);
  const dependencyDescriptors = listPacketDependencyRequirementDescriptorsFromDefinitions(input);
  const dependencySemanticAudit = auditPacketDependencySemanticAuthority({
    definitions: input.definitions,
  });
  const policyById = new Map(
    policyDescriptors.map((descriptor) => [
      descriptor.policy_action_id,
      descriptor,
    ])
  );
  const dependencyById = new Map(
    dependencyDescriptors.map((descriptor) => [
      descriptor.dependency_id,
      descriptor,
    ])
  );
  const workflowPlans = listPacketWorkflowPlanDescriptorsFromDefinitions({
    definitions: input.definitions,
  });

  for (const workflowPlan of workflowPlans) {
    const definition = getDefinitionByPacketType(input.definitions, workflowPlan.packet_type);

    if (!definition) {
      findings.push({
        severity: 'error',
        code: 'workflow_unknown_packet_type',
        subject_id: workflowPlan.workflow_plan_id,
        message: `${workflowPlan.workflow_plan_id} references unknown packet type ${workflowPlan.packet_type}.`,
      });
      continue;
    }

    const dryRun = resolvePacketWorkflowDryRunPlan({
      definition,
      workflowPlanId: workflowPlan.workflow_plan_id,
    });

    if (dryRun.ready_for_interpretation) {
      if (dryRun.policy_action_ids.length === 0) {
        findings.push({
          severity: 'error',
          code: 'workflow_missing_policy_requirements',
          subject_id: workflowPlan.workflow_plan_id,
          message: `${workflowPlan.workflow_plan_id} is definition-ready but has no packet policy requirements.`,
        });
      }

      if (dryRun.dependency_ids.length === 0) {
        findings.push({
          severity: 'error',
          code: 'workflow_missing_dependency_requirements',
          subject_id: workflowPlan.workflow_plan_id,
          message: `${workflowPlan.workflow_plan_id} is definition-ready but has no packet dependency requirements.`,
        });
      }
    }

    for (const policyActionId of dryRun.policy_action_ids) {
      if (!policyById.has(policyActionId)) {
        findings.push({
          severity: 'error',
          code: 'workflow_unanchored_policy_action',
          subject_id: workflowPlan.workflow_plan_id,
          message: `${workflowPlan.workflow_plan_id} references unanchored policy action ${policyActionId}.`,
        });
      }
    }

    for (const dependencyId of dryRun.dependency_ids) {
      const descriptor = dependencyById.get(dependencyId);

      if (!descriptor) {
        findings.push({
          severity: 'error',
          code: 'workflow_unanchored_dependency',
          subject_id: workflowPlan.workflow_plan_id,
          message: `${workflowPlan.workflow_plan_id} references unanchored dependency ${dependencyId}.`,
        });
        continue;
      }

      if (
        !resolvePacketDependencySemanticDescriptor(dependencyId, {
          definitions: input.definitions,
        })
      ) {
        findings.push({
          severity: 'error',
          code: 'workflow_dependency_missing_semantic_authority',
          subject_id: workflowPlan.workflow_plan_id,
          message: `${workflowPlan.workflow_plan_id} references ${dependencyId}, but no packet dependency semantic descriptor resolves it.`,
        });
      }

      if (
        descriptor.anchor_kind === 'packet_definition_part' &&
        descriptor.packet_definition_part_ids.length === 0
      ) {
        findings.push({
          severity: 'error',
          code: 'dependency_missing_packet_definition_part',
          subject_id: dependencyId,
          message: `${dependencyId} is packet-backed but has no packet_dependency Definition part anchor.`,
        });
      }

      if (
        descriptor.anchor_kind === 'trusted_runtime_capability' &&
        !descriptor.runtime_metadata_only &&
        descriptor.trusted_capability_ids.length === 0
      ) {
        findings.push({
          severity: 'error',
          code: 'dependency_untrusted_runtime_metadata',
          subject_id: dependencyId,
          message: `${dependencyId} is runtime metadata but is not backed by a trusted local capability.`,
        });
      }
    }
  }

  for (const finding of dependencySemanticAudit.findings) {
    findings.push({
      severity: finding.severity,
      code: finding.code,
      subject_id: finding.subject_id,
      message: finding.message,
    });
  }

  return {
    status: findings.length > 0 ? 'fail' : 'pass',
    checked_workflow_plan_ids: workflowPlans.map((plan) => plan.workflow_plan_id),
    checked_policy_action_ids: policyDescriptors.map(
      (descriptor) => descriptor.policy_action_id
    ),
    checked_dependency_ids: dependencyDescriptors.map(
      (descriptor) => descriptor.dependency_id
    ),
    findings,
  };
}
