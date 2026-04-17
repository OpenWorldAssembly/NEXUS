/**
 * File: identity-search-service.ts
 * Description: Provides graph-backed identity lookup for Nexus claimed-identity sign-in and restore flows.
 */

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type { NexusIdentitySearchResultPayload } from '@runtime/nexus/nexus-api-types';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

function getMatchSource(
  packet: PacketEnvelopeByType['Element'],
  normalizedQuery: string
): NexusIdentitySearchResultPayload['match_source'] | null {
  if (packet.header.packet_id.toLowerCase().includes(normalizedQuery)) {
    return 'packet_id';
  }

  const keyBindings = packet.body.identity?.public_key_bindings ?? [];
  const publicKeySearchValue = keyBindings
    .map((binding) =>
      [binding.kid, JSON.stringify(binding.public_jwk)]
        .filter((value) => typeof value === 'string' && value.length > 0)
        .join(' ')
    )
    .join(' ')
    .toLowerCase();

  if (publicKeySearchValue.includes(normalizedQuery)) {
    return 'public_key';
  }

  const aliasSearchValue = [
    packet.body.identity?.alias ?? '',
    packet.body.name,
  ]
    .join(' ')
    .toLowerCase();

  if (aliasSearchValue.includes(normalizedQuery)) {
    return 'alias';
  }

  return null;
}

function getMatchRank(
  matchSource: NexusIdentitySearchResultPayload['match_source']
): number {
  if (matchSource === 'packet_id') {
    return 0;
  }

  if (matchSource === 'public_key') {
    return 1;
  }

  return 2;
}

/**
 * Inputs: a graph search query plus actor ids already stored on this device.
 * Output: matching person-element identities from the Nexus packet graph.
 */
export async function searchNexusIdentities(input: {
  query: string;
  savedActorPacketIds?: string[];
  limit?: number;
}): Promise<NexusIdentitySearchResultPayload[]> {
  const normalizedQuery = input.query.trim().toLowerCase();

  if (normalizedQuery.length < 2) {
    return [];
  }

  const services = await getNexusPacketServices();
  const savedActorPacketIdSet = new Set(input.savedActorPacketIds ?? []);
  const personPackets = (
    await services.packetStore.listPreferredPacketsByFamily('Element')
  ).filter(
    (packet): packet is PacketEnvelopeByType['Element'] => packet.body.kind === 'person'
  );

  return personPackets
    .map((packet) => {
      const matchSource = getMatchSource(packet, normalizedQuery);

      if (!matchSource) {
        return null;
      }

      return {
        actor_packet_id: packet.header.packet_id,
        display_alias: packet.body.identity?.alias ?? packet.body.name,
        claim_status: packet.body.identity?.claim_status ?? 'ephemeral_guest',
        saved_on_device: savedActorPacketIdSet.has(packet.header.packet_id),
        match_source: matchSource,
      } satisfies NexusIdentitySearchResultPayload;
    })
    .filter((value): value is NexusIdentitySearchResultPayload => value !== null)
    .sort((left, right) => {
      if (left.saved_on_device !== right.saved_on_device) {
        return left.saved_on_device ? -1 : 1;
      }

      const rankDifference =
        getMatchRank(left.match_source) - getMatchRank(right.match_source);

      if (rankDifference !== 0) {
        return rankDifference;
      }

      return left.display_alias.localeCompare(right.display_alias);
    })
    .slice(0, input.limit ?? 8);
}
