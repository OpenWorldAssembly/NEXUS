/**
 * File: build_packet_type_body_candidate.ts
 * Description: Builds runtime-ready packet-type body candidates through local trusted body builders.
 */

import { buildPacketTypeBodyCandidate } from '@core/packets/packet-type-body-builders.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  buildingIssue,
  buildingTrace,
} from '../trusted_building_internal.ts';
import {
  TRUSTED_BUILDING_COORDINATOR_ID,
  type BuildTrustedPacketTypeBodyCandidateInput,
  type TrustedBodyCandidate,
} from '../trusted_building_types.ts';

export function buildTrustedPacketTypeBodyCandidate(
  input: BuildTrustedPacketTypeBodyCandidateInput
): TrustedRuntimeCoordinatorResult<TrustedBodyCandidate> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];

  try {
    const candidate = buildPacketTypeBodyCandidate(input.input);

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_BUILDING_COORDINATOR_ID,
      coordinator_kind: 'building',
      value: candidate,
      issues,
      trace: [
        buildingTrace({
          step_id: 'building.packet_type_body_candidate.build',
          status: 'ok',
          preset_ids: ['trusted.body_builder.local.v0'],
          notes: `Built ${candidate.packet_type}.${candidate.packet_subtype} body candidate with ${candidate.builder_id}.`,
        }),
      ],
    });
  } catch (error) {
    issues.push(
      buildingIssue({
        severity: 'error',
        code: 'trusted_body_candidate_build_failed',
        path: 'body_builder_input',
        message: error instanceof Error ? error.message : 'Unknown body candidate build failure.',
      })
    );

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_BUILDING_COORDINATOR_ID,
      coordinator_kind: 'building',
      value: null,
      issues,
      trace: [
        buildingTrace({
          step_id: 'building.packet_type_body_candidate.build',
          status: 'error',
          preset_ids: ['trusted.body_builder.local.v0'],
          notes: 'Trusted body candidate construction failed before packet envelope construction.',
        }),
      ],
    });
  }
}
