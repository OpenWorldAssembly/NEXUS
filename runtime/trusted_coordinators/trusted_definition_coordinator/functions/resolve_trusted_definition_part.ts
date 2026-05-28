/**
 * File: resolve_trusted_definition_part.ts
 * Description: Resolves the best active trusted Definition part descriptor for a packet type.
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
  type ResolveTrustedDefinitionPartInput,
} from '../trusted_definition_types.ts';
import { definitionTrace, partSubtypeMatches } from '../trusted_definition_internal.ts';
import { resolveTrustedDefinitionContext } from './resolve_trusted_definition_context.ts';

export function resolveTrustedDefinitionPart(
  input: ResolveTrustedDefinitionPartInput
): TrustedRuntimeCoordinatorResult<PacketDefinitionPartDescriptor> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const contextResult = resolveTrustedDefinitionContext({
    ...input,
    packet_type_filters: [input.packet_type],
  });

  issues.push(...contextResult.issues);
  trace.push(...contextResult.trace);

  const candidate = contextResult.value?.active_candidates.find(
    (activeCandidate) =>
      activeCandidate.defines_packet_type === input.packet_type &&
      partSubtypeMatches(activeCandidate.part_subtype, input.part_subtype) &&
      activeCandidate.payload.part
  );

  if (!candidate?.payload.part) {
    issues.push(
      trustedIssue({
        severity: 'error',
        code: 'trusted_definition_part_missing',
        path: `${input.packet_type}.${input.part_subtype}`,
        message: `No active trusted ${input.part_subtype} Definition part resolved for ${input.packet_type}.`,
      })
    );
    trace.push(
      definitionTrace({
        step_id: 'definition.part.resolve',
        status: 'error',
        notes: `Trusted Definition Coordinator could not resolve ${input.part_subtype} for ${input.packet_type}.`,
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
      step_id: 'definition.part.resolve',
      status: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'partial' : 'ok',
      notes: `Resolved active trusted ${input.part_subtype} Definition part for ${input.packet_type}.`,
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
