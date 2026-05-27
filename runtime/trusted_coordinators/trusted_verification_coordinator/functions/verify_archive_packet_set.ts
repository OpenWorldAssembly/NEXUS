/**
 * File: verify_archive_packet_set.ts
 * Description: Reads packets through Trusted Archive, then verifies them without directly reaching into packet storage.
 */

import type {
  PacketCompatibilityReadResult,
  PacketRef,
} from '@core/schema/packet-schema';
import {
  trustedArchiveCoordinator,
} from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import type {
  TrustedRuntimeCoordinatorIssue,
  TrustedRuntimeCoordinatorResult,
  TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  normalizeVerificationMode,
  verificationIssue,
  verificationTrace,
} from '../trusted_verification_internal.ts';
import {
  TRUSTED_VERIFICATION_COORDINATOR_ID,
  type TrustedVerificationPacketEntry,
  type TrustedVerificationReport,
  type VerifyTrustedArchivePacketSetInput,
} from '../trusted_verification_types.ts';
import {
  createTrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { verifyTrustedPacketBatch } from './verify_packet_batch.ts';

function isCompatibilityReadResult(value: unknown): value is PacketCompatibilityReadResult {
  return !!(
    value &&
    typeof value === 'object' &&
    'raw_packet' in value &&
    'adapted_packet' in value &&
    'status' in value
  );
}

async function readArchiveRawPlus(input: {
  packetRef: PacketRef;
  revisionRef?: { packet_id: string; revision_id: string } | null;
  sourceId: string;
  request: VerifyTrustedArchivePacketSetInput;
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
}): Promise<TrustedVerificationPacketEntry | null> {
  const readResult = await trustedArchiveCoordinator.readPacket({
    packet_store: input.request.packet_store,
    database_path: input.request.database_path,
    packet_ref: input.packetRef,
    revision_ref: input.revisionRef ?? undefined,
    mode: 'raw_plus_adaptation',
    target_schema_version: input.request.target_schema_version,
    context_mode: input.request.context_mode,
  });

  input.issues.push(...readResult.issues);
  input.trace.push(...readResult.trace);

  if (!readResult.value?.packet || !isCompatibilityReadResult(readResult.value.packet)) {
    input.issues.push(verificationIssue({
      severity: 'warning',
      code: 'trusted_verification_archive_packet_missing',
      path: input.revisionRef ? 'revision_refs' : 'packet_refs',
      message: `Archive did not return packet material for ${input.sourceId}.`,
    }));
    return null;
  }

  return {
    entry_id: input.sourceId,
    raw_packet: readResult.value.packet.raw_packet,
    packet: readResult.value.packet.adapted_packet,
    packet_ref: input.packetRef,
    revision_ref: readResult.value.revision_ref,
  };
}

export async function verifyTrustedArchivePacketSet(
  input: VerifyTrustedArchivePacketSetInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const verificationMode = normalizeVerificationMode(input.verification_mode);
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const entries: TrustedVerificationPacketEntry[] = [];
  const readSignerIds = new Set<string>();

  for (const revisionRef of input.revision_refs ?? []) {
    const entry = await readArchiveRawPlus({
      packetRef: { packet_id: revisionRef.packet_id },
      revisionRef,
      sourceId: `archive.revision.${revisionRef.packet_id}:${revisionRef.revision_id}`,
      request: input,
      issues,
      trace,
    });

    if (entry) {
      entries.push(entry);
    }
  }

  for (const packetRef of input.packet_refs ?? []) {
    const entry = await readArchiveRawPlus({
      packetRef,
      sourceId: `archive.packet.${packetRef.packet_id}`,
      request: input,
      issues,
      trace,
    });

    if (entry) {
      entries.push(entry);
    }
  }

  for (const entry of entries) {
    const packet = entry.packet;

    if (!packet || typeof packet !== 'object') {
      continue;
    }

    const signerRef = (packet as PacketCompatibilityReadResult['adapted_packet']).header?.integrity?.embedded_signatures?.[0]?.signer_packet_ref ?? null;

    if (!signerRef?.packet_id || readSignerIds.has(signerRef.packet_id)) {
      continue;
    }

    readSignerIds.add(signerRef.packet_id);

    if (entries.some((candidate) => candidate.packet_ref?.packet_id === signerRef.packet_id)) {
      continue;
    }

    const signerEntry = await readArchiveRawPlus({
      packetRef: signerRef,
      sourceId: `archive.signer.${signerRef.packet_id}`,
      request: input,
      issues,
      trace,
    });

    if (signerEntry) {
      entries.push(signerEntry);
    }
  }

  if (entries.length === 0) {
    issues.push(verificationIssue({
      severity: 'error',
      code: 'trusted_verification_archive_set_empty',
      path: 'packet_refs',
      message: 'No archived packet material was available to verify.',
    }));
    trace.push(verificationTrace({
      step_id: 'verification.archive_packet_set.read',
      status: 'blocked',
      preset_ids: ['trusted.verification.archive_packet_set.v0'],
      notes: 'Archive-backed verification found no packet material.',
    }));

    const emptyReport: TrustedVerificationReport = {
      report_kind: 'trusted.verification_report',
      verification_id: 'trusted-verification-empty-archive-set',
      target_kind: 'archive_packet_set',
      verification_mode: verificationMode,
      checked_at: new Date().toISOString(),
      packet_count: 0,
      passed_count: 0,
      failed_count: 0,
      skipped_count: 0,
      blocking_issue_count: 1,
      warning_count: 0,
      packet_results: [],
      hash_results: [],
      signature_results: [],
      lineage_results: [],
      ref_results: [],
      certification_results: [],
      blockers: ['No archived packet material was available to verify.'],
      warnings: [],
      issues,
      trace,
    };

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_VERIFICATION_COORDINATOR_ID,
      coordinator_kind: 'verification',
      status: 'blocked',
      value: emptyReport,
      issues,
      trace,
      mode: contextMode,
    });
  }

  const batchResult = await verifyTrustedPacketBatch({
    packets: entries,
    target_schema_version: input.target_schema_version,
    verification_mode: verificationMode,
    context_mode: contextMode,
    target_kind: 'archive_packet_set',
    check_lineage: true,
    check_refs: true,
  });

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_VERIFICATION_COORDINATOR_ID,
    coordinator_kind: 'verification',
    status: batchResult.status,
    value: batchResult.value
      ? {
          ...batchResult.value,
          issues: [...issues, ...batchResult.value.issues],
          trace: [...trace, ...batchResult.value.trace],
        }
      : null,
    issues: [...issues, ...batchResult.issues],
    trace: [...trace, ...batchResult.trace],
    mode: contextMode,
  });
}
