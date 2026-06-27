/**
 * File: nexus-reseed.ts
 * Description: Local maintenance helper for applying the canonical Nexus seed packet set.
 */

import { CANONICAL_SEED_PACKETS } from '@core/packets/seeds.ts';
import type { PacketStore } from '@core/contracts.ts';
import type { PacketEnvelope, PacketType } from '@core/schema/packet-schema.ts';
import { DatabaseSync } from 'node:sqlite';
import type {
  NodeSQLitePacketStore,
  PacketStoreSchemaCompatibilityStatus,
} from '@runtime/storage/node-sqlite-packet-store.ts';

export type NexusCanonicalReseedMode = 'dry_run' | 'commit';
export const NEXUS_WIPE_CONFIRMATION_PHRASE = 'WIPE NEXUS PACKET STORE';

const WIPE_TABLES = [
  'auth_event_log',
  'auth_rate_limit_buckets',
  'auth_reauth_tokens',
  'auth_webauthn_challenges',
  'auth_identity_security',
  'auth_passkeys',
  'auth_refresh_tokens',
  'auth_sessions',
  'auth_sign_in_challenges',
  'discussion_actor_ledger',
  'discussion_post_index',
  'reaction_tally_index',
  'reaction_index',
  'packet_verification_index',
  'actor_scope_display_preferences',
  'runtime_validator_identity',
  'packet_search_index',
  'packet_edges',
  'packet_revisions',
  'packets',
] as const;

export type NexusCanonicalReseedRequest = {
  mode?: NexusCanonicalReseedMode;
};

export type NexusCanonicalReseedConflict = {
  packet_id: string;
  seed_revision_id: string;
  existing_revision_id: string;
  type: PacketType;
};

export type NexusCanonicalReseedReport = {
  report_kind: 'nexus.canonical_reseed';
  mode: NexusCanonicalReseedMode;
  status: 'ready' | 'applied' | 'blocked';
  schema_status: PacketStoreSchemaCompatibilityStatus | null;
  seed_packet_count: number;
  existing_seed_revision_count: number;
  missing_seed_revision_count: number;
  written_revision_count: number;
  conflict_count: number;
  counts_by_type: Record<string, number>;
  conflicts: NexusCanonicalReseedConflict[];
  warnings: string[];
  blockers: string[];
  export_hint: {
    artifact_mode: 'bundle';
    bundle_mode: 'full_store';
    title: string;
  };
};

export type NexusDatabaseWipeRequest = {
  mode?: NexusCanonicalReseedMode;
  confirmation?: string | null;
};

export type NexusDatabaseWipeReport = {
  report_kind: 'nexus.database_wipe';
  mode: NexusCanonicalReseedMode;
  status: 'ready' | 'applied' | 'blocked';
  database_path: string;
  schema_status: PacketStoreSchemaCompatibilityStatus;
  table_counts_before: Record<string, number>;
  deleted_row_count: number;
  warnings: string[];
  blockers: string[];
  required_confirmation: typeof NEXUS_WIPE_CONFIRMATION_PHRASE;
};

function countPacketsByType(packets: readonly PacketEnvelope[]): Record<string, number> {
  return packets.reduce<Record<string, number>>((counts, packet) => {
    const packetType = packet.header.type;
    counts[packetType] = (counts[packetType] ?? 0) + 1;
    return counts;
  }, {});
}

function isAlreadyExistsError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('already exists');
}

