/**
 * File: identity.ts
 * Description: Portable person-identity packet helpers used by Nexus and OWA identity flows.
 */

import {
  createInitialRevisionId,
  createPersonPacket,
  createElementPacket,
  type ElementPacketInput,
} from '@core/packets/builders';
import type {
  PacketEnvelopeByType,
  PacketRef,
} from '@core/schema/packet-schema';

export type NexusIdentityMode =
  | 'ephemeral_guest'
  | 'persistent_guest'
  | 'claimed';

export interface IdentityLocationDisclosure {
  scope: string;
  value: string;
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

export function createNextRevisionId(
  packetId: string,
  currentRevisionId?: string
): string {
  const match = currentRevisionId?.match(/@r(\d+)$/);
  const revisionNumber = match ? Number.parseInt(match[1], 10) + 1 : 1;

  return createInitialRevisionId(packetId, revisionNumber);
}

/**
 * Inputs: none.
 * Output: a short-lived human-readable guest alias.
 */
export function createGuestAlias(): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `Guest ${suffix}`;
}

/**
 * Inputs: a person element packet.
 * Output: the display label used for that identity.
 */
export function createIdentityLabel(
  actorPacket: PacketEnvelopeByType['Element']
): string {
  return actorPacket.body.identity?.alias ?? actorPacket.body.name;
}

/**
 * Inputs: identity packet creation details.
 * Output: a canonical person element packet for a guest or claimed identity.
 */
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

/**
 * Inputs: the current guest identity packet and the new claimed metadata.
 * Output: the next claimed revision for that person element.
 */
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

/**
 * Inputs: the current identity packet and next identity status.
 * Output: a new person-element revision with the same key bindings.
 */
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

/**
 * Inputs: an element packet and the next claimed role refs for that same actor.
 * Output: a new element revision that preserves existing identity and locality data.
 */
export function createElementRoleClaimsRevision(input: {
  actorPacket: PacketEnvelopeByType['Element'];
  claimedRoleRefs: PacketRef[];
}): PacketEnvelopeByType['Element'] {
  const actorPacket = input.actorPacket;

  return createElementPacket({
    packet_id: actorPacket.header.packet_id,
    revision_id: createNextRevisionId(
      actorPacket.header.packet_id,
      actorPacket.header.revision_id
    ),
    created_at: new Date().toISOString(),
    parent_revision_refs: [
      {
        packet_id: actorPacket.header.packet_id,
        revision_id: actorPacket.header.revision_id,
      },
    ],
    authority_scope_ref: actorPacket.header.authority_scope_ref,
    applicable_scope_refs: actorPacket.header.applicable_scope_refs,
    edges: actorPacket.header.edges,
    created_by: actorPacket.header.provenance.created_by,
    submitted_by: actorPacket.header.provenance.submitted_by,
    recorded_at: actorPacket.header.provenance.recorded_at,
    adapter: actorPacket.header.provenance.adapter,
    app_version: actorPacket.header.producer.app_version,
    visibility: actorPacket.header.moderation.visibility,
    moderation_state: actorPacket.header.moderation.moderation_state,
    policy_refs: actorPacket.header.moderation.policy_refs,
    content_warning_ids: actorPacket.header.moderation.content_warning_ids,
    external_refs: actorPacket.header.external_refs,
    metadata_tags: actorPacket.header.metadata.tags,
    metadata_language: actorPacket.header.metadata.language,
    metadata_summary: actorPacket.header.metadata.summary,
    name: actorPacket.body.name,
    subtype: actorPacket.body.subtype,
    summary: actorPacket.body.summary ?? null,
    locality_label: actorPacket.body.locality_label ?? null,
    locality: actorPacket.body.locality ?? null,
    identity: actorPacket.body.identity,
    tags: actorPacket.body.tags,
    claimed_role_refs: input.claimedRoleRefs,
  });
}

/**
 * Inputs: an element packet and the next moderation policy refs for that same actor.
 * Output: a new element revision that preserves existing identity, locality, and role state.
 */
export function createElementPolicyRefsRevision(input: {
  actorPacket: PacketEnvelopeByType['Element'];
  policyRefs: PacketRef[];
}): PacketEnvelopeByType['Element'] {
  const actorPacket = input.actorPacket;

  return createElementPacket({
    packet_id: actorPacket.header.packet_id,
    revision_id: createNextRevisionId(
      actorPacket.header.packet_id,
      actorPacket.header.revision_id
    ),
    created_at: new Date().toISOString(),
    parent_revision_refs: [
      {
        packet_id: actorPacket.header.packet_id,
        revision_id: actorPacket.header.revision_id,
      },
    ],
    authority_scope_ref: actorPacket.header.authority_scope_ref,
    applicable_scope_refs: actorPacket.header.applicable_scope_refs,
    edges: actorPacket.header.edges,
    created_by: actorPacket.header.provenance.created_by,
    submitted_by: actorPacket.header.provenance.submitted_by,
    recorded_at: actorPacket.header.provenance.recorded_at,
    adapter: actorPacket.header.provenance.adapter,
    app_version: actorPacket.header.producer.app_version,
    visibility: actorPacket.header.moderation.visibility,
    moderation_state: actorPacket.header.moderation.moderation_state,
    policy_refs: input.policyRefs,
    content_warning_ids: actorPacket.header.moderation.content_warning_ids,
    external_refs: actorPacket.header.external_refs,
    metadata_tags: actorPacket.header.metadata.tags,
    metadata_language: actorPacket.header.metadata.language,
    metadata_summary: actorPacket.header.metadata.summary,
    name: actorPacket.body.name,
    subtype: actorPacket.body.subtype,
    summary: actorPacket.body.summary ?? null,
    locality_label: actorPacket.body.locality_label ?? null,
    locality: actorPacket.body.locality ?? null,
    identity: actorPacket.body.identity,
    tags: actorPacket.body.tags,
    claimed_role_refs: actorPacket.body.claimed_role_refs ?? [],
  });
}
