/**
 * File: import_archive_bundle.ts
 * Description: Imports packet bundle material through Trusted Archive as a low-level storage primitive.
 */

import {
  createTrustedRuntimeCoordinatorResult,
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
import { archiveTrace, withTrustedArchiveStore } from '../trusted_archive_internal.ts';
import {
  TRUSTED_ARCHIVE_COORDINATOR_ID,
  type ImportTrustedArchiveBundleInput,
  type TrustedArchiveBundleImport,
} from '../trusted_archive_types.ts';

export async function importTrustedArchiveBundle(
  input: ImportTrustedArchiveBundleInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveBundleImport>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  let processChain = createTrustedProcessChain({
    coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
    coordinator_kind: 'archive',
    operation_name: 'import_archive_bundle',
    completion_policy: 'preserve_partial',
    mode: contextMode,
  });
  const importResult = await withTrustedArchiveStore(input, (packetStore) =>
    packetStore.importBundle(input.bundle)
  );

  trace.push(archiveTrace({
    step_id: 'archive.bundle.import',
    status: 'ok',
    preset_ids: ['trusted.archive.bundle_import.v0'],
    notes: `Imported ${importResult.revision_count} archived revision(s) for ${importResult.packet_count} packet(s).`,
  }));
  processChain = appendTrustedProcessStage(
    processChain,
    completeTrustedProcessStage(
      startTrustedProcessStage({
        stage_id: 'archive.bundle.import',
        coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
        coordinator_kind: 'archive',
        operation_name: 'import_archive_bundle',
        preset_ids: ['trusted.archive.bundle_import.v0'],
        notes: `Imported ${importResult.revision_count} archived revision(s).`,
      }),
      {
        artifacts: [{
          artifact_id: `archive-import:${importResult.packet_count}:${importResult.revision_count}`,
          artifact_kind: 'bundle_import',
          label: 'Imported archive bundle.',
          count: importResult.revision_count,
          redacted: true,
        }],
        completed_work: [{
          work_id: 'archive.bundle.import',
          label: 'Imported bundle into archive storage.',
          count: importResult.revision_count,
        }],
      }
    )
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
    coordinator_kind: 'archive',
    value: {
      result_kind: 'trusted.archive_bundle_import',
      ...importResult,
    },
    trace,
    mode: contextMode,
    process_chain: completeTrustedProcessChain(processChain),
  });
}
