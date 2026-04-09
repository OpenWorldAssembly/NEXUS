/**
 * File: visitor-lobby-packet-repository.ts
 * Description: Persists and queries visitor-lobby threads/posts from the canonical SQLite packet store.
 */

import {
  PERSONAL_TREE_PACKET_IDS,
  PERSONAL_TREE_REFS,
} from '@/domain/packets/seeds';
import {
  createDiscussionPostPacket,
  createDiscussionThreadPacket,
} from '@/domain/packets/builders';
import type { PacketEnvelopeByType, PacketRef } from '@/domain/schema/packet-schema';
import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';
import {
  createAnonymousSessionExternalRef,
  createScopePacketId,
  createVisitorLobbyPostPacketId,
  createVisitorLobbyThreadPacketId,
  parseVisitorLobbyPostRecord,
  parseVisitorLobbyThreadRecord,
  type VisitorLobbyPostRecord,
  type VisitorLobbyRepository,
  type VisitorLobbyScopeFeed,
} from '@/lib/nexus/visitor-lobby';

const LEGACY_SCOPE_ID_TO_PACKET_ID: Record<string, string> = {
  global: PERSONAL_TREE_PACKET_IDS.global_commons,
  'global-commons': PERSONAL_TREE_PACKET_IDS.global_commons,
  'united-states': PERSONAL_TREE_PACKET_IDS.united_states,
  california: PERSONAL_TREE_PACKET_IDS.california,
  'moreno-valley': PERSONAL_TREE_PACKET_IDS.moreno_valley,
  'sunnymead-ranch': PERSONAL_TREE_PACKET_IDS.sunnymead_ranch,
  'east-bay': PERSONAL_TREE_PACKET_IDS.california,
  'oakland-lake-merritt': PERSONAL_TREE_PACKET_IDS.moreno_valley,
  'richmond-waterfront': PERSONAL_TREE_PACKET_IDS.sunnymead_ranch,
};

function decodeScopeId(scopeId: string): string {
  try {
    return decodeURIComponent(scopeId);
  } catch {
    return scopeId;
  }
}

/**
 * Inputs: a requested scope id from route params.
 * Output: the canonical element packet id for that scope.
 */
function resolveScopePacketId(scopeId: string): string {
  const decodedScopeId = decodeScopeId(scopeId).trim();

  if (decodedScopeId.length === 0) {
    return createScopePacketId(scopeId);
  }

  if (decodedScopeId.startsWith('nexus:element/')) {
    return decodedScopeId;
  }

  const normalizedScopeId = decodedScopeId.toLowerCase();

  return (
    LEGACY_SCOPE_ID_TO_PACKET_ID[decodedScopeId] ??
    LEGACY_SCOPE_ID_TO_PACKET_ID[normalizedScopeId] ??
    createScopePacketId(decodedScopeId)
  );
}

function createRandomPostSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Inputs: shared packet services and scope packet id.
 * Output: the scope element packet name when available.
 */
async function getScopeName(
  scopePacketId: string
): Promise<string | null> {
  const services = await getNexusPacketServices();
  const scopePacket = await services.packetStore.fetchByPacket({
    packet_id: scopePacketId,
  });

  if (!scopePacket || scopePacket.header.family !== 'Element') {
    return null;
  }

  return (scopePacket as PacketEnvelopeByType['Element']).body.name;
}

/**
 * Inputs: a requested scope packet id.
 * Output: throws when the scope does not exist in the packet store.
 */
async function assertScopeExists(scopePacketId: string): Promise<void> {
  const services = await getNexusPacketServices();
  const scopePacket = await services.packetStore.fetchByPacket({
    packet_id: scopePacketId,
  });

  if (!scopePacket || scopePacket.header.family !== 'Element') {
    throw new Error(`Unknown public visitor lobby scope: ${scopePacketId}`);
  }
}

/**
 * Inputs: a scope packet id.
 * Output: the current visitor-lobby thread for that scope, creating it when missing.
 */
