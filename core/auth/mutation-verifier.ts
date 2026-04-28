/**
 * File: mutation-verifier.ts
 * Description: Discussion-specific canonical mutation candidate builders and policy evaluation helpers.
 */

import {
  assertCandidateAuthoredByActor,
  assertDiscussionViewerAuthority,
} from '@core/auth/authority';
import type { DiscussionViewerContext } from '@core/contracts';
import {
  createDiscussionPacket,
  createPacketEdge,
  createTextExcerpt,
} from '@core/packets/builders';
import {
  createFallbackDiscussionTitle,
  resolveDiscussionScopePacketId,
} from '@core/packets/discussion';
import type {
  DiscussionSort,
  PacketEnvelope,
  PacketEnvelopeByType,
  PacketRef,
} from '@core/schema/packet-schema';

import {
  assertProofBundleSatisfiesPolicy,
  resolveWritePolicyForActions,
  type MutationActionId,
  type ResolvedWritePolicyDecision,
} from '@core/auth/write-policy';
import type {
  MutationProofMethod,
  MutationProofBundle,
  WriteProofLevel,
} from '@core/auth/proof-types';

export interface SignerAdapter {
  signPackets(input: {
    packets: PacketEnvelope[];
    required_proof_level: WriteProofLevel;
    accepted_proof_methods: MutationProofMethod[];
  }): Promise<PacketEnvelope[]>;
}

type DiscussionThreadPostIntent = {
  kind: 'discussion.thread_post.create';
  scope_id: string;
  mutation_nonce: string;
  created_at: string;
  forum_packet_id: string;
  forum_kind: string;
  authority_scope_packet_id: string | null;
  applicable_scope_packet_ids: string[];
  default_sort: DiscussionSort;
  thread_title: string;
  post_markdown: string;
  thread_kind?: string | null;
  related_packet_ids?: string[];
  legacy_context_packet_ids?: string[];
};

type DiscussionReplyIntent = {
  kind: 'discussion.reply.create';
  scope_id: string;
  mutation_nonce: string;
  created_at: string;
  forum_kind: string;
  authority_scope_packet_id: string | null;
  applicable_scope_packet_ids: string[];
  thread_packet_id: string;
  root_post_packet_id: string;
  parent_post_packet_id: string;
  reply_markdown: string;
  legacy_context_packet_ids?: string[];
};

export type MutationIntent = DiscussionThreadPostIntent | DiscussionReplyIntent;

export interface MutationCandidate {
  intent: MutationIntent;
  action_ids: MutationActionId[];
  packets: PacketEnvelope[];
  governing_scope_packet_id: string | null;
}

export interface MutationDecision extends MutationCandidate {
  required_proof_level: WriteProofLevel;
  accepted_proof_methods: MutationProofMethod[];
  source_policy_packet_ids: string[];
}

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

function normalizeMutationNonce(mutationNonce: string): string {
  const normalized = mutationNonce
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  return normalized.slice(0, 8).padEnd(8, '0');
}

function createDiscussionRevisionId(input: {
  packetId: string;
  createdAt: string;
  mutationNonce: string;
}): string {
  const compactTimestamp = input.createdAt.replace(/[^0-9]/g, '').slice(0, 14);

  return `${input.packetId}@${compactTimestamp}-${normalizeMutationNonce(
    input.mutationNonce
  )}`;
}

function createDiscussionThreadPacketId(input: {
  scopePacketId: string;
  forumPacketId: string;
  title: string;
  createdAt: string;
  mutationNonce: string;
}): string {
  const compactTimestamp = input.createdAt.replace(/[^0-9]/g, '').slice(0, 14);

  return `nexus:discussion/topic/${createPacketSlug(
    input.scopePacketId,
    18
  )}-${createPacketSlug(input.forumPacketId, 18)}-${createContentSlug(
    input.title,
    'thread'
  )}-${compactTimestamp}-${normalizeMutationNonce(input.mutationNonce)}`;
}

