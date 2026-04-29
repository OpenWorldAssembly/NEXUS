/**
 * File: packet-interpreter.ts
 * Description: Unified packet interpretation pipeline that separates same-family adaptation, family evolution, and interface-facing read-model projection.
 */

import {
  DISCUSSION_LEGACY_FAMILIES,
  createCanonicalDiscussionMirrorPacket,
  interpretDiscussionPacket,
  isDiscussionLegacyFamily,
  isDiscussionSourcePacket,
  projectDiscussionPacketToLegacy,
  type DiscussionLegacyFamily,
} from '@core/packets/discussion-compat';
import {
  inspectPacketEnvelope,
  inspectPacketEnvelopeForTarget,
  type PacketAdaptationChange,
  type PacketAdaptationLoss,
  type PacketCompatibilityReadResult,
  type PacketEnvelope,
  type PacketEnvelopeByType,
  type PacketFamily,
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
  | 'same_family_adaptation'
  | 'family_evolution'
  | 'target_projection'
  | 'read_model_projection';

export interface PacketInterpretRequest {
  packet: unknown;
  target?: {
    family?: PacketFamily;
    schema_version?: string;
    mode?: PacketInterpretMode;
    read_model_id?: string;
  };
}

export interface PacketInterpretResult {
  raw_packet: unknown;
  adapted_packet: PacketEnvelope;
  interpreted: unknown;
  source_family: PacketFamily;
  target_family: PacketFamily;
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
    source_family: inspected.adapted_packet.header.family,
    target_family: inspected.adapted_packet.header.family,
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

function createBlockedLoss(input: {
  path: string;
  fromSchemaVersion: string;
  toSchemaVersion: string;
  message: string;
}): PacketAdaptationLoss {
  return {
    kind: 'unsupported_target_feature_omission',
    path: input.path,
    from_schema_version: input.fromSchemaVersion,
    to_schema_version: input.toSchemaVersion,
    message: input.message,
  };
}

function inferDiscussionLegacyTargetFamily(
  packet: PacketEnvelope
): DiscussionLegacyFamily {
  if (packet.header.family === 'DiscussionSpace') {
    return 'DiscussionSpace';
  }

  if (packet.header.family === 'DiscussionForum') {
    return 'DiscussionForum';
  }

  if (packet.header.family === 'DiscussionThread') {
    return 'DiscussionThread';
  }

  if (packet.header.family === 'DiscussionReply') {
    return 'DiscussionReply';
  }

  return 'DiscussionPost';
}

function inspectDiscussionLegacyProjectionChanges(
  packet: PacketEnvelope,
  targetLegacyFamily: DiscussionLegacyFamily
): PacketAdaptationChange[] {
  if (packet.header.family === targetLegacyFamily) {
    return [];
  }

  return [
    {
      kind: 'moved_field',
      path: 'header.family',
      from_schema_version: packet.header.schema_version,
      to_schema_version: targetLegacyFamily,
      message: `Projected discussion packet into legacy ${targetLegacyFamily} view.`,
    },
  ];
}

function interpretDiscussionThroughFamilyAdapter(
  inspected: PacketCompatibilityReadResult,
  request: PacketInterpretRequest['target']
): PacketInterpretResult {
  const packet = inspected.adapted_packet;
  const requestedMode = request?.mode ?? 'canonical';
  const requestedFamily = request?.family;
  const canonicalPacket =
    packet.header.family === 'Discussion'
      ? (packet as PacketEnvelopeByType['Discussion'])
      : createCanonicalDiscussionMirrorPacket(packet as never);

  if (requestedMode === 'raw') {
    return createBaseResult(inspected, inspected.raw_packet, ['raw_packet_read']);
  }

  if (requestedMode === 'read_model') {
    const interpretedNode = interpretDiscussionPacket(packet as never);

    return {
      raw_packet: inspected.raw_packet,
      adapted_packet: packet,
      interpreted: interpretedNode,
      source_family: packet.header.family,
      target_family: 'Discussion',
      source_schema_version: inspected.status.source_schema_version,
      target_schema_version: canonicalPacket.header.schema_version,
      stages: [
        'raw_packet_read',
        'same_family_adaptation',
        ...(packet.header.family === 'Discussion' ? [] : (['family_evolution'] as const)),
        'read_model_projection',
      ],
      compatibility_mode:
        packet.header.family === 'Discussion' &&
        inspected.status.direction === 'same_version' &&
        inspected.status.is_exact
          ? 'native'
          : 'adapted',
      changes: interpretedNode.adaptation.changes,
      losses: interpretedNode.adaptation.losses,
      warnings: [],
      requires_guarded_migration: packet.header.family !== 'Discussion',
      requires_loss_acknowledgement:
        interpretedNode.adaptation.requires_loss_acknowledgement,
    };
  }

  if (
    requestedMode === 'canonical' ||
    requestedFamily === undefined ||
    requestedFamily === 'Discussion'
  ) {
    const interpreted =
      packet.header.family === 'Discussion' ? packet : canonicalPacket;

    return {
      raw_packet: inspected.raw_packet,
      adapted_packet: packet,
      interpreted,
      source_family: packet.header.family,
      target_family: 'Discussion',
      source_schema_version: inspected.status.source_schema_version,
      target_schema_version: canonicalPacket.header.schema_version,
      stages: [
        'raw_packet_read',
        'same_family_adaptation',
        ...(packet.header.family === 'Discussion' ? [] : (['family_evolution'] as const)),
        'target_projection',
      ],
      compatibility_mode:
        packet.header.family === 'Discussion' &&
        inspected.status.direction === 'same_version' &&
        inspected.status.is_exact
          ? 'native'
          : 'adapted',
      changes:
        packet.header.family === 'Discussion'
          ? inspected.status.changes
          : interpretDiscussionPacket(packet as never).adaptation.changes,
      losses:
        packet.header.family === 'Discussion'
          ? inspected.status.losses
          : interpretDiscussionPacket(packet as never).adaptation.losses,
      warnings: [],
      requires_guarded_migration: packet.header.family !== 'Discussion',
      requires_loss_acknowledgement: false,
    };
  }

  const targetLegacyFamily = isDiscussionLegacyFamily(requestedFamily)
    ? requestedFamily
    : inferDiscussionLegacyTargetFamily(packet);
  const legacyProjection = projectDiscussionPacketToLegacy(
    canonicalPacket,
    targetLegacyFamily
  );

  if (!legacyProjection) {
    const losses = [
      createBlockedLoss({
        path: 'body.kind',
        fromSchemaVersion: canonicalPacket.header.schema_version,
        toSchemaVersion: targetLegacyFamily,
        message: `Canonical Discussion ${canonicalPacket.body.kind} packets cannot be projected to ${targetLegacyFamily}.`,
      }),
    ];

    return {
      raw_packet: inspected.raw_packet,
      adapted_packet: packet,
      interpreted: null,
      source_family: packet.header.family,
      target_family: targetLegacyFamily,
      source_schema_version: inspected.status.source_schema_version,
      target_schema_version: canonicalPacket.header.schema_version,
      stages: [
        'raw_packet_read',
        'same_family_adaptation',
        ...(packet.header.family === 'Discussion' ? [] : (['family_evolution'] as const)),
        'target_projection',
      ],
      compatibility_mode: 'blocked',
      changes: [],
      losses,
      warnings: [
        `Unsupported discussion projection target ${targetLegacyFamily} for canonical ${canonicalPacket.body.kind}.`,
      ],
      requires_guarded_migration: true,
      requires_loss_acknowledgement: true,
    };
  }

  return {
    raw_packet: inspected.raw_packet,
    adapted_packet: packet,
    interpreted: legacyProjection,
    source_family: packet.header.family,
    target_family: targetLegacyFamily,
    source_schema_version: inspected.status.source_schema_version,
    target_schema_version: legacyProjection.header.schema_version,
    stages: [
      'raw_packet_read',
      'same_family_adaptation',
      ...(packet.header.family === 'Discussion' ? [] : (['family_evolution'] as const)),
      'target_projection',
    ],
    compatibility_mode:
      packet.header.family === targetLegacyFamily &&
      inspected.status.direction === 'same_version' &&
      inspected.status.is_exact
        ? 'native'
        : 'downcast',
    changes:
      packet.header.family === 'Discussion'
        ? [
            {
              kind: 'moved_field',
              path: 'header.family',
              from_schema_version: packet.header.schema_version,
              to_schema_version: legacyProjection.header.schema_version,
              message: `Projected canonical Discussion packet into legacy ${targetLegacyFamily} view.`,
            },
          ]
        : inspectDiscussionLegacyProjectionChanges(packet, targetLegacyFamily),
    losses: [],
    warnings: [],
    requires_guarded_migration: false,
    requires_loss_acknowledgement: false,
  };
}

export function interpretPacket(
  request: PacketInterpretRequest
): PacketInterpretResult {
  const targetMode = request.target?.mode ?? 'canonical';

  if (targetMode === 'read_model' && !request.target?.read_model_id) {
    throw new Error('Packet read_model interpretation requires target.read_model_id.');
  }

  const targetFamily = request.target?.family;
  const sameFamilyTarget =
    targetFamily &&
    targetFamily !== 'Discussion' &&
    !DISCUSSION_LEGACY_FAMILIES.includes(targetFamily as DiscussionLegacyFamily)
      ? targetFamily
      : undefined;
  const inspected = sameFamilyTarget
    ? inspectPacketEnvelopeForTarget(request.packet, {
        target_schema_version: request.target?.schema_version,
      })
    : inspectPacketEnvelope(request.packet);

  if (!isDiscussionSourcePacket(inspected.adapted_packet)) {
    if (targetMode === 'raw') {
      return createBaseResult(inspected, inspected.raw_packet, ['raw_packet_read']);
    }

    const stages: PacketInterpretStage[] = [
      'raw_packet_read',
      'same_family_adaptation',
    ];

    if (targetMode === 'read_model') {
      stages.push('read_model_projection');
    } else {
      stages.push('target_projection');
    }

    return createBaseResult(inspected, inspected.adapted_packet, stages);
  }

  if (
    targetMode === 'legacy' ||
    targetMode === 'canonical' ||
    targetMode === 'read_model' ||
    targetMode === 'raw'
  ) {
    return interpretDiscussionThroughFamilyAdapter(inspected, request.target);
  }

  return createBaseResult(inspected, inspected.adapted_packet, [
    'raw_packet_read',
    'same_family_adaptation',
  ]);
}
