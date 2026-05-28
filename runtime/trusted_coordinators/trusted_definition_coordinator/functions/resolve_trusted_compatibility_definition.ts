/**
 * File: resolve_trusted_compatibility_definition.ts
 * Description: Resolves a compatibility-only Definition part without promoting it into active node semantics.
 */

import type { PacketDefinitionPartDescriptor } from '@core/packets/definitions/packet-definition-types.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_DEFINITION_COORDINATOR_ID,
  type ResolveTrustedCompatibilityDefinitionInput,
} from '../trusted_definition_types.ts';
import { definitionTrace } from '../trusted_definition_internal.ts';
import { resolveTrustedDefinitionContext } from './resolve_trusted_definition_context.ts';

export function resolveTrustedCompatibilityDefinition(
  input: ResolveTrustedCompatibilityDefinitionInput
): TrustedRuntimeCoordinatorResult<PacketDefinitionPartDescriptor> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const contextResult = resolveTrustedDefinitionContext({
    ...input,
    packet_type_filters: [input.packet_type],
    context_mode: input.context_mode ?? 'compatibility_read',
    include_compatibility: true,
  });

  issues.push(...contextResult.issues);
  trace.push(...contextResult.trace);

  const requestedPartSubtype = input.part_subtype ?? 'packet_compatibility';
  const candidate = contextResult.value?.compatibility_candidates.find(
    (compatCandidate) =>
      compatCandidate.defines_packet_type === input.packet_type &&
      compatCandidate.part_subtype === requestedPartSubtype &&
      compatCandidate.payload.part
  );

  if (!candidate?.payload.part) {
    issues.push(
      trustedIssue({
        severity: 'warning',
        code: 'trusted_compatibility_definition_missing',
        path: `${input.packet_type}.${requestedPartSubtype}`,
        message: `No trusted compatibility Definition part resolved for ${input.packet_type}.`,
      })
    );
    trace.push(
      definitionTrace({
        step_id: 'definition.compatibility.resolve',
        status: 'partial',
        notes: `No compatibility-only Definition part resolved for ${input.packet_type}.`,
      })
    );

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
      coordinator_kind: 'definition',
      value: null,
      issues,
      trace,
    });
  }

  trace.push(
    definitionTrace({
      step_id: 'definition.compatibility.resolve',
      status: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'partial' : 'ok',
      notes: `Resolved compatibility-only Definition part for ${input.packet_type} without promoting it to active node semantics.`,
    })
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
    coordinator_kind: 'definition',
    value: candidate.payload.part,
    issues,
    trace,
  });
}