function createDiscussionRootPostPacketId(input: {
  scopePacketId: string;
  threadPacketId: string;
  title: string;
  createdAt: string;
  mutationNonce: string;
}): string {
  const compactTimestamp = input.createdAt.replace(/[^0-9]/g, '').slice(0, 14);

  return `nexus:discussion/message/${createPacketSlug(
    input.scopePacketId,
    18
  )}-${createPacketSlug(input.threadPacketId, 20)}-${createContentSlug(
    input.title,
    'post'
  )}-${compactTimestamp}-${normalizeMutationNonce(input.mutationNonce)}`;
}

function createDiscussionReplyPacketId(input: {
  scopePacketId: string;
  threadPacketId: string;
  body: string;
  createdAt: string;
  mutationNonce: string;
}): string {
  const compactTimestamp = input.createdAt.replace(/[^0-9]/g, '').slice(0, 14);

  return `nexus:discussion/message/${createPacketSlug(
    input.scopePacketId,
    18
  )}-${createPacketSlug(input.threadPacketId, 20)}-${createContentSlug(
    createTextExcerpt(input.body, 48),
    'reply'
  )}-${compactTimestamp}-${normalizeMutationNonce(input.mutationNonce)}`;
}

function toPacketRefs(packetIds: string[]): PacketRef[] {
  return packetIds.map((packetId) => ({ packet_id: packetId }));
}

