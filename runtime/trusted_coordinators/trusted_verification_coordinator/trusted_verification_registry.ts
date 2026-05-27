/**
 * File: trusted_verification_registry.ts
 * Description: Private operation router for the Trusted Verification Coordinator public surface.
 */

import type {
  TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import type {
  TrustedVerificationCoordinatorRequest,
} from './trusted_verification_types.ts';
import { auditTrustedVerificationReadiness } from './functions/audit_verification_readiness.ts';
import { verifyTrustedArchivePacketSet } from './functions/verify_archive_packet_set.ts';
import { verifyTrustedBundle } from './functions/verify_bundle.ts';
import { verifyTrustedCertificationResult } from './functions/verify_certification_result.ts';
import { verifyTrustedPacket } from './functions/verify_packet.ts';
import { verifyTrustedPacketBatch } from './functions/verify_packet_batch.ts';
import { verifyTrustedPacketLineage } from './functions/verify_packet_lineage.ts';
import { verifyTrustedPacketRefs } from './functions/verify_packet_refs.ts';

export function runTrustedVerificationOperation(
  request: TrustedVerificationCoordinatorRequest
): TrustedRuntimeCoordinatorResult<unknown> | Promise<TrustedRuntimeCoordinatorResult<unknown>> {
  switch (request.operation) {
    case 'verify_packet':
      return verifyTrustedPacket(request.input);
    case 'verify_packet_batch':
      return verifyTrustedPacketBatch(request.input);
    case 'verify_bundle':
      return verifyTrustedBundle(request.input);
    case 'verify_archive_packet_set':
      return verifyTrustedArchivePacketSet(request.input);
    case 'verify_packet_lineage':
      return verifyTrustedPacketLineage(request.input);
    case 'verify_packet_refs':
      return verifyTrustedPacketRefs(request.input);
    case 'verify_certification_result':
      return verifyTrustedCertificationResult(request.input);
    case 'audit_readiness':
      return auditTrustedVerificationReadiness(request.input);
    default: {
      const exhaustive: never = request;
      return exhaustive;
    }
  }
}
