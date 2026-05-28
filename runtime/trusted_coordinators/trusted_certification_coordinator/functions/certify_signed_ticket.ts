/**
 * File: certify_signed_ticket.ts
 * Description: Turns a verified signed certification ticket into an archive-ready certified packet set artifact.
 */

import { randomUUID } from 'node:crypto';

import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  appendTrustedChildResult,
  appendTrustedProcessStage,
  completeTrustedProcessChain,
  completeTrustedProcessStage,
  createTrustedProcessChain,
  startTrustedProcessStage,
} from '@runtime/trusted_coordinators/trusted_process.ts';
import {
  certificationTrace,
  consumeStoredTrustedCertificationTicket,
} from '../trusted_certification_internal.ts';
import {
  TRUSTED_CERTIFICATION_COORDINATOR_ID,
  type CertifyTrustedSignedTicketInput,
  type TrustedCertifiedPacketSet,
} from '../trusted_certification_types.ts';
import { verifyTrustedSignedTicket } from './verify_signed_ticket.ts';

export function certifyTrustedSignedTicket(
  input: CertifyTrustedSignedTicketInput
): TrustedRuntimeCoordinatorResult<TrustedCertifiedPacketSet> {
  const verification = verifyTrustedSignedTicket({
    signed_ticket: input.signed_ticket,
    context_mode: input.context_mode,
  });
  const issues: TrustedRuntimeCoordinatorIssue[] = [...verification.issues];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [...verification.trace];
  let processChain = createTrustedProcessChain({
    coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
    coordinator_kind: 'certification',
    operation_name: 'certify_signed_ticket',
    completion_policy: 'dry_run_only',
    mode: input.context_mode ?? null,
  });
  processChain = appendTrustedChildResult(processChain, verification, {
    stage_id: 'certification.signed_ticket.verify.child',
    operation_name: 'verify_signed_ticket',
    notes: 'Verified signed ticket before certification.',
  });

  if (verification.status === 'blocked' || verification.value?.valid === false) {
    trace.push(certificationTrace({
      step_id: 'certification.signed_ticket.certify',
      status: 'blocked',
      preset_ids: ['trusted.certified_packet_set.v0'],
      notes: `Certification stopped because signed ticket ${input.signed_ticket.ticket_id} did not verify.`,
    }));

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
      coordinator_kind: 'certification',
      value: null,
      issues,
      trace,
      status: 'blocked',
      operation_id: null,
      request_id: null,
      mode: input.context_mode ?? null,
      process_chain: completeTrustedProcessChain(processChain, { status: 'blocked' }),
    });
  }

  let stored;
  try {
    stored = consumeStoredTrustedCertificationTicket(input.signed_ticket.ticket_id);
  } catch (error) {
    issues.push(trustedIssue({
      severity: 'error',
      code: 'trusted_certification_ticket_consume_failed',
      path: 'signed_ticket.ticket_id',
      message: error instanceof Error ? error.message : 'Unable to consume certification ticket.',
    }));

    trace.push(certificationTrace({
      step_id: 'certification.signed_ticket.consume',
      status: 'blocked',
      preset_ids: ['trusted.certification_ticket_store.v0'],
      notes: `Could not consume signed certification ticket ${input.signed_ticket.ticket_id}.`,
    }));

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
      coordinator_kind: 'certification',
      value: null,
      issues,
      trace,
      status: 'blocked',
      operation_id: null,
      request_id: null,
      mode: input.context_mode ?? null,
      process_chain: completeTrustedProcessChain(
        appendTrustedProcessStage(
          processChain,
          completeTrustedProcessStage(
            startTrustedProcessStage({
              stage_id: 'certification.signed_ticket.consume',
              coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
              coordinator_kind: 'certification',
              operation_name: 'consume_signed_ticket',
              preset_ids: ['trusted.certification_ticket_store.v0'],
              notes: `Could not consume signed certification ticket ${input.signed_ticket.ticket_id}.`,
            }),
            {
              status: 'blocked',
              issues,
              blocked_work: [{
                work_id: 'certification.certified_packet_set.create',
                label: 'Certified packet set could not be created.',
                reason_code: 'certification.ticket_invalid',
              }],
            }
          ),
          { issues }
        ),
        { status: 'blocked' }
      ),
    });
  }

  const blockers = [
    ...(stored.build_result.blockers ?? []),
    ...(stored.inspection_report.blockers ?? []),
  ];
  const warnings = [
    ...(stored.build_result.warnings ?? []),
    ...(stored.inspection_report.warnings ?? []),
  ];
  const certified: TrustedCertifiedPacketSet = {
    certified_kind: 'trusted.certified_packet_set',
    certification_id: `trusted-certification-${randomUUID()}`,
    ticket_id: stored.ticket.ticket_id,
    certified_at: new Date().toISOString(),
    signer_ref: input.signed_ticket.signer_ref,
    source_plan_id: stored.plan.plan_id,
    hashes: stored.ticket.hashes,
    candidate_graph: stored.build_result.candidate_graph,
    certified_packet_keys: stored.ticket.expected_packets.map((packet) => `${packet.packet_id}:${packet.revision_id}`),
    archive_ready: blockers.length === 0,
    blockers,
    warnings,
    issues,
    trace,
  };

  trace.push(certificationTrace({
    step_id: 'certification.signed_ticket.certify',
    status: certified.archive_ready ? (warnings.length > 0 ? 'partial' : 'ok') : 'blocked',
    preset_ids: ['trusted.certified_packet_set.v0'],
    notes: certified.archive_ready
      ? `Certified packet candidate set ${certified.certification_id}; ready for Archival handoff.`
      : `Certified ticket ${stored.ticket.ticket_id} but blockers prevent Archival handoff.`,
  }));
  processChain = appendTrustedProcessStage(
    processChain,
    completeTrustedProcessStage(
      startTrustedProcessStage({
        stage_id: 'certification.signed_ticket.certify',
        coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
        coordinator_kind: 'certification',
        operation_name: 'certify_signed_ticket',
        preset_ids: ['trusted.certified_packet_set.v0'],
        notes: certified.archive_ready
          ? `Certified packet candidate set ${certified.certification_id}.`
          : `Certified ticket ${stored.ticket.ticket_id} but blockers prevent Archive handoff.`,
      }),
      {
        status: certified.archive_ready ? (warnings.length > 0 ? 'partial' : 'ok') : 'blocked',
        issues,
        artifacts: [{
          artifact_id: certified.certification_id,
          artifact_kind: 'certified_packet_set',
          label: 'Certified packet set artifact.',
          count: certified.candidate_graph.candidate_nodes.length,
          redacted: true,
        }],
        blocked_work: certified.archive_ready
          ? []
          : [{
              work_id: 'archive.store_certified_packet_set',
              label: 'Archive handoff is blocked by certification blockers.',
              reason_code: 'certification.ticket_invalid',
              count: certified.candidate_graph.candidate_nodes.length,
            }],
      }
    ),
    { issues }
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
    coordinator_kind: 'certification',
    value: certified,
    issues,
    trace,
    status: certified.archive_ready ? (warnings.length > 0 ? 'partial' : 'ok') : 'blocked',
    operation_id: stored.ticket.operation_id,
    request_id: stored.ticket.request_id,
    mode: input.context_mode ?? stored.plan.context_mode,
    process_chain: completeTrustedProcessChain(processChain, {
      status: certified.archive_ready ? (warnings.length > 0 ? 'partial' : 'ok') : 'blocked',
    }),
  });
}
