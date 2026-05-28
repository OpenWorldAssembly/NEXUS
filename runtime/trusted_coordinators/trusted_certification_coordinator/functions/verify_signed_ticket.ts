/**
 * File: verify_signed_ticket.ts
 * Description: Verifies that a returned certification signature response matches the stored ticket payload.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
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
import {
  certificationTrace,
  readStoredTrustedCertificationTicket,
} from '../trusted_certification_internal.ts';
import {
  TRUSTED_CERTIFICATION_COORDINATOR_ID,
  type VerifyTrustedSignedTicketInput,
} from '../trusted_certification_types.ts';

export type TrustedSignedTicketVerification = {
  verification_kind: 'trusted.signed_ticket_verification';
  ticket_id: string;
  valid: boolean;
  signer_ref: string;
  payload_hash: string;
  required_signer_ref: string | null;
  blockers: string[];
  warnings: string[];
};

export function verifyTrustedSignedTicket(
  input: VerifyTrustedSignedTicketInput
): TrustedRuntimeCoordinatorResult<TrustedSignedTicketVerification> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const stored = readStoredTrustedCertificationTicket(input.signed_ticket.ticket_id);
  let processChain = createTrustedProcessChain({
    coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
    coordinator_kind: 'certification',
    operation_name: 'verify_signed_ticket',
    completion_policy: 'dry_run_only',
    mode: input.context_mode ?? stored?.plan.context_mode ?? null,
    operation_id: stored?.ticket.operation_id ?? null,
    request_id: stored?.ticket.request_id ?? null,
  });

  if (!stored) {
    issues.push(trustedIssue({
      severity: 'error',
      code: 'trusted_certification_ticket_unknown',
      path: 'signed_ticket.ticket_id',
      message: 'Returned certification ticket does not match an open stored ticket.',
    }));
    blockers.push('Unknown or expired certification ticket.');
  }

  if (stored && new Date(stored.ticket.expires_at).getTime() < Date.now()) {
    issues.push(trustedIssue({
      severity: 'error',
      code: 'trusted_certification_ticket_expired',
      path: 'ticket.expires_at',
      message: 'Returned certification ticket is expired.',
    }));
    blockers.push('Certification ticket expired before signed return.');
  }

  if (stored && input.signed_ticket.signed_payload_hash !== stored.ticket.hashes.payload_hash) {
    issues.push(trustedIssue({
      severity: 'error',
      code: 'trusted_certification_payload_hash_mismatch',
      path: 'signed_ticket.signed_payload_hash',
      message: 'Returned certification signature does not match the prepared payload hash.',
    }));
    blockers.push('Signed certification payload hash does not match the prepared ticket.');
  }

  if (stored?.ticket.required_signer_ref && input.signed_ticket.signer_ref !== stored.ticket.required_signer_ref) {
    issues.push(trustedIssue({
      severity: 'error',
      code: 'trusted_certification_signer_mismatch',
      path: 'signed_ticket.signer_ref',
      message: 'Returned certification signer does not match the required signer reference.',
    }));
    blockers.push('Returned certification signer does not match the ticket signer requirement.');
  }

  if (!input.signed_ticket.signature_value) {
    issues.push(trustedIssue({
      severity: 'error',
      code: 'trusted_certification_signature_missing',
      path: 'signed_ticket.signature_value',
      message: 'Returned certification ticket is missing a signature value.',
    }));
    blockers.push('Certification signature value is missing.');
  }

  trace.push(certificationTrace({
    step_id: 'certification.signed_ticket.verify',
    status: blockers.length > 0 ? 'blocked' : 'ok',
    preset_ids: ['trusted.signed_ticket_verification.v0'],
    notes: blockers.length > 0
      ? `Rejected signed certification ticket ${input.signed_ticket.ticket_id}.`
      : `Verified signed certification ticket ${input.signed_ticket.ticket_id} against prepared payload hash.`,
  }));
  processChain = appendTrustedProcessStage(
    processChain,
    completeTrustedProcessStage(
      startTrustedProcessStage({
        stage_id: 'certification.signed_ticket.verify',
        coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
        coordinator_kind: 'certification',
        operation_name: 'verify_signed_ticket',
        preset_ids: ['trusted.signed_ticket_verification.v0'],
        notes: blockers.length > 0
          ? `Rejected signed certification ticket ${input.signed_ticket.ticket_id}.`
          : `Verified signed certification ticket ${input.signed_ticket.ticket_id}.`,
      }),
      {
        status: blockers.length > 0 ? 'blocked' : 'ok',
        issues,
        artifacts: [{
          artifact_id: input.signed_ticket.ticket_id,
          artifact_kind: 'signed_ticket_verification',
          label: 'Signed certification ticket verification.',
          redacted: true,
        }],
        blocked_work: blockers.length > 0
          ? [{
              work_id: 'certification.certify_signed_ticket',
              label: 'Certification cannot continue with an invalid signed ticket.',
              reason_code: 'certification.ticket_invalid',
            }]
          : [],
      }
    ),
    { issues }
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
    coordinator_kind: 'certification',
    value: {
      verification_kind: 'trusted.signed_ticket_verification',
      ticket_id: input.signed_ticket.ticket_id,
      valid: blockers.length === 0,
      signer_ref: input.signed_ticket.signer_ref,
      payload_hash: input.signed_ticket.signed_payload_hash,
      required_signer_ref: stored?.ticket.required_signer_ref ?? null,
      blockers,
      warnings,
    },
    issues,
    trace,
    status: blockers.length > 0 ? 'blocked' : 'ok',
    operation_id: stored?.ticket.operation_id ?? null,
    request_id: stored?.ticket.request_id ?? null,
    mode: input.context_mode ?? stored?.plan.context_mode ?? null,
    process_chain: completeTrustedProcessChain(processChain, {
      status: blockers.length > 0 ? 'blocked' : 'ok',
    }),
  });
}
