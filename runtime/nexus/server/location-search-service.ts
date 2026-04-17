/**
 * File: location-search-service.ts
 * Description: Provides graph-backed location lookup for Nexus identity disclosure flows.
 */

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type { NexusLocationSearchResult } from '@runtime/nexus/location-search';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

type NexusLocationLookupProvider = {
  searchLocations: (query: string, limit: number) => Promise<NexusLocationSearchResult[]>;
};

type ScopeSearchNode = {
  packet_id: string;
  name: string;
  short_label: string;
  locality_label: string;
  level: 'nation' | 'region' | 'city' | 'district';
  description: string;
  parent_packet_id: string | null;
};

function toScopeLevel(
  subtype: string | null | undefined
): ScopeSearchNode['level'] | null {
  if (subtype === 'nation') {
    return 'nation';
  }

  if (subtype === 'state' || subtype === 'region') {
    return 'region';
  }

  if (subtype === 'city') {
    return 'city';
  }

  if (subtype === 'district') {
    return 'district';
  }

  return null;
}

function buildScopePath(
  scopeNodeMap: Map<string, ScopeSearchNode>,
  packetId: string
): ScopeSearchNode[] {
  const path: ScopeSearchNode[] = [];
  let currentScope = scopeNodeMap.get(packetId) ?? null;

  while (currentScope) {
    path.unshift(currentScope);
    currentScope = currentScope.parent_packet_id
      ? (scopeNodeMap.get(currentScope.parent_packet_id) ?? null)
      : null;
  }

  return path;
}

function toDisclosureOptions(scopePath: ScopeSearchNode[]) {
  return scopePath.map((scopeNode) => ({
    scope: scopeNode.level,
    value: scopeNode.locality_label || scopeNode.name,
    label: scopeNode.level.toUpperCase(),
    description: scopeNode.name,
  })) as NexusLocationSearchResult['disclosure_options'];
}

async function listGraphLocationNodes(): Promise<ScopeSearchNode[]> {
  const services = await getNexusPacketServices();
  const elementPackets = await services.packetStore.listPreferredPacketsByFamily('Element');

  return elementPackets
    .filter(
      (packet): packet is PacketEnvelopeByType['Element'] =>
        packet.body.kind === 'assembly'
    )
    .map((packet) => {
      const level = toScopeLevel(packet.body.subtype);

      if (!level) {
        return null;
      }

      return {
        packet_id: packet.header.packet_id,
        name: packet.body.name,
        short_label: packet.body.locality_label ?? packet.body.name,
        locality_label: packet.body.locality_label ?? packet.body.name,
        level,
        description:
          packet.body.summary ?? `${packet.body.name} assembly locality`,
        parent_packet_id:
          packet.header.edges.find((edge) => edge.edge_type === 'parent_scope')?.target
            .packet_id ?? null,
      } satisfies ScopeSearchNode;
    })
    .filter((value): value is ScopeSearchNode => value !== null);
}

const graphLocationLookupProvider: NexusLocationLookupProvider = {
  async searchLocations(query: string, limit: number) {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.length < 2) {
      return [];
    }

    const scopeNodes = await listGraphLocationNodes();
    const scopeNodeMap = new Map(
      scopeNodes.map((scopeNode) => [scopeNode.packet_id, scopeNode])
    );

    return scopeNodes
      .map((scopeNode) => {
        const searchableFields = [
          scopeNode.name,
          scopeNode.short_label,
          scopeNode.locality_label,
          scopeNode.description,
          scopeNode.packet_id,
        ]
          .join(' ')
          .toLowerCase();

        if (!searchableFields.includes(normalizedQuery)) {
          return null;
        }

        const scopePath = buildScopePath(scopeNodeMap, scopeNode.packet_id);

        return {
          scope_id: scopeNode.packet_id,
          name: scopeNode.name,
          short_label: scopeNode.short_label,
          locality_label: scopeNode.locality_label,
          level: scopeNode.level,
          path_label: scopePath.map((pathScope) => pathScope.name).join(' / '),
          description: scopeNode.description,
          disclosure_options: toDisclosureOptions(scopePath),
        } satisfies NexusLocationSearchResult;
      })
      .filter((value): value is NexusLocationSearchResult => value !== null)
      .slice(0, limit);
  },
};

/**
 * Inputs: a location search query and optional result limit.
 * Output: canonical Nexus location matches from the current graph-backed provider.
 */
export function searchNexusLocations(
  query: string,
  limit = 8
): Promise<NexusLocationSearchResult[]> {
  return graphLocationLookupProvider.searchLocations(query, limit);
}
