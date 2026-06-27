/**
 * File: identity-migration.ts
 * Description: Temporary legacy identity migration helpers for current-schema Nexus identity packets.
 */

import { inspectPacketEnvelope, type PacketEnvelopeByType } from '@core/schema/packet-schema';
import { canonicalizeJson } from '@core/crypto/canonical-json';
import {
  createIdentityKeyBinding,
  importPrivateKeyFromJwk,
  signPacketWithIdentity,
} from '@runtime/nexus/identity-crypto';
import {
  createIdentityLabel,
  createMigratedPersonIdentityPacket,
  type IdentityBundleRecord,
  type IdentityLocationDisclosure,
  type StoredIdentityRecord,
} from '@runtime/nexus/identity-shell';
import {
  LEGACY_IDENTITY_MIGRATION_POLICY,
  type LegacyIdentityMigrationPolicy,
} from '@runtime/nexus/identity-migration-policy';

export {
  LEGACY_IDENTITY_MIGRATION_POLICY,
  type LegacyIdentityMigrationPolicy,
} from '@runtime/nexus/identity-migration-policy';

export type StoredIdentityMigrationReadiness =
  | 'current'
  | 'migration_required'
  | 'locked_candidate'
  | 'unsupported_legacy'
  | 'corrupt_or_unreadable';

export interface StoredIdentityMigrationCandidate {
  legacy_actor_packet_id: string;
  tentative_actor_packet_id: string;
  alias: string;
  public_jwk: JsonWebKey;
  migration_status: 'needs_unlock' | 'ready_to_sign';
  packet_id_policy: 'reused_legacy_id' | 'reminted_id';
}

function hasEmbeddedSignature(packet: PacketEnvelopeByType['Element']): boolean {
  return packet.header.integrity.embedded_signatures.length > 0;
}

function isSafeIdentityPacketId(packetId: string): boolean {
  return /^nexus:element\/[A-Za-z0-9][A-Za-z0-9._~/-]*$/.test(packetId);
}

function getPublicJwkFromPacket(
  packet: PacketEnvelopeByType['Element']
): JsonWebKey | null {
  const publicJwk = packet.body.identity?.public_key_bindings[0]?.public_jwk;

  return publicJwk && typeof publicJwk === 'object'
    ? (publicJwk as JsonWebKey)
    : null;
}

function inspectStoredPersonIdentityPacket(packet: unknown): {
  packet: PacketEnvelopeByType['Element'];
  writable_as_is: boolean;
} | null {
  try {
    const compatibilityRead = inspectPacketEnvelope(packet);
    const adaptedPacket = compatibilityRead.adapted_packet;

    if (
      adaptedPacket.header.type !== 'Element' ||
      adaptedPacket.body.subtype !== 'person' ||
      !adaptedPacket.body.identity
    ) {
      return null;
    }

    return {
      packet: adaptedPacket as PacketEnvelopeByType['Element'],
      writable_as_is:
        compatibilityRead.status.writable_as_is &&
        !compatibilityRead.status.interpreted_as_legacy_profile,
    };
  } catch {
    return null;
  }
}

export function classifyStoredIdentityForMigration(
  record: StoredIdentityRecord
): StoredIdentityMigrationReadiness {
  try {
    if (record.claim_status !== 'claimed' || record.stored_kind !== 'claimed') {
      return 'unsupported_legacy';
    }

    if (!record.actor_packet?.header?.packet_id || !record.actor_packet.body.identity) {
      return 'corrupt_or_unreadable';
    }

    if (!record.encrypted_bundle_json) {
      return 'unsupported_legacy';
    }

    const inspectedPersonPacket = inspectStoredPersonIdentityPacket(
      record.actor_packet
    );

    if (!inspectedPersonPacket) {
      return 'corrupt_or_unreadable';
    }

    const adaptedPersonPacket = inspectedPersonPacket.packet;

    if (
      inspectedPersonPacket.writable_as_is &&
      hasEmbeddedSignature(adaptedPersonPacket) &&
      adaptedPersonPacket.body.identity.claim_status === 'claimed' &&
      adaptedPersonPacket.body.identity.public_key_bindings.length > 0
    ) {
      return 'current';
    }

    if (!getPublicJwkFromPacket(adaptedPersonPacket) && !record.public_jwk) {
      return 'corrupt_or_unreadable';
    }

    return 'migration_required';
  } catch {
    return 'corrupt_or_unreadable';
  }
}

