/**
 * File: trusted_definition_types.ts
 * Description: Local contracts for the Trusted Definition Coordinator candidate, source, preference, and context model.
 */

import type {
  PacketDefinitionPartDescriptor,
  PacketDefinitionPartSubtype,
  PacketProjectionDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import type { PacketTypeBodyCandidate } from '@core/packets/packet-type-body-builders.ts';
import type { PacketEnvelope, PacketHeader, PacketRef, PacketRevisionRef } from '@core/schema/packet-schema';
import type { TrustedDefinitionPartBuildPlan } from '@runtime/trusted_coordinators/trusted_building_coordinator/index.ts';
import type { TrustedRegulationProfile } from '@runtime/trusted_coordinators/trusted_regulation_coordinator/index.ts';
import type { TrustedOperationPlan } from '@runtime/trusted_coordinators/trusted_planning_coordinator/index.ts';
import type {
  TrustedRuntimeCoordinatorIssue,
  TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export const TRUSTED_DEFINITION_COORDINATOR_ID = 'trusted_definition_coordinator.v0' as const;

export type TrustedDefinitionSourceKind =
  | 'bootstrap_manifest'
  | 'seeded_bundle'
  | 'local_packet_archive'
  | 'imported_bundle'
  | 'pinned_bundle'
  | 'remote_mirror'
  | 'test_fixture';

export type TrustedDefinitionTrustTier =
  | 'core_seed'
  | 'node_pinned'
  | 'node_preferred'
  | 'trusted_import'
  | 'compatibility_only'
  | 'quarantined'
  | 'ignored';

export type TrustedDefinitionSource = {
  source_id: string;
  source_kind: TrustedDefinitionSourceKind;
  trust_tier: TrustedDefinitionTrustTier;
  priority: number;
  verified: boolean;
  imported_at?: string | null;
  signed_by_element_id?: string | null;
  notes?: string | null;
};

export type TrustedDefinitionTrustMode =
  | 'pin'
  | 'prefer'
  | 'allow'
  | 'compatibility_only'
  | 'quarantine'
  | 'ignore';

export type TrustedDefinitionRuntimePreference = {
  preference_id: string;
  node_element_id?: string | null;
  scope_packet_id?: string | null;
  source_id?: string | null;
  author_element_id?: string | null;
  packet_type?: string | null;
  packet_subtype?: string | null;
  part_subtype?: PacketDefinitionPartSubtype | 'packet_type_definition' | null;
  trust_mode: TrustedDefinitionTrustMode;
  priority: number;
  read_only_allowed?: boolean;
  compatibility_allowed?: boolean;
  notes?: string | null;
};


export type TrustedDefinitionProfilePreferencePacket =
  | PacketEnvelope
  | {
      header?: Partial<PacketHeader> | null;
      packet_ref?: PacketRef | null;
      revision_ref?: PacketRevisionRef | null;
      packet_type?: string | null;
      body: unknown;
    };

export type TrustedDefinitionCandidateStatus =
  | 'active_candidate'
  | 'available_candidate'
  | 'compatibility_candidate'
  | 'quarantined_candidate'
  | 'ignored_candidate';

export type TrustedDefinitionCompatibilityPosture =
  | 'current_semantics'
  | 'compatibility_reader'
  | 'migration_adapter'
  | 'legacy_reference'
  | 'not_compatibility';

export type TrustedDefinitionCandidatePayload = {
  definition?: PacketTypeDefinition | null;
  part?: PacketDefinitionPartDescriptor | null;
  projection?: PacketProjectionDescriptor | null;
  body_candidate?: PacketTypeBodyCandidate | null;
  descriptor?: unknown;
};

export type TrustedDefinitionCandidate = {
  candidate_id: string;
  source: TrustedDefinitionSource;
  defines_packet_type: string;
  defines_packet_subtype: string | null;
  part_subtype: PacketDefinitionPartSubtype | 'packet_type_definition';
  definition_version: string;
  schema_version: string;
  status: TrustedDefinitionCandidateStatus;
  verification_status: 'verified' | 'unverified' | 'failed';
  trust_status: TrustedDefinitionTrustTier;
  priority: number;
  compatibility_posture: TrustedDefinitionCompatibilityPosture;
  payload: TrustedDefinitionCandidatePayload;
  issues: TrustedRuntimeCoordinatorIssue[];
};

export type TrustedDefinitionContextMode =
  | 'normal_runtime'
  | 'reseed'
  | 'import_preview'
  | 'compatibility_read'
  | 'migration'
  | 'debug_audit';

export type TrustedDefinitionContext = {
  context_kind: 'trusted.definition_context';
  context_id: string;
  context_mode: TrustedDefinitionContextMode;
  node_element_id: string | null;
  scope_packet_id: string | null;
  packet_type_filters: string[];
  active_candidates: TrustedDefinitionCandidate[];
  inactive_candidates: TrustedDefinitionCandidate[];
  compatibility_candidates: TrustedDefinitionCandidate[];
  ignored_candidates: TrustedDefinitionCandidate[];
  preferences_used: TrustedDefinitionRuntimePreference[];
  conflict_decisions: string[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
};

export type TrustedDefinitionRuntimeView = {
  view_kind: 'trusted.definition_runtime_view';
  packet_type: string;
  schema_version: string;
  action_count: number;
  builder_count: number;
  planner_count: number;
  workflow_plan_count: number;
  projection_count: number;
  index_count: number;
  definition_part_count: number;
  required_definition_part_count: number;
  regulation_profile: TrustedRegulationProfile;
  planning_profile: TrustedOperationPlan;
  definition_part_build_plan: TrustedDefinitionPartBuildPlan;
  ready_for_reseed: boolean;
};

export type TrustedDefinitionRuntimeViewSet = {
  view_set_kind: 'trusted.definition_runtime_view_set';
  manifest_version: string;
  view_count: number;
  ready_view_count: number;
  views: TrustedDefinitionRuntimeView[];
};

export type TrustedDefinitionReadinessReport = {
  report_kind: 'trusted.definition_readiness_report';
  mode: TrustedDefinitionContextMode;
  ready: boolean;
  checked_packet_type_count: number;
  missing_required_part_count: number;
  issue_count: number;
  runtime_view_set: TrustedDefinitionRuntimeViewSet;
};

export type TrustedDefinitionOperation =
  | 'resolve_context'
  | 'resolve_packet_definition'
  | 'list_packet_definitions'
  | 'resolve_definition_part'
  | 'list_candidates'
  | 'rank_candidates'
  | 'audit_conflicts'
  | 'resolve_compatibility_definition'
  | 'compile_runtime_view'
  | 'compile_runtime_views'
  | 'audit_readiness';

export type TrustedDefinitionCoordinatorRequest =
  | {
      operation: 'resolve_context';
      input: ResolveTrustedDefinitionContextInput;
    }
  | {
      operation: 'resolve_packet_definition';
      input: ResolveTrustedPacketDefinitionInput;
    }
  | {
      operation: 'list_packet_definitions';
      input?: ListTrustedPacketDefinitionsInput;
    }
  | {
      operation: 'resolve_definition_part';
      input: ResolveTrustedDefinitionPartInput;
    }
  | {
      operation: 'list_candidates';
      input: ListTrustedDefinitionCandidatesInput;
    }
  | {
      operation: 'rank_candidates';
      input: RankTrustedDefinitionCandidatesInput;
    }
  | {
      operation: 'audit_conflicts';
      input: AuditTrustedDefinitionConflictsInput;
    }
  | {
      operation: 'resolve_compatibility_definition';
      input: ResolveTrustedCompatibilityDefinitionInput;
    }
  | {
      operation: 'compile_runtime_view';
      input: CompileTrustedDefinitionRuntimeViewInput;
    }
  | {
      operation: 'compile_runtime_views';
      input?: CompileTrustedDefinitionRuntimeViewsInput;
    }
  | {
      operation: 'audit_readiness';
      input?: AuditTrustedDefinitionReadinessInput;
    };

export type BaseTrustedDefinitionInput = {
  node_element_id?: string | null;
  scope_packet_id?: string | null;
  context_mode?: TrustedDefinitionContextMode;
  preferences?: readonly TrustedDefinitionRuntimePreference[];
  definition_profile_preference_packets?: readonly TrustedDefinitionProfilePreferencePacket[];
  candidates?: readonly TrustedDefinitionCandidate[];
  include_compatibility?: boolean;
  include_quarantined?: boolean;
};

export type ResolveTrustedDefinitionContextInput = BaseTrustedDefinitionInput & {
  packet_type_filters?: readonly string[];
};

export type ResolveTrustedPacketDefinitionInput = BaseTrustedDefinitionInput & {
  packet_type: string;
  packet_subtype?: string | null;
};

export type ListTrustedPacketDefinitionsInput = BaseTrustedDefinitionInput & {
  packet_type_filters?: readonly string[];
};

export type ResolveTrustedDefinitionPartInput = BaseTrustedDefinitionInput & {
  packet_type: string;
  packet_subtype?: string | null;
  part_subtype: PacketDefinitionPartSubtype;
};

export type ResolveTrustedCompatibilityDefinitionInput = BaseTrustedDefinitionInput & {
  packet_type: string;
  packet_subtype?: string | null;
  part_subtype?: PacketDefinitionPartSubtype | 'packet_type_definition' | null;
  from_schema_version?: string | null;
  to_schema_version?: string | null;
};

export type ListTrustedDefinitionCandidatesInput = BaseTrustedDefinitionInput & {
  packet_type_filters?: readonly string[];
};

export type RankTrustedDefinitionCandidatesInput = BaseTrustedDefinitionInput & {
  candidates: readonly TrustedDefinitionCandidate[];
};

export type AuditTrustedDefinitionConflictsInput = BaseTrustedDefinitionInput & {
  candidates: readonly TrustedDefinitionCandidate[];
};

export type CompileTrustedDefinitionRuntimeViewInput = BaseTrustedDefinitionInput & {
  packet_type: string;
};

export type CompileTrustedDefinitionRuntimeViewsInput = BaseTrustedDefinitionInput;

export type AuditTrustedDefinitionReadinessInput = BaseTrustedDefinitionInput & {
  context_mode?: TrustedDefinitionContextMode;
};
