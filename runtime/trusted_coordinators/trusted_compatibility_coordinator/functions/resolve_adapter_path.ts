/**
 * File: resolve_adapter_path.ts
 * Description: Resolves non-executable adapter path metadata between packet schema versions.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  compatibilityTrace,
  resolveTrustedAdapterPathMetadata,
  toTrustedCompatibilityStatus,
} from '../trusted_compatibility_internal.ts';
import {
  TRUSTED_COMPATIBILITY_COORDINATOR_ID,
  type ResolveTrustedAdapterPathInput,
  type TrustedAdapterPathResolution,
} from '../trusted_compatibility_types.ts';

export function resolveTrustedAdapterPath(
  input: ResolveTrustedAdapterPathInput
): TrustedRuntimeCoordinatorResult<TrustedAdapterPathResolution> {
  const contextMode = input.context_mode ?? 'compatibility_read';
  const strictness = input.compatibility_strictness ?? 'advisory';
  const result = resolveTrustedAdapterPathMetadata(input);
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [
    compatibilityTrace({
      step_id: 'compatibility.adapter_path.resolve',
      status: result.value.path_found ? 'ok' : 'partial',
      preset_ids: ['trusted.compatibility.adapter_path.v0'],
      notes: result.value.path_found
        ? `Resolved adapter path with ${result.value.step_count} step(s).`
        : 'No adapter path resolved.',
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
