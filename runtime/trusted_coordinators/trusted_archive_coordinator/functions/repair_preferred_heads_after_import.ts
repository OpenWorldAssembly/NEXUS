/**
 * File: repair_preferred_heads_after_import.ts
 * Description: Repairs preferred packet heads after archive bundle import while preserving prior preferred choices when imports create branch divergence.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  appendTrustedProcessStage,
  completeTrustedProcessChain,
  completeTrustedProcessStage,
  createTrustedProcessChain,
  startTrustedProcessStage,
} from '@runtime/trusted_coordinators/trusted_process.ts';
import { archiveIssue, archiveTrace, withTrustedArchiveStore } from '../trusted_archive_internal.ts';
import {
  TRUSTED_ARCHIVE_COORDINATOR_ID,
  type RepairTrustedArchivePreferredHeadsInput,
  type TrustedArchivePreferredHeadRepair,
} from '../trusted_archive_types.ts';

export async function repairTrustedArchivePreferredHeadsAfterImport(
  input: RepairTrustedArchivePreferredHeadsInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedArchivePreferredHeadRepair>> {
  const contextMode = input.context_mode ?? 'import_preview';
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  let processChain = createTrustedProcessChain({
    coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
    coordinator_kind: 'archive',
    operation_name: 'repair_preferred_heads_after_import',
    completion_policy: 'preserve_partial',
    mode: contextMode,
  });

  const snapshotsByPacketId = new Map(
    input.snapshots.map((snapshot) => [snapshot.packet_id, snapshot])
  );
  const packetIds = Array.from(new Set(input.packet_ids));
  let repairedPacketCount = 0;
  let restoredPreferredPacketCount = 0;
  let divergedPacketCount = 0;

  await withTrustedArchiveStore(input, async (packetStore) => {
    for (const packetId of packetIds) {
      const headStatus = await packetStore.fetchRevisionHeads({
        packet_id: packetId,
      });
      const nextHeadRevisionIds = headStatus.head_revisions.map(
        (revision) => revision.revision_id
      );
      const snapshot = snapshotsByPacketId.get(packetId) ?? null;

      if (nextHeadRevisionIds.length === 0) {
        issues.push(archiveIssue({
          severity: 'warning',
          code: 'trusted_archive_preferred_head_repair_no_heads',
          path: `packet:${packetId}`,
          message: `Preferred head repair skipped ${packetId} because it has no head revisions after import.`,
        }));
        continue;
      }

      if (nextHeadRevisionIds.length === 1) {
        await packetStore.publishRevision({
          packet_id: packetId,
          revision_id: nextHeadRevisionIds[0]!,
        });
        repairedPacketCount += 1;
        continue;
      }

      if (
        snapshot?.preferred_revision_id &&
        nextHeadRevisionIds.includes(snapshot.preferred_revision_id)
      ) {
        await packetStore.publishRevision({
          packet_id: packetId,
          revision_id: snapshot.preferred_revision_id,
        });
        repairedPacketCount += 1;
        restoredPreferredPacketCount += 1;
        continue;
      }

      divergedPacketCount += 1;
    }
  });

  trace.push(archiveTrace({
    step_id: 'archive.preferred_heads.repair_after_import',
    status: issues.some((issue) => issue.severity === 'error')
      ? 'error'
      : issues.length > 0
        ? 'partial'
        : 'ok',
    preset_ids: ['trusted.archive.preferred_head_repair_after_import.v0'],
    notes: `Repaired preferred heads for ${repairedPacketCount} packet(s); ${divergedPacketCount} packet(s) still need manual branch resolution.`,
  }));
  processChain = appendTrustedProcessStage(
    processChain,
    completeTrustedProcessStage(
      startTrustedProcessStage({
        stage_id: 'archive.preferred_heads.repair_after_import',
        coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
        coordinator_kind: 'archive',
        operation_name: 'repair_preferred_heads_after_import',
        preset_ids: ['trusted.archive.preferred_head_repair_after_import.v0'],
        notes: 'Reconciled imported archive heads with pre-import preferred revisions.',
      }),
      {
        issues,
        completed_work: [{
          work_id: 'archive.preferred_heads.repair_after_import',
          label: 'Repaired preferred heads after archive import.',
          count: repairedPacketCount,
        }],
      }
    ),
    { issues }
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
    coordinator_kind: 'archive',
    value: {
      result_kind: 'trusted.archive_preferred_head_repair',
      packet_count: packetIds.length,
      repaired_packet_count: repairedPacketCount,
      restored_preferred_packet_count: restoredPreferredPacketCount,
      diverged_packet_count: divergedPacketCount,
    },
    issues,
    trace,
    status: issues.some((issue) => issue.severity === 'error')
      ? 'error'
      : issues.length > 0
        ? 'partial'
        : 'ok',
    mode: contextMode,
    process_chain: completeTrustedProcessChain(processChain, {
      status: issues.some((issue) => issue.severity === 'error')
        ? 'error'
        : issues.length > 0
          ? 'partial'
          : 'ok',
    }),
  });
}
