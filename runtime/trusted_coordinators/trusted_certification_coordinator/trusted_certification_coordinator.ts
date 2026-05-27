/**
 * File: trusted_certification_coordinator.ts
 * Description: Gated public Trusted Certification Coordinator surface for ticketing and certification handoff.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { runTrustedCertificationOperation } from './trusted_certification_registry.ts';
import {
  TRUSTED_CERTIFICATION_COORDINATOR_ID,
  type AuditTrustedCertificationReadinessInput,
  type CertifyTrustedSignedTicketInput,
  type PrepareTrustedCertificationTicketInput,
  type PrepareTrustedSignatureRequestsInput,
  type TrustedCertificationPackage,
  type TrustedCertificationReadinessReport,
  type TrustedCertifiedPacketSet,
  type TrustedSignatureRequest,
  type VerifyTrustedSignedTicketInput,
} from './trusted_certification_types.ts';
import type { TrustedSignedTicketVerification } from './functions/verify_signed_ticket.ts';

function castResult<TValue>(result: TrustedRuntimeCoordinatorResult<unknown>): TrustedRuntimeCoordinatorResult<TValue> {
  return result as TrustedRuntimeCoordinatorResult<TValue>;
}

export const trustedCertificationCoordinator = {
  id: 'trusted_certification_coordinator.v0',

  prepareCertificationTicket(
    input: PrepareTrustedCertificationTicketInput
  ): TrustedRuntimeCoordinatorResult<TrustedCertificationPackage> {
    return castResult(runTrustedCertificationOperation({
      operation: 'prepare_certification_ticket',
      input,
    }));
  },

  prepareSignatureRequests(
    input: PrepareTrustedSignatureRequestsInput
  ): TrustedRuntimeCoordinatorResult<TrustedSignatureRequest[]> {
    return castResult(runTrustedCertificationOperation({
      operation: 'prepare_signature_requests',
      input,
    }));
  },

  verifySignedTicket(
    input: VerifyTrustedSignedTicketInput
  ): TrustedRuntimeCoordinatorResult<TrustedSignedTicketVerification> {
    return castResult(runTrustedCertificationOperation({
      operation: 'verify_signed_ticket',
      input,
    }));
  },

  certifySignedTicket(
    input: CertifyTrustedSignedTicketInput
  ): TrustedRuntimeCoordinatorResult<TrustedCertifiedPacketSet> {
    return castResult(runTrustedCertificationOperation({
      operation: 'certify_signed_ticket',
      input,
    }));
  },

  auditReadiness(
    input?: AuditTrustedCertificationReadinessInput
  ): TrustedRuntimeCoordinatorResult<TrustedCertificationReadinessReport> {
    return castResult(runTrustedCertificationOperation({
      operation: 'audit_readiness',
      input,
    }));
  },
} as const satisfies {
  id: typeof TRUSTED_CERTIFICATION_COORDINATOR_ID;
  prepareCertificationTicket(input: PrepareTrustedCertificationTicketInput): TrustedRuntimeCoordinatorResult<TrustedCertificationPackage>;
  prepareSignatureRequests(input: PrepareTrustedSignatureRequestsInput): TrustedRuntimeCoordinatorResult<TrustedSignatureRequest[]>;
  verifySignedTicket(input: VerifyTrustedSignedTicketInput): TrustedRuntimeCoordinatorResult<TrustedSignedTicketVerification>;
  certifySignedTicket(input: CertifyTrustedSignedTicketInput): TrustedRuntimeCoordinatorResult<TrustedCertifiedPacketSet>;
  auditReadiness(input?: AuditTrustedCertificationReadinessInput): TrustedRuntimeCoordinatorResult<TrustedCertificationReadinessReport>;
};
