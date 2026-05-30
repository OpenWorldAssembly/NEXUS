/**
 * File: trusted_exchange_types.ts
 * Description: Contracts for the Trusted Exchange Coordinator packet movement seam.
 */

import type { PacketEnvelope, PacketRef, PacketRevisionRef, PacketType } from '@core/schema/packet-schema';
import type { PacketStore } from '@core/contracts';
import type {
  TrustedArchiveBundleExport,
  TrustedArchiveBundleImport,
} from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import type { TrustedCompatibilityReadResult } from '@runtime/trusted_coordinators/trusted_compatibility_coordinator/index.ts';
import type {
  TrustedVerificationMode,
  TrustedVerificationReport,
} from '@runtime/trusted_coordinators/trusted_verification_coordinator/index.ts';
import type {
  TrustedRuntimeCoordinatorIssue,
  TrustedRuntimeCoordinatorMode,
  TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export const TRUSTED_EXCHANGE_COORDINATOR_ID = 'trusted_exchange_coordinator.v0' as const;

export type TrustedExchangeContextMode = TrustedRuntimeCoordinatorMode;
export type TrustedExchangeCompatibilityStrictness = 'advisory' | 'strict';

export type TrustedExchangeStoreContext = {
  packet_store?: PacketStore | null;
  database_path?: string | null;
};

export type TrustedExchangeBundleShape =
  | 'packet_array'
  | 'packet_envelope'
  | 'packets_object'
  | 'revisions_object'
  | 'nested_bundle_object'
  | 'archive_export_bytes'
  | 'json_string'
  | 'unknown';

export type TrustedExchangeLocalStatus =
  | 'not_checked'
  | 'new_packet'
  | 'new_revision'
  | 'duplicate_revision'
  | 'manual_conflict'
  | 'blocked_invalid'
  | 'unknown';

export type TrustedExchangeAction =
  | 'import_revision'
  | 'skip_duplicate'
  | 'block_conflict'
  | 'needs_manual_resolution'
  | 'needs_compatibility_acknowledgement'
  | 'needs_verification_acknowledgement'
  | 'accept_new_packet'
  | 'accept_new_revision'
  | 'block_invalid'
  | 'block_unsupported'
  | 'manual_conflict';

export type TrustedExchangePacketEntry = {
  entry_index: number;
  entry_id: string;
  packet: unknown;
  packet_ref: PacketRef | null;
  revision_ref: PacketRevisionRef | null;
  packet_type: PacketType | string | null;
  declared_schema_version: string | null;
  packet_subtype: string | null;
  normalized_key: string | null;
  parent_revision_refs: PacketRevisionRef[];
  parsed_packet: PacketEnvelope | null;
  parse_error: string | null;
};

export type TrustedExchangeBundleNormalization = {
  result_kind: 'trusted.exchange_bundle_normalization';
  source_shape: TrustedExchangeBundleShape;
  packet_count: number;
  entries: TrustedExchangePacketEntry[];
  warnings: string[];
  blockers: string[];
};

export type TrustedExchangeImportPreviewOptions = {
  verification_mode?: TrustedVerificationMode;
  compatibility_strictness?: TrustedExchangeCompatibilityStrictness;
  include_ref_checks?: boolean;
  include_lineage_checks?: boolean;
  target_schema_version?: string;
};

export type TrustedExchangePacketPreview = {
  entry_index: number;
  entry_id: string;
  packet_ref: PacketRef | null;
  revision_ref: PacketRevisionRef | null;
  packet_type: PacketType | string | null;
  declared_schema_version: string | null;
  packet_subtype: string | null;
  normalized_key: string | null;
  readable: boolean;
  verified: boolean;
  local_status: TrustedExchangeLocalStatus;
  recommended_action: TrustedExchangeAction;
  warnings: string[];
  blockers: string[];
};

export type TrustedExchangeImportPreview = {
  result_kind: 'trusted.exchange_import_preview';
  source_label: string | null;
  source_shape: TrustedExchangeBundleShape;
  packet_count: number;
  readable_count: number;
  verified_count: number;
  new_packet_count: number;
  new_revision_count: number;
  duplicate_revision_count: number;
  conflict_count: number;
  blocked_count: number;
  warnings: string[];
  blockers: string[];
  packet_previews: TrustedExchangePacketPreview[];
  verification_report: TrustedVerificationReport | null;
  compatibility_report: TrustedCompatibilityReadResult[];
};

export type TrustedExchangeImportCommitPlanItem = {
  entry_index: number;
  entry_id: string;
  packet_ref: PacketRef | null;
  revision_ref: PacketRevisionRef | null;
  normalized_key: string | null;
  action: TrustedExchangeAction;
  accepted_for_commit: boolean;
  required_acknowledgements: string[];
  blockers: string[];
  warnings: string[];
  reason: string;
};

export type TrustedExchangeImportCommitPlan = {
  result_kind: 'trusted.exchange_import_commit_plan';
  source_label: string | null;
  packet_count: number;
  import_revision_count: number;
  skip_duplicate_count: number;
  manual_resolution_count: number;
  blocked_count: number;
  required_acknowledgements: string[];
  items: TrustedExchangeImportCommitPlanItem[];
};

export type TrustedExchangeImportCommit = {
  result_kind: 'trusted.exchange_import_commit';
  source_label: string | null;
  import_result: TrustedArchiveBundleImport | null;
  plan: TrustedExchangeImportCommitPlan | null;
  planned_import_count: number;
  archived_import_count: number;
  skipped_count: number;
  blocked_count: number;
  imported_revision_keys: string[];
  skipped_revision_keys: string[];
  unexpected_archive_keys: string[];
  missing_archive_keys: string[];
  repaired_preferred_packet_count: number;
  restored_preferred_packet_count: number;
  diverged_packet_count: number;
  imported_revision_count: number;
  skipped_duplicate_count: number;
  warnings: string[];
  blockers: string[];
};

export type TrustedExchangeExportManifest = {
  manifest_kind: 'trusted.exchange_export_manifest';
  exported_at: string;
  root_refs: PacketRef[];
  requested_option_ids: string[];
  packet_count: number;
  revision_count: number;
  bundle_byte_count: number;
};

export type TrustedExchangeExportPacketSet = {
  result_kind: 'trusted.exchange_export_packet_set';
  root_refs: PacketRef[];
  packet_count: number;
  revision_count: number;
  bundle: TrustedArchiveBundleExport | null;
  manifest: TrustedExchangeExportManifest;
  warnings: string[];
  blockers: string[];
};

export type TrustedExchangeMergePlanItem = {
  entry_index: number;
  entry_id: string;
  packet_ref: PacketRef | null;
  revision_ref: PacketRevisionRef | null;
  action: TrustedExchangeAction;
  local_status: TrustedExchangeLocalStatus;
  reason: string;
};

export type TrustedExchangeMergePlan = {
  result_kind: 'trusted.exchange_merge_plan';
  packet_count: number;
  accept_new_packet_count: number;
  accept_new_revision_count: number;
  skip_duplicate_count: number;
  manual_conflict_count: number;
  blocked_count: number;
  items: TrustedExchangeMergePlanItem[];
  warnings: string[];
  blockers: string[];
};

export type TrustedExchangeRebundlePreview = {
  result_kind: 'trusted.exchange_rebundle_preview';
  source_label: string | null;
  source_shape: TrustedExchangeBundleShape;
  packet_count: number;
  normalized_bundle: {
    bundle_version: string;
    purpose: string;
    root_refs: PacketRef[];
    packets: unknown[];
  };
  manifest: {
    manifest_kind: 'trusted.exchange_rebundle_manifest';
    created_at: string;
    packet_count: number;
    readable_count: number;
    warning_count: number;
    blocker_count: number;
  };
  verification_report: TrustedVerificationReport | null;
  warnings: string[];
  blockers: string[];
};

export type TrustedExchangeReadinessReport = {
  report_kind: 'trusted.exchange_readiness_report';
  mode: TrustedExchangeContextMode;
  ready: boolean;
  compatibility_ready: boolean;
  verification_ready: boolean;
  archive_ready: boolean;
  bundle_normalization_ready: boolean;
  merge_planning_ready: boolean;
  blocking_issue_count: number;
  warning_count: number;
};

export type BaseTrustedExchangeInput = TrustedExchangeStoreContext & {
  context_mode?: TrustedExchangeContextMode;
};

export type PreviewTrustedImportInput = BaseTrustedExchangeInput & {
  source_label?: string | null;
  bundle: unknown;
  options?: TrustedExchangeImportPreviewOptions;
};

export type PlanTrustedImportCommitInput = BaseTrustedExchangeInput & {
  source_label?: string | null;
  preview?: TrustedExchangeImportPreview | null;
  bundle?: unknown;
  options?: TrustedExchangeImportPreviewOptions;
};

export type CommitTrustedImportInput = BaseTrustedExchangeInput & {
  source_label?: string | null;
  preview?: TrustedExchangeImportPreview | null;
  plan?: TrustedExchangeImportCommitPlan | null;
  bundle: unknown;
  accepted_acknowledgements?: string[];
  options?: TrustedExchangeImportPreviewOptions;
};

export type ExportTrustedPacketSetInput = BaseTrustedExchangeInput & {
  root_refs: PacketRef[];
  options?: {
    include_dependencies?: boolean;
    include_children?: boolean;
    include_references?: boolean;
    include_dependency_revisions?: boolean;
  };
};

export type PlanTrustedMergeInput = BaseTrustedExchangeInput & {
  source_label?: string | null;
  bundle: unknown;
  options?: TrustedExchangeImportPreviewOptions;
};

export type PreviewTrustedRebundleInput = BaseTrustedExchangeInput & {
  source_label?: string | null;
  bundle: unknown;
  root_refs?: PacketRef[];
  purpose?: string;
  options?: TrustedExchangeImportPreviewOptions;
};

export type AuditTrustedExchangeReadinessInput = BaseTrustedExchangeInput;

export type TrustedExchangeOperation =
  | 'preview_import'
  | 'plan_import_commit'
  | 'commit_import'
  | 'export_packet_set'
  | 'plan_merge'
  | 'preview_rebundle'
  | 'audit_readiness';

export type TrustedExchangeCoordinatorRequest =
  | {
      operation: 'preview_import';
      input: PreviewTrustedImportInput;
    }
  | {
      operation: 'plan_import_commit';
      input: PlanTrustedImportCommitInput;
    }
  | {
      operation: 'commit_import';
      input: CommitTrustedImportInput;
    }
  | {
      operation: 'export_packet_set';
      input: ExportTrustedPacketSetInput;
    }
  | {
      operation: 'plan_merge';
      input: PlanTrustedMergeInput;
    }
  | {
      operation: 'preview_rebundle';
      input: PreviewTrustedRebundleInput;
    }
  | {
      operation: 'audit_readiness';
      input?: AuditTrustedExchangeReadinessInput;
    };

export type TrustedExchangeFunctionResult<TValue> = {
  value: TValue | null;
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
};
