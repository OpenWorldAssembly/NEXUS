/**
 * File: nexus-api-types.explorer.ts
 * Description: Packet Explorer payloads shared across Nexus routes and clients.
 */

import type {
  NexusActionIntentDescriptor,
  NexusActionMap,
  NexusPacketValidationMode,
  NexusPacketVerificationSummary,
  PacketHeadStatus,
} from '@core/contracts';
import type {
  PacketAdaptationChange,
  PacketAdaptationLoss,
  PacketType,
  PacketRef,
  PacketRevisionRef,
} from '@core/schema/packet-schema';

export type NexusPacketExplorerInspectionLens =
  | 'summary'
  | 'raw'
  | 'adapted'
  | 'read_model';

export type NexusPacketExplorerExportArtifactMode = 'raw_packet' | 'bundle';
export type NexusPacketExplorerBundleExportMode =
  | 'packet_history'
  | 'with_references'
  | 'with_referrers'
  | 'with_scope_stack'
  | 'with_references_referrers_scope_stack'
  | 'full_store';

export type NexusPacketExplorerImportArtifactType =
  | 'raw_packet'
  | 'bundle'
  | 'revision_array';
export type NexusPacketExplorerSearchScopeMode = 'all_known';
export type NexusPacketExplorerSearchGroupKey = 'direct' | 'name' | 'text';
export type NexusPacketExplorerSearchActiveGroup =
  | 'all'
  | NexusPacketExplorerSearchGroupKey;
export type NexusPacketExplorerSearchMatchType =
  | 'packet_id_exact'
  | 'revision_id_exact'
  | 'packet_id_prefix'
  | 'revision_id_prefix'
  | 'title_exact'
  | 'label_exact'
  | 'title_contains'
  | 'label_contains'
  | 'summary_contains'
  | 'tag_contains'
  | 'type_contains';

export type NexusPacketExplorerImportStatus =
  | 'ready'
  | 'duplicates_only'
  | 'partial_risk'
  | 'blocked'
  | 'invalid_json';

export interface NexusPacketExplorerExportRequest {
  artifact_mode: NexusPacketExplorerExportArtifactMode;
  root_packet_id?: string | null;
  bundle_mode?: NexusPacketExplorerBundleExportMode | null;
  title?: string | null;
  note?: string | null;
}

export interface NexusPacketExplorerImportRequest {
  source_text: string;
  file_name?: string | null;
  validation_mode?: NexusPacketValidationMode | null;
}

export interface NexusPacketExplorerImportHistoryRequest {
  limit?: number | null;
}

export interface NexusPacketExplorerValidationCounts {
  trusted_signer: number;
  signature_valid: number;
  unknown_signer: number;
  unsigned: number;
  signature_invalid: number;
  canonicalization_mismatch: number;
}

export interface NexusPacketExplorerSearchRequest {
  query: string;
  limit_per_group?: number | null;
  active_group?: NexusPacketExplorerSearchActiveGroup | null;
  page?: number | null;
  page_size?: number | null;
  scope_mode?: NexusPacketExplorerSearchScopeMode | null;
  selected_packet_id?: string | null;
}

export interface NexusPacketExplorerExportPreviewPayload {
  artifact_mode: NexusPacketExplorerExportArtifactMode;
  export_mode:
    | 'raw_current_preferred'
    | NexusPacketExplorerBundleExportMode;
  root_packet_refs: PacketRef[];
  title: string | null;
  note: string | null;
  packet_count: number;
  revision_count: number;
  byte_count: number;
  file_name: string;
  preview_suppressed: boolean;
  preview_json: string | null;
}

export interface NexusPacketExplorerImportPreviewPayload {
  artifact_type: NexusPacketExplorerImportArtifactType | null;
  bundle_version: string | number | null;
  title: string | null;
  note: string | null;
  export_mode: string | null;
  root_packet_refs: PacketRef[];
  packet_count: number;
  revision_count: number;
  unique_packet_count: number;
  unique_revision_count: number;
  new_revision_count: number;
  duplicate_revision_count: number;
  affected_packet_count: number;
  affected_packet_ids: string[];
  missing_parent_count: number;
  invalid_entry_count: number;
  type_conflict_count: number;
  status: NexusPacketExplorerImportStatus;
  blocking_errors: string[];
  warnings: string[];
  open_packet_id: string | null;
  source_file_name: string | null;
  validation_mode: NexusPacketValidationMode;
  validation_counts: NexusPacketExplorerValidationCounts;
  validation_blocked_count: number;
  validation_report_packet_ids: string[];
}

export interface NexusPacketExplorerImportCommitPayload
  extends NexusPacketExplorerImportPreviewPayload {
  committed: boolean;
  imported_revision_count: number;
  skipped_duplicate_count: number;
  restored_preferred_packet_count: number;
  diverged_packet_count: number;
  import_report_packet_id: string | null;
  created_verification_report_packet_ids: string[];
}

export interface NexusPacketExplorerImportHistoryEntry {
  report_packet_id: string;
  report_revision_id: string;
  source: 'local' | 'external';
  status: string;
  title: string;
  summary: string | null;
  created_at: string;
  validator_packet_id: string | null;
  source_file_name: string | null;
  source_digest: string | null;
  artifact_type: string | null;
  bundle_version: string | number | null;
  export_mode: string | null;
  validation_mode: string | null;
  imported_count: number;
  skipped_count: number;
  blocked_count: number;
  affected_packet_ids: string[];
}

