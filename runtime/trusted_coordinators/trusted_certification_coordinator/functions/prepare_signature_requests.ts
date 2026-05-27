/**
 * File: prepare_signature_requests.ts
 * Description: Converts a certification ticket into interface-dispatchable signature request payloads.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { certificationTrace } from '../trusted_certification_internal.ts';
import {
  TRUSTED_CERTIFICATION_COORDINATOR_ID,
  type PrepareTrustedSignatureRequestsInput,
  type TrustedSignatureRequest,
} from '../trusted_certification_types.ts';

export function prepareTrustedSignatureRequests(
  input: PrepareTrustedSignatureRequestsInput
): TrustedRuntimeCoordinatorResult<TrustedSignatureRequest[]> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];

  if (input.ticket.status !== 'open') {
    issues.push({
      severity: 'error',
      code: 'trusted_certification_ticket_not_open',
      path: 'ticket.status',
      message: 'Only open certification tickets can produce signature requests.',
    });
  }

  if (new Date(input.ticket.expires_at).getTime() < Date.now()) {
    issues.push({
      severity: 'error',
      code: 'trusted_certification_ticket_expired',
      path: 'ticket.expires_at',
      message: 'Certification ticket expired before signature requests could be prepared.',
    });
  }

  const signatureRequests: TrustedSignatureRequest[] = issues.some((issue) => issue.severity === 'error')
    ? []
    : [{
        request_kind: 'trusted.signature_request',
        ticket_id: input.ticket.ticket_id,
        required_signer_ref: input.ticket.required_signer_ref,
        required_signature_purpose: input.ticket.required_signature_purpose,
        payload_hash: input.ticket.hashes.payload_hash,
        expires_at: input.ticket.expires_at,
        instructions:
          'Sign the certification payload hash and return it through the certification.ticket.signed_return dispatch path.',
      }];

  trace.push(certificationTrace({
    step_id: 'certification.signature_requests.prepare',
    status: signatureRequests.length > 0 ? 'ok' : 'blocked',
    preset_ids: ['trusted.signature_request.v0'],
    notes: `Prepared ${signatureRequests.length} certification signature request(s) for ticket ${input.ticket.ticket_id}.`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_CERTIFICATION_COORDINATOR_ID,
    coordinator_kind: 'certification',
    value: signatureRequests,
    issues,
    trace,
    status: signatureRequests.length > 0 ? 'ok' : 'blocked',
    operation_id: input.ticket.operation_id,
    request_id: input.ticket.request_id,
    mode: input.context_mode ?? null,
  });
}
