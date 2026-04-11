/**
 * File: identity-shell-context.tsx
 * Description: Provides client-side Nexus identity shell state for guest, persistent, and claimed cryptographic actors.
 */

import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

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
} from '@/lib/nexus/identity-crypto';
import type { PacketEnvelope } from '@/domain/schema/packet-schema';
import type {
  NexusAuthSessionPayload,
  NexusLocalIdentityPreview,
  NexusPasskeyListPayload,
  NexusPasskeyRegistrationOptionsPayload,
  NexusPasskeyRequestOptionsPayload,
  NexusPasskeyVerifyPayload,
  NexusSecurityMode,
  NexusSecurityPreferencesPayload,
  NexusSessionListPayload,
} from '@/lib/nexus/nexus-api-types';
import {
  createClaimedIdentityRevision,
  createGuestAlias,
  createIdentityLabel,
  createPersonIdentityPacket,
  type IdentityBundleRecord,
  type IdentityLocationDisclosure,
  type NexusIdentityMode,
  type StoredIdentityKind,
  type StoredIdentityRecord,
} from '@/lib/nexus/identity-shell';
import {
  completePasskeyAssertion,
  isPasskeySupported,
  registerPasskey,
} from '@/lib/nexus/webauthn';

const SESSION_GUEST_IDENTITY_STORAGE_KEY = 'owa-nexus-session-guest-identity';
const PRESERVED_GUEST_IDENTITY_STORAGE_KEY = 'owa-nexus-preserved-guest-identity';
const LEGACY_EPHEMERAL_IDENTITY_STORAGE_KEY = 'owa-nexus-ephemeral-identity';
const IDENTITY_DB_NAME = 'owa-nexus-identity';
const IDENTITY_DB_VERSION = 1;
const IDENTITY_STORE_NAME = 'identities';
const PREFERENCE_STORE_NAME = 'preferences';
const CURRENT_IDENTITY_PREFERENCE_KEY = 'current_identity_id';
const REMEMBER_CLAIMED_SESSION_PREFERENCE_KEY = 'remember_claimed_session';

type IdentityPreferencesRecord = {
  key: string;
  value: string;
};

type ActiveIdentityState = {
  actorPacket: StoredIdentityRecord['actor_packet'];
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey | null;
  claimStatus: NexusIdentityMode;
  storedKind: StoredIdentityKind | null;
};

type PreservedGuestIdentityRecord = {
  actor_packet: ActiveIdentityState['actorPacket'];
  public_jwk: JsonWebKey;
  private_jwk: JsonWebKey | null;
  claim_status: NexusIdentityMode;
  stored_kind: StoredIdentityKind | null;
};

type NexusStorageMode = 'none' | 'session_only' | 'saved_on_device';

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
  passkeySummaries: NexusPasskeyListPayload['passkeys'];
  unlockStoredIdentity: (input: {
    actorPacketId: string;
    passphrase: string;
  }) => Promise<void>;
  continueAsEphemeralGuest: () => Promise<void>;
  continueAsSessionGuest: () => Promise<void>;
  saveGuestOnDevice: () => Promise<void>;
  createClaimedIdentity: (input: {
    alias: string;
    passphrase: string;
    locationDisclosure?: IdentityLocationDisclosure | null;
    keepMeLoggedIn: boolean;
  }) => Promise<void>;
  claimCurrentGuest: (input: {
    alias: string;
    passphrase: string;
    locationDisclosure?: IdentityLocationDisclosure | null;
    keepMeLoggedIn: boolean;
  }) => Promise<void>;
  signInStoredIdentity: (input: {
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
    }
  ) => Promise<TPayload & Record<string, unknown>>;
  signCurrentIdentityPacket: <TPacket extends PacketEnvelope>(
    packet: TPacket
  ) => Promise<TPacket>;
  refreshAuthSession: () => Promise<NexusAuthSessionPayload>;
  setRememberClaimedSessions: (rememberClaimedSessions: boolean) => Promise<void>;
};

