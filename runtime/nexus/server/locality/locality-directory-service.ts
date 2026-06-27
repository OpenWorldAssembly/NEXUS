/**
 * File: locality-directory-service.ts
 * Description: Creates canonical geographic locality Elements and resolves duplicate-safe locality directory entries.
 */

import { createHash } from 'node:crypto';

import {
  createAssemblyPacket,
  createLocationPacket,
  createPacketRef,
} from '@core/packets/builders';
import { createScopedRelationPacket } from '@core/packets/relations';
import {
  getElementSubtypeLeaf,
  type LocalityLevel,
  type PacketEnvelope,
  type PacketEnvelopeByType,
  type PacketRef,
} from '@core/schema/packet-schema';
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
  isUsefulLegacyAsciiAliasKey,
  normalizeLegacyAsciiLocalitySearchText,
  normalizeLocalitySearchText,
  toLocalitySearchLevel,
} from '@runtime/nexus/location-search-normalization';
import { listRelationPackets } from '@runtime/nexus/server/relation-utils';
import { getLegacyParentScopePacketIdCompatibility } from '@runtime/nexus/server/scope-graph-compatibility';
import { resolveScopeParentResolutions } from '@runtime/nexus/server/scope-parent-resolution';
import type { NodeSQLiteQueryServices } from '@runtime/storage/node-sqlite-query-services';

export type LocalityCreatePathEntry = {
  level: LocalityLevel;
  name: string;
  existing_scope_id?: string | null;
  alias_keys?: string[];
  display_aliases?: string[];
  scope_descriptor?: LocalityScopeDescriptor | null;
};

export type LocalityDuplicateWarning = {
  level: LocalityLevel;
  name: string;
  parent_packet_id: string;
  existing_scope_id: string;
  existing_name: string;
  message: string;
  existing_result: NexusLocationSearchResult;
};

export class LocalityDuplicateWarningError extends Error {
  readonly duplicateWarnings: LocalityDuplicateWarning[];

  constructor(duplicateWarnings: LocalityDuplicateWarning[]) {
    super('Similar localities already exist. Review the warnings before creating anyway.');
    this.duplicateWarnings = duplicateWarnings;
  }
}

type LocalityNode = {
  packet: PacketEnvelopeByType['Element'];
  packet_id: string;
  name: string;
  level: LocalityLevel;
  canonical_name_key: string;
  alias_keys: string[];
  display_aliases: string[];
  parent_packet_id: string | null;
  scope_descriptor: LocalityScopeDescriptor | null;
  manual_status: LocalityManualStatus | null;
};

export type LocalityPathPlanResult = {
  created_packets: PacketEnvelope[];
  created_relation_packet_ids: string[];
  created_location_packet_ids: string[];
  final_result: NexusLocationSearchResult;
  duplicate_warnings: LocalityDuplicateWarning[];
  resolved_path: LocalityResolvedPathEntry[];
};

export type LocalityResolvedPathEntry = {
  level: LocalityLevel;
  name: string;
  disposition: 'reuse_existing' | 'create_new';
  existing_result: NexusLocationSearchResult | null;
  planned_scope_packet_id: string | null;
  scope_descriptor: LocalityScopeDescriptor | null;
};

export type LocalityPathPreviewResult = {
  review_entries: LocalityResolvedPathEntry[];
  final_result: NexusLocationSearchResult;
  duplicate_warnings: LocalityDuplicateWarning[];
  planned_scope_packet_ids: string[];
  planned_relation_packet_ids: string[];
  planned_location_packet_ids: string[];
  suggested_home_scope_entries: {
    scope_id: string;
    name: string;
    level: LocalityLevel;
    path_label: string;
    checked_by_default: true;
  }[];
};

export type LocalityGraphPlanResult = {
  created_packets: PacketEnvelope[];
  created_relation_packet_ids: string[];
  created_location_packet_ids: string[];
  path_results: LocalityPathPlanResult[];
  final_result: NexusLocationSearchResult | null;
};

type ScopeLocationMetadata = {
  scope_descriptor: LocalityScopeDescriptor | null;
  manual_status: LocalityManualStatus | null;
};

const LOCALITY_LEVEL_RANK: Record<LocalityLevel, number> = {
  nation: 0,
  region: 1,
  city: 2,
  district: 3,
};

