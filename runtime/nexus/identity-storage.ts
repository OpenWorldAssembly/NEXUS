/**
 * File: identity-storage.ts
 * Description: Provides browser persistence helpers and local identity record mapping for the Nexus identity shell.
 */

import type {
  IdentityBundleRecord,
  NexusIdentityMode,
  StoredIdentityKind,
  StoredIdentityRecord,
} from '@runtime/nexus/identity-shell';
import { type PacketEnvelopeByType } from '@core/schema/packet-schema';
import type {
  NexusLocalIdentityPreview,
} from '@runtime/nexus/nexus-api-types';
import {
  classifyStoredIdentityForMigration,
  type StoredIdentityMigrationReadiness,
} from '@runtime/nexus/identity-migration';

const SESSION_GUEST_IDENTITY_STORAGE_KEY = 'owa-nexus-session-guest-identity';
const PRESERVED_GUEST_IDENTITY_STORAGE_KEY = 'owa-nexus-preserved-guest-identity';
const LEGACY_EPHEMERAL_IDENTITY_STORAGE_KEY = 'owa-nexus-ephemeral-identity';
const IDENTITY_DB_NAME = 'owa-nexus-identity';
const IDENTITY_DB_VERSION = 1;
const IDENTITY_STORE_NAME = 'identities';
const PREFERENCE_STORE_NAME = 'preferences';
const CURRENT_IDENTITY_PREFERENCE_KEY = 'current_identity_id';
const REMEMBER_CLAIMED_SESSION_PREFERENCE_KEY = 'remember_claimed_session';

export type IdentityPreferencesRecord = {
  key: string;
  value: string;
};

export type ActiveIdentityState = {
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

export type NexusStorageMode = 'none' | 'session_only' | 'saved_on_device';

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
    return Promise.reject(new Error('IndexedDB is unavailable in this environment.'));
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

export function writeObjectStore<TValue extends object>(
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
          reject(transaction.error ?? new Error(`Unable to write ${storeName}.`));
      })
  );
}

export async function deleteObjectStoreValue(
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

export function toStoredIdentityPreview(
  record: StoredIdentityRecord
): NexusLocalIdentityPreview {
  return {
    actor_packet_id: record.actor_packet_id,
    alias: record.alias,
    claim_status: record.claim_status,
    stored_kind: record.stored_kind,
    updated_at: record.updated_at,
    migration_readiness: classifyStoredIdentityForMigration(record),
  };
}

export type StoredIdentityReadiness = StoredIdentityMigrationReadiness;

export async function readStoredIdentityRecordsWithMigrationStatus(): Promise<
  (StoredIdentityRecord & { migration_readiness: StoredIdentityReadiness })[]
> {
  const records = await readStoredIdentityRecords();

  return records.map((record) => ({
    ...record,
    migration_readiness: classifyStoredIdentityForMigration(record),
  }));
}

export function toActiveIdentityState(
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

export function createLockedActiveIdentityFromActorPacket(
  actorPacket: PacketEnvelopeByType['Element']
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

export async function readStoredIdentityRecords(): Promise<StoredIdentityRecord[]> {
  const records =
    (await readObjectStore<StoredIdentityRecord>(IDENTITY_STORE_NAME)) ?? [];

  return Array.isArray(records) ? records : [];
}

export async function readCurrentIdentityPreference(): Promise<string | null> {
  const record = (await readObjectStore<IdentityPreferencesRecord>(
    PREFERENCE_STORE_NAME,
    CURRENT_IDENTITY_PREFERENCE_KEY
  )) as IdentityPreferencesRecord | null;

  return record?.value ?? null;
}

export async function readRememberClaimedSessionPreference(): Promise<boolean> {
  const record = (await readObjectStore<IdentityPreferencesRecord>(
    PREFERENCE_STORE_NAME,
    REMEMBER_CLAIMED_SESSION_PREFERENCE_KEY
  )) as IdentityPreferencesRecord | null;

  return record?.value === 'false' ? false : true;
}

export async function writeCurrentIdentityPreference(actorPacketId: string): Promise<void> {
  await writeObjectStore<IdentityPreferencesRecord>(PREFERENCE_STORE_NAME, {
    key: CURRENT_IDENTITY_PREFERENCE_KEY,
    value: actorPacketId,
  });
}

export async function clearCurrentIdentityPreference(): Promise<void> {
  await deleteObjectStoreValue(PREFERENCE_STORE_NAME, CURRENT_IDENTITY_PREFERENCE_KEY);
}

export async function writeRememberClaimedSessionPreference(
  rememberClaimedSessions: boolean
): Promise<void> {
  await writeObjectStore<IdentityPreferencesRecord>(PREFERENCE_STORE_NAME, {
    key: REMEMBER_CLAIMED_SESSION_PREFERENCE_KEY,
    value: rememberClaimedSessions ? 'true' : 'false',
  });
}

export function storeSessionGuestIdentity(
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

export function readSessionGuestIdentity():
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

export function clearSessionGuestIdentity(): void {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return;
  }

  sessionStorage.removeItem(SESSION_GUEST_IDENTITY_STORAGE_KEY);
  sessionStorage.removeItem(LEGACY_EPHEMERAL_IDENTITY_STORAGE_KEY);
}

export function storePreservedGuestIdentity(
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

  sessionStorage.setItem(PRESERVED_GUEST_IDENTITY_STORAGE_KEY, JSON.stringify(payload));
}

export function readPreservedGuestIdentity(): ActiveIdentityState | null {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return null;
  }

  const rawValue = sessionStorage.getItem(PRESERVED_GUEST_IDENTITY_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const value = JSON.parse(rawValue) as PreservedGuestIdentityRecord;

    return {
      actorPacket: value.actor_packet,
      publicJwk: value.public_jwk,
      privateJwk: value.private_jwk,
      claimStatus: value.claim_status,
      storedKind: value.stored_kind,
    };
  } catch {
    return null;
  }
}

export function clearPreservedGuestIdentity(): void {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return;
  }

  sessionStorage.removeItem(PRESERVED_GUEST_IDENTITY_STORAGE_KEY);
}

export function normalizeGuestClaimStatus(
  claimStatus: NexusIdentityMode
): 'ephemeral_guest' {
  return claimStatus === 'claimed' ? 'ephemeral_guest' : 'ephemeral_guest';
}
