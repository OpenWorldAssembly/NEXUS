/**
 * File: query_archived_packets.ts
 * Description: Queries archived packet search rows through Trusted Archive.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  archiveTrace,
  matchesArchiveQuery,
  searchRowToArchiveCard,
  withTrustedArchiveStore,
} from '../trusted_archive_internal.ts';
import {
  TRUSTED_ARCHIVE_COORDINATOR_ID,
  type QueryTrustedArchivedPacketsInput,
  type TrustedArchiveQueryResult,
} from '../trusted_archive_types.ts';

function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.max(1, Math.min(250, Math.trunc(value ?? 50)));
}

function clampOffset(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value ?? 0));
}

export async function queryTrustedArchivedPackets(
  input: QueryTrustedArchivedPacketsInput = {}
): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveQueryResult>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const limit = clampLimit(input.limit);
  const offset = clampOffset(input.offset);
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const rows = await withTrustedArchiveStore(input, async (packetStore) => {
    if (!('listSearchRows' in packetStore) || typeof packetStore.listSearchRows !== 'function') {
      return [];
    }

    return packetStore.listSearchRows();
  });
  const filteredRows = rows.filter((row) => matchesArchiveQuery({
    row,
    packetType: input.packet_type,
    text: input.text,
    authorityScopePacketId: input.authority_scope_packet_id,
  }));
  const packets = filteredRows.slice(offset, offset + limit).map(searchRowToArchiveCard);

  trace.push(archiveTrace({
    step_id: 'archive.packet.query',
    status: 'ok',
    preset_ids: ['trusted.archive.query.v0'],
    notes: `Matched ${filteredRows.length} archived packet row(s).`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
    coordinator_kind: 'archive',
    value: {
      result_kind: 'trusted.archive_query_result',
      total_count: filteredRows.length,
      offset,
      limit,
      packets,
    },
    trace,
    mode: contextMode,
  });
}
