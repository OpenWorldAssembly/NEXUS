import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPersonIdentityPacket,
} from '@core/packets/identity';
import {
  createIdentityKeyBinding,
  exportIdentityKeyPairToJwk,
  generateP256KeyPair,
  signPacketWithIdentity,
} from '@runtime/nexus/identity-crypto';
import {
  buildSignedMigratedIdentityPacket,
  classifyStoredIdentityForMigration,
} from '@runtime/nexus/identity-migration';
import type { StoredIdentityRecord } from '@runtime/nexus/identity-shell';

async function createLegacyStoredRecord(input?: {
  packetId?: string;
  signed?: boolean;
}): Promise<StoredIdentityRecord & { privateJwk: JsonWebKey }> {
  const createdAt = '2026-05-01T00:00:00.000Z';
  const keyPair = await generateP256KeyPair();
  const exportedKeys = await exportIdentityKeyPairToJwk(keyPair);
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: exportedKeys.publicJwk,
    addedAt: createdAt,
  });
  const packet = createPersonIdentityPacket({
    alias: 'Legacy User',
    claimStatus: 'claimed',
    publicKeyBinding: keyBinding,
    packetId: input?.packetId ?? 'nexus:element/legacy-user',
    createdAt,
    locationDisclosure: {
      scope: 'locality',
      value: 'Old Town',
    },
  });
  const actorPacket = input?.signed
    ? await signPacketWithIdentity({
        packet,
        signerPacketId: packet.header.packet_id,
        kid: keyBinding.kid,
        privateKey: keyPair.privateKey,
        signedAt: createdAt,
      })
    : packet;

  return {
    actor_packet_id: actorPacket.header.packet_id,
    alias: 'Legacy User',
    claim_status: 'claimed',
    stored_kind: 'claimed',
    actor_packet: actorPacket,
    public_jwk: exportedKeys.publicJwk,
    private_jwk: null,
    encrypted_bundle_json: '{}',
    updated_at: createdAt,
    privateJwk: exportedKeys.privateJwk,
  };
}

async function createSignedLegacyFamilyStoredRecord(): Promise<StoredIdentityRecord> {
  const record = await createLegacyStoredRecord({ signed: true });
  const { type: _type, ...headerWithoutType } = record.actor_packet.header;
  const {
    scope_system: _scopeSystem,
    status: _status,
    aliases: _aliases,
    display_aliases: _displayAliases,
    custody_hints: _custodyHints,
    ...bodyWithoutCurrentFields
  } = record.actor_packet.body;

  return {
    ...record,
    actor_packet: {
      header: {
        ...headerWithoutType,
        family: 'Element',
        schema_version: '1.0.0',
      },
      body: {
        ...bodyWithoutCurrentFields,
        subtype: 'claimed_identity',
      },
    } as unknown as StoredIdentityRecord['actor_packet'],
  };
}

test('identity migration classifies unsigned claimed stored identity as migration required', async () => {
  const record = await createLegacyStoredRecord();

  assert.equal(classifyStoredIdentityForMigration(record), 'migration_required');
});

test('identity migration classifies signed claimed stored identity as current', async () => {
  const record = await createLegacyStoredRecord({ signed: true });

  assert.equal(classifyStoredIdentityForMigration(record), 'current');
});

test('identity migration classifies signed legacy family identity as migration required', async () => {
  const record = await createSignedLegacyFamilyStoredRecord();

  assert.equal(classifyStoredIdentityForMigration(record), 'migration_required');
});

test('identity migration builds signed current claimed packet with reused id and custody hints', async () => {
  const record = await createLegacyStoredRecord();
  const migratedPacket = await buildSignedMigratedIdentityPacket({
    legacyActorPacket: record.actor_packet,
    bundle: {
      actorPacket: record.actor_packet,
      publicJwk: record.public_jwk,
      privateJwk: record.privateJwk,
    },
    createdAt: '2026-05-02T00:00:00.000Z',
  });

  assert.equal(migratedPacket.header.packet_id, record.actor_packet_id);
  assert.equal(migratedPacket.body.identity?.claim_status, 'claimed');
  assert.equal(
    migratedPacket.body.custody_hints?.migration &&
      (migratedPacket.body.custody_hints.migration as Record<string, unknown>)
        .legacy_actor_packet_id,
    record.actor_packet_id
  );
  assert.equal(
    migratedPacket.body.custody_hints?.migration &&
      (migratedPacket.body.custody_hints.migration as Record<string, unknown>)
        .packet_id_policy,
    'reused_legacy_id'
  );
  assert.equal(migratedPacket.header.integrity.embedded_signatures.length, 1);
});

test('identity migration records reminted custody when a tentative packet id is supplied', async () => {
  const record = await createLegacyStoredRecord();
  const migratedPacket = await buildSignedMigratedIdentityPacket({
    legacyActorPacket: record.actor_packet,
    bundle: {
      actorPacket: record.actor_packet,
      publicJwk: record.public_jwk,
      privateJwk: record.privateJwk,
    },
    tentativePacketId: 'nexus:element/migrated-testy-mcgee',
    createdAt: '2026-05-02T00:00:00.000Z',
  });

  assert.equal(migratedPacket.header.packet_id, 'nexus:element/migrated-testy-mcgee');
  assert.equal(
    migratedPacket.body.custody_hints?.migration &&
      (migratedPacket.body.custody_hints.migration as Record<string, unknown>)
        .legacy_actor_packet_id,
    record.actor_packet_id
  );
  assert.equal(
    migratedPacket.body.custody_hints?.migration &&
      (migratedPacket.body.custody_hints.migration as Record<string, unknown>)
        .packet_id_policy,
    'reminted_id'
  );
});

test('identity migration refuses to build while policy is disabled', async () => {
  const record = await createLegacyStoredRecord();

  await assert.rejects(
    buildSignedMigratedIdentityPacket({
      legacyActorPacket: record.actor_packet,
      bundle: {
        actorPacket: record.actor_packet,
        publicJwk: record.public_jwk,
        privateJwk: record.privateJwk,
      },
      migrationPolicy: {
        enabled: false,
        migration_version: 1,
        legacy_window_label: 'test-disabled',
        sunset_after: null,
      },
    }),
    /not enabled/i
  );
});

test('identity migration rejects unlocked bundle key mismatch', async () => {
  const record = await createLegacyStoredRecord();
  const otherRecord = await createLegacyStoredRecord({
    packetId: 'nexus:element/other-legacy-user',
  });

  await assert.rejects(
    buildSignedMigratedIdentityPacket({
      legacyActorPacket: record.actor_packet,
      bundle: {
        actorPacket: otherRecord.actor_packet,
        publicJwk: otherRecord.public_jwk,
        privateJwk: otherRecord.privateJwk,
      },
    }),
    /public key does not match/i
  );
});
