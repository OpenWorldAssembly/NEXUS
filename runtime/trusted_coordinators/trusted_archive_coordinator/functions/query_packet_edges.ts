/**
 * File: query_packet_edges.ts
 * Description: Queries archived graph edges through Trusted Archive.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { archiveTrace, withTrustedArchiveStore } from '../trusted_archive_internal.ts';
import {
  TRUSTED_ARCHIVE_COORDINATOR_ID,
  type QueryTrustedArchiveEdgesInput,
  type TrustedArchiveEdgeResult,
} from '../trusted_archive_types.ts';

export async function queryTrustedArchiveEdges(
  input: QueryTrustedArchiveEdgesInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveEdgeResult>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const edges = await withTrustedArchiveStore(input, (packetStore) =>
    packetStore.queryEdges(input.packet_ref, input.query)
  );

  trace.push(archiveTrace({
    step_id: 'archive.edges.query',
    status: 'ok',
    preset_ids: ['trusted.archive.edges.v0'],
    notes: `Loaded ${edges.length} archived packet edge(s).`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
    coordinator_kind: 'archive',
    value: {
      result_kind: 'trusted.archive_edge_result',
      packet_ref: input.packet_ref,
      edge_count: edges.length,
      edges,
    },
    trace,
    mode: contextMode,
  });
}