function createLocationPacketId(input: {
  scopePacketId: string;
  subtype: string;
}): string {
  return `nexus:location/${input.subtype}/${encodeURIComponent(input.scopePacketId)}`;
}

function resolveParentByPacketId(input: {
  elementPackets: PacketEnvelopeByType['Element'][];
  relationPackets: Awaited<ReturnType<typeof listRelationPackets>>;
}): Map<string, string | null> {
  const parentResolutions = resolveScopeParentResolutions({
    scopePackets: input.elementPackets,
    relationPackets: input.relationPackets,
    getCompatibilityParentPacketId: getLegacyParentScopePacketIdCompatibility,
  });

  return new Map(
    input.elementPackets.map((packet) => [
      packet.header.packet_id,
      parentResolutions.get(packet.header.packet_id)?.parentPacketId ?? null,
    ])
  );
}

function toLocalityNode(
  packet: PacketEnvelopeByType['Element'],
  parentByPacketId: Map<string, string | null>,
  scopeLocationMetadataByScopePacketId: Map<string, ScopeLocationMetadata>
): LocalityNode | null {
  if (packet.body.subtype !== 'assembly') {
    return null;
  }

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
    packet,
    packet_id: packet.header.packet_id,
    name: packet.body.name,
    level,
    canonical_name_key: canonicalNameKey,
    alias_keys: Array.from(aliasKeys).filter(Boolean),
    display_aliases: packet.body.locality?.display_aliases ?? [],
    parent_packet_id: parentByPacketId.get(packet.header.packet_id) ?? null,
    scope_descriptor:
      scopeLocationMetadata?.scope_descriptor ?? createFallbackLocalityScopeDescriptor(level),
    manual_status: scopeLocationMetadata?.manual_status ?? null,
  };
}

function getGlobalAssemblyPacket(
  elementPackets: PacketEnvelopeByType['Element'][]
): PacketEnvelopeByType['Element'] | null {
  return (
    elementPackets.find(
      (packet) =>
        packet.body.subtype === 'assembly' &&
        (getElementSubtypeLeaf(packet.body.subtype) === 'global' ||
          packet.header.packet_id === 'nexus:element/global-commons')
    ) ?? null
  );
}

function createLocalityPacketId(input: {
  parentPacketId: string;
  level: LocalityLevel;
  canonicalNameKey: string;
}): string {
  const slug = input.canonicalNameKey.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const digest = createHash('sha256')
    .update(`${input.parentPacketId}|${input.level}|${input.canonicalNameKey}`)
    .digest('hex')
    .slice(0, 10);

  return `nexus:element/locality-${input.level}-${slug || 'unnamed'}-${digest}`;
}

function getLocalitySubtype(level: LocalityLevel): string {
  return level;
}

function resolvePathEntryScopeDescriptor(
  entry: LocalityCreatePathEntry
): LocalityScopeDescriptor {
  const fallbackDescriptor = createFallbackLocalityScopeDescriptor(entry.level);

  if (!entry.scope_descriptor) {
    return fallbackDescriptor;
  }

  return {
    hierarchy_system: entry.scope_descriptor.hierarchy_system,
    local_type_label: entry.scope_descriptor.local_type_label,
    local_type_key: entry.scope_descriptor.local_type_key,
    legacy_level: entry.level,
  };
}

function createLocalityAliasKeys(input: {
  canonicalNameKey: string;
  legacyAsciiAliasKey: string;
  aliasKeys: string[];
}): string[] {
  const keys = new Set<string>([input.canonicalNameKey]);

  for (const aliasKey of input.aliasKeys.map(createLocalityCanonicalNameKey)) {
    if (aliasKey) {
      keys.add(aliasKey);
    }
  }

  if (
    input.legacyAsciiAliasKey &&
    input.legacyAsciiAliasKey !== input.canonicalNameKey &&
    isUsefulLegacyAsciiAliasKey(input.legacyAsciiAliasKey)
  ) {
    keys.add(input.legacyAsciiAliasKey);
  }

  return Array.from(keys).filter(Boolean);
}

