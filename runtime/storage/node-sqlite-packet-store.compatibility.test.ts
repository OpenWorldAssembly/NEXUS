import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import {
  inspectPacketEnvelope,
  preparePacketEnvelopeForVersionedWrite,
} from '@core/schema/packet-schema';

import { NodeSQLitePacketStore } from './node-sqlite-packet-store.ts';

function createLegacyElementPacket() {
  return {
    header: {
      packet_id: 'nexus:element/test-legacy-person',
      revision_id: 'nexus:element/test-legacy-person@r1',
      type: 'Element',
      schema_version: '0.9.0',
      protocol_version: '0.1.0',
      created_at: '2026-04-18T00:00:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-04-18T00:00:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: [],
        language: null,
        summary: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      name: 'Legacy Person',
      subtype: 'person',
      summary: null,
      locality_label: null,
      identity: null,
      tags: ['person'],
    },
  };
}

function createCurrentElementPacket() {
  return {
    header: {
      packet_id: 'nexus:element/test-current-person',
      revision_id: 'nexus:element/test-current-person@r1',
      type: 'Element',
      schema_version: '1.0.0',
      protocol_version: '0.1.0',
      created_at: '2026-04-18T00:00:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-04-18T00:00:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: [],
        language: null,
        summary: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      name: 'Current Person',
      subtype: 'person',
      summary: null,
      locality_label: null,
      locality: null,
      identity: null,
      tags: ['person'],
      claimed_role_refs: [],
    },
  };
}

