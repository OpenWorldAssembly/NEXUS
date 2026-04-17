/**
 * File: identity-shell.ts
 * Description: Defines Nexus identity-shell types and re-exports portable person packet helpers.
 */

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';

export {
  createClaimedIdentityRevision,
  createGuestAlias,
  createIdentityLabel,
  createIdentityStatusRevision,
  createPersonIdentityPacket,
  type IdentityLocationDisclosure,
  type NexusIdentityMode,
} from '@core/packets/identity';

export type StoredIdentityKind = 'persistent_guest' | 'claimed';

export interface IdentityBundleRecord {
  actorPacket: PacketEnvelopeByType['Element'];
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
}

export interface StoredIdentityRecord {
  actor_packet_id: string;
  alias: string;
  claim_status: import('@core/packets/identity').NexusIdentityMode;
  stored_kind: StoredIdentityKind;
  actor_packet: PacketEnvelopeByType['Element'];
  public_jwk: JsonWebKey;
  private_jwk: JsonWebKey | null;
  encrypted_bundle_json: string | null;
  updated_at: string;
}