function buildScopeLocationMetadataByScopePacketId(input: {
  locationPackets: PacketEnvelopeByType['Location'][];
  relationPackets: Awaited<ReturnType<typeof listRelationPackets>>;
}): Map<string, ScopeLocationMetadata> {
  const locationPacketById = new Map(
    input.locationPackets.map((packet) => [packet.header.packet_id, packet])
  );
  const metadataByScopePacketId = new Map<string, ScopeLocationMetadata>();

  for (const relationPacket of input.relationPackets) {
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

    metadataByScopePacketId.set(relationPacket.body.subject_ref.packet_id, {
      scope_descriptor: readLocalityScopeDescriptor(
        spatialPayload.scope_descriptor,
        payloadLegacyLevel
      ),
      manual_status: readLocalityManualStatus({
        spatialPayload,
        status: locationPacket.body.status,
      }),
    });
  }

  return metadataByScopePacketId;
}

function buildApplicableScopeRefs(input: {
  scopePacketId: string;
  parentPacketId: string | null;
  parentByPacketId: Map<string, string | null>;
}): PacketRef[] {
  const refs: PacketRef[] = [createPacketRef(input.scopePacketId)];
  let nextParentId = input.parentPacketId;

  while (nextParentId) {
    refs.push(createPacketRef(nextParentId));
    nextParentId = input.parentByPacketId.get(nextParentId) ?? null;
  }

  return refs;
}

function findExactLocality(input: {
  localityNodes: LocalityNode[];
  level: LocalityLevel;
  parentPacketId: string;
  canonicalNameKey: string;
}): LocalityNode | null {
  return (
    input.localityNodes.find(
      (node) =>
        node.level === input.level &&
        node.parent_packet_id === input.parentPacketId &&
        node.canonical_name_key === input.canonicalNameKey
    ) ?? null
  );
}

function findAliasCollision(input: {
  localityNodes: LocalityNode[];
  level: LocalityLevel;
  parentPacketId: string;
  canonicalNameKey: string;
}): LocalityNode | null {
  return (
    input.localityNodes.find(
      (node) =>
        node.level === input.level &&
        node.parent_packet_id === input.parentPacketId &&
        node.alias_keys.some(
          (aliasKey) => normalizeLocalitySearchText(aliasKey) === input.canonicalNameKey
        )
    ) ?? null
  );
}

function findFuzzyWarnings(input: {
  localityNodes: LocalityNode[];
  nodeMap: Map<string, LocalityNode>;
  level: LocalityLevel;
  parentPacketId: string;
  name: string;
}): LocalityDuplicateWarning[] {
  return input.localityNodes
    .filter(
      (node) =>
        node.level === input.level &&
        node.parent_packet_id === input.parentPacketId &&
        getLocalityFuzzySimilarity(input.name, node.name) >= 0.5
    )
    .map((node) => ({
      level: input.level,
      name: input.name,
      parent_packet_id: input.parentPacketId,
      existing_scope_id: node.packet_id,
      existing_name: node.name,
      message: `${node.name} already looks similar under the same parent path.`,
      existing_result: buildLocationResult({
        node,
        nodeMap: input.nodeMap,
      }),
    }));
}

function buildLocationResult(input: {
  node: LocalityNode;
  nodeMap: Map<string, LocalityNode>;
}): NexusLocationSearchResult {
  const path: LocalityNode[] = [];
  let currentNode: LocalityNode | null = input.node;

  while (currentNode) {
    path.unshift(currentNode);
    currentNode = currentNode.parent_packet_id
      ? input.nodeMap.get(currentNode.parent_packet_id) ?? null
      : null;
  }

  const parentPath = path.slice(0, -1);

  return {
    scope_id: input.node.packet_id,
    name: input.node.name,
    short_label: input.node.packet.body.locality_label ?? input.node.name,
    locality_label: input.node.packet.body.locality_label ?? input.node.name,
    level: input.node.level,
    path_label: path.map((pathNode) => pathNode.name).join(' / '),
    parent_path_label:
      parentPath.length > 0 ? parentPath.map((pathNode) => pathNode.name).join(' / ') : null,
    canonical_name_key: input.node.canonical_name_key,
    alias_keys: input.node.alias_keys,
    display_aliases: input.node.display_aliases,
    path_entries: path.map((pathNode) => ({
      scope_id: pathNode.packet_id,
      name: pathNode.name,
      level: pathNode.level,
      scope_type_label: pathNode.scope_descriptor?.local_type_label ?? null,
    })),
    match_type: 'exact',
    description:
      input.node.packet.body.summary ?? `${input.node.name} assembly locality`,
    disclosure_options: path.map((pathNode) => ({
      scope: pathNode.level,
      value: pathNode.packet.body.locality_label ?? pathNode.name,
      label: pathNode.level.toUpperCase(),
      description: pathNode.name,
    })),
    scope_descriptor: input.node.scope_descriptor,
    scope_type_label: input.node.scope_descriptor?.local_type_label ?? null,
    scope_type_key: input.node.scope_descriptor?.local_type_key ?? null,
    scope_hierarchy_system: input.node.scope_descriptor?.hierarchy_system ?? null,
    legacy_level: input.node.scope_descriptor?.legacy_level ?? input.node.level,
    manual_status: input.node.manual_status,
  };
}

