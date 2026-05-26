/**
 * File: trusted_projection_coordinator.ts
 * Description: Trusted runtime coordinator for packet-definition driven UI projection hints.
 */

import {
  getDefinedPacketTypeDefinition,
  type PacketProjectionDescriptor,
  type PacketTypeDefinition,
} from '@core/packets/packet-definition-manifest';
import {
  getPacketDisplayLabel,
  getPacketSummary,
  getPacketTitle,
} from '@core/projections/labels';
import type { PacketEnvelope } from '@core/schema/packet-schema';
import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  resolveTrustedResolutionBinding,
  type TrustedResolutionCoordinatorContext,
} from '@runtime/trusted_coordinators/trusted_resolution_coordinator';

export type TrustedPacketProjectionViewModel = {
  packet_id: string;
  packet_type: string;
  packet_subtype: string | null;
  projection_key: string;
  target_surface: string;
  preferred_surface: string | null;
  layout_key: string | null;
  component_key: string | null;
  action_registry_keys: string[];
  title: string;
  label: string;
  summary: string | null;
  status: string | null;
  fields: Record<string, unknown>;
};

function packetSubtype(packet: PacketEnvelope): string | null {
  const body = packet.body as { subtype?: unknown };
  return typeof body.subtype === 'string' ? body.subtype : null;
}

function chooseProjection(input: {
  definition: PacketTypeDefinition;
  projectionKey?: string | null;
  targetSurface?: string | null;
}): PacketProjectionDescriptor | null {
  if (input.projectionKey) {
    return (
      input.definition.projections.find(
        (projection) => projection.projection_key === input.projectionKey
      ) ?? null
    );
  }

  if (input.targetSurface) {
    return (
      input.definition.projections.find(
        (projection) => projection.target_surface === input.targetSurface
      ) ?? null
    );
  }

  return input.definition.projections[0] ?? null;
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

export function resolveTrustedPacketProjection(input: {
  packet: PacketEnvelope;
  projectionKey?: string | null;
  targetSurface?: string | null;
  context?: Omit<TrustedResolutionCoordinatorContext, 'current_packet' | 'definition'>;
}): TrustedRuntimeCoordinatorResult<TrustedPacketProjectionViewModel> {
  const definition = getDefinedPacketTypeDefinition(input.packet.header.type);
  const issues: TrustedRuntimeCoordinatorIssue[] = [];

  if (!definition) {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: 'trusted_projection_coordinator.v0',
      coordinator_kind: 'projection',
      value: null,
      issues: [
        trustedIssue({
          severity: 'error',
          code: 'unknown_projection_packet_type',
          path: 'packet.header.type',
          message: `No packet definition is registered for ${input.packet.header.type}.`,
        }),
      ],
    });
  }

  const projection = chooseProjection({
    definition,
    projectionKey: input.projectionKey,
    targetSurface: input.targetSurface,
  });

  if (!projection) {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: 'trusted_projection_coordinator.v0',
      coordinator_kind: 'projection',
      value: null,
      issues: [
        trustedIssue({
          severity: 'error',
          code: 'unknown_projection_descriptor',
          path: 'projection_key',
          message: `No projection descriptor is registered for ${definition.packet_type}.`,
        }),
      ],
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
  const title = firstString([fields.title, getPacketTitle(input.packet)]) ?? input.packet.header.packet_id;
  const label = firstString([fields.label, getPacketDisplayLabel(input.packet)]) ?? definition.packet_type;
  const summary = firstString([fields.summary, getPacketSummary(input.packet)]);
  const status = firstString([fields.status]);

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: 'trusted_projection_coordinator.v0',
    coordinator_kind: 'projection',
    value: {
      packet_id: input.packet.header.packet_id,
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
  });
}

export function resolvePreferredProjectionSurface(packetType: string): string | null {
  const definition = getDefinedPacketTypeDefinition(packetType);
  return definition?.projections.find((projection) => projection.preferred_surface)
    ?.preferred_surface ?? null;
}
