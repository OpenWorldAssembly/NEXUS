/**
 * File: auth-service.store.ts
 * Description: Provides database-backed auth runtime storage operations for sessions, passkeys, challenges, and re-auth tokens.
 */

import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import type { NexusSecurityMode } from '@runtime/nexus/nexus-api-types';
import {
  AUTH_RECORD_RETENTION_MS,
  AUTH_REFRESH_COOKIE,
  AUTH_REFRESH_TTL_MS,
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_TTL_MS,
  DEFAULT_SECURITY_MODE,
  PASSKEY_CHALLENGE_TTL_MS,
  RATE_LIMIT_MAX_HITS,
  RATE_LIMIT_WINDOW_MS,
  REAUTH_TOKEN_TTL_MS,
  type AuthMethod,
  type AuthSessionRecord,
  type PasskeyRecord,
  type ReauthPurpose,
  type ReauthProofMethod,
  type ReauthTokenRecord,
  type RefreshTokenRecord,
  type SecurityPreferenceRecord,
  type WebAuthnChallengePurpose,
  type WebAuthnChallengeRecord,
  normalizeSecurityMode,
} from '@runtime/nexus/server/auth-service.types';
import { formatCookie } from '@runtime/nexus/server/auth-service.utils';

function ensureTableColumn(
  database: DatabaseSync,
  tableName: string,
  columnName: string,
  columnSql: string
): void {
  const columnRows = database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;
  const hasColumn = columnRows.some((column) => column.name === columnName);

  if (!hasColumn) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
  }
}

export class NexusAuthStore {
  constructor(private readonly databasePath: string) {}

  withDatabase<TValue>(run: (database: DatabaseSync) => TValue): TValue {
    const database = new DatabaseSync(this.databasePath);

    try {
      return run(database);
    } finally {
      database.close();
    }
  }

