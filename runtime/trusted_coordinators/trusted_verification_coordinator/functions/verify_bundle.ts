/**
 * File: verify_bundle.ts
 * Description: Verifies packet envelopes carried by a transport bundle/revision array/raw packet artifact.
 */

import type {
  TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  normalizeBundleEntries,
  normalizeVerificationMode,
} from '../trusted_verification_internal.ts';
import type {
  TrustedVerificationReport,
  VerifyTrustedBundleInput,
} from '../trusted_verification_types.ts';
import { verifyTrustedPacketBatch } from './verify_packet_batch.ts';

export async function verifyTrustedBundle(
  input: VerifyTrustedBundleInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>> {
  const entries = normalizeBundleEntries(input.bundle);

  return verifyTrustedPacketBatch({
    packets: entries,
    signer_packets: input.signer_packets,
    target_schema_version: input.target_schema_version,
    verification_mode: normalizeVerificationMode(input.verification_mode),
    context_mode: input.context_mode,
    target_kind: 'bundle',
    check_lineage: true,
    check_refs: false,
  });
}
