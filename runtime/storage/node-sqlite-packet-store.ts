/**
 * File: node-sqlite-packet-store.ts
 * Description: Implements the canonical PacketStore contract with a Node SQLite database.
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type {
  PacketEdgeQuery,
  PacketHeadStatus,
  PacketReadValue,
  PacketStore,
} from '@core/contracts';
import {
  inspectPacketEnvelope,
  parsePacketEnvelope,
  parseRawPacketEnvelopeInput,
  preparePacketEnvelopeForAdaptedWrite,
  type PacketEdge,
  type PacketEnvelope,
  type PacketEnvelopeByType,
  type PacketFamily,
  type PacketReadMode,
  type PacketMergeStrategy,
  type PacketRef,
  type PacketRevisionRef,
} from '@core/schema/packet-schema';
import { PACKET_STORE_SCHEMA_SQL } from '@runtime/storage/packet-store-schema';
import {
  projectPacketEdgeRecords,
  projectPacketRecord,
  projectPacketRevisionRecord,
  projectPacketSearchIndexRecord,
  type PacketSearchIndexRecord,
} from '@runtime/storage/sqlite-records';
import { NODE_PACKET_STORE_DATABASE_PATH } from '@runtime/storage/node-runtime-paths';

interface PacketRow {
  packet_id: string;
  family: string;
  preferred_revision_id: string | null;
  head_revision_ids_json: string;
  revision_state: PacketHeadStatus['revision_state'];
  schema_version: string;
  created_at: string;
  updated_at: string;
  authority_scope_packet_id: string | null;
  preferred_revision_json: string | null;
}

interface PacketRevisionRow {
  revision_id: string;
  packet_id: string;
  family: string;
  created_at: string;
  revision_json: string;
}

interface PacketEdgeRow {
  source_revision_id: string;
  source_packet_id: string;
  edge_type: string;
  target_packet_id: string;
  metadata_json: string;
}

interface StoredPacketJsonOverrides {
  revision_json: string;
  header_json: string;
  body_json: string;
  preferred_revision_json: string;
}

/**
 * Inputs: a serialized JSON string and a fallback value.
 * Output: parsed JSON when valid, otherwise the fallback.
 */
function parseJson<TValue>(input: string | null, fallback: TValue): TValue {
  if (!input) {
    return fallback;
  }

  try {
    return JSON.parse(input) as TValue;
  } catch {
    return fallback;
  }
}

/**
 * Inputs: a canonical packet envelope.
 * Output: the revision ref tuple for that packet revision.
 */
function toRevisionRef(packet: PacketEnvelope): PacketRevisionRef {
  return {
    packet_id: packet.header.packet_id,
    revision_id: packet.header.revision_id,
  };
}

/**
 * Inputs: two string sets.
 * Output: whether both sets contain the exact same members.
 */
