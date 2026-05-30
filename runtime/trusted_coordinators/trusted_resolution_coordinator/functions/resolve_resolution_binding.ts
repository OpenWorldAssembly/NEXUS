/**
 * File: resolve_resolution_binding.ts
 * Description: Resolves one Resolution DSL value binding against trusted runtime context.
 */

import type { ResolutionValueBinding } from '@core/packets/resolution-dsl.ts';
import {
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import type { TrustedResolutionCoordinatorContext } from '../trusted_resolution_types.ts';

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
