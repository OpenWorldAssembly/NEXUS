/**
 * File: discussion.ts
 * Description: Canonical discussion and attestation packet helpers that stay portable across interfaces and runtimes.
 */

import {
  createAttestationPacket,
  createDiscussionPostPacket,
  createDiscussionReplyPacket,
  createDiscussionThreadPacket,
  createTextExcerpt,
} from '@core/packets/builders';
import { PERSONAL_TREE_PACKET_IDS } from '@core/packets/seeds';
import type {
  DiscussionForumProjection,
  DiscussionPostProjection,
} from '@core/contracts';
import type {
  AttestationValue,
  PacketEnvelopeByType,
  PacketRef,
} from '@core/schema/packet-schema';

const LEGACY_SCOPE_ID_TO_PACKET_ID: Record<string, string> = {
  global: PERSONAL_TREE_PACKET_IDS.global_commons,
  'global-commons': PERSONAL_TREE_PACKET_IDS.global_commons,
  'united-states': PERSONAL_TREE_PACKET_IDS.united_states,
  california: PERSONAL_TREE_PACKET_IDS.california,
  'moreno-valley': PERSONAL_TREE_PACKET_IDS.moreno_valley,
  'sunnymead-ranch': PERSONAL_TREE_PACKET_IDS.sunnymead_ranch,
};

function createPacketSlug(input: string, maxLength = 40): string {
  const slug = input
    .replace(/^nexus:/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  if (slug.length <= maxLength) {
    return slug;
  }

  return slug.slice(0, maxLength).replace(/-+$/g, '');
}

function createContentSlug(input: string, fallback: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);

  return slug.length > 0 ? slug : fallback;
}

function createRandomSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  }

  return Math.random().toString(16).slice(2, 10).padEnd(8, '0');
}

function toPacketRefs(packetIds: string[]): PacketRef[] {
  return packetIds.map((packetId) => ({ packet_id: packetId }));
}

export function resolveDiscussionScopePacketId(scopeId: string): string {
  const decodedScopeId = decodeURIComponent(scopeId).trim();

  if (decodedScopeId.startsWith('nexus:element/')) {
    return decodedScopeId;
  }

  const normalizedScopeId = decodedScopeId.toLowerCase();

  return (
    LEGACY_SCOPE_ID_TO_PACKET_ID[decodedScopeId] ??
    LEGACY_SCOPE_ID_TO_PACKET_ID[normalizedScopeId] ??
    `nexus:element/${decodedScopeId}`
  );
}

export function createDiscussionRevisionId(
  packetId: string,
  createdAt: string
): string {
  const compactTimestamp = createdAt.replace(/[^0-9]/g, '').slice(0, 14);

  return `${packetId}@${compactTimestamp}-${createRandomSuffix()}`;
}

export function createFallbackDiscussionTitle(
  shortLabel: string,
  body: string,
  prefix: 'Post' | 'Reply'
): string {
  const excerpt = createTextExcerpt(body, 64);

  if (excerpt.length > 0) {
    return excerpt;
  }

  return `${prefix} from ${shortLabel}`;
}

export function createDiscussionThreadPacketId(input: {
  scopePacketId: string;
  forumPacketId: string;
  title: string;
  createdAt: string;
}): string {
  const compactTimestamp = input.createdAt.replace(/[^0-9]/g, '').slice(0, 14);

  return `nexus:discussion-thread/${createPacketSlug(
    input.scopePacketId,
    18
  )}-${createPacketSlug(input.forumPacketId, 18)}-${createContentSlug(
    input.title,
    'thread'
  )}-${compactTimestamp}-${createRandomSuffix()}`;
}

export function createDiscussionRootPostPacketId(input: {
  scopePacketId: string;
  threadPacketId: string;
  title: string;
  createdAt: string;
}): string {
  const compactTimestamp = input.createdAt.replace(/[^0-9]/g, '').slice(0, 14);

  return `nexus:discussion-post/${createPacketSlug(
    input.scopePacketId,
    18
  )}-${createPacketSlug(input.threadPacketId, 20)}-${createContentSlug(
    input.title,
    'post'
  )}-${compactTimestamp}-${createRandomSuffix()}`;
}