export async function runNexusCanonicalReseed(input: {
  packetStore: PacketStore;
  request?: NexusCanonicalReseedRequest;
}): Promise<NexusCanonicalReseedReport> {
  const mode = input.request?.mode ?? 'dry_run';
  const schemaStatus =
    'auditSchemaCompatibility' in input.packetStore &&
    typeof input.packetStore.auditSchemaCompatibility === 'function'
      ? input.packetStore.auditSchemaCompatibility()
      : null;

  if (schemaStatus?.status === 'blocked') {
    return {
      report_kind: 'nexus.canonical_reseed',
      mode,
      status: 'blocked',
      schema_status: schemaStatus,
      seed_packet_count: CANONICAL_SEED_PACKETS.length,
      existing_seed_revision_count: 0,
      missing_seed_revision_count: 0,
      written_revision_count: 0,
      conflict_count: 0,
      counts_by_type: countPacketsByType(CANONICAL_SEED_PACKETS),
      conflicts: [],
      warnings: [],
      blockers: schemaStatus.blockers,
      export_hint: {
        artifact_mode: 'bundle',
        bundle_mode: 'full_store',
        title: 'OWA default reseed packet set',
      },
    };
  }

  const conflicts: NexusCanonicalReseedConflict[] = [];
  let existingSeedRevisionCount = 0;
  let missingSeedRevisionCount = 0;
  let writtenRevisionCount = 0;

  for (const seedPacket of CANONICAL_SEED_PACKETS) {
    const seedRevisionRef = {
      packet_id: seedPacket.header.packet_id,
      revision_id: seedPacket.header.revision_id,
    };
    const existingSeedRevision = await input.packetStore.fetchByRevision(
      seedRevisionRef
    );

    if (existingSeedRevision) {
      existingSeedRevisionCount += 1;
      continue;
    }

    const existingPacket = await input.packetStore.fetchByPacket({
      packet_id: seedPacket.header.packet_id,
    });

    if (existingPacket) {
      conflicts.push({
        packet_id: seedPacket.header.packet_id,
        seed_revision_id: seedPacket.header.revision_id,
        existing_revision_id: existingPacket.header.revision_id,
        type: seedPacket.header.type,
      });
      continue;
    }

    missingSeedRevisionCount += 1;

    if (mode === 'commit') {
      try {
        await input.packetStore.writeRevision(seedPacket);
        writtenRevisionCount += 1;
      } catch (error) {
        if (isAlreadyExistsError(error)) {
          existingSeedRevisionCount += 1;
          missingSeedRevisionCount -= 1;
          continue;
        }

        throw error;
      }
    }
  }

  const blockers = conflicts.map(
    (conflict) =>
      `${conflict.packet_id} already exists at ${conflict.existing_revision_id}; canonical seed revision ${conflict.seed_revision_id} was not written.`
  );

  return {
    report_kind: 'nexus.canonical_reseed',
    mode,
    status:
      blockers.length > 0
        ? 'blocked'
        : mode === 'commit'
          ? 'applied'
          : 'ready',
    schema_status: schemaStatus,
    seed_packet_count: CANONICAL_SEED_PACKETS.length,
    existing_seed_revision_count: existingSeedRevisionCount,
    missing_seed_revision_count: missingSeedRevisionCount,
    written_revision_count: writtenRevisionCount,
    conflict_count: conflicts.length,
    counts_by_type: countPacketsByType(CANONICAL_SEED_PACKETS),
    conflicts,
    warnings: [],
    blockers,
    export_hint: {
      artifact_mode: 'bundle',
      bundle_mode: 'full_store',
      title: 'OWA default reseed packet set',
    },
  };
}

function countTableRows(input: {
  database: DatabaseSync;
  tableNames: readonly string[];
}): Record<string, number> {
  return Object.fromEntries(
    input.tableNames.map((tableName) => {
      const row = input.database
        .prepare(`SELECT COUNT(*) AS count FROM ${tableName}`)
        .get() as { count: number };

      return [tableName, row.count];
    })
  );
}

function deleteTableRows(input: {
  database: DatabaseSync;
  tableNames: readonly string[];
}): number {
  let deletedRowCount = 0;

  for (const tableName of input.tableNames) {
    const row = input.database
      .prepare(`SELECT COUNT(*) AS count FROM ${tableName}`)
      .get() as { count: number };
    deletedRowCount += row.count;
    input.database.exec(`DELETE FROM ${tableName}`);
  }

  return deletedRowCount;
}

export async function runNexusDatabaseWipe(input: {
  packetStore: Pick<NodeSQLitePacketStore, 'databasePath'>;
  request?: NexusDatabaseWipeRequest;
}): Promise<NexusDatabaseWipeReport> {
  const mode = input.request?.mode ?? 'dry_run';
  const database = new DatabaseSync(input.packetStore.databasePath);
  const schemaStatus =
    'auditSchemaCompatibility' in input.packetStore &&
    typeof input.packetStore.auditSchemaCompatibility === 'function'
      ? input.packetStore.auditSchemaCompatibility()
      : {
          database_path: input.packetStore.databasePath,
          status: 'blocked' as const,
          repaired_legacy_columns: [],
          remaining_legacy_columns: [],
          missing_current_columns: [],
          blockers: [
            'Database wipe requires a packet store with schema compatibility auditing.',
          ],
        };

  try {
    const tableCountsBefore = countTableRows({
      database,
      tableNames: WIPE_TABLES,
    });
    const blockers = [
      ...schemaStatus.blockers,
      ...(mode === 'commit' &&
      input.request?.confirmation !== NEXUS_WIPE_CONFIRMATION_PHRASE
        ? [
            `Database wipe requires confirmation phrase: ${NEXUS_WIPE_CONFIRMATION_PHRASE}`,
          ]
        : []),
    ];
    let deletedRowCount = 0;

    if (mode === 'commit' && blockers.length === 0) {
      database.exec('BEGIN IMMEDIATE');
      try {
        deletedRowCount = deleteTableRows({
          database,
          tableNames: WIPE_TABLES,
        });
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    }

    return {
      report_kind: 'nexus.database_wipe',
      mode,
      status:
        blockers.length > 0
          ? 'blocked'
          : mode === 'commit'
            ? 'applied'
            : 'ready',
      database_path: input.packetStore.databasePath,
      schema_status: schemaStatus,
      table_counts_before: tableCountsBefore,
      deleted_row_count: deletedRowCount,
      warnings: [
        'This maintenance operation deletes packet, derived index, validator identity, auth/session, and preference rows while preserving the SQLite schema.',
      ],
      blockers,
      required_confirmation: NEXUS_WIPE_CONFIRMATION_PHRASE,
    };
  } finally {
    database.close();
  }
}
