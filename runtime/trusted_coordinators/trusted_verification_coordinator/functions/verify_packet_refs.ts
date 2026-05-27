/**
 * File: verify_packet_refs.ts
 * Description: Verifies packet reference closure across supplied or archive-backed packet material.
 */

import type {
  TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  normalizeVerificationMode,
} from '../trusted_verification_internal.ts';
import type {
  TrustedVerificationReport,
  VerifyTrustedPacketRefsInput,
} from '../trusted_verification_types.ts';
import { verifyTrustedArchivePacketSet } from './verify_archive_packet_set.ts';
import { verifyTrustedPacketBatch } from './verify_packet_batch.ts';

export async function verifyTrustedPacketRefs(
  input: VerifyTrustedPacketRefsInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>> {
  const verificationMode = normalizeVerificationMode(input.verification_mode);

  if (input.packets?.length) {
    return verifyTrustedPacketBatch({
      packet_store: input.packet_store,
      database_path: input.database_path,
      packets: input.packets,
      signer_packets: input.signer_packets,
      target_schema_version: input.target_schema_version,
      verification_mode: verificationMode,
      context_mode: input.context_mode,
      target_kind: 'packet_refs',
      check_lineage: false,
      check_refs: true,
    });
  }

  const archiveResult = await verifyTrustedArchivePacketSet({
    packet_store: input.packet_store,
    database_path: input.database_path,
    packet_refs: input.packet_refs,
    revision_refs: input.revision_refs,
    target_schema_version: input.target_schema_version,
    verification_mode: verificationMode,
    context_mode: input.context_mode,
  });

  if (archiveResult.value) {
    archiveResult.value.target_kind = 'packet_refs';
  }

  return archiveResult;
}