function createLegacyFamilyClaimedIdentityPacket() {
  const currentPacket = createCurrentElementPacket();
  const { type: _type, ...headerWithoutType } = currentPacket.header;

  return {
    header: {
      ...headerWithoutType,
      packet_id: 'nexus:element/test-legacy-claimed-identity',
      revision_id: 'nexus:element/test-legacy-claimed-identity@r1',
      family: 'Element',
      schema_version: '1.0.0',
    },
    body: {
      ...currentPacket.body,
      name: 'Legacy Claimed Identity',
      subtype: 'claimed_identity',
      identity: {
        alias: 'Legacy Claimed Identity',
        claim_status: 'claimed',
        location_disclosure: null,
        public_key_bindings: [
          {
            kid: 'legacy-key',
            alg: 'ES256',
            kty: 'EC',
            crv: 'P-256',
            public_jwk: {
              kty: 'EC',
              crv: 'P-256',
              x: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
              y: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
            },
            status: 'active',
            added_at: '2026-04-18T00:00:00.000Z',
            revoked_at: null,
          },
        ],
      },
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

test('packet store preserves legacy raw revisions while serving adapted packets by default', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-packet-store-compat-'));
  const packetStore = new NodeSQLitePacketStore({
    databasePath: join(directory, 'owa-packets.db'),
  });
  const legacyPacket = createLegacyElementPacket();

  try {
    await packetStore.importBundle(
      JSON.stringify({
        bundle_version: 1,
        exported_at: '2026-04-18T00:00:00.000Z',
        packets: [legacyPacket],
      })
    );

    const adaptedPacket = await packetStore.fetchByRevision({
      packet_id: legacyPacket.header.packet_id,
      revision_id: legacyPacket.header.revision_id,
    });
    const rawPacket = await packetStore.readByRevision(
      {
        packet_id: legacyPacket.header.packet_id,
        revision_id: legacyPacket.header.revision_id,
      },
      {
        mode: 'raw',
      }
    );
    const compatibilityRead = await packetStore.readByRevision(
      {
        packet_id: legacyPacket.header.packet_id,
        revision_id: legacyPacket.header.revision_id,
      },
      {
        mode: 'raw_plus_adaptation',
      }
    );
    const preparedWrite = await packetStore.prepareRevisionForAdaptedSave({
      packet_id: legacyPacket.header.packet_id,
      revision_id: legacyPacket.header.revision_id,
    });
    const exportedBundle = await packetStore.exportBundle([
      {
        packet_id: legacyPacket.header.packet_id,
      },
    ]);
    const parsedExport = JSON.parse(new TextDecoder().decode(exportedBundle.bytes)) as {
      packets: unknown[];
    };

    assert.ok(adaptedPacket);
    assert.ok(rawPacket);
    assert.ok(compatibilityRead);
    assert.ok(preparedWrite);

    assert.deepEqual(rawPacket, legacyPacket);
    assert.deepEqual(parsedExport.packets[0], legacyPacket);
    assert.deepEqual(
      (
        adaptedPacket as {
          body: { claimed_role_refs: unknown[]; locality: unknown };
        }
      ).body.claimed_role_refs,
      []
    );
    assert.equal(
      (
        adaptedPacket as {
          body: { locality: unknown };
        }
      ).body.locality,
      null
    );
    assert.ok(preparedWrite.prepared_packet);
    assert.equal(preparedWrite.prepared_packet.header.schema_version, '1.1.0');
    assert.deepEqual(
      compatibilityRead.status.changes.map((change) => change.path),
      [
        'body.claimed_role_refs',
        'body.locality',
        'body.subtype',
        'body.scope_system',
        'body.status',
        'body.aliases',
        'body.display_aliases',
        'body.custody_hints',
      ]
    );
  } finally {
    packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('packet compatibility adapts legacy family headers and claimed identity subtypes', () => {
  const legacyPacket = createLegacyFamilyClaimedIdentityPacket();
  const compatibilityRead = inspectPacketEnvelope(legacyPacket);

  assert.equal(compatibilityRead.adapted_packet.header.type, 'Element');
  assert.equal(compatibilityRead.adapted_packet.header.schema_version, '1.1.0');
  assert.equal(compatibilityRead.adapted_packet.body.subtype, 'person');
});

test('packet store repairs legacy family columns before serving packets by type', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-packet-store-family-'));
  const databasePath = join(directory, 'owa-packets.db');
  let packetStore: NodeSQLitePacketStore | null = new NodeSQLitePacketStore({
    databasePath,
  });
  const legacyPacket = createLegacyFamilyClaimedIdentityPacket();

  try {
    await packetStore.importBundle(
      JSON.stringify({
        bundle_version: 1,
        exported_at: '2026-04-18T00:00:00.000Z',
        packets: [legacyPacket],
      })
    );
    packetStore.close();
    packetStore = null;

    downgradePacketStoreColumnsToLegacy(databasePath);

    packetStore = new NodeSQLitePacketStore({ databasePath });

    const schemaStatus = packetStore.auditSchemaCompatibility();
    const elementPackets = await packetStore.listPreferredPacketsByType('Element');
    const rawPacket = await packetStore.readByRevision(
      {
        packet_id: legacyPacket.header.packet_id,
        revision_id: legacyPacket.header.revision_id,
      },
      { mode: 'raw' }
    );

    assert.equal(schemaStatus.status, 'current');
    assert.deepEqual(schemaStatus.remaining_legacy_columns, []);
    assert.ok(
      schemaStatus.repaired_legacy_columns.includes('packets.family->type')
    );
    assert.equal(elementPackets.length, 1);
    assert.equal(elementPackets[0]?.body.subtype, 'person');
    assert.deepEqual(rawPacket, legacyPacket);
  } finally {
    packetStore?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('packet store can inspect and persist an explicitly prepared older target schema revision', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-packet-store-versioned-'));
  const packetStore = new NodeSQLitePacketStore({
    databasePath: join(directory, 'owa-packets.db'),
  });
  const currentPacket = createCurrentElementPacket();

  try {
    const downcastRead = await packetStore.readByRevision(
      {
        packet_id: currentPacket.header.packet_id,
        revision_id: currentPacket.header.revision_id,
      },
      {
        mode: 'adapted',
      }
    );

    assert.equal(downcastRead, null);

    const preparedWrite = preparePacketEnvelopeForVersionedWrite(currentPacket, {
      target_schema_version: '0.9.0',
    });

    assert.equal(preparedWrite.supported_write_target, 'exact');
    assert.ok(preparedWrite.prepared_packet);

    await packetStore.writePreparedRevision(preparedWrite);

    const rawPacket = await packetStore.readByRevision(
      {
        packet_id: currentPacket.header.packet_id,
        revision_id: currentPacket.header.revision_id,
      },
      { mode: 'raw' }
    );
    const downcastPacket = await packetStore.readByRevision(
      {
        packet_id: currentPacket.header.packet_id,
        revision_id: currentPacket.header.revision_id,
      },
      {
        mode: 'adapted',
        target_schema_version: '0.9.0',
      }
    );
    const currentPacketRead = await packetStore.fetchByRevision({
      packet_id: currentPacket.header.packet_id,
      revision_id: currentPacket.header.revision_id,
    });

    assert.ok(rawPacket);
    assert.ok(downcastPacket);
    assert.ok(currentPacketRead);
    assert.equal(
      (rawPacket as { header: { schema_version: string } }).header.schema_version,
      '0.9.0'
    );
    assert.equal(
      (downcastPacket as { header: { schema_version: string } }).header.schema_version,
      '0.9.0'
    );
    assert.equal(currentPacketRead.header.schema_version, '1.1.0');
    assert.deepEqual(
      (
        currentPacketRead as {
          body: { claimed_role_refs: unknown[]; locality: unknown };
        }
      ).body.claimed_role_refs,
      []
    );
    assert.equal(
      (
        currentPacketRead as {
          body: { locality: unknown };
        }
      ).body.locality,
      null
    );
  } finally {
    packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('packet store audits and repairs simple preferred/head drift with a dry run first', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-packet-store-repair-'));
  const databasePath = join(directory, 'owa-packets.db');
  const packetStore = new NodeSQLitePacketStore({
    databasePath,
  });
  const currentPacket = createCurrentElementPacket();

  try {
    await packetStore.writeRevision(currentPacket as never);
    await packetStore.publishRevision({
      packet_id: currentPacket.header.packet_id,
      revision_id: currentPacket.header.revision_id,
    });

    const database = new DatabaseSync(databasePath);
    database
      .prepare(
        `
          UPDATE packets
          SET preferred_revision_id = ?,
              preferred_revision_json = ?
          WHERE packet_id = ?
        `
      )
      .run(
        `${currentPacket.header.packet_id}@r999`,
        JSON.stringify({
          ...currentPacket,
          header: {
            ...currentPacket.header,
            revision_id: `${currentPacket.header.packet_id}@r999`,
          },
        }),
        currentPacket.header.packet_id
      );
    database.close();

    const audit = await packetStore.auditPreferredHeadConsistency();
    const dryRun = await packetStore.repairPreferredHeadConsistency({
      dryRun: true,
    });

    assert.equal(audit.issue_count, 1);
    assert.equal(audit.repairable_count, 1);
    assert.equal(audit.issues[0]?.issue_kind, 'preferred_not_in_heads');
    assert.equal(dryRun.repaired_packet_ids.length, 0);

    const repaired = await packetStore.repairPreferredHeadConsistency({
      dryRun: false,
    });
    const revisionHeads = await packetStore.fetchRevisionHeads({
      packet_id: currentPacket.header.packet_id,
    });
    const preferredPacket = await packetStore.readByPacket(
      {
        packet_id: currentPacket.header.packet_id,
      },
      { mode: 'raw' }
    );

    assert.equal(repaired.issue_count, 0);
    assert.deepEqual(repaired.repaired_packet_ids, [currentPacket.header.packet_id]);
    assert.equal(
      revisionHeads.preferred_revision?.revision_id,
      currentPacket.header.revision_id
    );
    assert.equal(
      (
        preferredPacket as {
          header: { revision_id: string };
        }
      ).header.revision_id,
      currentPacket.header.revision_id
    );
  } finally {
    packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
