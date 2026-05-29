/**
 * File: mutation-ticket-service.ts
 * Description: Runtime ticket lifecycle wrapper retained for transitional trusted prepare/finalize writes.
 */

import type {
  MutationIntent,
  MutationTicket,
  PreparedMutation,
} from '@core/auth/mutation-corridor';
import {
  MutationTicketStore,
  type StoredMutationTicket,
} from '@runtime/nexus/server/mutation-ticket-store';

export type PreparedMutationTicketResult = {
  ticket: MutationTicket;
  prepared_mutation: PreparedMutation;
};

export class MutationTicketService {
  constructor(private readonly store: MutationTicketStore) {}

  createPreparedMutationTicket(input: {
    actorPacketId: string;
    preparedMutation: PreparedMutation;
    intent: MutationIntent;
    preparedResult?: unknown;
  }): PreparedMutationTicketResult {
    const storedTicket = this.store.create({
      actor_packet_id: input.actorPacketId,
      prepared_mutation: input.preparedMutation,
      intent: input.intent,
      prepared_result: input.preparedResult,
    });

    return {
      ticket: toPublicMutationTicket(storedTicket),
      prepared_mutation: input.preparedMutation,
    };
  }

  read(ticketId: string): StoredMutationTicket | null {
    return this.store.read(ticketId);
  }

  consumeForActor(input: {
    ticketId: string;
    actorPacketId: string;
  }): StoredMutationTicket {
    const storedTicket = this.store.consume(input.ticketId);

    if (storedTicket.actor_packet_id !== input.actorPacketId) {
      throw new Error('Mutation ticket actor does not match the current actor.');
    }

    return storedTicket;
  }
}

function toPublicMutationTicket(storedTicket: StoredMutationTicket): MutationTicket {
  return {
    ticket_id: storedTicket.ticket_id,
    actor_packet_id: storedTicket.actor_packet_id,
    kind: storedTicket.intent.kind,
    expires_at: storedTicket.expires_at,
  };
}
