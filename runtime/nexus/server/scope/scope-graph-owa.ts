/**
 * File: scope-graph-owa.ts
 * Description: Keeps OWA-specific Action initiative policy lookup separate from the generic scope graph projection.
 */

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import { collectPoliciesForActionAnchor } from '@runtime/nexus/server/relation-policy';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

async function resolveOwaActionAnchor(
  packetStore: NodeSQLitePacketStore
): Promise<PacketEnvelopeByType['Action'] | null> {
  const directAction = await packetStore.fetchByPacket({
    packet_id: 'nexus:action/initiative/owa',
  });

  if (directAction?.header.type === 'Action' && directAction.body.subtype === 'initiative') {
    return directAction as PacketEnvelopeByType['Action'];
  }

  const actionPackets = await packetStore.listPreferredPacketsByType('Action');
  return (
    (actionPackets.find(
      (packet) =>
        packet.body.subtype === 'initiative' &&
        (packet.header.packet_id.toLowerCase().includes('owa') ||
          packet.body.title.trim().toLowerCase() === 'owa')
    ) as PacketEnvelopeByType['Action'] | undefined) ?? null
  );
}

export async function getOwaRelationPolicyPackets(
  packetStore: NodeSQLitePacketStore
): Promise<PacketEnvelopeByType['Policy'][]> {
  const [anchorPacket, policyPackets] = await Promise.all([
    resolveOwaActionAnchor(packetStore),
    packetStore.listPreferredPacketsByType('Policy'),
  ]);

  if (!anchorPacket) {
    return [];
  }

  return collectPoliciesForActionAnchor({
    anchorPacket,
    policyPackets: policyPackets as PacketEnvelopeByType['Policy'][],
  });
}
