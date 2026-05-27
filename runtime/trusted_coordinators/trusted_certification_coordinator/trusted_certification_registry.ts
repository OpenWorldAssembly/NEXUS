/**
 * File: trusted_certification_registry.ts
 * Description: Internal operation registry for the Trusted Certification Coordinator.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { auditTrustedCertificationReadiness } from './functions/audit_trusted_certification_readiness.ts';
import { certifyTrustedSignedTicket } from './functions/certify_signed_ticket.ts';
import { prepareTrustedCertificationTicket } from './functions/prepare_certification_ticket.ts';
import { prepareTrustedSignatureRequests } from './functions/prepare_signature_requests.ts';
import { verifyTrustedSignedTicket } from './functions/verify_signed_ticket.ts';
import type { TrustedCertificationCoordinatorRequest } from './trusted_certification_types.ts';

type TrustedCertificationHandler = (request: TrustedCertificationCoordinatorRequest) => TrustedRuntimeCoordinatorResult<unknown>;

const TRUSTED_CERTIFICATION_REGISTRY: Record<TrustedCertificationCoordinatorRequest['operation'], TrustedCertificationHandler> = {
  prepare_certification_ticket: (request) => {
    if (request.operation !== 'prepare_certification_ticket') {
      throw new Error('Invalid Trusted Certification operation dispatch.');
    }
    return prepareTrustedCertificationTicket(request.input);
  },
  prepare_signature_requests: (request) => {
    if (request.operation !== 'prepare_signature_requests') {
      throw new Error('Invalid Trusted Certification operation dispatch.');
    }
    return prepareTrustedSignatureRequests(request.input);
  },
  verify_signed_ticket: (request) => {
    if (request.operation !== 'verify_signed_ticket') {
      throw new Error('Invalid Trusted Certification operation dispatch.');
    }
    return verifyTrustedSignedTicket(request.input);
  },
  certify_signed_ticket: (request) => {
    if (request.operation !== 'certify_signed_ticket') {
      throw new Error('Invalid Trusted Certification operation dispatch.');
    }
    return certifyTrustedSignedTicket(request.input);
  },
  audit_readiness: (request) => {
    if (request.operation !== 'audit_readiness') {
      throw new Error('Invalid Trusted Certification operation dispatch.');
    }
    return auditTrustedCertificationReadiness(request.input);
  },
};

export function runTrustedCertificationOperation(
  request: TrustedCertificationCoordinatorRequest
): TrustedRuntimeCoordinatorResult<unknown> {
  return TRUSTED_CERTIFICATION_REGISTRY[request.operation](request);
}
