/**
 * File: verify_packet_batch.ts
 * Description: Verifies a batch of packet envelopes with shared signer context and optional ref/lineage checks.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  applyBatchReferenceChecks,
  buildSignerMap,
  createTrustedVerificationReport,
  inspectVerificationPacket,
  normalizePacketEntryMaterial,
  normalizeVerificationMode,
  signerPacketRefFromPacket,
  verificationTrace,
} from '../trusted_verification_internal.ts';
import {
  TRUSTED_VERIFICATION_COORDINATOR_ID,
  type TrustedVerificationReport,
  type VerifyTrustedPacketBatchInput,
} from '../trusted_verification_types.ts';
import { verifyTrustedPacket } from './verify_packet.ts';

export async function verifyTrustedPacketBatch(
  input: VerifyTrustedPacketBatchInput & {
    target_kind?: TrustedVerificationReport['target_kind'];
    check_lineage?: boolean;
    check_refs?: boolean;
  }
): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const verificationMode = normalizeVerificationMode(input.verification_mode);
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const signerMap = buildSignerMap({
    packets: input.packets,
    signerPackets: input.signer_packets,
  });
  const packetResults = [];
  const adaptedPackets = [];

  for (const [index, entry] of input.packets.entries()) {
    const rawPacket = normalizePacketEntryMaterial(entry);
    let signerPacket = entry.signer_packet ?? null;

    if (rawPacket) {
      try {
        const compatibilityRead = inspectVerificationPacket({
          rawPacket,
          targetSchemaVersion: input.target_schema_version,
        });
        const signerRef = signerPacketRefFromPacket(compatibilityRead.adapted_packet);

        adaptedPackets.push(compatibilityRead.adapted_packet);

        if (!signerPacket && signerRef) {
          signerPacket = signerMap.get(signerRef.packet_id) ?? null;
        }
      } catch {
        // The single-packet verifier will produce the structural blocker.
      }
    }

    const result = await verifyTrustedPacket({
      packet: entry.packet,
      raw_packet: entry.raw_packet,
      signer_packet: signerPacket,
      entry_id: entry.entry_id ?? `packet.entry.${index}`,
      target_schema_version: input.target_schema_version,
      verification_mode: verificationMode,
      context_mode: contextMode,
    });

    if (result.issues.length > 0) {
      issues.push(...result.issues);
    }

    if (result.trace.length > 0) {
      trace.push(...result.trace);
    }

    if (result.value) {
      packetResults.push(result.value);
    }
  }

  applyBatchReferenceChecks({
    results: packetResults,
    packets: adaptedPackets,
    verificationMode,
    checkLineage: input.check_lineage ?? false,
    checkRefs: input.check_refs ?? false,
  });

  const report = createTrustedVerificationReport({
    targetKind: input.target_kind ?? 'packet_batch',
    verificationMode,
    packetResults,
    issues,
    trace,
    signatureResults: packetResults.map(
      (result) => `${result.packet_ref?.packet_id ?? result.entry_id ?? 'unknown'}:${result.signature_status}`
    ),
    hashResults: packetResults.map(
      (result) => `${result.packet_ref?.packet_id ?? result.entry_id ?? 'unknown'}:${result.digest_status}`
    ),
    lineageResults: packetResults.map(
      (result) => `${result.packet_ref?.packet_id ?? result.entry_id ?? 'unknown'}:${result.lineage_status}`
    ),
    refResults: packetResults.map(
      (result) => `${result.packet_ref?.packet_id ?? result.entry_id ?? 'unknown'}:${result.ref_status}`
    ),
  });

  trace.push(verificationTrace({
    step_id: 'verification.packet_batch.assess',
    status: report.blocking_issue_count > 0
      ? 'blocked'
      : report.warning_count > 0
        ? 'partial'
        : 'ok',
    preset_ids: ['trusted.verification.packet_batch.v0'],
    notes: `Verified ${report.packet_count} packet(s) in batch context.`,
  }));
  report.trace = [...trace];

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_VERIFICATION_COORDINATOR_ID,
    coordinator_kind: 'verification',
    status: report.blocking_issue_count > 0
      ? 'blocked'
      : report.warning_count > 0
        ? 'partial'
        : 'ok',
    value: report,
    issues,
    trace,
    mode: contextMode,
  });
}
