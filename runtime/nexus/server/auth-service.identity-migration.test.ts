import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createPersonIdentityPacket,
} from '@core/packets/identity';
import {
  createActorAssertion,
  createIdentityKeyBinding,
  exportIdentityKeyPairToJwk,
  generateP256KeyPair,
  importPrivateKeyFromJwk,
  signPacketWithIdentity,
} from '@runtime/nexus/identity-crypto';
import { buildSignedMigratedIdentityPacket } from '@runtime/nexus/identity-migration';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

import { NexusAuthService } from './identity/auth-service.ts';

async function createLegacyMigrationFixture(input?: {
  packetId?: string;
  alias?: string;
}) {
  const createdAt = '2026-05-01T00:00:00.000Z';
  const keyPair = await generateP256KeyPair();
  const exportedKeys = await exportIdentityKeyPairToJwk(keyPair);
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: exportedKeys.publicJwk,
    addedAt: createdAt,
  });
  const legacyPacket = createPersonIdentityPacket({
    alias: input?.alias ?? 'Legacy Migrator',
    claimStatus: 'claimed',
    publicKeyBinding: keyBinding,
    packetId: input?.packetId ?? 'nexus:element/legacy-migrator',
    createdAt,
  });
  const migratedPacket = await buildSignedMigratedIdentityPacket({
    legacyActorPacket: legacyPacket,
    bundle: {
      actorPacket: legacyPacket,
      publicJwk: exportedKeys.publicJwk,
      privateJwk: exportedKeys.privateJwk,
    },
    createdAt: '2026-05-02T00:00:00.000Z',
  });
  const privateKey = await importPrivateKeyFromJwk(exportedKeys.privateJwk);
  const body = {
    migrated_actor_packet: migratedPacket,
    legacy_actor_packet_id: legacyPacket.header.packet_id,
  };
  const actorAssertion = await createActorAssertion({
    actorPacketId: migratedPacket.header.packet_id,
    kid: migratedPacket.body.identity?.public_key_bindings[0]?.kid ?? '',
    privateKey,
    method: 'POST',
    path: '/api/nexus/auth/migrate',
    body,
  });

  return {
    legacyPacket,
    migratedPacket,
    body,
    actorAssertion,
    keyPair,
    exportedKeys,
  };
}

async function createSignedCurrentIdentity(input: {
  packetId: string;
  alias: string;
}) {
  const createdAt = '2026-05-01T00:00:00.000Z';
  const keyPair = await generateP256KeyPair();
  const exportedKeys = await exportIdentityKeyPairToJwk(keyPair);
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: exportedKeys.publicJwk,
    addedAt: createdAt,
  });
  const packet = createPersonIdentityPacket({
    alias: input.alias,
    claimStatus: 'claimed',
    publicKeyBinding: keyBinding,
    packetId: input.packetId,
    createdAt,
  });

  return signPacketWithIdentity({
    packet,
    signerPacketId: packet.header.packet_id,
    kid: keyBinding.kid,
    privateKey: keyPair.privateKey,
    signedAt: createdAt,
  });
}

async function createAuthHarness() {
  const directory = mkdtempSync(join(tmpdir(), 'owa-auth-migration-'));
  const packetStore = new NodeSQLitePacketStore({
    databasePath: join(directory, 'owa-auth-migration.db'),
  });
  const authService = new NexusAuthService(packetStore);
  await authService.ensureStorage();

  return {
    authService,
    packetStore,
    cleanup() {
      packetStore.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test('auth service accepts a valid migrated identity packet', async () => {
  const harness = await createAuthHarness();
  const fixture = await createLegacyMigrationFixture();

  try {
    const actorPacket = await harness.authService.migrateIdentity({
      migratedActorPacket: fixture.migratedPacket,
      legacyActorPacketId: fixture.legacyPacket.header.packet_id,
      actorAssertion: fixture.actorAssertion,
    });

    assert.equal(actorPacket.header.packet_id, fixture.legacyPacket.header.packet_id);
    assert.equal(actorPacket.body.identity?.claim_status, 'claimed');
  } finally {
    harness.cleanup();
  }
});

test('auth service rejects migration with mismatched actor assertion body', async () => {
  const harness = await createAuthHarness();
  const fixture = await createLegacyMigrationFixture();

  try {
    await assert.rejects(
      harness.authService.migrateIdentity({
        migratedActorPacket: fixture.migratedPacket,
        legacyActorPacketId: 'nexus:element/different-legacy-id',
        actorAssertion: fixture.actorAssertion,
      }),
      /assertion verification failed/i
    );
  } finally {
    harness.cleanup();
  }
});

test('auth service rejects migration when policy is disabled', async () => {
  const harness = await createAuthHarness();
  const fixture = await createLegacyMigrationFixture();

  try {
    await assert.rejects(
      harness.authService.migrateIdentity({
        migratedActorPacket: fixture.migratedPacket,
        legacyActorPacketId: fixture.legacyPacket.header.packet_id,
        actorAssertion: fixture.actorAssertion,
        migrationPolicy: {
          enabled: false,
          migration_version: 1,
          legacy_window_label: 'test-disabled',
          sunset_after: null,
        },
      }),
      /not enabled/i
    );
  } finally {
    harness.cleanup();
  }
});

test('auth service allows idempotent repeat of the same migrated identity', async () => {
  const harness = await createAuthHarness();
  const fixture = await createLegacyMigrationFixture();

  try {
    await harness.authService.migrateIdentity({
      migratedActorPacket: fixture.migratedPacket,
      legacyActorPacketId: fixture.legacyPacket.header.packet_id,
      actorAssertion: fixture.actorAssertion,
    });
    const repeatedActorPacket = await harness.authService.migrateIdentity({
      migratedActorPacket: fixture.migratedPacket,
      legacyActorPacketId: fixture.legacyPacket.header.packet_id,
      actorAssertion: fixture.actorAssertion,
    });

    assert.equal(
      repeatedActorPacket.header.revision_id,
      fixture.migratedPacket.header.revision_id
    );
  } finally {
    harness.cleanup();
  }
});

test('auth service rejects migrated identity id collision', async () => {
  const harness = await createAuthHarness();
  const existingPacket = await createSignedCurrentIdentity({
    packetId: 'nexus:element/collision-user',
    alias: 'Collision One',
  });
  const fixture = await createLegacyMigrationFixture({
    packetId: 'nexus:element/collision-user',
    alias: 'Collision Two',
  });

  try {
    await harness.authService.createIdentity({
      actorPacket: existingPacket,
    });

    await assert.rejects(
      harness.authService.migrateIdentity({
        migratedActorPacket: fixture.migratedPacket,
        legacyActorPacketId: fixture.legacyPacket.header.packet_id,
        actorAssertion: fixture.actorAssertion,
      }),
      /collides/i
    );
  } finally {
    harness.cleanup();
  }
});