export function toStoredIdentityMigrationCandidate(
  record: StoredIdentityRecord
): StoredIdentityMigrationCandidate | null {
  const readiness = classifyStoredIdentityForMigration(record);

  if (readiness !== 'migration_required') {
    return null;
  }

  const legacyActorPacketId = record.actor_packet.header.packet_id;
  const canReusePacketId = isSafeIdentityPacketId(legacyActorPacketId);

  return {
    legacy_actor_packet_id: legacyActorPacketId,
    tentative_actor_packet_id: canReusePacketId
      ? legacyActorPacketId
      : `nexus:element/migrated-${Date.now().toString(36)}`,
    alias: createIdentityLabel(record.actor_packet),
    public_jwk: getPublicJwkFromPacket(record.actor_packet) ?? record.public_jwk,
    migration_status: 'needs_unlock',
    packet_id_policy: canReusePacketId ? 'reused_legacy_id' : 'reminted_id',
  };
}

export async function buildSignedMigratedIdentityPacket(input: {
  legacyActorPacket: PacketEnvelopeByType['Element'];
  bundle: IdentityBundleRecord;
  tentativePacketId?: string;
  createdAt?: string;
  migrationPolicy?: LegacyIdentityMigrationPolicy;
}): Promise<PacketEnvelopeByType['Element']> {
  const migrationPolicy = input.migrationPolicy ?? LEGACY_IDENTITY_MIGRATION_POLICY;

  if (!migrationPolicy.enabled) {
    throw new Error('Legacy identity migration is not enabled.');
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const legacyPublicJwk = getPublicJwkFromPacket(input.legacyActorPacket);

  if (
    legacyPublicJwk &&
    canonicalizeJson(legacyPublicJwk) !== canonicalizeJson(input.bundle.publicJwk)
  ) {
    throw new Error('Legacy identity public key does not match the unlocked bundle.');
  }

  const publicKeyBinding = await createIdentityKeyBinding({
    publicJwk: input.bundle.publicJwk,
    addedAt: createdAt,
  });
  const legacyPacketId = input.legacyActorPacket.header.packet_id;
  const canReusePacketId = isSafeIdentityPacketId(legacyPacketId);
  const tentativePacketId =
    input.tentativePacketId ??
    (canReusePacketId
      ? legacyPacketId
      : `nexus:element/migrated-${Date.now().toString(36)}`);
  const locationDisclosure =
    input.legacyActorPacket.body.identity?.location_disclosure &&
    typeof input.legacyActorPacket.body.identity.location_disclosure.scope === 'string' &&
    typeof input.legacyActorPacket.body.identity.location_disclosure.value === 'string'
      ? (input.legacyActorPacket.body.identity
          .location_disclosure as IdentityLocationDisclosure)
      : null;
  const migratedPacket = createMigratedPersonIdentityPacket({
    alias: createIdentityLabel(input.legacyActorPacket),
    legacyActorPacketId: legacyPacketId,
    publicKeyBinding,
    tentativePacketId,
    createdAt,
    locationDisclosure,
    migrationVersion: migrationPolicy.migration_version,
    packetIdPolicy:
      tentativePacketId === legacyPacketId ? 'reused_legacy_id' : 'reminted_id',
  });

  return signPacketWithIdentity({
    packet: migratedPacket,
    signerPacketId: migratedPacket.header.packet_id,
    kid: publicKeyBinding.kid,
    privateKey: await importPrivateKeyFromJwk(input.bundle.privateJwk),
    signedAt: createdAt,
  });
}