const IdentityShellContext = createContext<IdentityShellContextValue | null>(null);

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function openIdentityDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new Error('IndexedDB is unavailable in this environment.')
    );
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDENTITY_DB_NAME, IDENTITY_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(IDENTITY_STORE_NAME)) {
        database.createObjectStore(IDENTITY_STORE_NAME, {
          keyPath: 'actor_packet_id',
        });
      }

      if (!database.objectStoreNames.contains(PREFERENCE_STORE_NAME)) {
        database.createObjectStore(PREFERENCE_STORE_NAME, {
          keyPath: 'key',
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Unable to open the identity database.'));
  });
}

function readObjectStore<TValue>(
  storeName: string,
  key?: IDBValidKey
): Promise<TValue | TValue[] | null> {
  return openIdentityDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = key === undefined ? store.getAll() : store.get(key);

        request.onsuccess = () => {
          resolve((request.result as TValue | TValue[] | undefined) ?? null);
        };
        request.onerror = () =>
          reject(request.error ?? new Error(`Unable to read ${storeName}.`));
        transaction.oncomplete = () => database.close();
      })
  );
}

function writeObjectStore<TValue extends object>(
  storeName: string,
  value: TValue
): Promise<void> {
  return openIdentityDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        store.put(value);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () =>
          reject(
            transaction.error ?? new Error(`Unable to write ${storeName}.`)
          );
      })
  );
}

async function deleteObjectStoreValue(
  storeName: string,
  key: IDBValidKey
): Promise<void> {
  const database = await openIdentityDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    store.delete(key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () =>
      reject(transaction.error ?? new Error(`Unable to delete ${storeName}.`));
  });
}

function toStoredIdentityPreview(
  record: StoredIdentityRecord
): NexusLocalIdentityPreview {
  return {
    actor_packet_id: record.actor_packet_id,
    alias: record.alias,
    claim_status: record.claim_status,
    stored_kind: record.stored_kind,
    updated_at: record.updated_at,
  };
}

function toActiveIdentityState(
  record: StoredIdentityRecord
): ActiveIdentityState | null {
  if (record.private_jwk) {
    return {
      actorPacket: record.actor_packet,
      publicJwk: record.public_jwk,
      privateJwk: record.private_jwk,
      claimStatus: record.claim_status,
      storedKind: record.stored_kind,
    };
  }

  if (record.stored_kind === 'claimed' && record.encrypted_bundle_json) {
    return {
      actorPacket: record.actor_packet,
      publicJwk: record.public_jwk,
      privateJwk: null,
      claimStatus: record.claim_status,
      storedKind: record.stored_kind,
    };
  }

  return null;
}

function createLockedActiveIdentityFromActorPacket(
  actorPacket: ActiveIdentityState['actorPacket']
): ActiveIdentityState | null {
  const publicJwk = actorPacket.body.identity?.public_key_bindings[0]
    ?.public_jwk as JsonWebKey | undefined;
  const claimStatus = actorPacket.body.identity?.claim_status;

  if (!publicJwk || !claimStatus) {
    return null;
  }

  return {
    actorPacket,
    publicJwk,
    privateJwk: null,
    claimStatus,
    storedKind: claimStatus === 'claimed' ? 'claimed' : null,
  };
}

async function readStoredIdentityRecords(): Promise<StoredIdentityRecord[]> {
  const records =
    (await readObjectStore<StoredIdentityRecord>(IDENTITY_STORE_NAME)) ?? [];

  return Array.isArray(records) ? records : [];
}

async function readCurrentIdentityPreference(): Promise<string | null> {
  const record = (await readObjectStore<IdentityPreferencesRecord>(
    PREFERENCE_STORE_NAME,
    CURRENT_IDENTITY_PREFERENCE_KEY
  )) as IdentityPreferencesRecord | null;

  return record?.value ?? null;
}

async function readRememberClaimedSessionPreference(): Promise<boolean> {
  const record = (await readObjectStore<IdentityPreferencesRecord>(
    PREFERENCE_STORE_NAME,
    REMEMBER_CLAIMED_SESSION_PREFERENCE_KEY
  )) as IdentityPreferencesRecord | null;

  return record?.value === 'false' ? false : true;
}

