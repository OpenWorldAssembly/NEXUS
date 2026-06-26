/**
 * File: identity-shell-context.tsx
 * Description: Provides client-side Nexus identity shell state for guest, persistent, and claimed cryptographic actors.
 */

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  createActorAssertion,
  createIdentityKeyBinding,
  decryptIdentityBundle,
  encryptIdentityBundle,
  exportIdentityKeyPairToJwk,
  generateP256KeyPair,
  importPrivateKeyFromJwk,
  signPacketWithIdentity,
  type EncryptedIdentityBundle,
} from '@runtime/nexus/identity-crypto';
import type {
  MutationIntent,
} from '@core/auth/mutation-corridor';
import type { PacketEnvelope } from '@core/schema/packet-schema';
import type {
  MutationProofMethod,
} from '@core/auth/proof-types';
import type {
  NexusAuthSessionPayload,
  NexusFinalizedMutationPayload,
  NexusLocalIdentityPreview,
  NexusPasskeyListPayload,
  NexusPasskeyRegistrationOptionsPayload,
  NexusPasskeyRequestOptionsPayload,
  NexusPasskeyVerifyPayload,
  NexusReauthVerifyPayload,
  NexusSecurityMode,
  NexusSessionListPayload,
} from '@runtime/nexus/nexus-api-types';
import {
  createClaimedIdentityRevision,
  createGuestAlias,
  createIdentityLabel,
  createPersonIdentityPacket,
  type IdentityBundleRecord,
  type IdentityLocationDisclosure,
  type NexusIdentityMode,
  type StoredIdentityRecord,
} from '@runtime/nexus/identity-shell';
import {
  clearCurrentIdentityPreference,
  clearPreservedGuestIdentity,
  clearSessionGuestIdentity,
  createLockedActiveIdentityFromActorPacket,
  deleteObjectStoreValue,
  normalizeGuestClaimStatus,
  readCurrentIdentityPreference,
  readPreservedGuestIdentity,
  readRememberClaimedSessionPreference,
  readSessionGuestIdentity,
  readStoredIdentityRecords,
  storePreservedGuestIdentity,
  storeSessionGuestIdentity,
  toActiveIdentityState,
  toStoredIdentityPreview,
  writeCurrentIdentityPreference,
  writeObjectStore,
  writeRememberClaimedSessionPreference,
  type ActiveIdentityState,
  type NexusStorageMode,
} from '@runtime/nexus/identity-storage';
import {
  buildSignedMigratedIdentityPacket,
  classifyStoredIdentityForMigration,
} from '@runtime/nexus/identity-migration';
import {
  completePasskeyAssertion,
  isPasskeySupported,
  registerPasskey,
} from '@runtime/nexus/webauthn';
import {
  adoptClaimedSessionActorPacket,
  assertClaimedActorPacketReady,
  resolveClaimedSessionActorPacket,
} from '@runtime/nexus/claimed-identity-session';
import {
  isNexusAuthGatePayload,
  NexusAuthGateError,
} from '@runtime/nexus/nexus-auth-gate-error';
import { createIdentityShellDispatchAdapter } from '@app/components/nexus/identity-shell-dispatch-adapter';
const IDENTITY_STORE_NAME = 'identities';
const FRESH_UNLOCKED_IDENTITY_HANDOFF_MS = 30_000;

type PendingInteractionProof = {
  reauthToken: string;
  proofMethod: NexusReauthVerifyPayload['proof_method'];
  expiresAt: string;
};

type UnlockedActiveIdentity = ActiveIdentityState & { privateJwk: JsonWebKey };

type FreshUnlockedIdentityHandoff = {
  identity: UnlockedActiveIdentity;
  expiresAtMs: number;
};

type IdentityShellContextValue = {
  isReady: boolean;
  currentIdentity: ActiveIdentityState | null;
  currentLabel: string;
  currentActorPacketId: string | null;
  currentMode: NexusIdentityMode | null;
  currentStorageMode: NexusStorageMode | null;
  isCurrentIdentityUnlocked: boolean;
  isAuthenticated: boolean;
  isUsingSessionCookies: boolean;
  isPasskeySupported: boolean;
  rememberClaimedSessions: boolean;
  authSession: NexusAuthSessionPayload | null;
  storedIdentityPreviews: NexusLocalIdentityPreview[];
  securityMode: NexusSecurityMode | null;
  passkeyCount: number;
  requiresPasskeyUpgrade: boolean;
  sessionSummaries: NexusSessionListPayload['sessions'];
  sessionSummariesError: string | null;
  passkeySummaries: NexusPasskeyListPayload['passkeys'];
  hasAvailablePasskeyApproval: boolean;
  unlockStoredIdentity: (input: {
    actorPacketId: string;
    passphrase: string;
  }) => Promise<void>;
  approveProtectedWriteWithPassphrase: (passphrase: string) => Promise<void>;
  approveProtectedWriteWithPasskey: () => Promise<void>;
  continueAsEphemeralGuest: () => Promise<void>;
  continueAsSessionGuest: () => Promise<void>;
  saveGuestOnDevice: () => Promise<void>;
  createClaimedIdentity: (input: {
    alias: string;
    passphrase: string;
    locationDisclosure?: IdentityLocationDisclosure | null;
    residenceScopePacketId?: string | null;
    keepMeLoggedIn: boolean;
  }) => Promise<void>;
  claimCurrentGuest: (input: {
    alias: string;
    passphrase: string;
    locationDisclosure?: IdentityLocationDisclosure | null;
    residenceScopePacketId?: string | null;
    keepMeLoggedIn: boolean;
  }) => Promise<void>;
  signInStoredIdentity: (input: {
    actorPacketId: string;
    passphrase: string;
    keepMeLoggedIn: boolean;
  }) => Promise<NexusAuthSessionPayload>;
  migrateStoredIdentity: (input: {
    actorPacketId: string;
    passphrase: string;
    keepMeLoggedIn: boolean;
  }) => Promise<NexusAuthSessionPayload>;
  signInWithPasskey: (input: { keepMeLoggedIn: boolean }) => Promise<void>;
  registerCurrentPasskey: (sessionOverride?: NexusAuthSessionPayload | null) => Promise<void>;
  restoreIdentityFromBundle: (input: {
    encryptedBundleJson: string;
    passphrase: string;
  }) => Promise<void>;
  exportCurrentIdentityBundle: (passphrase: string) => Promise<string>;
  setSecurityMode: (securityMode: NexusSecurityMode) => Promise<void>;
  runDispatchMutation: <TResult = unknown>(input: {
    intent: MutationIntent;
    writeRisk?: 'standard' | 'high_impact';
    interfaceEventHeaders?: Record<string, string>;
  }) => Promise<NexusFinalizedMutationPayload & { result: TResult }>;
  revokePasskey: (credentialId: string) => Promise<void>;
  revokeSession: (sessionId: string) => Promise<void>;
  revokeOtherSessions: () => Promise<void>;
  signOut: () => Promise<void>;
  createVerifiedRequestBody: <TPayload extends Record<string, unknown>>(
    path: string,
    method: 'POST' | 'PUT',
    payload: TPayload,
    options?: {
      writeRisk?: 'standard' | 'high_impact';
      skipAutomaticReauth?: boolean;
      reauthTokenOverride?: string | null;
    }
  ) => Promise<TPayload & Record<string, unknown>>;
  signCurrentIdentityPacket: <TPacket extends PacketEnvelope>(
    packet: TPacket
  ) => Promise<TPacket>;
  refreshAuthSession: () => Promise<NexusAuthSessionPayload>;
  recoverClaimedSessionInPlace: () => Promise<boolean>;
  resumeClaimedIdentitySessionWithPassphrase: (passphrase: string) => Promise<void>;
  setRememberClaimedSessions: (rememberClaimedSessions: boolean) => Promise<void>;
};

const IdentityShellContext = createContext<IdentityShellContextValue | null>(null);

async function createSignedIdentityBundle(input: {
  alias: string;
  claimStatus: NexusIdentityMode;
  locationDisclosure?: IdentityLocationDisclosure | null;
}): Promise<IdentityBundleRecord & { actorPacket: ActiveIdentityState['actorPacket'] }> {
  const createdAt = new Date().toISOString();
  const keyPair = await generateP256KeyPair();
  const exportedKeys = await exportIdentityKeyPairToJwk(keyPair);
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: exportedKeys.publicJwk,
    addedAt: createdAt,
  });
  const actorPacket = createPersonIdentityPacket({
    alias: input.alias,
    claimStatus: input.claimStatus,
    publicKeyBinding: keyBinding,
    createdAt,
    locationDisclosure: input.locationDisclosure ?? null,
  });
  const signedPacket = await signPacketWithIdentity({
    packet: actorPacket,
    signerPacketId: actorPacket.header.packet_id,
    kid: keyBinding.kid,
    privateKey: keyPair.privateKey,
    signedAt: createdAt,
  });

  return {
    actorPacket: signedPacket,
    publicJwk: exportedKeys.publicJwk,
    privateJwk: exportedKeys.privateJwk,
  };
}

