/**
 * File: adapt_packet_for_read.ts
 * Description: Adapts one packet envelope for trusted runtime reads without changing stored material.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  compatibilityTrace,
  createBlockedCompatibilityResolution,
  createCompatibilityResolutionFromRead,
  inspectPacketForTrustedCompatibility,
  toTrustedCompatibilityStatus,
} from '../trusted_compatibility_internal.ts';
import {
  TRUSTED_COMPATIBILITY_COORDINATOR_ID,
  type AdaptTrustedPacketForReadInput,
  type TrustedCompatibilityReadResult,
} from '../trusted_compatibility_types.ts';

export function adaptTrustedPacketForRead(
  input: AdaptTrustedPacketForReadInput
): TrustedRuntimeCoordinatorResult<TrustedCompatibilityReadResult> {
  const contextMode = input.context_mode ?? 'compatibility_read';
  const strictness = input.compatibility_strictness ?? 'advisory';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const inspection = inspectPacketForTrustedCompatibility({
    packet: input.packet,
    target_schema_version: input.target_schema_version,
  });
  issues.push(...inspection.issues);

  const compatibility = inspection.inspected
    ? createCompatibilityResolutionFromRead({
        inspected: inspection.inspected,
        issues,
      })
    : createBlockedCompatibilityResolution({
        issues,
        targetSchemaVersion: input.target_schema_version ?? null,
      });

  trace.push(compatibilityTrace({
    step_id: 'compatibility.packet.read_adapt',
    status: inspection.inspected ? 'ok' : 'partial',
    preset_ids: ['trusted.compatibility.read.v0'],
    notes: inspection.inspected
      ? `Adapted ${compatibility.packet_type ?? 'packet'} for trusted read at schema ${compatibility.target_schema_version}.`
      : 'Trusted read adaptation failed.',
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_COMPATIBILITY_COORDINATOR_ID,
    coordinator_kind: 'compatibility',
    value: {
      result_kind: 'trusted.compatibility_read',
      raw_packet: inspection.inspected?.raw_packet ?? input.packet,
      adapted_packet: inspection.inspected?.adapted_packet ?? null,
      compatibility,
    },
    issues,
    trace,
    status: toTrustedCompatibilityStatus(issues, strictness),
    mode: contextMode,
  });
}
