/**
 * File: list_trusted_packet_definitions.ts
 * Description: Lists active trusted packet type definitions from a resolved Trusted Definition context.
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
  type ListTrustedPacketDefinitionsInput,
} from '../trusted_definition_types.ts';
import { definitionTrace } from '../trusted_definition_internal.ts';
import { resolveTrustedDefinitionContext } from './resolve_trusted_definition_context.ts';

export function listTrustedPacketDefinitions(
  input: ListTrustedPacketDefinitionsInput = {}
): TrustedRuntimeCoordinatorResult<PacketTypeDefinition[]> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const contextResult = resolveTrustedDefinitionContext(input);

  issues.push(...contextResult.issues);
  trace.push(...contextResult.trace);

  if (!contextResult.value) {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
      coordinator_kind: 'definition',
      value: null,
      issues,
      trace,
    });
  }

  const definitions = contextResult.value.active_candidates
    .filter(
      (candidate) =>
        candidate.part_subtype === 'packet_type_definition' &&
        candidate.payload.definition
    )
    .map((candidate) => candidate.payload.definition)
    .filter((definition): definition is PacketTypeDefinition => definition !== null && definition !== undefined)
    .sort((left, right) => left.packet_type.localeCompare(right.packet_type));

  trace.push(
    definitionTrace({
      step_id: 'definition.packet_definitions.list',
      status: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'partial' : 'ok',
      notes: `Listed ${definitions.length} active trusted packet definitions from the resolved definition context.`,
    })
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
    coordinator_kind: 'definition',
    value: definitions,
    issues,
    trace,
  });
}
