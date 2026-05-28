/**
 * File: location-search-service.ts
 * Description: Provides graph-backed location lookup for Nexus identity disclosure flows.
 */

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import {
  createFallbackLocalityScopeDescriptor,
  isLegacyLocalityLevel,
  readLocalityManualStatus,
  readLocalityScopeDescriptor,
  type LocalityManualStatus,
  type LocalityScopeDescriptor,
  type NexusLocationSearchResult,
} from '@runtime/nexus/location-search';
import {
  createLocalityCanonicalNameKey,
  getLocalityFuzzySimilarity,
  getLocalitySearchMatchScore,
  isUsefulLegacyAsciiAliasKey,
  matchesLocalitySearchScopeFilter,
  normalizeLegacyAsciiLocalitySearchText,
  normalizeLocalitySearchText,
  toLocalitySearchLevel,
  type LocalitySearchLevel,
} from '@runtime/nexus/location-search-normalization';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';
import { listRelationPackets } from '@runtime/nexus/server/relation-utils';
import { getLegacyParentScopePacketIdCompatibility } from '@runtime/nexus/server/scope-graph-compatibility';
import { resolveScopeParentResolutions } from '@runtime/nexus/server/scope-parent-resolution';

type NexusLocationLookupProvider = {
  searchLocations: (
    input: NexusLocationSearchOptions
  ) => Promise<NexusLocationSearchResult[]>;
};

