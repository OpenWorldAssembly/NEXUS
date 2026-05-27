/**
 * File: trusted_verification_internal.ts
 * Description: Internal helpers for Trusted Verification Coordinator tracing, packet normalization, signatures, refs, and report aggregation.
 */

import { createHash, randomUUID } from 'node:crypto';

import {
  inspectPacketEnvelopeForTarget,
  parsePacketEnvelope,
  type PacketCompatibilityReadResult,
  type PacketEnvelope,
  type PacketRef,
  type PacketRevisionRef,
} from '@core/schema/packet-schema';
import {
  createTrustedTraceEntry,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorStatus,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import type { TrustedSignedCertificationTicket } from '@runtime/trusted_coordinators/trusted_certification_coordinator/index.ts';
import {
  verifyPacketSignatureDetailed,
} from '@runtime/nexus/identity-crypto';
import {
  TRUSTED_VERIFICATION_COORDINATOR_ID,
  type TrustedPacketVerificationResult,
  type TrustedVerificationCheckStatus,
  type TrustedVerificationCompatibilityStatus,
  type TrustedVerificationMode,
  type TrustedVerificationOverallStatus,
  type TrustedVerificationPacketEntry,
  type TrustedVerificationReport,
  type TrustedVerificationSignatureStatus,
  type TrustedVerificationSignerStatus,
  type TrustedVerificationTargetKind,
} from './trusted_verification_types.ts';

export function verificationTrace(input: {
  step_id: string;
  status?: TrustedRuntimeCoordinatorStatus;
  preset_ids?: readonly string[];
  notes: string;
}): TrustedRuntimeCoordinatorTraceEntry {
  return createTrustedTraceEntry({
    coordinator_id: TRUSTED_VERIFICATION_COORDINATOR_ID,
    step_id: input.step_id,
    status: input.status ?? 'ok',
    preset_ids: input.preset_ids ?? ['trusted.verification.v0'],
    notes: input.notes,
  });
}

export function verificationIssue(
  input: TrustedRuntimeCoordinatorIssue
): TrustedRuntimeCoordinatorIssue {
  return trustedIssue(input);
}

export function createVerificationId(): string {
  return `trusted-verification-${randomUUID()}`;
}

export function packetRef(packet: PacketEnvelope): PacketRef {
  return { packet_id: packet.header.packet_id };
}

export function revisionRef(packet: PacketEnvelope): PacketRevisionRef {
  return {
    packet_id: packet.header.packet_id,
    revision_id: packet.header.revision_id,
  };
}

export function packetSubtype(packet: PacketEnvelope): string | null {
  const body = packet.body as Record<string, unknown>;

  return typeof body.subtype === 'string' ? body.subtype : null;
}

export function signerPacketRefFromPacket(packet: PacketEnvelope): PacketRef | null {
  return packet.header.integrity.embedded_signatures[0]?.signer_packet_ref ?? null;
}

export function digestFromPacket(packet: PacketEnvelope): string | null {
  return typeof packet.header.integrity.digest === 'string'
    ? packet.header.integrity.digest
    : null;
}

export function normalizeVerificationMode(
  mode: TrustedVerificationMode | undefined
): TrustedVerificationMode {
  return mode ?? 'advisory';
}

export function isStrictVerificationMode(mode: TrustedVerificationMode): boolean {
  return mode === 'strict' || mode === 'reseed' || mode === 'archive_sweep';
}

export function compatibilityStatus(
  compatibilityRead: PacketCompatibilityReadResult
): TrustedVerificationCompatibilityStatus {
  if (compatibilityRead.status.supported_write_target === 'blocked') {
    return 'blocked';
  }

  if (compatibilityRead.status.is_lossy) {
    return 'lossy';
  }

  return compatibilityRead.status.is_exact ? 'native' : 'adapted';
}

export function overallStatus(input: {
  structuralStatus: TrustedVerificationCheckStatus;
  compatibilityStatus: TrustedVerificationCompatibilityStatus;
  digestStatus: TrustedVerificationCheckStatus;
  signatureStatus: TrustedVerificationSignatureStatus;
  signerStatus: TrustedVerificationSignerStatus;
  lineageStatus: TrustedVerificationCheckStatus;
  refStatus: TrustedVerificationCheckStatus;
  blockers: readonly string[];
  warnings: readonly string[];
}): TrustedVerificationOverallStatus {
  if (
    input.blockers.length > 0 ||
    input.structuralStatus === 'failed' ||
    input.compatibilityStatus === 'blocked' ||
    input.digestStatus === 'failed' ||
    input.signatureStatus === 'invalid' ||
    input.signatureStatus === 'canonicalization_mismatch' ||
    input.signatureStatus === 'signer_mismatch' ||
    input.signatureStatus === 'key_binding_missing' ||
    input.lineageStatus === 'failed' ||
    input.refStatus === 'failed'
  ) {
    return 'blocked';
  }

  if (
    input.warnings.length > 0 ||
    input.compatibilityStatus === 'lossy' ||
    input.signatureStatus === 'missing' ||
    input.signatureStatus === 'unverifiable' ||
    input.signerStatus === 'unknown' ||
    input.signerStatus === 'missing' ||
    input.lineageStatus === 'warning' ||
    input.refStatus === 'warning'
  ) {
    return 'warning';
  }

  if (input.structuralStatus === 'unknown' || input.signatureStatus === 'unknown') {
    return 'unknown';
  }

  return 'passed';
}

export function emptyPacketVerificationResult(input: {
  entryId?: string | null;
  blocker: string;
}): TrustedPacketVerificationResult {
  return {
    result_kind: 'trusted.packet_verification_result',
    entry_id: input.entryId ?? null,
    packet_ref: null,
    revision_ref: null,
    packet_type: null,
    packet_subtype: null,
    structural_status: 'failed',
    compatibility_status: 'unknown',
    digest_status: 'unknown',
    signature_status: 'unknown',
    signer_status: 'unknown',
    lineage_status: 'skipped',
    ref_status: 'skipped',
    overall_status: 'blocked',
    signer_packet_ref: null,
    declared_schema_version: null,
    target_schema_version: null,
    warnings: [],
    blockers: [input.blocker],
  };
}

export function inspectVerificationPacket(input: {
  rawPacket: unknown;
  targetSchemaVersion?: string;
}): PacketCompatibilityReadResult {
  return inspectPacketEnvelopeForTarget(input.rawPacket, {
    target_schema_version: input.targetSchemaVersion,
  });
}

export function normalizePacketEntryMaterial(entry: TrustedVerificationPacketEntry): unknown | null {
  return entry.raw_packet ?? entry.packet ?? null;
}

export function buildSignerMap(input: {
  packets?: readonly TrustedVerificationPacketEntry[];
  signerPackets?: readonly unknown[];
}): Map<string, unknown> {
  const signerMap = new Map<string, unknown>();
  const candidates = [
    ...(input.signerPackets ?? []),
    ...(input.packets ?? [])
      .map((entry) => normalizePacketEntryMaterial(entry))
      .filter((value): value is unknown => value !== null && value !== undefined),
  ];

  for (const candidate of candidates) {
    try {
      const packet = parsePacketEnvelope(candidate);

      if (packet.header.type === 'Element') {
        signerMap.set(packet.header.packet_id, candidate);
      }
    } catch {
      continue;
    }
  }

  return signerMap;
}

export async function assessPacketSignature(input: {
  rawPacket: unknown;
  adaptedPacket: PacketEnvelope;
  signerPacket?: unknown | null;
  verificationMode: TrustedVerificationMode;
}): Promise<{
  digestStatus: TrustedVerificationCheckStatus;
  signatureStatus: TrustedVerificationSignatureStatus;
  signerStatus: TrustedVerificationSignerStatus;
  signerPacketRef: PacketRef | null;
  warnings: string[];
  blockers: string[];
}> {
  const warnings: string[] = [];
  const blockers: string[] = [];
  const strict = isStrictVerificationMode(input.verificationMode);
  const signature = input.adaptedPacket.header.integrity.embedded_signatures[0] ?? null;
  const signerPacketRef = signerPacketRefFromPacket(input.adaptedPacket);
  const digestStatus: TrustedVerificationCheckStatus = digestFromPacket(input.adaptedPacket)
    ? 'passed'
    : signature
      ? 'failed'
      : 'skipped';

  if (!signature) {
    const message = 'Packet does not include an embedded signature.';

    if (strict) {
      blockers.push(message);
    } else {
      warnings.push(message);
    }

    return {
      digestStatus,
      signatureStatus: 'missing',
      signerStatus: 'missing',
      signerPacketRef,
      warnings,
      blockers,
    };
  }

  if (!input.signerPacket) {
    const message = 'Signer packet is not available in the verification context.';

    if (strict) {
      blockers.push(message);
    } else {
      warnings.push(message);
    }

    return {
      digestStatus,
      signatureStatus: 'unverifiable',
      signerStatus: 'unknown',
      signerPacketRef,
      warnings,
      blockers,
    };
  }

  try {
    const verification = await verifyPacketSignatureDetailed({
      packet: input.rawPacket,
      signerPacket: input.signerPacket,
    });

    if (verification.isValid) {
      return {
        digestStatus,
        signatureStatus: 'valid',
        signerStatus: 'known',
        signerPacketRef,
        warnings,
        blockers,
      };
    }

    const status: TrustedVerificationSignatureStatus =
      verification.failureKind === 'canonicalization_mismatch'
        ? 'canonicalization_mismatch'
        : verification.failureKind === 'signer_mismatch'
          ? 'signer_mismatch'
          : verification.failureKind === 'key_binding_missing'
            ? 'key_binding_missing'
            : 'invalid';
    const message = status === 'canonicalization_mismatch'
      ? 'Packet canonicalization did not match the stored digest.'
      : status === 'signer_mismatch'
        ? 'Embedded signature signer ref does not match the supplied signer packet.'
        : status === 'key_binding_missing'
          ? 'Signer packet does not expose a matching active public key binding.'
          : 'Embedded packet signature did not verify.';

    blockers.push(message);

    return {
      digestStatus: status === 'canonicalization_mismatch' ? 'failed' : digestStatus,
      signatureStatus: status,
      signerStatus: status === 'key_binding_missing' ? 'unusable' : 'known',
      signerPacketRef,
      warnings,
      blockers,
    };
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Packet signature verification failed unexpectedly.';

    blockers.push(message);

    return {
      digestStatus,
      signatureStatus: 'invalid',
      signerStatus: 'known',
      signerPacketRef,
      warnings,
      blockers,
    };
  }
}

export function collectPacketReferenceIds(packet: PacketEnvelope): string[] {
  const ids = new Set<string>();
  const addPacketRef = (ref: PacketRef | null | undefined) => {
    if (ref?.packet_id) {
      ids.add(ref.packet_id);
    }
  };

  addPacketRef(packet.header.authority_scope_ref);
  packet.header.applicable_scope_refs.forEach(addPacketRef);
  packet.header.edges.forEach((edge) => addPacketRef(edge.target));
  packet.header.moderation.policy_refs.forEach(addPacketRef);
  packet.header.integrity.signature_refs.forEach(addPacketRef);
  addPacketRef(packet.header.provenance.created_by);
  addPacketRef(packet.header.provenance.submitted_by);
  addPacketRef(packet.header.provenance.imported_from_revision);

  return Array.from(ids).sort((left, right) => left.localeCompare(right));
}

export function applyBatchReferenceChecks(input: {
  results: TrustedPacketVerificationResult[];
  packets: readonly PacketEnvelope[];
  verificationMode: TrustedVerificationMode;
  checkLineage: boolean;
  checkRefs: boolean;
}): void {
  const packetIds = new Set(input.packets.map((packet) => packet.header.packet_id));
  const revisionIds = new Set(
    input.packets.map((packet) => `${packet.header.packet_id}:${packet.header.revision_id}`)
  );
  const packetByRevision = new Map(
    input.packets.map((packet) => [
      `${packet.header.packet_id}:${packet.header.revision_id}`,
      packet,
    ])
  );
  const strict = isStrictVerificationMode(input.verificationMode);

  for (const result of input.results) {
    if (!result.revision_ref) {
      continue;
    }

    const packet = packetByRevision.get(
      `${result.revision_ref.packet_id}:${result.revision_ref.revision_id}`
    );

    if (!packet) {
      continue;
    }

    if (input.checkLineage) {
      const missingParents = packet.header.parent_revision_refs.filter(
        (ref) => !revisionIds.has(`${ref.packet_id}:${ref.revision_id}`)
      );

      if (missingParents.length > 0) {
        const message = `${missingParents.length} parent revision ref(s) are outside this verification set.`;

        if (strict) {
          result.blockers.push(message);
          result.lineage_status = 'failed';
        } else {
          result.warnings.push(message);
          result.lineage_status = 'warning';
        }
      } else {
        result.lineage_status = 'passed';
      }
    }

    if (input.checkRefs) {
      const missingPacketRefs = collectPacketReferenceIds(packet)
        .filter((packetId) => packetId !== packet.header.packet_id)
        .filter((packetId) => !packetIds.has(packetId));

      if (missingPacketRefs.length > 0) {
        const message = `${missingPacketRefs.length} packet ref(s) are outside this verification set.`;

        if (strict) {
          result.blockers.push(message);
          result.ref_status = 'failed';
        } else {
          result.warnings.push(message);
          result.ref_status = 'warning';
        }
      } else {
        result.ref_status = 'passed';
      }
    }

    result.overall_status = overallStatus({
      structuralStatus: result.structural_status,
      compatibilityStatus: result.compatibility_status,
      digestStatus: result.digest_status,
      signatureStatus: result.signature_status,
      signerStatus: result.signer_status,
      lineageStatus: result.lineage_status,
      refStatus: result.ref_status,
      blockers: result.blockers,
      warnings: result.warnings,
    });
  }
}

export function normalizeBundleEntries(bundle: unknown): TrustedVerificationPacketEntry[] {
  let parsedBundle = bundle;

  if (bundle instanceof Uint8Array) {
    parsedBundle = JSON.parse(new TextDecoder().decode(bundle)) as unknown;
  } else if (bundle instanceof ArrayBuffer) {
    parsedBundle = JSON.parse(new TextDecoder().decode(new Uint8Array(bundle))) as unknown;
  } else if (typeof bundle === 'string') {
    parsedBundle = JSON.parse(bundle) as unknown;
  }

  if (Array.isArray(parsedBundle)) {
    return parsedBundle.map((packet, index) => ({
      entry_id: `bundle.entry.${index}`,
      raw_packet: packet,
    }));
  }

  if (!parsedBundle || typeof parsedBundle !== 'object') {
    return [{ entry_id: 'bundle.raw', raw_packet: parsedBundle }];
  }

  const record = parsedBundle as Record<string, unknown>;
  const packetEntries = Array.isArray(record.packets)
    ? record.packets
    : Array.isArray(record.revisions)
      ? record.revisions
      : null;

  if (packetEntries) {
    return packetEntries.map((packet, index) => ({
      entry_id: `bundle.entry.${index}`,
      raw_packet: packet,
    }));
  }

  return [{ entry_id: 'bundle.raw', raw_packet: parsedBundle }];
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForHash(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined && typeof entry !== 'function')
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeForHash(entry)])
    );
  }

  return value;
}