function buildSuggestedHomeScopeEntries(
  resolvedPath: LocalityResolvedPathEntry[]
): LocalityPathPreviewResult['suggested_home_scope_entries'] {
  const pathNames: string[] = [];

  return resolvedPath.map((entry) => {
    pathNames.push(entry.name);

    return {
      scope_id:
        entry.existing_result?.scope_id ?? entry.planned_scope_packet_id ?? entry.name,
      name: entry.name,
      level: entry.level,
      path_label: pathNames.join(' / '),
      checked_by_default: true as const,
    };
  });
}

export function buildLocalityPathPreviewResult(
  plannedResult: LocalityPathPlanResult
): LocalityPathPreviewResult {
  return {
    review_entries: plannedResult.resolved_path,
    final_result: plannedResult.final_result,
    duplicate_warnings: plannedResult.duplicate_warnings,
    planned_scope_packet_ids: plannedResult.resolved_path
      .map((entry) => entry.planned_scope_packet_id)
      .filter((value): value is string => Boolean(value)),
    planned_relation_packet_ids: plannedResult.created_relation_packet_ids,
    planned_location_packet_ids: plannedResult.created_location_packet_ids,
    suggested_home_scope_entries: buildSuggestedHomeScopeEntries(
      plannedResult.resolved_path
    ),
  };
}

function validatePathOrder(path: LocalityCreatePathEntry[]) {
  if (path.length === 0) {
    throw new Error('Provide at least one locality path entry.');
  }

  path.forEach((entry) => {
    if (!entry.name.trim() && !entry.existing_scope_id) {
      throw new Error('Every locality path entry needs a name or existing scope id.');
    }
  });

  for (let index = 1; index < path.length; index += 1) {
    const previousEntry = path[index - 1];
    const currentEntry = path[index];

    if (
      LOCALITY_LEVEL_RANK[currentEntry.level] < LOCALITY_LEVEL_RANK[previousEntry.level]
    ) {
      throw new Error(
        'Locality path entries must stay broad-to-narrow across legacy compatibility buckets.'
      );
    }
  }
}

type LocalityPlannerInput = {
  actorPacketId?: string | null;
  path: LocalityCreatePathEntry[];
  createAnyway?: boolean;
  allowDuplicateWarnings?: boolean;
};

type LocalityGraphPlannerInput = {
  actorPacketId?: string | null;
  paths: LocalityCreatePathEntry[][];
  createAnyway?: boolean;
};

const LOCALITY_PREVIEW_ACTOR_PACKET_ID = 'nexus:element/locality-preview-actor';

async function getPlannerPacketStore(): Promise<NodeSQLiteQueryServices['packetStore']> {
  const { getNexusPacketServices } = await import('@runtime/nexus/server/nexus-packet-services');
  const services = await getNexusPacketServices();

  return services.packetStore;
}

function createPacketStoreOverlay(input: {
  packetStore: NodeSQLiteQueryServices['packetStore'];
  stagedPackets: PacketEnvelope[];
}): NodeSQLiteQueryServices['packetStore'] {
  const stagedPacketsByType = new Map<string, PacketEnvelope[]>();

  for (const packet of input.stagedPackets) {
    stagedPacketsByType.set(packet.header.type, [
      ...(stagedPacketsByType.get(packet.header.type) ?? []),
      packet,
    ]);
  }

  return {
    ...input.packetStore,
    async listPreferredPacketsByType(type) {
      const basePackets = await input.packetStore.listPreferredPacketsByType(type);
      const stagedPackets = stagedPacketsByType.get(type) ?? [];
      const packetById = new Map<string, PacketEnvelope>();

      [...(basePackets as PacketEnvelope[]), ...stagedPackets].forEach((packet) => {
        packetById.set(packet.header.packet_id, packet);
      });

      return Array.from(packetById.values()) as PacketEnvelopeByType[keyof PacketEnvelopeByType][];
    },
  } as NodeSQLiteQueryServices['packetStore'];
}

