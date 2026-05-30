/**
 * File: nexus-api-types.mutations.ts
 * Description: Shared prepare/finalize mutation transport payloads for the Dispatch corridor.
 */

import type {
  MutationPersistEffect,
  PreparedWriteTicket,
  PreparedMutation,
} from '@core/auth/mutation-corridor';

export interface NexusPreparedMutationPayload {
  ticket: PreparedWriteTicket;
  prepared_mutation: PreparedMutation;
}

export interface NexusFinalizedMutationPayload {
  kind: string;
  persist_effects: MutationPersistEffect[];
  result: unknown;
}