export function hashTrustedVerificationValue(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(normalizeForHash(value)))
    .digest('hex');
}

export function isSignedCertificationTicket(
  value: unknown
): value is TrustedSignedCertificationTicket {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.signed_ticket_kind === 'trusted.signed_certification_ticket' &&
    typeof record.ticket_id === 'string' &&
    typeof record.signer_ref === 'string' &&
    typeof record.signed_payload_hash === 'string' &&
    typeof record.signature_value === 'string'
  );
}

export function createTrustedVerificationReport(input: {
  targetKind: TrustedVerificationTargetKind;
  verificationMode: TrustedVerificationMode;
  packetResults: TrustedPacketVerificationResult[];
  hashResults?: string[];
  signatureResults?: string[];
  lineageResults?: string[];
  refResults?: string[];
  certificationResults?: string[];
  warnings?: string[];
  blockers?: string[];
  issues?: TrustedRuntimeCoordinatorIssue[];
  trace?: TrustedRuntimeCoordinatorTraceEntry[];
}): TrustedVerificationReport {
  const packetWarnings = input.packetResults.flatMap((result) => result.warnings);
  const packetBlockers = input.packetResults.flatMap((result) => result.blockers);
  const warnings = [...(input.warnings ?? []), ...packetWarnings];
  const blockers = [...(input.blockers ?? []), ...packetBlockers];
  const passedCount = input.packetResults.filter(
    (result) => result.overall_status === 'passed'
  ).length;
  const failedCount = input.packetResults.filter(
    (result) => result.overall_status === 'blocked'
  ).length;
  const skippedCount = input.packetResults.filter(
    (result) => result.structural_status === 'skipped'
  ).length;

  return {
    report_kind: 'trusted.verification_report',
    verification_id: createVerificationId(),
    target_kind: input.targetKind,
    verification_mode: input.verificationMode,
    checked_at: new Date().toISOString(),
    packet_count: input.packetResults.length,
    passed_count: passedCount,
    failed_count: failedCount,
    skipped_count: skippedCount,
    blocking_issue_count: blockers.length + (input.issues ?? []).filter((issue) => issue.severity === 'error').length,
    warning_count: warnings.length + (input.issues ?? []).filter((issue) => issue.severity === 'warning').length,
    packet_results: input.packetResults,
    hash_results: input.hashResults ?? [],
    signature_results: input.signatureResults ?? [],
    lineage_results: input.lineageResults ?? [],
    ref_results: input.refResults ?? [],
    certification_results: input.certificationResults ?? [],
    blockers,
    warnings,
    issues: [...(input.issues ?? [])],
    trace: [...(input.trace ?? [])],
  };
}
