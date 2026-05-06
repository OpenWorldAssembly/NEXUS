/**
 * File: nexus-api-types.explorer.ts
 * Description: Packet Explorer payloads shared across Nexus routes and clients.
 */

import type {
  NexusActionIntentDescriptor,
  NexusActionMap,
  PacketHeadStatus,
} from '@core/contracts';
import type {
  PacketAdaptationChange,
  PacketAdaptationLoss,
  PacketFamily,
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
  family_conflict_count: number;
  status: NexusPacketExplorerImportStatus;
  blocking_errors: string[];
  warnings: string[];
  open_packet_id: string | null;
  source_file_name: string | null;
}

export interface NexusPacketExplorerImportCommitPayload
  extends NexusPacketExplorerImportPreviewPayload {
  committed: boolean;
  imported_revision_count: number;
  skipped_duplicate_count: number;
  restored_preferred_packet_count: number;
  diverged_packet_count: number;
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
  family: PacketFamily | null;
  label: string | null;
  title: string | null;
  metadata: Record<string, unknown>;
}

export interface NexusPacketExplorerLinkGroup {
  direction: 'incoming' | 'outgoing';
  packet_id: string;
  family: PacketFamily | null;
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
  source_family: PacketFamily;
  target_family: PacketFamily;
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
  family: PacketFamily;
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
}
