/**
 * File: trusted_certification_types.ts
 * Description: Contracts for certification tickets, signature handoff, and archive-ready candidate packages.
 */

import type {
  TrustedBuildResult,
  TrustedPacketCandidateGraph,
} from '@runtime/trusted_coordinators/trusted_building_coordinator/index.ts';
import type {
  TrustedInspectionReport,
} from '@runtime/trusted_coordinators/trusted_inspection_coordinator/index.ts';
import type {
  TrustedOperationPlan,
  TrustedPlanningContextMode,
} from '@runtime/trusted_coordinators/trusted_planning_coordinator/index.ts';
import type {
  PacketEnvelope,
} from '@core/schema/packet-schema';
import type {
  TrustedRuntimeCoordinatorIssue,
  TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export const TRUSTED_CERTIFICATION_COORDINATOR_ID = 'trusted_certification_coordinator.v0' as const;

export type TrustedCertificationContextMode = TrustedPlanningContextMode;

export type TrustedCertificationHashBundle = {
  hash_kind: 'trusted.certification_hash_bundle';
  plan_hash: string;
  build_result_hash: string;
  inspection_report_hash: string;
  candidate_graph_hash: string;
  payload_hash: string;
};

export type TrustedCertificationExpectedPacket = {
  packet_id: string;
  revision_id: string;
  packet_type: string;
  unsigned_digest: string;
};

export type TrustedCertificationTicket = {
  ticket_kind: 'trusted.certification_ticket';
  ticket_id: string;
  operation_id: string | null;
  request_id: string | null;
  source_plan_id: string | null;
  source_build_result_plan_id: string | null;
  required_signer_ref: string | null;
  required_signature_purpose: 'packet_candidate_certification';
  issued_at: string;
  expires_at: string;
  status: 'open' | 'signed_returned' | 'certified' | 'expired' | 'rejected';
  hashes: TrustedCertificationHashBundle;
  candidate_count: number;
  blocker_count: number;
  warning_count: number;
  dispatch_return_kind: 'certification.ticket.signed_return';
  human_summary: string;
  expected_packets: TrustedCertificationExpectedPacket[];
};

export type TrustedSignatureRequest = {
  request_kind: 'trusted.signature_request';
  ticket_id: string;
  required_signer_ref: string | null;
  required_signature_purpose: 'packet_candidate_certification';
  payload_hash: string;
  expires_at: string;
  instructions: string;
};

export type TrustedSignedCertificationTicket = {
  signed_ticket_kind: 'trusted.signed_certification_ticket';
  ticket_id: string;
  signer_ref: string;
  signed_payload_hash: string;
  signature_value: string;
  signature_method: string;
  signed_at: string;
};

export type TrustedCertificationPackage = {
  package_kind: 'trusted.certification_package';
  ticket: TrustedCertificationTicket;
  signature_requests: TrustedSignatureRequest[];
  source_plan_id: string | null;
  archive_ready: false;
  blockers: string[];
  warnings: string[];
};

export type TrustedCertifiedPacketSet = {
  certified_kind: 'trusted.certified_packet_set';
  certification_id: string;
  ticket_id: string;
  certified_at: string;
  signer_ref: string;
  source_plan_id: string | null;
  hashes: TrustedCertificationHashBundle;
  candidate_graph: TrustedPacketCandidateGraph;
  certified_packet_keys: string[];
  archive_ready: boolean;
  blockers: string[];
  warnings: string[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
};

export type TrustedCertificationReadinessReport = {
  report_kind: 'trusted.certification_readiness_report';
  mode: TrustedCertificationContextMode;
  ready: boolean;
  checked_inspection_count: number;
  prepared_ticket_count: number;
  certifiable_ticket_count: number;
  blocking_issue_count: number;
  warning_count: number;
  packages: TrustedCertificationPackage[];
};

export type PrepareTrustedCertificationTicketInput = {
  plan: TrustedOperationPlan;
  build_result: TrustedBuildResult;
  inspection_report: TrustedInspectionReport;
  actor_packet_id?: string | null;
  node_element_id?: string | null;
  request_id?: string | null;
  operation_id?: string | null;
  expected_packets?: readonly TrustedCertificationExpectedPacket[];
  ttl_ms?: number;
  context_mode?: TrustedCertificationContextMode;
};

export type PrepareTrustedSignatureRequestsInput = {
  ticket: TrustedCertificationTicket;
  context_mode?: TrustedCertificationContextMode;
};

export type CertifyTrustedSignedTicketInput = {
  signed_ticket: TrustedSignedCertificationTicket;
  context_mode?: TrustedCertificationContextMode;
};

export type CertifyTrustedSignedPacketBundleInput = {
  ticket_id: string;
  signed_packets: unknown[];
  signer_packet?: PacketEnvelope | null;
  context_mode?: TrustedCertificationContextMode;
};

export type VerifyTrustedSignedTicketInput = {
  signed_ticket: TrustedSignedCertificationTicket;
  context_mode?: TrustedCertificationContextMode;
};

export type AuditTrustedCertificationReadinessInput = {
  context_mode?: TrustedCertificationContextMode;
  node_element_id?: string | null;
  packet_type_filters?: readonly string[];
};

export type TrustedCertificationOperation =
  | 'prepare_certification_ticket'
  | 'prepare_signature_requests'
  | 'verify_signed_ticket'
  | 'certify_signed_ticket'
  | 'certify_signed_packet_bundle'
  | 'audit_readiness';

export type TrustedCertificationCoordinatorRequest =
  | {
      operation: 'prepare_certification_ticket';
      input: PrepareTrustedCertificationTicketInput;
    }
  | {
      operation: 'prepare_signature_requests';
      input: PrepareTrustedSignatureRequestsInput;
    }
  | {
      operation: 'verify_signed_ticket';
      input: VerifyTrustedSignedTicketInput;
    }
  | {
      operation: 'certify_signed_ticket';
      input: CertifyTrustedSignedTicketInput;
    }
  | {
      operation: 'certify_signed_packet_bundle';
      input: CertifyTrustedSignedPacketBundleInput;
    }
  | {
      operation: 'audit_readiness';
      input?: AuditTrustedCertificationReadinessInput;
    };

export type StoredTrustedCertificationTicket = {
  ticket: TrustedCertificationTicket;
  plan: TrustedOperationPlan;
  build_result: TrustedBuildResult;
  inspection_report: TrustedInspectionReport;
  consumed_at: string | null;
};
