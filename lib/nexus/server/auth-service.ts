/**
 * File: auth-service.ts
 * Description: Verifies cryptographic person identities and manages Nexus sessions, passkeys, re-auth tokens, and auth hardening.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import type { DiscussionActorClass } from '@/domain/schema/packet-schema';
import type { PacketEnvelope, PacketEnvelopeByType } from '@/domain/schema/packet-schema';
import { parsePacketEnvelope } from '@/domain/schema/packet-schema';
import type { ActorAssertion } from '@/lib/nexus/identity-crypto';
import { verifyActorAssertion, verifyPacketSignature } from '@/lib/nexus/identity-crypto';
import {
  normalizeDisplayAlias,
  validateDisplayAlias,
  validateLocationDisclosure,
} from '@/lib/nexus/identity-validation';
import type {
  NexusAuthSessionPayload,
  NexusPasskeyListPayload,
  NexusPasskeyRegistrationOptionsPayload,
  NexusPasskeyRequestOptionsPayload,
  NexusPasskeySummaryPayload,
  NexusPasskeyVerifyPayload,
  NexusReauthVerifyPayload,
  NexusSecurityMode,
  NexusSecurityPreferencesPayload,
  NexusSessionListPayload,
} from '@/lib/nexus/nexus-api-types';
import {
  createWebAuthnRegistrationOptions,
  createWebAuthnRequestOptions,
  encodeBase64Url,
  getRequestOrigin,
  getRequestRpId,
  verifyPasskeyAssertion,
  verifyPasskeyRegistration,
  type SerializedPasskeyAssertionCredential,
  type SerializedPasskeyRegistrationCredential,
} from '@/lib/nexus/server/auth-webauthn';
import type { NodeSQLitePacketStore } from '@/storage/node-sqlite-packet-store';

const AUTH_SESSION_COOKIE = 'owa_nexus_session';
const AUTH_REFRESH_COOKIE = 'owa_nexus_refresh';
const SIGN_IN_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const REAUTH_TOKEN_TTL_MS = 5 * 60 * 1000;
const AUTH_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const AUTH_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACTOR_ASSERTION_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_HITS = 20;
const AUTH_RECORD_RETENTION_MS = 45 * 24 * 60 * 60 * 1000;
const DEFAULT_SECURITY_MODE: NexusSecurityMode = 'guarded';

const LEGACY_SECURITY_MODE_MAP: Record<string, NexusSecurityMode> = {
  remembered: 'standard',
  high_security: 'guarded',
  interaction_lock: 'every_write',
};

type AuthMethod = 'bundle' | 'passkey' | 'refresh';
type WebAuthnChallengePurpose = 'register' | 'signin' | 'reauth';
type ReauthPurpose = 'sensitive' | 'interaction';

type AuthSessionRecord = {
  session_id: string;
  actor_packet_id: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  persistent_login: number;
  device_label: string;
  auth_method: AuthMethod;
  csrf_token: string;
  requires_passkey_upgrade: number;
};

type RefreshTokenRecord = {
  refresh_token_id: string;
  session_id: string;
  actor_packet_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
};

type PasskeyRecord = {
  credential_id: string;
  actor_packet_id: string;
  public_key_spki: string;
  sign_count: number;
  transports_json: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type SecurityPreferenceRecord = {
  actor_packet_id: string;
  security_mode: string;
  updated_at: string;
};

type WebAuthnChallengeRecord = {
  challenge_id: string;
  actor_packet_id: string | null;
  session_id: string | null;
  purpose: WebAuthnChallengePurpose;
  challenge: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

type ReauthTokenRecord = {
  reauth_token_id: string;
  actor_packet_id: string;
  session_id: string;
  purpose: ReauthPurpose;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
};

function normalizeSecurityMode(value: string | null | undefined): NexusSecurityMode {
  if (value === 'standard' || value === 'guarded' || value === 'every_write') {
    return value;
  }

  if (value && value in LEGACY_SECURITY_MODE_MAP) {
    return LEGACY_SECURITY_MODE_MAP[value];
  }

  return DEFAULT_SECURITY_MODE;
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.includes('='))
      .map((part) => {
        const separatorIndex = part.indexOf('=');

        return [
          part.slice(0, separatorIndex),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ];
      })
  );
}

function formatCookie(input: {
  name: string;
  value: string;
  maxAgeSeconds?: number | null;
}): string {
  const parts = [
    `${input.name}=${encodeURIComponent(input.value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];

  if (typeof input.maxAgeSeconds === 'number') {
    parts.push(`Max-Age=${input.maxAgeSeconds}`);
  }

  return parts.join('; ');
}

function createExpiredCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

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

function assertRecentAssertion(issuedAt: string): void {
  const issuedAtTime = new Date(issuedAt).getTime();

  if (!Number.isFinite(issuedAtTime)) {
    throw new Error('Actor assertion timestamp is invalid.');
  }

  if (Math.abs(Date.now() - issuedAtTime) > ACTOR_ASSERTION_TTL_MS) {
    throw new Error('Actor assertion has expired.');
  }
}

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

function toPasskeySummary(record: PasskeyRecord): NexusPasskeySummaryPayload {
  return {
    credential_id: record.credential_id,
    created_at: record.created_at,
    last_used_at: record.last_used_at,
    transports: parseJson<string[]>(record.transports_json, []),
    revoked_at: record.revoked_at,
  };
}

function isPersonElementPacket(
  packet: PacketEnvelope | null | undefined
): packet is PacketEnvelopeByType['Element'] {
  if (!packet || packet.header.family !== 'Element') {
    return false;
  }

  const elementPacket = packet as PacketEnvelopeByType['Element'];

  return elementPacket.body.kind === 'person';
}

function validateIdentityPacketMetadata(
  actorPacket: PacketEnvelopeByType['Element']
): void {
  const normalizedAlias = normalizeDisplayAlias(
    actorPacket.body.identity?.alias ?? actorPacket.body.name
  );
  const aliasError = validateDisplayAlias(normalizedAlias);

  if (aliasError) {
    throw new Error(aliasError);
  }

  if ((actorPacket.body.identity?.alias ?? '') !== normalizedAlias) {
    throw new Error('Display alias must be normalized before it is saved.');
  }

  const locationError = validateLocationDisclosure(
    actorPacket.body.identity?.location_disclosure ?? null
  );

  if (locationError) {
    throw new Error(locationError);
  }
}

export class NexusAuthService {
  constructor(private readonly packetStore: NodeSQLitePacketStore) {}

  private withDatabase<TValue>(run: (database: DatabaseSync) => TValue): TValue {
    const database = new DatabaseSync(this.packetStore.databasePath);

    try {
      return run(database);
    } finally {
      database.close();
    }
  }

  async ensureStorage(): Promise<void> {
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

  private writeAuthEvent(input: {
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

  private enforceRateLimit(bucketKey: string): void {
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

  private cleanupExpiredRecords(): void {
    const nowIso = new Date().toISOString();
    const retentionBoundary = new Date(
      Date.now() - AUTH_RECORD_RETENTION_MS
    ).toISOString();

    this.withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        database
          .prepare(
            `
              DELETE FROM auth_sign_in_challenges
              WHERE expires_at < ?
            `
          )
          .run(nowIso);
        database
          .prepare(
            `
              DELETE FROM auth_webauthn_challenges
              WHERE expires_at < ?
            `
          )
          .run(nowIso);
        database
          .prepare(
            `
              DELETE FROM auth_reauth_tokens
              WHERE expires_at < ?
                 OR used_at IS NOT NULL
                 OR revoked_at IS NOT NULL
            `
          )
          .run(nowIso);
        database
          .prepare(
            `
              DELETE FROM auth_sessions
              WHERE expires_at < ?
                 OR revoked_at IS NOT NULL
            `
          )
          .run(retentionBoundary);
        database
          .prepare(
            `
              DELETE FROM auth_refresh_tokens
              WHERE expires_at < ?
                 OR revoked_at IS NOT NULL
            `
          )
          .run(retentionBoundary);
        database
          .prepare(
            `
              DELETE FROM auth_event_log
              WHERE created_at < ?
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

  private async getPersonPacket(
    packetId: string
  ): Promise<PacketEnvelopeByType['Element'] | null> {
    const packet = await this.packetStore.fetchByPacket({ packet_id: packetId });

    if (!isPersonElementPacket(packet)) {
      return null;
    }

    return packet;
  }

  private async requirePersonPacket(
    packetId: string
  ): Promise<PacketEnvelopeByType['Element']> {
    const packet = await this.getPersonPacket(packetId);

    if (!packet) {
      throw new Error(`Unknown person identity: ${packetId}`);
    }

    return packet;
  }

  private async ensureSecurityPreference(actorPacketId: string): Promise<void> {
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

  private readSecurityPreference(actorPacketId: string): SecurityPreferenceRecord {
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

  private getNormalizedSecurityMode(actorPacketId: string): NexusSecurityMode {
    return normalizeSecurityMode(
      this.readSecurityPreference(actorPacketId).security_mode
    );
  }

  private countActivePasskeys(actorPacketId: string): number {
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

  private listActivePasskeys(actorPacketId: string): PasskeyRecord[] {
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

  private listAllActivePasskeys(): PasskeyRecord[] {
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

  private readPasskey(credentialId: string): PasskeyRecord | null {
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

  private createSessionRecord(input: {
    actorPacketId: string;
    keepMeLoggedIn: boolean;
    deviceLabel: string;
    authMethod: AuthMethod;
    requiresPasskeyUpgrade: boolean;
  }): {
    sessionRecord: AuthSessionRecord;
    refreshRecord: RefreshTokenRecord | null;
    setCookieHeaders: string[];
  } {
    const now = new Date();
    const sessionId = randomUUID();
    const refreshTokenId = randomUUID();
    const csrfToken = randomUUID();
    const sessionExpiresAt = new Date(now.getTime() + AUTH_SESSION_TTL_MS).toISOString();
    const refreshExpiresAt = new Date(now.getTime() + AUTH_REFRESH_TTL_MS).toISOString();

    this.withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
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

        if (input.keepMeLoggedIn) {
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
        }

        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });

    const sessionRecord: AuthSessionRecord = {
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
    const refreshRecord = input.keepMeLoggedIn
      ? {
          refresh_token_id: refreshTokenId,
          session_id: sessionId,
          actor_packet_id: input.actorPacketId,
          created_at: now.toISOString(),
          expires_at: refreshExpiresAt,
          revoked_at: null,
        }
      : null;

    return {
      sessionRecord,
      refreshRecord,
      setCookieHeaders: [
        formatCookie({
          name: AUTH_SESSION_COOKIE,
          value: sessionId,
          maxAgeSeconds: input.keepMeLoggedIn
            ? Math.floor(AUTH_SESSION_TTL_MS / 1000)
            : null,
        }),
        ...(refreshRecord
          ? [
              formatCookie({
                name: AUTH_REFRESH_COOKIE,
                value: refreshRecord.refresh_token_id,
                maxAgeSeconds: Math.floor(AUTH_REFRESH_TTL_MS / 1000),
              }),
            ]
          : []),
      ],
    };
  }

  private readSessionRecord(sessionId: string): AuthSessionRecord | null {
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

  private readRefreshTokenRecord(refreshTokenId: string): RefreshTokenRecord | null {
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

  private touchSession(sessionId: string): void {
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

  private async toAuthSessionPayload(input: {
    actorPacket: PacketEnvelopeByType['Element'] | null;
    sessionRecord: AuthSessionRecord | null;
    refreshRecord?: RefreshTokenRecord | null;
  }): Promise<NexusAuthSessionPayload> {
    const actorPacketId = input.actorPacket?.header.packet_id ?? null;
    const securityMode = actorPacketId
      ? this.getNormalizedSecurityMode(actorPacketId)
      : null;
    const hasPasskey = actorPacketId ? this.countActivePasskeys(actorPacketId) > 0 : false;

    return {
      is_authenticated: Boolean(input.actorPacket && input.sessionRecord),
      session_id: input.sessionRecord?.session_id ?? null,
      actor_packet_id: actorPacketId,
      actor_packet: input.actorPacket,
      session_expires_at: input.sessionRecord?.expires_at ?? null,
      refresh_expires_at: input.refreshRecord?.expires_at ?? null,
      csrf_token: input.sessionRecord?.csrf_token ?? null,
      auth_method: input.sessionRecord?.auth_method ?? null,
      security_mode: securityMode,
      has_passkey: hasPasskey,
      requires_passkey_upgrade: false,
      reauth_expires_at: null,
    };
  }

  private getSessionFromCookie(request: Request): {
    sessionRecord: AuthSessionRecord | null;
    sessionCookie: string | null;
  } {
    const cookies = parseCookieHeader(request.headers.get('cookie'));
    const sessionCookie = cookies[AUTH_SESSION_COOKIE] ?? null;

    if (!sessionCookie) {
      return {
        sessionRecord: null,
        sessionCookie: null,
      };
    }

    return {
      sessionRecord: this.readSessionRecord(sessionCookie),
      sessionCookie,
    };
  }

  private requireSameOrigin(request: Request): void {
    const origin = request.headers.get('origin');

    if (!origin) {
      throw new Error('Missing request origin for authenticated mutation.');
    }

    if (origin !== new URL(request.url).origin) {
      throw new Error('Authenticated mutation origin does not match this request host.');
    }
  }

  private requireAuthenticatedSession(input: {
    request: Request;
    actorPacketId?: string | null;
    csrfToken?: string | null;
    allowUpgradeSession?: boolean;
    requireCsrf?: boolean;
  }): AuthSessionRecord {
    const { sessionRecord } = this.getSessionFromCookie(input.request);

    if (!sessionRecord) {
      throw new Error('Claimed actions require an authenticated Nexus session.');
    }

    if (sessionRecord.revoked_at) {
      throw new Error('That Nexus session has been revoked.');
    }

    if (new Date(sessionRecord.expires_at).getTime() < Date.now()) {
      throw new Error('That Nexus session has expired. Refresh the session and try again.');
    }

    if (input.actorPacketId && sessionRecord.actor_packet_id !== input.actorPacketId) {
      throw new Error('Authenticated session actor does not match the claimed identity.');
    }

    if (input.requireCsrf ?? true) {
      this.requireSameOrigin(input.request);

      if (!input.csrfToken || input.csrfToken !== sessionRecord.csrf_token) {
        throw new Error('Authenticated mutation CSRF token does not match the active session.');
      }
    }

    this.touchSession(sessionRecord.session_id);

    return sessionRecord;
  }

  private readWebAuthnChallenge(challengeId: string): WebAuthnChallengeRecord | null {
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

  private createWebAuthnChallenge(input: {
    actorPacketId?: string | null;
    sessionId?: string | null;
    purpose: WebAuthnChallengePurpose;
  }): WebAuthnChallengeRecord {
    const now = new Date();
    const challenge: WebAuthnChallengeRecord = {
      challenge_id: randomUUID(),
      actor_packet_id: input.actorPacketId ?? null,
      session_id: input.sessionId ?? null,
      purpose: input.purpose,
      challenge: encodeBase64Url(randomBytes(32)),
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
          challenge.challenge_id,
          challenge.actor_packet_id,
          challenge.session_id,
          challenge.purpose,
          challenge.challenge,
          challenge.created_at,
          challenge.expires_at
        );
    });

    return challenge;
  }

  private createReauthToken(input: {
    actorPacketId: string;
    sessionId: string;
    purpose: ReauthPurpose;
  }): ReauthTokenRecord {
    const now = new Date();
    const record: ReauthTokenRecord = {
      reauth_token_id: randomUUID(),
      actor_packet_id: input.actorPacketId,
      session_id: input.sessionId,
      purpose: input.purpose,
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
              created_at,
              expires_at,
              used_at,
              revoked_at
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
          `
        )
        .run(
          record.reauth_token_id,
          record.actor_packet_id,
          record.session_id,
          record.purpose,
          record.created_at,
          record.expires_at
        );
    });

    return record;
  }

  private consumeReauthToken(input: {
    actorPacketId: string;
    sessionId: string;
    reauthToken: string | null | undefined;
    purpose: ReauthPurpose;
  }): void {
    const reauthToken = input.reauthToken;

    if (!reauthToken) {
      throw new Error('This action requires a fresh re-auth token.');
    }

    this.withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        const record = database
          .prepare(
            `
              SELECT reauth_token_id, actor_packet_id, session_id, purpose, created_at, expires_at, used_at, revoked_at
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
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });
  }

  private resolveDeviceLabel(input: {
    request: Request;
    preferredLabel?: string | null;
  }): string {
    if (input.preferredLabel && input.preferredLabel.trim().length > 0) {
      return input.preferredLabel.trim().slice(0, 120);
    }

    const userAgent =
      input.request.headers.get('x-device-label') ??
      input.request.headers.get('user-agent') ??
      'Current device';

    return userAgent.slice(0, 120);
  }

  private async verifyIdentityPacket(
    actorPacketInput: unknown
  ): Promise<PacketEnvelopeByType['Element']> {
    const packet = parsePacketEnvelope(actorPacketInput);

    if (!isPersonElementPacket(packet)) {
      throw new Error('Actor packet must be a person element.');
    }

    const actorPacket = packet;

    if (
      !actorPacket.body.identity ||
      actorPacket.body.identity.public_key_bindings.length === 0
    ) {
      throw new Error('Person element is missing public key bindings.');
    }

    const signatureIsValid = await verifyPacketSignature({
      packet: actorPacket,
      signerPacket: actorPacket,
    });

    if (!signatureIsValid) {
      throw new Error('Person element signature verification failed.');
    }

    validateIdentityPacketMetadata(actorPacket);

    return actorPacket;
  }

  private async persistVerifiedIdentityPacket(
    actorPacket: PacketEnvelopeByType['Element']
  ): Promise<PacketEnvelopeByType['Element']> {
    try {
      await this.packetStore.writeRevision(actorPacket);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('already exists')) {
        throw error;
      }
    }

    await this.packetStore.publishRevision({
      packet_id: actorPacket.header.packet_id,
      revision_id: actorPacket.header.revision_id,
    });
    await this.ensureSecurityPreference(actorPacket.header.packet_id);

    return actorPacket;
  }

  private async verifyAndPersistIdentityPacket(input: {
    actorPacket: unknown;
    ancestorPackets?: unknown[];
  }): Promise<PacketEnvelopeByType['Element']> {
    const actorPacket = await this.verifyIdentityPacket(input.actorPacket);

    for (const ancestorPacketInput of input.ancestorPackets ?? []) {
      const ancestorPacket = await this.verifyIdentityPacket(ancestorPacketInput);

      if (ancestorPacket.header.packet_id !== actorPacket.header.packet_id) {
        throw new Error('Identity ancestor packet id does not match the current actor.');
      }

      await this.persistVerifiedIdentityPacket(ancestorPacket);
    }

    return this.persistVerifiedIdentityPacket(actorPacket);
  }

  async createIdentity(input: {
    actorPacket: unknown;
  }): Promise<PacketEnvelopeByType['Element']> {
    const actorPacket = await this.verifyAndPersistIdentityPacket({
      actorPacket: input.actorPacket,
    });

    if (actorPacket.body.identity?.claim_status !== 'claimed') {
      throw new Error('Create identity requires a claimed person element.');
    }

    this.writeAuthEvent({
      actorPacketId: actorPacket.header.packet_id,
      eventType: 'identity_created',
    });

    return actorPacket;
  }

  async claimIdentity(input: {
    actorPacket: unknown;
    previousActorPacket?: unknown;
  }): Promise<PacketEnvelopeByType['Element']> {
    const actorPacket = await this.verifyAndPersistIdentityPacket({
      actorPacket: input.actorPacket,
      ancestorPackets: input.previousActorPacket ? [input.previousActorPacket] : [],
    });

    if (actorPacket.body.identity?.claim_status !== 'claimed') {
      throw new Error('Claim identity requires a claimed person element revision.');
    }

    this.writeAuthEvent({
      actorPacketId: actorPacket.header.packet_id,
      eventType: 'identity_claimed',
    });

    return actorPacket;
  }

  async restoreIdentity(input: {
    actorPacket: unknown;
  }): Promise<PacketEnvelopeByType['Element']> {
    const actorPacket = await this.verifyAndPersistIdentityPacket({
      actorPacket: input.actorPacket,
    });

    this.writeAuthEvent({
      actorPacketId: actorPacket.header.packet_id,
      eventType: 'identity_restored',
    });

    return actorPacket;
  }

  async verifyActorMutation(input: {
    request: Request;
    actorPacket: unknown;
    actorAssertion: ActorAssertion;
    method: 'POST' | 'PUT';
    path: string;
    body: Record<string, unknown>;
    csrfToken?: string | null;
    reauthToken?: string | null;
    writeRisk?: 'standard' | 'high_impact';
  }): Promise<{
    actorPacket: PacketEnvelopeByType['Element'];
    actorKey: string;
    actorClass: DiscussionActorClass;
  }> {
    assertRecentAssertion(input.actorAssertion.issued_at);

    const actorPacket = await this.verifyAndPersistIdentityPacket({
      actorPacket: input.actorPacket,
    });
    const activeKeyBinding = actorPacket.body.identity?.public_key_bindings.find(
      (binding) =>
        binding.kid === input.actorAssertion.kid && binding.status === 'active'
    );

    if (!activeKeyBinding) {
      throw new Error('Actor assertion key is not active for that identity.');
    }

    const assertionIsValid = await verifyActorAssertion({
      assertion: input.actorAssertion,
      publicJwk: activeKeyBinding.public_jwk as JsonWebKey,
      body: input.body,
    });

    if (!assertionIsValid) {
      throw new Error('Actor assertion verification failed.');
    }

    if (input.actorAssertion.method.toUpperCase() !== input.method) {
      throw new Error('Actor assertion method does not match this request.');
    }

    if (input.actorAssertion.path !== input.path) {
      throw new Error('Actor assertion path does not match this request.');
    }

    if (input.actorAssertion.actor_packet_id !== actorPacket.header.packet_id) {
      throw new Error('Actor assertion packet id does not match the actor packet.');
    }

    if (actorPacket.body.identity?.claim_status === 'claimed') {
      const sessionRecord = this.requireAuthenticatedSession({
        request: input.request,
        actorPacketId: actorPacket.header.packet_id,
        csrfToken: input.csrfToken,
      });
      const securityMode = this.getNormalizedSecurityMode(
        actorPacket.header.packet_id
      );

      if (
        securityMode === 'every_write' ||
        (securityMode === 'guarded' &&
          (input.writeRisk ?? 'standard') === 'high_impact')
      ) {
        this.consumeReauthToken({
          actorPacketId: actorPacket.header.packet_id,
          sessionId: sessionRecord.session_id,
          reauthToken: input.reauthToken,
          purpose: 'interaction',
        });
      }
    }

    return {
      actorPacket,
      actorKey: `element:${actorPacket.header.packet_id}`,
      actorClass:
        actorPacket.body.identity?.claim_status === 'claimed'
          ? 'scope_member'
          : 'anonymous_guest',
    };
  }

  async startSignInChallenge(input: {
    actorPacketId: string;
    rateLimitKey: string;
  }): Promise<{
    challenge_id: string;
    nonce: string;
    expires_at: string;
  }> {
    this.cleanupExpiredRecords();
    this.enforceRateLimit(`challenge:${input.rateLimitKey}`);

    const actorPacket = await this.requirePersonPacket(input.actorPacketId);

    if (actorPacket.body.identity?.claim_status !== 'claimed') {
      throw new Error('Only claimed identities can start a sign-in flow.');
    }

    const now = new Date();
    const challengeId = randomUUID();
    const nonce = randomUUID();
    const expiresAt = new Date(now.getTime() + SIGN_IN_CHALLENGE_TTL_MS).toISOString();

    this.withDatabase((database) => {
      database
        .prepare(
          `
            INSERT INTO auth_sign_in_challenges (
              challenge_id,
              actor_packet_id,
              nonce,
              created_at,
              expires_at,
              used_at
            ) VALUES (?, ?, ?, ?, ?, NULL)
          `
        )
        .run(
          challengeId,
          actorPacket.header.packet_id,
          nonce,
          now.toISOString(),
          expiresAt
        );
    });

    return {
      challenge_id: challengeId,
      nonce,
      expires_at: expiresAt,
    };
  }

  async verifySignInChallenge(input: {
    request: Request;
    actorAssertion: ActorAssertion;
    keepMeLoggedIn: boolean;
    challengeId: string;
    nonce: string;
    rateLimitKey: string;
    deviceLabel?: string | null;
  }): Promise<{
    session: NexusAuthSessionPayload;
    setCookieHeaders: string[];
  }> {
    this.cleanupExpiredRecords();
    this.enforceRateLimit(`verify:${input.rateLimitKey}`);
    assertRecentAssertion(input.actorAssertion.issued_at);

    const actorPacket = await this.requirePersonPacket(
      input.actorAssertion.actor_packet_id
    );
    const activeKeyBinding = actorPacket.body.identity?.public_key_bindings.find(
      (binding) =>
        binding.kid === input.actorAssertion.kid && binding.status === 'active'
    );

    if (!activeKeyBinding) {
      throw new Error('Actor assertion key is not active for that identity.');
    }

    const assertionIsValid = await verifyActorAssertion({
      assertion: input.actorAssertion,
      publicJwk: activeKeyBinding.public_jwk as JsonWebKey,
      body: {
        challenge_id: input.challengeId,
        nonce: input.nonce,
        keep_me_logged_in: input.keepMeLoggedIn,
      },
    });

    if (!assertionIsValid) {
      throw new Error('Sign-in assertion verification failed.');
    }

    const now = new Date();
    const challengeRow = this.withDatabase((database) =>
      database
        .prepare(
          `
            SELECT challenge_id, actor_packet_id, nonce, created_at, expires_at, used_at
            FROM auth_sign_in_challenges
            WHERE challenge_id = ?
          `
        )
        .get(input.challengeId) as
        | {
            challenge_id: string;
            actor_packet_id: string;
            nonce: string;
            created_at: string;
            expires_at: string;
            used_at: string | null;
          }
        | undefined
    );

    if (!challengeRow) {
      throw new Error('Unknown sign-in challenge.');
    }

    if (challengeRow.actor_packet_id !== actorPacket.header.packet_id) {
      throw new Error('Sign-in challenge actor does not match the assertion actor.');
    }

    if (challengeRow.nonce !== input.nonce) {
      throw new Error('Sign-in challenge nonce does not match.');
    }

    if (challengeRow.used_at) {
      throw new Error('That sign-in challenge has already been used.');
    }

    if (new Date(challengeRow.expires_at).getTime() < now.getTime()) {
      throw new Error('That sign-in challenge has expired.');
    }

    this.withDatabase((database) => {
      database
        .prepare(
          `
            UPDATE auth_sign_in_challenges
            SET used_at = ?
            WHERE challenge_id = ?
          `
        )
        .run(now.toISOString(), input.challengeId);
    });

    const hasPasskey = this.countActivePasskeys(actorPacket.header.packet_id) > 0;
    const createdSession = this.createSessionRecord({
      actorPacketId: actorPacket.header.packet_id,
      keepMeLoggedIn: input.keepMeLoggedIn,
      deviceLabel: this.resolveDeviceLabel({
        request: input.request,
        preferredLabel: input.deviceLabel,
      }),
      authMethod: 'bundle',
      requiresPasskeyUpgrade: false,
    });
    const sessionPayload = await this.toAuthSessionPayload({
      actorPacket,
      sessionRecord: createdSession.sessionRecord,
      refreshRecord: createdSession.refreshRecord,
    });

    this.writeAuthEvent({
      actorPacketId: actorPacket.header.packet_id,
      sessionId: createdSession.sessionRecord.session_id,
      eventType: 'session_created',
      metadata: {
        auth_method: 'bundle',
        keep_me_logged_in: input.keepMeLoggedIn,
        requires_passkey_upgrade: false,
      },
    });

    return {
      session: sessionPayload,
      setCookieHeaders: createdSession.setCookieHeaders,
    };
  }

  async startPasskeyRegistration(input: {
    request: Request;
    csrfToken: string | null;
    reauthToken: string | null;
    rateLimitKey: string;
  }): Promise<NexusPasskeyRegistrationOptionsPayload> {
    this.cleanupExpiredRecords();
    this.enforceRateLimit(`passkey-register:${input.rateLimitKey}`);

    const sessionRecord = this.requireAuthenticatedSession({
      request: input.request,
      csrfToken: input.csrfToken,
      allowUpgradeSession: true,
    });
    const actorPacket = await this.requirePersonPacket(sessionRecord.actor_packet_id);
    const hasPasskey = this.countActivePasskeys(actorPacket.header.packet_id) > 0;

    if (actorPacket.body.identity?.claim_status !== 'claimed') {
      throw new Error('Only claimed identities can register passkeys.');
    }

    if (hasPasskey) {
      this.consumeReauthToken({
        actorPacketId: actorPacket.header.packet_id,
        sessionId: sessionRecord.session_id,
        reauthToken: input.reauthToken,
        purpose: 'sensitive',
      });
    }

    const challenge = this.createWebAuthnChallenge({
      actorPacketId: actorPacket.header.packet_id,
      sessionId: sessionRecord.session_id,
      purpose: 'register',
    });

    return {
      challenge_id: challenge.challenge_id,
      public_key: createWebAuthnRegistrationOptions({
        actorPacketId: actorPacket.header.packet_id,
        alias: actorPacket.body.identity?.alias ?? actorPacket.body.name,
        challenge: challenge.challenge,
        rpId: getRequestRpId(input.request),
        existingCredentialIds: this.listActivePasskeys(actorPacket.header.packet_id).map(
          (passkey) => passkey.credential_id
        ),
      }),
    };
  }

  async verifyPasskeyRegistration(input: {
    request: Request;
    csrfToken: string | null;
    challengeId: string;
    credential: SerializedPasskeyRegistrationCredential;
  }): Promise<NexusPasskeyVerifyPayload> {
    const sessionRecord = this.requireAuthenticatedSession({
      request: input.request,
      csrfToken: input.csrfToken,
      allowUpgradeSession: true,
    });
    const challenge = this.readWebAuthnChallenge(input.challengeId);

    if (!challenge || challenge.purpose !== 'register') {
      throw new Error('Unknown passkey registration challenge.');
    }

    if (challenge.used_at) {
      throw new Error('That passkey registration challenge has already been used.');
    }

    if (challenge.session_id !== sessionRecord.session_id) {
      throw new Error('That passkey registration challenge does not belong to this session.');
    }

    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      throw new Error('That passkey registration challenge has expired.');
    }

    const verification = verifyPasskeyRegistration({
      credential: input.credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: getRequestOrigin(input.request),
      expectedRpId: getRequestRpId(input.request),
    });

    this.withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        database
          .prepare(
            `
              INSERT INTO auth_passkeys (
                credential_id,
                actor_packet_id,
                public_key_spki,
                sign_count,
                transports_json,
                created_at,
                last_used_at,
                revoked_at
              ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
              ON CONFLICT(credential_id) DO UPDATE SET
                actor_packet_id = excluded.actor_packet_id,
                public_key_spki = excluded.public_key_spki,
                sign_count = excluded.sign_count,
                transports_json = excluded.transports_json,
                revoked_at = NULL
            `
          )
          .run(
            verification.credentialId,
            sessionRecord.actor_packet_id,
            verification.publicKeySpki,
            verification.counter,
            JSON.stringify(verification.transports),
            new Date().toISOString()
          );
        database
          .prepare(
            `
              UPDATE auth_webauthn_challenges
              SET used_at = ?
              WHERE challenge_id = ?
            `
          )
          .run(new Date().toISOString(), challenge.challenge_id);
        database
          .prepare(
            `
              UPDATE auth_sessions
              SET requires_passkey_upgrade = 0
              WHERE actor_packet_id = ?
            `
          )
          .run(sessionRecord.actor_packet_id);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });

    const actorPacket = await this.requirePersonPacket(sessionRecord.actor_packet_id);
    const updatedSession = this.readSessionRecord(sessionRecord.session_id);

    if (!updatedSession) {
      throw new Error('The current session disappeared during passkey registration.');
    }

    this.writeAuthEvent({
      actorPacketId: sessionRecord.actor_packet_id,
      sessionId: sessionRecord.session_id,
      credentialId: verification.credentialId,
      eventType: 'passkey_registered',
    });

    return {
      session: await this.toAuthSessionPayload({
        actorPacket,
        sessionRecord: updatedSession,
      }),
      passkey: toPasskeySummary(
        this.readPasskey(verification.credentialId) ?? {
          credential_id: verification.credentialId,
          actor_packet_id: sessionRecord.actor_packet_id,
          public_key_spki: verification.publicKeySpki,
          sign_count: verification.counter,
          transports_json: JSON.stringify(verification.transports),
          created_at: new Date().toISOString(),
          last_used_at: null,
          revoked_at: null,
        }
      ),
    };
  }

  async startPasskeySignIn(input: {
    request: Request;
    rateLimitKey: string;
  }): Promise<NexusPasskeyRequestOptionsPayload> {
    this.cleanupExpiredRecords();
    this.enforceRateLimit(`passkey-signin:${input.rateLimitKey}`);
    const activePasskeys = this.listAllActivePasskeys();

    if (activePasskeys.length === 0) {
      throw new Error(
        'No registered Nexus passkeys were found. Use bundle sign-in, or import a bundle before adding a passkey.'
      );
    }

    const challenge = this.createWebAuthnChallenge({
      purpose: 'signin',
    });

    return {
      challenge_id: challenge.challenge_id,
      public_key: createWebAuthnRequestOptions({
        challenge: challenge.challenge,
        rpId: getRequestRpId(input.request),
        allowCredentialIds: activePasskeys.map((passkey) => passkey.credential_id),
      }),
    };
  }

  async verifyPasskeySignIn(input: {
    request: Request;
    challengeId: string;
    credential: SerializedPasskeyAssertionCredential;
    keepMeLoggedIn: boolean;
    rateLimitKey: string;
    deviceLabel?: string | null;
  }): Promise<{
    session: NexusAuthSessionPayload;
    setCookieHeaders: string[];
  }> {
    this.cleanupExpiredRecords();
    this.enforceRateLimit(`passkey-verify:${input.rateLimitKey}`);

    const challenge = this.readWebAuthnChallenge(input.challengeId);

    if (!challenge || challenge.purpose !== 'signin') {
      throw new Error('Unknown passkey sign-in challenge.');
    }

    if (challenge.used_at) {
      throw new Error('That passkey sign-in challenge has already been used.');
    }

    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      throw new Error('That passkey sign-in challenge has expired.');
    }

    const passkey = this.readPasskey(input.credential.credential_id);

    if (!passkey || passkey.revoked_at) {
      throw new Error('Unknown or revoked passkey credential.');
    }

    const assertion = await verifyPasskeyAssertion({
      credential: input.credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: getRequestOrigin(input.request),
      expectedRpId: getRequestRpId(input.request),
      publicKeySpki: passkey.public_key_spki,
      previousCounter: passkey.sign_count,
    });

    this.withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        database
          .prepare(
            `
              UPDATE auth_passkeys
              SET sign_count = ?, last_used_at = ?
              WHERE credential_id = ?
            `
          )
          .run(
            assertion.nextCounter,
            new Date().toISOString(),
            assertion.credentialId
          );
        database
          .prepare(
            `
              UPDATE auth_webauthn_challenges
              SET used_at = ?
              WHERE challenge_id = ?
            `
          )
          .run(new Date().toISOString(), challenge.challenge_id);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });

    const actorPacket = await this.requirePersonPacket(passkey.actor_packet_id);
    const createdSession = this.createSessionRecord({
      actorPacketId: passkey.actor_packet_id,
      keepMeLoggedIn: input.keepMeLoggedIn,
      deviceLabel: this.resolveDeviceLabel({
        request: input.request,
        preferredLabel: input.deviceLabel,
      }),
      authMethod: 'passkey',
      requiresPasskeyUpgrade: false,
    });

    this.writeAuthEvent({
      actorPacketId: passkey.actor_packet_id,
      sessionId: createdSession.sessionRecord.session_id,
      credentialId: passkey.credential_id,
      eventType: 'passkey_used',
      metadata: {
        purpose: 'signin',
      },
    });

    return {
      session: await this.toAuthSessionPayload({
        actorPacket,
        sessionRecord: createdSession.sessionRecord,
        refreshRecord: createdSession.refreshRecord,
      }),
      setCookieHeaders: createdSession.setCookieHeaders,
    };
  }

  async startPasskeyReauth(input: {
    request: Request;
    csrfToken: string | null;
    rateLimitKey: string;
  }): Promise<NexusPasskeyRequestOptionsPayload> {
    this.cleanupExpiredRecords();
    this.enforceRateLimit(`passkey-reauth:${input.rateLimitKey}`);

    const sessionRecord = this.requireAuthenticatedSession({
      request: input.request,
      csrfToken: input.csrfToken,
    });
    const activePasskeys = this.listActivePasskeys(sessionRecord.actor_packet_id);

    if (activePasskeys.length === 0) {
      throw new Error('This claimed identity has no registered passkeys.');
    }

    const challenge = this.createWebAuthnChallenge({
      actorPacketId: sessionRecord.actor_packet_id,
      sessionId: sessionRecord.session_id,
      purpose: 'reauth',
    });

    return {
      challenge_id: challenge.challenge_id,
      public_key: createWebAuthnRequestOptions({
        challenge: challenge.challenge,
        rpId: getRequestRpId(input.request),
        allowCredentialIds: activePasskeys.map((passkey) => passkey.credential_id),
      }),
    };
  }

  async verifyPasskeyReauth(input: {
    request: Request;
    csrfToken: string | null;
    challengeId: string;
    credential: SerializedPasskeyAssertionCredential;
    purpose: ReauthPurpose;
  }): Promise<NexusReauthVerifyPayload> {
    const sessionRecord = this.requireAuthenticatedSession({
      request: input.request,
      csrfToken: input.csrfToken,
    });
    const challenge = this.readWebAuthnChallenge(input.challengeId);

    if (!challenge || challenge.purpose !== 'reauth') {
      throw new Error('Unknown passkey re-auth challenge.');
    }

    if (challenge.used_at) {
      throw new Error('That passkey re-auth challenge has already been used.');
    }

    if (challenge.session_id !== sessionRecord.session_id) {
      throw new Error('That passkey re-auth challenge does not belong to this session.');
    }

    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      throw new Error('That passkey re-auth challenge has expired.');
    }

    const passkey = this.readPasskey(input.credential.credential_id);

    if (!passkey || passkey.revoked_at) {
      throw new Error('Unknown or revoked passkey credential.');
    }

    if (passkey.actor_packet_id !== sessionRecord.actor_packet_id) {
      throw new Error('That passkey does not belong to this claimed identity.');
    }

    const assertion = await verifyPasskeyAssertion({
      credential: input.credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: getRequestOrigin(input.request),
      expectedRpId: getRequestRpId(input.request),
      publicKeySpki: passkey.public_key_spki,
      previousCounter: passkey.sign_count,
    });

    this.withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        database
          .prepare(
            `
              UPDATE auth_passkeys
              SET sign_count = ?, last_used_at = ?
              WHERE credential_id = ?
            `
          )
          .run(
            assertion.nextCounter,
            new Date().toISOString(),
            assertion.credentialId
          );
        database
          .prepare(
            `
              UPDATE auth_webauthn_challenges
              SET used_at = ?
              WHERE challenge_id = ?
            `
          )
          .run(new Date().toISOString(), challenge.challenge_id);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });

    const token = this.createReauthToken({
      actorPacketId: sessionRecord.actor_packet_id,
      sessionId: sessionRecord.session_id,
      purpose: input.purpose,
    });

    this.writeAuthEvent({
      actorPacketId: sessionRecord.actor_packet_id,
      sessionId: sessionRecord.session_id,
      credentialId: passkey.credential_id,
      eventType: 'passkey_used',
      metadata: {
        purpose: `reauth:${input.purpose}`,
      },
    });

    return {
      reauth_token: token.reauth_token_id,
      expires_at: token.expires_at,
    };
  }

  async verifySignedReauth(input: {
    request: Request;
    csrfToken: string | null;
    actorPacket: unknown;
    actorAssertion: ActorAssertion;
    purpose: ReauthPurpose;
  }): Promise<NexusReauthVerifyPayload> {
    assertRecentAssertion(input.actorAssertion.issued_at);

    const actorPacket = await this.verifyAndPersistIdentityPacket({
      actorPacket: input.actorPacket,
    });
    const sessionRecord = this.requireAuthenticatedSession({
      request: input.request,
      actorPacketId: actorPacket.header.packet_id,
      csrfToken: input.csrfToken,
    });
    const activeKeyBinding = actorPacket.body.identity?.public_key_bindings.find(
      (binding) =>
        binding.kid === input.actorAssertion.kid && binding.status === 'active'
    );

    if (!activeKeyBinding) {
      throw new Error('Actor assertion key is not active for that identity.');
    }

    const assertionIsValid = await verifyActorAssertion({
      assertion: input.actorAssertion,
      publicJwk: activeKeyBinding.public_jwk as JsonWebKey,
      body: {
        purpose: input.purpose,
      },
    });

    if (!assertionIsValid) {
      throw new Error('Signed re-auth assertion verification failed.');
    }

    if (input.actorAssertion.method.toUpperCase() !== 'POST') {
      throw new Error('Signed re-auth assertion method does not match this request.');
    }

    if (input.actorAssertion.path !== '/api/nexus/auth/reauth/signed') {
      throw new Error('Signed re-auth assertion path does not match this request.');
    }

    if (input.actorAssertion.actor_packet_id !== actorPacket.header.packet_id) {
      throw new Error('Signed re-auth assertion actor does not match the actor packet.');
    }

    const token = this.createReauthToken({
      actorPacketId: sessionRecord.actor_packet_id,
      sessionId: sessionRecord.session_id,
      purpose: input.purpose,
    });

    this.writeAuthEvent({
      actorPacketId: sessionRecord.actor_packet_id,
      sessionId: sessionRecord.session_id,
      eventType: 'signed_reauth_used',
      metadata: {
        auth_method: 'signed-reauth',
        purpose: input.purpose,
      },
    });

    return {
      reauth_token: token.reauth_token_id,
      expires_at: token.expires_at,
    };
  }

  private async rotateRefreshSession(
    refreshRecord: RefreshTokenRecord
  ): Promise<{
    session: NexusAuthSessionPayload;
    setCookieHeaders: string[];
  }> {
    const actorPacket = await this.requirePersonPacket(refreshRecord.actor_packet_id);
    const now = new Date();
    const nextRefreshTokenId = randomUUID();
    const nextSessionId = randomUUID();
    const nextSessionExpiresAt = new Date(
      now.getTime() + AUTH_SESSION_TTL_MS
    ).toISOString();
    const nextRefreshExpiresAt = new Date(
      now.getTime() + AUTH_REFRESH_TTL_MS
    ).toISOString();
    const nextCsrfToken = randomUUID();
    const requiresPasskeyUpgrade = 0;

    this.withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        database
          .prepare(
            `
              UPDATE auth_refresh_tokens
              SET revoked_at = ?
              WHERE refresh_token_id = ?
            `
          )
          .run(now.toISOString(), refreshRecord.refresh_token_id);
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
              ) VALUES (?, ?, ?, ?, ?, NULL, 1, ?, ?, ?, ?)
            `
          )
          .run(
            nextSessionId,
            refreshRecord.actor_packet_id,
            now.toISOString(),
            nextSessionExpiresAt,
            now.toISOString(),
            'Persistent session',
            'refresh',
            nextCsrfToken,
            requiresPasskeyUpgrade
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
            nextSessionId,
            refreshRecord.actor_packet_id,
            now.toISOString(),
            nextRefreshExpiresAt
          );
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });

    this.writeAuthEvent({
      actorPacketId: actorPacket.header.packet_id,
      sessionId: nextSessionId,
      eventType: 'session_refreshed',
    });

    return {
      session: await this.toAuthSessionPayload({
        actorPacket,
        sessionRecord: {
          session_id: nextSessionId,
          actor_packet_id: refreshRecord.actor_packet_id,
          created_at: now.toISOString(),
          expires_at: nextSessionExpiresAt,
          last_seen_at: now.toISOString(),
          revoked_at: null,
          persistent_login: 1,
          device_label: 'Persistent session',
          auth_method: 'refresh',
          csrf_token: nextCsrfToken,
          requires_passkey_upgrade: requiresPasskeyUpgrade,
        },
        refreshRecord: {
          refresh_token_id: nextRefreshTokenId,
          session_id: nextSessionId,
          actor_packet_id: refreshRecord.actor_packet_id,
          created_at: now.toISOString(),
          expires_at: nextRefreshExpiresAt,
          revoked_at: null,
        },
      }),
      setCookieHeaders: [
        formatCookie({
          name: AUTH_SESSION_COOKIE,
          value: nextSessionId,
          maxAgeSeconds: Math.floor(AUTH_SESSION_TTL_MS / 1000),
        }),
        formatCookie({
          name: AUTH_REFRESH_COOKIE,
          value: nextRefreshTokenId,
          maxAgeSeconds: Math.floor(AUTH_REFRESH_TTL_MS / 1000),
        }),
      ],
    };
  }

  async getCurrentSession(request: Request): Promise<{
    session: NexusAuthSessionPayload;
    setCookieHeaders: string[];
  }> {
    this.cleanupExpiredRecords();

    const cookies = parseCookieHeader(request.headers.get('cookie'));
    const sessionCookie = cookies[AUTH_SESSION_COOKIE] ?? null;
    const refreshCookie = cookies[AUTH_REFRESH_COOKIE] ?? null;
    const now = Date.now();

    if (sessionCookie) {
      const sessionRecord = this.readSessionRecord(sessionCookie);

      if (
        sessionRecord &&
        !sessionRecord.revoked_at &&
        new Date(sessionRecord.expires_at).getTime() >= now
      ) {
        this.touchSession(sessionRecord.session_id);

        return {
          session: await this.toAuthSessionPayload({
            actorPacket: await this.getPersonPacket(sessionRecord.actor_packet_id),
            sessionRecord,
          }),
          setCookieHeaders: [],
        };
      }
    }

    if (refreshCookie) {
      const refreshRecord = this.readRefreshTokenRecord(refreshCookie);

      if (
        refreshRecord &&
        !refreshRecord.revoked_at &&
        new Date(refreshRecord.expires_at).getTime() >= now
      ) {
        return this.rotateRefreshSession(refreshRecord);
      }
    }

    return {
      session: await this.toAuthSessionPayload({
        actorPacket: null,
        sessionRecord: null,
      }),
      setCookieHeaders: [],
    };
  }

  async signOut(request: Request, csrfToken?: string | null): Promise<string[]> {
    const sessionRecord = this.requireAuthenticatedSession({
      request,
      csrfToken,
      allowUpgradeSession: true,
    });
    const cookies = parseCookieHeader(request.headers.get('cookie'));
    const refreshCookie = cookies[AUTH_REFRESH_COOKIE] ?? null;
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
          .run(revokedAt, sessionRecord.session_id);

        if (refreshCookie) {
          database
            .prepare(
              `
                UPDATE auth_refresh_tokens
                SET revoked_at = ?
                WHERE refresh_token_id = ?
              `
            )
            .run(revokedAt, refreshCookie);
        }

        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });

    this.writeAuthEvent({
      actorPacketId: sessionRecord.actor_packet_id,
      sessionId: sessionRecord.session_id,
      eventType: 'session_revoked',
    });

    return [
      createExpiredCookie(AUTH_SESSION_COOKIE),
      createExpiredCookie(AUTH_REFRESH_COOKIE),
    ];
  }

  async listSessions(request: Request, csrfToken: string | null): Promise<NexusSessionListPayload> {
    const sessionRecord = this.requireAuthenticatedSession({
      request,
      csrfToken,
      allowUpgradeSession: true,
      requireCsrf: false,
    });
    const sessions = this.withDatabase((database) =>
      database
        .prepare(
          `
            SELECT session_id, actor_packet_id, created_at, expires_at, last_seen_at, revoked_at, persistent_login, device_label, auth_method, csrf_token, requires_passkey_upgrade
            FROM auth_sessions
            WHERE actor_packet_id = ?
            ORDER BY created_at DESC
          `
        )
        .all(sessionRecord.actor_packet_id) as AuthSessionRecord[]
    );

    return {
      sessions: sessions.map((record) => ({
        session_id: record.session_id,
        actor_packet_id: record.actor_packet_id,
        device_label: record.device_label,
        auth_method: record.auth_method,
        created_at: record.created_at,
        expires_at: record.expires_at,
        last_seen_at: record.last_seen_at,
        persistent_login: Boolean(record.persistent_login),
        revoked_at: record.revoked_at,
        is_current: record.session_id === sessionRecord.session_id,
      })),
    };
  }

  async revokeSessions(input: {
    request: Request;
    csrfToken: string | null;
    reauthToken: string | null;
    targetSessionId?: string | null;
    revokeOthers?: boolean;
  }): Promise<NexusSessionListPayload> {
    const sessionRecord = this.requireAuthenticatedSession({
      request: input.request,
      csrfToken: input.csrfToken,
    });

    this.consumeReauthToken({
      actorPacketId: sessionRecord.actor_packet_id,
      sessionId: sessionRecord.session_id,
      reauthToken: input.reauthToken,
      purpose: 'sensitive',
    });

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
            .run(
              new Date().toISOString(),
              sessionRecord.actor_packet_id,
              sessionRecord.session_id
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
              new Date().toISOString(),
              sessionRecord.actor_packet_id,
              sessionRecord.session_id
            );
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
            .run(
              new Date().toISOString(),
              sessionRecord.actor_packet_id,
              input.targetSessionId
            );
          database
            .prepare(
              `
                UPDATE auth_refresh_tokens
                SET revoked_at = ?
                WHERE actor_packet_id = ?
                  AND session_id = ?
              `
            )
            .run(
              new Date().toISOString(),
              sessionRecord.actor_packet_id,
              input.targetSessionId
            );
        }

        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });

    return this.listSessions(input.request, input.csrfToken);
  }

  async listPasskeys(request: Request, csrfToken: string | null): Promise<NexusPasskeyListPayload> {
    const sessionRecord = this.requireAuthenticatedSession({
      request,
      csrfToken,
      allowUpgradeSession: true,
      requireCsrf: false,
    });

    return {
      passkeys: this.listActivePasskeys(sessionRecord.actor_packet_id).map(
        toPasskeySummary
      ),
    };
  }

  async revokePasskey(input: {
    request: Request;
    credentialId: string;
    csrfToken: string | null;
    reauthToken: string | null;
  }): Promise<NexusPasskeyListPayload> {
    const sessionRecord = this.requireAuthenticatedSession({
      request: input.request,
      csrfToken: input.csrfToken,
    });

    this.consumeReauthToken({
      actorPacketId: sessionRecord.actor_packet_id,
      sessionId: sessionRecord.session_id,
      reauthToken: input.reauthToken,
      purpose: 'sensitive',
    });

    const currentPasskeys = this.listActivePasskeys(sessionRecord.actor_packet_id);

    if (currentPasskeys.length <= 1) {
      throw new Error('Claimed identities must keep at least one registered passkey.');
    }

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
        .run(
          new Date().toISOString(),
          sessionRecord.actor_packet_id,
          input.credentialId
        );
    });

    this.writeAuthEvent({
      actorPacketId: sessionRecord.actor_packet_id,
      sessionId: sessionRecord.session_id,
      credentialId: input.credentialId,
      eventType: 'passkey_revoked',
    });

    return this.listPasskeys(input.request, input.csrfToken);
  }

  async getSecurityPreferences(
    request: Request,
    csrfToken: string | null
  ): Promise<NexusSecurityPreferencesPayload> {
    const sessionRecord = this.requireAuthenticatedSession({
      request,
      csrfToken,
      allowUpgradeSession: true,
      requireCsrf: false,
    });

    return {
      security_mode: this.getNormalizedSecurityMode(sessionRecord.actor_packet_id),
    };
  }

  async updateSecurityPreferences(input: {
    request: Request;
    csrfToken: string | null;
    reauthToken: string | null;
    securityMode: NexusSecurityMode;
  }): Promise<NexusSecurityPreferencesPayload> {
    const sessionRecord = this.requireAuthenticatedSession({
      request: input.request,
      csrfToken: input.csrfToken,
    });

    this.consumeReauthToken({
      actorPacketId: sessionRecord.actor_packet_id,
      sessionId: sessionRecord.session_id,
      reauthToken: input.reauthToken,
      purpose: 'sensitive',
    });

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
        .run(
          sessionRecord.actor_packet_id,
          input.securityMode,
          new Date().toISOString()
        );
    });

    this.writeAuthEvent({
      actorPacketId: sessionRecord.actor_packet_id,
      sessionId: sessionRecord.session_id,
      eventType: 'security_mode_updated',
      metadata: {
        security_mode: input.securityMode,
      },
    });

    return {
      security_mode: input.securityMode,
    };
  }

  async getUpgradeStatus(
    request: Request,
    csrfToken: string | null
  ): Promise<{
    actor_packet_id: string;
    has_passkey: boolean;
    requires_passkey_upgrade: boolean;
  }> {
    const sessionRecord = this.requireAuthenticatedSession({
      request,
      csrfToken,
      allowUpgradeSession: true,
    });
    const hasPasskey = this.countActivePasskeys(sessionRecord.actor_packet_id) > 0;

    return {
      actor_packet_id: sessionRecord.actor_packet_id,
      has_passkey: hasPasskey,
      requires_passkey_upgrade: false,
    };
  }
}
