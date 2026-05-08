/**
 * File: locality-directory-service.ts
 * Description: Creates canonical geographic locality Elements and resolves duplicate-safe locality directory entries.
 */

import { createHash } from 'node:crypto';

import {
  createAssemblyPacket,
  createLocationPacket,
  createPacketEdge,
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
import type { NexusLocationSearchResult } from '@runtime/nexus/location-search';
import {
  createLocalityCanonicalNameKey,
  getLocalityFuzzySimilarity,
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
};

export type LocalityDuplicateWarning = {
  level: LocalityLevel;
  name: string;
  parent_packet_id: string;
  existing_scope_id: string;
  existing_name: string;
  message: string;
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
};

export type LocalityPathPlanResult = {
  created_packets: PacketEnvelope[];
  created_relation_packet_ids: string[];
  created_location_packet_ids: string[];
  final_result: NexusLocationSearchResult;
  duplicate_warnings: LocalityDuplicateWarning[];
};

const LOCALITY_LEVEL_ORDER: LocalityLevel[] = [
  'nation',
  'region',
  'city',
  'district',
];

function createParentScopeCompatibilityEdge(parentPacketId: string) {
  return createPacketEdge('parent_scope', {
    packet_id: parentPacketId,
  });
}

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
  parentByPacketId: Map<string, string | null>
): LocalityNode | null {
  if (packet.body.kind !== 'assembly') {
    return null;
  }

  const level = packet.body.locality?.level ?? toLocalitySearchLevel(packet.body.subtype);

  if (!level) {
    return null;
  }

  return {
    packet,
    packet_id: packet.header.packet_id,
    name: packet.body.name,
    level,
    canonical_name_key:
      packet.body.locality?.canonical_name_key ??
      createLocalityCanonicalNameKey(packet.body.locality_label ?? packet.body.name),
    alias_keys: packet.body.locality?.alias_keys ?? [],
    display_aliases: packet.body.locality?.display_aliases ?? [],
    parent_packet_id: parentByPacketId.get(packet.header.packet_id) ?? null,
  };
}

