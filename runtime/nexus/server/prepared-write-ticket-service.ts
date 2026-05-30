/**
 * File: prepared-write-ticket-service.ts
 * Description: Runtime prepared-write ticket lifecycle wrapper retained for transitional trusted prepare/finalize writes.
 */

import type {
  MutationIntent,
  PreparedWriteTicket,
  PreparedMutation,
} from '@core/auth/mutation-corridor';
import {
  PreparedWriteTicketStore,
  type StoredPreparedWriteTicket,
} from '@runtime/nexus/server/prepared-write-ticket-store';

export type PreparedWriteTicketResult = {
  ticket: PreparedWriteTicket;
  prepared_mutation: PreparedMutation;
};

export class PreparedWriteTicketService {
  constructor(private readonly store: PreparedWriteTicketStore) {}

  createPreparedWriteTicket(input: {
    actorPacketId: string;
    preparedMutation: PreparedMutation;
    intent: MutationIntent;
    preparedResult?: unknown;
  }): PreparedWriteTicketResult {
    const storedTicket = this.store.create({
      actor_packet_id: input.actorPacketId,
      prepared_mutation: input.preparedMutation,
      intent: input.intent,
      prepared_result: input.preparedResult,
    });

    return {
      ticket: toPublicPreparedWriteTicket(storedTicket),
      prepared_mutation: input.preparedMutation,
    };
  }

  read(ticketId: string): StoredPreparedWriteTicket | null {
    return this.store.read(ticketId);
  }

  consumeForActor(input: {
    ticketId: string;
    actorPacketId: string;
  }): StoredPreparedWriteTicket {
    const storedTicket = this.store.consume(input.ticketId);

    if (storedTicket.actor_packet_id !== input.actorPacketId) {
      throw new Error('Prepared-write ticket actor does not match the current actor.');
    }

    return storedTicket;
  }
}

function toPublicPreparedWriteTicket(storedTicket: StoredPreparedWriteTicket): PreparedWriteTicket {
  return {
    ticket_id: storedTicket.ticket_id,
    actor_packet_id: storedTicket.actor_packet_id,
    kind: storedTicket.intent.kind,
    expires_at: storedTicket.expires_at,
  };
}
