/**
 * File: auth-service.ts
 * Description: Verifies cryptographic person identities and manages Nexus sessions, passkeys, re-auth tokens, and auth hardening.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import type {
  MutationProofBundle,
  MutationProofMethod,
  WriteProofLevel,
} from '@core/auth/proof-types';
import { canonicalizeJson } from '@core/crypto/canonical-json';
import type {
  DiscussionActorClass,
  PacketEnvelopeByType,
  RawPacketEnvelopeInput,
} from '@core/schema/packet-schema';
import { parsePacketEnvelope, parseRawPacketEnvelopeInput } from '@core/schema/packet-schema';
import type { ActorAssertion } from '@runtime/nexus/identity-crypto';
import {
  verifyActorAssertion,
  verifyPacketSignatureDetailed,
} from '@runtime/nexus/identity-crypto';
import {
  NexusAuthFailureError,
  NexusAuthGateError,
  isNexusAuthFailureError,
  type NexusAuthFailureCode,
  type NexusAuthFailureDiagnostics,
  type NexusAuthGateReason,
} from '@runtime/nexus/nexus-auth-gate-error';
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
import { NexusAuthStore } from '@runtime/nexus/server/auth-service.store';
import {
  AUTH_REFRESH_COOKIE,
  AUTH_SESSION_COOKIE,
  SIGN_IN_CHALLENGE_TTL_MS,
  type AuthMethod,
  type AuthSessionRecord,
  type PasskeyRecord,
  type ReauthProofMethod,
  type ReauthPurpose,
  type ReauthTokenRecord,
  type RefreshTokenRecord,
  type SecurityPreferenceRecord,
  type WebAuthnChallengePurpose,
  type WebAuthnChallengeRecord
} from '@runtime/nexus/server/auth-service.types';
import {
  assertRecentAssertion,
  createExpiredCookie,
  isPersonElementPacket,
  parseCookieHeader,
  resolveDeviceLabel as resolveAuthDeviceLabel,
  toPasskeySummary,
  validateIdentityPacketMetadata
} from '@runtime/nexus/server/auth-service.utils';
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
import { inferSecurityModeFromWritePolicy } from '@runtime/nexus/server/write-security-mode';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export class NexusAuthService {
  private readonly store: NexusAuthStore;
  private readonly packetStore: NodeSQLitePacketStore;

  constructor(packetStore: NodeSQLitePacketStore) {
    this.packetStore = packetStore;
    this.store = new NexusAuthStore(packetStore.databasePath);
  }

  private withDatabase<TValue>(run: (database: DatabaseSync) => TValue): TValue {
    return this.store.withDatabase(run);
  }

  async ensureStorage(): Promise<void> {
    this.store.ensureStorage();
  }

  private buildAuthDiagnostics(input: {
    request?: Request | null;
    sessionRecord?: Pick<
      AuthSessionRecord,
      'session_id' | 'actor_packet_id' | 'expires_at' | 'auth_method'
    > | null;
    requestActorPacket?: PacketEnvelopeByType['Element'] | null;
    storedActorPacket?: PacketEnvelopeByType['Element'] | null;
    expectedActorPacketId?: string | null;
    resolvedGateReason?: NexusAuthGateReason | null;
    retryAttempted?: boolean;
  }): NexusAuthFailureDiagnostics {
    return {
      client_actor_packet_id:
        input.request?.headers.get('x-nexus-client-actor-packet-id') ?? null,
      client_actor_revision_id:
        input.request?.headers.get('x-nexus-client-actor-revision-id') ?? null,
      current_identity_mode:
        input.request?.headers.get('x-nexus-client-identity-mode') ?? null,
      request_actor_packet_id: input.requestActorPacket?.header.packet_id ?? null,
      request_actor_revision_id:
        input.requestActorPacket?.header.revision_id ?? null,
      server_session_actor_packet_id: input.sessionRecord?.actor_packet_id ?? null,
      session_id_present: Boolean(input.sessionRecord?.session_id),
      session_mode: input.sessionRecord?.auth_method ?? null,
      session_expires_at: input.sessionRecord?.expires_at ?? null,
      stored_actor_packet_id: input.storedActorPacket?.header.packet_id ?? null,
      stored_actor_revision_id:
        input.storedActorPacket?.header.revision_id ?? null,
      expected_actor_packet_id: input.expectedActorPacketId ?? null,
      resolved_gate_reason: input.resolvedGateReason ?? null,
      retry_attempted: input.retryAttempted ?? false,
    };
  }

  private createAuthGateError(input: {
    reason: NexusAuthGateReason;
    message: string;
    failureCode: NexusAuthFailureCode;
    request?: Request | null;
    sessionRecord?: Pick<
      AuthSessionRecord,
      'session_id' | 'actor_packet_id' | 'expires_at' | 'auth_method'
    > | null;
    requestActorPacket?: PacketEnvelopeByType['Element'] | null;
    storedActorPacket?: PacketEnvelopeByType['Element'] | null;
    expectedActorPacketId?: string | null;
    retryAttempted?: boolean;
    actorRequired?: boolean;
    writeApprovalRequired?: boolean;
    retryable?: boolean;
  }): NexusAuthGateError {
    return new NexusAuthGateError(input.reason, input.message, {
      actorRequired: input.actorRequired,
      writeApprovalRequired: input.writeApprovalRequired,
      retryable: input.retryable,
      failureCode: input.failureCode,
      diagnostics: this.buildAuthDiagnostics({
        request: input.request,
        sessionRecord: input.sessionRecord ?? null,
        requestActorPacket: input.requestActorPacket ?? null,
        storedActorPacket: input.storedActorPacket ?? null,
        expectedActorPacketId: input.expectedActorPacketId ?? null,
        resolvedGateReason: input.reason,
        retryAttempted: input.retryAttempted,
      }),
    });
  }

  private createAuthFailureError(input: {
    message: string;
    failureCode: NexusAuthFailureCode;
    request?: Request | null;
    sessionRecord?: Pick<
      AuthSessionRecord,
      'session_id' | 'actor_packet_id' | 'expires_at' | 'auth_method'
    > | null;
    requestActorPacket?: PacketEnvelopeByType['Element'] | null;
    storedActorPacket?: PacketEnvelopeByType['Element'] | null;
    expectedActorPacketId?: string | null;
    retryAttempted?: boolean;
  }): NexusAuthFailureError {
    return new NexusAuthFailureError(input.message, {
      failureCode: input.failureCode,
      diagnostics: this.buildAuthDiagnostics({
        request: input.request,
        sessionRecord: input.sessionRecord ?? null,
        requestActorPacket: input.requestActorPacket ?? null,
        storedActorPacket: input.storedActorPacket ?? null,
        expectedActorPacketId: input.expectedActorPacketId ?? null,
        retryAttempted: input.retryAttempted,
      }),
    });
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
    const revisionHeads = await this.packetStore.fetchRevisionHeads({
      packet_id: packetId,
    });
    const freshestRevision =
      revisionHeads.head_revisions.length === 1
        ? revisionHeads.head_revisions[0]
        : revisionHeads.preferred_revision;

    if (!freshestRevision) {
      return null;
    }

    const packet = await this.packetStore.fetchByRevision(freshestRevision);

    if (!isPersonElementPacket(packet)) {
      return null;
    }

    return packet;
  }

  private async getPersonPacketRevisionInput(
    packetId: string
  ): Promise<unknown | null> {
    const revisionHeads = await this.packetStore.fetchRevisionHeads({
      packet_id: packetId,
    });
    const freshestRevision =
      revisionHeads.head_revisions.length === 1
        ? revisionHeads.head_revisions[0]
        : revisionHeads.preferred_revision;

    if (!freshestRevision) {
      return null;
    }

    return this.packetStore.readByRevision(freshestRevision, {
      mode: 'raw',
    });
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

  async resolveEffectiveSecurityMode(
    actorPacketId: string
  ): Promise<NexusSecurityMode> {
    const actorPacket = await this.getPersonPacket(actorPacketId);

    if (actorPacket) {
      const policyPackets = await Promise.all(
        actorPacket.header.moderation.policy_refs.map((policyRef) =>
          this.packetStore.fetchByPacket({ packet_id: policyRef.packet_id })
        )
      );
      const availablePolicyPackets = policyPackets.filter(
        (packet): packet is PacketEnvelopeByType['Policy'] =>
          packet?.header.type === 'Policy'
      );
      const writeLockPolicyPacket = availablePolicyPackets.find(
        (packet) => packet.body.subtype === 'write_lock'
      );

      if (writeLockPolicyPacket?.body.write_policy) {
        return inferSecurityModeFromWritePolicy(writeLockPolicyPacket.body.write_policy);
      }
    }

    // Legacy fallback only: packet-backed write_lock policy is the canonical source of
    // truth, but older actors may still rely on the runtime projection until migrated.
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
      ? await this.resolveEffectiveSecurityMode(actorPacketId)
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
      throw this.createAuthGateError({
        reason: 'sign_in_required',
        message: 'Claimed actions require an authenticated Nexus session.',
        failureCode: 'session_missing',
        request: input.request,
        expectedActorPacketId: input.actorPacketId ?? null,
        actorRequired: true,
      });
    }

    if (sessionRecord.revoked_at) {
      throw this.createAuthGateError({
        reason: 'session_refresh_required',
        message: 'That Nexus session has been revoked.',
        failureCode: 'session_revoked',
        request: input.request,
        sessionRecord,
        expectedActorPacketId: input.actorPacketId ?? null,
        actorRequired: true,
      });
    }

    if (new Date(sessionRecord.expires_at).getTime() < Date.now()) {
      throw this.createAuthGateError({
        reason: 'session_refresh_required',
        message: 'That Nexus session has expired. Refresh the session and try again.',
        failureCode: 'session_expired',
        request: input.request,
        sessionRecord,
        expectedActorPacketId: input.actorPacketId ?? null,
        actorRequired: true,
      });
    }

    if (input.actorPacketId && sessionRecord.actor_packet_id !== input.actorPacketId) {
      throw this.createAuthGateError({
        reason: 'stale_actor_packet',
        message: 'Authenticated session actor does not match the claimed identity.',
        failureCode: 'session_actor_mismatch',
        request: input.request,
        sessionRecord,
        expectedActorPacketId: input.actorPacketId,
        actorRequired: true,
      });
    }

    if (input.requireCsrf ?? true) {
      this.requireSameOrigin(input.request);

      if (!input.csrfToken || input.csrfToken !== sessionRecord.csrf_token) {
        throw this.createAuthGateError({
          reason: 'session_refresh_required',
          message: 'Authenticated mutation CSRF token does not match the active session.',
          failureCode: 'csrf_token_mismatch',
          request: input.request,
          sessionRecord,
          expectedActorPacketId: input.actorPacketId ?? null,
          actorRequired: true,
        });
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
    proofMethod: ReauthProofMethod;
  }): ReauthTokenRecord {
    return this.store.createReauthToken(input);
  }

  private normalizePasskeyAssertionError(
    error: unknown,
    context: 'sign-in' | 're-approval'
  ): Error {
    const message =
      error instanceof Error
        ? error.message
        : `Passkey ${context} verification failed.`;

    if (message === 'Passkey challenge does not match the stored challenge.') {
      return new Error(
        `This passkey ${context} no longer matches the current request. Start the action again and use the newest prompt on this device.`
      );
    }

    if (message === 'Passkey signature counter did not advance.') {
      return new Error(
        `This passkey did not advance its security counter for ${context} on this device. Use the bundle passphrase for now, and re-register the passkey if this keeps happening.`
      );
    }

    if (
      message === 'Passkey origin does not match this request origin.' ||
      message === 'Passkey RP ID hash does not match this request host.'
    ) {
      return new Error(
        `This passkey ${context} was presented from the wrong device or origin for this request. Retry from the current device, or use the bundle passphrase instead.`
      );
    }

    if (message === 'Passkey signature verification failed.') {
      return new Error(
        `Passkey signature verification failed. This passkey did not verify for ${context} on this device. Use the bundle passphrase for now, and re-register the passkey if this keeps happening.`
      );
    }

    return error instanceof Error ? error : new Error(message);
  }

  private consumeReauthToken(input: {
    actorPacketId: string;
    sessionId: string;
    reauthToken: string | null | undefined;
    purpose: ReauthPurpose;
  }): ReauthTokenRecord {
    return this.store.consumeReauthToken(input);
  }

  private toMutationProofMethods(input: {
    isClaimedIdentity: boolean;
    isUnlockedIdentity: boolean;
    reauthProofMethod?: ReauthProofMethod | null;
  }): MutationProofMethod[] {
    const methods = new Set<MutationProofMethod>();

    if (input.isClaimedIdentity) {
      methods.add('claimed_session');
    }

    if (input.isUnlockedIdentity) {
      methods.add('bundle_unlocked');
    }

    if (input.reauthProofMethod === 'signed_reauth') {
      methods.add('signed_reauth');
    } else if (input.reauthProofMethod === 'bundle_passphrase_unlock') {
      methods.add('bundle_passphrase_unlock');
    } else if (input.reauthProofMethod === 'passkey_confirmation') {
      methods.add('passkey_confirmation');
    }

    return [...methods];
  }

  private resolveDeviceLabel(input: {
    request: Request;
    preferredLabel?: string | null;
  }): string {
    return resolveAuthDeviceLabel(input);
  }

  private parsePersonIdentityPacket(
    actorPacketInput: unknown
  ): PacketEnvelopeByType['Element'] {
    const packet = parsePacketEnvelope(actorPacketInput);

    if (!isPersonElementPacket(packet)) {
      throw new Error('Actor packet must be a person element.');
    }

    return packet;
  }

  private parseRawPersonIdentityPacket(
    actorPacketInput: unknown
  ): RawPacketEnvelopeInput {
    const packet = parseRawPacketEnvelopeInput(actorPacketInput);
    const body =
      packet.body && typeof packet.body === 'object' && !Array.isArray(packet.body)
        ? (packet.body as Record<string, unknown>)
        : null;

    if (packet.header.type !== 'Element' || body?.kind !== 'person') {
      throw new Error('Actor packet must be a person element.');
    }

    return packet;
  }

  private buildRawActorCandidateFingerprint(
    actorPacketInput: unknown
  ): {
    packetId: string;
    revisionId: string;
    dedupeKey: string;
  } {
    const rawPacket = this.parseRawPersonIdentityPacket(actorPacketInput);
    const rawHeader = rawPacket.header as RawPacketEnvelopeInput['header'] &
      Record<string, unknown>;
    const rawIntegrity =
      rawHeader.integrity &&
      typeof rawHeader.integrity === 'object' &&
      !Array.isArray(rawHeader.integrity)
        ? (rawHeader.integrity as Record<string, unknown>)
        : {};

    // Auth resolution dedupes on the historical unsigned packet shape, not only
    // on revision id, so a reserialized or corrupted stored copy cannot hide a
    // valid request/session packet with the same revision id.
    const unsignedPacket = {
      ...rawPacket,
      header: {
        ...rawHeader,
        integrity: {
          ...rawIntegrity,
          digest: null,
          embedded_signatures: [],
          signature_refs: [],
        },
      },
    };

    return {
      packetId: rawPacket.header.packet_id,
      revisionId: rawPacket.header.revision_id,
      dedupeKey: `${rawPacket.header.revision_id}:${canonicalizeJson(unsignedPacket)}`,
    };
  }

  private getIdentityVerificationFailureCode(
    source: 'stored' | 'request' | 'session',
    category: 'signature' | 'canonicalization' | 'metadata' | 'schema'
  ): NexusAuthFailureCode {
    if (category === 'signature') {
      return source === 'stored'
        ? 'stored_actor_signature_invalid'
        : source === 'session'
          ? 'session_actor_signature_invalid'
          : 'request_actor_signature_invalid';
    }

    if (category === 'canonicalization') {
      return source === 'stored'
        ? 'stored_actor_canonicalization_mismatch'
        : source === 'session'
          ? 'session_actor_canonicalization_mismatch'
          : 'request_actor_canonicalization_mismatch';
    }

    if (category === 'metadata') {
      return source === 'stored'
        ? 'stored_actor_metadata_invalid'
        : source === 'session'
          ? 'session_actor_metadata_invalid'
          : 'request_actor_metadata_invalid';
    }

    return source === 'stored'
      ? 'stored_actor_schema_invalid'
      : source === 'session'
        ? 'session_actor_schema_invalid'
        : 'request_actor_schema_invalid';
  }

  private async verifyIdentityPacket(
    actorPacketInput: unknown,
    source: 'stored' | 'request' | 'session' = 'request'
  ): Promise<PacketEnvelopeByType['Element']> {
    // Auth verifies the raw signed packet first, then parses the adapted read
    // view only after the signature is known-good.
    let rawActorPacket: RawPacketEnvelopeInput;

    try {
      rawActorPacket = this.parseRawPersonIdentityPacket(actorPacketInput);
    } catch (error) {
      throw new NexusAuthFailureError(
        error instanceof Error
          ? error.message
          : 'Actor packet must be a person element.',
        {
          failureCode: this.getIdentityVerificationFailureCode(source, 'schema'),
        }
      );
    }

    const rawBody = rawActorPacket.body as Record<string, unknown>;
    const identity =
      rawBody.identity &&
      typeof rawBody.identity === 'object' &&
      !Array.isArray(rawBody.identity)
        ? (rawBody.identity as Record<string, unknown>)
        : null;

    if (!identity) {
      throw new NexusAuthFailureError(
        'Person element is missing public key bindings.',
        {
          failureCode: this.getIdentityVerificationFailureCode(source, 'schema'),
        }
      );
    }

    const publicKeyBindings = identity.public_key_bindings;

    if (
      !Array.isArray(publicKeyBindings) ||
      publicKeyBindings.length === 0
    ) {
      throw new NexusAuthFailureError(
        'Person element is missing public key bindings.',
        {
          failureCode: this.getIdentityVerificationFailureCode(source, 'schema'),
        }
      );
    }

    const signatureRecord =
      rawActorPacket.header.integrity &&
      typeof rawActorPacket.header.integrity === 'object' &&
      !Array.isArray(rawActorPacket.header.integrity)
        ? (
            rawActorPacket.header.integrity as Record<string, unknown>
          ).embedded_signatures
        : null;
    const signature =
      Array.isArray(signatureRecord) && signatureRecord.length > 0
        ? signatureRecord[0]
        : null;

    if (!signature) {
      throw new NexusAuthFailureError(
        'Person element is missing its embedded signature.',
        {
          failureCode: this.getIdentityVerificationFailureCode(source, 'signature'),
        }
      );
    }

    const signatureObject =
      signature && typeof signature === 'object' && !Array.isArray(signature)
        ? (signature as Record<string, unknown>)
        : null;
    const signerPacketRef =
      signatureObject?.signer_packet_ref &&
      typeof signatureObject.signer_packet_ref === 'object' &&
      !Array.isArray(signatureObject.signer_packet_ref)
        ? (signatureObject.signer_packet_ref as Record<string, unknown>)
        : null;

    if (
      signerPacketRef &&
      typeof signerPacketRef.packet_id === 'string' &&
      signerPacketRef.packet_id !== rawActorPacket.header.packet_id
    ) {
      throw new NexusAuthFailureError(
        'Person element signature signer does not match this actor packet.',
        {
          failureCode: this.getIdentityVerificationFailureCode(source, 'signature'),
        }
      );
    }

    const signatureKid =
      signatureObject && typeof signatureObject.kid === 'string'
        ? signatureObject.kid
        : null;
    const activeKeyBinding = publicKeyBindings.find((binding) => {
      if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
        return false;
      }

      const bindingRecord = binding as Record<string, unknown>;

      return (
        typeof bindingRecord.kid === 'string' &&
        bindingRecord.kid === signatureKid &&
        (bindingRecord.status ?? 'active') === 'active'
      );
    });

    if (!activeKeyBinding) {
      throw new NexusAuthFailureError(
        'Person element signature key is not active for this identity.',
        {
          failureCode: this.getIdentityVerificationFailureCode(source, 'signature'),
        }
      );
    }

    const verification = await verifyPacketSignatureDetailed({
      packet: actorPacketInput,
      signerPacket: actorPacketInput,
    });

    if (!verification.isValid) {
      const failureCategory =
        verification.failureKind === 'canonicalization_mismatch'
          ? 'canonicalization'
          : 'signature';
      const message =
        verification.failureKind === 'canonicalization_mismatch'
          ? 'Person element canonical signature bytes no longer match the signed packet shape.'
          : 'Person element cryptographic signature verification failed.';

      throw new NexusAuthFailureError(message, {
        failureCode: this.getIdentityVerificationFailureCode(
          source,
          failureCategory
        ),
      });
    }

    let actorPacket: PacketEnvelopeByType['Element'];

    try {
      actorPacket = this.parsePersonIdentityPacket(actorPacketInput);
    } catch (error) {
      throw new NexusAuthFailureError(
        error instanceof Error
          ? error.message
          : 'Actor packet must be a person element.',
        {
          failureCode: this.getIdentityVerificationFailureCode(source, 'schema'),
        }
      );
    }

    try {
      validateIdentityPacketMetadata(actorPacket);
    } catch (error) {
      throw new NexusAuthFailureError(
        error instanceof Error
          ? error.message
          : 'Identity packet metadata validation failed.',
        {
          failureCode: this.getIdentityVerificationFailureCode(source, 'metadata'),
        }
      );
    }

    return actorPacket;
  }

  private getActiveIdentityKeyBinding(input: {
    actorPacket: PacketEnvelopeByType['Element'];
    kid: string;
  }): NonNullable<
    NonNullable<PacketEnvelopeByType['Element']['body']['identity']>['public_key_bindings']
  >[number] | null {
    return (
      input.actorPacket.body.identity?.public_key_bindings.find(
        (binding) => binding.kid === input.kid && binding.status === 'active'
      ) ?? null
    );
  }

  private async resolveVerifiedSessionActorCandidate(input: {
    request?: Request | null;
    sessionRecord?: Pick<
      AuthSessionRecord,
      'session_id' | 'actor_packet_id' | 'expires_at' | 'auth_method'
    > | null;
    expectedActorPacketId: string;
    actorAssertionKid: string;
    requestActorPacketInput?: unknown;
    requestActorPacket?: PacketEnvelopeByType['Element'] | null;
    sessionActorPacket?: PacketEnvelopeByType['Element'] | null;
  }): Promise<{
    packet: PacketEnvelopeByType['Element'];
    parsedActor: PacketEnvelopeByType['Element'];
    activeSigningKey: NonNullable<
      NonNullable<PacketEnvelopeByType['Element']['body']['identity']>['public_key_bindings']
    >[number];
    source: 'stored' | 'request' | 'session';
  }> {
    const candidates: {
      source: 'stored' | 'request' | 'session';
      packetInput: unknown;
      packet: PacketEnvelopeByType['Element'] | null;
    }[] = [];
    const storedActorPacketInput = await this.getPersonPacketRevisionInput(
      input.expectedActorPacketId
    );
    const seenCandidateKeys = new Set<string>();

    const pushCandidate = (
      source: 'stored' | 'request' | 'session',
      packetInput: unknown | null | undefined,
      packet: PacketEnvelopeByType['Element'] | null | undefined
    ) => {
      if (!packetInput || !packet) {
        return;
      }

      const fingerprint = this.buildRawActorCandidateFingerprint(packetInput);

      if (
        fingerprint.packetId !== input.expectedActorPacketId ||
        seenCandidateKeys.has(fingerprint.dedupeKey)
      ) {
        return;
      }

      seenCandidateKeys.add(fingerprint.dedupeKey);
      candidates.push({
        source,
        packetInput,
        packet,
      });
    };

    if (storedActorPacketInput) {
      try {
        pushCandidate(
          'stored',
          storedActorPacketInput,
          this.parsePersonIdentityPacket(storedActorPacketInput)
        );
      } catch {
        candidates.push({
          source: 'stored',
          packetInput: storedActorPacketInput,
          packet: null,
        });
      }
    }

    pushCandidate(
      'request',
      input.requestActorPacketInput ?? input.requestActorPacket ?? null,
      input.requestActorPacket ?? null
    );
    pushCandidate(
      'session',
      input.sessionActorPacket ?? null,
      input.sessionActorPacket ?? null
    );

    const candidateErrors: Error[] = [];
    let storedActorPacket: PacketEnvelopeByType['Element'] | null = null;

    if (storedActorPacketInput) {
      try {
        storedActorPacket = this.parsePersonIdentityPacket(storedActorPacketInput);
      } catch {
        storedActorPacket = null;
      }
    }

    for (const candidate of candidates) {
      let candidatePacketId: string | null = null;

      try {
        candidatePacketId = this.buildRawActorCandidateFingerprint(
          candidate.packetInput
        ).packetId;
      } catch {
        candidatePacketId = null;
      }

      if (!candidatePacketId || candidatePacketId !== input.expectedActorPacketId) {
        candidateErrors.push(
          this.createAuthGateError({
            reason: 'stale_actor_packet',
            message: 'Authenticated session actor does not match the claimed identity.',
            failureCode: 'session_actor_mismatch',
            request: input.request,
            sessionRecord: input.sessionRecord ?? null,
            requestActorPacket: input.requestActorPacket ?? null,
            storedActorPacket,
            expectedActorPacketId: input.expectedActorPacketId,
            actorRequired: true,
          })
        );
        continue;
      }

      try {
        const verifiedPacket = await this.verifyIdentityPacket(
          candidate.packetInput,
          candidate.source
        );
        const activeSigningKey = this.getActiveIdentityKeyBinding({
          actorPacket: verifiedPacket,
          kid: input.actorAssertionKid,
        });

        if (!activeSigningKey) {
          candidateErrors.push(
            this.createAuthFailureError({
              message: 'Actor assertion key is not active for that identity.',
              failureCode:
                candidate.source === 'request'
                  ? 'request_actor_revision_stale'
                  : 'actor_assertion_key_inactive',
              request: input.request,
              sessionRecord: input.sessionRecord ?? null,
              requestActorPacket: input.requestActorPacket ?? null,
              storedActorPacket,
              expectedActorPacketId: input.expectedActorPacketId,
            })
          );
          continue;
        }

        return {
          packet: verifiedPacket,
          parsedActor: verifiedPacket,
          activeSigningKey,
          source: candidate.source,
        };
      } catch (error) {
        const failureCode =
          isNexusAuthFailureError(error)
            ? error.failureCode
            : candidate.source === 'stored'
              ? 'stored_actor_signature_invalid'
              : candidate.source === 'session'
                ? 'session_actor_signature_invalid'
                : 'request_actor_signature_invalid';
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to verify the claimed identity packet.';

        candidateErrors.push(
          this.createAuthFailureError({
            message,
            failureCode,
            request: input.request,
            sessionRecord: input.sessionRecord ?? null,
            requestActorPacket: input.requestActorPacket ?? null,
            storedActorPacket,
            expectedActorPacketId: input.expectedActorPacketId,
          })
        );
      }
    }

    throw (
      candidateErrors[0] ??
      new Error('Unable to verify the claimed identity packet.')
    );
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
    requiredProofLevel?: WriteProofLevel | null;
  }): Promise<{
    actorPacket: PacketEnvelopeByType['Element'];
    actorKey: string;
    actorClass: DiscussionActorClass;
    proofBundle: MutationProofBundle;
  }> {
    assertRecentAssertion(input.actorAssertion.issued_at);

    const parsedActorPacket = this.parsePersonIdentityPacket(input.actorPacket);
    const storedActorPacketInput = await this.getPersonPacketRevisionInput(
      parsedActorPacket.header.packet_id
    );

    if (!storedActorPacketInput) {
      const verifiedProvidedActorPacket = await this.verifyIdentityPacket(
        input.actorPacket,
        'request'
      );

      if (verifiedProvidedActorPacket.body.identity?.claim_status !== 'claimed') {
        await this.persistVerifiedIdentityPacket(verifiedProvidedActorPacket);
      }
    }

    const sessionRecord =
      parsedActorPacket.body.identity?.claim_status === 'claimed'
        ? this.requireAuthenticatedSession({
            request: input.request,
            actorPacketId: parsedActorPacket.header.packet_id,
            csrfToken: input.csrfToken,
          })
        : null;

    const resolvedActor = await this.resolveVerifiedSessionActorCandidate({
      request: input.request,
      expectedActorPacketId: parsedActorPacket.header.packet_id,
      actorAssertionKid: input.actorAssertion.kid,
      requestActorPacketInput: input.actorPacket,
      requestActorPacket: parsedActorPacket,
      sessionRecord: sessionRecord ?? undefined,
    });
    const storedActorPacket = resolvedActor.packet;

    if (
      input.actorAssertion.actor_packet_id !==
      storedActorPacket.header.packet_id
    ) {
      throw this.createAuthFailureError({
        message: 'Actor assertion packet id does not match the actor packet.',
        failureCode: 'actor_assertion_packet_mismatch',
        request: input.request,
        sessionRecord,
        requestActorPacket: parsedActorPacket,
        storedActorPacket,
        expectedActorPacketId: storedActorPacket.header.packet_id,
      });
    }

    const assertionIsValid = await verifyActorAssertion({
      assertion: input.actorAssertion,
      publicJwk: resolvedActor.activeSigningKey.public_jwk as JsonWebKey,
      body: input.body,
    });

    if (!assertionIsValid) {
      throw this.createAuthFailureError({
        message: 'Actor assertion verification failed.',
        failureCode: 'assertion_signature_invalid',
        request: input.request,
        sessionRecord,
        requestActorPacket: parsedActorPacket,
        storedActorPacket,
        expectedActorPacketId: storedActorPacket.header.packet_id,
      });
    }

    if (input.actorAssertion.method.toUpperCase() !== input.method) {
      throw this.createAuthFailureError({
        message: 'Actor assertion method does not match this request.',
        failureCode: 'assertion_signature_invalid',
        request: input.request,
        sessionRecord,
        requestActorPacket: parsedActorPacket,
        storedActorPacket,
        expectedActorPacketId: storedActorPacket.header.packet_id,
      });
    }

    if (input.actorAssertion.path !== input.path) {
      throw this.createAuthFailureError({
        message: 'Actor assertion path does not match this request.',
        failureCode: 'assertion_signature_invalid',
        request: input.request,
        sessionRecord,
        requestActorPacket: parsedActorPacket,
        storedActorPacket,
        expectedActorPacketId: storedActorPacket.header.packet_id,
      });
    }

    let hasRecentReauth = false;
    let hasPasskeyConfirmation = false;
    let reauthProofMethod: ReauthProofMethod | null = null;

    if (storedActorPacket.body.identity?.claim_status === 'claimed') {
      const claimedSessionRecord =
        sessionRecord ??
        this.requireAuthenticatedSession({
          request: input.request,
          actorPacketId: storedActorPacket.header.packet_id,
          csrfToken: input.csrfToken,
        });
      const securityMode = await this.resolveEffectiveSecurityMode(
        storedActorPacket.header.packet_id
      );
      const requiresFreshReauth =
        input.requiredProofLevel === 'reauth' ||
        input.requiredProofLevel === 'passkey' ||
        (!input.requiredProofLevel &&
          (securityMode === 'every_write' ||
            (securityMode === 'guarded' &&
              (input.writeRisk ?? 'standard') === 'high_impact')));

      if (requiresFreshReauth) {
        let consumedToken;

        try {
          consumedToken = this.consumeReauthToken({
            actorPacketId: storedActorPacket.header.packet_id,
            sessionId: claimedSessionRecord.session_id,
            reauthToken: input.reauthToken,
            purpose: 'interaction',
          });
        } catch (error) {
          throw this.createAuthGateError({
            reason: 'write_approval_required',
            message:
              error instanceof Error
                ? error.message
                : 'This action requires a fresh re-auth token.',
            failureCode: input.reauthToken
              ? 'reauth_token_actor_mismatch'
              : 'reauth_token_missing',
            request: input.request,
            sessionRecord: claimedSessionRecord,
            requestActorPacket: parsedActorPacket,
            storedActorPacket,
            expectedActorPacketId: storedActorPacket.header.packet_id,
            retryable: true,
            actorRequired: true,
            writeApprovalRequired: true,
          });
        }
        hasRecentReauth = true;
        hasPasskeyConfirmation =
          consumedToken.proof_method === 'passkey_confirmation';
        reauthProofMethod = consumedToken.proof_method;
      }
    }

    return {
      actorPacket: storedActorPacket,
      actorKey: `element:${storedActorPacket.header.packet_id}`,
      actorClass:
        storedActorPacket.body.identity?.claim_status === 'claimed'
          ? 'scope_member'
          : 'anonymous_guest',
      proofBundle: {
        actor_packet_id: storedActorPacket.header.packet_id,
        is_claimed_identity:
          storedActorPacket.body.identity?.claim_status === 'claimed',
        has_actor_assertion: true,
        has_claimed_session:
          storedActorPacket.body.identity?.claim_status === 'claimed',
        has_unlocked_identity: true,
        has_recent_reauth: hasRecentReauth,
        has_passkey_confirmation: hasPasskeyConfirmation,
        proof_methods: this.toMutationProofMethods({
          isClaimedIdentity:
            storedActorPacket.body.identity?.claim_status === 'claimed',
          isUnlockedIdentity: true,
          reauthProofMethod,
        }),
      },
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

    let assertion: Awaited<ReturnType<typeof verifyPasskeyAssertion>>;

    try {
      assertion = await verifyPasskeyAssertion({
        credential: input.credential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: getRequestOrigin(input.request),
        expectedRpId: getRequestRpId(input.request),
        publicKeySpki: passkey.public_key_spki,
        previousCounter: passkey.sign_count,
      });
    } catch (error) {
      throw this.normalizePasskeyAssertionError(error, 'sign-in');
    }

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

    let assertion: Awaited<ReturnType<typeof verifyPasskeyAssertion>>;

    try {
      assertion = await verifyPasskeyAssertion({
        credential: input.credential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: getRequestOrigin(input.request),
        expectedRpId: getRequestRpId(input.request),
        publicKeySpki: passkey.public_key_spki,
        previousCounter: passkey.sign_count,
      });
    } catch (error) {
      throw this.normalizePasskeyAssertionError(error, 're-approval');
    }

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
      proofMethod: 'passkey_confirmation',
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
      proof_method: token.proof_method,
    };
  }

  async verifySignedReauth(input: {
    request: Request;
    csrfToken: string | null;
    actorPacket: unknown;
    actorAssertion: ActorAssertion;
    purpose: ReauthPurpose;
    proofMethod?: ReauthProofMethod;
  }): Promise<NexusReauthVerifyPayload> {
    assertRecentAssertion(input.actorAssertion.issued_at);
    const providedActorPacket = this.parsePersonIdentityPacket(input.actorPacket);
    const sessionRecord = this.requireAuthenticatedSession({
      request: input.request,
      actorPacketId: providedActorPacket.header.packet_id,
      csrfToken: input.csrfToken,
    });
    const resolvedActor = await this.resolveVerifiedSessionActorCandidate({
      request: input.request,
      expectedActorPacketId: sessionRecord.actor_packet_id,
      actorAssertionKid: input.actorAssertion.kid,
      requestActorPacketInput: input.actorPacket,
      requestActorPacket: providedActorPacket,
      sessionRecord,
    });
    const actorPacket = resolvedActor.packet;

    const assertionIsValid = await verifyActorAssertion({
      assertion: input.actorAssertion,
      publicJwk: resolvedActor.activeSigningKey.public_jwk as JsonWebKey,
      body: {
        purpose: input.purpose,
        proof_method: input.proofMethod ?? 'signed_reauth',
      },
    });

    if (!assertionIsValid) {
      throw this.createAuthFailureError({
        message: 'Signed re-auth assertion verification failed.',
        failureCode: 'assertion_signature_invalid',
        request: input.request,
        sessionRecord,
        requestActorPacket: providedActorPacket,
        storedActorPacket: actorPacket,
        expectedActorPacketId: actorPacket.header.packet_id,
      });
    }

    if (input.actorAssertion.method.toUpperCase() !== 'POST') {
      throw this.createAuthFailureError({
        message: 'Signed re-auth assertion method does not match this request.',
        failureCode: 'assertion_signature_invalid',
        request: input.request,
        sessionRecord,
        requestActorPacket: providedActorPacket,
        storedActorPacket: actorPacket,
        expectedActorPacketId: actorPacket.header.packet_id,
      });
    }

    if (input.actorAssertion.path !== '/api/nexus/auth/reauth/signed') {
      throw this.createAuthFailureError({
        message: 'Signed re-auth assertion path does not match this request.',
        failureCode: 'assertion_signature_invalid',
        request: input.request,
        sessionRecord,
        requestActorPacket: providedActorPacket,
        storedActorPacket: actorPacket,
        expectedActorPacketId: actorPacket.header.packet_id,
      });
    }

    if (input.actorAssertion.actor_packet_id !== actorPacket.header.packet_id) {
      throw this.createAuthFailureError({
        message: 'Signed re-auth assertion actor does not match the actor packet.',
        failureCode: 'reauth_token_actor_mismatch',
        request: input.request,
        sessionRecord,
        requestActorPacket: providedActorPacket,
        storedActorPacket: actorPacket,
        expectedActorPacketId: actorPacket.header.packet_id,
      });
    }

    const token = this.createReauthToken({
      actorPacketId: sessionRecord.actor_packet_id,
      sessionId: sessionRecord.session_id,
      purpose: input.purpose,
      proofMethod: input.proofMethod ?? 'signed_reauth',
    });

    this.writeAuthEvent({
      actorPacketId: sessionRecord.actor_packet_id,
      sessionId: sessionRecord.session_id,
      eventType: 'signed_reauth_used',
      metadata: {
        auth_method: 'signed-reauth',
        purpose: input.purpose,
        proof_method: token.proof_method,
      },
    });

    return {
      reauth_token: token.reauth_token_id,
      expires_at: token.expires_at,
      proof_method: token.proof_method,
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

    if (currentPasskeys.length < 1) {
      throw new Error('No active passkey exists for this identity.');
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
      security_mode: await this.resolveEffectiveSecurityMode(
        sessionRecord.actor_packet_id
      ),
    };
  }

  async updateSecurityPreferences(input: {
    request: Request;
    csrfToken: string | null;
    reauthToken: string | null;
    securityMode: NexusSecurityMode;
  }): Promise<NexusSecurityPreferencesPayload> {
    void input;
    throw new Error(
      'Direct runtime security preference writes are deprecated. Use actor.write_policy.update through Dispatch-owned trusted writes.'
    );
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