function getGlobalAssemblyPacket(
  elementPackets: PacketEnvelopeByType['Element'][]
): PacketEnvelopeByType['Element'] | null {
  return (
    elementPackets.find(
      (packet) =>
        packet.body.kind === 'assembly' &&
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
    match_type: 'exact',
    description:
      input.node.packet.body.summary ?? `${input.node.name} assembly locality`,
    disclosure_options: path.map((pathNode) => ({
      scope: pathNode.level,
      value: pathNode.packet.body.locality_label ?? pathNode.name,
      label: pathNode.level.toUpperCase(),
      description: pathNode.name,
    })),
  };
}

function validatePathOrder(path: LocalityCreatePathEntry[]) {
  if (path.length === 0) {
    throw new Error('Provide at least one locality path entry.');
  }

  path.forEach((entry, index) => {
    if (entry.level !== LOCALITY_LEVEL_ORDER[index]) {
      throw new Error('Locality creation expects a contiguous broad-to-narrow path starting at nation.');
    }

    if (!entry.name.trim() && !entry.existing_scope_id) {
      throw new Error('Every locality path entry needs a name or existing scope id.');
    }
  });
}

type LocalityPlannerInput = {
  actorPacketId: string;
  path: LocalityCreatePathEntry[];
  createAnyway?: boolean;
};

async function getPlannerPacketStore(): Promise<NodeSQLiteQueryServices['packetStore']> {
  const { getNexusPacketServices } = await import('@runtime/nexus/server/nexus-packet-services');
  const services = await getNexusPacketServices();

  return services.packetStore;
}

export async function planCanonicalLocalityPathWithPacketStore(input: LocalityPlannerInput & {
  packetStore: NodeSQLiteQueryServices['packetStore'];
}): Promise<LocalityPathPlanResult> {
  validatePathOrder(input.path);

  const [elementPackets, relationPackets] = await Promise.all([
    input.packetStore.listPreferredPacketsByFamily('Element') as Promise<
      PacketEnvelopeByType['Element'][]
    >,
    listRelationPackets(input.packetStore),
  ]);
  const globalAssemblyPacket = getGlobalAssemblyPacket(elementPackets);

  if (!globalAssemblyPacket) {
    throw new Error('Global assembly root is required before creating localities.');
  }

  const parentByPacketId = resolveParentByPacketId({
    elementPackets,
    relationPackets,
  });
  const localityNodes = elementPackets
    .map((packet) => toLocalityNode(packet, parentByPacketId))
    .filter((node): node is LocalityNode => node !== null);
  const nodeMap = new Map(localityNodes.map((node) => [node.packet_id, node]));
  const packetMap = new Map(elementPackets.map((packet) => [packet.header.packet_id, packet]));
  const createdPackets: PacketEnvelope[] = [];
  const createdRelationPacketIds: string[] = [];
  const createdLocationPacketIds: string[] = [];
  const duplicateWarnings: LocalityDuplicateWarning[] = [];
  let parentPacketId: string = globalAssemblyPacket.header.packet_id;
  let finalNode: LocalityNode | null = null;

  for (const entry of input.path) {
    if (entry.existing_scope_id) {
      const existingPacket = packetMap.get(entry.existing_scope_id);
      const existingNode = existingPacket
        ? toLocalityNode(existingPacket, parentByPacketId)
        : null;

      if (!existingPacket || !existingNode) {
        throw new Error(`Unknown existing locality scope: ${entry.existing_scope_id}`);
      }

      if (existingNode.level !== entry.level) {
        throw new Error(`${existingNode.name} is not a ${entry.level} locality.`);
      }

      if (existingNode.parent_packet_id !== parentPacketId) {
        throw new Error(`${existingNode.name} is not nested under the confirmed parent path.`);
      }

      parentPacketId = existingNode.packet_id;
      finalNode = existingNode;
      continue;
    }

    const canonicalNameKey = createLocalityCanonicalNameKey(entry.name);

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
      });
      parentPacketId = aliasNode.packet_id;
      finalNode = aliasNode;
      continue;
    }

    const fuzzyWarnings = findFuzzyWarnings({
      localityNodes,
      level: entry.level,
      parentPacketId,
      name: entry.name,
    });

    if (fuzzyWarnings.length > 0 && !input.createAnyway) {
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
      edges: [createParentScopeCompatibilityEdge(parentPacketId)],
      created_by: createPacketRef(input.actorPacketId),
      submitted_by: createPacketRef(input.actorPacketId),
      name: entry.name.trim(),
      subtype: getLocalitySubtype(entry.level),
      summary: `A ${entry.level} locality assembly for ${entry.name.trim()}.`,
      locality_label: entry.name.trim(),
      locality: {
        level: entry.level,
        canonical_name_key: canonicalNameKey,
        alias_keys: Array.from(
          new Set([
            canonicalNameKey,
            ...(entry.alias_keys ?? []).map(createLocalityCanonicalNameKey),
          ])
        ).filter(Boolean),
        display_aliases: entry.display_aliases ?? [],
      },
      tags: ['assembly', 'locality', entry.level],
      metadata_tags: ['assembly', 'locality', entry.level],
    });
    const parentRelationPacket = createScopedRelationPacket({
      subtype: 'default_ancestry_parent',
      subjectPacketId: packetId,
      targetPacketId: parentPacketId,
      scopePacketId: packetId,
      applicableScopeRefs: packet.header.applicable_scope_refs,
      createdByPacketId: input.actorPacketId,
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
      created_by: createPacketRef(input.actorPacketId),
      submitted_by: createPacketRef(input.actorPacketId),
      subtype: 'region',
      title: entry.name.trim(),
      summary: `Portable region definition for ${entry.name.trim()}.`,
      status: 'provisional',
      location_label: entry.name.trim(),
      spatial_payload: {
        canonical_name_key: canonicalNameKey,
        locality_level: entry.level,
        display_name: entry.name.trim(),
        alias_keys: Array.from(
          new Set([
            canonicalNameKey,
            ...(entry.alias_keys ?? []).map(createLocalityCanonicalNameKey),
          ])
        ).filter(Boolean),
      },
    });
    const locationRelationPacket = createScopedRelationPacket({
      subtype: 'defined_by_location',
      subjectPacketId: packetId,
      targetPacketId: locationPacketId,
      scopePacketId: packetId,
      applicableScopeRefs: packet.header.applicable_scope_refs,
      createdByPacketId: input.actorPacketId,
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

    const createdNode = toLocalityNode(packet, parentByPacketId);

    if (!createdNode) {
      throw new Error('Created locality packet could not be projected.');
    }

    localityNodes.push(createdNode);
    nodeMap.set(createdNode.packet_id, createdNode);
    parentPacketId = createdNode.packet_id;
    finalNode = createdNode;
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
