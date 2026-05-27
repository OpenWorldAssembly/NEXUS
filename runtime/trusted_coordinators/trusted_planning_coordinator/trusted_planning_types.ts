/**
 * File: trusted_planning_types.ts
 * Description: Local contracts for trusted runtime planning, default resolution, dependency planning, builder selection, and reseed readiness.
 */

import type { MutationActionId } from '@core/auth/write-policy.ts';
import type {
  PacketBuilderDescriptor,
  PacketDefaultOverrideDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import type { PacketDefaultProfile } from '@core/packets/packet-defaults.ts';
import type { PacketDependencyRequirementDescriptor } from '@core/packets/packet-policy-dependency.ts';
import type { PacketDependencySemanticDescriptor } from '@core/packets/packet-policy-semantics.ts';
import type { PacketWorkflowDryRunPlan } from '@core/packets/packet-workflow-planner.ts';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type {
  TrustedDefinitionContextMode,
  TrustedDefinitionRuntimePreference,
} from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';
import type {
  ResolveTrustedPolicyContextInput,
  ResolveTrustedWritePolicyGateInput,
  TrustedPolicyContext,
  TrustedRegulationOperationKind,
  TrustedWritePolicyGate,
} from '@runtime/trusted_coordinators/trusted_regulation_coordinator/index.ts';
import type {
  TrustedRuntimeCoordinatorIssue,
  TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export const TRUSTED_PLANNING_COORDINATOR_ID = 'trusted_planning_coordinator.v0' as const;

export type TrustedPlanningContextMode = TrustedDefinitionContextMode;
export type TrustedPlanningOperationKind = TrustedRegulationOperationKind;

export type TrustedPlanningRequirementStrength =
  | 'blocking'
  | 'advisory'
  | 'definition_audit'
  | 'future_hook';

export type TrustedPlanningRequirementSource =
  | 'definition_part'
  | 'workflow_plan'
  | 'semantic_descriptor'
  | 'trusted_runtime_capability'
  | 'policy_packet'
  | 'local_override';

export type TrustedPlanningRequirement = {
  requirement_id: string;
  requirement_kind: 'default' | 'dependency' | 'builder' | 'child_plan';
  strength: TrustedPlanningRequirementStrength;
  source: TrustedPlanningRequirementSource;
  packet_type: string | null;
  packet_subtype: string | null;
  operation_kind: TrustedPlanningOperationKind;
  notes: string;
};

export type TrustedDefaultPlan = {
  plan_kind: 'trusted.default_plan';
  packet_type: string;
  packet_subtype: string | null;
  operation_kind: TrustedPlanningOperationKind;
  profile: PacketDefaultProfile;
  default_value_keys: string[];
  inherited_policy_ref_count: number;
  overrides_allowed: boolean;
  requirements: TrustedPlanningRequirement[];
  blockers: string[];
  warnings: string[];
};

export type TrustedDependencyPlan = {
  plan_kind: 'trusted.dependency_plan';
  packet_type: string | null;
  packet_subtype: string | null;
  operation_kind: TrustedPlanningOperationKind;
  workflow_plan_id: string | null;
  workflow_dry_run: PacketWorkflowDryRunPlan | null;
  requirements: PacketDependencyRequirementDescriptor[];
  semantic_descriptors: PacketDependencySemanticDescriptor[];
  blocking_requirements: TrustedPlanningRequirement[];
  advisory_requirements: TrustedPlanningRequirement[];
  runtime_metadata_dependency_ids: string[];
  packet_backed_dependency_ids: string[];
  missing_required_definition_parts: string[];
  blockers: string[];
  warnings: string[];
};

export type TrustedBuilderSelection = {
  selection_kind: 'trusted.builder_selection';
  packet_type: string;
  packet_subtype: string | null;
  operation_kind: TrustedPlanningOperationKind;
  action_ids: string[];
  builder: PacketBuilderDescriptor | null;
  candidate_builder_count: number;
  reason: string;
  blockers: string[];
  warnings: string[];
};

export type TrustedBodyInputPlan = {
  plan_kind: 'trusted.body_input_plan';
  packet_type: string;
  packet_subtype: string | null;
  operation_kind: TrustedPlanningOperationKind;
  builder_id: string | null;
  resolved_input_values: Record<string, unknown>;
  default_value_keys: string[];
  request_value_keys: string[];
  unresolved_input_paths: string[];
  blockers: string[];
  warnings: string[];
};

export type TrustedChildPacketPlanSet = {
  plan_kind: 'trusted.child_packet_plan_set';
  packet_type: string | null;
  packet_subtype: string | null;
  operation_kind: TrustedPlanningOperationKind;
  child_plans: TrustedOperationPlan[];
  pending_child_descriptor_count: number;
  blockers: string[];
  warnings: string[];
  notes: string;
};

export type TrustedOperationPlan = {
  plan_kind: 'trusted.operation_plan';
  plan_id: string;
  context_mode: TrustedPlanningContextMode;
  node_element_id: string | null;
  packet_type: string | null;
  packet_subtype: string | null;
  operation_kind: TrustedPlanningOperationKind;
  action_ids: string[];
  workflow_plan_id: string | null;
  definition: PacketTypeDefinition | null;
  builder_selection: TrustedBuilderSelection | null;
  default_plan: TrustedDefaultPlan | null;
  dependency_plan: TrustedDependencyPlan | null;
  body_input_plan: TrustedBodyInputPlan | null;
  policy_context: TrustedPolicyContext | null;
  write_policy_gate: TrustedWritePolicyGate | null;
  child_packet_plans: TrustedChildPacketPlanSet | null;
  blockers: string[];
  warnings: string[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
};

export type TrustedPlanningReadinessReport = {
  report_kind: 'trusted.planning_readiness_report';
  mode: TrustedPlanningContextMode;
  ready: boolean;
  checked_packet_type_count: number;
  plan_count: number;
  blocking_issue_count: number;
  advisory_issue_count: number;
  blocker_count: number;
  warning_count: number;
  plans: TrustedOperationPlan[];
};

export type BaseTrustedPlanningInput = {
  context_mode?: TrustedPlanningContextMode;
  node_element_id?: string | null;
  operation_kind?: TrustedPlanningOperationKind;
  packet_type?: string | null;
  packet_subtype?: string | null;
  action_ids?: readonly string[];
  workflow_plan_id?: string | null;
  mutation_intent?: string | null;
  definition?: PacketTypeDefinition | null;
  definitions?: readonly PacketTypeDefinition[];
  preferences?: readonly TrustedDefinitionRuntimePreference[];
  policy_packets?: readonly PacketEnvelopeByType['Policy'][];
  local_overrides?: readonly PacketDefaultOverrideDescriptor[];
  body_input_values?: Readonly<Record<string, unknown>>;
};

export type ResolveTrustedDefaultPlanInput = BaseTrustedPlanningInput & {
  definition: PacketTypeDefinition;
};

export type ResolveTrustedDependencyPlanInput = BaseTrustedPlanningInput;

export type SelectTrustedBuilderDescriptorInput = BaseTrustedPlanningInput & {
  definition: PacketTypeDefinition;
};

export type ResolveTrustedChildPacketPlansInput = BaseTrustedPlanningInput & {
  definition?: PacketTypeDefinition | null;
  max_depth?: number;
  depth?: number;
};

export type ResolveTrustedOperationPlanInput = BaseTrustedPlanningInput & {
  include_defaults?: boolean;
  include_dependencies?: boolean;
  include_regulation?: boolean;
  include_write_policy_gate?: boolean;
  max_depth?: number;
  depth?: number;
};

export type AuditTrustedPlanningReadinessInput = BaseTrustedPlanningInput & {
  packet_type_filters?: readonly string[];
};

export type TrustedPlanningOperation =
  | 'resolve_operation_plan'
  | 'resolve_default_plan'
  | 'resolve_dependency_plan'
  | 'select_builder_descriptor'
  | 'resolve_child_packet_plans'
  | 'audit_readiness';

export type TrustedPlanningCoordinatorRequest =
  | {
      operation: 'resolve_operation_plan';
      input: ResolveTrustedOperationPlanInput;
    }
  | {
      operation: 'resolve_default_plan';
      input: ResolveTrustedDefaultPlanInput;
    }
  | {
      operation: 'resolve_dependency_plan';
      input: ResolveTrustedDependencyPlanInput;
    }
  | {
      operation: 'select_builder_descriptor';
      input: SelectTrustedBuilderDescriptorInput;
    }
  | {
      operation: 'resolve_child_packet_plans';
      input: ResolveTrustedChildPacketPlansInput;
    }
  | {
      operation: 'audit_readiness';
      input?: AuditTrustedPlanningReadinessInput;
    };

export type TrustedPlanningPolicyContextInput = ResolveTrustedPolicyContextInput;
export type TrustedPlanningWriteGateInput = ResolveTrustedWritePolicyGateInput & {
  action_ids: readonly MutationActionId[];
};
