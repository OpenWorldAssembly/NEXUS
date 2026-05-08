/**
 * File: locality-directory-service.ts
 * Description: Creates canonical geographic locality Elements and resolves duplicate-safe locality directory entries.
 */

import { createHash } from 'node:crypto';

import {
  createAssemblyPacket,
  createPacketEdge,
  createPacketRef,
} from '@core/packets/builders';
import { getElementSubtypeLeaf, type LocalityLevel, type PacketEnvelopeByType, type PacketRef } from '@core/schema/packet-schema';
import type { NexusLocationSearchResult } from '@runtime/nexus/location-search';
import {
  createLocalityCanonicalNameKey,
  getLocalityFuzzySimilarity,
  normalizeLocalitySearchText,
  toLocalitySearchLevel,
} from '@runtime/nexus/location-search-normalization';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

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

const LOCALITY_LEVEL_ORDER: LocalityLevel[] = [
  'nation',
  'region',
  'city',
  'district',
];

function getParentPacketId(packet: PacketEnvelopeByType['Element']): string | null {
  return (
    packet.header.edges.find((edge) => edge.edge_type === 'parent_scope')?.target
      .packet_id ?? null
  );
}

function toLocalityNode(
  packet: PacketEnvelopeByType['Element']
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
    parent_packet_id: getParentPacketId(packet),
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

export async function planCanonicalLocalityPath(input: {
  actorPacketId: string;
  path: LocalityCreatePathEntry[];
  createAnyway?: boolean;
}): Promise<{
  created_packets: PacketEnvelopeByType['Element'][];
  final_result: NexusLocationSearchResult;
  duplicate_warnings: LocalityDuplicateWarning[];
}> {
  validatePathOrder(input.path);

  const services = await getNexusPacketServices();
  const elementPackets = (await services.packetStore.listPreferredPacketsByFamily(
    'Element'
  )) as PacketEnvelopeByType['Element'][];
  const globalAssemblyPacket = getGlobalAssemblyPacket(elementPackets);

  if (!globalAssemblyPacket) {
    throw new Error('Global assembly root is required before creating localities.');
  }

  const localityNodes = elementPackets
    .map(toLocalityNode)
    .filter((node): node is LocalityNode => node !== null);
  const nodeMap = new Map(localityNodes.map((node) => [node.packet_id, node]));
  const packetMap = new Map(elementPackets.map((packet) => [packet.header.packet_id, packet]));
  const parentByPacketId = new Map<string, string | null>(
    elementPackets.map((packet) => [packet.header.packet_id, getParentPacketId(packet)])
  );
  const createdPackets: PacketEnvelopeByType['Element'][] = [];
  const duplicateWarnings: LocalityDuplicateWarning[] = [];
  let parentPacketId: string = globalAssemblyPacket.header.packet_id;
  let finalNode: LocalityNode | null = null;

  for (const entry of input.path) {
    if (entry.existing_scope_id) {
      const existingPacket = packetMap.get(entry.existing_scope_id);
      const existingNode = existingPacket ? toLocalityNode(existingPacket) : null;

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
      edges: [createPacketEdge('parent_scope', parentPacketId)],
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

    createdPackets.push(packet);
    packetMap.set(packet.header.packet_id, packet);
    parentByPacketId.set(packet.header.packet_id, parentPacketId);

    const createdNode = toLocalityNode(packet);

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
    final_result: buildLocationResult({
      node: finalNode,
      nodeMap,
    }),
    duplicate_warnings: duplicateWarnings,
  };
}

export async function createCanonicalLocalityPath(input: {
  actorPacketId: string;
  path: LocalityCreatePathEntry[];
  createAnyway?: boolean;
}): Promise<{
  created_packets: PacketEnvelopeByType['Element'][];
  final_result: NexusLocationSearchResult;
  duplicate_warnings: LocalityDuplicateWarning[];
}> {
  const services = await getNexusPacketServices();
  const plannedResult = await planCanonicalLocalityPath(input);

  for (const packet of plannedResult.created_packets) {
    await services.packetStore.writeRevision(packet);
    await services.packetStore.publishRevision({
      packet_id: packet.header.packet_id,
      revision_id: packet.header.revision_id,
    });
  }

  return plannedResult;
}
