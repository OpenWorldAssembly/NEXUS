/**
 * File: resolve_archived_revision.ts
 * Description: Resolves preferred/head/revision refs through Trusted Archive.
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
  type ResolveTrustedArchivedRevisionInput,
  type TrustedArchiveRevisionResolution,
} from '../trusted_archive_types.ts';

export async function resolveTrustedArchivedRevision(
  input: ResolveTrustedArchivedRevisionInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveRevisionResolution>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const resolved = await withTrustedArchiveStore(input, async (packetStore) => {
    const heads = await packetStore.fetchRevisionHeads(input.packet_ref);
    const preferredRevision = await packetStore.fetchPreferredRevision(input.packet_ref);
    const requestedRevision = input.revision_id
      ? await packetStore.resolveRevisionRef(input.revision_id)
      : null;

    return {
      heads,
      preferredRevision,
      requestedRevision,
    };
  });
  const resolvedRevision = input.revision_id
    ? resolved.requestedRevision
    : resolved.preferredRevision;

  if (!resolvedRevision) {
    issues.push(archiveIssue({
      severity: 'warning',
      code: 'trusted_archive_revision_not_found',
      path: input.revision_id ? 'revision_id' : 'packet_ref.packet_id',
      message: input.revision_id
        ? `No archived revision was found for ${input.revision_id}.`
        : `No preferred archived revision was found for ${input.packet_ref.packet_id}.`,
    }));
  }

  trace.push(archiveTrace({
    step_id: 'archive.revision.resolve',
    status: resolvedRevision ? 'ok' : 'partial',
    preset_ids: ['trusted.archive.revision.v0'],
    notes: resolvedRevision
      ? `Resolved archived revision ${resolvedRevision.revision_id}.`
      : 'No archived revision resolved.',
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
    coordinator_kind: 'archive',
    value: {
      result_kind: 'trusted.archive_revision_resolution',
      packet_ref: input.packet_ref,
      requested_revision_id: input.revision_id ?? null,
      preferred_revision: resolved.preferredRevision,
      resolved_revision: resolvedRevision,
      heads: resolved.heads,
    },
    issues,
    trace,
    mode: contextMode,
  });
}
