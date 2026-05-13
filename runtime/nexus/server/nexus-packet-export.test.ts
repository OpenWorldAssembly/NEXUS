import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createElementPacket,
  createPacketEdge,
} from '@core/packets/builders';
import type { PacketRef } from '@core/schema/packet-schema';
import {
  createIdentityKeyBinding,
  exportIdentityKeyPairToJwk,
  generateP256KeyPair,
  signPacketWithIdentity,
} from '@runtime/nexus/identity-crypto';
import {
  buildNexusPacketExplorerExportPreview,
} from '@runtime/nexus/server/nexus-packet-export';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';
import { createNodeSQLiteQueryServicesAsync } from '@runtime/storage/node-sqlite-query-services';

function createExportFixturePackets() {
  const nationPacket = createElementPacket({
    packet_id: 'nexus:element/united-states',
    revision_id: 'nexus:element/united-states@r1',
    kind: 'assembly',
    name: 'United States',
  });
  const regionPacket = createElementPacket({
    packet_id: 'nexus:element/california',
    revision_id: 'nexus:element/california@r1',
    kind: 'assembly',
    name: 'California',
    edges: [createPacketEdge('parent_scope', { packet_id: nationPacket.header.packet_id })],
  });
  const cityPacket = createElementPacket({
    packet_id: 'nexus:element/perris',
    revision_id: 'nexus:element/perris@r1',
    kind: 'assembly',
    name: 'Perris',
    edges: [createPacketEdge('parent_scope', { packet_id: regionPacket.header.packet_id })],
  });
  const referencedPacket = createElementPacket({
    packet_id: 'nexus:element/referenced-packet',
    revision_id: 'nexus:element/referenced-packet@r1',
    kind: 'organization',
    name: 'Referenced Packet',
  });
  const rootPacketV1 = createElementPacket({
    packet_id: 'nexus:element/root-packet',
    revision_id: 'nexus:element/root-packet@r1',
    kind: 'service',
    name: 'Root Packet',
    authority_scope_ref: { packet_id: cityPacket.header.packet_id },
    applicable_scope_refs: [{ packet_id: cityPacket.header.packet_id }],
    edges: [createPacketEdge('references', { packet_id: referencedPacket.header.packet_id })],
  });
  const rootPacketV2 = createElementPacket({
    packet_id: rootPacketV1.header.packet_id,
    revision_id: 'nexus:element/root-packet@r2',
    kind: 'service',
    name: 'Root Packet v2',
    authority_scope_ref: { packet_id: cityPacket.header.packet_id },
    applicable_scope_refs: [{ packet_id: cityPacket.header.packet_id }],
    parent_revision_refs: [
      {
        packet_id: rootPacketV1.header.packet_id,
        revision_id: rootPacketV1.header.revision_id,
      },
    ],
    edges: [createPacketEdge('references', { packet_id: referencedPacket.header.packet_id })],
  });
  const referrerPacket = createElementPacket({
    packet_id: 'nexus:element/referrer-packet',
    revision_id: 'nexus:element/referrer-packet@r1',
    kind: 'organization',
    name: 'Referrer Packet',
    edges: [createPacketEdge('references', { packet_id: rootPacketV1.header.packet_id })],
  });

  return {
    nationPacket,
    regionPacket,
    cityPacket,
    referencedPacket,
    rootPacketV1,
    rootPacketV2,
    referrerPacket,
  };
}

async function createExportTestServices(directory: string) {
  const queryServices = await createNodeSQLiteQueryServicesAsync({
    packetStore: new NodeSQLitePacketStore({
      databasePath: join(directory, 'owa-export.db'),
    }),
  });
  const fixture = createExportFixturePackets();

  await queryServices.packetStore.writeRevision(fixture.nationPacket);
  await queryServices.packetStore.writeRevision(fixture.regionPacket);
  await queryServices.packetStore.writeRevision(fixture.cityPacket);
  await queryServices.packetStore.writeRevision(fixture.referencedPacket);
  await queryServices.packetStore.writeRevision(fixture.rootPacketV1);
  await queryServices.packetStore.writeRevision(fixture.rootPacketV2);
  await queryServices.packetStore.writeRevision(fixture.referrerPacket);

  return {
    queryServices,
    services: queryServices,
    fixture,
  };
}

async function createServiceSignerPacket(input: {
  packetId: string;
  createdAt: string;
}) {
  const keyPair = await generateP256KeyPair();
  const jwkPair = await exportIdentityKeyPairToJwk(keyPair);
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: jwkPair.publicJwk,
    addedAt: input.createdAt,
  });
  const packet = createElementPacket({
    packet_id: input.packetId,
    revision_id: `${input.packetId}@r1`,
    created_at: input.createdAt,
    kind: 'service',
    name: 'Export Signer',
    subtype: 'local_validator',
    identity: {
      alias: 'Export Signer',
      claim_status: 'claimed',
      location_disclosure: null,
      public_key_bindings: [keyBinding],
    },
  });

  return {
    keyPair,
    keyBinding,
    packet: await signPacketWithIdentity({
      packet,
      signerPacketId: input.packetId,
      kid: keyBinding.kid,
      privateKey: keyPair.privateKey,
      signedAt: input.createdAt,
    }),
  };
}

