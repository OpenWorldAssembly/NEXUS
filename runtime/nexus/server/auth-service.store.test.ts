import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { PACKET_STORE_SCHEMA_SQL } from '@runtime/storage/packet-store-schema';
import { NexusAuthStore } from './auth-service.store.ts';

function createAuthStoreHarness() {
  const tempDirectory = mkdtempSync(join(tmpdir(), 'owa-auth-store-'));
  const databasePath = join(tempDirectory, 'owa-auth.db');
  const database = new DatabaseSync(databasePath);

  database.exec(PACKET_STORE_SCHEMA_SQL);
  database.close();

  const store = new NexusAuthStore(databasePath);
  store.ensureStorage();

  return {
    databasePath,
    store,
    cleanup() {
      rmSync(tempDirectory, { recursive: true, force: true });
    },
  };
}

test('remembered same-device sign-in reuses the existing persistent session', () => {
  const harness = createAuthStoreHarness();

  try {
    const firstSession = harness.store.createSessionRecord({
      actorPacketId: 'nexus:element/person-a',
      keepMeLoggedIn: true,
      deviceLabel: 'Device A',
      authMethod: 'bundle',
      requiresPasskeyUpgrade: false,
    });
    const secondSession = harness.store.createSessionRecord({
      actorPacketId: 'nexus:element/person-a',
      keepMeLoggedIn: true,
      deviceLabel: 'Device A',
      authMethod: 'passkey',
      requiresPasskeyUpgrade: false,
    });

    assert.equal(secondSession.reusedExistingPersistentSession, true);
    assert.equal(
      secondSession.sessionRecord.session_id,
      firstSession.sessionRecord.session_id
    );
    assert.equal(
      harness.store.listSessions('nexus:element/person-a').length,
      1
    );
  } finally {
    harness.cleanup();
  }
});

test('expired same-device remembered sessions are refreshed in place instead of multiplying', () => {
  const harness = createAuthStoreHarness();

  try {
    const firstSession = harness.store.createSessionRecord({
      actorPacketId: 'nexus:element/person-a',
      keepMeLoggedIn: true,
      deviceLabel: 'Device A',
      authMethod: 'bundle',
      requiresPasskeyUpgrade: false,
    });

    const database = new DatabaseSync(harness.databasePath);
    database
      .prepare(
        `
          UPDATE auth_sessions
          SET expires_at = ?
          WHERE session_id = ?
        `
      )
      .run('2000-01-01T00:00:00.000Z', firstSession.sessionRecord.session_id);
    database.close();

    const refreshedSession = harness.store.createSessionRecord({
      actorPacketId: 'nexus:element/person-a',
      keepMeLoggedIn: true,
      deviceLabel: 'Device A',
      authMethod: 'bundle',
      requiresPasskeyUpgrade: false,
    });

    assert.equal(refreshedSession.reusedExistingPersistentSession, true);
    assert.equal(
      refreshedSession.sessionRecord.session_id,
      firstSession.sessionRecord.session_id
    );
    assert.equal(
      harness.store.listSessions('nexus:element/person-a').length,
      1
    );
    assert.notEqual(
      refreshedSession.sessionRecord.expires_at,
      '2000-01-01T00:00:00.000Z'
    );
  } finally {
    harness.cleanup();
  }
});

test('refresh rotation keeps one persistent session instead of creating a new device session', () => {
  const harness = createAuthStoreHarness();

  try {
    const firstSession = harness.store.createSessionRecord({
      actorPacketId: 'nexus:element/person-a',
      keepMeLoggedIn: true,
      deviceLabel: 'Device A',
      authMethod: 'bundle',
      requiresPasskeyUpgrade: false,
    });

    const rotatedSession = harness.store.rotateRefreshSessionRecord({
      refreshRecord: firstSession.refreshRecord ?? (() => {
        throw new Error('Expected a remembered session refresh token.');
      })(),
    });

    assert.ok(rotatedSession);
    assert.equal(
      rotatedSession?.sessionRecord.session_id,
      firstSession.sessionRecord.session_id
    );
    assert.equal(
      harness.store.listSessions('nexus:element/person-a').length,
      1
    );
  } finally {
    harness.cleanup();
  }
});

test('reauth tokens persist and consume proof methods', () => {
  const harness = createAuthStoreHarness();

  try {
    const session = harness.store.createSessionRecord({
      actorPacketId: 'nexus:element/person-a',
      keepMeLoggedIn: true,
      deviceLabel: 'Device A',
      authMethod: 'bundle',
      requiresPasskeyUpgrade: false,
    });
    const token = harness.store.createReauthToken({
      actorPacketId: 'nexus:element/person-a',
      sessionId: session.sessionRecord.session_id,
      purpose: 'interaction',
      proofMethod: 'bundle_passphrase_unlock',
    });

    const consumed = harness.store.consumeReauthToken({
      actorPacketId: 'nexus:element/person-a',
      sessionId: session.sessionRecord.session_id,
      reauthToken: token.reauth_token_id,
      purpose: 'interaction',
    });

    assert.equal(consumed.proof_method, 'bundle_passphrase_unlock');
    assert.throws(
      () =>
        harness.store.consumeReauthToken({
          actorPacketId: 'nexus:element/person-a',
          sessionId: session.sessionRecord.session_id,
          reauthToken: token.reauth_token_id,
          purpose: 'interaction',
        }),
      /already been used/i
    );
  } finally {
    harness.cleanup();
  }
});

test('ensureStorage upgrades legacy reauth token tables with proof_method', () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), 'owa-auth-legacy-'));
  const databasePath = join(tempDirectory, 'owa-auth.db');
  const database = new DatabaseSync(databasePath);

  try {
    database.exec(PACKET_STORE_SCHEMA_SQL);
    database.exec('DROP TABLE auth_reauth_tokens');
    database.exec(`
      CREATE TABLE auth_reauth_tokens (
        reauth_token_id TEXT PRIMARY KEY,
        actor_packet_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        purpose TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        revoked_at TEXT
      );
    `);
    database.close();

    const store = new NexusAuthStore(databasePath);
    store.ensureStorage();

    const migratedDatabase = new DatabaseSync(databasePath);
    const columnNames = migratedDatabase
      .prepare(`PRAGMA table_info('auth_reauth_tokens')`)
      .all() as { name: string }[];

    assert.ok(columnNames.some((column) => column.name === 'proof_method'));
    migratedDatabase.close();
  } finally {
    try {
      database.close();
    } catch {}
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('security preferences default new identities to standard mode', () => {
  const harness = createAuthStoreHarness();

  try {
    harness.store.ensureSecurityPreference('nexus:element/person-standard');
    const securityPreference = harness.store.readSecurityPreference(
      'nexus:element/person-standard'
    );

    assert.equal(securityPreference.security_mode, 'standard');
  } finally {
    harness.cleanup();
  }
});
