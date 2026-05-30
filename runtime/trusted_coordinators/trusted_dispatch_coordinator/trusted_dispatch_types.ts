/**
 * File: trusted_dispatch_types.ts
 * Description: Public types for the Trusted Dispatch Coordinator.
 */

import type {
  MutationIntent,
  MutationPersistEffect,
  PreparedWriteTicket,
  PreparedMutation,
} from '@core/auth/mutation-corridor';
import type { PacketStore } from '@core/contracts';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';

export type {
  AuditTrustedRequestReadinessInput as AuditTrustedDispatchReadinessInput,
  ListTrustedRequestEnrollmentsInput as ListTrustedDispatchEnrollmentsInput,
  NormalizeTrustedRequestInput as NormalizeTrustedDispatchRequestInput,
  PreflightTrustedClientIntentInput as PreflightTrustedDispatchClientIntentInput,
  TrustedRequestEnrollmentList as TrustedDispatchEnrollmentList,
  TrustedRequestOperationKind as TrustedDispatchOperationKind,
  TrustedRequestPreflight as TrustedDispatchPreflight,
  TrustedRequestReadinessReport as TrustedDispatchReadinessReport,
  TrustedRequestSourceKind as TrustedDispatchSourceKind,
  TrustedRuntimeRequest as TrustedRuntimeDispatchRequest,
} from '@runtime/trusted_coordinators/trusted_request_coordinator/trusted_request_types.ts';

export type TrustedDispatchPreparedMutationResult = {
  ticket: PreparedWriteTicket;
  prepared_mutation: PreparedMutation;
};

export type TrustedDispatchFinalizedMutationResult = {
  kind: MutationIntent['kind'];
  persist_effects: MutationPersistEffect[];
  result: unknown;
};

export type PrepareTrustedDispatchMutationWriteInput = {
  source_route: string;
  client_intent_id?: string | null;
  request_id?: string | null;
  intent: MutationIntent;
  actor_packet: PacketEnvelopeByType['Element'];
  actor_key: string;
  packet_store?: PacketStore | null;
};

export type FinalizeTrustedDispatchMutationWriteInput = {
  source_route: string;
  client_intent_id?: string | null;
  request_id?: string | null;
  mutation_intent?: MutationIntent['kind'] | null;
  actor_packet: PacketEnvelopeByType['Element'];
  request: {
    ticket_id: string;
    signed_packets: unknown[];
  };
  packet_store?: PacketStore | null;
};
