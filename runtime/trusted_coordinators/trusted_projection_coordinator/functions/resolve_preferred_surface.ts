/**
 * File: resolve_preferred_surface.ts
 * Description: Resolves the preferred UI surface declared by a packet definition projection descriptor.
 */

import { trustedDefinitionCoordinator } from '@runtime/trusted_coordinators/trusted_definition_coordinator';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { projectionTrace } from '../trusted_projection_internal.ts';
import {
  TRUSTED_PROJECTION_COORDINATOR_ID,
  type ResolveTrustedPreferredSurfaceInput,
  type TrustedPreferredProjectionSurface,
} from '../trusted_projection_types.ts';

export function resolveTrustedPreferredSurface(
  input: ResolveTrustedPreferredSurfaceInput
): TrustedRuntimeCoordinatorResult<TrustedPreferredProjectionSurface> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const definitionResult = trustedDefinitionCoordinator.resolvePacketDefinition({
    packet_type: input.packet_type,
    node_element_id: input.node_element_id,
    context_mode: contextMode,
  });
  const projection = definitionResult.value?.projections.find((candidate) => candidate.preferred_surface)
    ?? definitionResult.value?.projections[0]
    ?? null;

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_PROJECTION_COORDINATOR_ID,
    coordinator_kind: 'projection',
    value: {
      result_kind: 'trusted.preferred_projection_surface',
      packet_type: input.packet_type,
      preferred_surface: projection?.preferred_surface ?? null,
      projection_key: projection?.projection_key ?? null,
    },
    issues: definitionResult.issues,
    trace: [
      ...definitionResult.trace,
      projectionTrace({
        step_id: 'projection.preferred_surface.resolve',
        preset_ids: ['trusted.projection.preferred_surface.v0'],
        notes: `Resolved preferred surface for ${input.packet_type}.`,
      }),
    ],
    mode: contextMode,
    operation_id: input.operation_id,
    request_id: input.request_id,
  });
}
