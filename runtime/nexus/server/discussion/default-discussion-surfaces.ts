/**
 * File: default-discussion-surfaces.ts
 * Description: Plans and writes default packet-backed discussion surfaces for Element packets.
 */

import { buildElementDefaultDiscussionPackets } from '@core/packets/defaults/element-discussion-defaults';
import type {
  PacketEnvelopeByType,
  PacketRef,
} from '@core/schema/packet-schema';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

type ElementDiscussionProfile = 'person' | 'assembly' | 'locality_assembly';

function resolveElementDiscussionProfile(
  elementSubtype?: PacketEnvelopeByType['Element']['body']['subtype'] | null
): ElementDiscussionProfile {
  if (elementSubtype === 'person') {
    return 'person';
  }

  if (elementSubtype === 'locality') {
    return 'locality_assembly';
  }

  return 'assembly';
}

function createDefaultDiscussionSurfacePackets(input: {
  elementPacketId: string;
  elementName: string;
  elementSubtype?: PacketEnvelopeByType['Element']['body']['subtype'] | null;
  createdAt: string;
  applicableScopeRefs: PacketRef[];
  includeProposalsForum?: boolean;
}): PacketEnvelopeByType['Discussion'][] {
  return buildElementDefaultDiscussionPackets({
    elementRef: { packet_id: input.elementPacketId },
    elementName: input.elementName,
    profile: resolveElementDiscussionProfile(input.elementSubtype),
    createdAt: input.createdAt,
    applicableScopeRefs: input.applicableScopeRefs,
    includeProposalsForum: input.includeProposalsForum,
    includeReportsForum: input.elementSubtype !== 'person',
  });
}

export async function planDefaultDiscussionSurfaces(input: {
  packetStore: NodeSQLitePacketStore;
  scopePacketId: string;
  scopeName: string;
  applicableScopeRefs: PacketRef[];
  elementSubtype?: PacketEnvelopeByType['Element']['body']['subtype'] | null;
  includeProposalsForum?: boolean;
}): Promise<PacketEnvelopeByType['Discussion'][]> {
  const plannedPackets: PacketEnvelopeByType['Discussion'][] = [];
  const packets = createDefaultDiscussionSurfacePackets({
    elementPacketId: input.scopePacketId,
    elementName: input.scopeName,
    elementSubtype: input.elementSubtype,
    createdAt: new Date().toISOString(),
    applicableScopeRefs: input.applicableScopeRefs,
    includeProposalsForum: input.includeProposalsForum,
  });

  for (const packet of packets) {
    const existingPacket = await input.packetStore.fetchPreferredRevision({
      packet_id: packet.header.packet_id,
    });

    if (!existingPacket) {
      plannedPackets.push(packet);
    }
  }

  return plannedPackets;
}

/**
 * Inputs: an Element packet id/name and packet store.
 * Output: creates missing default discussion surface packets only once.
 */
export async function ensureDefaultDiscussionSurfaces(input: {
  packetStore: NodeSQLitePacketStore;
  scopePacketId: string;
  scopeName: string;
  applicableScopeRefs: PacketRef[];
  elementSubtype?: PacketEnvelopeByType['Element']['body']['subtype'] | null;
  includeProposalsForum?: boolean;
}): Promise<PacketEnvelopeByType['Discussion'][]> {
  const createdPackets: PacketEnvelopeByType['Discussion'][] = [];
  const packets = await planDefaultDiscussionSurfaces(input);

  for (const packet of packets) {
    await input.packetStore.writeRevision(packet);
    await input.packetStore.publishRevision({
      packet_id: packet.header.packet_id,
      revision_id: packet.header.revision_id,
    });
    createdPackets.push(packet);
  }

  return createdPackets;
}
