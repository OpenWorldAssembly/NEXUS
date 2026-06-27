/**
 * File: nexus-reseed.test.ts
 * Description: Regression coverage for local canonical reseed maintenance helper.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { CANONICAL_SEED_PACKETS } from '@core/packets/seeds.ts';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store.ts';
import {
  NEXUS_WIPE_CONFIRMATION_PHRASE,
  runNexusCanonicalReseed,
  runNexusDatabaseWipe,
} from './nexus-reseed.ts';

function createTempStore() {
  const directory = mkdtempSync(join(tmpdir(), 'owa-nexus-reseed-'));
  const packetStore = new NodeSQLitePacketStore({
    databasePath: join(directory, 'owa-packets.db'),
  });

  return {
    directory,
    packetStore,
    cleanup() {
      packetStore.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function downgradePacketStoreColumnsToLegacy(databasePath: string): void {
  const database = new DatabaseSync(databasePath);

  try {
    database.exec('ALTER TABLE packets RENAME COLUMN type TO family');
    database.exec('ALTER TABLE packet_revisions RENAME COLUMN type TO family');
    database.exec('ALTER TABLE packet_search_index RENAME COLUMN type TO family');
    database.exec('ALTER TABLE packet_edges RENAME COLUMN source_type TO source_family');
  } finally {
    database.close();
  }
}

test('canonical reseed dry-run and commit report seed packet writes', async () => {
  const fixture = createTempStore();

  try {
    const dryRun = await runNexusCanonicalReseed({
      packetStore: fixture.packetStore,
      request: { mode: 'dry_run' },
    });

    assert.equal(dryRun.status, 'ready');
    assert.equal(dryRun.schema_status?.status, 'current');
    assert.equal(dryRun.seed_packet_count, CANONICAL_SEED_PACKETS.length);
    assert.equal(dryRun.missing_seed_revision_count, CANONICAL_SEED_PACKETS.length);
    assert.equal(dryRun.written_revision_count, 0);

    const commit = await runNexusCanonicalReseed({
      packetStore: fixture.packetStore,
      request: { mode: 'commit' },
    });

    assert.equal(commit.status, 'applied');
    assert.equal(commit.schema_status?.status, 'current');
    assert.equal(commit.written_revision_count, CANONICAL_SEED_PACKETS.length);
    assert.equal((await fixture.packetStore.listPacketIds()).length, CANONICAL_SEED_PACKETS.length);

    const secondCommit = await runNexusCanonicalReseed({
      packetStore: fixture.packetStore,
      request: { mode: 'commit' },
    });

    assert.equal(secondCommit.status, 'applied');
    assert.equal(secondCommit.existing_seed_revision_count, CANONICAL_SEED_PACKETS.length);
    assert.equal(secondCommit.written_revision_count, 0);
  } finally {
    fixture.cleanup();
  }
});

test('canonical reseed reports repaired legacy packet-store schema', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-nexus-reseed-family-'));
  const databasePath = join(directory, 'owa-packets.db');
  let packetStore: NodeSQLitePacketStore | null = new NodeSQLitePacketStore({
    databasePath,
  });

  try {
    packetStore.close();
    packetStore = null;

    downgradePacketStoreColumnsToLegacy(databasePath);

    packetStore = new NodeSQLitePacketStore({ databasePath });

    const report = await runNexusCanonicalReseed({
      packetStore,
      request: { mode: 'dry_run' },
    });

    assert.equal(report.status, 'ready');
    assert.equal(report.schema_status?.status, 'current');
    assert.ok(
      report.schema_status?.repaired_legacy_columns.includes('packets.family->type')
    );
  } finally {
    packetStore?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('canonical reseed blocks dirty packet-id conflicts', async () => {
  const fixture = createTempStore();
  const seedPacket = CANONICAL_SEED_PACKETS[0];

  try {
    await fixture.packetStore.writeRevision({
      ...seedPacket,
      header: {
        ...seedPacket.header,
        revision_id: `${seedPacket.header.packet_id}@local-conflict`,
      },
    });

    const report = await runNexusCanonicalReseed({
      packetStore: fixture.packetStore,
      request: { mode: 'commit' },
    });

    assert.equal(report.status, 'blocked');
    assert.equal(report.conflict_count, 1);
    assert.equal(report.conflicts[0]?.packet_id, seedPacket.header.packet_id);
  } finally {
    fixture.cleanup();
  }
});

test('database wipe requires confirmation and clears packet store rows', async () => {
  const fixture = createTempStore();

  try {
    await runNexusCanonicalReseed({
      packetStore: fixture.packetStore,
      request: { mode: 'commit' },
    });
    assert.equal((await fixture.packetStore.listPacketIds()).length, CANONICAL_SEED_PACKETS.length);

    const blockedWipe = await runNexusDatabaseWipe({
      packetStore: fixture.packetStore,
      request: { mode: 'commit' },
    });

    assert.equal(blockedWipe.status, 'blocked');
    assert.equal(blockedWipe.schema_status.status, 'current');
    assert.equal((await fixture.packetStore.listPacketIds()).length, CANONICAL_SEED_PACKETS.length);

    const dryRun = await runNexusDatabaseWipe({
      packetStore: fixture.packetStore,
      request: { mode: 'dry_run' },
    });

    assert.equal(dryRun.status, 'ready');
    assert.equal(dryRun.schema_status.status, 'current');
    assert.equal(dryRun.deleted_row_count, 0);
    assert.equal(dryRun.table_counts_before.packets, CANONICAL_SEED_PACKETS.length);

    const committedWipe = await runNexusDatabaseWipe({
      packetStore: fixture.packetStore,
      request: {
        mode: 'commit',
        confirmation: NEXUS_WIPE_CONFIRMATION_PHRASE,
      },
    });

    assert.equal(committedWipe.status, 'applied');
    assert.equal(committedWipe.schema_status.status, 'current');
    assert.equal(committedWipe.table_counts_before.packets, CANONICAL_SEED_PACKETS.length);
    assert.equal((await fixture.packetStore.listPacketIds()).length, 0);

    const reseedAfterWipe = await runNexusCanonicalReseed({
      packetStore: fixture.packetStore,
      request: { mode: 'commit' },
    });

    assert.equal(reseedAfterWipe.status, 'applied');
    assert.equal(reseedAfterWipe.written_revision_count, CANONICAL_SEED_PACKETS.length);
  } finally {
    fixture.cleanup();
  }
});
