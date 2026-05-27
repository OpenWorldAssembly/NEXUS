/**
 * File: export_archive_bundle.ts
 * Description: Exports archived packet revisions through Trusted Archive as a low-level storage primitive.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { archiveTrace, withTrustedArchiveStore } from '../trusted_archive_internal.ts';
import {
  TRUSTED_ARCHIVE_COORDINATOR_ID,
  type ExportTrustedArchiveBundleInput,
  type TrustedArchiveBundleExport,
} from '../trusted_archive_types.ts';

export async function exportTrustedArchiveBundle(
  input: ExportTrustedArchiveBundleInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveBundleExport>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const bundle = await withTrustedArchiveStore(input, (packetStore) =>
    packetStore.exportBundle(input.packet_refs)
  );

  trace.push(archiveTrace({
    step_id: 'archive.bundle.export',
    status: 'ok',
    preset_ids: ['trusted.archive.bundle_export.v0'],
    notes: `Exported ${bundle.revision_count} archived revision(s) for ${bundle.packet_count} packet(s).`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
    coordinator_kind: 'archive',
    value: {
      result_kind: 'trusted.archive_bundle_export',
      ...bundle,
    },
    trace,
    mode: contextMode,
  });
}
