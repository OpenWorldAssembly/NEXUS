/**
 * File: trusted_regulation_types.ts
 * Description: Local contracts for trusted runtime regulation contexts, policy gates, and governance requirements.
 */

import type { MutationActionId, ResolvedWritePolicyDecision } from '@core/auth/write-policy.ts';
import type {
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import type {
  PacketPolicyRequirementDescriptor,
} from '@core/packets/packet-policy-dependency.ts';
import type {
  PacketPolicySemanticDescriptor,
  ResolvedPolicyPacketSemantics,
} from '@core/packets/packet-policy-semantics.ts';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type {
  TrustedDefinitionContextMode,
  TrustedDefinitionRuntimePreference,
} from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';
import type {
  TrustedRuntimeCoordinatorIssue,
  TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export const TRUSTED_REGULATION_COORDINATOR_ID = 'trusted_regulation_coordinator.v0' as const;

export type TrustedRegulationContextMode = TrustedDefinitionContextMode;

export type TrustedRegulationOperationKind =
  | 'create'
  | 'revise'
  | 'withdraw'
  | 'attest'
  | 'project'
  | 'bundle'
  | 'import'
  | 'export'
  | 'vote'
  | 'moderate'
  | 'default_resolution'
  | 'dependency_resolution'
  | 'policy_resolution'
  | 'write_gate'
  | 'runtime_read'
  | 'reseed'
  | 'debug_audit'
  | 'builder_selection';

export type TrustedRegulationRequirementStrength =
  | 'blocking'
  | 'advisory'
  | 'definition_audit'
  | 'future_hook';

export type TrustedRegulationRequirementSource =
  | 'policy_packet'
  | 'write_policy'
  | 'semantic_descriptor'
  | 'definition_registry';

export type TrustedRegulationRequirement = {
  requirement_id: string;
  requirement_kind: 'policy' | 'write_gate';
  strength: TrustedRegulationRequirementStrength;
  source: TrustedRegulationRequirementSource;
  packet_type: string | null;
  packet_subtype: string | null;
  operation_kind: TrustedRegulationOperationKind;
  notes: string;
};

export type TrustedPolicyContext = {
  context_kind: 'trusted.policy_context';
  packet_type: string | null;
  packet_subtype: string | null;
  operation_kind: TrustedRegulationOperationKind;
  requirements: PacketPolicyRequirementDescriptor[];
  semantic_descriptors: PacketPolicySemanticDescriptor[];
  resolved_policy_packet_semantics: ResolvedPolicyPacketSemantics[];
  active_policy_requirement_ids: string[];
  advisory_policy_requirement_ids: string[];
  definition_audit_policy_requirement_ids: string[];
  future_hook_policy_requirement_ids: string[];
};

export type TrustedWritePolicyGate = {
  gate_kind: 'trusted.write_policy_gate';
  operation_kind: TrustedRegulationOperationKind;
  action_ids: MutationActionId[];
  decision: ResolvedWritePolicyDecision | null;
  governing_scope_packet_id: string | null;
  policy_packet_ids: string[];
  satisfied: boolean | null;
  notes: string;
};

export type TrustedRegulationContext = {
  context_kind: 'trusted.regulation_context';
  context_id: string;
  context_mode: TrustedRegulationContextMode;
  node_element_id: string | null;
  packet_type: string | null;
  packet_subtype: string | null;
  operation_kind: TrustedRegulationOperationKind;
  definition: PacketTypeDefinition | null;
  policy_context: TrustedPolicyContext;
  write_policy_gate: TrustedWritePolicyGate | null;
  missing_required_definition_parts: string[];
  requirements: TrustedRegulationRequirement[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
};

// Backward-compatible alias while older readiness views still refer to regulation profiles.
export type TrustedRegulationProfile = TrustedRegulationContext;

export type TrustedRegulationReadinessReport = {
  report_kind: 'trusted.regulation_readiness_report';
  mode: TrustedRegulationContextMode;
  ready: boolean;
  checked_packet_type_count: number;
  context_count: number;
  blocking_issue_count: number;
  advisory_issue_count: number;
  missing_required_part_count: number;
  contexts: TrustedRegulationContext[];
};

export type BaseTrustedRegulationInput = {
  context_mode?: TrustedRegulationContextMode;
  node_element_id?: string | null;
  operation_kind?: TrustedRegulationOperationKind;
  packet_type?: string | null;
  packet_subtype?: string | null;
  definition?: PacketTypeDefinition | null;
  definitions?: readonly PacketTypeDefinition[];
  preferences?: readonly TrustedDefinitionRuntimePreference[];
  policy_packets?: readonly PacketEnvelopeByType['Policy'][];
};

export type ResolveTrustedRegulationContextInput = BaseTrustedRegulationInput & {
  include_policies?: boolean;
  include_write_policy_gate?: boolean;
  governing_scope_packet?: PacketEnvelopeByType['Element'] | null;
  action_ids?: readonly MutationActionId[];
};

export type ResolveTrustedPolicyContextInput = BaseTrustedRegulationInput;

export type ResolveTrustedWritePolicyGateInput = BaseTrustedRegulationInput & {
  governing_scope_packet?: PacketEnvelopeByType['Element'] | null;
  action_ids: readonly MutationActionId[];
};

export type ListTrustedRegulationRequirementsInput = ResolveTrustedRegulationContextInput;

export type AuditTrustedRegulationReadinessInput = BaseTrustedRegulationInput & {
  packet_type_filters?: readonly string[];
};

export type TrustedRegulationOperation =
  | 'resolve_context'
  | 'resolve_policy_context'
  | 'resolve_write_policy_gate'
  | 'list_requirements'
  | 'audit_readiness';

export type TrustedRegulationCoordinatorRequest =
  | {
      operation: 'resolve_context';
      input: ResolveTrustedRegulationContextInput;
    }
  | {
      operation: 'resolve_policy_context';
      input: ResolveTrustedPolicyContextInput;
    }
  | {
      operation: 'resolve_write_policy_gate';
      input: ResolveTrustedWritePolicyGateInput;
    }
  | {
      operation: 'list_requirements';
      input: ListTrustedRegulationRequirementsInput;
    }
  | {
      operation: 'audit_readiness';
      input?: AuditTrustedRegulationReadinessInput;
    };