function hasSameMembers(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

/**
 * Inputs: next head revision ids and parent count from the candidate revision.
 * Output: the packet revision-state marker.
 */
function getRevisionState(
  nextHeadRevisionIds: string[],
  parentRevisionCount: number
): PacketHeadStatus['revision_state'] {
  if (nextHeadRevisionIds.length > 1) {
    return 'diverged';
  }

  if (parentRevisionCount > 1) {
    return 'merged';
  }

  return 'linear';
}

/**
 * Inputs: one outgoing edge row.
 * Output: a PacketEdge object targeted from source packet to target packet.
 */
function toOutgoingEdge(row: PacketEdgeRow): PacketEdge {
  return {
    edge_type: row.edge_type,
    target: {
      packet_id: row.target_packet_id,
    },
    metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
  };
}

/**
 * Inputs: one incoming edge row.
 * Output: a PacketEdge object with source metadata preserved for incoming traversal.
 */
function toIncomingEdge(row: PacketEdgeRow): PacketEdge {
  const metadata = parseJson<Record<string, unknown>>(row.metadata_json, {});

  return {
    edge_type: row.edge_type,
    target: {
      packet_id: row.source_packet_id,
    },
    metadata: {
      ...metadata,
      direction: 'incoming',
      source_packet_id: row.source_packet_id,
      source_revision_id: row.source_revision_id,
    },
  };
}

/**
 * Inputs: a bundle payload in string or byte form.
 * Output: a UTF-8 JSON string ready for parse.
 */
function decodeBundleToText(bundle: Uint8Array | ArrayBuffer | string): string {
  if (typeof bundle === 'string') {
    return bundle;
  }

  if (bundle instanceof Uint8Array) {
    return new TextDecoder().decode(bundle);
  }

  return new TextDecoder().decode(new Uint8Array(bundle));
}

/**
 * Inputs: an object record.
 * Output: a named-parameter map compatible with node:sqlite statement `.run`.
 */
function toNamedParameters(
  record: Record<string, unknown>
): Record<string, SQLInputValue> {
  return record as unknown as Record<string, SQLInputValue>;
}

/**
 * Inputs: optional Node packet-store configuration.
 * Output: a PacketStore backed by SQLite at the configured local file path.
 */
export class NodeSQLitePacketStore implements PacketStore {
  private readonly database: DatabaseSync;
  readonly databasePath: string;

  constructor(
    private readonly options: {
      databasePath?: string;
    } = {}
  ) {
    const databasePath = options.databasePath ?? NODE_PACKET_STORE_DATABASE_PATH;

    this.databasePath = databasePath;
    mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec(PACKET_STORE_SCHEMA_SQL);
  }

  /**
   * Inputs: an unknown packet-like payload.
   * Output: the validated canonical packet envelope.
   */
  validate(input: unknown): PacketEnvelope {
    return parsePacketEnvelope(input);
  }

  /**
   * Inputs: a canonical packet envelope.
   * Output: writes an immutable revision and updates packet-head and search rows.
   */
  async writeRevision(packetInput: PacketEnvelope): Promise<PacketRevisionRef> {
    const packet = this.validate(packetInput);
    return this.writeValidatedRevision(packet);
  }

  private async writeValidatedRevision(
    packet: PacketEnvelope,
    storedPacketJsonOverrides: StoredPacketJsonOverrides | null = null
  ): Promise<PacketRevisionRef> {
    const revisionRecord = projectPacketRevisionRecord(packet, {
      revision_json: storedPacketJsonOverrides?.revision_json,
      header_json: storedPacketJsonOverrides?.header_json,
      body_json: storedPacketJsonOverrides?.body_json,
    });
    const packetRecordInsert = this.getPacketRow(packet.header.packet_id);
    let hasPacketRow = packetRecordInsert !== null;
    const parentRevisionIds = packet.header.parent_revision_refs.map(
      (parentRef) => parentRef.revision_id
    );

    if (packetRecordInsert && packetRecordInsert.family !== packet.header.family) {
      throw new Error(
        `Packet family mismatch for ${packet.header.packet_id}: expected ${packetRecordInsert.family}, received ${packet.header.family}.`
      );
    }

    if (packetRecordInsert === null && parentRevisionIds.length > 0) {
      throw new Error(
        `Cannot write revision ${packet.header.revision_id} before seeding packet ${packet.header.packet_id}.`
      );
    }

    this.database.exec('BEGIN IMMEDIATE');

    try {
      const existingRevision = this.database
        .prepare(
          `
            SELECT revision_id
            FROM packet_revisions
            WHERE revision_id = ?
              AND packet_id = ?
          `
        )
        .get(packet.header.revision_id, packet.header.packet_id) as
        | { revision_id: string }
        | undefined;

      if (existingRevision) {
        throw new Error(
          `Revision ${packet.header.revision_id} already exists for ${packet.header.packet_id}.`
        );
      }

      if (parentRevisionIds.length > 0) {
        const placeholders = parentRevisionIds.map(() => '?').join(', ');
        const parentCountRow = this.database
          .prepare(
            `
              SELECT COUNT(*) AS count
              FROM packet_revisions
              WHERE packet_id = ?
                AND revision_id IN (${placeholders})
            `
          )
          .get(packet.header.packet_id, ...parentRevisionIds) as { count: number };

        if (parentCountRow.count !== parentRevisionIds.length) {
          throw new Error(
            `Missing parent revision(s) for ${packet.header.packet_id} while writing ${packet.header.revision_id}.`
          );
        }
      }

      if (!hasPacketRow) {
        const initialPacketRecord = projectPacketRecord(packet, {
          preferred_revision_id: null,
          head_revision_ids: [],
          revision_state: 'linear',
          preferred_revision_json: null,
        });

        this.database
          .prepare(
            `
              INSERT INTO packets (
                packet_id,
                family,
                preferred_revision_id,
                head_revision_ids_json,
                revision_state,
                schema_version,
                created_at,
                updated_at,
                authority_scope_packet_id,
                preferred_revision_json
              ) VALUES (
                @packet_id,
                @family,
                @preferred_revision_id,
                @head_revision_ids_json,
                @revision_state,
                @schema_version,
                @created_at,
                @updated_at,
                @authority_scope_packet_id,
                @preferred_revision_json
              )
            `
          )
          .run(
            toNamedParameters(
              initialPacketRecord as unknown as Record<string, unknown>
            )
          );
        hasPacketRow = true;
      }

      this.database
        .prepare(
          `
            INSERT INTO packet_revisions (
              revision_id,
              packet_id,
              family,
              schema_version,
              protocol_version,
              parent_revision_refs_json,
              merge_strategy,
              created_at,
              authority_scope_packet_id,
              applicable_scope_refs_json,
              edges_json,
              provenance_json,
              integrity_json,
              moderation_json,
              external_refs_json,
              metadata_json,
              producer_json,
              header_json,
              body_json,
              revision_json
            ) VALUES (
              @revision_id,
              @packet_id,
              @family,
              @schema_version,
              @protocol_version,
              @parent_revision_refs_json,
              @merge_strategy,
              @created_at,
              @authority_scope_packet_id,
              @applicable_scope_refs_json,
              @edges_json,
              @provenance_json,
              @integrity_json,
              @moderation_json,
              @external_refs_json,
              @metadata_json,
              @producer_json,
              @header_json,
              @body_json,
              @revision_json
            )
          `
        )
        .run(toNamedParameters(revisionRecord as unknown as Record<string, unknown>));

      const edgeRecords = projectPacketEdgeRecords(packet);

      for (const edgeRecord of edgeRecords) {
        this.database
          .prepare(
            `
              INSERT INTO packet_edges (
                source_revision_id,
                source_packet_id,
                source_family,
                edge_type,
                target_packet_id,
                created_at,
                metadata_json
              ) VALUES (
                @source_revision_id,
                @source_packet_id,
                @source_family,
                @edge_type,
                @target_packet_id,
                @created_at,
                @metadata_json
              )
            `
          )
          .run(toNamedParameters(edgeRecord as unknown as Record<string, unknown>));
      }

      const currentHeadRevisionIds = parseJson<string[]>(
        packetRecordInsert?.head_revision_ids_json ?? null,
        []
      );
      const nextHeadRevisionIds = Array.from(
        new Set([
          ...currentHeadRevisionIds.filter(
            (revisionId) => !parentRevisionIds.includes(revisionId)
          ),
          packet.header.revision_id,
        ])
      );
      const revisionState = getRevisionState(
        nextHeadRevisionIds,
        packet.header.parent_revision_refs.length
      );
      const packetRecord = projectPacketRecord(packet, {
        first_seen_at: packetRecordInsert?.created_at,
        preferred_revision_id: packet.header.revision_id,
        head_revision_ids: nextHeadRevisionIds,
        revision_state: revisionState,
        preferred_revision_json:
          storedPacketJsonOverrides?.preferred_revision_json ?? JSON.stringify(packet),
      });
      const packetUpdateRecord = {
        packet_id: packetRecord.packet_id,
        family: packetRecord.family,
        preferred_revision_id: packetRecord.preferred_revision_id,
        head_revision_ids_json: packetRecord.head_revision_ids_json,
        revision_state: packetRecord.revision_state,
        schema_version: packetRecord.schema_version,
        updated_at: packetRecord.updated_at,
        authority_scope_packet_id: packetRecord.authority_scope_packet_id,
        preferred_revision_json: packetRecord.preferred_revision_json,
      };

      this.database
        .prepare(
          `
            UPDATE packets
            SET family = @family,
                preferred_revision_id = @preferred_revision_id,
                head_revision_ids_json = @head_revision_ids_json,
                revision_state = @revision_state,
                schema_version = @schema_version,
                updated_at = @updated_at,
                authority_scope_packet_id = @authority_scope_packet_id,
                preferred_revision_json = @preferred_revision_json
            WHERE packet_id = @packet_id
          `
        )
        .run(
          toNamedParameters(packetUpdateRecord as unknown as Record<string, unknown>)
        );

      const searchIndexRecord = projectPacketSearchIndexRecord(packet);

      this.database
        .prepare('DELETE FROM packet_search_index WHERE packet_id = ?')
        .run(packet.header.packet_id);
      this.database
        .prepare(
          `
            INSERT INTO packet_search_index (
              packet_id,
              revision_id,
              family,
              label,
              title,
              summary,
              status,
              authority_scope_packet_id,
              applicable_scope_ids_json,
              tags_json,
              created_at
            ) VALUES (
              @packet_id,
              @revision_id,
              @family,
              @label,
              @title,
              @summary,
              @status,
              @authority_scope_packet_id,
              @applicable_scope_ids_json,
              @tags_json,
              @created_at
            )
          `
          )
        .run(
          toNamedParameters(searchIndexRecord as unknown as Record<string, unknown>)
        );

      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }

    return toRevisionRef(packet);
  }

  /**
   * Inputs: a packet revision reference.
   * Output: marks that revision as preferred for packet lookups and search projections.
   */
  async publishRevision(revision: PacketRevisionRef): Promise<void> {
    const packet = await this.fetchByRevision(revision);

    if (!packet) {
      throw new Error(
        `Cannot publish missing revision ${revision.revision_id} for ${revision.packet_id}.`
      );
    }

    const packetRecord = projectPacketRecord(packet, {
      first_seen_at: this.getPacketRow(packet.header.packet_id)?.created_at,
      preferred_revision_id: packet.header.revision_id,
      head_revision_ids: this.getRevisionHeadIds(packet.header.packet_id),
      revision_state: this.getPacketRow(packet.header.packet_id)?.revision_state,
      preferred_revision_json: JSON.stringify(packet),
    });
    const packetPublishUpdateRecord = {
      packet_id: packetRecord.packet_id,
      preferred_revision_id: packetRecord.preferred_revision_id,
      schema_version: packetRecord.schema_version,
      updated_at: packetRecord.updated_at,
      authority_scope_packet_id: packetRecord.authority_scope_packet_id,
      preferred_revision_json: packetRecord.preferred_revision_json,
    };
    const searchIndexRecord = projectPacketSearchIndexRecord(packet);

    this.database.exec('BEGIN IMMEDIATE');

    try {
      this.database
        .prepare(
          `
            UPDATE packets
            SET preferred_revision_id = @preferred_revision_id,
                schema_version = @schema_version,
                updated_at = @updated_at,
                authority_scope_packet_id = @authority_scope_packet_id,
                preferred_revision_json = @preferred_revision_json
            WHERE packet_id = @packet_id
          `
        )
        .run(
          toNamedParameters(
            packetPublishUpdateRecord as unknown as Record<string, unknown>
          )
        );
      this.database
        .prepare('DELETE FROM packet_search_index WHERE packet_id = ?')
        .run(packet.header.packet_id);
      this.database
        .prepare(
          `
            INSERT INTO packet_search_index (
              packet_id,
              revision_id,
              family,
              label,
              title,
              summary,
              status,
              authority_scope_packet_id,
              applicable_scope_ids_json,
              tags_json,
              created_at
            ) VALUES (
              @packet_id,
              @revision_id,
              @family,
              @label,
              @title,
              @summary,
              @status,
              @authority_scope_packet_id,
              @applicable_scope_ids_json,
              @tags_json,
              @created_at
            )
          `
        )
        .run(
          toNamedParameters(searchIndexRecord as unknown as Record<string, unknown>)
        );

      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Inputs: a packet reference.
   * Output: the preferred revision packet for that packet id, when present.
   */
  async fetchByPacket(packet: PacketRef): Promise<PacketEnvelope | null> {
    return (await this.readByPacket(packet, {
      mode: 'adapted',
    })) as PacketEnvelope | null;
  }

  async readByPacket<TMode extends PacketReadMode>(
    packet: PacketRef,
    options: {
      mode?: TMode;
    } = {}
  ): Promise<PacketReadValue<TMode> | null> {
    const row = this.database
      .prepare(
        `
          SELECT preferred_revision_json
          FROM packets
          WHERE packet_id = ?
        `
      )
      .get(packet.packet_id) as { preferred_revision_json: string | null } | undefined;

    if (!row?.preferred_revision_json) {
      return null;
    }

    return this.readStoredPacketJson(
      row.preferred_revision_json,
      (options.mode ?? 'adapted') as TMode
    );
  }

  /**
   * Inputs: a packet revision reference.
   * Output: the exact immutable revision packet for that ref, when present.
   */
  async fetchByRevision(
    revision: PacketRevisionRef
  ): Promise<PacketEnvelope | null> {
    return (await this.readByRevision(revision, {
      mode: 'adapted',
    })) as PacketEnvelope | null;
  }

  async readByRevision<TMode extends PacketReadMode>(
    revision: PacketRevisionRef,
    options: {
      mode?: TMode;
    } = {}
  ): Promise<PacketReadValue<TMode> | null> {
    const row = this.database
      .prepare(
        `
          SELECT revision_json
          FROM packet_revisions
          WHERE packet_id = ?
            AND revision_id = ?
        `
      )
      .get(revision.packet_id, revision.revision_id) as
      | { revision_json: string }
      | undefined;

    if (!row) {
      return null;
    }

    return this.readStoredPacketJson(
      row.revision_json,
      (options.mode ?? 'adapted') as TMode
    );
  }

  async prepareRevisionForAdaptedSave(
    revision: PacketRevisionRef
  ) {
    const compatibilityRead = await this.readByRevision(revision, {
      mode: 'raw_plus_adaptation',
    });

    if (!compatibilityRead) {
      return null;
    }

    return preparePacketEnvelopeForAdaptedWrite(compatibilityRead.raw_packet);
  }

  /**
   * Inputs: a packet reference.
   * Output: the preferred revision ref for that packet, when present.
   */
  async fetchPreferredRevision(
    packet: PacketRef
  ): Promise<PacketRevisionRef | null> {
    const row = this.database
      .prepare(
        `
          SELECT preferred_revision_id
          FROM packets
          WHERE packet_id = ?
        `
      )
      .get(packet.packet_id) as { preferred_revision_id: string | null } | undefined;

    if (!row?.preferred_revision_id) {
      return null;
    }

    return {
      packet_id: packet.packet_id,
      revision_id: row.preferred_revision_id,
    };
  }

  /**
   * Inputs: a packet reference.
   * Output: preferred and head revision refs plus the packet revision-state indicator.
   */
  async fetchRevisionHeads(packet: PacketRef): Promise<PacketHeadStatus> {
    const row = this.getPacketRow(packet.packet_id);

    if (!row) {
      return {
        preferred_revision: null,
        head_revisions: [],
        revision_state: 'linear',
      };
    }

    const headRevisionIds = parseJson<string[]>(row.head_revision_ids_json, []);

    return {
      preferred_revision:
        row.preferred_revision_id === null
          ? null
          : {
              packet_id: packet.packet_id,
              revision_id: row.preferred_revision_id,
            },
      head_revisions: headRevisionIds.map((revisionId) => ({
        packet_id: packet.packet_id,
        revision_id: revisionId,
      })),
      revision_state: row.revision_state,
    };
  }

  /**
   * Inputs: a packet reference and optional edge query filters.
   * Output: packet edges directed away from and/or into the packet.
   */
  async queryEdges(
    packet: PacketRef,
    query: PacketEdgeQuery = {}
  ): Promise<PacketEdge[]> {
    const direction = query.direction ?? 'both';
    const includeOutgoing = direction === 'outgoing' || direction === 'both';
    const includeIncoming = direction === 'incoming' || direction === 'both';
    const outgoingRows: PacketEdgeRow[] = includeOutgoing
      ? (this.database
          .prepare(
            `
              SELECT source_revision_id, source_packet_id, edge_type, target_packet_id, metadata_json
              FROM packet_edges
              WHERE source_packet_id = ?
            `
          )
          .all(packet.packet_id) as unknown as PacketEdgeRow[])
      : [];
    const incomingRows: PacketEdgeRow[] = includeIncoming
      ? (this.database
          .prepare(
            `
              SELECT source_revision_id, source_packet_id, edge_type, target_packet_id, metadata_json
              FROM packet_edges
              WHERE target_packet_id = ?
            `
          )
          .all(packet.packet_id) as unknown as PacketEdgeRow[])
      : [];
    const edges = [
      ...outgoingRows.map(toOutgoingEdge),
      ...incomingRows.map(toIncomingEdge),
    ];

    if (!query.edge_types || query.edge_types.length === 0) {
      return edges;
    }

    const edgeTypes = new Set(query.edge_types);

    return edges.filter((edge) => edgeTypes.has(edge.edge_type));
  }

  /**
   * Inputs: merge request with parent revisions, merge strategy, and merged packet envelope.
   * Output: writes the merged revision when parent and strategy invariants are satisfied.
   */
  async mergeRevisions(input: {
    packet: PacketRef;
    parent_revisions: PacketRevisionRef[];
    strategy: PacketMergeStrategy;
    merged_packet: PacketEnvelope;
  }): Promise<PacketRevisionRef> {
    const mergedPacket = this.validate(input.merged_packet);
    const expectedParentRefSet = new Set(
      input.parent_revisions.map((parentRevision) => parentRevision.revision_id)
    );
    const mergedParentRefSet = new Set(
      mergedPacket.header.parent_revision_refs.map(
        (parentRevision) => parentRevision.revision_id
      )
    );

    if (mergedPacket.header.packet_id !== input.packet.packet_id) {
      throw new Error(
        `Merged packet target mismatch: expected ${input.packet.packet_id}, received ${mergedPacket.header.packet_id}.`
      );
    }

    if (
      input.parent_revisions.some(
        (parentRevision) => parentRevision.packet_id !== input.packet.packet_id
      )
    ) {
      throw new Error(
        `Merge parent revisions must all reference packet ${input.packet.packet_id}.`
      );
    }

    if (!hasSameMembers(expectedParentRefSet, mergedParentRefSet)) {
      throw new Error(
        `Merged packet parents do not match requested parent revisions for ${input.packet.packet_id}.`
      );
    }

    if (mergedPacket.header.merge_strategy !== input.strategy) {
      throw new Error(
        `Merged packet strategy mismatch for ${input.packet.packet_id}: expected ${input.strategy}, received ${mergedPacket.header.merge_strategy ?? 'null'}.`
      );
    }

    return this.writeRevision(mergedPacket);
  }

  /**
   * Inputs: a serialized bundle payload.
   * Output: imports all packet revisions from the bundle into the packet store.
   */
  async importBundle(
    bundle: Uint8Array | ArrayBuffer | string
  ): Promise<{
    packet_count: number;
    revision_count: number;
    edge_count: number;
  }> {
    const bundleText = decodeBundleToText(bundle);
    const parsedBundle = JSON.parse(bundleText) as {
      packets?: unknown[];
      revisions?: unknown[];
    } | unknown[];
    const revisionsRaw = Array.isArray(parsedBundle)
      ? parsedBundle
      : Array.isArray(parsedBundle.packets)
        ? parsedBundle.packets
        : Array.isArray(parsedBundle.revisions)
          ? parsedBundle.revisions
          : null;

    if (!revisionsRaw) {
      throw new Error('Bundle payload must include a packets or revisions array.');
    }

    let revisionCount = 0;
    let edgeCount = 0;
    const packetIds = new Set<string>();

    for (const rawPacket of revisionsRaw) {
      const compatibilityRead = inspectPacketEnvelope(rawPacket);
      const rawEnvelope = parseRawPacketEnvelopeInput(rawPacket);
      const storedPacketJsonOverrides = {
        revision_json: JSON.stringify(rawPacket),
        header_json: JSON.stringify(rawEnvelope.header),
        body_json: JSON.stringify(rawEnvelope.body),
        preferred_revision_json: JSON.stringify(rawPacket),
      };

      try {
        await this.writeValidatedRevision(
          compatibilityRead.adapted_packet,
          storedPacketJsonOverrides
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('already exists')
        ) {
          continue;
        }

        throw error;
      }

      revisionCount += 1;
      edgeCount += compatibilityRead.adapted_packet.header.edges.length;
      packetIds.add(compatibilityRead.adapted_packet.header.packet_id);
    }

    return {
      packet_count: packetIds.size,
      revision_count: revisionCount,
      edge_count: edgeCount,
    };
  }

  /**
   * Inputs: packet refs to export.
   * Output: a deterministic JSON bundle containing all revisions for those packets.
   */
  async exportBundle(packetRefs: PacketRef[]): Promise<{
    bytes: Uint8Array;
    packet_count: number;
    revision_count: number;
  }> {
    const packetIds = Array.from(new Set(packetRefs.map((packet) => packet.packet_id)));
    const revisions: unknown[] = [];
    let packetCount = 0;

    for (const packetId of packetIds) {
      const revisionRows = this.database
        .prepare(
          `
            SELECT revision_json
            FROM packet_revisions
            WHERE packet_id = ?
            ORDER BY created_at ASC
          `
        )
        .all(packetId) as { revision_json: string }[];

      if (revisionRows.length > 0) {
        packetCount += 1;
      }

      for (const revisionRow of revisionRows) {
        revisions.push(JSON.parse(revisionRow.revision_json));
      }
    }

    const payload = {
      bundle_version: 1,
      exported_at: new Date().toISOString(),
      packets: revisions,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));

    return {
      bytes,
      packet_count: packetCount,
      revision_count: revisions.length,
    };
  }

  /**
   * Inputs: none.
   * Output: all flattened packet search/index rows ordered from newest to oldest.
   */
  async listSearchRows(): Promise<PacketSearchIndexRecord[]> {
    return this.database
      .prepare(
        `
          SELECT
            packet_id,
            revision_id,
            family,
            label,
            title,
            summary,
            status,
            authority_scope_packet_id,
            applicable_scope_ids_json,
            tags_json,
            created_at
          FROM packet_search_index
          ORDER BY created_at DESC
        `
      )
      .all() as unknown as PacketSearchIndexRecord[];
  }

  /**
   * Inputs: a packet family filter.
   * Output: preferred packet revisions for that family, newest first.
   */
  async listPreferredPacketsByFamily<TFamily extends PacketFamily>(
    family: TFamily
  ): Promise<PacketEnvelopeByType[TFamily][]> {
    const rows = this.database
      .prepare(
        `
          SELECT preferred_revision_json
          FROM packets
          WHERE family = ?
          ORDER BY updated_at DESC
        `
      )
      .all(family) as { preferred_revision_json: string | null }[];

    return rows
      .map((row) => row.preferred_revision_json)
      .filter((value): value is string => typeof value === 'string')
      .map(
        (value) =>
          this.readStoredPacketJson(value, 'adapted') as PacketEnvelopeByType[TFamily]
      );
  }

  /**
   * Inputs: none.
   * Output: preferred packet revisions for all families, newest first.
   */
  async listPreferredPackets(): Promise<PacketEnvelope[]> {
    const rows = this.database
      .prepare(
        `
          SELECT preferred_revision_json
          FROM packets
          ORDER BY updated_at DESC
        `
      )
      .all() as { preferred_revision_json: string | null }[];

    return rows
      .map((row) => row.preferred_revision_json)
      .filter((value): value is string => typeof value === 'string')
      .map((value) => this.readStoredPacketJson(value, 'adapted') as PacketEnvelope);
  }

  /**
   * Inputs: packet id.
   * Output: current mutable packet-head row when present.
   */
  private getPacketRow(packetId: string): PacketRow | null {
    const row = this.database
      .prepare(
        `
          SELECT
            packet_id,
            family,
            preferred_revision_id,
            head_revision_ids_json,
            revision_state,
            schema_version,
            created_at,
            updated_at,
            authority_scope_packet_id,
            preferred_revision_json
          FROM packets
          WHERE packet_id = ?
        `
      )
      .get(packetId) as PacketRow | undefined;

    return row ?? null;
  }

  /**
   * Inputs: packet id.
   * Output: packet head revision ids from the mutable packets table.
   */
  private getRevisionHeadIds(packetId: string): string[] {
    const row = this.getPacketRow(packetId);

    if (!row) {
      return [];
    }

    return parseJson<string[]>(row.head_revision_ids_json, []);
  }

  private readStoredPacketJson<TMode extends PacketReadMode>(
    storedPacketJson: string,
    mode: TMode
  ): PacketReadValue<TMode> {
    const rawPacket = JSON.parse(storedPacketJson);

    if (mode === 'raw') {
      return rawPacket as PacketReadValue<TMode>;
    }

    const compatibilityRead = inspectPacketEnvelope(rawPacket);

    if (mode === 'raw_plus_adaptation') {
      return compatibilityRead as PacketReadValue<TMode>;
    }

    return compatibilityRead.adapted_packet as PacketReadValue<TMode>;
  }

  /**
   * Inputs: none.
   * Output: closes the underlying SQLite connection.
   */
  close(): void {
    this.database.close();
  }
}