async function writeCurrentIdentityPreference(actorPacketId: string): Promise<void> {
  await writeObjectStore<IdentityPreferencesRecord>(PREFERENCE_STORE_NAME, {
    key: CURRENT_IDENTITY_PREFERENCE_KEY,
    value: actorPacketId,
  });
}

async function clearCurrentIdentityPreference(): Promise<void> {
  await deleteObjectStoreValue(PREFERENCE_STORE_NAME, CURRENT_IDENTITY_PREFERENCE_KEY);
}

async function writeRememberClaimedSessionPreference(
  rememberClaimedSessions: boolean
): Promise<void> {
  await writeObjectStore<IdentityPreferencesRecord>(PREFERENCE_STORE_NAME, {
    key: REMEMBER_CLAIMED_SESSION_PREFERENCE_KEY,
    value: rememberClaimedSessions ? 'true' : 'false',
  });
}

function storeSessionGuestIdentity(
  bundle: IdentityBundleRecord & { claimStatus: NexusIdentityMode }
): void {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return;
  }

  sessionStorage.setItem(
    SESSION_GUEST_IDENTITY_STORAGE_KEY,
    JSON.stringify({
      actor_packet: bundle.actorPacket,
      public_jwk: bundle.publicJwk,
      private_jwk: bundle.privateJwk,
      claim_status: bundle.claimStatus,
    })
  );
  sessionStorage.removeItem(LEGACY_EPHEMERAL_IDENTITY_STORAGE_KEY);
}

function readSessionGuestIdentity():
  | (IdentityBundleRecord & { claimStatus: NexusIdentityMode })
  | null {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return null;
  }

  const rawValue =
    sessionStorage.getItem(SESSION_GUEST_IDENTITY_STORAGE_KEY) ??
    sessionStorage.getItem(LEGACY_EPHEMERAL_IDENTITY_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as {
      actor_packet: ActiveIdentityState['actorPacket'];
      public_jwk: JsonWebKey;
      private_jwk: JsonWebKey;
      claim_status: NexusIdentityMode;
    };

    return {
      actorPacket: parsedValue.actor_packet,
      publicJwk: parsedValue.public_jwk,
      privateJwk: parsedValue.private_jwk,
      claimStatus: parsedValue.claim_status,
    };
  } catch {
    return null;
  }
}

function clearSessionGuestIdentity(): void {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return;
  }

  sessionStorage.removeItem(SESSION_GUEST_IDENTITY_STORAGE_KEY);
  sessionStorage.removeItem(LEGACY_EPHEMERAL_IDENTITY_STORAGE_KEY);
}

function storePreservedGuestIdentity(
  identity: ActiveIdentityState
): void {
  if (identity.claimStatus === 'claimed') {
    return;
  }

  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return;
  }

  const payload: PreservedGuestIdentityRecord = {
    actor_packet: identity.actorPacket,
    public_jwk: identity.publicJwk,
    private_jwk: identity.privateJwk,
    claim_status: identity.claimStatus,
    stored_kind: identity.storedKind,
  };

  sessionStorage.setItem(
    PRESERVED_GUEST_IDENTITY_STORAGE_KEY,
    JSON.stringify(payload)
  );
}

function readPreservedGuestIdentity(): PreservedGuestIdentityRecord | null {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return null;
  }

  const rawValue = sessionStorage.getItem(PRESERVED_GUEST_IDENTITY_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PreservedGuestIdentityRecord;
  } catch {
    return null;
  }
}

function clearPreservedGuestIdentity(): void {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return;
  }

  sessionStorage.removeItem(PRESERVED_GUEST_IDENTITY_STORAGE_KEY);
}

