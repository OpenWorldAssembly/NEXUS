/**
 * File: trusted_regulation_coordinator.ts
 * Description: Trusted runtime coordinator for definition-backed defaults, dependency, and policy readiness resolution.
 */

import type { PacketDefaultOverrideDescriptor } from '@core/packets/definitions/packet-definition-types.ts';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import {
  trustedDefinitionCoordinator,
} from '@runtime/trusted_coordinators/trusted_definition_coordinator';
import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  resolveTrustedRegulationProfileFromDefinition,
  resolveTrustedRegulationProfilesFromDefinitions,
  type TrustedRegulationProfile,
} from '@runtime/trusted_coordinators/trusted_regulation_core';

export type { TrustedRegulationProfile } from '@runtime/trusted_coordinators/trusted_regulation_core';
export {
  resolveTrustedRegulationProfileFromDefinition,
  resolveTrustedRegulationProfilesFromDefinitions,
} from '@runtime/trusted_coordinators/trusted_regulation_core';

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

export function resolveTrustedRegulationProfile(input: {
  packet_type: string;
  packet_subtype?: string | null;
  policy_packets?: readonly PacketEnvelopeByType['Policy'][];
  local_overrides?: readonly PacketDefaultOverrideDescriptor[];
}): TrustedRuntimeCoordinatorResult<TrustedRegulationProfile> {
  const definitionsResult = trustedDefinitionCoordinator.listPacketDefinitions();
  const definition = definitionsResult.value?.find(
    (candidate) => candidate.packet_type === input.packet_type
  ) ?? null;

  if (!definition) {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: 'trusted_regulation_coordinator.v0',
      coordinator_kind: 'policy',
      value: null,
      issues: [
        ...definitionsResult.issues,
        trustedIssue({
          severity: 'error',
          code: 'unknown_regulation_packet_type',
          path: 'packet_type',
          message: `No trusted packet definition is registered for ${input.packet_type}.`,
        }),
      ],
      trace: [
        ...definitionsResult.trace,
        trace({
          step_id: 'regulation.definition.lookup',
          status: 'error',
          notes: 'Trusted regulation profile could not resolve a packet definition through the Trusted Definition Coordinator.',
        }),
      ],
    });
  }

  const profileResult = resolveTrustedRegulationProfileFromDefinition({
    definition,
    definitions: definitionsResult.value ?? [definition],
    packet_subtype: input.packet_subtype,
    policy_packets: input.policy_packets,
    local_overrides: input.local_overrides,
  });

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: 'trusted_regulation_coordinator.v0',
    coordinator_kind: 'policy',
    value: profileResult.value,
    issues: [...definitionsResult.issues, ...profileResult.issues],
    trace: [...definitionsResult.trace, ...profileResult.trace],
  });
}

export function resolveTrustedRegulationProfiles(): TrustedRuntimeCoordinatorResult<TrustedRegulationProfile[]> {
  const definitionsResult = trustedDefinitionCoordinator.listPacketDefinitions();

  if (!definitionsResult.value) {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: 'trusted_regulation_coordinator.v0',
      coordinator_kind: 'policy',
      value: null,
      issues: definitionsResult.issues,
      trace: definitionsResult.trace,
    });
  }

  const profilesResult = resolveTrustedRegulationProfilesFromDefinitions({
    definitions: definitionsResult.value,
  });

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: 'trusted_regulation_coordinator.v0',
    coordinator_kind: 'policy',
    value: profilesResult.value,
    issues: [...definitionsResult.issues, ...profilesResult.issues],
    trace: [...definitionsResult.trace, ...profilesResult.trace],
  });
}
