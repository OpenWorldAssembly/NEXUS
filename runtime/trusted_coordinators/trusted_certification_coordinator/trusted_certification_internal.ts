/**
 * File: trusted_certification_internal.ts
 * Description: Internal hashing, trace, and ticket-store helpers for Trusted Certification.
 */

import { createHash, randomUUID } from 'node:crypto';

import {
  createTrustedTraceEntry,
  type TrustedRuntimeCoordinatorStatus,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_CERTIFICATION_COORDINATOR_ID,
  type StoredTrustedCertificationTicket,
  type TrustedCertificationHashBundle,
} from './trusted_certification_types.ts';

const CERTIFICATION_TICKET_STORE_KEY = '__owaTrustedCertificationTicketStore';
const DEFAULT_CERTIFICATION_TICKET_TTL_MS = 5 * 60 * 1000;

function getStore(): Map<string, StoredTrustedCertificationTicket> {
  const globalState = globalThis as typeof globalThis & {
    [CERTIFICATION_TICKET_STORE_KEY]?: Map<string, StoredTrustedCertificationTicket>;
  };

  if (!globalState[CERTIFICATION_TICKET_STORE_KEY]) {
    globalState[CERTIFICATION_TICKET_STORE_KEY] = new Map<string, StoredTrustedCertificationTicket>();
  }

  return globalState[CERTIFICATION_TICKET_STORE_KEY]!;
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForHash(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined && typeof entry !== 'function')
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeForHash(entry)])
    );
  }

  return value;
}

export function stableCertificationStringify(value: unknown): string {
  return JSON.stringify(normalizeForHash(value));
}

export function hashTrustedCertificationValue(value: unknown): string {
  return createHash('sha256')
    .update(stableCertificationStringify(value))
    .digest('hex');
}

export function buildTrustedCertificationHashBundle(input: {
  plan: unknown;
  build_result: unknown;
  inspection_report: unknown;
  candidate_graph: unknown;
}): TrustedCertificationHashBundle {
  const planHash = hashTrustedCertificationValue(input.plan);
  const buildResultHash = hashTrustedCertificationValue(input.build_result);
  const inspectionReportHash = hashTrustedCertificationValue(input.inspection_report);
  const candidateGraphHash = hashTrustedCertificationValue(input.candidate_graph);

  return {
    hash_kind: 'trusted.certification_hash_bundle',
    plan_hash: planHash,
    build_result_hash: buildResultHash,
    inspection_report_hash: inspectionReportHash,
    candidate_graph_hash: candidateGraphHash,
    payload_hash: hashTrustedCertificationValue({
      plan_hash: planHash,
      build_result_hash: buildResultHash,
      inspection_report_hash: inspectionReportHash,
      candidate_graph_hash: candidateGraphHash,
    }),
  };
}

export function createCertificationTicketId(): string {
  return `trusted-cert-ticket-${randomUUID()}`;
}

export function certificationTicketExpiresAt(ttlMs?: number): string {
  return new Date(Date.now() + (ttlMs ?? DEFAULT_CERTIFICATION_TICKET_TTL_MS)).toISOString();
}

export function writeStoredTrustedCertificationTicket(ticket: StoredTrustedCertificationTicket): void {
  cleanupStoredTrustedCertificationTickets();
  getStore().set(ticket.ticket.ticket_id, ticket);
}

export function readStoredTrustedCertificationTicket(ticketId: string): StoredTrustedCertificationTicket | null {
  cleanupStoredTrustedCertificationTickets();
  return getStore().get(ticketId) ?? null;
}

export function consumeStoredTrustedCertificationTicket(ticketId: string): StoredTrustedCertificationTicket {
  cleanupStoredTrustedCertificationTickets();
  const stored = getStore().get(ticketId);

  if (!stored) {
    throw new Error('Unknown trusted certification ticket.');
  }

  if (stored.consumed_at) {
    throw new Error('Trusted certification ticket has already been used.');
  }

  if (new Date(stored.ticket.expires_at).getTime() < Date.now()) {
    getStore().delete(ticketId);
    throw new Error('Trusted certification ticket has expired.');
  }

  const consumed = {
    ...stored,
    consumed_at: new Date().toISOString(),
    ticket: {
      ...stored.ticket,
      status: 'signed_returned' as const,
    },
  };

  getStore().set(ticketId, consumed);
  return consumed;
}

function cleanupStoredTrustedCertificationTickets(): void {
  const now = Date.now();

  for (const [ticketId, stored] of getStore().entries()) {
    if (stored.consumed_at || new Date(stored.ticket.expires_at).getTime() < now) {
      getStore().delete(ticketId);
    }
  }
}

export function certificationTrace(input: {
  step_id: string;
  status?: TrustedRuntimeCoordinatorStatus;
  preset_ids?: readonly string[];
  notes: string;
}): TrustedRuntimeCoordinatorTraceEntry {
  return createTrustedTraceEntry({
    coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
    step_id: input.step_id,
    status: input.status,
    preset_ids: input.preset_ids,
    notes: input.notes,
  });
}

export function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}
