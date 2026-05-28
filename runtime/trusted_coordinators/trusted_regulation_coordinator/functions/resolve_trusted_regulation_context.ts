/**
 * File: resolve_trusted_regulation_context.ts
 * Description: Resolves a full trusted regulation context by coordinating policy and write-gate semantics.
 */

import { trustedDefinitionCoordinator } from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorTraceEntry,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  issueForMissingDefinition,
  issueForMissingParts,
  missingDefinitionParts,
  regulationTrace,
} from '../trusted_regulation_internal.ts';
import {
  TRUSTED_REGULATION_COORDINATOR_ID,
  type ResolveTrustedRegulationContextInput,
  type TrustedRegulationContext,
  type TrustedRegulationRequirement,
} from '../trusted_regulation_types.ts';
import { resolveTrustedPolicyContext } from './resolve_trusted_policy_context.ts';
import { resolveTrustedWritePolicyGate } from './resolve_trusted_write_policy_gate.ts';

export function resolveTrustedRegulationContext(
  input: ResolveTrustedRegulationContextInput
): TrustedRuntimeCoordinatorResult<TrustedRegulationContext> {
  const operationKind = input.operation_kind ?? 'policy_resolution';
  const contextMode = input.context_mode ?? 'reseed';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const includePolicies = input.include_policies ?? true;
  const includeWritePolicyGate = input.include_write_policy_gate ?? false;
  let definition = input.definition ?? null;
  let definitions = input.definitions ? [...input.definitions] : definition ? [definition] : [];
  const packetType = input.packet_type ?? definition?.packet_type ?? null;

  if (!definition && packetType) {
    const definitionResult = trustedDefinitionCoordinator.resolvePacketDefinition({
      packet_type: packetType,
      packet_subtype: input.packet_subtype,
      context_mode: contextMode,
      node_element_id: input.node_element_id,
      preferences: input.preferences,
    });
    issues.push(...definitionResult.issues);
    traceEntries.push(...definitionResult.trace);
    definition = definitionResult.value ?? null;
  }

  if (definitions.length === 0) {
    const definitionsResult = trustedDefinitionCoordinator.listPacketDefinitions({
      packet_type_filters: packetType ? [packetType] : undefined,
      context_mode: contextMode,
      node_element_id: input.node_element_id,
      preferences: input.preferences,
    });
    issues.push(...definitionsResult.issues);
    traceEntries.push(...definitionsResult.trace);
    definitions = definitionsResult.value ?? (definition ? [definition] : []);
  }

  if (!definition && packetType && definitions.length > 0) {
    definition = definitions.find((candidate) => candidate.packet_type === packetType) ?? null;
  }

  const resolvedPacketType = packetType ?? definition?.packet_type ?? null;
  const resolvedPacketSubtype = input.packet_subtype ?? definition?.default_subtype ?? null;
  const missingParts = definition ? missingDefinitionParts(definition) : [];

  if (!definition && resolvedPacketType) {
    issues.push(issueForMissingDefinition({ packet_type: resolvedPacketType, operation_kind: operationKind }));
  }

  if (definition && missingParts.length > 0) {
    issues.push(issueForMissingParts({ packet_type: definition.packet_type, missing_parts: missingParts }));
  }

  const policyResult = resolveTrustedPolicyContext({
    ...input,
    definition,
    definitions,
    packet_type: resolvedPacketType,
    packet_subtype: resolvedPacketSubtype,
    operation_kind: operationKind,
  });
  const writePolicyResult = includeWritePolicyGate && input.action_ids && input.action_ids.length > 0
    ? resolveTrustedWritePolicyGate({
        ...input,
        definition,
        definitions,
        packet_type: resolvedPacketType,
        packet_subtype: resolvedPacketSubtype,
        operation_kind: operationKind,
        action_ids: input.action_ids,
      })
    : null;

  for (const result of [includePolicies ? policyResult : null, writePolicyResult]) {
    if (!result) continue;
    issues.push(...result.issues);
    traceEntries.push(...result.trace);
  }

  const requirements: TrustedRegulationRequirement[] = [
    ...(includePolicies ? policyResult.value?.requirements.map((requirement) => ({
      requirement_id: requirement.policy_requirement_id,
      requirement_kind: 'policy' as const,
      strength: requirement.live_write_policy_action ? 'blocking' as const : 'definition_audit' as const,
      source: requirement.live_write_policy_action ? 'write_policy' as const : 'definition_registry' as const,
      packet_type: requirement.packet_type,
      packet_subtype: resolvedPacketSubtype,
      operation_kind: operationKind,
      notes: requirement.notes,
    })) ?? [] : []),
    ...(writePolicyResult?.value
      ? [{
          requirement_id: `write_gate.${writePolicyResult.value.action_ids.join('.')}`,
          requirement_kind: 'write_gate' as const,
          strength: writePolicyResult.value.satisfied === false ? 'blocking' as const : 'advisory' as const,
          source: 'write_policy' as const,
          packet_type: resolvedPacketType,
          packet_subtype: resolvedPacketSubtype,
          operation_kind: operationKind,
          notes: writePolicyResult.value.notes,
        }]
      : []),
  ];

  traceEntries.push(regulationTrace({
    step_id: 'regulation.context.resolve',
    status: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'partial' : 'ok',
    notes: `Resolved trusted policy regulation context for ${resolvedPacketType ?? operationKind}.`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_REGULATION_COORDINATOR_ID,
    coordinator_kind: 'regulation',
    value: {
      context_kind: 'trusted.regulation_context',
      context_id: `trusted.regulation_context.${resolvedPacketType ?? operationKind}.${operationKind}`,
      context_mode: contextMode,
      node_element_id: input.node_element_id ?? null,
      packet_type: resolvedPacketType,
      packet_subtype: resolvedPacketSubtype,
      operation_kind: operationKind,
      definition,
      policy_context: policyResult.value!,
      write_policy_gate: writePolicyResult?.value ?? null,
      missing_required_definition_parts: missingParts,
      requirements,
      issues,
      trace: traceEntries,
    },
    issues,
    trace: traceEntries,
  });
}
