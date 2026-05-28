/**
 * File: prepare_certification_ticket.ts
 * Description: Creates a certification ticket from a plan, build result, and inspection report snapshot.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  buildTrustedCertificationHashBundle,
  certificationTicketExpiresAt,
  certificationTrace,
  createCertificationTicketId,
  uniqueSorted,
  writeStoredTrustedCertificationTicket,
} from '../trusted_certification_internal.ts';
import {
  TRUSTED_CERTIFICATION_COORDINATOR_ID,
  type PrepareTrustedCertificationTicketInput,
  type TrustedCertificationPackage,
  type TrustedCertificationTicket,
  type TrustedSignatureRequest,
} from '../trusted_certification_types.ts';

function buildSignatureRequest(ticket: TrustedCertificationTicket): TrustedSignatureRequest {
  return {
    request_kind: 'trusted.signature_request',
    ticket_id: ticket.ticket_id,
    required_signer_ref: ticket.required_signer_ref,
    required_signature_purpose: ticket.required_signature_purpose,
    payload_hash: ticket.hashes.payload_hash,
    expires_at: ticket.expires_at,
    instructions:
      'Sign the certification ticket payload hash only if the displayed packet candidate summary matches the intended operation.',
  };
}

export function prepareTrustedCertificationTicket(
  input: PrepareTrustedCertificationTicketInput
): TrustedRuntimeCoordinatorResult<TrustedCertificationPackage> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const blockers = uniqueSorted([
    ...(input.build_result.blockers ?? []),
    ...(input.inspection_report.blockers ?? []),
  ]);
  const warnings = uniqueSorted([
    ...(input.build_result.warnings ?? []),
    ...(input.inspection_report.warnings ?? []),
  ]);
  const planMismatch = input.plan.plan_id !== input.build_result.source_plan_id ||
    input.plan.plan_id !== input.inspection_report.source_plan_id;

  if (planMismatch) {
    issues.push({
      severity: 'error',
      code: 'trusted_certification_plan_snapshot_mismatch',
      path: 'certification.plan_id',
      message: 'Certification inputs do not point at the same frozen operation plan snapshot.',
    });
    blockers.push('Certification inputs do not share the same source plan id.');
  }

  if (input.inspection_report.invalid_candidate_count > 0) {
    issues.push({
      severity: 'error',
      code: 'trusted_certification_invalid_candidate_graph',
      path: 'inspection_report.invalid_candidate_count',
      message: 'Certification requires inspection to pass before a signing ticket can be opened.',
    });
    blockers.push('Inspection reported invalid packet candidates.');
  }

  const hashes = buildTrustedCertificationHashBundle({
    plan: input.plan,
    build_result: input.build_result,
    inspection_report: input.inspection_report,
    candidate_graph: input.build_result.candidate_graph,
  });
  const issuedAt = new Date().toISOString();
  const ticket: TrustedCertificationTicket = {
    ticket_kind: 'trusted.certification_ticket',
    ticket_id: createCertificationTicketId(),
    operation_id: input.operation_id ?? input.plan.plan_id,
    request_id: input.request_id ?? null,
    source_plan_id: input.plan.plan_id,
    source_build_result_plan_id: input.build_result.source_plan_id,
    required_signer_ref: input.actor_packet_id ?? input.node_element_id ?? null,
    required_signature_purpose: 'packet_candidate_certification',
    issued_at: issuedAt,
    expires_at: certificationTicketExpiresAt(input.ttl_ms),
    status: blockers.length > 0 || issues.some((issue) => issue.severity === 'error') ? 'rejected' : 'open',
    hashes,
    candidate_count: input.build_result.candidate_graph.candidate_nodes.length,
    blocker_count: blockers.length,
    warning_count: warnings.length,
    dispatch_return_kind: 'certification.ticket.signed_return',
    human_summary:
      `Certification ticket for plan ${input.plan.plan_id} with ${input.build_result.candidate_graph.candidate_nodes.length} candidate node(s).`,
    expected_packets: [...(input.expected_packets ?? [])],
  };
  const signatureRequests = ticket.status === 'open' ? [buildSignatureRequest(ticket)] : [];

  if (ticket.status === 'open') {
    writeStoredTrustedCertificationTicket({
      ticket,
      plan: input.plan,
      build_result: input.build_result,
      inspection_report: input.inspection_report,
      consumed_at: null,
    });
  }

  trace.push(certificationTrace({
    step_id: 'certification.ticket.prepare',
    status: ticket.status === 'open' ? (warnings.length > 0 ? 'partial' : 'ok') : 'blocked',
    preset_ids: ['trusted.certification_ticket.v0'],
    notes:
      ticket.status === 'open'
        ? `Prepared certification ticket ${ticket.ticket_id} for dispatch signature handoff.`
        : `Rejected certification ticket preparation for plan ${input.plan.plan_id}.`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
    coordinator_kind: 'certification',
    value: {
      package_kind: 'trusted.certification_package',
      ticket,
      signature_requests: signatureRequests,
      source_plan_id: input.plan.plan_id,
      archive_ready: false,
      blockers,
      warnings,
    },
    issues,
    trace,
    status: ticket.status === 'open'
      ? (warnings.length > 0 ? 'partial' : 'ok')
      : 'blocked',
    operation_id: input.operation_id ?? input.plan.plan_id,
    request_id: input.request_id ?? null,
    mode: input.context_mode ?? input.plan.context_mode,
  });
}
