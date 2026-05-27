/**
 * File: read_archived_packet.ts
 * Description: Reads adapted/raw archived packet revisions through Trusted Archive.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { archiveIssue, archiveTrace, withTrustedArchiveStore } from '../trusted_archive_internal.ts';
import {
  TRUSTED_ARCHIVE_COORDINATOR_ID,
  type ReadTrustedArchivedPacketInput,
  type TrustedArchiveReadResult,
} from '../trusted_archive_types.ts';
import type { PacketReadMode } from '@core/schema/packet-schema';

export async function readTrustedArchivedPacket<TMode extends PacketReadMode = 'adapted'>(
  input: ReadTrustedArchivedPacketInput<TMode>
): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveReadResult<TMode>>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const mode = input.mode ?? ('adapted' as TMode);
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];

  const read = await withTrustedArchiveStore(input, async (packetStore) => {
    if (input.revision_ref) {
      return {
        packet: await packetStore.readByRevision(input.revision_ref, {
          mode,
          target_schema_version: input.target_schema_version,
        }),
        revisionRef: input.revision_ref,
      };
    }

    const preferredRevision = await packetStore.fetchPreferredRevision(input.packet_ref);

    return {
      packet: await packetStore.readByPacket(input.packet_ref, {
        mode,
        target_schema_version: input.target_schema_version,
      }),
      revisionRef: preferredRevision,
    };
  });

  if (!read.packet) {
    issues.push(archiveIssue({
      severity: 'warning',
      code: 'trusted_archive_packet_not_found',
      path: 'packet_ref.packet_id',
      message: `No archived packet was found for ${input.packet_ref.packet_id}.`,
    }));
  }

  trace.push(archiveTrace({
    step_id: 'archive.packet.read',
    status: read.packet ? 'ok' : 'partial',
    preset_ids: ['trusted.archive.read.v0'],
    notes: read.packet
      ? `Read archived packet ${input.packet_ref.packet_id}.`
      : `No archived packet found for ${input.packet_ref.packet_id}.`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
    coordinator_kind: 'archive',
    value: {
      result_kind: 'trusted.archive_read_result',
      packet_ref: input.packet_ref,
      revision_ref: read.revisionRef,
      mode,
      packet: read.packet,
    },
    issues,
    trace,
    mode: contextMode,
  });
}
