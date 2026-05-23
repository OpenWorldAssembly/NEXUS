/**
 * File: discussion-compat.ts
 * Description: Canonical Discussion helper aliases retained for runtime call sites.
 */

import type { PacketEnvelope, PacketEnvelopeByType } from '@core/schema/packet-schema';

export type DiscussionLegacyType = 'Discussion';

export function toDiscussionOperationalPacketId(packetId: string): string {
  return packetId;
}

export function resolvePreferredDiscussionPacketId(input: {
  candidate_packet_ids: Iterable<string>;
  requested_packet_id: string;
}): string {
  for (const packetId of input.candidate_packet_ids) {
    if (packetId === input.requested_packet_id) {
      return packetId;
    }
  }

  return input.requested_packet_id;
}

export function areDiscussionPacketIdsEquivalent(
  leftPacketId: string,
  rightPacketId: string
): boolean {
  return leftPacketId === rightPacketId;
}

export function isCanonicalDiscussionPacketId(packetId: string): boolean {
  return packetId.startsWith('nexus:discussion/');
}

export function isDiscussionMessagePacket(
  packet: PacketEnvelope | null | undefined
): packet is PacketEnvelopeByType['Discussion'] {
  return packet?.header.type === 'Discussion';
}
