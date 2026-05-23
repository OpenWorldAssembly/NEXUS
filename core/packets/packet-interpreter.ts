/**
 * File: packet-interpreter.ts
 * Description: Unified packet interpretation pipeline that separates same-type adaptation, type evolution, and interface-facing read-model projection.
 */

import {
  inspectPacketEnvelope,
  inspectPacketEnvelopeForTarget,
  type PacketAdaptationChange,
  type PacketAdaptationLoss,
  type PacketCompatibilityReadResult,
  type PacketEnvelope,
  type PacketType,
} from '@core/schema/packet-schema';

export type PacketInterpretMode =
  | 'raw'
  | 'canonical'
  | 'legacy'
  | 'read_model';
export type PacketCompatibilityMode =
  | 'native'
  | 'adapted'
  | 'downcast'
  | 'lossy'
  | 'blocked';
export type PacketInterpretStage =
  | 'raw_packet_read'
  | 'same_type_adaptation'
  | 'type_evolution'
  | 'target_projection'
  | 'read_model_projection';

export interface PacketInterpretRequest {
  packet: unknown;
  target?: {
    type?: PacketType;
    schema_version?: string;
    mode?: PacketInterpretMode;
    read_model_id?: string;
  };
}

export interface PacketInterpretResult {
  raw_packet: unknown;
  adapted_packet: PacketEnvelope;
  interpreted: unknown;
  source_type: PacketType;
  target_type: PacketType;
  source_schema_version: string;
  target_schema_version: string;
  stages: PacketInterpretStage[];
  compatibility_mode: PacketCompatibilityMode;
  changes: PacketAdaptationChange[];
  losses: PacketAdaptationLoss[];
  warnings: string[];
  requires_guarded_migration: boolean;
  requires_loss_acknowledgement: boolean;
}

function createCompatibilityMode(
  inspected: PacketCompatibilityReadResult
): PacketCompatibilityMode {
  if (inspected.status.direction === 'same_version' && inspected.status.is_exact) {
    return 'native';
  }

  if (inspected.status.is_lossy) {
    return 'lossy';
  }

  if (inspected.status.direction === 'downcast') {
    return 'downcast';
  }

  return 'adapted';
}

function createBaseResult(
  inspected: PacketCompatibilityReadResult,
  interpreted: unknown,
  stages: PacketInterpretStage[]
): PacketInterpretResult {
  return {
    raw_packet: inspected.raw_packet,
    adapted_packet: inspected.adapted_packet,
    interpreted,
    source_type: inspected.adapted_packet.header.type,
    target_type: inspected.adapted_packet.header.type,
    source_schema_version: inspected.status.source_schema_version,
    target_schema_version: inspected.status.target_schema_version,
    stages,
    compatibility_mode: createCompatibilityMode(inspected),
    changes: inspected.status.changes,
    losses: inspected.status.losses,
    warnings: [],
    requires_guarded_migration: inspected.status.requires_guarded_upgrade,
    requires_loss_acknowledgement:
      inspected.status.requires_loss_acknowledgement,
  };
}

export function interpretPacket(
  request: PacketInterpretRequest
): PacketInterpretResult {
  const targetMode = request.target?.mode ?? 'canonical';

  if (targetMode === 'read_model' && !request.target?.read_model_id) {
    throw new Error('Packet read_model interpretation requires target.read_model_id.');
  }

  const targetType = request.target?.type;
  const sameTypeTarget = targetType ?? undefined;
  const inspected = sameTypeTarget
    ? inspectPacketEnvelopeForTarget(request.packet, {
        target_schema_version: request.target?.schema_version,
      })
    : inspectPacketEnvelope(request.packet);

  if (targetMode === 'raw') {
    return createBaseResult(inspected, inspected.raw_packet, ['raw_packet_read']);
  }

  const stages: PacketInterpretStage[] = [
    'raw_packet_read',
    'same_type_adaptation',
  ];

  if (targetMode === 'read_model') {
    stages.push('read_model_projection');
  } else {
    stages.push('target_projection');
  }

  return createBaseResult(inspected, inspected.adapted_packet, stages);
}
