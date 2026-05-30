/**
 * File: trusted_archive_types.ts
 * Description: Contracts for the Trusted Archive Coordinator packet-store write/read/query seam.
 */

import type {
  BundleImportResult,
  BundleExportResult,
  PacketEdgeQuery,
  PacketHeadStatus,
  PacketReadValue,
  PacketStore,
} from '@core/contracts';
import type {
  PacketEdge,
  PacketReadMode,
  PacketRef,
  PacketRevisionRef,
  PacketType,
} from '@core/schema/packet-schema';
import type { PacketSearchIndexRecord } from '@runtime/storage/sqlite-records';
import type {
  TrustedCertifiedPacketSet,
  TrustedCertificationContextMode,
} from '@runtime/trusted_coordinators/trusted_certification_coordinator/index.ts';
import type {
  TrustedRuntimeCoordinatorIssue,
  TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export const TRUSTED_ARCHIVE_COORDINATOR_ID = 'trusted_archive_coordinator.v0' as const;

export type TrustedArchiveContextMode = TrustedCertificationContextMode;

export type TrustedArchiveStoreContext = {
  packet_store?: PacketStore | null;
  database_path?: string | null;
};

export type TrustedArchiveWriteMode = 'write_and_publish' | 'write_only';

export type TrustedArchivedPacketWrite = {
  packet_ref: PacketRef;
  revision_ref: PacketRevisionRef;
  published: boolean;
  packet_type: PacketType;
};

export type TrustedArchiveReceipt = {
  receipt_kind: 'trusted.archive_receipt';
  archive_id: string;
  source_certification_id: string | null;
  source_ticket_id: string | null;
  archived_at: string;
  write_mode: TrustedArchiveWriteMode;
  requested_candidate_count: number;
  extracted_packet_count: number;
  written_packet_count: number;
  published_packet_count: number;
  skipped_packet_count: number;
  writes: TrustedArchivedPacketWrite[];
  skipped_candidate_ids: string[];
  blockers: string[];
  warnings: string[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
};

export type TrustedArchivePacketCard = {
  packet: PacketRef;
  revision: PacketRevisionRef;
  type: string;
  label: string;
  title: string;
  summary: string | null;
  status: string | null;
  authority_scope_packet_id: string | null;
  applicable_scope_ids: string[];
  tags: string[];
  created_at: string;
};

export type TrustedArchiveQueryResult = {
  result_kind: 'trusted.archive_query_result';
  total_count: number;
  offset: number;
  limit: number;
  packets: TrustedArchivePacketCard[];
};

export type TrustedArchiveReadResult<TMode extends PacketReadMode = 'adapted'> = {
  result_kind: 'trusted.archive_read_result';
  packet_ref: PacketRef;
  revision_ref: PacketRevisionRef | null;
  mode: TMode;
  packet: PacketReadValue<TMode> | null;
};

export type TrustedArchiveRevisionResolution = {
  result_kind: 'trusted.archive_revision_resolution';
  packet_ref: PacketRef;
  requested_revision_id: string | null;
  preferred_revision: PacketRevisionRef | null;
  resolved_revision: PacketRevisionRef | null;
  heads: PacketHeadStatus;
};

export type TrustedArchiveEdgeResult = {
  result_kind: 'trusted.archive_edge_result';
  packet_ref: PacketRef;
  edge_count: number;
  edges: PacketEdge[];
};

export type TrustedArchiveBundleExport = BundleExportResult & {
  result_kind: 'trusted.archive_bundle_export';
};

export type TrustedArchiveBundleImport = BundleImportResult & {
  result_kind: 'trusted.archive_bundle_import';
};

export type TrustedArchivePreferredHeadSnapshot = {
  packet_id: string;
  preferred_revision_id: string | null;
  head_revision_ids: string[];
};

export type TrustedArchivePreferredHeadRepair = {
  result_kind: 'trusted.archive_preferred_head_repair';
  packet_count: number;
  repaired_packet_count: number;
  restored_preferred_packet_count: number;
  diverged_packet_count: number;
};

export type TrustedArchiveReadinessReport = {
  report_kind: 'trusted.archive_readiness_report';
  mode: TrustedArchiveContextMode;
  ready: boolean;
  database_path: string | null;
  packet_count: number;
  preferred_packet_count: number;
  search_row_count: number;
  blocking_issue_count: number;
  warning_count: number;
};

export type StoreTrustedCertifiedPacketSetInput = TrustedArchiveStoreContext & {
  certified_packet_set: TrustedCertifiedPacketSet;
  write_mode?: TrustedArchiveWriteMode;
  context_mode?: TrustedArchiveContextMode;
};

export type ReadTrustedArchivedPacketInput<TMode extends PacketReadMode = 'adapted'> = TrustedArchiveStoreContext & {
  packet_ref: PacketRef;
  revision_ref?: PacketRevisionRef | null;
  mode?: TMode;
  target_schema_version?: string;
  context_mode?: TrustedArchiveContextMode;
};

export type QueryTrustedArchivedPacketsInput = TrustedArchiveStoreContext & {
  packet_type?: PacketType | null;
  text?: string | null;
  authority_scope_packet_id?: string | null;
  limit?: number;
  offset?: number;
  context_mode?: TrustedArchiveContextMode;
};

export type ResolveTrustedArchivedRevisionInput = TrustedArchiveStoreContext & {
  packet_ref: PacketRef;
  revision_id?: string | null;
  context_mode?: TrustedArchiveContextMode;
};

export type QueryTrustedArchiveEdgesInput = TrustedArchiveStoreContext & {
  packet_ref: PacketRef;
  query?: PacketEdgeQuery;
  context_mode?: TrustedArchiveContextMode;
};

export type ExportTrustedArchiveBundleInput = TrustedArchiveStoreContext & {
  packet_refs: PacketRef[];
  context_mode?: TrustedArchiveContextMode;
};

export type ImportTrustedArchiveBundleInput = TrustedArchiveStoreContext & {
  bundle: Uint8Array | ArrayBuffer | string;
  context_mode?: TrustedArchiveContextMode;
};

export type RepairTrustedArchivePreferredHeadsInput = TrustedArchiveStoreContext & {
  packet_ids: string[];
  snapshots: TrustedArchivePreferredHeadSnapshot[];
  context_mode?: TrustedArchiveContextMode;
};

export type AuditTrustedArchiveReadinessInput = TrustedArchiveStoreContext & {
  context_mode?: TrustedArchiveContextMode;
};

export type TrustedArchiveOperation =
  | 'store_certified_packet_set'
  | 'read_packet'
  | 'query_packets'
  | 'resolve_revision'
  | 'query_edges'
  | 'export_bundle'
  | 'import_bundle'
  | 'repair_preferred_heads_after_import'
  | 'audit_readiness';

export type TrustedArchiveCoordinatorRequest =
  | {
      operation: 'store_certified_packet_set';
      input: StoreTrustedCertifiedPacketSetInput;
    }
  | {
      operation: 'read_packet';
      input: ReadTrustedArchivedPacketInput;
    }
  | {
      operation: 'query_packets';
      input?: QueryTrustedArchivedPacketsInput;
    }
  | {
      operation: 'resolve_revision';
      input: ResolveTrustedArchivedRevisionInput;
    }
  | {
      operation: 'query_edges';
      input: QueryTrustedArchiveEdgesInput;
    }
  | {
      operation: 'export_bundle';
      input: ExportTrustedArchiveBundleInput;
    }
  | {
      operation: 'import_bundle';
      input: ImportTrustedArchiveBundleInput;
    }
  | {
      operation: 'repair_preferred_heads_after_import';
      input: RepairTrustedArchivePreferredHeadsInput;
    }
  | {
      operation: 'audit_readiness';
      input?: AuditTrustedArchiveReadinessInput;
    };

export type TrustedArchivePacketEnvelopeCarrier = {
  packet?: unknown;
  envelope?: unknown;
  packet_envelope?: unknown;
};

export type TrustedArchiveSearchRow = PacketSearchIndexRecord;
