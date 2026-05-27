/**
 * File: trusted_verification_coordinator.ts
 * Description: Gated public Trusted Verification Coordinator surface for packets, bundles, archive sets, refs, lineage, and certification handoffs.
 */

import type {
  TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { runTrustedVerificationOperation } from './trusted_verification_registry.ts';
import {
  TRUSTED_VERIFICATION_COORDINATOR_ID,
  type AuditTrustedVerificationReadinessInput,
  type TrustedPacketVerificationResult,
  type TrustedVerificationReadinessReport,
  type TrustedVerificationReport,
  type VerifyTrustedArchivePacketSetInput,
  type VerifyTrustedBundleInput,
  type VerifyTrustedCertificationResultInput,
  type VerifyTrustedPacketBatchInput,
  type VerifyTrustedPacketInput,
  type VerifyTrustedPacketLineageInput,
  type VerifyTrustedPacketRefsInput,
} from './trusted_verification_types.ts';

function castResult<TValue>(
  result: TrustedRuntimeCoordinatorResult<unknown>
): TrustedRuntimeCoordinatorResult<TValue> {
  return result as TrustedRuntimeCoordinatorResult<TValue>;
}

function castPromise<TValue>(
  result: Promise<TrustedRuntimeCoordinatorResult<unknown>>
): Promise<TrustedRuntimeCoordinatorResult<TValue>> {
  return result as Promise<TrustedRuntimeCoordinatorResult<TValue>>;
}

export const trustedVerificationCoordinator = {
  id: 'trusted_verification_coordinator.v0',

  verifyPacket(
    input: VerifyTrustedPacketInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedPacketVerificationResult>> {
    return castPromise(Promise.resolve(runTrustedVerificationOperation({
      operation: 'verify_packet',
      input,
    })));
  },

  verifyPacketBatch(
    input: VerifyTrustedPacketBatchInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>> {
    return castPromise(Promise.resolve(runTrustedVerificationOperation({
      operation: 'verify_packet_batch',
      input,
    })));
  },

  verifyBundle(
    input: VerifyTrustedBundleInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>> {
    return castPromise(Promise.resolve(runTrustedVerificationOperation({
      operation: 'verify_bundle',
      input,
    })));
  },

  verifyArchivePacketSet(
    input: VerifyTrustedArchivePacketSetInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>> {
    return castPromise(Promise.resolve(runTrustedVerificationOperation({
      operation: 'verify_archive_packet_set',
      input,
    })));
  },

  verifyPacketLineage(
    input: VerifyTrustedPacketLineageInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>> {
    return castPromise(Promise.resolve(runTrustedVerificationOperation({
      operation: 'verify_packet_lineage',
      input,
    })));
  },

  verifyPacketRefs(
    input: VerifyTrustedPacketRefsInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>> {
    return castPromise(Promise.resolve(runTrustedVerificationOperation({
      operation: 'verify_packet_refs',
      input,
    })));
  },

  verifyCertificationResult(
    input: VerifyTrustedCertificationResultInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>> {
    return castPromise(Promise.resolve(runTrustedVerificationOperation({
      operation: 'verify_certification_result',
      input,
    })));
  },

  auditReadiness(
    input?: AuditTrustedVerificationReadinessInput
  ): TrustedRuntimeCoordinatorResult<TrustedVerificationReadinessReport> {
    return castResult(runTrustedVerificationOperation({
      operation: 'audit_readiness',
      input,
    }) as TrustedRuntimeCoordinatorResult<unknown>);
  },
} as const satisfies {
  id: typeof TRUSTED_VERIFICATION_COORDINATOR_ID;
  verifyPacket(input: VerifyTrustedPacketInput): Promise<TrustedRuntimeCoordinatorResult<TrustedPacketVerificationResult>>;
  verifyPacketBatch(input: VerifyTrustedPacketBatchInput): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>>;
  verifyBundle(input: VerifyTrustedBundleInput): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>>;
  verifyArchivePacketSet(input: VerifyTrustedArchivePacketSetInput): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>>;
  verifyPacketLineage(input: VerifyTrustedPacketLineageInput): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>>;
  verifyPacketRefs(input: VerifyTrustedPacketRefsInput): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>>;
  verifyCertificationResult(input: VerifyTrustedCertificationResultInput): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>>;
  auditReadiness(input?: AuditTrustedVerificationReadinessInput): TrustedRuntimeCoordinatorResult<TrustedVerificationReadinessReport>;
};
