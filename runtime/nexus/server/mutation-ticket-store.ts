/**
 * File: mutation-ticket-store.ts
 * Description: In-memory one-time mutation ticket storage for the fortress prepare/finalize corridor.
 */

import { randomUUID } from 'node:crypto';

import type {
  MutationIntent,
  PreparedMutation,
} from '@core/auth/mutation-corridor';

const DEFAULT_TICKET_TTL_MS = 5 * 60 * 1000;
const MUTATION_TICKET_STORE_KEY = '__owaMutationTicketStore';

export interface StoredMutationTicket {
  ticket_id: string;
  actor_packet_id: string;
  expires_at: string;
  prepared_mutation: PreparedMutation;
  intent: MutationIntent;
  consumed_at: string | null;
}

function getSharedTicketMap(): Map<string, StoredMutationTicket> {
  const globalState = globalThis as typeof globalThis & {
    [MUTATION_TICKET_STORE_KEY]?: Map<string, StoredMutationTicket>;
  };

  if (!globalState[MUTATION_TICKET_STORE_KEY]) {
    globalState[MUTATION_TICKET_STORE_KEY] = new Map<string, StoredMutationTicket>();
  }

  return globalState[MUTATION_TICKET_STORE_KEY]!;
}

export class MutationTicketStore {
  private readonly tickets = getSharedTicketMap();

  create(input: {
    actor_packet_id: string;
    prepared_mutation: PreparedMutation;
    intent: MutationIntent;
    ttl_ms?: number;
  }): StoredMutationTicket {
    this.cleanupExpired();

    const now = Date.now();
    const ticket: StoredMutationTicket = {
      ticket_id: randomUUID(),
      actor_packet_id: input.actor_packet_id,
      expires_at: new Date(now + (input.ttl_ms ?? DEFAULT_TICKET_TTL_MS)).toISOString(),
      prepared_mutation: input.prepared_mutation,
      intent: input.intent,
      consumed_at: null,
    };

    this.tickets.set(ticket.ticket_id, ticket);

    return ticket;
  }

  read(ticketId: string): StoredMutationTicket | null {
    this.cleanupExpired();
    return this.tickets.get(ticketId) ?? null;
  }

  consume(ticketId: string): StoredMutationTicket {
    this.cleanupExpired();
    const ticket = this.tickets.get(ticketId);

    if (!ticket) {
      throw new Error('Unknown mutation ticket.');
    }

    if (ticket.consumed_at) {
      throw new Error('That mutation ticket has already been used.');
    }

    if (new Date(ticket.expires_at).getTime() < Date.now()) {
      this.tickets.delete(ticketId);
      throw new Error('That mutation ticket has expired.');
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
