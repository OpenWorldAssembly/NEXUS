/**
 * File: scope-graph-owa.ts
 * Description: Keeps OWA-specific cause-anchor policy lookup separate from the generic scope graph projection.
 */

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import { collectPoliciesForCauseAnchor } from '@runtime/nexus/server/relation-policy';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

type CauseLikePacket =
  | PacketEnvelopeByType['Cause']
  | PacketEnvelopeByType['Initiative']
  | PacketEnvelopeByType['Program']
  | PacketEnvelopeByType['Campaign'];

async function resolveOwaCauseAnchor(
  packetStore: NodeSQLitePacketStore
): Promise<CauseLikePacket | null> {
  const directCause = await packetStore.fetchByPacket({ packet_id: 'nexus:cause/owa' });

  if (directCause?.header.family === 'Cause' && directCause.body.subtype === 'initiative') {
    return directCause as PacketEnvelopeByType['Cause'];
  }

  for (const family of ['Initiative', 'Program', 'Campaign'] as const) {
    const packets = await packetStore.listPreferredPacketsByFamily(family);
    const anchor =
      packets.find((packet) => packet.header.packet_id.toLowerCase().includes('owa')) ??
      packets.find((packet) => {
        const title = 'title' in packet.body ? packet.body.title : null;

        return typeof title === 'string' && title.trim().toLowerCase() === 'owa';
      });

    if (anchor) {
      return anchor as CauseLikePacket;
    }
  }

  return null;
}

export async function getOwaRelationPolicyPackets(
  packetStore: NodeSQLitePacketStore
): Promise<PacketEnvelopeByType['Policy'][]> {
  const [anchorPacket, policyPackets] = await Promise.all([
    resolveOwaCauseAnchor(packetStore),
    packetStore.listPreferredPacketsByFamily('Policy'),
  ]);

  if (!anchorPacket) {
    return [];
  }

  return collectPoliciesForCauseAnchor({
    anchorPacket,
    policyPackets: policyPackets as PacketEnvelopeByType['Policy'][],
  });
}