export type NexusLocationSearchOptions = {
  query: string;
  limit?: number;
  level?: LocalitySearchLevel | null;
  parentScopeId?: string | null;
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
  scope_descriptor: LocalityScopeDescriptor | null;
  manual_status: LocalityManualStatus | null;
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

function toSearchPathEntries(
  scopePath: ScopeSearchNode[]
): NonNullable<NexusLocationSearchResult['path_entries']> {
  return scopePath.map((scopeNode) => ({
    scope_id: scopeNode.packet_id,
    name: scopeNode.name,
    level: scopeNode.level,
    scope_type_label: scopeNode.scope_descriptor?.local_type_label ?? null,
  }));
}

function buildSearchResult(input: {
  scopeNode: ScopeSearchNode;
  scopePath: ScopeSearchNode[];
  matchType: NexusLocationSearchResult['match_type'];
}): NexusLocationSearchResult {
  const parentPath = input.scopePath.slice(0, -1);

  return {
    scope_id: input.scopeNode.packet_id,
    name: input.scopeNode.name,
    short_label: input.scopeNode.short_label,
    locality_label: input.scopeNode.locality_label,
    level: input.scopeNode.level,
    path_label: input.scopePath.map((pathScope) => pathScope.name).join(' / '),
    parent_path_label:
      parentPath.length > 0
        ? parentPath.map((pathScope) => pathScope.name).join(' / ')
        : null,
    canonical_name_key: input.scopeNode.canonical_name_key,
    alias_keys: input.scopeNode.alias_keys,
    display_aliases: input.scopeNode.display_aliases,
    path_entries: toSearchPathEntries(input.scopePath),
    match_type: input.matchType,
    description: input.scopeNode.description,
    disclosure_options: toDisclosureOptions(input.scopePath),
    scope_descriptor: input.scopeNode.scope_descriptor,
    scope_type_label: input.scopeNode.scope_descriptor?.local_type_label ?? null,
    scope_type_key: input.scopeNode.scope_descriptor?.local_type_key ?? null,
    scope_hierarchy_system:
      input.scopeNode.scope_descriptor?.hierarchy_system ?? null,
    legacy_level: input.scopeNode.scope_descriptor?.legacy_level ?? input.scopeNode.level,
    manual_status: input.scopeNode.manual_status,
  };
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
  const [elementPackets, relationPackets, locationPackets] = await Promise.all([
    services.packetStore.listPreferredPacketsByType('Element') as Promise<
      PacketEnvelopeByType['Element'][]
    >,
    listRelationPackets(services.packetStore),
    services.packetStore.listPreferredPacketsByType('Location') as Promise<
      PacketEnvelopeByType['Location'][]
    >,
  ]);
  const parentResolutions = resolveScopeParentResolutions({
    scopePackets: elementPackets,
    relationPackets,
    getCompatibilityParentPacketId: getLegacyParentScopePacketIdCompatibility,
  });
  const locationPacketById = new Map(
    locationPackets.map((packet) => [packet.header.packet_id, packet])
  );
  const scopeLocationMetadataByScopePacketId = new Map<
    string,
    {
      scopeDescriptor: LocalityScopeDescriptor | null;
      manualStatus: LocalityManualStatus | null;
    }
  >();

  for (const relationPacket of relationPackets) {
    if (
      relationPacket.body.subtype !== 'defined_by_location' ||
      relationPacket.body.status !== 'active'
    ) {
      continue;
    }

    const locationPacket = locationPacketById.get(
      relationPacket.body.target_ref.packet_id
    );

    if (!locationPacket) {
      continue;
    }

    const spatialPayload = locationPacket.body.spatial_payload;
    const payloadLegacyLevel = isLegacyLocalityLevel(spatialPayload.locality_level)
      ? spatialPayload.locality_level
      : null;

    scopeLocationMetadataByScopePacketId.set(relationPacket.body.subject_ref.packet_id, {
      scopeDescriptor: readLocalityScopeDescriptor(
        spatialPayload.scope_descriptor,
        payloadLegacyLevel
      ),
      manualStatus: readLocalityManualStatus({
        spatialPayload,
        status: locationPacket.body.status,
      }),
    });
  }

  return elementPackets
    .filter(
      (packet): packet is PacketEnvelopeByType['Element'] =>
        packet.body.subtype === 'assembly'
    )
    .map((packet): ScopeSearchNode | null => {
      const level = packet.body.locality?.level ?? toLocalitySearchLevel(packet.body.subtype);

      if (!level) {
        return null;
      }

      const displayName = packet.body.locality_label ?? packet.body.name;
      const canonicalNameKey = createLocalityCanonicalNameKey(displayName);
      const storedCanonicalNameKey = packet.body.locality?.canonical_name_key ?? null;
      const aliasKeys = new Set<string>(
        (packet.body.locality?.alias_keys ?? []).map(createLocalityCanonicalNameKey)
      );
      const legacyAsciiAliasKey = normalizeLegacyAsciiLocalitySearchText(displayName);
      const scopeLocationMetadata =
        scopeLocationMetadataByScopePacketId.get(packet.header.packet_id) ?? null;

      if (storedCanonicalNameKey && storedCanonicalNameKey !== canonicalNameKey) {
        aliasKeys.add(storedCanonicalNameKey);
      }

      if (
        legacyAsciiAliasKey &&
        legacyAsciiAliasKey !== canonicalNameKey &&
        isUsefulLegacyAsciiAliasKey(legacyAsciiAliasKey)
      ) {
        aliasKeys.add(legacyAsciiAliasKey);
      }

      return {
        packet_id: packet.header.packet_id,
        name: packet.body.name,
        short_label: packet.body.locality_label ?? packet.body.name,
        locality_label: packet.body.locality_label ?? packet.body.name,
        level,
        canonical_name_key: canonicalNameKey,
        alias_keys: Array.from(aliasKeys).filter(Boolean),
        display_aliases: packet.body.locality?.display_aliases ?? [],
        description:
          packet.body.summary ?? `${packet.body.name} assembly locality`,
        parent_packet_id:
          parentResolutions.get(packet.header.packet_id)?.parentPacketId ?? null,
        scope_descriptor:
          scopeLocationMetadata?.scopeDescriptor ??
          createFallbackLocalityScopeDescriptor(level),
        manual_status: scopeLocationMetadata?.manualStatus ?? null,
      } satisfies ScopeSearchNode;
    })
    .filter((value): value is ScopeSearchNode => value !== null);
}

const graphLocationLookupProvider: NexusLocationLookupProvider = {
  async searchLocations(input: NexusLocationSearchOptions) {
    const normalizedQuery = normalizeLocalitySearchText(input.query);
    const limit = input.limit ?? 8;

    if (normalizedQuery.length < 2) {
      return [];
    }

    const scopeNodes = await listGraphLocationNodes();
    const scopeNodeMap = new Map(
      scopeNodes.map((scopeNode) => [scopeNode.packet_id, scopeNode])
    );

    return scopeNodes
      .filter((scopeNode) =>
        matchesLocalitySearchScopeFilter(scopeNode, {
          level: input.level ?? null,
          parentScopeId: input.parentScopeId ?? null,
        })
      )
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
        return {
          score: match.score,
          result: buildSearchResult({
            scopeNode,
            scopePath,
            matchType: match.matchType,
          }),
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
 * Inputs: a location search query with optional level/parent scoping.
 * Output: canonical Nexus location matches from the current graph-backed provider.
 */
export function searchNexusLocations(
  input: string | NexusLocationSearchOptions,
  limit = 8
): Promise<NexusLocationSearchResult[]> {
  if (typeof input === 'string') {
    return graphLocationLookupProvider.searchLocations({ query: input, limit });
  }

  return graphLocationLookupProvider.searchLocations({
    ...input,
    limit: input.limit ?? limit,
  });
}

export async function listNexusLocationChildren(input: {
  parentScopeId: string;
  limit?: number;
}): Promise<NexusLocationSearchResult[]> {
  const scopeNodes = await listGraphLocationNodes();
  const scopeNodeMap = new Map(
    scopeNodes.map((scopeNode) => [scopeNode.packet_id, scopeNode])
  );
  const limit = input.limit ?? 50;

  return scopeNodes
    .filter((scopeNode) => scopeNode.parent_packet_id === input.parentScopeId)
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    )
    .slice(0, limit)
    .map((scopeNode) =>
      buildSearchResult({
        scopeNode,
        scopePath: buildScopePath(scopeNodeMap, scopeNode.packet_id),
        matchType: 'path',
      })
    );
}
