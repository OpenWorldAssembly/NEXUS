/**
 * File: trusted_resolution_coordinator.ts
 * Description: Trusted runtime coordinator for executing the shared resolution DSL against local runtime context.
 */

import {
  getResolutionDslPreset,
  listResolutionDslPresets,
  type ResolutionStepDescriptor,
  type ResolutionValueBinding,
} from '@core/packets/resolution-dsl.ts';
import type { PacketEnvelope, PacketRef } from '@core/schema/packet-schema';
import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export type TrustedResolutionCoordinatorContext = {
  actor_ref?: PacketRef | null;
  current_packet?: PacketEnvelope | null;
  definition?: unknown;
  input?: Record<string, unknown>;
  step_outputs?: Record<string, Record<string, unknown>>;
};

export type TrustedResolutionStepValue = {
  step_id: string;
  output_key: string;
  preset_ids: string[];
  values: Record<string, unknown>;
};

function readPath(source: unknown, path: string | undefined): unknown {
  if (!path || path.length === 0) {
    return source;
  }

  return path.split('.').reduce<unknown>((cursor, segment) => {
    if (cursor === null || typeof cursor !== 'object') {
      return undefined;
    }

    return (cursor as Record<string, unknown>)[segment];
  }, source);
}

function pushMissingIssue(input: {
  issues: TrustedRuntimeCoordinatorIssue[];
  path: string;
  binding: ResolutionValueBinding;
}): void {
  input.issues.push(
    trustedIssue({
      severity: 'error',
      code: 'required_resolution_value_missing',
      path: input.path,
      message: `Required resolution binding ${input.binding.binding_kind} returned no value.`,
    })
  );
}

export function resolveTrustedResolutionBinding(input: {
  binding: ResolutionValueBinding;
  context: TrustedResolutionCoordinatorContext;
  path: string;
  issues?: TrustedRuntimeCoordinatorIssue[];
}): unknown {
  const issues = input.issues ?? [];
  const { binding, context } = input;
  let value: unknown;
  let required = false;

  if (binding.binding_kind === 'input_path') {
    value = readPath(context.input ?? {}, binding.path);
    required = binding.required;
  } else if (binding.binding_kind === 'actor_ref') {
    value = context.actor_ref ?? null;
    required = true;
  } else if (binding.binding_kind === 'packet_ref') {
    const packetId = readPath(context.input ?? {}, binding.packet_id_path ?? 'packet_id');
    const revisionId = readPath(context.input ?? {}, binding.revision_id_path ?? 'revision_id');
    value = typeof packetId === 'string'
      ? {
          packet_id: packetId,
          revision_id: typeof revisionId === 'string' ? revisionId : undefined,
        }
      : undefined;
    required = binding.required;
  } else if (binding.binding_kind === 'static_value') {
    value = binding.value;
  } else if (binding.binding_kind === 'step_output') {
    value = context.step_outputs?.[binding.step_id]?.[binding.output_key];
    required = binding.required;
  } else if (binding.binding_kind === 'current_packet') {
    value = readPath(context.current_packet ?? null, binding.path);
    required = binding.required;
  } else if (binding.binding_kind === 'definition_path') {
    value = readPath(context.definition ?? null, binding.path);
    required = binding.required;
  }

  if (required && (value === undefined || value === null || value === '')) {
    pushMissingIssue({ issues, path: input.path, binding });
  }

  return value;
}

export function runTrustedResolutionStep(input: {
  step: ResolutionStepDescriptor;
  context: TrustedResolutionCoordinatorContext;
}): TrustedRuntimeCoordinatorResult<TrustedResolutionStepValue> {
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
    coordinator_id: 'trusted_resolution_coordinator.v0',
    preset_ids: presetIds,
    status: issues.some((issue) => issue.severity === 'error') ? 'error' : 'ok',
    notes: input.step.notes,
  });

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: 'trusted_resolution_coordinator.v0',
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

export function listTrustedResolutionPresets() {
  return listResolutionDslPresets();
}
