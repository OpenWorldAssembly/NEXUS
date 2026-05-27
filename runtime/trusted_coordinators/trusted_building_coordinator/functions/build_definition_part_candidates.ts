/**
 * File: build_definition_part_candidates.ts
 * Description: Builds Definition-part body candidates from trusted packet definitions.
 */

import type { DefinitionPartBodyBuilderInput } from '@core/packets/packet-type-body-builders.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { buildingTrace } from '../trusted_building_internal.ts';
import {
  TRUSTED_BUILDING_COORDINATOR_ID,
  type BuildTrustedDefinitionPartCandidatesInput,
  type TrustedDefinitionPartBuildPlan,
} from '../trusted_building_types.ts';
import { buildTrustedPacketTypeBodyCandidate } from './build_packet_type_body_candidate.ts';

export function buildTrustedDefinitionPartCandidates(
  input: BuildTrustedDefinitionPartCandidatesInput
): TrustedRuntimeCoordinatorResult<TrustedDefinitionPartBuildPlan> {
  const selectedParts = [...(input.parts ?? input.definition.packet_definition_parts ?? [])];
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const candidates: TrustedDefinitionPartBuildPlan['candidates'] = [];
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
    const builderInput: DefinitionPartBodyBuilderInput = {
      packet_type: 'Definition',
      packet_subtype: part.part_subtype,
      definition: input.definition,
      part,
    };
    const result = buildTrustedPacketTypeBodyCandidate({ input: builderInput });

    issues.push(...result.issues);
    traceEntries.push(...result.trace);

    if (result.value && result.value.candidate_kind === 'packet_type.body_candidate') {
      candidates.push(result.value);
    }
  }

  traceEntries.push(
    buildingTrace({
      step_id: 'building.definition_part_candidates.collect',
      status: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'partial' : 'ok',
      preset_ids: ['trusted.definition_part_build.v0'],
      notes: `Collected ${candidates.length}/${selectedParts.length} Definition body candidates for ${input.definition.packet_type}.`,
    })
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_BUILDING_COORDINATOR_ID,
    coordinator_kind: 'building',
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
