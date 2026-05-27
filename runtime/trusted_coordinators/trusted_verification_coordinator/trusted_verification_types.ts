/**
 * File: trusted_verification_types.ts
 * Description: Contracts for the Trusted Verification Coordinator packet, bundle, archive, lineage, refs, and certification checks.
 */

import type {
  PacketCompatibilityReadResult,
  PacketEnvelope,
  PacketRef,
  PacketRevisionRef,
  PacketType,
} from '@core/schema/packet-schema';
import type { PacketStore } from '@core/contracts';
import type {
  TrustedCertifiedPacketSet,
  TrustedCertificationContextMode,
} from '@runtime/trusted_coordinators/trusted_certification_coordinator/trusted_certification_types.ts';
import type {
  TrustedRuntimeCoordinatorIssue,
  TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export const TRUSTED_VERIFICATION_COORDINATOR_ID = 'trusted_verification_coordinator.v0' as const;

export type TrustedVerificationContextMode = TrustedCertificationContextMode;

export type TrustedVerificationMode =
  | 'strict'
  | 'advisory'
  | 'compatibility'
  | 'reseed'
  | 'archive_sweep';

export type TrustedVerificationStoreContext = {
  packet_store?: PacketStore | null;
  database_path?: string | null;
};

export type TrustedVerificationTargetKind =
  | 'packet'
  | 'packet_batch'
  | 'bundle'
  | 'archive_packet_set'
  | 'packet_lineage'
  | 'packet_refs'
  | 'certification_result'
  | 'readiness';

export type TrustedVerificationCheckStatus =
  | 'passed'
  | 'failed'
  | 'warning'
  | 'skipped'
  | 'unknown';

export type TrustedVerificationOverallStatus =
  | 'passed'
  | 'warning'
  | 'blocked'
  | 'unknown';

export type TrustedVerificationCompatibilityStatus =
  | 'native'
  | 'adapted'
  | 'lossy'
  | 'blocked'
  | 'unknown';

export type TrustedVerificationSignatureStatus =
  | 'valid'
  | 'missing'
  | 'unverifiable'
  | 'invalid'
  | 'canonicalization_mismatch'
  | 'signer_mismatch'
  | 'key_binding_missing'
  | 'unknown';

export type TrustedVerificationSignerStatus =
  | 'known'
  | 'missing'
  | 'unknown'
  | 'unusable';

export type TrustedVerificationPacketEntry = {
  entry_id?: string | null;
  packet?: unknown;
  raw_packet?: unknown;
  signer_packet?: unknown | null;
  packet_ref?: PacketRef | null;
  revision_ref?: PacketRevisionRef | null;
};

export type TrustedPacketVerificationResult = {
  result_kind: 'trusted.packet_verification_result';
  entry_id: string | null;
  packet_ref: PacketRef | null;
  revision_ref: PacketRevisionRef | null;
  packet_type: PacketType | string | null;
  packet_subtype: string | null;
  structural_status: TrustedVerificationCheckStatus;
  compatibility_status: TrustedVerificationCompatibilityStatus;
  digest_status: TrustedVerificationCheckStatus;
  signature_status: TrustedVerificationSignatureStatus;
  signer_status: TrustedVerificationSignerStatus;
  lineage_status: TrustedVerificationCheckStatus;
  ref_status: TrustedVerificationCheckStatus;
  overall_status: TrustedVerificationOverallStatus;
  signer_packet_ref: PacketRef | null;
  declared_schema_version: string | null;
  target_schema_version: string | null;
  warnings: string[];
  blockers: string[];
};

export type TrustedVerificationReport = {
  report_kind: 'trusted.verification_report';
  verification_id: string;
  target_kind: TrustedVerificationTargetKind;
  verification_mode: TrustedVerificationMode;
  checked_at: string;
  packet_count: number;
  passed_count: number;
  failed_count: number;
  skipped_count: number;
  blocking_issue_count: number;
  warning_count: number;
  packet_results: TrustedPacketVerificationResult[];
  hash_results: string[];
  signature_results: string[];
  lineage_results: string[];
  ref_results: string[];
  certification_results: string[];
  blockers: string[];
  warnings: string[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
};

export type TrustedVerificationReadinessReport = {
  report_kind: 'trusted.verification_readiness_report';
  mode: TrustedVerificationContextMode;
  ready: boolean;
  checked_function_count: number;
  archive_backed_path_available: boolean;
  signature_verifier_available: boolean;
  packet_schema_parser_available: boolean;
  certification_result_path_available: boolean;
  blocking_issue_count: number;
  warning_count: number;
};

export type VerifyTrustedPacketInput = TrustedVerificationStoreContext & {
  packet?: unknown;
  raw_packet?: unknown;
  signer_packet?: unknown | null;
  entry_id?: string | null;
  target_schema_version?: string;
  verification_mode?: TrustedVerificationMode;
  context_mode?: TrustedVerificationContextMode;
};

export type VerifyTrustedPacketBatchInput = TrustedVerificationStoreContext & {
  packets: TrustedVerificationPacketEntry[];
  signer_packets?: unknown[];
  target_schema_version?: string;
  verification_mode?: TrustedVerificationMode;
  context_mode?: TrustedVerificationContextMode;
};

export type VerifyTrustedBundleInput = TrustedVerificationStoreContext & {
  bundle: unknown;
  signer_packets?: unknown[];
  target_schema_version?: string;
  verification_mode?: TrustedVerificationMode;
  context_mode?: TrustedVerificationContextMode;
};

export type VerifyTrustedArchivePacketSetInput = TrustedVerificationStoreContext & {
  packet_refs?: PacketRef[];
  revision_refs?: PacketRevisionRef[];
  target_schema_version?: string;
  verification_mode?: TrustedVerificationMode;
  context_mode?: TrustedVerificationContextMode;
};

export type VerifyTrustedPacketLineageInput = TrustedVerificationStoreContext & {
  packets?: TrustedVerificationPacketEntry[];
  signer_packets?: unknown[];
  packet_refs?: PacketRef[];
  revision_refs?: PacketRevisionRef[];
  target_schema_version?: string;
  verification_mode?: TrustedVerificationMode;
  context_mode?: TrustedVerificationContextMode;
};

export type VerifyTrustedPacketRefsInput = TrustedVerificationStoreContext & {
  packets?: TrustedVerificationPacketEntry[];
  signer_packets?: unknown[];
  packet_refs?: PacketRef[];
  revision_refs?: PacketRevisionRef[];
  target_schema_version?: string;
  verification_mode?: TrustedVerificationMode;
  context_mode?: TrustedVerificationContextMode;
};

export type VerifyTrustedCertificationResultInput = {
  certified_packet_set: TrustedCertifiedPacketSet;
  recompute_candidate_graph_hash?: boolean;
  target_schema_version?: string;
  verification_mode?: TrustedVerificationMode;
  context_mode?: TrustedVerificationContextMode;
};

export type AuditTrustedVerificationReadinessInput = {
  context_mode?: TrustedVerificationContextMode;
};

export type TrustedVerificationOperation =
  | 'verify_packet'
  | 'verify_packet_batch'
  | 'verify_bundle'
  | 'verify_archive_packet_set'
  | 'verify_packet_lineage'
  | 'verify_packet_refs'
  | 'verify_certification_result'
  | 'audit_readiness';

export type TrustedVerificationCoordinatorRequest =
  | {
      operation: 'verify_packet';
      input: VerifyTrustedPacketInput;
    }
  | {
      operation: 'verify_packet_batch';
      input: VerifyTrustedPacketBatchInput;
    }
  | {
      operation: 'verify_bundle';
      input: VerifyTrustedBundleInput;
    }
  | {
      operation: 'verify_archive_packet_set';
      input: VerifyTrustedArchivePacketSetInput;
    }
  | {
      operation: 'verify_packet_lineage';
      input: VerifyTrustedPacketLineageInput;
    }
  | {
      operation: 'verify_packet_refs';
      input: VerifyTrustedPacketRefsInput;
    }
  | {
      operation: 'verify_certification_result';
      input: VerifyTrustedCertificationResultInput;
    }
  | {
      operation: 'audit_readiness';
      input?: AuditTrustedVerificationReadinessInput;
    };

export type TrustedVerificationCompatibilityCarrier = PacketCompatibilityReadResult;
export type TrustedVerificationPacketEnvelopeCarrier = PacketEnvelope;
