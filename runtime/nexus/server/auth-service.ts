/**
 * File: auth-service.ts
 * Description: Verifies cryptographic person identities and manages Nexus sessions, passkeys, re-auth tokens, and auth hardening.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import type { DiscussionActorClass } from '@core/schema/packet-schema';
import type { PacketEnvelope, PacketEnvelopeByType } from '@core/schema/packet-schema';
import { parsePacketEnvelope } from '@core/schema/packet-schema';
import type { ActorAssertion } from '@runtime/nexus/identity-crypto';
import { verifyActorAssertion, verifyPacketSignature } from '@runtime/nexus/identity-crypto';
import type {
  NexusAuthSessionPayload,
  NexusPasskeyListPayload,
  NexusPasskeyRegistrationOptionsPayload,
  NexusPasskeyRequestOptionsPayload,
  NexusPasskeyVerifyPayload,
  NexusReauthVerifyPayload,
  NexusSecurityMode,
  NexusSecurityPreferencesPayload,
  NexusSessionListPayload,
} from '@runtime/nexus/nexus-api-types';
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
} from '@runtime/nexus/server/auth-webauthn';
import { NexusAuthStore } from '@runtime/nexus/server/auth-service.store';
import {
  AUTH_REFRESH_COOKIE,
  AUTH_REFRESH_TTL_MS,
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_TTL_MS,
  SIGN_IN_CHALLENGE_TTL_MS,
  type AuthMethod,
  type AuthSessionRecord,
  type PasskeyRecord,
  type ReauthTokenRecord,
  type ReauthPurpose,
  type RefreshTokenRecord,
  type SecurityPreferenceRecord,
  type WebAuthnChallengePurpose,
  type WebAuthnChallengeRecord,
} from '@runtime/nexus/server/auth-service.types';
import {
  assertRecentAssertion,
  createExpiredCookie,
  formatCookie,
  isPersonElementPacket,
  parseCookieHeader,
  resolveDeviceLabel as resolveAuthDeviceLabel,
  toPasskeySummary,
  validateIdentityPacketMetadata,
} from '@runtime/nexus/server/auth-service.utils';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export class NexusAuthService {
  private readonly store: NexusAuthStore;

  constructor(private readonly packetStore: NodeSQLitePacketStore) {
    this.store = new NexusAuthStore(packetStore.databasePath);
  }

  private withDatabase<TValue>(run: (database: DatabaseSync) => TValue): TValue {
    return this.store.withDatabase(run);
  }

  async ensureStorage(): Promise<void> {
    this.store.ensureStorage();
  }

  private writeAuthEvent(input: {
    actorPacketId?: string | null;
    sessionId?: string | null;
    credentialId?: string | null;
    eventType: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.store.writeAuthEvent(input);
  }

  private enforceRateLimit(bucketKey: string): void {
    this.store.enforceRateLimit(bucketKey);
  }

  private cleanupExpiredRecords(): void {
    this.store.cleanupExpiredRecords();
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
    this.store.ensureSecurityPreference(actorPacketId);
  }

  private readSecurityPreference(actorPacketId: string): SecurityPreferenceRecord {
    return this.store.readSecurityPreference(actorPacketId);
  }

  private getNormalizedSecurityMode(actorPacketId: string): NexusSecurityMode {
    return this.store.getNormalizedSecurityMode(actorPacketId);
  }

  private countActivePasskeys(actorPacketId: string): number {
    return this.store.countActivePasskeys(actorPacketId);
  }

  private listActivePasskeys(actorPacketId: string): PasskeyRecord[] {
    return this.store.listActivePasskeys(actorPacketId);
  }

  private listAllActivePasskeys(): PasskeyRecord[] {
    return this.store.listAllActivePasskeys();
  }

  private readPasskey(credentialId: string): PasskeyRecord | null {
    return this.store.readPasskey(credentialId);
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
    reusedExistingPersistentSession: boolean;
  } {
    return this.store.createSessionRecord(input);
  }

  private readSessionRecord(sessionId: string): AuthSessionRecord | null {
    return this.store.readSessionRecord(sessionId);
  }

  private readRefreshTokenRecord(refreshTokenId: string): RefreshTokenRecord | null {
    return this.store.readRefreshTokenRecord(refreshTokenId);
  }

  private touchSession(sessionId: string): void {
    this.store.touchSession(sessionId);
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
    return this.store.readWebAuthnChallenge(challengeId);
  }

  private createWebAuthnChallenge(input: {
    actorPacketId?: string | null;
    sessionId?: string | null;
    purpose: WebAuthnChallengePurpose;
  }): WebAuthnChallengeRecord {
    return this.store.createWebAuthnChallenge({
      ...input,
      challenge: encodeBase64Url(randomBytes(32)),
    });
  }

  private createReauthToken(input: {
    actorPacketId: string;
    sessionId: string;
    purpose: ReauthPurpose;
  }): ReauthTokenRecord {
    return this.store.createReauthToken(input);
  }

  private consumeReauthToken(input: {
    actorPacketId: string;
    sessionId: string;
    reauthToken: string | null | undefined;
    purpose: ReauthPurpose;
  }): void {
    this.store.consumeReauthToken(input);
  }

  private resolveDeviceLabel(input: {
    request: Request;
    preferredLabel?: string | null;
  }): string {
    return resolveAuthDeviceLabel(input);
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

    const parsedActorPacket = parsePacketEnvelope(input.actorPacket);

    if (!isPersonElementPacket(parsedActorPacket)) {
      throw new Error('Actor packet must be a person element.');
    }

    const actorPacket = await this.requirePersonPacket(
      parsedActorPacket.header.packet_id
    );
    const storedActorPacket = await this.verifyIdentityPacket(actorPacket);

    if (
      input.actorAssertion.actor_packet_id !==
      storedActorPacket.header.packet_id
    ) {
      throw new Error('Actor assertion packet id does not match the actor packet.');
    }

    const activeKeyBinding =
      storedActorPacket.body.identity?.public_key_bindings.find(
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

    if (storedActorPacket.body.identity?.claim_status === 'claimed') {
      const sessionRecord = this.requireAuthenticatedSession({
        request: input.request,
        actorPacketId: actorPacket.header.packet_id,
        csrfToken: input.csrfToken,
      });
      const securityMode = this.getNormalizedSecurityMode(
        storedActorPacket.header.packet_id
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
      actorPacket: storedActorPacket,
      actorKey: `element:${storedActorPacket.header.packet_id}`,
      actorClass:
        storedActorPacket.body.identity?.claim_status === 'claimed'
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
      eventType: createdSession.reusedExistingPersistentSession
        ? 'session_restored'
        : 'session_created',
      metadata: {
        auth_method: 'bundle',
        keep_me_logged_in: input.keepMeLoggedIn,
        requires_passkey_upgrade: false,
        reused_existing_session: createdSession.reusedExistingPersistentSession,
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
      eventType: createdSession.reusedExistingPersistentSession
        ? 'session_restored'
        : 'passkey_used',
      metadata: {
        purpose: 'signin',
        reused_existing_session: createdSession.reusedExistingPersistentSession,
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
    const rotatedSession = this.store.rotateRefreshSessionRecord({
      refreshRecord,
    });

    if (!rotatedSession) {
      throw new Error('The current remembered session could not be restored.');
    }

    this.writeAuthEvent({
      actorPacketId: actorPacket.header.packet_id,
      sessionId: rotatedSession.sessionRecord.session_id,
      eventType: 'session_refreshed',
    });

    return {
      session: await this.toAuthSessionPayload({
        actorPacket,
        sessionRecord: rotatedSession.sessionRecord,
        refreshRecord: rotatedSession.refreshRecord,
      }),
      setCookieHeaders: rotatedSession.setCookieHeaders,
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
    const activeSessions = sessions
      .filter(
        (record) =>
          record.revoked_at === null &&
          new Date(record.expires_at).getTime() >= Date.now()
      )
      .sort((leftRecord, rightRecord) => {
        if (
          (leftRecord.session_id === sessionRecord.session_id) !==
          (rightRecord.session_id === sessionRecord.session_id)
        ) {
          return leftRecord.session_id === sessionRecord.session_id ? -1 : 1;
        }

        return (
          new Date(rightRecord.created_at).getTime() -
          new Date(leftRecord.created_at).getTime()
        );
      });

    return {
      sessions: activeSessions.map((record) => ({
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