export function createDiscussionReplyPacketId(input: {
  scopePacketId: string;
  threadPacketId: string;
  body: string;
  createdAt: string;
}): string {
  const compactTimestamp = input.createdAt.replace(/[^0-9]/g, '').slice(0, 14);

  return `nexus:discussion-reply/${createPacketSlug(
    input.scopePacketId,
    18
  )}-${createPacketSlug(input.threadPacketId, 20)}-${createContentSlug(
    createTextExcerpt(input.body, 48),
    'reply'
  )}-${compactTimestamp}-${createRandomSuffix()}`;
}

export function createAttestationPacketId(input: {
  targetPacketId: string;
  actorPacketId: string;
  attestationKind: string;
  contextPacketId?: string | null;
}): string {
  const digestSource = [
    input.targetPacketId,
    input.actorPacketId,
    input.attestationKind,
    input.contextPacketId ?? '',
  ].join('|');
  let hashA = 2166136261;
  let hashB = 3335557771;

  for (let index = 0; index < digestSource.length; index += 1) {
    const code = digestSource.charCodeAt(index);

    hashA ^= code;
    hashA = Math.imul(hashA, 16777619) >>> 0;
    hashB ^= code;
    hashB = Math.imul(hashB, 2246822519) >>> 0;
  }

  const digest = `${hashA.toString(16).padStart(8, '0')}${hashB
    .toString(16)
    .padStart(8, '0')}`;

  return `nexus:attestation/${createPacketSlug(
    input.targetPacketId,
    36
  )}-${digest.slice(0, 12)}`;
}

export function buildDiscussionThreadPacket(input: {
  scopeId: string;
  forum: Pick<
    DiscussionForumProjection,
    | 'forum_packet_id'
    | 'forum_kind'
    | 'default_sort'
    | 'authority_scope_packet_id'
    | 'applicable_scope_packet_ids'
  >;
  actorPacket: PacketEnvelopeByType['Element'];
  title: string;
  body: string;
  createdAt?: string;
}): PacketEnvelopeByType['DiscussionThread'] {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const scopePacketId = resolveDiscussionScopePacketId(input.scopeId);
  const normalizedTitle = input.title.trim();
  const threadTitle =
    normalizedTitle.length > 0
      ? normalizedTitle
      : createFallbackDiscussionTitle(
          input.actorPacket.body.name,
          input.body,
          'Post'
        );
  const packetId = createDiscussionThreadPacketId({
    scopePacketId,
    forumPacketId: input.forum.forum_packet_id,
    title: threadTitle,
    createdAt,
  });

  return createDiscussionThreadPacket({
    packet_id: packetId,
    revision_id: createDiscussionRevisionId(packetId, createdAt),
    created_at: createdAt,
    authority_scope_ref: {
      packet_id: input.forum.authority_scope_packet_id ?? scopePacketId,
    },
    applicable_scope_refs:
      input.forum.applicable_scope_packet_ids.length > 0
        ? toPacketRefs(input.forum.applicable_scope_packet_ids)
        : [{ packet_id: scopePacketId }],
    adapter: 'nexus-web',
    created_by: {
      packet_id: input.actorPacket.header.packet_id,
    },
    metadata_tags: ['discussion-thread', input.forum.forum_kind],
    metadata_summary: createTextExcerpt(input.body),
    title: threadTitle,
    summary: createTextExcerpt(input.body, 160),
    forum_ref: { packet_id: input.forum.forum_packet_id },
    thread_kind: input.forum.forum_kind,
    status: 'open',
    related_refs: [],
    default_sort: input.forum.default_sort,
  });
}

export function buildDiscussionRootPostPacket(input: {
  scopeId: string;
  forum: Pick<DiscussionForumProjection, 'forum_kind'>;
  actorPacket: PacketEnvelopeByType['Element'];
  threadPacket: PacketEnvelopeByType['DiscussionThread'];
  body: string;
  createdAt?: string;
}): PacketEnvelopeByType['DiscussionPost'] {
  const createdAt = input.createdAt ?? input.threadPacket.header.created_at;
  const scopePacketId = resolveDiscussionScopePacketId(input.scopeId);
  const packetId = createDiscussionRootPostPacketId({
    scopePacketId,
    threadPacketId: input.threadPacket.header.packet_id,
    title: input.threadPacket.body.title,
    createdAt,
  });

  return createDiscussionPostPacket({
    packet_id: packetId,
    revision_id: createDiscussionRevisionId(packetId, createdAt),
    created_at: createdAt,
    authority_scope_ref: input.threadPacket.header.authority_scope_ref,
    applicable_scope_refs: input.threadPacket.header.applicable_scope_refs,
    adapter: 'nexus-web',
    metadata_tags: ['discussion-post', input.forum.forum_kind, 'thread-root'],
    metadata_summary: createTextExcerpt(input.body),
    title: input.threadPacket.body.title,
    created_by: {
      packet_id: input.actorPacket.header.packet_id,
    },
    thread_ref: { packet_id: input.threadPacket.header.packet_id },
    post_kind: 'forum_post',
    content_markdown: input.body.trim(),
  });
}

