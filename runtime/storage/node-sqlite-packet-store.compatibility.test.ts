import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { NodeSQLitePacketStore } from './node-sqlite-packet-store.ts';

function createLegacyElementPacket() {
  return {
    header: {
      packet_id: 'nexus:element/test-legacy-person',
      revision_id: 'nexus:element/test-legacy-person@r1',
      family: 'Element',
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
      kind: 'person',
      name: 'Legacy Person',
      subtype: 'guest_identity',
      summary: null,
      locality_label: null,
      identity: null,
      tags: ['person'],
    },
  };
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
    assert.equal(preparedWrite.prepared_packet.header.schema_version, '1.0.0');
    assert.deepEqual(
      compatibilityRead.status.changes.map((change) => change.path),
      ['body.claimed_role_refs', 'body.locality']
    );
  } finally {
    packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
