/**
 * File: prepared-write-ticket-store.ts
 * Description: In-memory one-time prepared-write ticket storage for the Dispatch prepare/finalize corridor.
 */

import { randomUUID } from 'node:crypto';

import type {
  MutationIntent,
  PreparedMutation,
} from '@core/auth/mutation-corridor';

const DEFAULT_TICKET_TTL_MS = 5 * 60 * 1000;
const PREPARED_WRITE_TICKET_STORE_KEY = '__owaPreparedWriteTicketStore';

export interface StoredPreparedWriteTicket {
  ticket_id: string;
  actor_packet_id: string;
  expires_at: string;
  prepared_mutation: PreparedMutation;
  intent: MutationIntent;
  prepared_result?: unknown;
  consumed_at: string | null;
}

function getSharedTicketMap(): Map<string, StoredPreparedWriteTicket> {
  const globalState = globalThis as typeof globalThis & {
    [PREPARED_WRITE_TICKET_STORE_KEY]?: Map<string, StoredPreparedWriteTicket>;
  };

  if (!globalState[PREPARED_WRITE_TICKET_STORE_KEY]) {
    globalState[PREPARED_WRITE_TICKET_STORE_KEY] = new Map<string, StoredPreparedWriteTicket>();
  }

  return globalState[PREPARED_WRITE_TICKET_STORE_KEY]!;
}

export class PreparedWriteTicketStore {
  private readonly tickets = getSharedTicketMap();

  create(input: {
    actor_packet_id: string;
    prepared_mutation: PreparedMutation;
    intent: MutationIntent;
    prepared_result?: unknown;
    ttl_ms?: number;
  }): StoredPreparedWriteTicket {
    this.cleanupExpired();

    const now = Date.now();
    const ticket: StoredPreparedWriteTicket = {
      ticket_id: randomUUID(),
      actor_packet_id: input.actor_packet_id,
      expires_at: new Date(now + (input.ttl_ms ?? DEFAULT_TICKET_TTL_MS)).toISOString(),
      prepared_mutation: input.prepared_mutation,
      intent: input.intent,
      prepared_result: input.prepared_result,
      consumed_at: null,
    };

    this.tickets.set(ticket.ticket_id, ticket);

    return ticket;
  }

  read(ticketId: string): StoredPreparedWriteTicket | null {
    this.cleanupExpired();
    return this.tickets.get(ticketId) ?? null;
  }

  consume(ticketId: string): StoredPreparedWriteTicket {
    this.cleanupExpired();
    const ticket = this.tickets.get(ticketId);

    if (!ticket) {
      throw new Error('Unknown prepared-write ticket.');
    }

    if (ticket.consumed_at) {
      throw new Error('That prepared-write ticket has already been used.');
    }

    if (new Date(ticket.expires_at).getTime() < Date.now()) {
      this.tickets.delete(ticketId);
      throw new Error('That prepared-write ticket has expired.');
    }

    const consumedTicket = {
      ...ticket,
      consumed_at: new Date().toISOString(),
    };

    this.tickets.set(ticketId, consumedTicket);

    return consumedTicket;
  }

  private cleanupExpired(): void {
    const now = Date.now();

    for (const [ticketId, ticket] of this.tickets.entries()) {
      if (
        ticket.consumed_at ||
        new Date(ticket.expires_at).getTime() < now
      ) {
        this.tickets.delete(ticketId);
      }
    }
  }
}