export async function planCanonicalLocalityPathWithPacketStore(input: LocalityPlannerInput & {
  packetStore: NodeSQLiteQueryServices['packetStore'];
}): Promise<LocalityPathPlanResult> {
  validatePathOrder(input.path);

  const [elementPackets, relationPackets, locationPackets] = await Promise.all([
    input.packetStore.listPreferredPacketsByType('Element') as Promise<
      PacketEnvelopeByType['Element'][]
    >,
    listRelationPackets(input.packetStore),
    input.packetStore.listPreferredPacketsByType('Location') as Promise<
      PacketEnvelopeByType['Location'][]
    >,
  ]);
  const globalAssemblyPacket = getGlobalAssemblyPacket(elementPackets);

  if (!globalAssemblyPacket) {
    throw new Error('Global assembly root is required before creating localities.');
  }

  const parentByPacketId = resolveParentByPacketId({
    elementPackets,
    relationPackets,
  });
  const scopeLocationMetadataByScopePacketId = buildScopeLocationMetadataByScopePacketId({
    locationPackets,
    relationPackets,
  });
  const localityNodes = elementPackets
    .map((packet) =>
      toLocalityNode(packet, parentByPacketId, scopeLocationMetadataByScopePacketId)
    )
    .filter((node): node is LocalityNode => node !== null);
  const nodeMap = new Map(localityNodes.map((node) => [node.packet_id, node]));
  const packetMap = new Map(elementPackets.map((packet) => [packet.header.packet_id, packet]));
  const createdPackets: PacketEnvelope[] = [];
  const createdRelationPacketIds: string[] = [];
  const createdLocationPacketIds: string[] = [];
  const duplicateWarnings: LocalityDuplicateWarning[] = [];
  const resolvedPath: LocalityResolvedPathEntry[] = [];
  let parentPacketId: string = globalAssemblyPacket.header.packet_id;
  let finalNode: LocalityNode | null = null;
  const actorPacketId = input.actorPacketId ?? LOCALITY_PREVIEW_ACTOR_PACKET_ID;

  for (const entry of input.path) {
    if (entry.existing_scope_id) {
      const existingPacket = packetMap.get(entry.existing_scope_id);
      const existingNode = existingPacket
        ? toLocalityNode(
            existingPacket,
            parentByPacketId,
            scopeLocationMetadataByScopePacketId
          )
        : null;

      if (!existingPacket || !existingNode) {
        throw new Error(`Unknown existing locality scope: ${entry.existing_scope_id}`);
      }

      if (existingNode.level !== entry.level) {
        throw new Error(`${existingNode.name} is not a ${entry.level} locality.`);
      }

      if (
        existingNode.parent_packet_id !== null &&
        existingNode.parent_packet_id !== parentPacketId
      ) {
        throw new Error(`${existingNode.name} is not nested under the confirmed parent path.`);
      }

      parentPacketId = existingNode.packet_id;
      finalNode = existingNode;
      resolvedPath.push({
        level: entry.level,
        name: existingNode.name,
        disposition: 'reuse_existing',
        existing_result: buildLocationResult({
          node: existingNode,
          nodeMap,
        }),
        planned_scope_packet_id: null,
        scope_descriptor: existingNode.scope_descriptor,
      });
      continue;
    }

    const canonicalNameKey = createLocalityCanonicalNameKey(entry.name);
    const legacyAsciiAliasKey = normalizeLegacyAsciiLocalitySearchText(entry.name);
    const scopeDescriptor = resolvePathEntryScopeDescriptor(entry);

    if (canonicalNameKey.length < 2) {
      throw new Error('Locality names need at least two searchable characters.');
    }

    const exactNode = findExactLocality({
      localityNodes,
      level: entry.level,
      parentPacketId,
      canonicalNameKey,
    });

    if (exactNode) {
      parentPacketId = exactNode.packet_id;
      finalNode = exactNode;
      resolvedPath.push({
        level: entry.level,
        name: exactNode.name,
        disposition: 'reuse_existing',
        existing_result: buildLocationResult({
          node: exactNode,
          nodeMap,
        }),
        planned_scope_packet_id: null,
        scope_descriptor: exactNode.scope_descriptor,
      });
      continue;
    }

    const aliasNode = findAliasCollision({
      localityNodes,
      level: entry.level,
      parentPacketId,
      canonicalNameKey,
    });

    if (aliasNode) {
      duplicateWarnings.push({
        level: entry.level,
        name: entry.name,
        parent_packet_id: parentPacketId,
        existing_scope_id: aliasNode.packet_id,
        existing_name: aliasNode.name,
        message: `${entry.name} matches an existing alias for ${aliasNode.name}; using the existing locality.`,
        existing_result: buildLocationResult({
          node: aliasNode,
          nodeMap,
        }),
      });
      parentPacketId = aliasNode.packet_id;
      finalNode = aliasNode;
      resolvedPath.push({
        level: entry.level,
        name: aliasNode.name,
        disposition: 'reuse_existing',
        existing_result: buildLocationResult({
          node: aliasNode,
          nodeMap,
        }),
        planned_scope_packet_id: null,
        scope_descriptor: aliasNode.scope_descriptor,
      });
      continue;
    }

    const fuzzyWarnings = findFuzzyWarnings({
      localityNodes,
      nodeMap,
      level: entry.level,
      parentPacketId,
      name: entry.name,
    });

    if (
      fuzzyWarnings.length > 0 &&
      !input.createAnyway &&
      !input.allowDuplicateWarnings
    ) {
      throw new LocalityDuplicateWarningError(fuzzyWarnings);
    }

    duplicateWarnings.push(...fuzzyWarnings);

    const packetId = createLocalityPacketId({
      parentPacketId,
      level: entry.level,
      canonicalNameKey,
    });
    const packet = createAssemblyPacket({
      packet_id: packetId,
      created_at: new Date().toISOString(),
      adapter: 'nexus-locality-directory',
      authority_scope_ref: createPacketRef(packetId),
      applicable_scope_refs: buildApplicableScopeRefs({
        scopePacketId: packetId,
        parentPacketId,
        parentByPacketId,
      }),
      created_by: createPacketRef(actorPacketId),
      submitted_by: createPacketRef(actorPacketId),
      name: entry.name.trim(),
      subtype: getLocalitySubtype(entry.level),
      summary: `A ${entry.level} locality assembly for ${entry.name.trim()}.`,
      scope_system: scopeDescriptor.hierarchy_system,
      locality_label: entry.name.trim(),
      locality: {
        level: entry.level,
        canonical_name_key: canonicalNameKey,
        alias_keys: createLocalityAliasKeys({
          canonicalNameKey,
          legacyAsciiAliasKey,
          aliasKeys: entry.alias_keys ?? [],
        }),
        display_aliases: entry.display_aliases ?? [],
      },
      tags: ['assembly', 'locality', entry.level, scopeDescriptor.local_type_key],
      metadata_tags: [
        'assembly',
        'locality',
        entry.level,
        scopeDescriptor.local_type_key,
      ],
    });
    const parentRelationPacket = createScopedRelationPacket({
      subtype: 'default_ancestry_parent',
      subjectPacketId: packetId,
      targetPacketId: parentPacketId,
      scopePacketId: packetId,
      applicableScopeRefs: packet.header.applicable_scope_refs,
      createdByPacketId: actorPacketId,
      status: 'active',
    });
    const locationPacketId = createLocationPacketId({
      scopePacketId: packetId,
      subtype: 'region',
    });
    const locationPacket = createLocationPacket({
      packet_id: locationPacketId,
      created_at: packet.header.created_at,
      adapter: 'nexus-locality-directory',
      authority_scope_ref: createPacketRef(packetId),
      applicable_scope_refs: packet.header.applicable_scope_refs,
      created_by: createPacketRef(actorPacketId),
      submitted_by: createPacketRef(actorPacketId),
      subtype: 'region',
      title: entry.name.trim(),
      summary: `Portable region definition for ${entry.name.trim()}.`,
      status: 'provisional',
      location_label: entry.name.trim(),
      spatial_payload: {
        canonical_name_key: canonicalNameKey,
        locality_level: entry.level,
        display_name: entry.name.trim(),
        alias_keys: createLocalityAliasKeys({
          canonicalNameKey,
          legacyAsciiAliasKey,
          aliasKeys: entry.alias_keys ?? [],
        }),
        scope_descriptor: scopeDescriptor,
        source: {
          kind: 'manual',
          subtype: 'manual',
        },
      },
    });
    const locationRelationPacket = createScopedRelationPacket({
      subtype: 'defined_by_location',
      subjectPacketId: packetId,
      targetPacketId: locationPacketId,
      scopePacketId: packetId,
      applicableScopeRefs: packet.header.applicable_scope_refs,
      createdByPacketId: actorPacketId,
      status: 'active',
    });

    createdPackets.push(
      packet,
      parentRelationPacket,
      locationPacket,
      locationRelationPacket
    );
    createdRelationPacketIds.push(
      parentRelationPacket.header.packet_id,
      locationRelationPacket.header.packet_id
    );
    createdLocationPacketIds.push(locationPacketId);
    packetMap.set(packet.header.packet_id, packet);
    parentByPacketId.set(packet.header.packet_id, parentPacketId);

    scopeLocationMetadataByScopePacketId.set(packet.header.packet_id, {
      scope_descriptor: scopeDescriptor,
      manual_status: 'manual',
    });
    const createdNode = toLocalityNode(
      packet,
      parentByPacketId,
      scopeLocationMetadataByScopePacketId
    );

    if (!createdNode) {
      throw new Error('Created locality packet could not be projected.');
    }

    localityNodes.push(createdNode);
    nodeMap.set(createdNode.packet_id, createdNode);
    parentPacketId = createdNode.packet_id;
    finalNode = createdNode;
    resolvedPath.push({
      level: entry.level,
      name: createdNode.name,
      disposition: 'create_new',
      existing_result: null,
      planned_scope_packet_id: createdNode.packet_id,
      scope_descriptor: scopeDescriptor,
    });
  }

  if (!finalNode) {
    throw new Error('Unable to resolve the final locality.');
  }

  return {
    created_packets: createdPackets,
    created_relation_packet_ids: createdRelationPacketIds,
    created_location_packet_ids: createdLocationPacketIds,
    final_result: buildLocationResult({
      node: finalNode,
      nodeMap,
    }),
    duplicate_warnings: duplicateWarnings,
    resolved_path: resolvedPath,
  };
}

