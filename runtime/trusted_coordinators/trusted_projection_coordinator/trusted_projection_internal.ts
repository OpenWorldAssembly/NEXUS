/**
 * File: trusted_projection_internal.ts
 * Description: Internal helpers for Trusted Projection Coordinator descriptors, traces, and view-model fallback fields.
 */

import type {
  PacketProjectionDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import {
  getPacketDisplayLabel,
  getPacketSummary,
  getPacketTitle,
} from '@core/projections/labels';
import type { PacketEnvelope } from '@core/schema/packet-schema';
import {
  createTrustedTraceEntry,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorStatus,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { TRUSTED_PROJECTION_COORDINATOR_ID } from './trusted_projection_types.ts';

export function projectionTrace(input: {
  step_id: string;
  status?: TrustedRuntimeCoordinatorStatus;
  preset_ids?: readonly string[];
  notes: string;
}): TrustedRuntimeCoordinatorTraceEntry {
  return createTrustedTraceEntry({
    coordinator_id: TRUSTED_PROJECTION_COORDINATOR_ID,
    step_id: input.step_id,
    status: input.status ?? 'ok',
    preset_ids: input.preset_ids ?? ['trusted.projection.v0'],
    notes: input.notes,
  });
}

export function projectionIssue(input: TrustedRuntimeCoordinatorIssue): TrustedRuntimeCoordinatorIssue {
  return trustedIssue(input);
}

export function packetSubtype(packet: PacketEnvelope): string | null {
  const body = packet.body as { subtype?: unknown };
  return typeof body.subtype === 'string' ? body.subtype : null;
}

export function chooseProjection(input: {
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

export function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

export function packetTitleFallback(packet: PacketEnvelope): string {
  return getPacketTitle(packet) ?? packet.header.packet_id;
}

export function packetLabelFallback(packet: PacketEnvelope, definition: PacketTypeDefinition): string {
  return getPacketDisplayLabel(packet) ?? definition.packet_type;
}

export function packetSummaryFallback(packet: PacketEnvelope): string | null {
  return getPacketSummary(packet);
}
