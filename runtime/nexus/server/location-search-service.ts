/**
 * File: location-search-service.ts
 * Description: Provides graph-backed location lookup for Nexus identity disclosure flows.
 */

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type { NexusLocationSearchResult } from '@runtime/nexus/location-search';
import {
  createLocalityCanonicalNameKey,
  getLocalityFuzzySimilarity,
  getLocalitySearchMatchScore,
  normalizeLocalitySearchText,
  toLocalitySearchLevel,
  type LocalitySearchLevel,
} from '@runtime/nexus/location-search-normalization';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

type NexusLocationLookupProvider = {
  searchLocations: (query: string, limit: number) => Promise<NexusLocationSearchResult[]>;
};

type ScopeSearchNode = {
  packet_id: string;
  name: string;
  short_label: string;
  locality_label: string;
  level: LocalitySearchLevel;
  canonical_name_key: string;
  alias_keys: string[];
  display_aliases: string[];
  description: string;
  parent_packet_id: string | null;
};

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

function buildLocalityAliases(scopeNode: ScopeSearchNode): string[] {
  const aliases = new Set<string>([
    scopeNode.name,
    scopeNode.short_label,
    scopeNode.locality_label,
    scopeNode.description,
    scopeNode.packet_id,
    scopeNode.canonical_name_key,
    ...scopeNode.alias_keys,
    ...scopeNode.display_aliases,
  ]);
  const normalizedName = normalizeLocalitySearchText(scopeNode.name);
  const nameTokens = normalizedName.split(' ').filter(Boolean);

  if (nameTokens.length > 1) {
    aliases.add(nameTokens[0]);
    aliases.add(nameTokens.slice(0, 2).join(' '));
  }

  return Array.from(aliases);
}

function getLocationSearchMatch(input: {
  queryKey: string;
  scopeNode: ScopeSearchNode;
  scopePath: ScopeSearchNode[];
}): { score: number; matchType: NexusLocationSearchResult['match_type'] } | null {
  const ownAliases = buildLocalityAliases(input.scopeNode);
  const ownScore = getLocalitySearchMatchScore({
    query: input.queryKey,
    searchableValues: ownAliases,
  });

  if (ownScore !== null) {
    const normalizedAliases = ownAliases.map(normalizeLocalitySearchText);
    const matchType =
      input.scopeNode.canonical_name_key === input.queryKey
        ? 'exact'
        : normalizedAliases.includes(input.queryKey)
          ? 'alias'
          : 'fuzzy';

    return {
      score: ownScore,
      matchType,
    };
  }

  const pathScore = getLocalitySearchMatchScore({
    query: input.queryKey,
    searchableValues: input.scopePath.map((pathScope) => pathScope.name),
  });

  if (pathScore !== null) {
    return {
      score: pathScore + 4,
      matchType: 'path',
    };
  }

  const similarity = getLocalityFuzzySimilarity(input.queryKey, input.scopeNode.name);

  if (similarity >= 0.5) {
    return {
      score: 8 - similarity,
      matchType: 'fuzzy',
    };
  }

  return null;
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
      const level = packet.body.locality?.level ?? toLocalitySearchLevel(packet.body.subtype);

      if (!level) {
        return null;
      }

      const canonicalNameKey =
        packet.body.locality?.canonical_name_key ??
        createLocalityCanonicalNameKey(packet.body.locality_label ?? packet.body.name);

      return {
        packet_id: packet.header.packet_id,
        name: packet.body.name,
        short_label: packet.body.locality_label ?? packet.body.name,
        locality_label: packet.body.locality_label ?? packet.body.name,
        level,
        canonical_name_key: canonicalNameKey,
        alias_keys: packet.body.locality?.alias_keys ?? [],
        display_aliases: packet.body.locality?.display_aliases ?? [],
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
    const normalizedQuery = normalizeLocalitySearchText(query);

    if (normalizedQuery.length < 2) {
      return [];
    }

    const scopeNodes = await listGraphLocationNodes();
    const scopeNodeMap = new Map(
      scopeNodes.map((scopeNode) => [scopeNode.packet_id, scopeNode])
    );

    return scopeNodes
      .map((scopeNode) => {
        const scopePath = buildScopePath(scopeNodeMap, scopeNode.packet_id);
        const match = getLocationSearchMatch({
          queryKey: normalizedQuery,
          scopeNode,
          scopePath,
        });

        if (match === null) {
          return null;
        }
        const parentPath = scopePath.slice(0, -1);

        return {
          score: match.score,
          result: {
            scope_id: scopeNode.packet_id,
            name: scopeNode.name,
            short_label: scopeNode.short_label,
            locality_label: scopeNode.locality_label,
            level: scopeNode.level,
            path_label: scopePath.map((pathScope) => pathScope.name).join(' / '),
            parent_path_label:
              parentPath.length > 0
                ? parentPath.map((pathScope) => pathScope.name).join(' / ')
                : null,
            canonical_name_key: scopeNode.canonical_name_key,
            match_type: match.matchType,
            description: scopeNode.description,
            disclosure_options: toDisclosureOptions(scopePath),
          } satisfies NexusLocationSearchResult,
        };
      })
      .filter(
        (value): value is { score: number; result: NexusLocationSearchResult } =>
          value !== null
      )
      .sort((left, right) =>
        left.score === right.score
          ? left.result.path_label.localeCompare(right.result.path_label)
          : left.score - right.score
      )
      .map((value) => value.result)
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
