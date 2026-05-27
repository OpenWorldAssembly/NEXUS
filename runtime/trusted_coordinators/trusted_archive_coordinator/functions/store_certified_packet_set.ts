/**
 * File: store_certified_packet_set.ts
 * Description: Stores archive-ready certified packet envelopes through the Trusted Archive Coordinator packet-store seam.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  archiveIssue,
  archiveTrace,
  createArchiveId,
  extractArchiveReadyPackets,
  withTrustedArchiveStore,
} from '../trusted_archive_internal.ts';
import {
  TRUSTED_ARCHIVE_COORDINATOR_ID,
  type StoreTrustedCertifiedPacketSetInput,
  type TrustedArchivedPacketWrite,
  type TrustedArchiveReceipt,
} from '../trusted_archive_types.ts';

export async function storeTrustedCertifiedPacketSet(
  input: StoreTrustedCertifiedPacketSetInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveReceipt>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const writeMode = input.write_mode ?? 'write_and_publish';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (!input.certified_packet_set.archive_ready) {
    blockers.push('Certified packet set is not marked archive_ready.');
    issues.push(archiveIssue({
      severity: 'error',
      code: 'trusted_archive_certified_set_not_ready',
      path: 'certified_packet_set.archive_ready',
      message: 'Trusted Archive only writes packet sets marked archive_ready by Certification.',
    }));
  }

  const extraction = extractArchiveReadyPackets({
    candidateNodes: input.certified_packet_set.candidate_graph.candidate_nodes,
  });
  warnings.push(...extraction.warnings);

  if (extraction.packets.length === 0) {
    blockers.push('No archive-ready packet envelopes were present in the certified candidate graph.');
    issues.push(archiveIssue({
      severity: 'error',
      code: 'trusted_archive_no_packet_envelopes',
      path: 'certified_packet_set.candidate_graph.candidate_nodes',
      message: 'Trusted Archive needs full packet envelopes before it can write revisions. Current Building candidates only expose body candidates for some flows.',
    }));
  }

  trace.push(archiveTrace({
    step_id: 'archive.certified_packet_set.extract',
    status: extraction.packets.length > 0 ? 'ok' : 'blocked',
    preset_ids: ['trusted.archive.certified_packet_set.v0'],
    notes: `Extracted ${extraction.packets.length} archive-ready packet envelope(s) from ${input.certified_packet_set.candidate_graph.candidate_nodes.length} candidate node(s).`,
  }));

  const writes: TrustedArchivedPacketWrite[] = [];

  if (issues.some((issue) => issue.severity === 'error')) {
    const receipt = {
      receipt_kind: 'trusted.archive_receipt' as const,
      archive_id: createArchiveId(),
      source_certification_id: input.certified_packet_set.certification_id,
      source_ticket_id: input.certified_packet_set.ticket_id,
      archived_at: new Date().toISOString(),
      write_mode: writeMode,
      requested_candidate_count: input.certified_packet_set.candidate_graph.candidate_nodes.length,
      extracted_packet_count: extraction.packets.length,
      written_packet_count: 0,
      published_packet_count: 0,
      skipped_packet_count: extraction.skippedCandidateIds.length,
      writes,
      skipped_candidate_ids: extraction.skippedCandidateIds,
      blockers,
      warnings,
      issues,
      trace,
    };

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
      coordinator_kind: 'archive',
      value: receipt,
      issues,
      trace,
      status: 'blocked',
      mode: contextMode,
    });
  }

  await withTrustedArchiveStore(input, async (packetStore) => {
    for (const packet of extraction.packets) {
      const revisionRef = await packetStore.writeRevision(packet);
      let published = false;

      if (writeMode === 'write_and_publish') {
        await packetStore.publishRevision(revisionRef);
        published = true;
      }

      writes.push({
        packet_ref: { packet_id: packet.header.packet_id },
        revision_ref: revisionRef,
        published,
        packet_type: packet.header.type,
      });
    }
  });

  trace.push(archiveTrace({
    step_id: 'archive.certified_packet_set.write',
    status: 'ok',
    preset_ids: ['trusted.archive.packet_store_write.v0'],
    notes: `Wrote ${writes.length} packet revision(s) through Trusted Archive.`,
  }));

  const receipt: TrustedArchiveReceipt = {
    receipt_kind: 'trusted.archive_receipt',
    archive_id: createArchiveId(),
    source_certification_id: input.certified_packet_set.certification_id,
    source_ticket_id: input.certified_packet_set.ticket_id,
    archived_at: new Date().toISOString(),
    write_mode: writeMode,
    requested_candidate_count: input.certified_packet_set.candidate_graph.candidate_nodes.length,
    extracted_packet_count: extraction.packets.length,
    written_packet_count: writes.length,
    published_packet_count: writes.filter((write) => write.published).length,
    skipped_packet_count: extraction.skippedCandidateIds.length,
    writes,
    skipped_candidate_ids: extraction.skippedCandidateIds,
    blockers,
    warnings,
    issues,
    trace,
  };

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
    coordinator_kind: 'archive',
    value: receipt,
    issues,
    trace,
    mode: contextMode,
  });
}