function stripPacketSigningState(packet: PacketEnvelope): PacketEnvelope {
  return {
    ...packet,
    header: {
      ...packet.header,
      integrity: {
        ...packet.header.integrity,
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
    },
  } as PacketEnvelope;
}

export function assertSignedPacketsMatchCandidate(input: {
  candidatePackets: PacketEnvelope[];
  signedPackets: PacketEnvelope[];
}): void {
  if (input.candidatePackets.length !== input.signedPackets.length) {
    throw new Error('Signed mutation packet bundle does not match the candidate size.');
  }

  input.candidatePackets.forEach((candidatePacket, index) => {
    const signedPacket = input.signedPackets[index];

    if (!signedPacket || signedPacket.header.family !== candidatePacket.header.family) {
      throw new Error(
        'Signed mutation packet bundle does not match the canonical packet families.'
      );
    }

    if (
      JSON.stringify(stripPacketSigningState(signedPacket)) !==
      JSON.stringify(stripPacketSigningState(candidatePacket))
    ) {
      throw new Error(
        'Signed mutation packet bundle does not match the canonical discussion candidate.'
      );
    }
  });
}

export function createDiscussionThreadPostCandidate(input: {
  intent: DiscussionThreadPostIntent;
  actorPacket: PacketEnvelopeByType['Element'];
}): MutationCandidate {
  const scopePacketId = resolveDiscussionScopePacketId(input.intent.scope_id);
  const normalizedTitle = input.intent.thread_title.trim();
  const postBody = input.intent.post_markdown.trim();
  const threadTitle =
    normalizedTitle.length > 0
      ? normalizedTitle
      : createFallbackDiscussionTitle(
          input.actorPacket.body.name,
          postBody,
          'Post'
        );
  const relatedPacketIds = input.intent.related_packet_ids ?? [];
  const legacyContextEdges = (input.intent.legacy_context_packet_ids ?? []).map(
    (packetId) =>
      createPacketEdge('references', packetId, {
        source_field: 'legacy_context_packet_ids',
        adapter_profile: 'discussion-family-unification',
      })
  );
  const threadKind =
    input.intent.thread_kind?.trim() || input.intent.forum_kind;
  const authorityScopePacketId =
    input.intent.authority_scope_packet_id ?? scopePacketId;
  const applicableScopePacketIds =
    input.intent.applicable_scope_packet_ids.length > 0
      ? input.intent.applicable_scope_packet_ids
      : [scopePacketId];
  const threadPacketId = createDiscussionThreadPacketId({
    scopePacketId,
    forumPacketId: input.intent.forum_packet_id,
    title: threadTitle,
    createdAt: input.intent.created_at,
    mutationNonce: input.intent.mutation_nonce,
  });
  const topicPacket = createDiscussionPacket({
    packet_id: threadPacketId,
    revision_id: createDiscussionRevisionId({
      packetId: threadPacketId,
      createdAt: input.intent.created_at,
      mutationNonce: input.intent.mutation_nonce,
    }),
    created_at: input.intent.created_at,
    authority_scope_ref: {
      packet_id: authorityScopePacketId,
    },
    applicable_scope_refs: toPacketRefs(applicableScopePacketIds),
    adapter: 'nexus-web',
    created_by: {
      packet_id: input.actorPacket.header.packet_id,
    },
    metadata_tags: ['discussion', 'topic', input.intent.forum_kind],
    metadata_summary: createTextExcerpt(postBody),
    edges: legacyContextEdges,
    kind: 'topic',
    role: threadKind,
    title: threadTitle,
    summary: createTextExcerpt(postBody, 160),
    parent_ref: {
      packet_id: input.intent.forum_packet_id,
    },
    status: 'open',
    related_refs: toPacketRefs(relatedPacketIds),
    default_sort: input.intent.default_sort,
  });
  const postPacketId = createDiscussionRootPostPacketId({
    scopePacketId,
    threadPacketId: topicPacket.header.packet_id,
    title: topicPacket.body.title,
    createdAt: input.intent.created_at,
    mutationNonce: input.intent.mutation_nonce,
  });
  const postPacket = createDiscussionPacket({
    packet_id: postPacketId,
    revision_id: createDiscussionRevisionId({
      packetId: postPacketId,
      createdAt: input.intent.created_at,
      mutationNonce: input.intent.mutation_nonce,
    }),
    created_at: input.intent.created_at,
    authority_scope_ref: topicPacket.header.authority_scope_ref,
    applicable_scope_refs: topicPacket.header.applicable_scope_refs,
    adapter: 'nexus-web',
    metadata_tags: ['discussion', 'message', input.intent.forum_kind, 'topic-root'],
    metadata_summary: createTextExcerpt(postBody),
    edges: legacyContextEdges,
    kind: 'message',
    role: 'forum_post',
    title: topicPacket.body.title,
    created_by: {
      packet_id: input.actorPacket.header.packet_id,
    },
    parent_ref: {
      packet_id: topicPacket.header.packet_id,
    },
    topic_ref: {
      packet_id: topicPacket.header.packet_id,
    },
    root_message_ref: null,
    status: 'open',
    content_markdown: postBody,
  });

  return {
    intent: input.intent,
    action_ids: ['discussion.thread.create', 'discussion.post.create'],
    packets: [topicPacket, postPacket],
    governing_scope_packet_id: authorityScopePacketId,
  };
}

export function createDiscussionReplyCandidate(input: {
  intent: DiscussionReplyIntent;
  actorPacket: PacketEnvelopeByType['Element'];
}): MutationCandidate {
  const scopePacketId = resolveDiscussionScopePacketId(input.intent.scope_id);
  const replyBody = input.intent.reply_markdown.trim();
  const legacyContextEdges = (input.intent.legacy_context_packet_ids ?? []).map(
    (packetId) =>
      createPacketEdge('references', packetId, {
        source_field: 'legacy_context_packet_ids',
        adapter_profile: 'discussion-family-unification',
      })
  );
  const authorityScopePacketId =
    input.intent.authority_scope_packet_id ?? scopePacketId;
  const applicableScopePacketIds =
    input.intent.applicable_scope_packet_ids.length > 0
      ? input.intent.applicable_scope_packet_ids
      : [scopePacketId];
  const replyPacketId = createDiscussionReplyPacketId({
    scopePacketId,
    threadPacketId: input.intent.thread_packet_id,
    body: replyBody,
    createdAt: input.intent.created_at,
    mutationNonce: input.intent.mutation_nonce,
  });
  const replyPacket = createDiscussionPacket({
    packet_id: replyPacketId,
    revision_id: createDiscussionRevisionId({
      packetId: replyPacketId,
      createdAt: input.intent.created_at,
      mutationNonce: input.intent.mutation_nonce,
    }),
    created_at: input.intent.created_at,
    authority_scope_ref: {
      packet_id: authorityScopePacketId,
    },
    applicable_scope_refs: toPacketRefs(applicableScopePacketIds),
    adapter: 'nexus-web',
    metadata_tags: ['discussion', 'message', 'reply', input.intent.forum_kind],
    metadata_summary: createTextExcerpt(replyBody),
    edges: legacyContextEdges,
    kind: 'message',
    role: 'reply',
    title: createFallbackDiscussionTitle(
      input.actorPacket.body.name,
      replyBody,
      'Reply'
    ),
    created_by: {
      packet_id: input.actorPacket.header.packet_id,
    },
    parent_ref: {
      packet_id: input.intent.parent_post_packet_id,
    },
    topic_ref: {
      packet_id: input.intent.thread_packet_id,
    },
    root_message_ref: {
      packet_id: input.intent.root_post_packet_id,
    },
    status: 'open',
    content_markdown: replyBody,
  });

  return {
    intent: input.intent,
    action_ids: ['discussion.reply.create'],
    packets: [replyPacket],
    governing_scope_packet_id: authorityScopePacketId,
  };
}

export function evaluateDiscussionThreadPostMutation(input: {
  intent: DiscussionThreadPostIntent;
  actorPacket: PacketEnvelopeByType['Element'];
  viewer: DiscussionViewerContext;
  governingScopePacket: PacketEnvelopeByType['Element'] | null;
  policyPackets: PacketEnvelopeByType['Policy'][];
}): MutationDecision {
  const candidate = createDiscussionThreadPostCandidate({
    intent: input.intent,
    actorPacket: input.actorPacket,
  });
  const policyDecision = resolveWritePolicyForActions({
    governingScopePacket: input.governingScopePacket,
    policyPackets: input.policyPackets,
    actionIds: candidate.action_ids,
  });

  assertDiscussionViewerAuthority({
    viewer: input.viewer,
    actionId: 'discussion.thread.create',
  });
  assertDiscussionViewerAuthority({
    viewer: input.viewer,
    actionId: 'discussion.post.create',
  });
  assertCandidateAuthoredByActor({
    actorPacket: input.actorPacket,
    packets: candidate.packets,
  });

  return {
    ...candidate,
    required_proof_level: policyDecision.required_proof_level,
    accepted_proof_methods: policyDecision.accepted_proof_methods,
    source_policy_packet_ids: policyDecision.source_policy_packet_ids,
  };
}

export function evaluateDiscussionReplyMutation(input: {
  intent: DiscussionReplyIntent;
  actorPacket: PacketEnvelopeByType['Element'];
  viewer: DiscussionViewerContext;
  governingScopePacket: PacketEnvelopeByType['Element'] | null;
  policyPackets: PacketEnvelopeByType['Policy'][];
}): MutationDecision {
  const candidate = createDiscussionReplyCandidate({
    intent: input.intent,
    actorPacket: input.actorPacket,
  });
  const policyDecision = resolveWritePolicyForActions({
    governingScopePacket: input.governingScopePacket,
    policyPackets: input.policyPackets,
    actionIds: candidate.action_ids,
  });

  assertDiscussionViewerAuthority({
    viewer: input.viewer,
    actionId: 'discussion.reply.create',
  });
  assertCandidateAuthoredByActor({
    actorPacket: input.actorPacket,
    packets: candidate.packets,
  });

  return {
    ...candidate,
    required_proof_level: policyDecision.required_proof_level,
    accepted_proof_methods: policyDecision.accepted_proof_methods,
    source_policy_packet_ids: policyDecision.source_policy_packet_ids,
  };
}

export function assertMutationProofBundle(input: {
  decision: ResolvedWritePolicyDecision;
  proofs: MutationProofBundle;
}): void {
  assertProofBundleSatisfiesPolicy(input);
}
