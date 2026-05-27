/**
 * File: resolve_compatibility_profile.ts
 * Description: Resolves registry and Definition compatibility metadata for one packet type.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  compatibilityTrace,
  resolveTrustedCompatibilityProfileValue,
  toTrustedCompatibilityStatus,
} from '../trusted_compatibility_internal.ts';
import {
  TRUSTED_COMPATIBILITY_COORDINATOR_ID,
  type ResolveTrustedCompatibilityProfileInput,
  type TrustedCompatibilityProfile,
} from '../trusted_compatibility_types.ts';

export function resolveTrustedCompatibilityProfile(
  input: ResolveTrustedCompatibilityProfileInput
): TrustedRuntimeCoordinatorResult<TrustedCompatibilityProfile> {
  const contextMode = input.context_mode ?? 'compatibility_read';
  const strictness = input.compatibility_strictness ?? 'advisory';
  const result = resolveTrustedCompatibilityProfileValue(input);
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [
    ...result.trace,
    compatibilityTrace({
      step_id: 'compatibility.profile.resolve',
      status: result.issues.some((issue) => issue.severity === 'error') ? 'error' : result.issues.length > 0 ? 'partial' : 'ok',
      preset_ids: ['trusted.compatibility.profile.v0'],
      notes: `Resolved compatibility profile for ${input.packet_type}.`,
    }),
  ];

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_COMPATIBILITY_COORDINATOR_ID,
    coordinator_kind: 'compatibility',
    value: result.value,
    issues: result.issues,
    trace,
    status: toTrustedCompatibilityStatus(result.issues, strictness),
    mode: contextMode,
  });
}
