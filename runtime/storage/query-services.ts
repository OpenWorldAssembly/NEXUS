/**
 * File: query-services.ts
 * Description: Implements browser and nexus query services over PacketStore and packet search rows.
 */

import type {
  BrowserPacketProjection,
  BrowserQueryService,
  NexusPacketCardProjection,
  NexusQueryService,
  NexusScopeLens,
  PacketStore,
  RevisionComparison,
} from '@core/contracts';
import {
  type PacketEnvelope,
  type PacketFamily,
  type PacketRef,
  type PacketRevisionRef,
} from '@core/schema/packet-schema';
import type { PacketSearchIndexRecord } from '@runtime/storage/sqlite-records';

interface PacketSearchReader {
  listSearchRows(): Promise<PacketSearchIndexRecord[]>;
}

const MECHANICAL_HEADER_FIELDS = new Set([
  'created_at',
  'producer',
  'integrity',
]);

/**
 * Inputs: packet + revision refs.
 * Output: browser projection card for packet browsing surfaces.
 */
function toBrowserProjection(
  packet: PacketEnvelope,
  revision: PacketRevisionRef
): BrowserPacketProjection {
  return {
    packet: {
      packet_id: packet.header.packet_id,
    },
    revision,
    family: packet.header.family,
    label: packet.header.metadata.summary ?? packet.header.family,
    title:
      'name' in packet.body && typeof packet.body.name === 'string'
        ? packet.body.name
        : 'title' in packet.body && typeof packet.body.title === 'string'
          ? packet.body.title
          : packet.header.packet_id,
    summary: packet.header.metadata.summary ?? null,
  };
}

/**
 * Inputs: one search-index row.
 * Output: normalized nexus card projection.
 */
function toNexusCardProjection(
  row: PacketSearchIndexRecord
): NexusPacketCardProjection {
  return {
    packet: {
      packet_id: row.packet_id,
    },
    revision: {
      packet_id: row.packet_id,
      revision_id: row.revision_id,
    },
    family: row.family as PacketFamily,
    label: row.label,
    title: row.title,
    summary: row.summary,
    status: row.status,
  };
}

/**
 * Inputs: serialized scope id array.
 * Output: scope ids parsed from search row JSON.
 */
