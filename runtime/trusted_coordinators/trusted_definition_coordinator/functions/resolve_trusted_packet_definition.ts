/**
 * File: resolve_trusted_packet_definition.ts
 * Description: Resolves the best active trusted packet type definition for a request.
 */

import type { PacketTypeDefinition } from '@core/packets/definitions/packet-definition-types.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_DEFINITION_COORDINATOR_ID,
  type ResolveTrustedPacketDefinitionInput,
} from '../trusted_definition_types.ts';
import { definitionTrace, issueForUnknownPacketType } from '../trusted_definition_internal.ts';
import { resolveTrustedDefinitionContext } from './resolve_trusted_definition_context.ts';

export function resolveTrustedPacketDefinition(
  input: ResolveTrustedPacketDefinitionInput
): TrustedRuntimeCoordinatorResult<PacketTypeDefinition> {
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
      activeCandidate.part_subtype === 'packet_type_definition' &&
      activeCandidate.payload.definition
  );

  if (!candidate?.payload.definition) {
    issues.push(issueForUnknownPacketType(input.packet_type));
    trace.push(
      definitionTrace({
        step_id: 'definition.packet_definition.resolve',
        status: 'error',
        notes: `Trusted Definition Coordinator could not resolve an active packet definition for ${input.packet_type}.`,
      })
    );

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
      coordinator_kind: 'workflow',
      value: null,
      issues,
      trace,
    });
  }

  trace.push(
    definitionTrace({
      step_id: 'definition.packet_definition.resolve',
      status: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'partial' : 'ok',
      notes: `Resolved active trusted packet definition for ${input.packet_type}.`,
    })
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
    coordinator_kind: 'workflow',
    value: candidate.payload.definition,
    issues,
    trace,
  });
}