test('raw packet export previews the current preferred revision envelope', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-export-'));
  const { queryServices, services, fixture } = await createExportTestServices(
    directory
  );

  try {
    const preview = await buildNexusPacketExplorerExportPreview({
      services,
      requestBody: {
        artifact_mode: 'raw_packet',
        root_packet_id: fixture.rootPacketV1.header.packet_id,
      },
    });

    assert.equal(preview.artifact_mode, 'raw_packet');
    assert.equal(preview.revision_count, 1);
    assert.equal(preview.preview_suppressed, false);

    const parsedPacket = JSON.parse(preview.preview_json ?? 'null') as {
      header: { revision_id: string };
    };

    assert.equal(parsedPacket.header.revision_id, fixture.rootPacketV2.header.revision_id);
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('bundle export can include references, referrers, and the scope stack', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-export-'));
  const { queryServices, services, fixture } = await createExportTestServices(
    directory
  );

  try {
    const preview = await buildNexusPacketExplorerExportPreview({
      services,
      requestBody: {
        artifact_mode: 'bundle',
        bundle_mode: 'with_references_referrers_scope_stack',
        root_packet_id: fixture.rootPacketV1.header.packet_id,
        title: 'Test bundle',
        note: 'Preview the connected packet neighborhood.',
      },
    });

    assert.equal(preview.artifact_mode, 'bundle');
    assert.equal(preview.packet_count, 6);
    assert.equal(preview.revision_count, 7);

    const parsedBundle = JSON.parse(preview.preview_json ?? 'null') as {
      root_packet_refs: PacketRef[];
      packets: { header: { packet_id: string } }[];
    };
    const packetIds = new Set(
      parsedBundle.packets.map((packet) => packet.header.packet_id)
    );

    assert.deepEqual(parsedBundle.root_packet_refs, [
      { packet_id: fixture.rootPacketV1.header.packet_id },
    ]);
    assert.deepEqual(packetIds, new Set([
      fixture.rootPacketV1.header.packet_id,
      fixture.referencedPacket.header.packet_id,
      fixture.referrerPacket.header.packet_id,
      fixture.cityPacket.header.packet_id,
      fixture.regionPacket.header.packet_id,
      fixture.nationPacket.header.packet_id,
    ]));
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('full store export includes every known packet and revision', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-export-'));
  const { queryServices, services } = await createExportTestServices(directory);

  try {
    const preview = await buildNexusPacketExplorerExportPreview({
      services,
      requestBody: {
        artifact_mode: 'bundle',
        bundle_mode: 'full_store',
      },
    });

    assert.equal(preview.artifact_mode, 'bundle');
    assert.equal(preview.export_mode, 'full_store');
    assert.equal(preview.packet_count, 6);
    assert.equal(preview.revision_count, 7);
    assert.deepEqual(preview.root_packet_refs, []);
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('bundle export closure includes signer identity packets for signed packets', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-export-'));
  const queryServices = await createNodeSQLiteQueryServicesAsync({
    packetStore: new NodeSQLitePacketStore({
      databasePath: join(directory, 'owa-export-signer.db'),
    }),
  });
  const services = queryServices;
  const createdAt = '2026-05-12T00:00:00.000Z';

  try {
    const signer = await createServiceSignerPacket({
      packetId: 'nexus:element/export-validator',
      createdAt,
    });
    const signedPacket = await signPacketWithIdentity({
      packet: createElementPacket({
        packet_id: 'nexus:element/export-signed-target',
        revision_id: 'nexus:element/export-signed-target@r1',
        created_at: createdAt,
        kind: 'organization',
        name: 'Export Signed Target',
      }),
      signerPacketId: signer.packet.header.packet_id,
      kid: signer.keyBinding.kid,
      privateKey: signer.keyPair.privateKey,
      signedAt: createdAt,
    });

    await queryServices.packetStore.writeRevision(signer.packet);
    await queryServices.packetStore.writeRevision(signedPacket);

    const preview = await buildNexusPacketExplorerExportPreview({
      services,
      requestBody: {
        artifact_mode: 'bundle',
        bundle_mode: 'packet_history',
        root_packet_id: signedPacket.header.packet_id,
      },
    });
    const parsedBundle = JSON.parse(preview.preview_json ?? 'null') as {
      packets: { header: { packet_id: string } }[];
    };
    const packetIds = new Set(
      parsedBundle.packets.map((packet) => packet.header.packet_id)
    );

    assert.equal(packetIds.has(signedPacket.header.packet_id), true);
    assert.equal(packetIds.has(signer.packet.header.packet_id), true);
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
