/**
 * File: list_trusted_definition_candidates.ts
 * Description: Collects Trusted Definition candidates from manifest-backed seed material and caller-provided sources.
 */

import { listDefinedPacketTypeDefinitions } from '@core/packets/packet-definition-manifest';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_DEFINITION_COORDINATOR_ID,
  type ListTrustedDefinitionCandidatesInput,
  type TrustedDefinitionCandidate,
  type TrustedDefinitionSource,
} from '../trusted_definition_types.ts';
import { definitionTrace } from '../trusted_definition_internal.ts';

const BOOTSTRAP_MANIFEST_SOURCE: TrustedDefinitionSource = {
  source_id: 'nexus.bootstrap_manifest.v0',
  source_kind: 'bootstrap_manifest',
  trust_tier: 'core_seed',
  priority: 500,
  verified: true,
  notes: 'Runtime-local bootstrap manifest definition material.',
};

function shouldIncludePacketType(input: {
  packetType: string;
  packetTypeFilters?: readonly string[];
}): boolean {
  return !input.packetTypeFilters || input.packetTypeFilters.length === 0 || input.packetTypeFilters.includes(input.packetType);
}

export function listTrustedDefinitionCandidates(
  input: ListTrustedDefinitionCandidatesInput = {}
): TrustedRuntimeCoordinatorResult<TrustedDefinitionCandidate[]> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const candidates: TrustedDefinitionCandidate[] = [...(input.candidates ?? [])];
  const packetTypeFilters = input.packet_type_filters ? [...input.packet_type_filters] : [];

  for (const definition of listDefinedPacketTypeDefinitions()) {
    if (!shouldIncludePacketType({ packetType: definition.packet_type, packetTypeFilters })) {
      continue;
    }

    candidates.push({
      candidate_id: `${definition.packet_type}.packet_type_definition.bootstrap`,
      source: BOOTSTRAP_MANIFEST_SOURCE,
      defines_packet_type: definition.packet_type,
      defines_packet_subtype: definition.default_subtype,
      part_subtype: 'packet_type_definition',
      definition_version: definition.current_schema_version,
      schema_version: definition.current_schema_version,
      status: 'active_candidate',
      verification_status: 'verified',
      trust_status: 'core_seed',
      priority: BOOTSTRAP_MANIFEST_SOURCE.priority,
      compatibility_posture: 'current_semantics',
      payload: {
        definition,
        descriptor: definition,
      },
      issues: [],
    });

    for (const part of definition.packet_definition_parts ?? []) {
      candidates.push({
        candidate_id: `${definition.packet_type}.${part.part_subtype}.${part.part_id}.bootstrap`,
        source: BOOTSTRAP_MANIFEST_SOURCE,
        defines_packet_type: definition.packet_type,
        defines_packet_subtype: part.defines_packet_subtype,
        part_subtype: part.part_subtype,
        definition_version: part.schema_version,
        schema_version: part.schema_version,
        status: part.part_subtype === 'packet_compatibility' ? 'compatibility_candidate' : 'active_candidate',
        verification_status: 'verified',
        trust_status: part.part_subtype === 'packet_compatibility' ? 'compatibility_only' : 'core_seed',
        priority: part.part_subtype === 'packet_compatibility' ? 250 : BOOTSTRAP_MANIFEST_SOURCE.priority,
        compatibility_posture: part.part_subtype === 'packet_compatibility' ? 'compatibility_reader' : 'current_semantics',
        payload: {
          definition,
          part,
          descriptor: part,
        },
        issues: [],
      });
    }
  }

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
    coordinator_kind: 'definition',
    value: candidates,
    issues,
    trace: [
      definitionTrace({
        step_id: 'definition.candidates.list',
        status: 'ok',
        notes: `Collected ${candidates.length} trusted definition candidates from bootstrap and caller-provided material.`,
      }),
    ],
  });
}