function parseScopeIds(rawScopeIdsJson: string): string[] {
  try {
    const parsed = JSON.parse(rawScopeIdsJson) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

/**
 * Inputs: a packet-search row and active scope lens.
 * Output: whether the row is visible under that scope lens.
 */
function matchesScopeLens(
  row: Pick<
    PacketSearchIndexRecord,
    'authority_scope_packet_id' | 'applicable_scope_ids_json'
  >,
  lens: NexusScopeLens
): boolean {
  const lensScopeIds = new Set(
    [
      lens.authority_scope_ref?.packet_id ?? null,
      ...lens.applicable_scope_refs.map((scopeRef) => scopeRef.packet_id),
    ].filter((value): value is string => typeof value === 'string')
  );

  if (lensScopeIds.size === 0) {
    return true;
  }

  if (
    row.authority_scope_packet_id &&
    lensScopeIds.has(row.authority_scope_packet_id)
  ) {
    return true;
  }

  const applicableScopeIds = parseScopeIds(row.applicable_scope_ids_json);

  return applicableScopeIds.some((scopeId) => lensScopeIds.has(scopeId));
}

function collectChangedPaths(
  leftValue: unknown,
  rightValue: unknown,
  prefix = ''
): string[] {
  if (Object.is(leftValue, rightValue)) {
    return [];
  }

  const leftIsArray = Array.isArray(leftValue);
  const rightIsArray = Array.isArray(rightValue);

  if (leftIsArray || rightIsArray) {
    return JSON.stringify(leftValue) === JSON.stringify(rightValue) ? [] : [prefix];
  }

  if (
    leftValue === null ||
    rightValue === null ||
    typeof leftValue !== 'object' ||
    typeof rightValue !== 'object'
  ) {
    return [prefix];
  }

  const leftObject = leftValue as Record<string, unknown>;
  const rightObject = rightValue as Record<string, unknown>;
  const keys = new Set([
    ...Object.keys(leftObject),
    ...Object.keys(rightObject),
  ]);
  const changedPaths: string[] = [];

  for (const key of keys) {
    const nextPrefix = prefix.length > 0 ? `${prefix}.${key}` : key;

    changedPaths.push(
      ...collectChangedPaths(leftObject[key], rightObject[key], nextPrefix)
    );
  }

  return changedPaths;
}

/**
 * Inputs: packet store plus two revision refs.
 * Output: normalized revision-comparison object for browser diff views.
 */
async function comparePacketsByRevision(
  packetStore: PacketStore,
  base: PacketRevisionRef,
  head: PacketRevisionRef
): Promise<RevisionComparison> {
  const basePacket = await packetStore.fetchByRevision(base);
  const headPacket = await packetStore.fetchByRevision(head);

  if (!basePacket || !headPacket) {
    throw new Error(
      `Cannot compare revisions because one or both revisions are missing: ${base.revision_id} and ${head.revision_id}.`
    );
  }

  return {
    base,
    head,
    changed_header_fields: collectChangedPaths(basePacket.header, headPacket.header)
      .filter((fieldPath) => fieldPath.length > 0)
      .filter((fieldPath) => {
        const rootField = fieldPath.split('.')[0];

        return !MECHANICAL_HEADER_FIELDS.has(rootField);
      }),
    changed_body_fields: collectChangedPaths(basePacket.body, headPacket.body).filter(
      (fieldPath) => fieldPath.length > 0
    ),
  };
}

/**
 * Inputs: a packet store.
 * Output: a browser query service for packet-level lookup, link traversal, and revision comparison.
 */
export class PacketStoreBrowserQueryService implements BrowserQueryService {
  constructor(private readonly packetStore: PacketStore) {}

  async getPacket(packet: PacketRef): Promise<BrowserPacketProjection | null> {
    const preferredRevision = await this.packetStore.fetchPreferredRevision(packet);
    const preferredPacket = await this.packetStore.fetchByPacket(packet);

    if (!preferredRevision || !preferredPacket) {
      return null;
    }

    return toBrowserProjection(preferredPacket, preferredRevision);
  }

  async getRevisionHeads(packet: PacketRef) {
    return this.packetStore.fetchRevisionHeads(packet);
  }

  async listIncomingLinks(packet: PacketRef) {
    return this.packetStore.queryEdges(packet, { direction: 'incoming' });
  }

  async listOutgoingLinks(packet: PacketRef) {
    return this.packetStore.queryEdges(packet, { direction: 'outgoing' });
  }

  async compareRevisions(
    base: PacketRevisionRef,
    head: PacketRevisionRef
  ): Promise<RevisionComparison> {
    return comparePacketsByRevision(this.packetStore, base, head);
  }
}

/**
 * Inputs: a packet store and packet-search row reader.
 * Output: a nexus query service for scope-lens projections across dashboard, votes, discussions, and library.
 */
export class PacketStoreNexusQueryService implements NexusQueryService {
  constructor(private readonly searchReader: PacketSearchReader) {}

  private async listCardsByFamilies(
    lens: NexusScopeLens,
    families: PacketFamily[]
  ): Promise<NexusPacketCardProjection[]> {
    const familySet = new Set(families);
    const rows = await this.searchReader.listSearchRows();

    return rows
      .filter((row) => familySet.has(row.family as PacketFamily))
      .filter((row) => matchesScopeLens(row, lens))
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map(toNexusCardProjection);
  }

  async getDashboardQueue(
    lens: NexusScopeLens
  ): Promise<NexusPacketCardProjection[]> {
    const rows = await this.searchReader.listSearchRows();

    return rows
      .filter((row) => matchesScopeLens(row, lens))
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .slice(0, 12)
      .map(toNexusCardProjection);
  }

  async listVotes(lens: NexusScopeLens): Promise<NexusPacketCardProjection[]> {
    return this.listCardsByFamilies(lens, ['Proposal', 'Vote', 'Decision']);
  }

  async listDiscussions(
    lens: NexusScopeLens
  ): Promise<NexusPacketCardProjection[]> {
    return this.listCardsByFamilies(lens, [
      'DiscussionForum',
      'DiscussionThread',
      'DiscussionPost',
      'DiscussionReply',
    ]);
  }

  async listLibraryPackets(
    lens: NexusScopeLens,
    family?: PacketFamily
  ): Promise<NexusPacketCardProjection[]> {
    const rows = await this.searchReader.listSearchRows();

    return rows
      .filter((row) => (family ? row.family === family : true))
      .filter((row) => matchesScopeLens(row, lens))
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map(toNexusCardProjection);
  }
}
