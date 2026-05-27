/**
 * File: trusted_archive_internal.ts
 * Description: Internal helpers for Trusted Archive Coordinator traces, packet-store access, and packet extraction.
 */

import { randomUUID } from 'node:crypto';

import {
  parsePacketEnvelope,
  type PacketEnvelope,
  type PacketRef,
} from '@core/schema/packet-schema';
import type { PacketStore } from '@core/contracts';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';
import type { PacketSearchIndexRecord } from '@runtime/storage/sqlite-records';
import type { TrustedPacketCandidateNode } from '@runtime/trusted_coordinators/trusted_building_coordinator/index.ts';
import {
  createTrustedTraceEntry,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorStatus,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_ARCHIVE_COORDINATOR_ID,
  type TrustedArchivePacketCard,
  type TrustedArchiveStoreContext,
} from './trusted_archive_types.ts';

export function archiveTrace(input: {
  step_id: string;
  status?: TrustedRuntimeCoordinatorStatus;
  preset_ids?: readonly string[];
  notes: string;
}): TrustedRuntimeCoordinatorTraceEntry {
  return createTrustedTraceEntry({
    coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
    step_id: input.step_id,
    status: input.status ?? 'ok',
    preset_ids: input.preset_ids ?? ['trusted.archive.v0'],
    notes: input.notes,
  });
}

export function archiveIssue(input: TrustedRuntimeCoordinatorIssue): TrustedRuntimeCoordinatorIssue {
  return trustedIssue(input);
}

export function createArchiveId(): string {
  return `trusted-archive-${randomUUID()}`;
}

export async function withTrustedArchiveStore<TValue>(
  context: TrustedArchiveStoreContext | undefined,
  callback: (packetStore: PacketStore, databasePath: string | null) => Promise<TValue>
): Promise<TValue> {
  if (context?.packet_store) {
    const packetStore = context.packet_store;
    const databasePath = 'databasePath' in packetStore && typeof packetStore.databasePath === 'string'
      ? packetStore.databasePath
      : context.database_path ?? null;

    return callback(packetStore, databasePath);
  }

  const packetStore = new NodeSQLitePacketStore({
    databasePath: context?.database_path ?? undefined,
  });

  try {
    return await callback(packetStore, packetStore.databasePath);
  } finally {
    packetStore.close();
  }
}

function parseStringArray(rawValue: string | null | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

export function searchRowToArchiveCard(row: PacketSearchIndexRecord): TrustedArchivePacketCard {
  return {
    packet: { packet_id: row.packet_id },
    revision: {
      packet_id: row.packet_id,
      revision_id: row.revision_id,
    },
    type: row.type,
    label: row.label,
    title: row.title,
    summary: row.summary,
    status: row.status,
    authority_scope_packet_id: row.authority_scope_packet_id,
    applicable_scope_ids: parseStringArray(row.applicable_scope_ids_json),
    tags: parseStringArray(row.tags_json),
    created_at: row.created_at,
  };
}

export function matchesArchiveQuery(input: {
  row: PacketSearchIndexRecord;
  packetType?: string | null;
  text?: string | null;
  authorityScopePacketId?: string | null;
}): boolean {
  if (input.packetType && input.row.type !== input.packetType) {
    return false;
  }

  if (
    input.authorityScopePacketId &&
    input.row.authority_scope_packet_id !== input.authorityScopePacketId
  ) {
    return false;
  }

  const text = input.text?.trim().toLowerCase();

  if (!text) {
    return true;
  }

  const haystack = [
    input.row.packet_id,
    input.row.revision_id,
    input.row.type,
    input.row.label,
    input.row.title,
    input.row.summary ?? '',
    input.row.status ?? '',
    input.row.tags_json,
  ].join('\n').toLowerCase();

  return haystack.includes(text);
}

function candidateEnvelopeCandidates(candidateNode: TrustedPacketCandidateNode): unknown[] {
  const bodyCandidate = candidateNode.body_candidate as Record<string, unknown> | null;
  const directCandidate = candidateNode as unknown as Record<string, unknown>;

  return [
    directCandidate.packet,
    directCandidate.envelope,
    directCandidate.packet_envelope,
    bodyCandidate?.packet,
    bodyCandidate?.envelope,
    bodyCandidate?.packet_envelope,
    bodyCandidate?.body && typeof bodyCandidate.body === 'object'
      ? (bodyCandidate.body as Record<string, unknown>).packet
      : null,
    bodyCandidate?.body && typeof bodyCandidate.body === 'object'
      ? (bodyCandidate.body as Record<string, unknown>).packet_envelope
      : null,
  ].filter((value) => value !== null && value !== undefined);
}

export function extractArchiveReadyPackets(input: {
  candidateNodes: readonly TrustedPacketCandidateNode[];
}): {
  packets: PacketEnvelope[];
  skippedCandidateIds: string[];
  warnings: string[];
} {
  const packets: PacketEnvelope[] = [];
  const skippedCandidateIds: string[] = [];
  const warnings: string[] = [];
  const seenRevisionIds = new Set<string>();

  for (const candidateNode of input.candidateNodes) {
    const candidatePackets = candidateEnvelopeCandidates(candidateNode);
    let extracted = false;

    for (const candidatePacket of candidatePackets) {
      try {
        const packet = parsePacketEnvelope(candidatePacket);
        const revisionKey = `${packet.header.packet_id}:${packet.header.revision_id}`;

        if (!seenRevisionIds.has(revisionKey)) {
          packets.push(packet);
          seenRevisionIds.add(revisionKey);
        }

        extracted = true;
        break;
      } catch {
        continue;
      }
    }

    if (!extracted) {
      skippedCandidateIds.push(candidateNode.candidate_id);
      warnings.push(
        `${candidateNode.candidate_id} does not include an archive-ready packet envelope yet.`
      );
    }
  }

  return {
    packets,
    skippedCandidateIds,
    warnings,
  };
}

export function packetRefsFromPackets(packets: readonly PacketEnvelope[]): PacketRef[] {
  return packets.map((packet) => ({
    packet_id: packet.header.packet_id,
  }));
}