  ensureStorage(): void {
    this.withDatabase((database) => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS auth_passkeys (
          credential_id TEXT PRIMARY KEY,
          actor_packet_id TEXT NOT NULL,
          public_key_spki TEXT NOT NULL,
          sign_count INTEGER NOT NULL,
          transports_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          last_used_at TEXT,
          revoked_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_auth_passkeys_actor
          ON auth_passkeys(actor_packet_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS auth_identity_security (
          actor_packet_id TEXT PRIMARY KEY,
          security_mode TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_webauthn_challenges (
          challenge_id TEXT PRIMARY KEY,
          actor_packet_id TEXT,
          session_id TEXT,
          purpose TEXT NOT NULL,
          challenge TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_auth_webauthn_challenges_actor
          ON auth_webauthn_challenges(actor_packet_id, expires_at DESC);

        CREATE TABLE IF NOT EXISTS auth_reauth_tokens (
          reauth_token_id TEXT PRIMARY KEY,
          actor_packet_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          purpose TEXT NOT NULL,
          proof_method TEXT NOT NULL DEFAULT 'signed_reauth',
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used_at TEXT,
          revoked_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_auth_reauth_tokens_actor
          ON auth_reauth_tokens(actor_packet_id, expires_at DESC);

        CREATE TABLE IF NOT EXISTS auth_rate_limit_buckets (
          bucket_key TEXT PRIMARY KEY,
          window_started_at TEXT NOT NULL,
          hit_count INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_event_log (
          event_id TEXT PRIMARY KEY,
          actor_packet_id TEXT,
          session_id TEXT,
          credential_id TEXT,
          event_type TEXT NOT NULL,
          event_metadata_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);

      ensureTableColumn(
        database,
        'auth_reauth_tokens',
        'proof_method',
        `proof_method TEXT NOT NULL DEFAULT 'signed_reauth'`
      );
      ensureTableColumn(
        database,
        'auth_sessions',
        'device_label',
        `device_label TEXT NOT NULL DEFAULT 'Current device'`
      );
      ensureTableColumn(
        database,
        'auth_sessions',
        'auth_method',
        `auth_method TEXT NOT NULL DEFAULT 'bundle'`
      );
      ensureTableColumn(
        database,
        'auth_sessions',
        'csrf_token',
        `csrf_token TEXT NOT NULL DEFAULT ''`
      );
      ensureTableColumn(
        database,
        'auth_sessions',
        'requires_passkey_upgrade',
        'requires_passkey_upgrade INTEGER NOT NULL DEFAULT 0'
      );
    });
  }

  writeAuthEvent(input: {
    actorPacketId?: string | null;
    sessionId?: string | null;
    credentialId?: string | null;
    eventType: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.withDatabase((database) => {
      database
        .prepare(
          `
            INSERT INTO auth_event_log (
              event_id,
              actor_packet_id,
              session_id,
              credential_id,
              event_type,
              event_metadata_json,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          randomUUID(),
          input.actorPacketId ?? null,
          input.sessionId ?? null,
          input.credentialId ?? null,
          input.eventType,
          JSON.stringify(input.metadata ?? {}),
          new Date().toISOString()
        );
    });
  }

  enforceRateLimit(bucketKey: string): void {
    const now = new Date();
    const nowMs = now.getTime();
    const retentionBoundary = new Date(nowMs - AUTH_RECORD_RETENTION_MS).toISOString();

    this.withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        const existingRow = database
          .prepare(
            `
              SELECT bucket_key, window_started_at, hit_count, updated_at
              FROM auth_rate_limit_buckets
              WHERE bucket_key = ?
            `
          )
          .get(bucketKey) as
          | {
              bucket_key: string;
              window_started_at: string;
              hit_count: number;
              updated_at: string;
            }
          | undefined;
        const withinWindow =
          existingRow &&
          nowMs - new Date(existingRow.window_started_at).getTime() < RATE_LIMIT_WINDOW_MS;

        if (withinWindow && (existingRow?.hit_count ?? 0) >= RATE_LIMIT_MAX_HITS) {
          throw new Error('Too many auth requests. Please slow down and try again.');
        }

        if (existingRow && withinWindow) {
          database
            .prepare(
              `
                UPDATE auth_rate_limit_buckets
                SET hit_count = ?, updated_at = ?
                WHERE bucket_key = ?
              `
            )
            .run((existingRow.hit_count ?? 0) + 1, now.toISOString(), bucketKey);
        } else {
          database
            .prepare(
              `
                INSERT INTO auth_rate_limit_buckets (
                  bucket_key,
                  window_started_at,
                  hit_count,
                  updated_at
                ) VALUES (?, ?, ?, ?)
                ON CONFLICT(bucket_key) DO UPDATE SET
                  window_started_at = excluded.window_started_at,
                  hit_count = excluded.hit_count,
                  updated_at = excluded.updated_at
              `
            )
            .run(bucketKey, now.toISOString(), 1, now.toISOString());
        }

        database
          .prepare(
            `
              DELETE FROM auth_rate_limit_buckets
              WHERE updated_at < ?
            `
          )
          .run(retentionBoundary);

        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });
  }

  cleanupExpiredRecords(): void {
    const nowIso = new Date().toISOString();
    const retentionBoundary = new Date(
      Date.now() - AUTH_RECORD_RETENTION_MS
    ).toISOString();

    this.withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        database.prepare('DELETE FROM auth_sign_in_challenges WHERE expires_at < ?').run(nowIso);
        database.prepare('DELETE FROM auth_webauthn_challenges WHERE expires_at < ?').run(nowIso);
        database
          .prepare(
            'DELETE FROM auth_reauth_tokens WHERE expires_at < ? OR used_at IS NOT NULL OR revoked_at IS NOT NULL'
          )
          .run(nowIso);
        database
          .prepare('DELETE FROM auth_sessions WHERE expires_at < ? OR revoked_at IS NOT NULL')
          .run(retentionBoundary);
        database
          .prepare('DELETE FROM auth_refresh_tokens WHERE expires_at < ? OR revoked_at IS NOT NULL')
          .run(retentionBoundary);
        database.prepare('DELETE FROM auth_event_log WHERE created_at < ?').run(retentionBoundary);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });
  }

  ensureSecurityPreference(actorPacketId: string): void {
    this.withDatabase((database) => {
      database
        .prepare(
          `
            INSERT INTO auth_identity_security (
              actor_packet_id,
              security_mode,
              updated_at
            ) VALUES (?, ?, ?)
            ON CONFLICT(actor_packet_id) DO NOTHING
          `
        )
        .run(actorPacketId, DEFAULT_SECURITY_MODE, new Date().toISOString());
    });
  }

  readSecurityPreference(actorPacketId: string): SecurityPreferenceRecord {
    const record = this.withDatabase((database) =>
      database
        .prepare(
          `
            SELECT actor_packet_id, security_mode, updated_at
            FROM auth_identity_security
            WHERE actor_packet_id = ?
          `
        )
        .get(actorPacketId) as SecurityPreferenceRecord | undefined
    );

    return (
      record ?? {
        actor_packet_id: actorPacketId,
        security_mode: DEFAULT_SECURITY_MODE,
        updated_at: new Date().toISOString(),
      }
    );
  }

  getNormalizedSecurityMode(actorPacketId: string): NexusSecurityMode {
    return normalizeSecurityMode(this.readSecurityPreference(actorPacketId).security_mode);
  }

  countActivePasskeys(actorPacketId: string): number {
    return this.withDatabase((database) =>
      (
        database
          .prepare(
            `
              SELECT COUNT(*) AS passkey_count
              FROM auth_passkeys
              WHERE actor_packet_id = ?
                AND revoked_at IS NULL
            `
          )
          .get(actorPacketId) as { passkey_count?: number } | undefined
      )?.passkey_count ?? 0
    );
  }

  listActivePasskeys(actorPacketId: string): PasskeyRecord[] {
    return this.withDatabase((database) =>
      database
        .prepare(
          `
            SELECT credential_id, actor_packet_id, public_key_spki, sign_count, transports_json, created_at, last_used_at, revoked_at
            FROM auth_passkeys
            WHERE actor_packet_id = ?
              AND revoked_at IS NULL
            ORDER BY created_at DESC
          `
        )
        .all(actorPacketId) as PasskeyRecord[]
    );
  }

  listAllActivePasskeys(): PasskeyRecord[] {
    return this.withDatabase((database) =>
      database
        .prepare(
          `
            SELECT credential_id, actor_packet_id, public_key_spki, sign_count, transports_json, created_at, last_used_at, revoked_at
            FROM auth_passkeys
            WHERE revoked_at IS NULL
            ORDER BY created_at DESC
          `
        )
        .all() as PasskeyRecord[]
    );
  }

  readPasskey(credentialId: string): PasskeyRecord | null {
    return this.withDatabase((database) =>
      (
        database
          .prepare(
            `
              SELECT credential_id, actor_packet_id, public_key_spki, sign_count, transports_json, created_at, last_used_at, revoked_at
              FROM auth_passkeys
              WHERE credential_id = ?
            `
          )
          .get(credentialId) as PasskeyRecord | undefined
      ) ?? null
    );
  }

  createSessionRecord(input: {
    actorPacketId: string;
    keepMeLoggedIn: boolean;
    deviceLabel: string;
    authMethod: AuthMethod;
    requiresPasskeyUpgrade: boolean;
  }): {
    sessionRecord: AuthSessionRecord;
    refreshRecord: RefreshTokenRecord | null;
    setCookieHeaders: string[];
    reusedExistingPersistentSession: boolean;
  } {
    const now = new Date();
    const csrfToken = randomUUID();
    const sessionExpiresAt = new Date(now.getTime() + AUTH_SESSION_TTL_MS).toISOString();
    const refreshExpiresAt = new Date(now.getTime() + AUTH_REFRESH_TTL_MS).toISOString();
    let sessionRecord: AuthSessionRecord | null = null;
    let refreshRecord: RefreshTokenRecord | null = null;
    let reusedExistingPersistentSession = false;

    this.withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        if (input.keepMeLoggedIn) {
          const existingSession = database
            .prepare(
              `
                SELECT session_id, actor_packet_id, created_at, expires_at, last_seen_at, revoked_at, persistent_login, device_label, auth_method, csrf_token, requires_passkey_upgrade
                FROM auth_sessions
                WHERE actor_packet_id = ?
                  AND persistent_login = 1
                  AND device_label = ?
                  AND revoked_at IS NULL
                ORDER BY last_seen_at DESC, created_at DESC
                LIMIT 1
              `
            )
            .get(input.actorPacketId, input.deviceLabel) as AuthSessionRecord | undefined;

          if (existingSession) {
            reusedExistingPersistentSession = true;

            database
              .prepare(
                `
                  UPDATE auth_sessions
                  SET expires_at = ?,
                      last_seen_at = ?,
                      auth_method = ?,
                      csrf_token = ?,
                      requires_passkey_upgrade = ?,
                      revoked_at = NULL
                  WHERE session_id = ?
                `
              )
              .run(
                sessionExpiresAt,
                now.toISOString(),
                input.authMethod,
                csrfToken,
                input.requiresPasskeyUpgrade ? 1 : 0,
                existingSession.session_id
              );
            database
              .prepare(
                `
                  UPDATE auth_sessions
                  SET revoked_at = ?
                  WHERE actor_packet_id = ?
                    AND persistent_login = 1
                    AND device_label = ?
                    AND session_id != ?
                    AND revoked_at IS NULL
                `
              )
              .run(
                now.toISOString(),
                input.actorPacketId,
                input.deviceLabel,
                existingSession.session_id
              );
            database
              .prepare(
                `
                  UPDATE auth_refresh_tokens
                  SET revoked_at = ?
                  WHERE actor_packet_id = ?
                    AND session_id != ?
                    AND revoked_at IS NULL
                `
              )
              .run(
                now.toISOString(),
                input.actorPacketId,
                existingSession.session_id
              );

            const existingRefresh = database
              .prepare(
                `
                  SELECT refresh_token_id, session_id, actor_packet_id, created_at, expires_at, revoked_at
                  FROM auth_refresh_tokens
                  WHERE actor_packet_id = ?
                    AND session_id = ?
                    AND revoked_at IS NULL
                  ORDER BY created_at DESC
                  LIMIT 1
                `
              )
              .get(
                input.actorPacketId,
                existingSession.session_id
              ) as RefreshTokenRecord | undefined;

            if (existingRefresh) {
              database
                .prepare(
                  `
                    UPDATE auth_refresh_tokens
                    SET expires_at = ?,
                        revoked_at = NULL
                    WHERE refresh_token_id = ?
                  `
                )
                .run(refreshExpiresAt, existingRefresh.refresh_token_id);
              database
                .prepare(
                  `
                    UPDATE auth_refresh_tokens
                    SET revoked_at = ?
                    WHERE actor_packet_id = ?
                      AND session_id = ?
                      AND refresh_token_id != ?
                      AND revoked_at IS NULL
                  `
                )
                .run(
                  now.toISOString(),
                  input.actorPacketId,
                  existingSession.session_id,
                  existingRefresh.refresh_token_id
                );

              refreshRecord = {
                ...existingRefresh,
                expires_at: refreshExpiresAt,
                revoked_at: null,
              };
            } else {
              const refreshTokenId = randomUUID();

              database
                .prepare(
                  `
                    INSERT INTO auth_refresh_tokens (
                      refresh_token_id,
                      session_id,
                      actor_packet_id,
                      created_at,
                      expires_at,
                      revoked_at
                    ) VALUES (?, ?, ?, ?, ?, NULL)
                  `
                )
                .run(
                  refreshTokenId,
                  existingSession.session_id,
                  input.actorPacketId,
                  now.toISOString(),
                  refreshExpiresAt
                );

              refreshRecord = {
                refresh_token_id: refreshTokenId,
                session_id: existingSession.session_id,
                actor_packet_id: input.actorPacketId,
                created_at: now.toISOString(),
                expires_at: refreshExpiresAt,
                revoked_at: null,
              };
            }

            sessionRecord = {
              ...existingSession,
              expires_at: sessionExpiresAt,
              last_seen_at: now.toISOString(),
              revoked_at: null,
              auth_method: input.authMethod,
              csrf_token: csrfToken,
              requires_passkey_upgrade: input.requiresPasskeyUpgrade ? 1 : 0,
            };
          }
        }

        if (!sessionRecord) {
          const sessionId = randomUUID();

          database
            .prepare(
              `
                INSERT INTO auth_sessions (
                  session_id,
                  actor_packet_id,
                  created_at,
                  expires_at,
                  last_seen_at,
                  revoked_at,
                  persistent_login,
                  device_label,
                  auth_method,
                  csrf_token,
                  requires_passkey_upgrade
                ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
              `
            )
            .run(
              sessionId,
              input.actorPacketId,
              now.toISOString(),
              sessionExpiresAt,
              now.toISOString(),
              input.keepMeLoggedIn ? 1 : 0,
              input.deviceLabel,
              input.authMethod,
              csrfToken,
              input.requiresPasskeyUpgrade ? 1 : 0
            );

          sessionRecord = {
            session_id: sessionId,
            actor_packet_id: input.actorPacketId,
            created_at: now.toISOString(),
            expires_at: sessionExpiresAt,
            last_seen_at: now.toISOString(),
            revoked_at: null,
            persistent_login: input.keepMeLoggedIn ? 1 : 0,
            device_label: input.deviceLabel,
            auth_method: input.authMethod,
            csrf_token: csrfToken,
            requires_passkey_upgrade: input.requiresPasskeyUpgrade ? 1 : 0,
          };

          if (input.keepMeLoggedIn) {
            const refreshTokenId = randomUUID();

            database
              .prepare(
                `
                  INSERT INTO auth_refresh_tokens (
                    refresh_token_id,
                    session_id,
                    actor_packet_id,
                    created_at,
                    expires_at,
                    revoked_at
                  ) VALUES (?, ?, ?, ?, ?, NULL)
                `
              )
              .run(
                refreshTokenId,
                sessionId,
                input.actorPacketId,
                now.toISOString(),
                refreshExpiresAt
              );

            refreshRecord = {
              refresh_token_id: refreshTokenId,
              session_id: sessionId,
              actor_packet_id: input.actorPacketId,
              created_at: now.toISOString(),
              expires_at: refreshExpiresAt,
              revoked_at: null,
            };
          }
        }

        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });

    if (!sessionRecord) {
      throw new Error('Session creation did not produce a session record.');
    }

    const finalSessionRecord = sessionRecord as AuthSessionRecord;
    const finalRefreshRecord = refreshRecord as RefreshTokenRecord | null;

    return {
      sessionRecord: finalSessionRecord,
      refreshRecord: finalRefreshRecord,
      setCookieHeaders: [
        formatCookie({
          name: AUTH_SESSION_COOKIE,
          value: finalSessionRecord.session_id,
          maxAgeSeconds: input.keepMeLoggedIn
            ? Math.floor(AUTH_SESSION_TTL_MS / 1000)
            : null,
        }),
        ...(finalRefreshRecord
          ? [
              formatCookie({
                name: AUTH_REFRESH_COOKIE,
                value: finalRefreshRecord.refresh_token_id,
                maxAgeSeconds: Math.floor(AUTH_REFRESH_TTL_MS / 1000),
              }),
            ]
          : []),
      ],
      reusedExistingPersistentSession,
    };
  }

  readSessionRecord(sessionId: string): AuthSessionRecord | null {
    return this.withDatabase((database) =>
      (
        database
          .prepare(
            `
              SELECT session_id, actor_packet_id, created_at, expires_at, last_seen_at, revoked_at, persistent_login, device_label, auth_method, csrf_token, requires_passkey_upgrade
              FROM auth_sessions
              WHERE session_id = ?
            `
          )
          .get(sessionId) as AuthSessionRecord | undefined
      ) ?? null
    );
  }

  readRefreshTokenRecord(refreshTokenId: string): RefreshTokenRecord | null {
    return this.withDatabase((database) =>
      (
        database
          .prepare(
            `
              SELECT refresh_token_id, session_id, actor_packet_id, created_at, expires_at, revoked_at
              FROM auth_refresh_tokens
              WHERE refresh_token_id = ?
            `
          )
          .get(refreshTokenId) as RefreshTokenRecord | undefined
      ) ?? null
    );
  }

  rotateRefreshSessionRecord(input: {
    refreshRecord: RefreshTokenRecord;
  }): {
    sessionRecord: AuthSessionRecord;
    refreshRecord: RefreshTokenRecord;
    setCookieHeaders: string[];
  } | null {
    const now = new Date();
    const nextRefreshTokenId = randomUUID();
    const nextSessionExpiresAt = new Date(
      now.getTime() + AUTH_SESSION_TTL_MS
    ).toISOString();
    const nextRefreshExpiresAt = new Date(
      now.getTime() + AUTH_REFRESH_TTL_MS
    ).toISOString();
    const nextCsrfToken = randomUUID();
    let sessionRecord: AuthSessionRecord | null = null;
    let refreshRecord: RefreshTokenRecord | null = null;

    this.withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        const existingSession = database
          .prepare(
            `
              SELECT session_id, actor_packet_id, created_at, expires_at, last_seen_at, revoked_at, persistent_login, device_label, auth_method, csrf_token, requires_passkey_upgrade
              FROM auth_sessions
              WHERE session_id = ?
            `
          )
          .get(input.refreshRecord.session_id) as AuthSessionRecord | undefined;

        if (!existingSession) {
          database.exec('COMMIT');
          return;
        }

        database
          .prepare(
            `
              UPDATE auth_refresh_tokens
              SET revoked_at = ?
              WHERE refresh_token_id = ?
            `
          )
          .run(now.toISOString(), input.refreshRecord.refresh_token_id);
        database
          .prepare(
            `
              UPDATE auth_sessions
              SET expires_at = ?,
                  last_seen_at = ?,
                  revoked_at = NULL,
                  auth_method = ?,
                  csrf_token = ?,
                  requires_passkey_upgrade = 0
              WHERE session_id = ?
            `
          )
          .run(
            nextSessionExpiresAt,
            now.toISOString(),
            'refresh',
            nextCsrfToken,
            existingSession.session_id
          );
        database
          .prepare(
            `
              INSERT INTO auth_refresh_tokens (
                refresh_token_id,
                session_id,
                actor_packet_id,
                created_at,
                expires_at,
                revoked_at
              ) VALUES (?, ?, ?, ?, ?, NULL)
            `
          )
          .run(
            nextRefreshTokenId,
            existingSession.session_id,
            input.refreshRecord.actor_packet_id,
            now.toISOString(),
            nextRefreshExpiresAt
          );
        database
          .prepare(
            `
              UPDATE auth_refresh_tokens
              SET revoked_at = ?
              WHERE actor_packet_id = ?
                AND session_id = ?
                AND refresh_token_id != ?
                AND revoked_at IS NULL
            `
          )
          .run(
            now.toISOString(),
            input.refreshRecord.actor_packet_id,
            existingSession.session_id,
            nextRefreshTokenId
          );

        sessionRecord = {
          ...existingSession,
          expires_at: nextSessionExpiresAt,
          last_seen_at: now.toISOString(),
          revoked_at: null,
          auth_method: 'refresh',
          csrf_token: nextCsrfToken,
          requires_passkey_upgrade: 0,
        };
        refreshRecord = {
          refresh_token_id: nextRefreshTokenId,
          session_id: existingSession.session_id,
          actor_packet_id: input.refreshRecord.actor_packet_id,
          created_at: now.toISOString(),
          expires_at: nextRefreshExpiresAt,
          revoked_at: null,
        };

        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });

    if (!sessionRecord || !refreshRecord) {
      return null;
    }

    const finalSessionRecord = sessionRecord as AuthSessionRecord;
    const finalRefreshRecord = refreshRecord as RefreshTokenRecord;

    return {
      sessionRecord: finalSessionRecord,
      refreshRecord: finalRefreshRecord,
      setCookieHeaders: [
        formatCookie({
          name: AUTH_SESSION_COOKIE,
          value: finalSessionRecord.session_id,
          maxAgeSeconds: Math.floor(AUTH_SESSION_TTL_MS / 1000),
        }),
        formatCookie({
          name: AUTH_REFRESH_COOKIE,
          value: finalRefreshRecord.refresh_token_id,
          maxAgeSeconds: Math.floor(AUTH_REFRESH_TTL_MS / 1000),
        }),
      ],
    };
  }

  touchSession(sessionId: string): void {
    this.withDatabase((database) => {
      database
        .prepare(
          `
            UPDATE auth_sessions
            SET last_seen_at = ?
            WHERE session_id = ?
          `
        )
        .run(new Date().toISOString(), sessionId);
    });
  }

  readWebAuthnChallenge(challengeId: string): WebAuthnChallengeRecord | null {
    return this.withDatabase((database) =>
      (
        database
          .prepare(
            `
              SELECT challenge_id, actor_packet_id, session_id, purpose, challenge, created_at, expires_at, used_at
              FROM auth_webauthn_challenges
              WHERE challenge_id = ?
            `
          )
          .get(challengeId) as WebAuthnChallengeRecord | undefined
      ) ?? null
    );
  }

  createWebAuthnChallenge(input: {
    actorPacketId?: string | null;
    sessionId?: string | null;
    purpose: WebAuthnChallengePurpose;
    challenge: string;
  }): WebAuthnChallengeRecord {
    const now = new Date();
    const record: WebAuthnChallengeRecord = {
      challenge_id: randomUUID(),
      actor_packet_id: input.actorPacketId ?? null,
      session_id: input.sessionId ?? null,
      purpose: input.purpose,
      challenge: input.challenge,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + PASSKEY_CHALLENGE_TTL_MS).toISOString(),
      used_at: null,
    };

    this.withDatabase((database) => {
      database
        .prepare(
          `
            INSERT INTO auth_webauthn_challenges (
              challenge_id,
              actor_packet_id,
              session_id,
              purpose,
              challenge,
              created_at,
              expires_at,
              used_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
          `
        )
        .run(
          record.challenge_id,
          record.actor_packet_id,
          record.session_id,
          record.purpose,
          record.challenge,
          record.created_at,
          record.expires_at
        );
    });

    return record;
  }

  createReauthToken(input: {
    actorPacketId: string;
    sessionId: string;
    purpose: ReauthPurpose;
    proofMethod: ReauthProofMethod;
  }): ReauthTokenRecord {
    const now = new Date();
    const record: ReauthTokenRecord = {
      reauth_token_id: randomUUID(),
      actor_packet_id: input.actorPacketId,
      session_id: input.sessionId,
      purpose: input.purpose,
      proof_method: input.proofMethod,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + REAUTH_TOKEN_TTL_MS).toISOString(),
      used_at: null,
      revoked_at: null,
    };

    this.withDatabase((database) => {
      database
        .prepare(
          `
            INSERT INTO auth_reauth_tokens (
              reauth_token_id,
              actor_packet_id,
              session_id,
              purpose,
              proof_method,
              created_at,
              expires_at,
              used_at,
              revoked_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
          `
        )
        .run(
          record.reauth_token_id,
          record.actor_packet_id,
          record.session_id,
          record.purpose,
          record.proof_method,
          record.created_at,
          record.expires_at
        );
    });

    return record;
  }

  consumeReauthToken(input: {
    actorPacketId: string;
    sessionId: string;
    reauthToken: string | null | undefined;
    purpose: ReauthPurpose;
  }): ReauthTokenRecord {
    const reauthToken = input.reauthToken;

    if (!reauthToken) {
      throw new Error('This action requires a fresh re-auth token.');
    }

    let consumedRecord: ReauthTokenRecord | null = null;

    this.withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        const record = database
          .prepare(
            `
              SELECT reauth_token_id, actor_packet_id, session_id, purpose, proof_method, created_at, expires_at, used_at, revoked_at
              FROM auth_reauth_tokens
              WHERE reauth_token_id = ?
            `
          )
          .get(reauthToken) as ReauthTokenRecord | undefined;

        if (!record) {
          throw new Error('That re-auth token is unknown.');
        }

        if (record.actor_packet_id !== input.actorPacketId || record.session_id !== input.sessionId) {
          throw new Error('That re-auth token does not belong to this session.');
        }

        if (record.purpose !== input.purpose) {
          throw new Error('That passkey re-auth token cannot be used for this action.');
        }

        if (record.revoked_at || record.used_at) {
          throw new Error('That passkey re-auth token has already been used.');
        }

        if (new Date(record.expires_at).getTime() < Date.now()) {
          throw new Error('That passkey re-auth token has expired.');
        }

        database
          .prepare(
            `
              UPDATE auth_reauth_tokens
              SET used_at = ?
              WHERE reauth_token_id = ?
            `
          )
          .run(new Date().toISOString(), reauthToken);
        consumedRecord = record;
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });

    if (!consumedRecord) {
      throw new Error('This action requires a fresh re-auth token.');
    }

    return consumedRecord;
  }

  listSessions(actorPacketId: string): AuthSessionRecord[] {
    return this.withDatabase((database) =>
      database
        .prepare(
          `
            SELECT session_id, actor_packet_id, created_at, expires_at, last_seen_at, revoked_at, persistent_login, device_label, auth_method, csrf_token, requires_passkey_upgrade
            FROM auth_sessions
            WHERE actor_packet_id = ?
            ORDER BY created_at DESC
          `
        )
        .all(actorPacketId) as AuthSessionRecord[]
    );
  }

  revokeSessions(input: {
    actorPacketId: string;
    currentSessionId: string;
    targetSessionId?: string | null;
    revokeOthers?: boolean;
  }): void {
    const revokedAt = new Date().toISOString();

    this.withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        if (input.revokeOthers) {
          database
            .prepare(
              `
                UPDATE auth_sessions
                SET revoked_at = ?
                WHERE actor_packet_id = ?
                  AND session_id != ?
                  AND revoked_at IS NULL
              `
            )
            .run(revokedAt, input.actorPacketId, input.currentSessionId);
          database
            .prepare(
              `
                UPDATE auth_refresh_tokens
                SET revoked_at = ?
                WHERE actor_packet_id = ?
                  AND session_id != ?
                  AND revoked_at IS NULL
              `
            )
            .run(revokedAt, input.actorPacketId, input.currentSessionId);
        } else if (input.targetSessionId) {
          database
            .prepare(
              `
                UPDATE auth_sessions
                SET revoked_at = ?
                WHERE actor_packet_id = ?
                  AND session_id = ?
              `
            )
            .run(revokedAt, input.actorPacketId, input.targetSessionId);
          database
            .prepare(
              `
                UPDATE auth_refresh_tokens
                SET revoked_at = ?
                WHERE actor_packet_id = ?
                  AND session_id = ?
              `
            )
            .run(revokedAt, input.actorPacketId, input.targetSessionId);
        }

        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });
  }

  revokeCurrentSession(input: {
    sessionId: string;
    refreshTokenId?: string | null;
  }): void {
    const revokedAt = new Date().toISOString();

    this.withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        database
          .prepare(
            `
              UPDATE auth_sessions
              SET revoked_at = ?
              WHERE session_id = ?
            `
          )
          .run(revokedAt, input.sessionId);

        if (input.refreshTokenId) {
          database
            .prepare(
              `
                UPDATE auth_refresh_tokens
                SET revoked_at = ?
                WHERE refresh_token_id = ?
              `
            )
            .run(revokedAt, input.refreshTokenId);
        }

        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });
  }

  updateSecurityPreference(actorPacketId: string, securityMode: NexusSecurityMode): void {
    this.withDatabase((database) => {
      database
        .prepare(
          `
            INSERT INTO auth_identity_security (
              actor_packet_id,
              security_mode,
              updated_at
            ) VALUES (?, ?, ?)
            ON CONFLICT(actor_packet_id) DO UPDATE SET
              security_mode = excluded.security_mode,
              updated_at = excluded.updated_at
          `
        )
        .run(actorPacketId, securityMode, new Date().toISOString());
    });
  }

  revokePasskey(actorPacketId: string, credentialId: string): void {
    this.withDatabase((database) => {
      database
        .prepare(
          `
            UPDATE auth_passkeys
            SET revoked_at = ?
            WHERE actor_packet_id = ?
              AND credential_id = ?
          `
        )
        .run(new Date().toISOString(), actorPacketId, credentialId);
    });
  }
}
