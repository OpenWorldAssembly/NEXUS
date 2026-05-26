/**
 * File: trusted_regulation_core.ts
 * Description: Pure trusted regulation helpers that do not import coordinator indexes.
 */

import {
  listPacketDependencyRequirementDescriptorsFromDefinitions,
  listPacketPolicyRequirementDescriptorsFromDefinitions,
  type PacketDependencyRequirementDescriptor,
  type PacketPolicyRequirementDescriptor,
} from '@core/packets/packet-policy-dependency.ts';
import {
  resolvePacketDefaultProfile,
  type PacketDefaultProfile,
} from '@core/packets/packet-defaults.ts';
import type {
  PacketDefaultOverrideDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export type TrustedRegulationProfile = {
  profile_kind: 'trusted.regulation_profile';
  packet_type: string;
  packet_subtype: string | null;
  defaults: PacketDefaultProfile;
  policy_requirements: PacketPolicyRequirementDescriptor[];
  dependency_requirements: PacketDependencyRequirementDescriptor[];
  missing_required_definition_parts: string[];
};

function trace(input: {
  step_id: string;
  status: 'ok' | 'partial' | 'blocked' | 'error';
  notes: string;
}): TrustedRuntimeCoordinatorTraceEntry {
  return {
    step_id: input.step_id,
    coordinator_id: 'trusted_regulation_coordinator.v0',
    preset_ids: ['resolution.policy_gate.v0', 'resolution.dependency_gate.v0'],
    status: input.status,
    notes: input.notes,
  };
}

function requiredPartIds(definition: PacketTypeDefinition): string[] {
  return (definition.packet_definition_parts ?? [])
    .filter((part) => part.required)
    .map((part) => part.part_id);
}

function missingDefinitionParts(definition: PacketTypeDefinition): string[] {
  const present = new Set((definition.packet_definition_parts ?? []).map((part) => part.part_id));
  return requiredPartIds(definition).filter((partId) => !present.has(partId));
}

function filterPolicyRequirements(input: {
  requirements: readonly PacketPolicyRequirementDescriptor[];
  packetType: string;
}): PacketPolicyRequirementDescriptor[] {
  return input.requirements.filter(
    (requirement) => requirement.packet_type === input.packetType || requirement.packet_type === null
  );
}

function filterDependencyRequirements(input: {
  requirements: readonly PacketDependencyRequirementDescriptor[];
  packetType: string;
}): PacketDependencyRequirementDescriptor[] {
  return input.requirements.filter(
    (requirement) => requirement.packet_type === input.packetType || requirement.packet_type === null
  );
}

export function resolveTrustedRegulationProfileFromDefinition(input: {
  definition: PacketTypeDefinition;
  definitions?: readonly PacketTypeDefinition[];
  packet_subtype?: string | null;
  policy_packets?: readonly PacketEnvelopeByType['Policy'][];
  local_overrides?: readonly PacketDefaultOverrideDescriptor[];
}): TrustedRuntimeCoordinatorResult<TrustedRegulationProfile> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const definitions = input.definitions ?? [input.definition];
  const defaults = resolvePacketDefaultProfile({
    definition: input.definition,
    packet_subtype: input.packet_subtype,
    policy_packets: input.policy_packets,
    local_overrides: input.local_overrides,
  });
  const policyRequirements = filterPolicyRequirements({
    requirements: listPacketPolicyRequirementDescriptorsFromDefinitions({ definitions }),
    packetType: input.definition.packet_type,
  });
  const dependencyRequirements = filterDependencyRequirements({
    requirements: listPacketDependencyRequirementDescriptorsFromDefinitions({ definitions }),
    packetType: input.definition.packet_type,
  });
  const missingParts = missingDefinitionParts(input.definition);

  if (missingParts.length > 0) {
    issues.push(
      trustedIssue({
        severity: 'error',
        code: 'required_definition_parts_missing',
        path: `${input.definition.packet_type}.packet_definition_parts`,
        message: `${input.definition.packet_type} is missing required definition parts: ${missingParts.join(', ')}.`,
      })
    );
  }

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: 'trusted_regulation_coordinator.v0',
    coordinator_kind: 'policy',
    value: {
      profile_kind: 'trusted.regulation_profile',
      packet_type: input.definition.packet_type,
      packet_subtype: defaults.packet_subtype,
      defaults,
      policy_requirements: policyRequirements,
      dependency_requirements: dependencyRequirements,
      missing_required_definition_parts: missingParts,
    },
    issues,
    trace: [
      trace({
        step_id: 'regulation.defaults.resolve',
        status: 'ok',
        notes: `Resolved default profile for ${input.definition.packet_type}.${defaults.packet_subtype ?? '*'}.`,
      }),
      trace({
        step_id: 'regulation.policy_dependency.collect',
        status: issues.some((issue) => issue.severity === 'error') ? 'error' : 'ok',
        notes: `Collected ${policyRequirements.length} policy requirements and ${dependencyRequirements.length} dependency requirements for ${input.definition.packet_type}.`,
      }),
    ],
  });
}

export function resolveTrustedRegulationProfilesFromDefinitions(input: {
  definitions: readonly PacketTypeDefinition[];
}): TrustedRuntimeCoordinatorResult<TrustedRegulationProfile[]> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const values: TrustedRegulationProfile[] = [];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [];

  for (const definition of input.definitions) {
    const result = resolveTrustedRegulationProfileFromDefinition({
      definition,
      definitions: input.definitions,
      packet_subtype: definition.default_subtype,
    });

    issues.push(...result.issues);
    traceEntries.push(...result.trace);

    if (result.value) {
      values.push(result.value);
    }
  }

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: 'trusted_regulation_coordinator.v0',
    coordinator_kind: 'policy',
    value: values,
    issues,
    trace: traceEntries,
  });
}