async function fetchJsonOrThrow<TValue>(
  path: string,
  input?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<TValue> {
  const response = await fetch(path, {
    method: input?.method ?? 'GET',
    headers:
      input?.body === undefined
        ? input?.headers
        : {
            'content-type': 'application/json',
            ...(input.headers ?? {}),
          },
    body: input?.body === undefined ? undefined : JSON.stringify(input.body),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: string; auth_gate?: unknown }
      | null;

    if (isNexusAuthGatePayload(errorBody)) {
      throw new NexusAuthGateError(
        errorBody.auth_gate.reason,
        errorBody.auth_gate.message ?? errorBody.error ?? 'Identity request failed.',
        {
          retryable: errorBody.auth_gate.retryable,
          actorRequired: errorBody.auth_gate.actor_required,
          writeApprovalRequired: errorBody.auth_gate.write_approval_required,
          failureCode: errorBody.auth_gate.failure_code,
          diagnostics: errorBody.auth_gate.diagnostics,
        }
      );
    }

    throw new Error(errorBody?.error ?? 'Identity request failed.');
  }

  return (await response.json()) as TValue;
}

export function IdentityShellProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);
  const [isPasskeyPlatformSupported, setIsPasskeyPlatformSupported] = useState(false);
  const [currentIdentity, setCurrentIdentity] = useState<ActiveIdentityState | null>(
    null
  );
  const [rememberClaimedSessions, setRememberClaimedSessionsState] = useState(true);
  const [storedIdentityPreviews, setStoredIdentityPreviews] = useState<
    NexusLocalIdentityPreview[]
  >([]);
  const [authSession, setAuthSession] = useState<NexusAuthSessionPayload | null>(
    null
  );
  const [sessionSummaries, setSessionSummaries] = useState<
    NexusSessionListPayload['sessions']
  >([]);
  const [sessionSummariesError, setSessionSummariesError] = useState<string | null>(
    null
  );
  const [passkeySummaries, setPasskeySummaries] = useState<
    NexusPasskeyListPayload['passkeys']
  >([]);
  const pendingInteractionProofRef = useRef<PendingInteractionProof | null>(null);
  const freshUnlockedIdentityRef = useRef<FreshUnlockedIdentityHandoff | null>(
    null
  );

  const refreshStoredIdentities = async () => {
    const records = await readStoredIdentityRecords();

    setStoredIdentityPreviews(records.map(toStoredIdentityPreview));
  };

  const parseEncryptedBundleJson = (
    encryptedBundleJson: string,
    malformedMessage: string
  ): EncryptedIdentityBundle => {
    try {
      const parsedBundle = JSON.parse(encryptedBundleJson) as Partial<EncryptedIdentityBundle>;

      if (
        !parsedBundle ||
        typeof parsedBundle.salt !== 'string' ||
        typeof parsedBundle.iv !== 'string' ||
        typeof parsedBundle.cipher_text !== 'string'
      ) {
        throw new Error(malformedMessage);
      }

      return parsedBundle as EncryptedIdentityBundle;
    } catch (error) {
      if (error instanceof Error && error.message === malformedMessage) {
        throw error;
      }

      throw new Error(malformedMessage);
    }
  };

  const isBundleDecryptFailure = (error: unknown): boolean => {
    if (error instanceof DOMException) {
      if (
        error.name === 'OperationError' ||
        error.name === 'DataError' ||
        error.name === 'InvalidAccessError'
      ) {
        return true;
      }

      return /decrypt|operation failed|operation-specific reason/i.test(error.message);
    }

    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.name === 'OperationError' ||
      error.name === 'DataError' ||
      error.name === 'InvalidAccessError' ||
      /unable to decrypt/i.test(error.message) ||
      /decrypt|operation failed|operation-specific reason/i.test(error.message)
    );
  };

  const decryptBundleWithPassphrase = async (input: {
    passphrase: string;
    encryptedBundle: EncryptedIdentityBundle;
  }): Promise<unknown> => {
    try {
      return await decryptIdentityBundle({
        passphrase: input.passphrase,
        encryptedBundle: input.encryptedBundle,
      });
    } catch (error) {
      if (isBundleDecryptFailure(error)) {
        throw new Error('Incorrect bundle passphrase.');
      }

      throw error instanceof Error ? error : new Error('Unable to unlock the identity bundle.');
    }
  };

  const stashPendingInteractionProof = (proof: PendingInteractionProof) => {
    pendingInteractionProofRef.current = proof;
  };

  const clearPendingInteractionProof = () => {
    pendingInteractionProofRef.current = null;
  };

  const stashFreshUnlockedIdentity = (identity: UnlockedActiveIdentity) => {
    freshUnlockedIdentityRef.current = {
      identity,
      expiresAtMs: Date.now() + FRESH_UNLOCKED_IDENTITY_HANDOFF_MS,
    };
  };

  const clearFreshUnlockedIdentity = () => {
    freshUnlockedIdentityRef.current = null;
  };

  const createClientIdentityHeaders = (
    identity: ActiveIdentityState
  ): Record<string, string> => ({
    'x-nexus-client-actor-packet-id': identity.actorPacket.header.packet_id,
    'x-nexus-client-actor-revision-id': identity.actorPacket.header.revision_id,
    'x-nexus-client-identity-mode': identity.claimStatus,
  });

  const resolveGuestFallbackIdentity = async (input?: {
    storedRecords?: StoredIdentityRecord[];
    preferredActorPacketId?: string | null;
  }): Promise<ActiveIdentityState> => {
    const storedRecords = input?.storedRecords ?? (await readStoredIdentityRecords());
    const preferredActorPacketId =
      input?.preferredActorPacketId ?? (await readCurrentIdentityPreference());
    const sessionGuest = readSessionGuestIdentity();

    if (sessionGuest) {
      return {
        actorPacket: sessionGuest.actorPacket,
        publicJwk: sessionGuest.publicJwk,
        privateJwk: sessionGuest.privateJwk,
        claimStatus: sessionGuest.claimStatus,
        storedKind: null,
      };
    }

    if (preferredActorPacketId) {
      const preferredGuestRecord = storedRecords.find(
        (record) =>
          record.actor_packet_id === preferredActorPacketId &&
          record.stored_kind === 'persistent_guest' &&
          Boolean(record.private_jwk)
      );

      if (preferredGuestRecord) {
        const preferredGuest = toActiveIdentityState(preferredGuestRecord);

        if (preferredGuest) {
          return preferredGuest;
        }
      }
    }

    const persistentGuestRecord = storedRecords.find(
      (record) =>
        record.stored_kind === 'persistent_guest' && Boolean(record.private_jwk)
    );

    if (persistentGuestRecord) {
      const persistentGuest = toActiveIdentityState(persistentGuestRecord);

      if (persistentGuest) {
        return persistentGuest;
      }
    }

    const nextIdentity = await createSignedIdentityBundle({
      alias: createGuestAlias(),
      claimStatus: 'ephemeral_guest',
    });

    return {
      actorPacket: nextIdentity.actorPacket,
      publicJwk: nextIdentity.publicJwk,
      privateJwk: nextIdentity.privateJwk,
      claimStatus: 'ephemeral_guest',
      storedKind: null,
    };
  };

  const clearCurrentGuestDeviceSave = async (actorPacketId: string) => {
    await deleteObjectStoreValue(IDENTITY_STORE_NAME, actorPacketId).catch(() => undefined);
    await clearCurrentIdentityPreference();
    await refreshStoredIdentities();
  };

  const setCurrentGuestBrowserPersistence = async (shouldPersist: boolean) => {
    if (!currentIdentity || currentIdentity.claimStatus === 'claimed') {
      return;
    }

    if (currentIdentity.storedKind === 'persistent_guest' && !shouldPersist) {
      await clearCurrentGuestDeviceSave(currentIdentity.actorPacket.header.packet_id);
    } else {
      await clearCurrentIdentityPreference();
    }

    clearSessionGuestIdentity();

    if (shouldPersist) {
      storeSessionGuestIdentity({
        actorPacket: currentIdentity.actorPacket,
        publicJwk: currentIdentity.publicJwk,
        privateJwk: currentIdentity.privateJwk ?? (() => {
          throw new Error('The current guest identity is locked.');
        })(),
        claimStatus: normalizeGuestClaimStatus(currentIdentity.claimStatus),
      });
    }

    setCurrentIdentity((currentValue) => {
      if (
        !currentValue ||
        currentValue.actorPacket.header.packet_id !==
          currentIdentity.actorPacket.header.packet_id
      ) {
        return currentValue;
      }

      return {
        ...currentValue,
        claimStatus: normalizeGuestClaimStatus(currentValue.claimStatus),
        storedKind:
          currentValue.storedKind === 'persistent_guest' && !shouldPersist
            ? null
            : currentValue.storedKind,
      };
    });
  };

  const refreshAuthSession = async () => {
    const nextSession = await fetchJsonOrThrow<NexusAuthSessionPayload>(
      '/api/nexus/auth/session'
    );

    setAuthSession(nextSession);
    await refreshSessionSummaries(nextSession.csrf_token);
    await refreshPasskeySummaries(nextSession.csrf_token);

    if (!nextSession.actor_packet) {
      if (currentIdentity?.claimStatus === 'claimed') {
        await clearCurrentIdentityPreference();
        const fallbackIdentity = await resolveGuestFallbackIdentity();

        setCurrentIdentity(fallbackIdentity);
      }

      return nextSession;
    }

    const records = await readStoredIdentityRecords();
    const matchingRecord = records.find(
      (record) => record.actor_packet_id === nextSession.actor_packet_id
    );

      if (matchingRecord) {
        const storedIdentity = toActiveIdentityState(matchingRecord);

        if (storedIdentity) {
          const sessionAlignedIdentity = adoptClaimedSessionActorPacket(
            storedIdentity,
            nextSession
          );

          setCurrentIdentity((currentValue) =>
            currentValue?.actorPacket.header.packet_id ===
              sessionAlignedIdentity.actorPacket.header.packet_id &&
            currentValue.privateJwk
              ? {
                  ...sessionAlignedIdentity,
                  privateJwk: currentValue.privateJwk,
                }
              : sessionAlignedIdentity
          );
          return nextSession;
        }
      }

      const lockedIdentity = createLockedActiveIdentityFromActorPacket(
      nextSession.actor_packet
    );

    if (lockedIdentity) {
      setCurrentIdentity((currentValue) =>
        currentValue?.actorPacket.header.packet_id === lockedIdentity.actorPacket.header.packet_id &&
        currentValue.privateJwk
          ? {
              ...lockedIdentity,
              privateJwk: currentValue.privateJwk,
            }
          : lockedIdentity
      );
    }

    return nextSession;
  };

  const adoptUnlockedClaimedIdentity = (input: {
    identity: UnlockedActiveIdentity;
    session: NexusAuthSessionPayload;
  }): UnlockedActiveIdentity => {
    const adoptedIdentity = adoptClaimedSessionActorPacket(
      input.identity,
      input.session
    );

    stashFreshUnlockedIdentity(adoptedIdentity);
    setCurrentIdentity(adoptedIdentity);

    return adoptedIdentity;
  };

  const recoverClaimedSessionInPlace = async (): Promise<boolean> => {
    if (!currentIdentity || currentIdentity.claimStatus !== 'claimed') {
      return false;
    }

    const nextSession = await refreshAuthSession();

    if (!nextSession.is_authenticated || !nextSession.actor_packet_id) {
      return false;
    }

    if (nextSession.actor_packet_id !== currentIdentity.actorPacket.header.packet_id) {
      throw new NexusAuthGateError(
        'stale_actor_packet',
        'The authenticated claimed session does not match the active local identity.',
        {
          actorRequired: true,
          failureCode: 'session_actor_mismatch',
          diagnostics: {
            client_actor_packet_id: currentIdentity.actorPacket.header.packet_id,
            server_session_actor_packet_id: nextSession.actor_packet_id,
          },
        }
      );
    }

    if (!currentIdentity.privateJwk) {
      return false;
    }

    adoptUnlockedClaimedIdentity({
      identity: {
        ...currentIdentity,
        privateJwk: currentIdentity.privateJwk,
      },
      session: nextSession,
    });

    return true;
  };

  const refreshSessionSummaries = async (csrfToken?: string | null) => {
    if (!csrfToken) {
      setSessionSummaries([]);
      setSessionSummariesError(null);
      return;
    }

    try {
      const payload = await fetchJsonOrThrow<NexusSessionListPayload>(
        '/api/nexus/auth/sessions',
        {
          headers: {
            'x-csrf-token': csrfToken,
          },
        }
      );

      setSessionSummaries(payload.sessions);
      setSessionSummariesError(null);
    } catch {
      setSessionSummariesError('Unable to load active sessions right now.');
    }
  };

  const refreshPasskeySummaries = async (csrfToken?: string | null) => {
    if (!csrfToken) {
      setPasskeySummaries([]);
      return;
    }

    try {
      const payload = await fetchJsonOrThrow<NexusPasskeyListPayload>(
        '/api/nexus/auth/passkeys',
        {
          headers: {
            'x-csrf-token': csrfToken,
          },
        }
      );

      setPasskeySummaries(payload.passkeys);
    } catch {
      setPasskeySummaries([]);
    }
  };

  const requireUnlockedCurrentIdentity = (): ActiveIdentityState & {
    privateJwk: JsonWebKey;
  } => {
    if (!currentIdentity) {
      throw new NexusAuthGateError(
        'sign_in_required',
        'There is no active identity available for this request.'
      );
    }

    const freshUnlockedIdentityHandoff = freshUnlockedIdentityRef.current;
    const currentActorPacketId = currentIdentity.actorPacket.header.packet_id;

    if (
      freshUnlockedIdentityHandoff &&
      freshUnlockedIdentityHandoff.identity.actorPacket.header.packet_id ===
        currentActorPacketId &&
      (!authSession?.actor_packet_id ||
        authSession.actor_packet_id === currentActorPacketId)
    ) {
      if (freshUnlockedIdentityHandoff.expiresAtMs < Date.now()) {
        clearFreshUnlockedIdentity();
      } else {
        return freshUnlockedIdentityHandoff.identity;
      }
    }

    if (!currentIdentity.privateJwk) {
      if (currentIdentity.claimStatus !== 'claimed') {
        throw new NexusAuthGateError(
          'sign_in_required',
          'Continue as a signed guest or sign in before Nexus writes from this device.'
        );
      }

      throw new NexusAuthGateError(
        'unlock_required',
        'Unlock this claimed identity with its passphrase before signing Nexus packets.'
      );
    }

    return {
      ...currentIdentity,
      privateJwk: currentIdentity.privateJwk,
    };
  };

  const setInitialHomeLocality = async (input: {
    identity: ActiveIdentityState & { privateJwk: JsonWebKey };
    session: NexusAuthSessionPayload;
    residenceScopePacketId?: string | null;
  }) => {
    if (!input.residenceScopePacketId) {
      return;
    }

    await runDispatchMutationForIdentity({
      identity: input.identity,
      session: input.session,
      intent: {
        kind: 'relation.residence.add',
        residence_scope_packet_id: input.residenceScopePacketId,
      },
    });
  };

  useEffect(() => {
    let isMounted = true;

    const loadIdentityShell = async () => {
      let storedRecords: StoredIdentityRecord[] = [];
      let currentPreference: string | null = null;
      let nextSession: NexusAuthSessionPayload | null = null;

      try {
        storedRecords = await readStoredIdentityRecords();
        currentPreference = await readCurrentIdentityPreference();
        const rememberedSessionPreference =
          await readRememberClaimedSessionPreference();

        if (isMounted) {
          setRememberClaimedSessionsState(rememberedSessionPreference);
        }
      } catch {
        storedRecords = [];
        currentPreference = null;
      }

      try {
        nextSession = await fetchJsonOrThrow<NexusAuthSessionPayload>(
          '/api/nexus/auth/session'
        );
      } catch {
        nextSession = null;
      }

      const passkeySupport = await isPasskeySupported().catch(() => false);

      if (!isMounted) {
        return;
      }

      setIsPasskeyPlatformSupported(passkeySupport);
      setStoredIdentityPreviews(storedRecords.map(toStoredIdentityPreview));
      setSessionSummaries([]);
      setPasskeySummaries([]);

      let resolvedIdentity: ActiveIdentityState | null = null;

      if (nextSession?.actor_packet_id) {
        const authenticatedRecord = storedRecords.find(
          (record) => record.actor_packet_id === nextSession?.actor_packet_id
        );

        if (authenticatedRecord) {
          const storedIdentity = toActiveIdentityState(authenticatedRecord);

          resolvedIdentity = storedIdentity
            ? adoptClaimedSessionActorPacket(storedIdentity, nextSession)
            : null;
        } else if (nextSession.actor_packet) {
          resolvedIdentity = createLockedActiveIdentityFromActorPacket(
            nextSession.actor_packet
          );
        }
      }

      if (!resolvedIdentity) {
        resolvedIdentity = await resolveGuestFallbackIdentity({
          storedRecords,
          preferredActorPacketId: currentPreference,
        });
      }

      setCurrentIdentity(resolvedIdentity);
      setAuthSession(nextSession);
      if (nextSession?.csrf_token) {
        void refreshSessionSummaries(nextSession.csrf_token);
        void refreshPasskeySummaries(nextSession.csrf_token);
      }

      if (isMounted) {
        setIsReady(true);
      }
    };

    void loadIdentityShell();

    return () => {
      isMounted = false;
    };
  }, []);

  const continueAsEphemeralGuest = async () => {
    const nextIdentity = await createSignedIdentityBundle({
      alias: createGuestAlias(),
      claimStatus: 'ephemeral_guest',
    });

    await clearCurrentIdentityPreference();
    clearSessionGuestIdentity();
    setCurrentIdentity({
      actorPacket: nextIdentity.actorPacket,
      publicJwk: nextIdentity.publicJwk,
      privateJwk: nextIdentity.privateJwk,
      claimStatus: 'ephemeral_guest',
      storedKind: null,
    });
  };

  const continueAsSessionGuest = async () => {
    if (currentIdentity && currentIdentity.claimStatus !== 'claimed') {
      await clearCurrentIdentityPreference();
      clearSessionGuestIdentity();
      storeSessionGuestIdentity({
        actorPacket: currentIdentity.actorPacket,
        publicJwk: currentIdentity.publicJwk,
        privateJwk: currentIdentity.privateJwk ?? (() => {
          throw new Error('The current guest identity is locked.');
        })(),
        claimStatus: normalizeGuestClaimStatus(currentIdentity.claimStatus),
      });
      setCurrentIdentity({
        ...currentIdentity,
        claimStatus: normalizeGuestClaimStatus(currentIdentity.claimStatus),
        storedKind: null,
      });
      return;
    }

    const nextIdentity = await createSignedIdentityBundle({
      alias: createGuestAlias(),
      claimStatus: 'ephemeral_guest',
    });

    await clearCurrentIdentityPreference();
    clearSessionGuestIdentity();
    storeSessionGuestIdentity({
      ...nextIdentity,
      claimStatus: 'ephemeral_guest',
    });
    setCurrentIdentity({
      actorPacket: nextIdentity.actorPacket,
      publicJwk: nextIdentity.publicJwk,
      privateJwk: nextIdentity.privateJwk,
      claimStatus: 'ephemeral_guest',
      storedKind: null,
    });
  };

  const restorePostSignOutIdentity = async () => {
    const preservedGuest = readPreservedGuestIdentity();

    if (preservedGuest) {
      clearPreservedGuestIdentity();
      await clearCurrentIdentityPreference();

      if (preservedGuest.storedKind === 'persistent_guest') {
        await writeCurrentIdentityPreference(
          preservedGuest.actorPacket.header.packet_id
        );
      } else {
        clearSessionGuestIdentity();
        storeSessionGuestIdentity({
          actorPacket: preservedGuest.actorPacket,
          publicJwk: preservedGuest.publicJwk,
          privateJwk: preservedGuest.privateJwk ?? (() => {
            throw new Error('The preserved guest identity is missing its local key material.');
          })(),
          claimStatus: preservedGuest.claimStatus,
        });
      }

      setCurrentIdentity({
        actorPacket: preservedGuest.actorPacket,
        publicJwk: preservedGuest.publicJwk,
        privateJwk: preservedGuest.privateJwk,
        claimStatus: preservedGuest.claimStatus,
        storedKind: preservedGuest.storedKind,
      });
      return;
    }

    await continueAsEphemeralGuest();
  };

  const saveGuestOnDevice = async () => {
    if (!currentIdentity || currentIdentity.claimStatus === 'claimed') {
      throw new Error('Only the current guest identity can be saved on this device.');
    }

    if (!currentIdentity.privateJwk) {
      throw new Error('The current guest identity is locked.');
    }

    const record: StoredIdentityRecord = {
      actor_packet_id: currentIdentity.actorPacket.header.packet_id,
      alias: createIdentityLabel(currentIdentity.actorPacket),
      claim_status: normalizeGuestClaimStatus(currentIdentity.claimStatus),
      stored_kind: 'persistent_guest',
      actor_packet: currentIdentity.actorPacket,
      public_jwk: currentIdentity.publicJwk,
      private_jwk: currentIdentity.privateJwk,
      encrypted_bundle_json: null,
      updated_at: new Date().toISOString(),
    };

    await writeObjectStore(IDENTITY_STORE_NAME, record);
    await writeCurrentIdentityPreference(record.actor_packet_id);
    await refreshStoredIdentities();
    clearSessionGuestIdentity();
    setCurrentIdentity({
      ...currentIdentity,
      claimStatus: normalizeGuestClaimStatus(currentIdentity.claimStatus),
      storedKind: 'persistent_guest',
    });
  };

  const unlockStoredIdentity = async (input: {
    actorPacketId: string;
    passphrase: string;
  }) => {
    const records = await readStoredIdentityRecords();
    const targetRecord = records.find(
      (record) => record.actor_packet_id === input.actorPacketId
    );

    if (!targetRecord || !targetRecord.encrypted_bundle_json) {
      throw new Error('That claimed identity is not available on this device.');
    }

    const bundle = (await decryptBundleWithPassphrase({
      passphrase: input.passphrase,
      encryptedBundle: parseEncryptedBundleJson(
        targetRecord.encrypted_bundle_json,
        'The saved identity bundle is malformed.'
      ),
    })) as {
      actor_packet: ActiveIdentityState['actorPacket'];
      public_jwk: JsonWebKey;
      private_jwk: JsonWebKey;
    };

    const unlockedIdentity = {
      actorPacket: bundle.actor_packet,
      publicJwk: bundle.public_jwk,
      privateJwk: bundle.private_jwk,
      claimStatus: 'claimed' as const,
      storedKind: 'claimed' as const,
    } satisfies UnlockedActiveIdentity;

    const session = await refreshAuthSession();

    if (!session.is_authenticated || !session.actor_packet_id) {
      throw new NexusAuthGateError(
        'sign_in_required',
        'Sign in with this claimed identity before unlocking protected writes.',
        {
          actorRequired: true,
          failureCode: 'session_missing',
        }
      );
    }

    if (session.actor_packet_id !== unlockedIdentity.actorPacket.header.packet_id) {
      throw new NexusAuthGateError(
        'stale_actor_packet',
        'The authenticated claimed session does not match this local identity bundle.',
        {
          actorRequired: true,
          failureCode: 'session_actor_mismatch',
          diagnostics: {
            client_actor_packet_id: unlockedIdentity.actorPacket.header.packet_id,
            server_session_actor_packet_id: session.actor_packet_id,
          },
        }
      );
    }

    adoptUnlockedClaimedIdentity({
      identity: unlockedIdentity,
      session,
    });
  };

  const readStoredClaimedIdentityRecord = async (
    actorPacketId: string
  ): Promise<StoredIdentityRecord> => {
    const records = await readStoredIdentityRecords();
    const targetRecord = records.find(
      (record) => record.actor_packet_id === actorPacketId
    );

    if (!targetRecord || !targetRecord.encrypted_bundle_json) {
      throw new Error('That claimed identity is not available on this device.');
    }

    return targetRecord;
  };

  const createSignedReauthToken = async (input: {
    purpose: 'sensitive' | 'interaction';
    session: NexusAuthSessionPayload;
    proofMethod?: 'signed_reauth' | 'bundle_passphrase_unlock';
    identityOverride?: ActiveIdentityState & { privateJwk: JsonWebKey };
  }): Promise<NexusReauthVerifyPayload> => {
    const unlockedIdentity = input.identityOverride ?? requireUnlockedCurrentIdentity();

    if (
      input.session.actor_packet_id &&
      unlockedIdentity.actorPacket.header.packet_id !== input.session.actor_packet_id
    ) {
      throw new NexusAuthGateError(
        'stale_actor_packet',
        'Refresh or resume the claimed identity that owns this session before approving this action.',
        {
          actorRequired: true,
          failureCode: 'session_actor_mismatch',
          diagnostics: {
            client_actor_packet_id: unlockedIdentity.actorPacket.header.packet_id,
            server_session_actor_packet_id: input.session.actor_packet_id,
          },
        }
      );
    }

    const proofMethod = input.proofMethod ?? 'signed_reauth';
    const requestActorPacket = resolveClaimedSessionActorPacket({
      actorPacket: unlockedIdentity.actorPacket,
      session: input.session,
    });

    assertClaimedActorPacketReady(requestActorPacket);
    const privateKey = await importPrivateKeyFromJwk(unlockedIdentity.privateJwk);
    const actorAssertion = await createActorAssertion({
      actorPacketId: requestActorPacket.header.packet_id,
      kid:
        requestActorPacket.body.identity?.public_key_bindings[0]?.kid ??
        (() => {
          throw new Error('The active identity is missing its key binding.');
        })(),
      privateKey,
      method: 'POST',
      path: '/api/nexus/auth/reauth/signed',
      body: {
        purpose: input.purpose,
        proof_method: proofMethod,
      },
    });

    return fetchJsonOrThrow<NexusReauthVerifyPayload>(
      '/api/nexus/auth/reauth/signed',
      {
        method: 'POST',
        headers: {
          'x-csrf-token': input.session.csrf_token ?? '',
          ...createClientIdentityHeaders(unlockedIdentity),
        },
        body: {
          purpose: input.purpose,
          proof_method: proofMethod,
          actor_packet: requestActorPacket,
          actor_assertion: actorAssertion,
        },
      }
    );
  };

  const createPasskeyReauthToken = async (input: {
    purpose: 'sensitive' | 'interaction';
    session: NexusAuthSessionPayload;
  }): Promise<NexusReauthVerifyPayload> => {
    const optionsPayload = await fetchJsonOrThrow<{
      challenge_id: string;
      purpose: 'sensitive' | 'interaction';
      public_key: NexusPasskeyRequestOptionsPayload['public_key'];
    }>('/api/nexus/auth/reauth/options', {
      method: 'POST',
      headers: {
        'x-csrf-token': input.session.csrf_token ?? '',
      },
      body: {
        purpose: input.purpose,
      },
    });
    const assertionPayload = await completePasskeyAssertion({
      challenge_id: optionsPayload.challenge_id,
      public_key: optionsPayload.public_key,
    });

    return fetchJsonOrThrow<NexusReauthVerifyPayload>(
      '/api/nexus/auth/reauth/verify',
      {
        method: 'POST',
        headers: {
          'x-csrf-token': input.session.csrf_token ?? '',
        },
        body: {
          challenge_id: assertionPayload.challenge_id,
          purpose: input.purpose,
          credential: assertionPayload.credential,
        },
      }
    );
  };

  const ensureFreshReauth = async (
    purpose: 'sensitive' | 'interaction',
    sessionOverride?: NexusAuthSessionPayload | null
  ): Promise<string> => {
    const effectiveSession = sessionOverride ?? authSession;

    if (!effectiveSession?.is_authenticated || !effectiveSession.csrf_token) {
      throw new NexusAuthGateError(
        'sign_in_required',
        'Sign in with the claimed identity before approving this action.'
      );
    }

    if (effectiveSession.has_passkey && isPasskeyPlatformSupported) {
      try {
        const verifyPayload = await createPasskeyReauthToken({
          purpose,
          session: effectiveSession,
        });

        return verifyPayload.reauth_token;
      } catch (error) {
        try {
          const verifyPayload = await createSignedReauthToken({
            purpose,
            session: effectiveSession,
          });

          return verifyPayload.reauth_token;
        } catch {
          const message =
            error instanceof Error ? error.message : 'Passkey approval failed.';

          throw new Error(
            `Passkey approval failed, and no unlocked local bundle was available for fallback: ${message}`
          );
        }
      }
    }

    const verifyPayload = await createSignedReauthToken({
      purpose,
      session: effectiveSession,
    });

    return verifyPayload.reauth_token;
  };

  const approveProtectedWriteWithPassphrase = async (passphrase: string) => {
    const session = await refreshAuthSession();

    if (!session.is_authenticated || !session.actor_packet_id || !session.csrf_token) {
      throw new NexusAuthGateError(
        'sign_in_required',
        'Sign in with the claimed identity before approving this action.'
      );
    }

    const record = await readStoredClaimedIdentityRecord(session.actor_packet_id);
    const bundle = (await decryptBundleWithPassphrase({
      passphrase,
      encryptedBundle: parseEncryptedBundleJson(
        record.encrypted_bundle_json ?? '{}',
        'The saved identity bundle is malformed.'
      ),
    })) as {
      actor_packet: ActiveIdentityState['actorPacket'];
      public_jwk: JsonWebKey;
      private_jwk: JsonWebKey;
    };
    const unlockedIdentity = {
      actorPacket: bundle.actor_packet,
      publicJwk: bundle.public_jwk,
      privateJwk: bundle.private_jwk,
      claimStatus: 'claimed' as const,
      storedKind: 'claimed' as const,
    } satisfies UnlockedActiveIdentity;

    const adoptedIdentity = adoptUnlockedClaimedIdentity({
      identity: unlockedIdentity,
      session,
    });

    const verifyPayload = await createSignedReauthToken({
      purpose: 'interaction',
      session,
      proofMethod: 'bundle_passphrase_unlock',
      identityOverride: adoptedIdentity,
    });

    stashPendingInteractionProof({
      reauthToken: verifyPayload.reauth_token,
      proofMethod: verifyPayload.proof_method,
      expiresAt: verifyPayload.expires_at,
    });
  };

  const resumeClaimedIdentitySessionWithPassphrase = async (passphrase: string) => {
    const targetActorPacketId =
      authSession?.actor_packet_id ??
      (currentIdentity?.claimStatus === 'claimed'
        ? currentIdentity.actorPacket.header.packet_id
        : null);

    if (!targetActorPacketId) {
      throw new NexusAuthGateError(
        'sign_in_required',
        'There is no claimed identity ready to resume on this device.',
        {
          actorRequired: true,
          failureCode: 'session_missing',
        }
      );
    }

    await signInStoredIdentity({
      actorPacketId: targetActorPacketId,
      passphrase,
      keepMeLoggedIn: rememberClaimedSessions,
    });
  };

  const approveProtectedWriteWithPasskey = async () => {
    const session = await refreshAuthSession();

    if (!session.is_authenticated || !session.csrf_token) {
      throw new NexusAuthGateError(
        'sign_in_required',
        'Sign in with the claimed identity before approving this action.'
      );
    }

    if (!session.has_passkey || !isPasskeyPlatformSupported) {
      throw new Error('A passkey is not available for this claimed identity.');
    }

    const verifyPayload = await createPasskeyReauthToken({
      purpose: 'interaction',
      session,
    });

    stashPendingInteractionProof({
      reauthToken: verifyPayload.reauth_token,
      proofMethod: verifyPayload.proof_method,
      expiresAt: verifyPayload.expires_at,
    });
  };

  const registerCurrentPasskey = async (
    sessionOverride?: NexusAuthSessionPayload | null
  ) => {
    if (!currentIdentity || currentIdentity.claimStatus !== 'claimed') {
      throw new Error('Only claimed identities can register passkeys.');
    }

    const effectiveSession = sessionOverride ?? authSession;

    if (!effectiveSession?.is_authenticated || !effectiveSession.csrf_token) {
      throw new Error('Sign in with the claimed identity before registering a passkey.');
    }

    if (!isPasskeyPlatformSupported) {
      throw new Error('Passkeys are unavailable in this environment.');
    }

    const headers: Record<string, string> = {
      'x-csrf-token': effectiveSession.csrf_token,
    };

    if (effectiveSession.has_passkey) {
      headers['x-reauth-token'] = await ensureFreshReauth(
        'sensitive',
        effectiveSession
      );
    }

    const optionsPayload = await fetchJsonOrThrow<NexusPasskeyRegistrationOptionsPayload>(
      '/api/nexus/auth/passkeys/register/options',
      {
        method: 'POST',
        headers,
      }
    );
    const registrationPayload = await registerPasskey(optionsPayload);
    const verifyPayload = await fetchJsonOrThrow<NexusPasskeyVerifyPayload>(
      '/api/nexus/auth/passkeys/register/verify',
      {
        method: 'POST',
        headers: {
          'x-csrf-token': effectiveSession.csrf_token,
        },
        body: registrationPayload,
      }
    );

    setAuthSession(verifyPayload.session);
    await refreshPasskeySummaries(verifyPayload.session.csrf_token);
    await refreshSessionSummaries(verifyPayload.session.csrf_token);
  };

  const signInWithPasskey = async (input: { keepMeLoggedIn: boolean }) => {
    if (!isPasskeyPlatformSupported) {
      throw new Error('Passkeys are unavailable in this environment.');
    }

    if (currentIdentity && currentIdentity.claimStatus !== 'claimed') {
      storePreservedGuestIdentity(currentIdentity);
    }

    const optionsPayload = await fetchJsonOrThrow<NexusPasskeyRequestOptionsPayload>(
      '/api/nexus/auth/passkeys/signin/options',
      {
        method: 'POST',
      }
    );
    const assertionPayload = await completePasskeyAssertion(optionsPayload);
    const verifyPayload = await fetchJsonOrThrow<{
      session: NexusAuthSessionPayload;
    }>('/api/nexus/auth/passkeys/signin/verify', {
      method: 'POST',
      body: {
        challenge_id: assertionPayload.challenge_id,
        keep_me_logged_in: input.keepMeLoggedIn,
        credential: assertionPayload.credential,
      },
    });

    setAuthSession(verifyPayload.session);
    if (verifyPayload.session.actor_packet_id) {
      await writeCurrentIdentityPreference(verifyPayload.session.actor_packet_id);
    }
    await refreshSessionSummaries(verifyPayload.session.csrf_token);
    await refreshPasskeySummaries(verifyPayload.session.csrf_token);

    if (verifyPayload.session.actor_packet) {
      const records = await readStoredIdentityRecords();
      const matchingRecord = records.find(
        (record) => record.actor_packet_id === verifyPayload.session.actor_packet_id
      );

      if (matchingRecord) {
        const storedIdentity = toActiveIdentityState(matchingRecord);

        if (storedIdentity) {
          setCurrentIdentity(storedIdentity);
          return;
        }
      }

      const lockedIdentity = createLockedActiveIdentityFromActorPacket(
        verifyPayload.session.actor_packet
      );

      if (lockedIdentity) {
        setCurrentIdentity(lockedIdentity);
      }
    }
  };

  const createClaimedIdentity = async (input: {
    alias: string;
    passphrase: string;
    locationDisclosure?: IdentityLocationDisclosure | null;
    residenceScopePacketId?: string | null;
    keepMeLoggedIn: boolean;
  }) => {
    if (currentIdentity && currentIdentity.claimStatus !== 'claimed') {
      storePreservedGuestIdentity(currentIdentity);
    }

    const nextIdentity = await createSignedIdentityBundle({
      alias: input.alias,
      claimStatus: 'claimed',
      locationDisclosure: input.locationDisclosure ?? null,
    });
    const encryptedBundle = await encryptIdentityBundle({
      passphrase: input.passphrase,
      bundle: {
        actor_packet: nextIdentity.actorPacket,
        public_jwk: nextIdentity.publicJwk,
        private_jwk: nextIdentity.privateJwk,
      },
    });

    await fetchJsonOrThrow('/api/nexus/auth/create', {
      method: 'POST',
      body: {
        actor_packet: nextIdentity.actorPacket,
      },
    });

    const record: StoredIdentityRecord = {
      actor_packet_id: nextIdentity.actorPacket.header.packet_id,
      alias: input.alias,
      claim_status: 'claimed',
      stored_kind: 'claimed',
      actor_packet: nextIdentity.actorPacket,
      public_jwk: nextIdentity.publicJwk,
      private_jwk: null,
      encrypted_bundle_json: JSON.stringify(encryptedBundle),
      updated_at: new Date().toISOString(),
    };

    await writeObjectStore(IDENTITY_STORE_NAME, record);
    await writeCurrentIdentityPreference(record.actor_packet_id);
    await refreshStoredIdentities();
    clearSessionGuestIdentity();
    setCurrentIdentity({
      actorPacket: record.actor_packet,
      publicJwk: record.public_jwk,
      privateJwk: nextIdentity.privateJwk,
      claimStatus: 'claimed',
      storedKind: 'claimed',
    });

    const createdSession = await signInStoredIdentity({
      actorPacketId: record.actor_packet_id,
      passphrase: input.passphrase,
      keepMeLoggedIn: input.keepMeLoggedIn,
    });

    await setInitialHomeLocality({
      identity: {
        actorPacket: record.actor_packet,
        publicJwk: record.public_jwk,
        privateJwk: nextIdentity.privateJwk,
        claimStatus: 'claimed',
        storedKind: 'claimed',
      },
      session: createdSession,
      residenceScopePacketId: input.residenceScopePacketId ?? null,
    });

    setAuthSession(createdSession);
  };

  const claimCurrentGuest = async (input: {
    alias: string;
    passphrase: string;
    locationDisclosure?: IdentityLocationDisclosure | null;
    residenceScopePacketId?: string | null;
    keepMeLoggedIn: boolean;
  }) => {
    if (!currentIdentity) {
      throw new Error('There is no current guest identity to claim.');
    }

    const currentPrivateJwk =
      currentIdentity.privateJwk ?? (() => {
        throw new Error('Unlock this guest identity before claiming it.');
      })();
    const privateKey = await importPrivateKeyFromJwk(currentPrivateJwk);
    const currentBinding = currentIdentity.actorPacket.body.identity?.public_key_bindings[0];

    if (!currentBinding) {
      throw new Error('The current guest identity is missing its active key binding.');
    }

    const claimedPacket = createClaimedIdentityRevision({
      actorPacket: currentIdentity.actorPacket,
      alias: input.alias,
      locationDisclosure: input.locationDisclosure ?? null,
    });
    const signedClaimedPacket = await signPacketWithIdentity({
      packet: claimedPacket,
      signerPacketId: claimedPacket.header.packet_id,
      kid: currentBinding.kid,
      privateKey,
    });
    const encryptedBundle = await encryptIdentityBundle({
      passphrase: input.passphrase,
      bundle: {
        actor_packet: signedClaimedPacket,
        public_jwk: currentIdentity.publicJwk,
        private_jwk: currentPrivateJwk,
      },
    });

    await fetchJsonOrThrow('/api/nexus/auth/claim', {
      method: 'POST',
      body: {
        actor_packet: signedClaimedPacket,
        previous_actor_packet: currentIdentity.actorPacket,
      },
    });

    const record: StoredIdentityRecord = {
      actor_packet_id: signedClaimedPacket.header.packet_id,
      alias: input.alias,
      claim_status: 'claimed',
      stored_kind: 'claimed',
      actor_packet: signedClaimedPacket,
      public_jwk: currentIdentity.publicJwk,
      private_jwk: null,
      encrypted_bundle_json: JSON.stringify(encryptedBundle),
      updated_at: new Date().toISOString(),
    };

    await writeObjectStore(IDENTITY_STORE_NAME, record);
    await writeCurrentIdentityPreference(record.actor_packet_id);
    await refreshStoredIdentities();
    clearSessionGuestIdentity();
    setCurrentIdentity({
      actorPacket: record.actor_packet,
      publicJwk: record.public_jwk,
      privateJwk: currentPrivateJwk,
      claimStatus: 'claimed',
      storedKind: 'claimed',
    });

    const createdSession = await signInStoredIdentity({
      actorPacketId: record.actor_packet_id,
      passphrase: input.passphrase,
      keepMeLoggedIn: input.keepMeLoggedIn,
    });

    await setInitialHomeLocality({
      identity: {
        actorPacket: record.actor_packet,
        publicJwk: record.public_jwk,
        privateJwk: currentPrivateJwk,
        claimStatus: 'claimed',
        storedKind: 'claimed',
      },
      session: createdSession,
      residenceScopePacketId: input.residenceScopePacketId ?? null,
    });

    setAuthSession(createdSession);
  };

  const signInStoredIdentity = async (input: {
    actorPacketId: string;
    passphrase: string;
    keepMeLoggedIn: boolean;
  }) => {
    if (currentIdentity && currentIdentity.claimStatus !== 'claimed') {
      storePreservedGuestIdentity(currentIdentity);
    }

    const records = await readStoredIdentityRecords();
    const targetRecord = records.find(
      (record) => record.actor_packet_id === input.actorPacketId
    );

    if (!targetRecord || !targetRecord.encrypted_bundle_json) {
      throw new Error('That claimed identity is not available on this device.');
    }

    const bundle = (await decryptBundleWithPassphrase({
      passphrase: input.passphrase,
      encryptedBundle: parseEncryptedBundleJson(
        targetRecord.encrypted_bundle_json,
        'The saved identity bundle is malformed.'
      ),
    })) as {
      actor_packet: ActiveIdentityState['actorPacket'];
      public_jwk: JsonWebKey;
      private_jwk: JsonWebKey;
    };
    const privateKey = await importPrivateKeyFromJwk(bundle.private_jwk);
    const challenge = await fetchJsonOrThrow<{
      challenge_id: string;
      nonce: string;
      expires_at: string;
    }>('/api/nexus/auth/challenge', {
      method: 'POST',
      body: {
        actor_packet_id: targetRecord.actor_packet_id,
      },
    });
    const actorAssertion = await createActorAssertion({
      actorPacketId: targetRecord.actor_packet_id,
      kid:
        bundle.actor_packet.body.identity?.public_key_bindings[0]?.kid ??
        (() => {
          throw new Error('Claimed identity is missing its active key binding.');
        })(),
      privateKey,
      method: 'POST',
      path: '/api/nexus/auth/verify',
      body: {
        challenge_id: challenge.challenge_id,
        nonce: challenge.nonce,
        keep_me_logged_in: input.keepMeLoggedIn,
      },
    });
    const verifyResult = await fetchJsonOrThrow<{
      session: NexusAuthSessionPayload;
    }>('/api/nexus/auth/verify', {
      method: 'POST',
      body: {
        challenge_id: challenge.challenge_id,
        nonce: challenge.nonce,
        keep_me_logged_in: input.keepMeLoggedIn,
        device_label:
          typeof navigator !== 'undefined' ? navigator.userAgent : 'Current device',
        actor_assertion: actorAssertion,
      },
    });

    await writeCurrentIdentityPreference(targetRecord.actor_packet_id);
    setCurrentIdentity(
      adoptClaimedSessionActorPacket(
        {
          actorPacket: bundle.actor_packet,
          publicJwk: bundle.public_jwk,
          privateJwk: bundle.private_jwk,
          claimStatus: 'claimed',
          storedKind: 'claimed',
        },
        verifyResult.session
      )
    );
    setAuthSession(verifyResult.session);
    await refreshSessionSummaries(verifyResult.session.csrf_token);
    await refreshPasskeySummaries(verifyResult.session.csrf_token);

    return verifyResult.session;
  };

  const migrateStoredIdentity = async (input: {
    actorPacketId: string;
    passphrase: string;
    keepMeLoggedIn: boolean;
  }) => {
    if (currentIdentity && currentIdentity.claimStatus !== 'claimed') {
      storePreservedGuestIdentity(currentIdentity);
    }

    const records = await readStoredIdentityRecords();
    const targetRecord = records.find(
      (record) => record.actor_packet_id === input.actorPacketId
    );

    if (!targetRecord || !targetRecord.encrypted_bundle_json) {
      throw new Error('That legacy identity is not available on this device.');
    }

    if (classifyStoredIdentityForMigration(targetRecord) !== 'migration_required') {
      throw new Error('That identity does not require migration.');
    }

    const decryptedBundle = (await decryptBundleWithPassphrase({
      passphrase: input.passphrase,
      encryptedBundle: parseEncryptedBundleJson(
        targetRecord.encrypted_bundle_json,
        'The saved identity bundle is malformed.'
      ),
    })) as {
      actor_packet: ActiveIdentityState['actorPacket'];
      public_jwk: JsonWebKey;
      private_jwk: JsonWebKey;
    };
    const migratedActorPacket = await buildSignedMigratedIdentityPacket({
      legacyActorPacket: targetRecord.actor_packet,
      bundle: {
        actorPacket: decryptedBundle.actor_packet,
        publicJwk: decryptedBundle.public_jwk,
        privateJwk: decryptedBundle.private_jwk,
      },
    });
    const privateKey = await importPrivateKeyFromJwk(decryptedBundle.private_jwk);
    const activeKeyBinding =
      migratedActorPacket.body.identity?.public_key_bindings[0] ??
      (() => {
        throw new Error('Migrated identity is missing its active key binding.');
      })();
    const migrationBody = {
      migrated_actor_packet: migratedActorPacket,
      legacy_actor_packet_id: targetRecord.actor_packet_id,
    };
    const actorAssertion = await createActorAssertion({
      actorPacketId: migratedActorPacket.header.packet_id,
      kid: activeKeyBinding.kid,
      privateKey,
      method: 'POST',
      path: '/api/nexus/auth/migrate',
      body: migrationBody,
    });
    const encryptedBundle = await encryptIdentityBundle({
      passphrase: input.passphrase,
      bundle: {
        actor_packet: migratedActorPacket,
        public_jwk: decryptedBundle.public_jwk,
        private_jwk: decryptedBundle.private_jwk,
      },
    });

    await fetchJsonOrThrow('/api/nexus/auth/migrate', {
      method: 'POST',
      body: {
        ...migrationBody,
        actor_assertion: actorAssertion,
      },
    });

    const record: StoredIdentityRecord = {
      actor_packet_id: migratedActorPacket.header.packet_id,
      alias: createIdentityLabel(migratedActorPacket),
      claim_status: 'claimed',
      stored_kind: 'claimed',
      actor_packet: migratedActorPacket,
      public_jwk: decryptedBundle.public_jwk,
      private_jwk: null,
      encrypted_bundle_json: JSON.stringify(encryptedBundle),
      updated_at: new Date().toISOString(),
    };

    await writeObjectStore(IDENTITY_STORE_NAME, record);
    await writeCurrentIdentityPreference(record.actor_packet_id);
    await refreshStoredIdentities();

    return signInStoredIdentity({
      actorPacketId: record.actor_packet_id,
      passphrase: input.passphrase,
      keepMeLoggedIn: input.keepMeLoggedIn,
    });
  };

  const restoreIdentityFromBundle = async (input: {
    encryptedBundleJson: string;
    passphrase: string;
  }) => {
    if (currentIdentity && currentIdentity.claimStatus !== 'claimed') {
      storePreservedGuestIdentity(currentIdentity);
    }

    const bundle = (await decryptBundleWithPassphrase({
      passphrase: input.passphrase,
      encryptedBundle: parseEncryptedBundleJson(
        input.encryptedBundleJson,
        'The exported identity bundle is malformed.'
      ),
    })) as {
      actor_packet: ActiveIdentityState['actorPacket'];
      public_jwk: JsonWebKey;
      private_jwk: JsonWebKey;
    };

    await fetchJsonOrThrow('/api/nexus/auth/restore', {
      method: 'POST',
      body: {
        actor_packet: bundle.actor_packet,
      },
    });

    const record: StoredIdentityRecord = {
      actor_packet_id: bundle.actor_packet.header.packet_id,
      alias: createIdentityLabel(bundle.actor_packet),
      claim_status: 'claimed',
      stored_kind: 'claimed',
      actor_packet: bundle.actor_packet,
      public_jwk: bundle.public_jwk,
      private_jwk: null,
      encrypted_bundle_json: input.encryptedBundleJson,
      updated_at: new Date().toISOString(),
    };

    await writeObjectStore(IDENTITY_STORE_NAME, record);
    await writeCurrentIdentityPreference(record.actor_packet_id);
    await refreshStoredIdentities();
    setCurrentIdentity({
      actorPacket: bundle.actor_packet,
      publicJwk: bundle.public_jwk,
      privateJwk: bundle.private_jwk,
      claimStatus: 'claimed',
      storedKind: 'claimed',
    });

    const restoredSession = await signInStoredIdentity({
      actorPacketId: record.actor_packet_id,
      passphrase: input.passphrase,
      keepMeLoggedIn: false,
    }).catch(() => {
      return null;
    });

    if (restoredSession) {
      setAuthSession(restoredSession);
    }
  };

  const exportCurrentIdentityBundle = async (passphrase: string) => {
    if (!currentIdentity) {
      throw new Error('There is no active identity to export.');
    }

    if (!currentIdentity.privateJwk) {
      throw new Error('Unlock this claimed identity before exporting its encrypted bundle.');
    }

    if (currentIdentity.claimStatus === 'claimed') {
      await ensureFreshReauth('sensitive');
    }

    const encryptedBundle = await encryptIdentityBundle({
      passphrase,
      bundle: {
        actor_packet: currentIdentity.actorPacket,
        public_jwk: currentIdentity.publicJwk,
        private_jwk: currentIdentity.privateJwk,
      },
    });

    return JSON.stringify(encryptedBundle, null, 2);
  };

  const revokePasskey = async (credentialId: string) => {
    if (!authSession?.csrf_token) {
      throw new Error('Sign in before changing passkeys.');
    }

    const reauthToken = await ensureFreshReauth('sensitive');

    const payload = await fetchJsonOrThrow<NexusPasskeyListPayload>(
      '/api/nexus/auth/passkeys',
      {
        method: 'DELETE',
        headers: {
          'x-csrf-token': authSession.csrf_token,
        },
        body: {
          credential_id: credentialId,
          reauth_token: reauthToken,
        },
      }
    );

    setPasskeySummaries(payload.passkeys);
    await refreshAuthSession();
  };

  const revokeSession = async (sessionId: string) => {
    if (!authSession?.csrf_token) {
      throw new Error('Sign in before changing sessions.');
    }

    const reauthToken = await ensureFreshReauth('sensitive');
    const payload = await fetchJsonOrThrow<NexusSessionListPayload>(
      '/api/nexus/auth/sessions',
      {
        method: 'DELETE',
        headers: {
          'x-csrf-token': authSession.csrf_token,
        },
        body: {
          target_session_id: sessionId,
          revoke_others: false,
          reauth_token: reauthToken,
        },
      }
    );

    setSessionSummaries(payload.sessions);
  };

  const revokeOtherSessions = async () => {
    if (!authSession?.csrf_token) {
      throw new Error('Sign in before changing sessions.');
    }

    const reauthToken = await ensureFreshReauth('sensitive');
    const payload = await fetchJsonOrThrow<NexusSessionListPayload>(
      '/api/nexus/auth/sessions',
      {
        method: 'DELETE',
        headers: {
          'x-csrf-token': authSession.csrf_token,
        },
        body: {
          revoke_others: true,
          reauth_token: reauthToken,
        },
      }
    );

    setSessionSummaries(payload.sessions);
  };

  const setSecurityMode = async (securityMode: NexusSecurityMode) => {
    await runDispatchMutation({
      intent: {
        kind: 'actor.write_policy.update',
        security_mode: securityMode,
      },
    });
  };

  const consumePendingInteractionProof = (input: {
    acceptedMethods: MutationProofMethod[];
  }): string | null => {
    const pendingInteractionProof = pendingInteractionProofRef.current;

    if (!pendingInteractionProof) {
      return null;
    }

    if (new Date(pendingInteractionProof.expiresAt).getTime() < Date.now()) {
      clearPendingInteractionProof();
      return null;
    }

    if (!input.acceptedMethods.includes(pendingInteractionProof.proofMethod)) {
      return null;
    }

    clearPendingInteractionProof();
    return pendingInteractionProof.reauthToken;
  };

  const {
    createVerifiedRequestBody,
    runDispatchMutation,
    runDispatchMutationForIdentity,
    signCurrentIdentityPacket,
  } = createIdentityShellDispatchAdapter({
    requireUnlockedCurrentIdentity,
    refreshAuthSession,
    ensureFreshReauth,
    consumePendingInteractionProof,
  });

  useEffect(() => {
    const freshUnlockedIdentityHandoff = freshUnlockedIdentityRef.current;

    if (!freshUnlockedIdentityHandoff) {
      return;
    }

    if (!currentIdentity) {
      clearFreshUnlockedIdentity();
      return;
    }

    const actorPacketId = currentIdentity.actorPacket.header.packet_id;

    if (
      freshUnlockedIdentityHandoff.identity.actorPacket.header.packet_id !==
        actorPacketId ||
      freshUnlockedIdentityHandoff.expiresAtMs < Date.now()
    ) {
      clearFreshUnlockedIdentity();
    }
  }, [currentIdentity]);

  useEffect(() => {
    const freshUnlockedIdentityHandoff = freshUnlockedIdentityRef.current;

    if (!freshUnlockedIdentityHandoff) {
      return;
    }

    if (
      !authSession?.actor_packet_id ||
      authSession.actor_packet_id !==
        freshUnlockedIdentityHandoff.identity.actorPacket.header.packet_id ||
      freshUnlockedIdentityHandoff.expiresAtMs < Date.now()
    ) {
      clearFreshUnlockedIdentity();
    }
  }, [authSession?.actor_packet_id]);

  const signOut = async () => {
    await fetchJsonOrThrow('/api/nexus/auth/session', {
      method: 'DELETE',
      headers: {
        'x-csrf-token': authSession?.csrf_token ?? '',
      },
    });
    clearPendingInteractionProof();
    clearFreshUnlockedIdentity();
    setAuthSession({
      is_authenticated: false,
      session_id: null,
      actor_packet_id: null,
      actor_packet: null,
      session_expires_at: null,
      refresh_expires_at: null,
      csrf_token: null,
      auth_method: null,
      security_mode: null,
      has_passkey: false,
      requires_passkey_upgrade: false,
      reauth_expires_at: null,
    });
    setSessionSummaries([]);
    setSessionSummariesError(null);
    setPasskeySummaries([]);
    await restorePostSignOutIdentity();
  };

  const setRememberClaimedSessions = async (nextRememberClaimedSessions: boolean) => {
    await writeRememberClaimedSessionPreference(nextRememberClaimedSessions);
    setRememberClaimedSessionsState(nextRememberClaimedSessions);

    if (currentIdentity?.claimStatus !== 'claimed') {
      await setCurrentGuestBrowserPersistence(nextRememberClaimedSessions);
    }
  };

  const currentLabel = useMemo(() => {
    if (!currentIdentity) {
      return 'Loading identity';
    }

    return createIdentityLabel(currentIdentity.actorPacket);
  }, [currentIdentity]);

  const currentMode = currentIdentity?.claimStatus ?? null;
  const currentActorPacketId = currentIdentity?.actorPacket.header.packet_id ?? null;
  const currentStorageMode = useMemo<NexusStorageMode | null>(() => {
    if (!currentIdentity) {
      return null;
    }

    const actorPacketId = currentIdentity.actorPacket.header.packet_id;
    const isStoredOnDevice = storedIdentityPreviews.some(
      (identity) => identity.actor_packet_id === actorPacketId
    );

    if (isStoredOnDevice || currentIdentity.storedKind === 'persistent_guest') {
      return 'saved_on_device';
    }

    if (currentIdentity.claimStatus === 'ephemeral_guest') {
      const sessionGuest = readSessionGuestIdentity();

      if (
        sessionGuest?.actorPacket.header.packet_id ===
        currentIdentity.actorPacket.header.packet_id
      ) {
        return 'session_only';
      }
    }

    return 'none';
  }, [currentIdentity, storedIdentityPreviews]);
  const isCurrentIdentityUnlocked = currentIdentity?.privateJwk !== null;
  const isUsingSessionCookies = Boolean(authSession?.session_expires_at);
  const securityMode = authSession?.security_mode ?? null;
  const passkeyCount = passkeySummaries.length;
  const hasAvailablePasskeyApproval =
    Boolean(authSession?.has_passkey) && isPasskeyPlatformSupported;
  const requiresPasskeyUpgrade = authSession?.requires_passkey_upgrade ?? false;

  return (
    <IdentityShellContext.Provider
      value={{
        isReady,
        currentIdentity,
        currentLabel,
        currentActorPacketId,
        currentMode,
        currentStorageMode,
        isCurrentIdentityUnlocked,
        isAuthenticated: authSession?.is_authenticated ?? false,
        isUsingSessionCookies,
        isPasskeySupported: isPasskeyPlatformSupported,
        rememberClaimedSessions,
        authSession,
        storedIdentityPreviews,
        securityMode,
        passkeyCount,
        requiresPasskeyUpgrade,
        sessionSummaries,
        sessionSummariesError,
        passkeySummaries,
        hasAvailablePasskeyApproval,
        unlockStoredIdentity,
        approveProtectedWriteWithPassphrase,
        approveProtectedWriteWithPasskey,
        continueAsEphemeralGuest,
        continueAsSessionGuest,
        saveGuestOnDevice,
        createClaimedIdentity,
        claimCurrentGuest,
        signInStoredIdentity,
        migrateStoredIdentity,
        signInWithPasskey,
        registerCurrentPasskey,
        restoreIdentityFromBundle,
        exportCurrentIdentityBundle,
        setSecurityMode,
        runDispatchMutation,
        revokePasskey,
        revokeSession,
        revokeOtherSessions,
        signOut,
        createVerifiedRequestBody,
        signCurrentIdentityPacket,
        refreshAuthSession,
        recoverClaimedSessionInPlace,
        resumeClaimedIdentitySessionWithPassphrase,
        setRememberClaimedSessions,
      }}
    >
      {children}
    </IdentityShellContext.Provider>
  );
}

export function useIdentityShell(): IdentityShellContextValue {
  const context = useContext(IdentityShellContext);

  if (!context) {
    throw new Error('useIdentityShell must be used inside IdentityShellProvider.');
  }

  return context;
}