export async function planCanonicalLocalityGraphWithPacketStore(input: LocalityGraphPlannerInput & {
  packetStore: NodeSQLiteQueryServices['packetStore'];
}): Promise<LocalityGraphPlanResult> {
  const pathResults: LocalityPathPlanResult[] = [];
  const stagedPackets: PacketEnvelope[] = [];

  for (const path of input.paths) {
    const pathResult = await planCanonicalLocalityPathWithPacketStore({
      actorPacketId: input.actorPacketId,
      path,
      createAnyway: input.createAnyway,
      packetStore: createPacketStoreOverlay({
        packetStore: input.packetStore,
        stagedPackets,
      }),
    });

    pathResults.push(pathResult);
    stagedPackets.push(...pathResult.created_packets);
  }

  return {
    created_packets: stagedPackets,
    created_relation_packet_ids: pathResults.flatMap(
      (pathResult) => pathResult.created_relation_packet_ids
    ),
    created_location_packet_ids: pathResults.flatMap(
      (pathResult) => pathResult.created_location_packet_ids
    ),
    path_results: pathResults,
    final_result: pathResults[0]?.final_result ?? null,
  };
}

export async function planCanonicalLocalityPath(
  input: LocalityPlannerInput
): Promise<LocalityPathPlanResult> {
  const packetStore = await getPlannerPacketStore();

  return planCanonicalLocalityPathWithPacketStore({
    ...input,
    packetStore,
  });
}

export async function previewCanonicalLocalityPath(
  input: LocalityPlannerInput
): Promise<LocalityPathPreviewResult> {
  const plannedResult = await planCanonicalLocalityPath({
    ...input,
    allowDuplicateWarnings: true,
  });

  return buildLocalityPathPreviewResult(plannedResult);
}

export async function createCanonicalLocalityPath(
  input: LocalityPlannerInput
): Promise<LocalityPathPlanResult> {
  const packetStore = await getPlannerPacketStore();
  const plannedResult = await planCanonicalLocalityPathWithPacketStore({
    ...input,
    packetStore,
  });

  for (const packet of plannedResult.created_packets) {
    await packetStore.writeRevision(packet);
    await packetStore.publishRevision({
      packet_id: packet.header.packet_id,
      revision_id: packet.header.revision_id,
    });
  }

  return plannedResult;
}
