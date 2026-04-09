/**
 * File: visitor-lobby-file-store.ts
 * Description: Implements a shared file-backed visitor-lobby repository for local Nexus development.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { nexusScopeSummaries } from '@/data/nexus/mock-nexus-data';
import {
  createDiscussionPostPacket,
  createDiscussionThreadPacket,
} from '@/domain/packets/builders';
import {
  getNexusAncestorIds,
  type NexusScopeSummary,
} from '@/lib/nexus/nexus-shell';
import {
  VISITOR_LOBBY_BUNDLE_VERSION,
  createEmptyVisitorLobbyBundle,
  createAnonymousSessionExternalRef,
  createScopePacketId,
  createVisitorLobbyExcerpt,
  createVisitorLobbyPacketRef,
  createVisitorLobbyPostPacketId,
  createVisitorLobbyThreadPacketId,
  parseVisitorLobbyBundle,
  type AnonymousSession,
  type VisitorLobbyBundle,
  type VisitorLobbyPostRecord,
  type VisitorLobbyRepository,
  type VisitorLobbyScopeFeed,
  type VisitorLobbyThreadRecord,
} from '@/lib/nexus/visitor-lobby';

const VISITOR_LOBBY_BUNDLE_PATH = path.join(
  process.cwd(),
  'data',
  'nexus',
  'visitor-lobby-bundle.json',
);

/**
 * Inputs: a scope id string.
 * Output: the scope summary when that scope is public and visitor-lobby-enabled.
 */
function getPublicLobbyScope(scopeId: string): NexusScopeSummary | null {
  return (
    nexusScopeSummaries.find(
      (scope) => scope.id === scopeId && scope.stats.guestLobbyOpen,
    ) ?? null
  );
}

/**
 * Inputs: a scope id string.
 * Output: the applicable scope refs for that scope plus its visible ancestors.
 */
function createApplicableScopeRefs(scopeId: string) {
  return [scopeId, ...getNexusAncestorIds(nexusScopeSummaries, scopeId)].map(
    (visibleScopeId) => createVisitorLobbyPacketRef(createScopePacketId(visibleScopeId)),
  );
}

/**
 * Inputs: a public scope summary.
 * Output: the seeded visitor-lobby thread packet for that scope.
 */
function createSeedVisitorLobbyThread(
  scope: NexusScopeSummary,
): VisitorLobbyThreadRecord {
  const packetId = createVisitorLobbyThreadPacketId(scope.id);
  const createdAt = new Date().toISOString();

  return createDiscussionThreadPacket({
    packet_id: packetId,
    created_at: createdAt,
    authority_scope_ref: createVisitorLobbyPacketRef(createScopePacketId(scope.id)),
    applicable_scope_refs: createApplicableScopeRefs(scope.id),
    adapter: 'visitor-lobby-bundle',
    metadata_summary: `Public visitor lobby for ${scope.name}.`,
    metadata_tags: ['visitor-lobby', 'thread', scope.id],
    title: scope.publicLobbyLabel,
    summary: `Public guest thread for ${scope.name}.`,
    thread_kind: 'visitor_lobby',
    status: 'open',
    related_refs: [],
  });
}

/**
 * Inputs: the current bundle.
 * Output: the bundle with one visitor-lobby thread per public scope plus a changed flag.
 */
function ensureSeedThreads(bundle: VisitorLobbyBundle): {
  bundle: VisitorLobbyBundle;
  changed: boolean;
} {
  const existingScopeIds = new Set(
    bundle.threads
      .map((thread) => thread.header.authority_scope_ref?.packet_id ?? null)
      .filter((packetId): packetId is string => packetId !== null),
  );
  const missingThreads = nexusScopeSummaries
    .filter((scope) => scope.stats.guestLobbyOpen)
    .filter((scope) => !existingScopeIds.has(createScopePacketId(scope.id)))
    .map((scope) => createSeedVisitorLobbyThread(scope));

  if (missingThreads.length === 0) {
    return { bundle, changed: false };
  }

  return {
    bundle: {
      ...bundle,
      updated_at: new Date().toISOString(),
      threads: [...bundle.threads, ...missingThreads],
    },
    changed: true,
  };
}

/**
 * Inputs: a bundle object.
 * Output: the same bundle persisted to the shared JSON file.
 */
async function writeBundle(bundle: VisitorLobbyBundle): Promise<void> {
  await mkdir(path.dirname(VISITOR_LOBBY_BUNDLE_PATH), { recursive: true });
  await writeFile(
    VISITOR_LOBBY_BUNDLE_PATH,
    `${JSON.stringify(bundle, null, 2)}\n`,
    'utf-8',
  );
}

/**
 * Inputs: none.
 * Output: the visitor-lobby bundle from disk with seeded threads ensured.
 */
