/**
 * File: prepare_packet_for_write.ts
 * Description: Prepares one packet envelope for versioned writes without signing or storing it.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  compatibilityIssue,
  compatibilityTrace,
  createBlockedCompatibilityResolution,
  createCompatibilityResolutionFromRead,
  inspectPacketForTrustedCompatibility,
  preparePacketForTrustedWrite,
  toTrustedCompatibilityStatus,
} from '../trusted_compatibility_internal.ts';
import {
  TRUSTED_COMPATIBILITY_COORDINATOR_ID,
  type PrepareTrustedPacketForWriteInput,
  type TrustedCompatibilityWritePreparation,
} from '../trusted_compatibility_types.ts';

export function prepareTrustedPacketForWrite(
  input: PrepareTrustedPacketForWriteInput
): TrustedRuntimeCoordinatorResult<TrustedCompatibilityWritePreparation> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const strictness = input.compatibility_strictness ?? 'advisory';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const inspection = inspectPacketForTrustedCompatibility({
    packet: input.packet,
    target_schema_version: input.target_schema_version,
  });
  issues.push(...inspection.issues);
  const preparation = preparePacketForTrustedWrite({
    packet: input.packet,
    target_schema_version: input.target_schema_version,
  });
  issues.push(...preparation.issues);

  const compatibility = inspection.inspected
    ? createCompatibilityResolutionFromRead({
        inspected: inspection.inspected,
        issues,
      })
    : createBlockedCompatibilityResolution({
        issues,
        targetSchemaVersion: input.target_schema_version ?? null,
      });

  const writeBlockers: string[] = [];
  const requiredAcknowledgements: string[] = [];

  if (!preparation.prepared?.prepared_packet) {
    writeBlockers.push('No prepared packet envelope was produced for write.');
  }

  if (preparation.prepared?.supported_write_target === 'blocked') {
    writeBlockers.push('Compatibility registry blocks writes to the requested target schema version.');
  }

  if (preparation.prepared?.requires_guarded_upgrade) {
    requiredAcknowledgements.push('guarded_schema_upgrade');
  }

  if (preparation.prepared?.requires_loss_acknowledgement) {
    requiredAcknowledgements.push('loss_acknowledgement');

    if (!input.allow_lossy_write) {
      writeBlockers.push('Lossy write preparation requires explicit loss acknowledgement.');
    }
  }

  for (const blocker of writeBlockers) {
    issues.push(compatibilityIssue({
      severity: 'error',
      code: 'trusted_compatibility_write_blocked',
      path: 'write_preparation',
      message: blocker,
    }));
  }

  trace.push(compatibilityTrace({
    step_id: 'compatibility.packet.write_prepare',
    status: writeBlockers.length === 0 ? 'ok' : 'blocked',
    preset_ids: ['trusted.compatibility.write_preparation.v0'],
    notes: writeBlockers.length === 0
      ? `Prepared ${compatibility.packet_type ?? 'packet'} for write at schema ${compatibility.target_schema_version}.`
      : 'Trusted write preparation has blockers.',
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_COMPATIBILITY_COORDINATOR_ID,
    coordinator_kind: 'compatibility',
    value: {
      result_kind: 'trusted.compatibility_write_preparation',
      raw_packet: preparation.prepared?.raw_packet ?? input.packet,
      adapted_packet: preparation.prepared?.adapted_packet ?? inspection.inspected?.adapted_packet ?? null,
      prepared_packet: preparation.prepared?.prepared_packet ?? null,
      compatibility,
      write_allowed: writeBlockers.length === 0,
      write_blockers: writeBlockers,
      required_acknowledgements: requiredAcknowledgements,
    },
    issues,
    trace,
    status: writeBlockers.length > 0 ? 'blocked' : toTrustedCompatibilityStatus(issues, strictness),
    mode: contextMode,
  });
}