async function ensureVisitorLobbyThread(
  scopePacketId: string
): Promise<PacketEnvelopeByType['DiscussionThread']> {
  const services = await getNexusPacketServices();
  const scopeRef: PacketRef = { packet_id: scopePacketId };
  const threadPacketId = createVisitorLobbyThreadPacketId(scopePacketId);
  const discussionThreadPackets =
    await services.packetStore.listPreferredPacketsByFamily('DiscussionThread');
  const discussionPostPackets =
    await services.packetStore.listPreferredPacketsByFamily('DiscussionPost');
  const postCountByThreadPacketId = new Map<string, number>();

  for (const postPacket of discussionPostPackets) {
    const currentCount =
      postCountByThreadPacketId.get(postPacket.body.thread_ref.packet_id) ?? 0;

    postCountByThreadPacketId.set(
      postPacket.body.thread_ref.packet_id,
      currentCount + 1
    );
  }

  const matchingScopeThreads = discussionThreadPackets
    .filter((threadPacket) => threadPacket.body.thread_kind === 'visitor_lobby')
    .filter(
      (threadPacket) =>
        threadPacket.header.authority_scope_ref?.packet_id === scopePacketId
    )
    .sort((leftThread, rightThread) => {
      const leftPostCount =
        postCountByThreadPacketId.get(leftThread.header.packet_id) ?? 0;
      const rightPostCount =
        postCountByThreadPacketId.get(rightThread.header.packet_id) ?? 0;

      if (leftPostCount !== rightPostCount) {
        return rightPostCount - leftPostCount;
      }

      const exactPacketIdComparison =
        Number(rightThread.header.packet_id === threadPacketId) -
        Number(leftThread.header.packet_id === threadPacketId);

      if (exactPacketIdComparison !== 0) {
        return exactPacketIdComparison;
      }

      const createdAtComparison = leftThread.header.created_at.localeCompare(
        rightThread.header.created_at
      );

      if (createdAtComparison !== 0) {
        return createdAtComparison;
      }

      return leftThread.header.packet_id.localeCompare(rightThread.header.packet_id);
    });

  if (matchingScopeThreads.length > 0) {
    return parseVisitorLobbyThreadRecord(matchingScopeThreads[0]);
  }

  const existingThread = await services.packetStore.fetchByPacket({
    packet_id: threadPacketId,
  });

  if (existingThread && existingThread.header.family === 'DiscussionThread') {
    return parseVisitorLobbyThreadRecord(existingThread);
  }

  const scopeName = (await getScopeName(scopePacketId)) ?? 'Scope';
  const threadPacket = createDiscussionThreadPacket({
    packet_id: threadPacketId,
    created_at: new Date().toISOString(),
    authority_scope_ref: scopeRef,
    applicable_scope_refs: [scopeRef],
    created_by: PERSONAL_TREE_REFS.global_commons,
    adapter: 'nexus-web',
    metadata_tags: ['visitor-lobby', 'public'],
    title: `${scopeName} visitor lobby`,
    summary:
      'Public channel for introductions, locality questions, and newcomer orientation.',
    thread_kind: 'visitor_lobby',
    status: 'open',
    related_refs: [],
  });

  await services.packetStore.writeRevision(threadPacket);

  return parseVisitorLobbyThreadRecord(threadPacket);
}

/**
 * Inputs: a scope packet id and visitor-lobby thread packet id.
 * Output: saved post packets attached to that scope + thread, newest first.
 */
async function listVisitorLobbyPosts(
  scopePacketId: string,
  threadPacketId: string
): Promise<VisitorLobbyPostRecord[]> {
  const services = await getNexusPacketServices();
  const discussionPostPackets =
    await services.packetStore.listPreferredPacketsByFamily('DiscussionPost');

  return discussionPostPackets
    .filter((postPacket) => postPacket.body.thread_ref.packet_id === threadPacketId)
    .filter((postPacket) => {
      if (postPacket.header.authority_scope_ref?.packet_id === scopePacketId) {
        return true;
      }

      return postPacket.header.applicable_scope_refs.some(
        (scopeRef) => scopeRef.packet_id === scopePacketId
      );
    })
    .sort((leftPost, rightPost) =>
      rightPost.header.created_at.localeCompare(leftPost.header.created_at)
    )
    .map(parseVisitorLobbyPostRecord);
}

export const visitorLobbyRepository: VisitorLobbyRepository = {
  /**
   * Inputs: a scope id.
   * Output: the scope visitor-lobby thread and all saved posts.
   */
  async getLobby(scopeId: string): Promise<VisitorLobbyScopeFeed> {
    const scopePacketId = resolveScopePacketId(scopeId);

    await assertScopeExists(scopePacketId);

    const threadPacket = await ensureVisitorLobbyThread(scopePacketId);
    const posts = await listVisitorLobbyPosts(
      scopePacketId,
      threadPacket.header.packet_id
    );

    return {
      thread: threadPacket,
      posts,
    };
  },

  /**
   * Inputs: scope + anonymous session + post body.
   * Output: the saved canonical `DiscussionPost` packet.
   */
  async createLobbyPost(input): Promise<VisitorLobbyPostRecord> {
    const scopePacketId = resolveScopePacketId(input.scopeId);

    await assertScopeExists(scopePacketId);

    const services = await getNexusPacketServices();
    const scopeRef: PacketRef = { packet_id: scopePacketId };
    const threadPacket = await ensureVisitorLobbyThread(scopePacketId);
    const createdAt = new Date().toISOString();
    const postPacket = createDiscussionPostPacket({
      packet_id: createVisitorLobbyPostPacketId(
        scopePacketId,
        createdAt,
        createRandomPostSuffix()
      ),
      created_at: createdAt,
      authority_scope_ref: scopeRef,
      applicable_scope_refs: [scopeRef],
      adapter: 'nexus-web',
      metadata_tags: ['visitor-lobby', 'guest-post'],
      metadata_summary: input.body,
      external_refs: [createAnonymousSessionExternalRef(input.session)],
      title:
        input.title.trim().length > 0
          ? input.title.trim()
          : `Post from ${input.session.short_label}`,
      thread_ref: { packet_id: threadPacket.header.packet_id },
      post_kind: 'forum_post',
      content_markdown: input.body,
      reference_refs: [],
    });

    await services.packetStore.writeRevision(postPacket);

    return parseVisitorLobbyPostRecord(postPacket);
  },
};
