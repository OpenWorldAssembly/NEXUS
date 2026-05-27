/**
 * File: trusted_planning_internal.ts
 * Description: Internal helpers shared by Trusted Planning Coordinator operation functions.
 */

import type { PacketTypeDefinition } from '@core/packets/definitions/packet-definition-types.ts';
import {
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_PLANNING_COORDINATOR_ID,
  type TrustedPlanningOperationKind,
  type TrustedPlanningRequirement,
  type TrustedPlanningRequirementSource,
  type TrustedPlanningRequirementStrength,
} from './trusted_planning_types.ts';

export function planningTrace(input: {
  step_id: string;
  status: 'ok' | 'partial' | 'blocked' | 'error';
  notes: string;
  preset_ids?: readonly string[];
}): TrustedRuntimeCoordinatorTraceEntry {
  return {
    step_id: input.step_id,
    coordinator_id: TRUSTED_PLANNING_COORDINATOR_ID,
    preset_ids: [...(input.preset_ids ?? ['resolution.default_profile.v0', 'resolution.dependency_gate.v0'])],
    status: input.status,
    notes: input.notes,
  };
}

export function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function requiredPartIds(definition: PacketTypeDefinition): string[] {
  return (definition.packet_definition_parts ?? [])
    .filter((part) => part.required)
    .map((part) => part.part_id);
}

export function missingDefinitionParts(definition: PacketTypeDefinition): string[] {
  const present = new Set((definition.packet_definition_parts ?? []).map((part) => part.part_id));
  return requiredPartIds(definition).filter((partId) => !present.has(partId));
}

export function createPlanningRequirement(input: {
  requirement_id: string;
  requirement_kind: TrustedPlanningRequirement['requirement_kind'];
  strength?: TrustedPlanningRequirementStrength;
  source: TrustedPlanningRequirementSource;
  packet_type?: string | null;
  packet_subtype?: string | null;
  operation_kind: TrustedPlanningOperationKind;
  notes: string;
}): TrustedPlanningRequirement {
  return {
    requirement_id: input.requirement_id,
    requirement_kind: input.requirement_kind,
    strength: input.strength ?? 'definition_audit',
    source: input.source,
    packet_type: input.packet_type ?? null,
    packet_subtype: input.packet_subtype ?? null,
    operation_kind: input.operation_kind,
    notes: input.notes,
  };
}

export function inferActionIds(input: {
  definition?: PacketTypeDefinition | null;
  operation_kind: TrustedPlanningOperationKind;
  explicit_action_ids?: readonly string[];
}): string[] {
  if (input.explicit_action_ids && input.explicit_action_ids.length > 0) {
    return uniqueSorted([...input.explicit_action_ids]);
  }

  if (!input.definition) {
    return [];
  }

  return uniqueSorted(
    input.definition.actions
      .filter((action) => action.action_kind === input.operation_kind)
      .map((action) => action.action_id)
  );
}

export function issueForMissingDefinition(input: {
  packet_type?: string | null;
  operation_kind: TrustedPlanningOperationKind;
}): TrustedRuntimeCoordinatorIssue {
  return trustedIssue({
    severity: 'error',
    code: 'trusted_planning_definition_missing',
    path: 'definition',
    message: `Trusted Planning Coordinator could not resolve a packet definition for ${input.packet_type ?? input.operation_kind}.`,
  });
}

export function issueForMissingParts(input: {
  packet_type: string;
  missing_parts: readonly string[];
}): TrustedRuntimeCoordinatorIssue {
  return trustedIssue({
    severity: 'error',
    code: 'required_definition_parts_missing',
    path: `${input.packet_type}.packet_definition_parts`,
    message: `${input.packet_type} is missing required definition parts: ${input.missing_parts.join(', ')}.`,
  });
}
