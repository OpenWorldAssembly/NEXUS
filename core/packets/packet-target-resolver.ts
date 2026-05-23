/**
 * File: packet-target-resolver.ts
 * Description: Read-only packet target resolution and side-effect-free migration planning for type-aware packet graphs.
 */

import type { PacketHeadStatus } from '@core/contracts';
import type {
  PacketEnvelope,
  PacketRevisionRef,
} from '@core/schema/packet-schema';

export type PacketTargetResolutionBasis =
  | 'native'
  | 'same_id_preferred_revision'
  | 'deterministic_mirror'
  | 'successor'
  | 'supersession'
  | 'virtual_projection';

export type PacketCurrentnessStatus =
  | 'current'
  | 'historical'
  | 'canonicalized'
  | 'ambiguous'
  | 'missing';

export type PacketTargetResolution = {
  requested_packet_id: string;
  resolved_packet_id: string | null;
  canonical_packet_id: string | null;
  source_packet: PacketEnvelope | null;
  resolved_packet: PacketEnvelope | null;
  preferred_revision: PacketRevisionRef | null;
  basis: PacketTargetResolutionBasis;
  currentness_status: PacketCurrentnessStatus;
  warnings: string[];
};

export interface PacketTargetResolutionRequest {
  packet_id: string;
  fetchPacket: (packetId: string) => Promise<PacketEnvelope | null>;
  fetchRevisionHeads?: (packetId: string) => Promise<PacketHeadStatus | null>;
}

export interface PacketTargetMigrationPlan {
  requested_packet_id: string;
  canonical_packet_id: string | null;
  packets: PacketEnvelope[];
  warnings: string[];
  blocked_reason: string | null;
  requires_mutation_corridor: true;
}

export interface PacketTargetMigrationRequest
  extends PacketTargetResolutionRequest {
  resolution?: PacketTargetResolution;
}

function toPreferredRevision(packet: PacketEnvelope): PacketRevisionRef {
  return {
    packet_id: packet.header.packet_id,
    revision_id: packet.header.revision_id,
  };
}

function createMissingResolution(packetId: string): PacketTargetResolution {
  return {
    requested_packet_id: packetId,
    resolved_packet_id: null,
    canonical_packet_id: null,
    source_packet: null,
    resolved_packet: null,
    preferred_revision: null,
    basis: 'native',
    currentness_status: 'missing',
    warnings: [`Packet ${packetId} was not found.`],
  };
}

export async function resolvePacketTarget(
  input: PacketTargetResolutionRequest
): Promise<PacketTargetResolution> {
  const sourcePacket = await input.fetchPacket(input.packet_id);

  if (!sourcePacket) {
    return createMissingResolution(input.packet_id);
  }

  const headStatus = input.fetchRevisionHeads
    ? await input.fetchRevisionHeads(sourcePacket.header.packet_id)
    : null;

  if (
    headStatus &&
    headStatus.head_revisions.length > 1 &&
    headStatus.preferred_revision === null
  ) {
    return {
      requested_packet_id: input.packet_id,
      resolved_packet_id: null,
      canonical_packet_id: sourcePacket.header.packet_id,
      source_packet: sourcePacket,
      resolved_packet: null,
      preferred_revision: null,
      basis: 'same_id_preferred_revision',
      currentness_status: 'ambiguous',
      warnings: [
        `Packet ${sourcePacket.header.packet_id} has multiple head revisions without a preferred revision.`,
      ],
    };
  }

  const preferredRevision =
    headStatus?.preferred_revision ?? toPreferredRevision(sourcePacket);

  return {
    requested_packet_id: input.packet_id,
    resolved_packet_id: sourcePacket.header.packet_id,
    canonical_packet_id: sourcePacket.header.packet_id,
    source_packet: sourcePacket,
    resolved_packet: sourcePacket,
    preferred_revision: preferredRevision,
    basis:
      preferredRevision.revision_id === sourcePacket.header.revision_id
        ? 'native'
        : 'same_id_preferred_revision',
    currentness_status: 'current',
    warnings: [],
  };
}

export async function planPacketTargetMigration(
  input: PacketTargetMigrationRequest
): Promise<PacketTargetMigrationPlan> {
  const resolution = input.resolution ?? (await resolvePacketTarget(input));

  return {
    requested_packet_id: input.packet_id,
    canonical_packet_id: resolution.canonical_packet_id,
    packets: [],
    warnings: resolution.warnings,
    blocked_reason:
      resolution.currentness_status === 'ambiguous'
        ? `Packet ${input.packet_id} does not have one defensible operational target.`
        : null,
    requires_mutation_corridor: true,
  };
}