async function readSeededBundle(): Promise<VisitorLobbyBundle> {
  try {
    const rawBundle = await readFile(VISITOR_LOBBY_BUNDLE_PATH, 'utf-8');
    const parsedRawBundle = JSON.parse(rawBundle) as {
      version?: number;
    };
    const parsedBundle = parseVisitorLobbyBundle(parsedRawBundle);
    const seededBundle = ensureSeedThreads(parsedBundle);
    const needsRewrite =
      parsedRawBundle.version !== VISITOR_LOBBY_BUNDLE_VERSION || seededBundle.changed;

    if (needsRewrite) {
      await writeBundle(seededBundle.bundle);
    }

    return seededBundle.bundle;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  const emptyBundle = ensureSeedThreads(createEmptyVisitorLobbyBundle());

  await writeBundle(emptyBundle.bundle);

  return emptyBundle.bundle;
}

/**
 * Inputs: a bundle and scope id.
 * Output: the seeded visitor-lobby thread for that scope, or null when the scope is invalid.
 */
function getScopeThread(
  bundle: VisitorLobbyBundle,
  scopeId: string,
): VisitorLobbyThreadRecord | null {
  const scopePacketId = createScopePacketId(scopeId);

  return (
    bundle.threads.find(
      (thread) => thread.header.authority_scope_ref?.packet_id === scopePacketId,
    ) ?? null
  );
}

/**
 * Inputs: a bundle and thread packet id.
 * Output: the posts for that thread sorted newest first.
 */
function getThreadPosts(
  bundle: VisitorLobbyBundle,
  threadId: string,
): VisitorLobbyPostRecord[] {
  return [...bundle.posts]
    .filter((post) => post.body.thread_ref.packet_id === threadId)
    .sort((leftPost, rightPost) =>
      rightPost.header.created_at.localeCompare(leftPost.header.created_at),
    );
}

/**
 * Inputs: scope summary, thread record, guest session, title, and content.
 * Output: a new visitor-lobby discussion post packet.
 */
function createVisitorLobbyPostRecord(input: {
  scope: NexusScopeSummary;
  thread: VisitorLobbyThreadRecord;
  session: AnonymousSession;
  title: string;
  body: string;
}): VisitorLobbyPostRecord {
  const createdAt = new Date().toISOString();
  const packetId = createVisitorLobbyPostPacketId(
    input.scope.id,
    createdAt,
    input.session.session_id.slice(-6),
  );
  const content = input.body.trim();
  const title = input.title.trim() || 'Anonymous visitor note';

  return createDiscussionPostPacket({
    packet_id: packetId,
    created_at: createdAt,
    authority_scope_ref: createVisitorLobbyPacketRef(
      createScopePacketId(input.scope.id),
    ),
    applicable_scope_refs: createApplicableScopeRefs(input.scope.id),
    adapter: 'visitor-lobby-bundle',
    external_refs: [createAnonymousSessionExternalRef(input.session)],
    metadata_summary: createVisitorLobbyExcerpt(content),
    metadata_tags: ['visitor-lobby', 'post', input.scope.id],
    title,
    thread_ref: createVisitorLobbyPacketRef(input.thread.header.packet_id),
    post_kind: 'visitor_lobby_post',
    content_markdown: content,
    reply_to_ref: null,
  });
}

/**
 * Inputs: none.
 * Output: a shared file-backed repository for the visitor-lobby discussion MVP.
 */
export class FileVisitorLobbyRepository implements VisitorLobbyRepository {
  /**
   * Inputs: a scope id string.
   * Output: the seeded visitor-lobby thread and newest-first posts for that scope.
   */
  async getLobby(scopeId: string): Promise<VisitorLobbyScopeFeed> {
    const scope = getPublicLobbyScope(scopeId);

    if (!scope) {
      throw new Error(`Unknown public visitor lobby scope: ${scopeId}`);
    }

    const bundle = await readSeededBundle();
    const thread = getScopeThread(bundle, scopeId);

    if (!thread) {
      throw new Error(`Missing visitor lobby thread for scope: ${scopeId}`);
    }

    return {
      thread,
      posts: getThreadPosts(bundle, thread.header.packet_id),
    };
  }

  /**
   * Inputs: scope id, anonymous session, and post content.
   * Output: the saved visitor-lobby post packet after the shared bundle is updated.
   */
  async createLobbyPost(input: {
    scopeId: string;
    session: AnonymousSession;
    title: string;
    body: string;
  }): Promise<VisitorLobbyPostRecord> {
    const scope = getPublicLobbyScope(input.scopeId);

    if (!scope) {
      throw new Error(`Unknown public visitor lobby scope: ${input.scopeId}`);
    }

    const bundle = await readSeededBundle();
    const thread = getScopeThread(bundle, input.scopeId);

    if (!thread) {
      throw new Error(`Missing visitor lobby thread for scope: ${input.scopeId}`);
    }

    const nextPost = createVisitorLobbyPostRecord({
      scope,
      thread,
      session: input.session,
      title: input.title,
      body: input.body,
    });

    await writeBundle({
      ...bundle,
      updated_at: nextPost.header.created_at,
      posts: [nextPost, ...bundle.posts],
    });

    return nextPost;
  }
}

export const visitorLobbyRepository = new FileVisitorLobbyRepository();
