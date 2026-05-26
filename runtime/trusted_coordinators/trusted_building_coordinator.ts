/**
 * File: trusted_building_coordinator.ts
 * Description: Trusted runtime coordinator for definition-backed packet body candidate construction.
 */

import {
  buildPacketTypeBodyCandidate,
  type DefinitionPartBodyBuilderInput,
  type PacketTypeBodyBuilderInput,
  type PacketTypeBodyCandidate,
} from '@core/packets/packet-type-body-builders.ts';
import type {
  PacketDefinitionPartDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export type TrustedDefinitionPartBuildPlan = {
  plan_kind: 'trusted.definition_part_build_plan';
  packet_type: string;
  definition_version: string;
  part_count: number;
  part_ids: string[];
  candidates: PacketTypeBodyCandidate[];
};

function trace(input: {
  step_id: string;
  status: 'ok' | 'partial' | 'blocked' | 'error';
  notes: string;
}): TrustedRuntimeCoordinatorTraceEntry {
  return {
    step_id: input.step_id,
    coordinator_id: 'trusted_building_coordinator.v0',
    preset_ids: ['resolution.primitive_bindings.v0'],
    status: input.status,
    notes: input.notes,
  };
}

export function buildTrustedPacketTypeBodyCandidate(
  input: PacketTypeBodyBuilderInput
): TrustedRuntimeCoordinatorResult<PacketTypeBodyCandidate> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];

  try {
    const candidate = buildPacketTypeBodyCandidate(input);

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: 'trusted_building_coordinator.v0',
      coordinator_kind: 'builder',
      value: candidate,
      issues,
      trace: [
        trace({
          step_id: 'packet_type.body_candidate.build',
          status: 'ok',
          notes: `Built ${candidate.packet_type}.${candidate.packet_subtype} body candidate with ${candidate.builder_id}.`,
        }),
      ],
    });
  } catch (error) {
    issues.push(
      trustedIssue({
        severity: 'error',
        code: 'trusted_body_candidate_build_failed',
        path: 'body_builder_input',
        message: error instanceof Error ? error.message : 'Unknown body candidate build failure.',
      })
    );

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: 'trusted_building_coordinator.v0',
      coordinator_kind: 'builder',
      value: null,
      issues,
      trace: [
        trace({
          step_id: 'packet_type.body_candidate.build',
          status: 'error',
          notes: 'Trusted body candidate construction failed before packet envelope construction.',
        }),
      ],
    });
  }
}

function buildDefinitionPartCandidate(input: {
  definition: PacketTypeDefinition;
  part: PacketDefinitionPartDescriptor;
}): TrustedRuntimeCoordinatorResult<PacketTypeBodyCandidate> {
  const builderInput: DefinitionPartBodyBuilderInput = {
    packet_type: 'Definition',
    packet_subtype: input.part.part_subtype,
    definition: input.definition,
    part: input.part,
  };

  return buildTrustedPacketTypeBodyCandidate(builderInput);
}

export function buildTrustedDefinitionPartCandidates(input: {
  definition: PacketTypeDefinition;
  parts?: readonly PacketDefinitionPartDescriptor[];
}): TrustedRuntimeCoordinatorResult<TrustedDefinitionPartBuildPlan> {
  const selectedParts = [...(input.parts ?? input.definition.packet_definition_parts ?? [])];
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const candidates: PacketTypeBodyCandidate[] = [];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [];

  if (selectedParts.length === 0) {
    issues.push(
      trustedIssue({
        severity: 'warning',
        code: 'definition_has_no_definition_parts',
        path: 'definition.packet_definition_parts',
        message: `${input.definition.packet_type} has no packet definition parts to build.`,
      })
    );
  }

  for (const part of selectedParts) {
    const result = buildDefinitionPartCandidate({
      definition: input.definition,
      part,
    });

    issues.push(...result.issues);
    traceEntries.push(...result.trace);

    if (result.value) {
      candidates.push(result.value);
    }
  }

  traceEntries.push(
    trace({
      step_id: 'definition.part_candidates.collect',
      status: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'partial' : 'ok',
      notes: `Collected ${candidates.length}/${selectedParts.length} Definition body candidates for ${input.definition.packet_type}.`,
    })
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: 'trusted_building_coordinator.v0',
    coordinator_kind: 'builder',
    value: {
      plan_kind: 'trusted.definition_part_build_plan',
      packet_type: input.definition.packet_type,
      definition_version: input.definition.current_schema_version,
      part_count: selectedParts.length,
      part_ids: selectedParts.map((part) => part.part_id),
      candidates,
    },
    issues,
    trace: traceEntries,
  });
}
