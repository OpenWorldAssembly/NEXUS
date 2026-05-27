/**
 * File: resolve_packet_compatibility.ts
 * Description: Resolves a trusted compatibility posture for one packet envelope without mutating storage.
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
  type ResolveTrustedPacketCompatibilityInput,
  type TrustedPacketCompatibilityResolution,
} from '../trusted_compatibility_types.ts';

export function resolveTrustedPacketCompatibility(
  input: ResolveTrustedPacketCompatibilityInput
): TrustedRuntimeCoordinatorResult<TrustedPacketCompatibilityResolution> {
  const contextMode = input.context_mode ?? 'compatibility_read';
  const strictness = input.compatibility_strictness ?? 'advisory';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const inspection = inspectPacketForTrustedCompatibility({
    packet: input.packet,
    target_schema_version: input.target_schema_version,
  });
  issues.push(...inspection.issues);

  const value = inspection.inspected
    ? createCompatibilityResolutionFromRead({
        inspected: inspection.inspected,
        issues,
      })
    : createBlockedCompatibilityResolution({
        issues,
        targetSchemaVersion: input.target_schema_version ?? null,
      });

  trace.push(compatibilityTrace({
    step_id: 'compatibility.packet.resolve',
    status: inspection.inspected ? 'ok' : 'partial',
    preset_ids: ['trusted.compatibility.packet_resolution.v0'],
    notes: inspection.inspected
      ? `Resolved ${value.packet_type ?? 'packet'} compatibility from ${value.source_schema_version} to ${value.target_schema_version}.`
      : 'Packet compatibility could not be resolved.',
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_COMPATIBILITY_COORDINATOR_ID,
    coordinator_kind: 'compatibility',
    value,
    issues,
    trace,
    status: toTrustedCompatibilityStatus(issues, strictness),
    mode: contextMode,
  });
}
