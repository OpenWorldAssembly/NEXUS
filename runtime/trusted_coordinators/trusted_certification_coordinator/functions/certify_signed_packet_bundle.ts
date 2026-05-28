/**
 * File: certify_signed_packet_bundle.ts
 * Description: Certifies the existing mutation finalize signed-packet bundle shape against a certification ticket.
 */

import { randomUUID } from 'node:crypto';

import type { PacketEnvelope } from '@core/schema/packet-schema';
import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  certificationTrace,
  consumeStoredTrustedCertificationTicket,
} from '../trusted_certification_internal.ts';
import {
  TRUSTED_CERTIFICATION_COORDINATOR_ID,
  type CertifyTrustedSignedPacketBundleInput,
  type TrustedCertifiedPacketSet,
} from '../trusted_certification_types.ts';

function signedPacketSignerRef(packet: PacketEnvelope): string | null {
  return packet.header.integrity.embedded_signatures[0]?.signer_packet_ref?.packet_id ?? null;
}

export function certifyTrustedSignedPacketBundle(
  input: CertifyTrustedSignedPacketBundleInput
): TrustedRuntimeCoordinatorResult<TrustedCertifiedPacketSet> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  let stored;

  try {
    stored = consumeStoredTrustedCertificationTicket(input.ticket_id);
  } catch (error) {
    issues.push(trustedIssue({
      severity: 'error',
      code: 'certification.ticket_consume_failed',
      path: 'ticket_id',
      message: error instanceof Error ? error.message : 'Unable to consume certification ticket.',
    }));

    trace.push(certificationTrace({
      step_id: 'certification.signed_packet_bundle.consume',
      status: 'blocked',
      preset_ids: ['trusted.certification_ticket_store.v0'],
      notes: `Could not consume certification ticket ${input.ticket_id}.`,
    }));

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
      coordinator_kind: 'certification',
      value: null,
      issues,
      trace,
      status: 'blocked',
      operation_id: input.ticket_id,
      request_id: null,
      mode: input.context_mode ?? null,
    });
  }

  const expectedPackets = stored.ticket.expected_packets;

  if (expectedPackets.length !== input.signed_packets.length) {
    issues.push(trustedIssue({
      severity: 'error',
      code: 'certification.signed_packet_count_mismatch',
      path: 'signed_packets',
      message: `Certification expected ${expectedPackets.length} signed packet(s), but received ${input.signed_packets.length}.`,
    }));
  }

  const signedPacketsByKey = new Map(
    input.signed_packets.map((packet) => [
      `${packet.header.packet_id}:${packet.header.revision_id}`,
      packet,
    ])
  );

  for (const expectedPacket of expectedPackets) {
    const key = `${expectedPacket.packet_id}:${expectedPacket.revision_id}`;
    const signedPacket = signedPacketsByKey.get(key);

    if (!signedPacket) {
      issues.push(trustedIssue({
        severity: 'error',
        code: 'certification.expected_packet_missing',
        path: `signed_packets.${key}`,
        message: `Certification expected signed packet ${key}.`,
      }));
      continue;
    }

    const signedDigest = signedPacket.header.integrity.digest ?? '';

    if (signedDigest !== expectedPacket.unsigned_digest) {
      issues.push(trustedIssue({
        severity: 'error',
        code: 'certification.unsigned_digest_mismatch',
        path: `signed_packets.${key}.header.integrity.digest`,
        message: `Signed packet ${key} no longer matches the prepared unsigned digest.`,
      }));
    }

    if (signedPacket.header.type !== expectedPacket.packet_type) {
      issues.push(trustedIssue({
        severity: 'error',
        code: 'certification.packet_type_mismatch',
        path: `signed_packets.${key}.header.type`,
        message: `Signed packet ${key} changed packet type from ${expectedPacket.packet_type} to ${signedPacket.header.type}.`,
      }));
    }

    if (
      stored.ticket.required_signer_ref &&
      signedPacketSignerRef(signedPacket) !== stored.ticket.required_signer_ref
    ) {
      issues.push(trustedIssue({
        severity: 'error',
        code: 'certification.signer_mismatch',
        path: `signed_packets.${key}.header.integrity.embedded_signatures`,
        message: `Signed packet ${key} was not signed by the required actor packet.`,
      }));
    }
  }

  const blockers = [
    ...(stored.build_result.blockers ?? []),
    ...(stored.inspection_report.blockers ?? []),
  ];
  const warnings = [
    ...(stored.build_result.warnings ?? []),
    ...(stored.inspection_report.warnings ?? []),
  ];
  const packetById = new Map(input.signed_packets.map((packet) => [packet.header.packet_id, packet]));
  const candidateGraph = {
    ...stored.build_result.candidate_graph,
    candidate_nodes: stored.build_result.candidate_graph.candidate_nodes.map((node) => ({
      ...node,
      packet_envelope: node.packet_envelope
        ? packetById.get(node.packet_envelope.header.packet_id) ?? node.packet_envelope
        : node.packet_envelope,
    })),
  };
  const archiveReady = blockers.length === 0 && !issues.some((issue) => issue.severity === 'error');
  const certified: TrustedCertifiedPacketSet = {
    certified_kind: 'trusted.certified_packet_set',
    certification_id: `trusted-certification-${randomUUID()}`,
    ticket_id: stored.ticket.ticket_id,
    certified_at: new Date().toISOString(),
    signer_ref: stored.ticket.required_signer_ref ?? (input.signed_packets[0] ? signedPacketSignerRef(input.signed_packets[0]) : null) ?? 'unknown',
    source_plan_id: stored.plan.plan_id,
    hashes: stored.ticket.hashes,
    candidate_graph: candidateGraph,
    archive_ready: archiveReady,
    blockers,
    warnings,
    issues,
    trace,
  };

  trace.push(certificationTrace({
    step_id: 'certification.signed_packet_bundle.certify',
    status: archiveReady ? (warnings.length > 0 ? 'partial' : 'ok') : 'blocked',
    preset_ids: ['trusted.certified_packet_set.v0'],
    notes: archiveReady
      ? `Certified signed packet bundle ${certified.certification_id}; ready for Verification and Archive.`
      : `Signed packet bundle for ticket ${stored.ticket.ticket_id} failed certification checks.`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
    coordinator_kind: 'certification',
    value: archiveReady ? certified : null,
    issues,
    trace,
    status: archiveReady ? (warnings.length > 0 ? 'partial' : 'ok') : 'blocked',
    operation_id: stored.ticket.operation_id,
    request_id: stored.ticket.request_id,
    mode: input.context_mode ?? stored.plan.context_mode,
  });
}
