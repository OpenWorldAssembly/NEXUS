/**
 * File: trusted_compatibility_types.ts
 * Description: Contracts for the Trusted Compatibility Coordinator runtime seam.
 */

import type {
  PacketAdaptationChange,
  PacketAdaptationDirection,
  PacketAdaptationLoss,
  PacketCompatibilityAuditSummary,
  PacketCompatibilitySupportLevel,
  PacketEnvelope,
  PacketRef,
  PacketRevisionMode,
  PacketRevisionRef,
  PacketType,
  PacketWriteTargetPolicy,
  PacketWriteTargetSupport,
} from '@core/schema/packet-schema';
import type {
  PacketCompatibilityAdapterDescriptor,
  PacketCompatibilityPosture,
  PacketDefinitionPartDescriptor,
} from '@core/packets/definitions/packet-definition-types.ts';
import type {
  TrustedDefinitionRuntimePreference,
} from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';
import type {
  TrustedRuntimeCoordinatorIssue,
  TrustedRuntimeCoordinatorMode,
  TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export const TRUSTED_COMPATIBILITY_COORDINATOR_ID = 'trusted_compatibility_coordinator.v0' as const;

export type TrustedCompatibilityContextMode = TrustedRuntimeCoordinatorMode;

export type TrustedCompatibilityIntent =
  | 'read'
  | 'write'
  | 'migration'
  | 'import_preview'
  | 'export'
  | 'audit';

export type TrustedCompatibilityStrictness = 'advisory' | 'strict';

export type TrustedCompatibilityDefinitionContext = {
  node_element_id?: string | null;
  preferences?: readonly TrustedDefinitionRuntimePreference[];
  include_quarantined?: boolean;
};

export type TrustedPacketCompatibilityResolution = {
  result_kind: 'trusted.packet_compatibility_resolution';
  packet_ref: PacketRef | null;
  revision_ref: PacketRevisionRef | null;
  packet_type: PacketType | string | null;
  declared_schema_version: string | null;
  effective_source_schema_version: string | null;
  interpreted_as_legacy_profile: boolean;
  source_schema_version: string | null;
  target_schema_version: string | null;
  direction: PacketAdaptationDirection | 'unknown';
  is_supported: boolean;
  is_current: boolean;
  is_exact: boolean;
  is_lossy: boolean;
  writable_as_is: boolean;
  requires_guarded_upgrade: boolean;
  requires_loss_acknowledgement: boolean;
  supported_write_target: PacketWriteTargetSupport | 'unknown';
  changes: PacketAdaptationChange[];
  losses: PacketAdaptationLoss[];
  issue_count: number;
  blocker_count: number;
  warning_count: number;
};

export type TrustedCompatibilityReadResult = {
  result_kind: 'trusted.compatibility_read';
  raw_packet: unknown;
  adapted_packet: PacketEnvelope | null;
  compatibility: TrustedPacketCompatibilityResolution;
};

export type TrustedCompatibilityWritePreparation = {
  result_kind: 'trusted.compatibility_write_preparation';
  raw_packet: unknown;
  adapted_packet: PacketEnvelope | null;
  prepared_packet: PacketEnvelope | null;
  compatibility: TrustedPacketCompatibilityResolution;
  write_allowed: boolean;
  write_blockers: string[];
  required_acknowledgements: string[];
};

export type TrustedAdapterPathStep = {
  from_schema_version: string;
  to_schema_version: string;
  direction: Exclude<PacketAdaptationDirection, 'same_version'>;
};

export type TrustedAdapterPathResolution = {
  result_kind: 'trusted.adapter_path_resolution';
  packet_type: PacketType | string;
  source_schema_version: string;
  target_schema_version: string;
  path_found: boolean;
  same_version: boolean;
  step_count: number;
  steps: TrustedAdapterPathStep[];
};

export type TrustedCompatibilityProfile = {
  result_kind: 'trusted.compatibility_profile';
  packet_type: PacketType | string;
  current_schema_version: string | null;
  revision_mode: PacketRevisionMode | null;
  support_level: PacketCompatibilitySupportLevel | null;
  write_target_policy: PacketWriteTargetPolicy | null;
  supported_schema_versions: string[];
  has_legacy_versions: boolean;
  has_write_preparation: boolean;
  definition_part: PacketDefinitionPartDescriptor | null;
  definition_part_present: boolean;
  definition_current_schema_version: string | null;
  definition_compatibility: PacketCompatibilityPosture | null;
  adapter_ids: string[];
  adapter_descriptors: PacketCompatibilityAdapterDescriptor[];
  supports_upcast: boolean;
  supports_downcast: boolean;
  loss_awareness: 'none' | 'loss_annotated' | 'loss_ack_required' | 'unknown';
  registry_definition_mismatches: string[];
};

export type TrustedCompatibilityCoverageItem = {
  packet_type: PacketType | string;
  registry_present: boolean;
  definition_part_present: boolean;
  registry_current_schema_version: string | null;
  definition_current_schema_version: string | null;
  supported_schema_versions: string[];
  support_level: PacketCompatibilitySupportLevel | null;
  write_target_policy: PacketWriteTargetPolicy | null;
  adapter_id_count: number;
  has_legacy_versions: boolean;
  has_write_preparation: boolean;
  issues: TrustedRuntimeCoordinatorIssue[];
};

export type TrustedCompatibilityCoverageAudit = {
  report_kind: 'trusted.compatibility_coverage_audit';
  mode: TrustedCompatibilityContextMode;
  checked_packet_type_count: number;
  ready_packet_type_count: number;
  missing_registry_count: number;
  missing_definition_part_count: number;
  mismatch_count: number;
  issue_count: number;
  items: TrustedCompatibilityCoverageItem[];
};

export type TrustedCompatibilityReadinessReport = {
  report_kind: 'trusted.compatibility_readiness_report';
  mode: TrustedCompatibilityContextMode;
  ready: boolean;
  core_registry_available: boolean;
  definition_lookup_available: boolean;
  read_adaptation_available: boolean;
  write_preparation_available: boolean;
  same_version_path_available: boolean;
  missing_path_reported: boolean;
  checked_packet_type_count: number;
  blocking_issue_count: number;
  warning_count: number;
};

export type BaseTrustedCompatibilityInput = TrustedCompatibilityDefinitionContext & {
  context_mode?: TrustedCompatibilityContextMode;
  intent?: TrustedCompatibilityIntent;
  compatibility_strictness?: TrustedCompatibilityStrictness;
};

export type ResolveTrustedPacketCompatibilityInput = BaseTrustedCompatibilityInput & {
  packet: unknown;
  target_schema_version?: string;
};

export type AdaptTrustedPacketForReadInput = BaseTrustedCompatibilityInput & {
  packet: unknown;
  target_schema_version?: string;
};

export type PrepareTrustedPacketForWriteInput = BaseTrustedCompatibilityInput & {
  packet: unknown;
  target_schema_version?: string;
  allow_lossy_write?: boolean;
};

export type ResolveTrustedAdapterPathInput = BaseTrustedCompatibilityInput & {
  packet_type: PacketType | string;
  source_schema_version: string;
  target_schema_version: string;
};

export type ResolveTrustedCompatibilityProfileInput = BaseTrustedCompatibilityInput & {
  packet_type: PacketType | string;
  schema_version?: string | null;
};

export type AuditTrustedCompatibilityCoverageInput = BaseTrustedCompatibilityInput & {
  packet_type_filters?: readonly (PacketType | string)[];
};

export type AuditTrustedCompatibilityReadinessInput = BaseTrustedCompatibilityInput;

export type TrustedCompatibilityOperation =
  | 'resolve_packet_compatibility'
  | 'adapt_packet_for_read'
  | 'prepare_packet_for_write'
  | 'resolve_adapter_path'
  | 'resolve_compatibility_profile'
  | 'audit_compatibility_coverage'
  | 'audit_readiness';

export type TrustedCompatibilityCoordinatorRequest =
  | {
      operation: 'resolve_packet_compatibility';
      input: ResolveTrustedPacketCompatibilityInput;
    }
  | {
      operation: 'adapt_packet_for_read';
      input: AdaptTrustedPacketForReadInput;
    }
  | {
      operation: 'prepare_packet_for_write';
      input: PrepareTrustedPacketForWriteInput;
    }
  | {
      operation: 'resolve_adapter_path';
      input: ResolveTrustedAdapterPathInput;
    }
  | {
      operation: 'resolve_compatibility_profile';
      input: ResolveTrustedCompatibilityProfileInput;
    }
  | {
      operation: 'audit_compatibility_coverage';
      input?: AuditTrustedCompatibilityCoverageInput;
    }
  | {
      operation: 'audit_readiness';
      input?: AuditTrustedCompatibilityReadinessInput;
    };

export type TrustedCompatibilityFunctionResult<TValue> = {
  value: TValue | null;
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
};
