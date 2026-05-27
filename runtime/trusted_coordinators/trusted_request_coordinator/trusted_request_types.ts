/**
 * File: trusted_request_types.ts
 * Description: Types for the Trusted Request Coordinator intake boundary.
 */

import type {
  PacketClientIntentEnrollment,
  PacketClientIntentEnrollmentAuditReport,
  PacketClientIntentPreflight,
} from '@runtime/nexus/server/packet-client-intent-enrollment';
import type { TrustedRuntimeCoordinatorMode } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export type TrustedRequestSourceKind = 'interface_signal' | 'api_route' | 'runtime_internal' | 'debug_audit';

export type TrustedRequestOperationKind =
  | 'mutation_prepare'
  | 'mutation_finalize'
  | 'projection_read'
  | 'definition_read'
  | 'debug_audit';

export type NormalizeTrustedRequestInput = {
  source_kind: TrustedRequestSourceKind;
  source_route: string;
  operation_kind?: TrustedRequestOperationKind | null;
  client_intent_id?: string | null;
  mutation_intent?: string | null;
  connector_id?: string | null;
  request_id?: string | null;
  actor_packet_id?: string | null;
  node_packet_id?: string | null;
  payload?: unknown;
  mode?: TrustedRuntimeCoordinatorMode | string | null;
};

export type TrustedRuntimeRequest = {
  request_kind: 'trusted.runtime_request';
  request_id: string;
  source_kind: TrustedRequestSourceKind;
  source_route: string;
  operation_kind: TrustedRequestOperationKind;
  client_intent_id: string | null;
  mutation_intent: string | null;
  connector_id: string | null;
  actor_packet_id: string | null;
  node_packet_id: string | null;
  payload: unknown;
  mode: TrustedRuntimeCoordinatorMode | string;
  normalized_at: string;
};

export type PreflightTrustedClientIntentInput = {
  sourceRoute: string;
  mutationIntent?: string | null;
  connectorId?: string | null;
  clientIntentId?: string | null;
  requestId?: string | null;
  mode?: TrustedRuntimeCoordinatorMode | string | null;
};

export type ListTrustedRequestEnrollmentsInput = {
  mode?: TrustedRuntimeCoordinatorMode | string | null;
};

export type AuditTrustedRequestReadinessInput = {
  mode?: TrustedRuntimeCoordinatorMode | string | null;
};

export type TrustedRequestEnrollmentList = {
  list_kind: 'trusted.request_enrollments';
  enrollments: PacketClientIntentEnrollment[];
};

export type TrustedRequestReadinessReport = PacketClientIntentEnrollmentAuditReport & {
  report_kind: 'trusted.request_readiness';
};

export type TrustedRequestPreflight = PacketClientIntentPreflight & {
  request_id: string | null;
};
