/**
 * File: nexus-api-types.mutations.ts
 * Description: Shared prepare/finalize mutation transport payloads for the fortress corridor.
 */

import type {
  MutationPersistEffect,
  MutationTicket,
  PreparedMutation,
} from '@core/auth/mutation-corridor';

export interface NexusPreparedMutationPayload {
  ticket: MutationTicket;
  prepared_mutation: PreparedMutation;
}

export interface NexusFinalizedMutationPayload {
  kind: string;
  persist_effects: MutationPersistEffect[];
  result: unknown;
}
