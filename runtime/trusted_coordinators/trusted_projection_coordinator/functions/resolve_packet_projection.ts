/**
 * File: resolve_packet_projection.ts
 * Description: Resolves a trusted UI projection for an already-loaded packet envelope.
 */

import { trustedDefinitionCoordinator } from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  resolveTrustedResolutionBinding,
  type TrustedResolutionCoordinatorContext,
} from '@runtime/trusted_coordinators/trusted_resolution_coordinator/index.ts';
import {
  chooseProjection,
  firstString,
  packetLabelFallback,
  packetSubtype,
  packetSummaryFallback,
  packetTitleFallback,
  projectionIssue,
  projectionTrace,
} from '../trusted_projection_internal.ts';
import {
  TRUSTED_PROJECTION_COORDINATOR_ID,
  type ResolveTrustedPacketProjectionInput,
  type TrustedPacketProjectionViewModel,
} from '../trusted_projection_types.ts';

export function resolveTrustedPacketProjection(
  input: ResolveTrustedPacketProjectionInput
): TrustedRuntimeCoordinatorResult<TrustedPacketProjectionViewModel> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const definitionResult = trustedDefinitionCoordinator.resolvePacketDefinition({
    packet_type: input.packet.header.type,
    node_element_id: input.node_element_id,
    context_mode: contextMode,
  });
  const issues: TrustedRuntimeCoordinatorIssue[] = [...definitionResult.issues];
  const trace = [...definitionResult.trace];

  if (!definitionResult.value) {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_PROJECTION_COORDINATOR_ID,
      coordinator_kind: 'projection',
      value: null,
      issues: [
        ...issues,
        projectionIssue({
          severity: 'error',
          code: 'unknown_projection_packet_type',
          path: 'packet.header.type',
          message: `No trusted packet definition resolved for ${input.packet.header.type}.`,
        }),
      ],
      trace,
      mode: contextMode,
      operation_id: input.operation_id,
      request_id: input.request_id,
    });
  }

  const definition = definitionResult.value;
  const projection = chooseProjection({
    definition,
    projectionKey: input.projection_key,
    targetSurface: input.target_surface,
  });

  if (!projection) {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_PROJECTION_COORDINATOR_ID,
      coordinator_kind: 'projection',
      value: null,
      issues: [
        ...issues,
        projectionIssue({
          severity: 'error',
          code: 'unknown_projection_descriptor',
          path: 'projection_key',
          message: `No projection descriptor is registered for ${definition.packet_type}.`,
        }),
      ],
      trace,
      mode: contextMode,
      operation_id: input.operation_id,
      request_id: input.request_id,
    });
  }

  const context: TrustedResolutionCoordinatorContext = {
    ...(input.context ?? {}),
    current_packet: input.packet,
    definition,
  };
  const fields = Object.fromEntries(
    (projection.field_descriptors ?? []).map((field) => [
      field.field_key,
      resolveTrustedResolutionBinding({
        binding: field.binding,
        context,
        path: `projection.${projection.projection_key}.fields.${field.field_key}`,
        issues,
      }),
    ])
  );
  const title = firstString([fields.title, packetTitleFallback(input.packet)]) ?? input.packet.header.packet_id;
  const label = firstString([fields.label, packetLabelFallback(input.packet, definition)]) ?? definition.packet_type;
  const summary = firstString([fields.summary, packetSummaryFallback(input.packet)]);
  const status = firstString([fields.status]);

  trace.push(projectionTrace({
    step_id: 'projection.packet.resolve',
    preset_ids: ['trusted.projection.packet.v0'],
    notes: `Resolved ${projection.projection_key} projection for ${input.packet.header.packet_id}.`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_PROJECTION_COORDINATOR_ID,
    coordinator_kind: 'projection',
    value: {
      view_model_kind: 'trusted.packet_projection_view_model',
      packet_id: input.packet.header.packet_id,
      revision_id: input.revision_ref?.revision_id ?? input.packet.header.revision_id ?? null,
      packet_type: input.packet.header.type,
      packet_subtype: packetSubtype(input.packet),
      projection_key: projection.projection_key,
      target_surface: projection.target_surface,
      preferred_surface: projection.preferred_surface ?? null,
      layout_key: projection.layout?.layout_key ?? null,
      component_key: projection.layout?.component_key ?? null,
      action_registry_keys: [...(projection.action_registry_keys ?? [])],
      title,
      label,
      summary,
      status,
      fields,
    },
    issues,
    trace,
    mode: contextMode,
    operation_id: input.operation_id,
    request_id: input.request_id,
  });
}