export function buildDiscussionReplyPacket(input: {
  scopeId: string;
  forum: Pick<DiscussionForumProjection, 'forum_kind'>;
  actorPacket: PacketEnvelopeByType['Element'];
  parentPost: Pick<
    DiscussionPostProjection,
    | 'packet'
    | 'thread_ref'
    | 'authority_scope_packet_id'
    | 'applicable_scope_packet_ids'
  >;
  rootPostPacketId: string;
  body: string;
  createdAt?: string;
}): PacketEnvelopeByType['DiscussionReply'] {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const scopePacketId = resolveDiscussionScopePacketId(input.scopeId);
  const packetId = createDiscussionReplyPacketId({
    scopePacketId,
    threadPacketId: input.parentPost.thread_ref.packet_id,
    body: input.body,
    createdAt,
  });

  return createDiscussionReplyPacket({
    packet_id: packetId,
    revision_id: createDiscussionRevisionId(packetId, createdAt),
    created_at: createdAt,
    authority_scope_ref: input.parentPost.authority_scope_packet_id
      ? {
          packet_id: input.parentPost.authority_scope_packet_id,
        }
      : { packet_id: scopePacketId },
    applicable_scope_refs:
      input.parentPost.applicable_scope_packet_ids.length > 0
        ? toPacketRefs(input.parentPost.applicable_scope_packet_ids)
        : [{ packet_id: scopePacketId }],
    adapter: 'nexus-web',
    metadata_tags: ['discussion-reply', input.forum.forum_kind],
    metadata_summary: createTextExcerpt(input.body),
    title: createFallbackDiscussionTitle(
      input.actorPacket.body.name,
      input.body,
      'Reply'
    ),
    created_by: {
      packet_id: input.actorPacket.header.packet_id,
    },
    thread_ref: input.parentPost.thread_ref,
    root_post_ref: { packet_id: input.rootPostPacketId },
    reply_to_ref: input.parentPost.packet,
    content_markdown: input.body.trim(),
  });
}

export function buildPacketSignalAttestationPacket(input: {
  scopeId: string;
  actorPacket: PacketEnvelopeByType['Element'];
  targetPost: Pick<
    DiscussionPostProjection,
    | 'packet'
    | 'authority_scope_packet_id'
    | 'applicable_scope_packet_ids'
    | 'vote_summary'
  >;
  value: AttestationValue | 0;
  createdAt?: string;
}): PacketEnvelopeByType['Attestation'] | null {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const scopePacketId = resolveDiscussionScopePacketId(input.scopeId);
  const currentValue = input.targetPost.vote_summary.viewer_value;

  if (input.value === 0 && currentValue === 0) {
    return null;
  }

  const packetId = createAttestationPacketId({
    targetPacketId: input.targetPost.packet.packet_id,
    actorPacketId: input.actorPacket.header.packet_id,
    attestationKind: 'packet_signal',
  });
  const persistedValue = input.value === 0 ? currentValue : input.value;

  return createAttestationPacket({
    packet_id: packetId,
    revision_id: createDiscussionRevisionId(packetId, createdAt),
    created_at: createdAt,
    authority_scope_ref: input.targetPost.authority_scope_packet_id
      ? {
          packet_id: input.targetPost.authority_scope_packet_id,
        }
      : { packet_id: scopePacketId },
    applicable_scope_refs:
      input.targetPost.applicable_scope_packet_ids.length > 0
        ? toPacketRefs(input.targetPost.applicable_scope_packet_ids)
        : [{ packet_id: scopePacketId }],
    adapter: 'nexus-web',
    created_by: {
      packet_id: input.actorPacket.header.packet_id,
    },
    metadata_tags: ['attestation', 'packet-signal'],
    target_ref: input.targetPost.packet,
    value: persistedValue === -1 ? -1 : 1,
    status: input.value === 0 ? 'cleared' : 'active',
    attestation_kind: 'packet_signal',
    supersedes_ref:
      currentValue === 0
        ? null
        : {
            packet_id: packetId,
          },
  });
}
