/**
 * File: identity-shell.ts
 * Description: Defines Nexus identity-shell types and packet builders for guest and claimed person elements.
 */

import {
  createInitialRevisionId,
  createPersonPacket,
  type ElementPacketInput,
} from '@/domain/packets/builders';
import type { PacketEnvelopeByType } from '@/domain/schema/packet-schema';

export type NexusIdentityMode =
  | 'ephemeral_guest'
  | 'persistent_guest'
  | 'claimed';

export type StoredIdentityKind = 'persistent_guest' | 'claimed';

export interface IdentityLocationDisclosure {
  scope: string;
  value: string;
}

export interface IdentityBundleRecord {
  actorPacket: PacketEnvelopeByType['Element'];
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
}

export interface StoredIdentityRecord {
  actor_packet_id: string;
  alias: string;
  claim_status: NexusIdentityMode;
  stored_kind: StoredIdentityKind;
  actor_packet: PacketEnvelopeByType['Element'];
  public_jwk: JsonWebKey;
  private_jwk: JsonWebKey | null;
  encrypted_bundle_json: string | null;
  updated_at: string;
}

function slugifyAlias(alias: string): string {
  return alias
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function createPacketId(alias: string): string {
  const slug = slugifyAlias(alias) || 'person';

  return `nexus:element/${slug}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createGuestAlias(): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `Guest ${suffix}`;
}

export function createIdentityLabel(
  actorPacket: PacketEnvelopeByType['Element']
): string {
  return actorPacket.body.identity?.alias ?? actorPacket.body.name;
}

function createNextRevisionId(packetId: string, currentRevisionId?: string): string {
  const match = currentRevisionId?.match(/@r(\d+)$/);
  const revisionNumber = match ? Number.parseInt(match[1], 10) + 1 : 1;

  return createInitialRevisionId(packetId, revisionNumber);
}

export function createPersonIdentityPacket(input: {
  alias: string;
  claimStatus: NexusIdentityMode;
  publicKeyBinding: NonNullable<
    NonNullable<ElementPacketInput['identity']>['public_key_bindings']
  >[number];
  createdAt?: string;
  packetId?: string;
  locationDisclosure?: IdentityLocationDisclosure | null;
}): PacketEnvelopeByType['Element'] {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const packetId = input.packetId ?? createPacketId(input.alias);

  return createPersonPacket({
    packet_id: packetId,
    created_at: createdAt,
    revision_id: createInitialRevisionId(packetId),
    name: input.alias,
    subtype: input.claimStatus === 'claimed' ? 'claimed_identity' : 'guest_identity',
    summary:
      input.claimStatus === 'claimed'
        ? 'A claimed OWA Nexus person identity.'
        : 'A guest OWA Nexus person identity.',
    locality_label: input.locationDisclosure?.value ?? null,
    identity: {
      alias: input.alias,
      claim_status: input.claimStatus,
      location_disclosure: input.locationDisclosure ?? null,
      public_key_bindings: [input.publicKeyBinding],
    },
    tags: ['person', input.claimStatus],
  });
}

export function createClaimedIdentityRevision(input: {
  actorPacket: PacketEnvelopeByType['Element'];
  alias: string;
  locationDisclosure?: IdentityLocationDisclosure | null;
}): PacketEnvelopeByType['Element'] {
  return createIdentityStatusRevision({
    actorPacket: input.actorPacket,
    alias: input.alias,
    claimStatus: 'claimed',
    locationDisclosure: input.locationDisclosure ?? null,
  });
}

export function createIdentityStatusRevision(input: {
  actorPacket: PacketEnvelopeByType['Element'];
  alias: string;
  claimStatus: NexusIdentityMode;
  locationDisclosure?: IdentityLocationDisclosure | null;
}): PacketEnvelopeByType['Element'] {
  const currentIdentity = input.actorPacket.body.identity;

  if (!currentIdentity) {
    throw new Error('Cannot revise a person packet that has no identity metadata.');
  }

  return createPersonPacket({
    packet_id: input.actorPacket.header.packet_id,
    revision_id: createNextRevisionId(
      input.actorPacket.header.packet_id,
      input.actorPacket.header.revision_id
    ),
    created_at: new Date().toISOString(),
    parent_revision_refs: [
      {
        packet_id: input.actorPacket.header.packet_id,
        revision_id: input.actorPacket.header.revision_id,
      },
    ],
    name: input.alias,
    subtype:
      input.claimStatus === 'claimed' ? 'claimed_identity' : 'guest_identity',
    summary:
      input.claimStatus === 'claimed'
        ? 'A claimed OWA Nexus person identity.'
        : 'A guest OWA Nexus person identity.',
    locality_label: input.locationDisclosure?.value ?? null,
    identity: {
      alias: input.alias,
      claim_status: input.claimStatus,
      location_disclosure: input.locationDisclosure ?? null,
      public_key_bindings: currentIdentity.public_key_bindings,
    },
    tags: ['person', input.claimStatus],
  });
}
