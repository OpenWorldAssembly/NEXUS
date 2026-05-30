/**
 * File: run_resolution_step.ts
 * Description: Executes one Resolution DSL step against trusted runtime context.
 */

import { getResolutionDslPreset } from '@core/packets/resolution-dsl.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_RESOLUTION_COORDINATOR_ID,
  type RunTrustedResolutionStepInput,
  type TrustedResolutionStepValue,
} from '../trusted_resolution_types.ts';
import { resolveTrustedResolutionBinding } from './resolve_resolution_binding.ts';

export function runTrustedResolutionStep(
  input: RunTrustedResolutionStepInput
): TrustedRuntimeCoordinatorResult<TrustedResolutionStepValue> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const presetIds = [...input.step.preset_ids];

  for (const presetId of presetIds) {
    if (getResolutionDslPreset(presetId)) {
      continue;
    }

    issues.push(
      trustedIssue({
        severity: 'error',
        code: 'unknown_resolution_preset',
        path: `preset_ids.${presetId}`,
        message: `Resolution step ${input.step.step_id} references unknown preset ${presetId}.`,
      })
    );
  }

  const values = Object.fromEntries(
    Object.entries(input.step.input_bindings).map(([key, binding]) => [
      key,
      resolveTrustedResolutionBinding({
        binding,
        context: input.context,
        path: `input_bindings.${key}`,
        issues,
      }),
    ])
  );

  trace.push({
    step_id: input.step.step_id,
    coordinator_id: TRUSTED_RESOLUTION_COORDINATOR_ID,
    preset_ids: presetIds,
    status: issues.some((issue) => issue.severity === 'error') ? 'error' : 'ok',
    notes: input.step.notes,
  });

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_RESOLUTION_COORDINATOR_ID,
    coordinator_kind: 'resolution',
    value: {
      step_id: input.step.step_id,
      output_key: input.step.output_key,
      preset_ids: presetIds,
      values,
    },
    issues,
    trace,
  });
}