export interface NexusPacketExplorerImportHistoryPayload {
  entries: NexusPacketExplorerImportHistoryEntry[];
}

export interface NexusPacketExplorerVerificationReportSummary {
  report_packet_id: string;
  report_revision_id: string;
  source: 'local' | 'external';
  subtype: 'verification_report' | 'import_report';
  status: string;
  title: string;
  summary: string | null;
  created_at: string;
  validator_packet_id: string | null;
}

export interface NexusPacketExplorerSearchResultRow {
  packet_id: string;
  revision_id: string | null;
  type: PacketType;
  title: string;
  label: string;
  summary: string | null;
  status: string | null;
  authority_scope_packet_id: string | null;
  applicable_scope_ids: string[];
  match_group: NexusPacketExplorerSearchGroupKey;
  match_type: NexusPacketExplorerSearchMatchType;
  match_reason: string;
  score: number;
  matched_revision_id: string | null;
  created_at: string;
  verification: NexusPacketVerificationSummary | null;
}

export interface NexusPacketExplorerSearchGroup {
  key: NexusPacketExplorerSearchGroupKey;
  label: string;
  count: number;
  truncated: boolean;
  current_page: number;
  page_size: number;
  total_pages: number;
  results: NexusPacketExplorerSearchResultRow[];
}

export interface NexusPacketExplorerSearchPayload {
  query: string;
  active_group: NexusPacketExplorerSearchActiveGroup;
  page: number;
  page_size: number;
  scope_mode: NexusPacketExplorerSearchScopeMode;
  limit_per_group: number;
  total_result_count: number;
  groups: NexusPacketExplorerSearchGroup[];
}

export type NexusPacketExplorerSectionBasis =
  | 'historical_raw_packet'
  | 'current_adapted_packet'
  | 'read_model_projection'
  | 'current_indexed_graph'
  | 'runtime_operational';

export interface NexusPacketExplorerScopeSummary {
  packet_id: string;
  label: string | null;
}

export interface NexusPacketExplorerLinkRow {
  direction: 'incoming' | 'outgoing';
  edge_type: string;
  packet_id: string;
  revision_id: string | null;
  type: PacketType | null;
  label: string | null;
  title: string | null;
  metadata: Record<string, unknown>;
}

export interface NexusPacketExplorerLinkGroup {
  direction: 'incoming' | 'outgoing';
  packet_id: string;
  type: PacketType | null;
  label: string | null;
  title: string | null;
  total_count: number;
  edge_type_counts: {
    edge_type: string;
    count: number;
  }[];
  rows: NexusPacketExplorerLinkRow[];
}

export interface NexusPacketExplorerAdaptationSummary {
  compatibility_mode: 'native' | 'adapted' | 'downcast' | 'lossy' | 'blocked';
  source_type: PacketType;
  target_type: PacketType;
  source_schema_version: string;
  target_schema_version: string;
  stages: string[];
  changes: PacketAdaptationChange[];
  losses: PacketAdaptationLoss[];
  warnings: string[];
  requires_guarded_migration: boolean;
  requires_loss_acknowledgement: boolean;
}

export interface NexusPacketExplorerSummary {
  packet: PacketRef;
  revision: PacketRevisionRef;
  type: PacketType;
  label: string;
  title: string;
  summary: string | null;
  kind: string | null;
  schema_version: string;
  created_at: string;
  authority_scope: NexusPacketExplorerScopeSummary | null;
  applicable_scopes: NexusPacketExplorerScopeSummary[];
}

export interface NexusPacketExplorerPayload {
  inspection_lens: NexusPacketExplorerInspectionLens;
  packet_summary: NexusPacketExplorerSummary;
  preferred_revision: PacketRevisionRef;
  head_revisions: PacketRevisionRef[];
  revision_state: PacketHeadStatus['revision_state'];
  raw_view: unknown;
  adapted_view: unknown;
  read_model_view: unknown | null;
  adaptation_summary: NexusPacketExplorerAdaptationSummary;
  links_basis: NexusPacketExplorerSectionBasis;
  actions_basis: NexusPacketExplorerSectionBasis;
  incoming_links: NexusPacketExplorerLinkRow[];
  outgoing_links: NexusPacketExplorerLinkRow[];
  incoming_link_groups: NexusPacketExplorerLinkGroup[];
  outgoing_link_groups: NexusPacketExplorerLinkGroup[];
  actions: NexusActionMap;
  action_descriptors: NexusActionIntentDescriptor[];
  verification_basis: NexusPacketExplorerSectionBasis;
  verification_summary: NexusPacketVerificationSummary | null;
  verification_report_target_revision_id: string | null;
  verification_freshness: 'current' | 'stale' | 'not_validated';
  is_current_for_preferred_revision: boolean;
  local_validator_packet_id: string | null;
  local_verification_reports: NexusPacketExplorerVerificationReportSummary[];
  external_verification_reports: NexusPacketExplorerVerificationReportSummary[];
}