function normalizeGuestClaimStatus(
  claimStatus: NexusIdentityMode
): 'ephemeral_guest' {
  return claimStatus === 'claimed' ? 'ephemeral_guest' : 'ephemeral_guest';
}

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
      | { error?: string }
      | null;

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
  const [passkeySummaries, setPasskeySummaries] = useState<
    NexusPasskeyListPayload['passkeys']
  >([]);

  const refreshStoredIdentities = async () => {
    const records = await readStoredIdentityRecords();

    setStoredIdentityPreviews(records.map(toStoredIdentityPreview));
  };

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
        setCurrentIdentity((currentValue) =>
          currentValue?.actorPacket.header.packet_id === storedIdentity.actorPacket.header.packet_id &&
          currentValue.privateJwk
            ? {
                ...storedIdentity,
                privateJwk: currentValue.privateJwk,
              }
            : storedIdentity
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

  const refreshSessionSummaries = async (csrfToken?: string | null) => {
    if (!csrfToken) {
      setSessionSummaries([]);
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
    } catch {
      setSessionSummaries([]);
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
      throw new Error('There is no active identity available for this request.');
    }

    if (!currentIdentity.privateJwk) {
      throw new Error('Unlock this claimed identity with its passphrase before signing Nexus packets.');
    }

    return {
      ...currentIdentity,
      privateJwk: currentIdentity.privateJwk,
    };
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
          resolvedIdentity = toActiveIdentityState(authenticatedRecord);
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

      if (preservedGuest.stored_kind === 'persistent_guest') {
        await writeCurrentIdentityPreference(
          preservedGuest.actor_packet.header.packet_id
        );
      } else {
        clearSessionGuestIdentity();
        storeSessionGuestIdentity({
          actorPacket: preservedGuest.actor_packet,
          publicJwk: preservedGuest.public_jwk,
          privateJwk: preservedGuest.private_jwk ?? (() => {
            throw new Error('The preserved guest identity is missing its local key material.');
          })(),
          claimStatus: preservedGuest.claim_status,
        });
      }

      setCurrentIdentity({
        actorPacket: preservedGuest.actor_packet,
        publicJwk: preservedGuest.public_jwk,
        privateJwk: preservedGuest.private_jwk,
        claimStatus: preservedGuest.claim_status,
        storedKind: preservedGuest.stored_kind,
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

    const bundle = await decryptIdentityBundle<{
      actor_packet: ActiveIdentityState['actorPacket'];
      public_jwk: JsonWebKey;
      private_jwk: JsonWebKey;
    }>({
      passphrase: input.passphrase,
      encryptedBundle: JSON.parse(
        targetRecord.encrypted_bundle_json
      ) as EncryptedIdentityBundle,
    });

    setCurrentIdentity({
      actorPacket: bundle.actor_packet,
      publicJwk: bundle.public_jwk,
      privateJwk: bundle.private_jwk,
      claimStatus: 'claimed',
      storedKind: 'claimed',
    });
  };

  const ensureFreshReauth = async (
    purpose: 'sensitive' | 'interaction',
    sessionOverride?: NexusAuthSessionPayload | null
  ): Promise<string> => {
    const effectiveSession = sessionOverride ?? authSession;

    if (!effectiveSession?.is_authenticated || !effectiveSession.csrf_token) {
      throw new Error('Sign in with the claimed identity before approving this action.');
    }

    const csrfToken = effectiveSession.csrf_token;

    const performSignedReauth = async () => {
      const unlockedIdentity = requireUnlockedCurrentIdentity();

      if (
        effectiveSession.actor_packet_id &&
        unlockedIdentity.actorPacket.header.packet_id !==
          effectiveSession.actor_packet_id
      ) {
        throw new Error(
          'Unlock the claimed identity that owns this session before approving this action.'
        );
      }

      const privateKey = await importPrivateKeyFromJwk(unlockedIdentity.privateJwk);
      const actorAssertion = await createActorAssertion({
        actorPacketId: unlockedIdentity.actorPacket.header.packet_id,
        kid:
          unlockedIdentity.actorPacket.body.identity?.public_key_bindings[0]?.kid ??
          (() => {
            throw new Error('The active identity is missing its key binding.');
          })(),
        privateKey,
        method: 'POST',
        path: '/api/nexus/auth/reauth/signed',
        body: {
          purpose,
        },
      });
      const verifyPayload = await fetchJsonOrThrow<{
        reauth_token: string;
        expires_at: string;
      }>('/api/nexus/auth/reauth/signed', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken,
        },
        body: {
          purpose,
          actor_packet: unlockedIdentity.actorPacket,
          actor_assertion: actorAssertion,
        },
      });

      return verifyPayload.reauth_token;
    };

    if (effectiveSession.has_passkey && isPasskeyPlatformSupported) {
      try {
        const optionsPayload = await fetchJsonOrThrow<{
          challenge_id: string;
          purpose: 'sensitive' | 'interaction';
          public_key: NexusPasskeyRequestOptionsPayload['public_key'];
        }>('/api/nexus/auth/reauth/options', {
          method: 'POST',
          headers: {
            'x-csrf-token': csrfToken,
          },
          body: {
            purpose,
          },
        });
        const assertionPayload = await completePasskeyAssertion({
          challenge_id: optionsPayload.challenge_id,
          public_key: optionsPayload.public_key,
        });
        const verifyPayload = await fetchJsonOrThrow<{
          reauth_token: string;
          expires_at: string;
        }>('/api/nexus/auth/reauth/verify', {
          method: 'POST',
          headers: {
            'x-csrf-token': effectiveSession.csrf_token,
          },
          body: {
            challenge_id: assertionPayload.challenge_id,
            purpose,
            credential: assertionPayload.credential,
          },
        });

        return verifyPayload.reauth_token;
      } catch (error) {
        try {
          return await performSignedReauth();
        } catch {
          const message =
            error instanceof Error ? error.message : 'Passkey approval failed.';

          throw new Error(
            `Passkey approval failed, and no unlocked local bundle was available for fallback: ${message}`
          );
        }
      }
    }

    return performSignedReauth();
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

    setAuthSession(createdSession);
  };

  const claimCurrentGuest = async (input: {
    alias: string;
    passphrase: string;
    locationDisclosure?: IdentityLocationDisclosure | null;
    keepMeLoggedIn: boolean;
  }) => {
    if (!currentIdentity) {
      throw new Error('There is no current guest identity to claim.');
    }

    const privateKey = await importPrivateKeyFromJwk(
      currentIdentity.privateJwk ?? (() => {
        throw new Error('Unlock this guest identity before claiming it.');
      })()
    );
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
        private_jwk: currentIdentity.privateJwk ?? (() => {
          throw new Error('Unlock this guest identity before claiming it.');
        })(),
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
      privateJwk: currentIdentity.privateJwk,
      claimStatus: 'claimed',
      storedKind: 'claimed',
    });

    const createdSession = await signInStoredIdentity({
      actorPacketId: record.actor_packet_id,
      passphrase: input.passphrase,
      keepMeLoggedIn: input.keepMeLoggedIn,
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

    const bundle = await decryptIdentityBundle<{
      actor_packet: ActiveIdentityState['actorPacket'];
      public_jwk: JsonWebKey;
      private_jwk: JsonWebKey;
    }>({
      passphrase: input.passphrase,
      encryptedBundle: JSON.parse(
        targetRecord.encrypted_bundle_json
      ) as EncryptedIdentityBundle,
    });
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
    setCurrentIdentity({
      actorPacket: bundle.actor_packet,
      publicJwk: bundle.public_jwk,
      privateJwk: bundle.private_jwk,
      claimStatus: 'claimed',
      storedKind: 'claimed',
    });
    setAuthSession(verifyResult.session);
    await refreshSessionSummaries(verifyResult.session.csrf_token);
    await refreshPasskeySummaries(verifyResult.session.csrf_token);

    return verifyResult.session;
  };

  const restoreIdentityFromBundle = async (input: {
    encryptedBundleJson: string;
    passphrase: string;
  }) => {
    if (currentIdentity && currentIdentity.claimStatus !== 'claimed') {
      storePreservedGuestIdentity(currentIdentity);
    }

    const bundle = await decryptIdentityBundle<{
      actor_packet: ActiveIdentityState['actorPacket'];
      public_jwk: JsonWebKey;
      private_jwk: JsonWebKey;
    }>({
      passphrase: input.passphrase,
      encryptedBundle: JSON.parse(input.encryptedBundleJson) as EncryptedIdentityBundle,
    });

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
    if (!authSession?.csrf_token) {
      throw new Error('Sign in before changing security preferences.');
    }

    const reauthToken = await ensureFreshReauth('sensitive');
    await fetchJsonOrThrow<NexusSecurityPreferencesPayload>(
      '/api/nexus/auth/security',
      {
        method: 'PUT',
        headers: {
          'x-csrf-token': authSession.csrf_token,
        },
        body: {
          security_mode: securityMode,
          reauth_token: reauthToken,
        },
      }
    );
    await refreshAuthSession();
  };

  const signOut = async () => {
    await fetchJsonOrThrow('/api/nexus/auth/session', {
      method: 'DELETE',
      headers: {
        'x-csrf-token': authSession?.csrf_token ?? '',
      },
    });
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

  const createVerifiedRequestBody = async <
    TPayload extends Record<string, unknown>,
  >(
    path: string,
    method: 'POST' | 'PUT',
    payload: TPayload,
    options?: {
      writeRisk?: 'standard' | 'high_impact';
    }
  ) => {
    const unlockedIdentity = requireUnlockedCurrentIdentity();
    let csrfToken: string | null = null;
    let reauthToken: string | null = null;

    if (unlockedIdentity.claimStatus === 'claimed') {
      const currentSession = await refreshAuthSession();

      if (
        !currentSession.is_authenticated ||
        currentSession.actor_packet_id !== unlockedIdentity.actorPacket.header.packet_id
      ) {
        throw new Error('Sign in with this claimed identity before writing Nexus packets.');
      }

      csrfToken = currentSession.csrf_token;

      if (!csrfToken) {
        throw new Error('Refresh the claimed session before writing Nexus packets.');
      }

      const writeRisk = options?.writeRisk ?? 'standard';

      if (
        currentSession.security_mode === 'every_write' ||
        (currentSession.security_mode === 'guarded' &&
          writeRisk === 'high_impact')
      ) {
        reauthToken = await ensureFreshReauth('interaction', currentSession);
      }
    }

    const privateKey = await importPrivateKeyFromJwk(unlockedIdentity.privateJwk);
    const actorAssertion = await createActorAssertion({
      actorPacketId: unlockedIdentity.actorPacket.header.packet_id,
      kid:
        unlockedIdentity.actorPacket.body.identity?.public_key_bindings[0]?.kid ??
        (() => {
          throw new Error('The active identity is missing its key binding.');
        })(),
      privateKey,
      method,
      path,
      body: {
        actor_packet: unlockedIdentity.actorPacket,
        csrf_token: csrfToken,
        reauth_token: reauthToken,
        ...payload,
      },
    });

    return {
      actor_packet: unlockedIdentity.actorPacket,
      actor_assertion: actorAssertion,
      csrf_token: csrfToken,
      reauth_token: reauthToken,
      ...payload,
    };
  };

  const signCurrentIdentityPacket = async <TPacket extends PacketEnvelope>(
    packet: TPacket
  ): Promise<TPacket> => {
    const unlockedIdentity = requireUnlockedCurrentIdentity();
    const privateKey = await importPrivateKeyFromJwk(unlockedIdentity.privateJwk);

    return signPacketWithIdentity({
      packet,
      signerPacketId: unlockedIdentity.actorPacket.header.packet_id,
      kid:
        unlockedIdentity.actorPacket.body.identity?.public_key_bindings[0]?.kid ??
        (() => {
          throw new Error('The active identity is missing its key binding.');
        })(),
      privateKey,
    });
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
        passkeySummaries,
        unlockStoredIdentity,
        continueAsEphemeralGuest,
        continueAsSessionGuest,
        saveGuestOnDevice,
        createClaimedIdentity,
        claimCurrentGuest,
        signInStoredIdentity,
        signInWithPasskey,
        registerCurrentPasskey,
        restoreIdentityFromBundle,
        exportCurrentIdentityBundle,
        setSecurityMode,
        revokePasskey,
        revokeSession,
        revokeOtherSessions,
        signOut,
        createVerifiedRequestBody,
        signCurrentIdentityPacket,
        refreshAuthSession,
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
