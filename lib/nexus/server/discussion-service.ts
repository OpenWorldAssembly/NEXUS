/**
 * File: discussion-service.ts
 * Description: Projects canonical discussion and packet-vote state from the SQLite packet store and handles discussion writes.
 */

import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  createDiscussionPostPacket,
  createPacketVotePacket,
  createTextExcerpt,
} from '@/domain/packets/builders';
import type {
  DiscussionPostProjection,
  DiscussionQueryService,
  DiscussionReplyProjection,
  DiscussionThreadDetailProjection,
  DiscussionViewerContext,
  PacketVoteService,
  PacketVoteSummary,
} from '@/domain/core/contracts';
import { PERSONAL_TREE_PACKET_IDS } from '@/domain/packets/seeds';
import type {
  DiscussionActorClass,
  DiscussionReplySort,
  DiscussionSort,
  PacketEnvelope,
  PacketEnvelopeByType,
  PacketRef,
  PacketVoteValue,
} from '@/domain/schema/packet-schema';
import {
  ANONYMOUS_ACTOR_KEY_PREFIX,
  createAnonymousActorKey,
} from '@/lib/nexus/anonymous-session';
import {
  createAnonymousSessionExternalRef,
  type AnonymousSession,
} from '@/lib/nexus/visitor-lobby';
import type {
  DiscussionActorLedgerRecord,
  DiscussionPostIndexRecord,
  PacketVoteIndexRecord,
  PacketVoteTallyIndexRecord,
} from '@/storage/sqlite-records';
import { NodeSQLitePacketStore } from '@/storage/node-sqlite-packet-store';

const LEGACY_SCOPE_ID_TO_PACKET_ID: Record<string, string> = {
  global: PERSONAL_TREE_PACKET_IDS.global_commons,
  'global-commons': PERSONAL_TREE_PACKET_IDS.global_commons,
  'united-states': PERSONAL_TREE_PACKET_IDS.united_states,
  california: PERSONAL_TREE_PACKET_IDS.california,
  'moreno-valley': PERSONAL_TREE_PACKET_IDS.moreno_valley,
  'sunnymead-ranch': PERSONAL_TREE_PACKET_IDS.sunnymead_ranch,
};

const DISCUSSION_FORUM_DISPLAY_ORDER = [
  'visitor-lobby',
  'general',
  'proposals',
  'reports',
] as const;

const REDDIT_EPOCH_SECONDS = 1134028003;
const HOT_SCORE_DECAY_SECONDS = 45000;
const ANONYMOUS_TESTING_STARTING_POINTS = 10;

type ScopeNode = {
  routeId: string;
  packetId: string;
  name: string;
  subtype: string | null;
  parentRouteId: string | null;
};

type ScopeLens = {
  authority_scope_ref: PacketRef | null;
  applicable_scope_refs: PacketRef[];
};

type DiscussionState = {
  packetMap: Map<string, PacketEnvelope>;
  scopeMap: Map<string, ScopeNode>;
  threadMap: Map<string, PacketEnvelopeByType['DiscussionThread']>;
  postMap: Map<string, PacketEnvelopeByType['DiscussionPost']>;
  voteSummaryByTarget: Map<string, Omit<PacketVoteSummary, 'viewer_value'>>;
  viewerVotesByActor: Map<string, Map<string, PacketVoteValue>>;
  postIndexByPacketId: Map<string, DiscussionPostIndexRecord>;
  actorLedgerByKey: Map<string, DiscussionActorLedgerRecord>;
  voteIndexRows: PacketVoteIndexRecord[];
  voteTallyRows: PacketVoteTallyIndexRecord[];
  discussionIndexRows: DiscussionPostIndexRecord[];
  ledgerRows: DiscussionActorLedgerRecord[];
};

type DiscussionPostWriteInput = {
  scope_id: string;
  thread_packet_id: string;
  title: string;
  body: string;
  session: AnonymousSession;
};

type DiscussionReplyWriteInput = {
  scope_id: string;
  parent_post_packet_id: string;
  body: string;
  session: AnonymousSession;
};

type VisibleForumEntry = {
  forumId: string;
  threadPacket: PacketEnvelopeByType['DiscussionThread'];
  displayTitle: string;
};

type VoteAggregate = {
  upvote_count: number;
  downvote_count: number;
  net_score: number;
  total_votes: number;
  negative_ratio: number;
  auto_hidden: boolean;
  deprioritized: boolean;
};

type ActorIdentity = {
  actor_key: string | null;
  actor_class: DiscussionActorClass;
};

type EffectiveParticipationRules = {
  top_level_actor_classes: DiscussionActorClass[];
  reply_actor_classes: DiscussionActorClass[];
  reaction_actor_classes: DiscussionActorClass[];
  top_level_post_cost: number;
};

function decodeScopeId(scopeId: string): string {
  try {
    return decodeURIComponent(scopeId);
  } catch {
    return scopeId;
  }
}

/**
 * Inputs: a packet id.
 * Output: a route-safe scope slug when the packet is an element.
 */
function toRouteScopeId(packetId: string): string {
  if (packetId.startsWith('nexus:element/')) {
    return packetId.slice('nexus:element/'.length);
  }

  return packetId.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

/**
 * Inputs: a requested route or packet scope id.
 * Output: the canonical element packet id used for packet writes and lookups.
 */
function resolveScopePacketId(
  requestedScopeId: string,
  scopeMap: Map<string, ScopeNode>
): string {
  const decodedScopeId = decodeScopeId(requestedScopeId).trim();

  if (decodedScopeId.startsWith('nexus:element/')) {
    return decodedScopeId;
  }

  const scopeNode = scopeMap.get(decodedScopeId);

  if (scopeNode) {
    return scopeNode.packetId;
  }

  const normalizedScopeId = decodedScopeId.toLowerCase();

  return (
    LEGACY_SCOPE_ID_TO_PACKET_ID[decodedScopeId] ??
    LEGACY_SCOPE_ID_TO_PACKET_ID[normalizedScopeId] ??
    `nexus:element/${decodedScopeId}`
  );
}

/**
 * Inputs: a scope id and scope graph.
 * Output: the authority and parent-chain refs used by scope-aware forum inheritance.
 */
function buildScopeLens(
  scopeId: string,
  scopeMap: Map<string, ScopeNode>
): ScopeLens {
  const normalizedScopeId = decodeScopeId(scopeId).trim();
  const scopeNode = scopeMap.get(normalizedScopeId);
  const authorityPacketId =
    scopeNode?.packetId ?? resolveScopePacketId(normalizedScopeId, scopeMap);
  const applicable_scope_refs: PacketRef[] = [{ packet_id: authorityPacketId }];
  const visitedRouteIds = new Set<string>(
    scopeNode ? [scopeNode.routeId] : [normalizedScopeId]
  );
  let currentParentRouteId = scopeNode?.parentRouteId ?? null;

  while (currentParentRouteId && !visitedRouteIds.has(currentParentRouteId)) {
    const parentNode = scopeMap.get(currentParentRouteId);

    if (!parentNode) {
      break;
    }

    applicable_scope_refs.push({ packet_id: parentNode.packetId });
    visitedRouteIds.add(currentParentRouteId);
    currentParentRouteId = parentNode.parentRouteId;
  }

  return {
    authority_scope_ref: { packet_id: authorityPacketId },
    applicable_scope_refs,
  };
}

/**
 * Inputs: a discussion packet and scope lens.
 * Output: whether that packet is visible in the current scope chain.
 */
function matchesScopeLens(
  packet:
    | PacketEnvelopeByType['DiscussionThread']
    | PacketEnvelopeByType['DiscussionPost'],
  lens: ScopeLens
): boolean {
  const visibleScopeIds = new Set(
    [
      lens.authority_scope_ref?.packet_id ?? null,
      ...lens.applicable_scope_refs.map((scopeRef) => scopeRef.packet_id),
    ].filter((scopeId): scopeId is string => typeof scopeId === 'string')
  );

  if (visibleScopeIds.size === 0) {
    return true;
  }

  if (
    packet.header.authority_scope_ref &&
    visibleScopeIds.has(packet.header.authority_scope_ref.packet_id)
  ) {
    return true;
  }

  return packet.header.applicable_scope_refs.some((scopeRef) =>
    visibleScopeIds.has(scopeRef.packet_id)
  );
}

/**
 * Inputs: a thread packet and scope lens.
 * Output: the inheritance rank for forum selection, where lower values are preferred.
 */
function getThreadScopeRank(
  threadPacket: PacketEnvelopeByType['DiscussionThread'],
  lens: ScopeLens
): number {
  const authorityPacketId = threadPacket.header.authority_scope_ref?.packet_id ?? null;

  if (!authorityPacketId) {
    return lens.applicable_scope_refs.length + 1;
  }

  const authorityIndex = lens.applicable_scope_refs.findIndex(
    (scopeRef) => scopeRef.packet_id === authorityPacketId
  );

  return authorityIndex >= 0 ? authorityIndex : lens.applicable_scope_refs.length + 1;
}

/**
 * Inputs: a thread kind string.
 * Output: a stable route-safe forum id.
 */
function toDiscussionForumId(threadKind: string): string {
  const normalizedThreadKind = threadKind.trim().toLowerCase();

  if (normalizedThreadKind === 'visitor_lobby') {
    return 'visitor-lobby';
  }

  return normalizedThreadKind.replace(/[^a-z0-9]+/g, '-');
}

/**
 * Inputs: a forum id.
 * Output: the UI sort rank for stable tab ordering.
 */
function getDiscussionForumOrder(forumId: string): number {
  const orderIndex = DISCUSSION_FORUM_DISPLAY_ORDER.indexOf(
    forumId as (typeof DISCUSSION_FORUM_DISPLAY_ORDER)[number]
  );

  return orderIndex >= 0 ? orderIndex : DISCUSSION_FORUM_DISPLAY_ORDER.length;
}

/**
 * Inputs: a forum id, scope name, and thread title.
 * Output: the scope-aware forum title rendered in the discussions tabs.
 */
function getDiscussionForumDisplayTitle(
  forumId: string,
  scopeName: string,
  sourceTitle: string
): string {
  if (forumId === 'visitor-lobby') {
    return `${scopeName} visitor lobby`;
  }

  if (forumId === 'general') {
    return `${scopeName} general`;
  }

  if (forumId === 'proposals') {
    return `${scopeName} proposals`;
  }

  if (forumId === 'reports') {
    return `${scopeName} reports and AARs`;
  }

  return sourceTitle;
}

/**
 * Inputs: a packet envelope.
 * Output: the stable actor key used for vote ownership, points, and viewer-specific projections.
 */
function getActorKeyFromPacket(packet: PacketEnvelope): string | null {
  const createdByPacketId = packet.header.provenance.created_by?.packet_id ?? null;

  if (createdByPacketId) {
    return `element:${createdByPacketId}`;
  }

  const anonymousSessionRef = packet.header.external_refs.find(
    (externalRef) => externalRef.adapter === 'anonymous-session'
  );

  if (anonymousSessionRef) {
    return createAnonymousActorKey(anonymousSessionRef.ref_id);
  }

  return null;
}

/**
 * Inputs: a packet envelope plus packet map for identity lookup.
 * Output: the best available human-readable author label.
 */
function getAuthorLabel(
  packet: PacketEnvelope,
  packetMap: Map<string, PacketEnvelope>
): string {
  const createdByPacketId = packet.header.provenance.created_by?.packet_id ?? null;

  if (createdByPacketId) {
    const createdByPacket = packetMap.get(createdByPacketId);

    if (createdByPacket?.header.family === 'Element') {
      return (createdByPacket as PacketEnvelopeByType['Element']).body.name;
    }
  }

  const anonymousSessionRef = packet.header.external_refs.find(
    (externalRef) => externalRef.adapter === 'anonymous-session'
  );
  const shortLabel = anonymousSessionRef?.metadata.short_label;

  if (typeof shortLabel === 'string' && shortLabel.trim().length > 0) {
    return shortLabel;
  }

  return 'Anonymous guest';
}

/**
 * Inputs: a viewer actor key.
 * Output: the current actor class, using anonymous guests and generic scope members as the v1 split.
 */
function getActorIdentity(actorKey: string | null): ActorIdentity {
  if (!actorKey || actorKey.startsWith(ANONYMOUS_ACTOR_KEY_PREFIX)) {
    return {
      actor_key: actorKey,
      actor_class: 'anonymous_guest',
    };
  }

  return {
    actor_key: actorKey,
    actor_class: 'scope_member',
  };
}

/**
 * Inputs: a packet id.
 * Output: a short slug safe to embed into packet ids.
 */
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

/**
 * Inputs: a target packet id and actor key.
 * Output: the stable logical packet id for a universal packet vote.
 */
function createPacketVotePacketId(targetPacketId: string, actorKey: string): string {
  const digest = createHash('sha256')
    .update(`${targetPacketId}|${actorKey}|packet_signal`)
    .digest('hex')
    .slice(0, 12);

  return `nexus:packet-vote/${createPacketSlug(targetPacketId, 36)}-${digest}`;
}

/**
 * Inputs: a packet id and current preferred revision.
 * Output: the next monotonic revision id for that packet.
 */
function createNextRevisionId(
  packetId: string,
  currentRevisionId?: string | null
): string {
  const currentRevisionNumber =
    currentRevisionId?.match(/@r(\d+)$/)?.[1] ?? null;
  const nextRevisionNumber =
    currentRevisionNumber === null ? 1 : Number(currentRevisionNumber) + 1;

  return `${packetId}@r${nextRevisionNumber}`;
}

/**
 * Inputs: scope packet id, thread packet id, and timestamp.
 * Output: a unique discussion post packet id for a new top-level post or reply.
 */
function createDiscussionPostPacketId(input: {
  scopePacketId: string;
  threadPacketId: string;
  createdAt: string;
}): string {
  const compactTimestamp = input.createdAt.replace(/[^0-9]/g, '').slice(0, 14);
  const randomSuffix = randomUUID().replace(/-/g, '').slice(0, 8);

  return `nexus:discussion-post/${createPacketSlug(
    input.scopePacketId,
    20
  )}-${createPacketSlug(input.threadPacketId, 24)}-${compactTimestamp}-${randomSuffix}`;
}

/**
 * Inputs: a vote tally.
 * Output: a controversial sort score that favors balanced disagreement with enough volume.
 */
function getControversialScore(voteSummary: VoteAggregate): number {
  if (voteSummary.total_votes < 5) {
    return Number.NEGATIVE_INFINITY;
  }

  const disagreement = Math.abs(
    voteSummary.upvote_count - voteSummary.downvote_count
  );
  const balanceFactor =
    Math.min(voteSummary.upvote_count, voteSummary.downvote_count) /
    Math.max(voteSummary.total_votes, 1);

  return balanceFactor * voteSummary.total_votes - disagreement * 0.1;
}

/**
 * Inputs: a vote tally and post timestamp.
 * Output: a Reddit-style hot score using net score and time decay.
 */
function getHotScore(voteSummary: VoteAggregate, createdAt: string): number {
  const score = voteSummary.net_score;
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const seconds =
    Math.floor(new Date(createdAt).getTime() / 1000) - REDDIT_EPOCH_SECONDS;

  return sign * order + seconds / HOT_SCORE_DECAY_SECONDS;
}

/**
 * Inputs: a packet family.
 * Output: whether negative tallies should drive auto-hide and deprioritization.
 */
function isModeratedContentFamily(family: PacketEnvelope['header']['family']): boolean {
  return family === 'DiscussionPost';
}

/**
 * Inputs: a packet vote aggregate and target packet family.
 * Output: moderation flags computed from the current vote totals.
 */
function applyModerationThresholds(
  voteSummary: VoteAggregate,
  targetFamily: PacketEnvelope['header']['family'] | null
): VoteAggregate {
  if (!targetFamily || !isModeratedContentFamily(targetFamily)) {
    return {
      ...voteSummary,
      auto_hidden: false,
      deprioritized: false,
    };
  }

  return {
    ...voteSummary,
    auto_hidden:
      voteSummary.total_votes >= 6 && voteSummary.negative_ratio >= 0.75,
    deprioritized:
      voteSummary.total_votes >= 4 && voteSummary.net_score <= -2,
  };
}

/**
 * Inputs: a post body string.
 * Output: a fallback title for untitled posts and replies.
 */
function createFallbackDiscussionTitle(
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

/**
 * Inputs: a viewer actor key and tally summary.
 * Output: the viewer-specific vote summary shape returned to clients.
 */
function createVoteSummary(
  voteSummary: Omit<PacketVoteSummary, 'viewer_value'> | undefined,
  viewerValue: PacketVoteValue | 0
): PacketVoteSummary {
  return {
    upvote_count: voteSummary?.upvote_count ?? 0,
    downvote_count: voteSummary?.downvote_count ?? 0,
    net_score: voteSummary?.net_score ?? 0,
    total_votes: voteSummary?.total_votes ?? 0,
    negative_ratio: voteSummary?.negative_ratio ?? 0,
    auto_hidden: voteSummary?.auto_hidden ?? false,
    deprioritized: voteSummary?.deprioritized ?? false,
    viewer_value: viewerValue,
  };
}

/**
 * Inputs: a discussion thread packet.
 * Output: the active participation rules, including compatibility defaults for older seed revisions.
 */
function getEffectiveParticipationRules(
  threadPacket: PacketEnvelopeByType['DiscussionThread']
): EffectiveParticipationRules {
  const configuredRules = threadPacket.body.participation_rules;
  const hasConfiguredActors =
    configuredRules.top_level_actor_classes.length > 0 ||
    configuredRules.reply_actor_classes.length > 0 ||
    configuredRules.reaction_actor_classes.length > 0;

  if (hasConfiguredActors) {
    return {
      top_level_actor_classes: [...configuredRules.top_level_actor_classes],
      reply_actor_classes: [...configuredRules.reply_actor_classes],
      reaction_actor_classes: [...configuredRules.reaction_actor_classes],
      top_level_post_cost: configuredRules.top_level_post_cost,
    };
  }

  if (threadPacket.body.thread_kind === 'visitor_lobby') {
    return {
      top_level_actor_classes: ['anonymous_guest'],
      reply_actor_classes: ['anonymous_guest'],
      reaction_actor_classes: ['anonymous_guest'],
      top_level_post_cost: 10,
    };
  }

  return {
    top_level_actor_classes: ['scope_member', 'trusted_member', 'steward'],
    reply_actor_classes: ['scope_member', 'trusted_member', 'steward'],
    reaction_actor_classes: ['scope_member', 'trusted_member', 'steward'],
    top_level_post_cost: 10,
  };
}

/**
 * Inputs: a viewer actor identity.
 * Output: the current starting point grant before earned/spent discussion points are applied.
 */
function getStartingPointsForActor(actorIdentity: ActorIdentity): number {
  return actorIdentity.actor_class === 'anonymous_guest'
    ? ANONYMOUS_TESTING_STARTING_POINTS
    : 0;
}

/**
 * Inputs: a thread packet and actor identity.
 * Output: the viewer capability state for that thread.
 */
function createViewerContext(
  threadPacket: PacketEnvelopeByType['DiscussionThread'],
  actorIdentity: ActorIdentity,
  actorLedgerByKey: Map<string, DiscussionActorLedgerRecord>
): DiscussionViewerContext {
  const actorLedger = actorIdentity.actor_key
    ? actorLedgerByKey.get(actorIdentity.actor_key) ?? null
    : null;
  const availablePoints =
    getStartingPointsForActor(actorIdentity) +
    (actorLedger?.available_points ?? 0);
  const rules = getEffectiveParticipationRules(threadPacket);
  const actorClass = actorIdentity.actor_class;

  return {
    actor_key: actorIdentity.actor_key,
    actor_class: actorClass,
    available_points: availablePoints,
    can_create_top_level:
      rules.top_level_actor_classes.includes(actorClass) &&
      availablePoints >= rules.top_level_post_cost,
    can_reply: rules.reply_actor_classes.includes(actorClass),
    can_vote: rules.reaction_actor_classes.includes(actorClass),
  };
}

/**
 * Inputs: forum entries and requested forum id.
 * Output: the selected forum entry or the best available fallback.
 */
function selectForumEntry(
  forums: VisibleForumEntry[],
  requestedForumId: string | null
): VisibleForumEntry | null {
  if (forums.length === 0) {
    return null;
  }

  return (
    forums.find((forum) => forum.forumId === requestedForumId) ??
    forums[0]
  );
}

/**
 * Inputs: discussion posts keyed by packet id and a root post packet id.
 * Output: the canonical root id for that post tree.
 */
function resolveRootPostId(
  postsByPacketId: Map<string, PacketEnvelopeByType['DiscussionPost']>,
  postPacketId: string
): string {
  const visitedPacketIds = new Set<string>();
  let currentPost = postsByPacketId.get(postPacketId) ?? null;

  while (currentPost?.body.reply_to_ref?.packet_id) {
    const parentPacketId = currentPost.body.reply_to_ref.packet_id;

    if (visitedPacketIds.has(parentPacketId)) {
      break;
    }

    visitedPacketIds.add(parentPacketId);
    currentPost = postsByPacketId.get(parentPacketId) ?? null;

    if (!currentPost) {
      return parentPacketId;
    }
  }

  return currentPost?.header.packet_id ?? postPacketId;
}

/**
 * Inputs: a post id and child lookup map.
 * Output: direct and descendant reply counts plus last activity time for that subtree.
 */
function summarizePostTree(input: {
  postPacketId: string;
  childIdsByParent: Map<string, string[]>;
  postsByPacketId: Map<string, PacketEnvelopeByType['DiscussionPost']>;
}): {
  direct_reply_count: number;
  descendant_count: number;
  last_activity_at: string;
} {
  const childPacketIds = input.childIdsByParent.get(input.postPacketId) ?? [];
  const postPacket = input.postsByPacketId.get(input.postPacketId);
  let descendantCount = childPacketIds.length;
  let lastActivityAt = postPacket?.header.created_at ?? new Date().toISOString();

  for (const childPacketId of childPacketIds) {
    const childSummary = summarizePostTree({
      postPacketId: childPacketId,
      childIdsByParent: input.childIdsByParent,
      postsByPacketId: input.postsByPacketId,
    });

    descendantCount += childSummary.descendant_count;

    if (childSummary.last_activity_at > lastActivityAt) {
      lastActivityAt = childSummary.last_activity_at;
    }
  }

  return {
    direct_reply_count: childPacketIds.length,
    descendant_count: descendantCount,
    last_activity_at: lastActivityAt,
  };
}

/**
 * Inputs: packet store and post packet id.
 * Output: the preferred post packet when it exists and is a discussion post.
 */
async function getDiscussionPostById(
  packetStore: NodeSQLitePacketStore,
  postPacketId: string
): Promise<PacketEnvelopeByType['DiscussionPost'] | null> {
  const packet = await packetStore.fetchByPacket({ packet_id: postPacketId });

  if (!packet || packet.header.family !== 'DiscussionPost') {
    return null;
  }

  return packet as PacketEnvelopeByType['DiscussionPost'];
}

/**
 * Inputs: packet store and thread packet id.
 * Output: the preferred thread packet when it exists and is a discussion thread.
 */
async function getDiscussionThreadById(
  packetStore: NodeSQLitePacketStore,
  threadPacketId: string
): Promise<PacketEnvelopeByType['DiscussionThread'] | null> {
  const packet = await packetStore.fetchByPacket({ packet_id: threadPacketId });

  if (!packet || packet.header.family !== 'DiscussionThread') {
    return null;
  }

  return packet as PacketEnvelopeByType['DiscussionThread'];
}

/**
 * Inputs: a packet store.
 * Output: a discussion service that projects threaded posts, votes, and writer eligibility from canonical packets.
 */
export class SQLiteDiscussionService
  implements DiscussionQueryService, PacketVoteService
{
  private state: DiscussionState | null = null;

  constructor(private readonly packetStore: NodeSQLitePacketStore) {}

  /**
   * Inputs: none.
   * Output: refreshes and persists the derived discussion/vote index tables.
   */
  async syncDerivedState(): Promise<void> {
    const [
      elementPackets,
      discussionThreadPackets,
      discussionPostPackets,
      packetVotePackets,
      allPackets,
    ] = await Promise.all([
      this.packetStore.listPreferredPacketsByFamily('Element'),
      this.packetStore.listPreferredPacketsByFamily('DiscussionThread'),
      this.packetStore.listPreferredPacketsByFamily('DiscussionPost'),
      this.packetStore.listPreferredPacketsByFamily('PacketVote'),
      this.packetStore.listPreferredPackets(),
    ]);
    const packetMap = new Map(
      allPackets.map((packet) => [packet.header.packet_id, packet])
    );
    const scopeNodes: ScopeNode[] = elementPackets
      .filter((packet) => packet.body.kind === 'assembly')
      .map((packet) => ({
        routeId: toRouteScopeId(packet.header.packet_id),
        packetId: packet.header.packet_id,
        name: packet.body.name,
        subtype: packet.body.subtype ?? null,
        parentRouteId: (() => {
          const parentPacketId =
            packet.header.edges.find((edge) => edge.edge_type === 'parent_scope')
              ?.target.packet_id ?? null;

          return parentPacketId ? toRouteScopeId(parentPacketId) : null;
        })(),
      }));
    const scopeMap = new Map(scopeNodes.map((scopeNode) => [scopeNode.routeId, scopeNode]));
    const threadMap = new Map(
      discussionThreadPackets.map((packet) => [packet.header.packet_id, packet])
    );
    const postMap = new Map(
      discussionPostPackets.map((packet) => [packet.header.packet_id, packet])
    );
    const viewerVotesByActor = new Map<string, Map<string, PacketVoteValue>>();
    const voteIndexRows: PacketVoteIndexRecord[] = [];
    const rawVoteSummaryByTarget = new Map<string, VoteAggregate>();

    for (const votePacket of packetVotePackets) {
      const actorKey = getActorKeyFromPacket(votePacket);

      if (!actorKey) {
        continue;
      }

      voteIndexRows.push({
        vote_packet_id: votePacket.header.packet_id,
        target_packet_id: votePacket.body.target_ref.packet_id,
        actor_key: actorKey,
        vote_kind: votePacket.body.vote_kind,
        value: votePacket.body.value,
        status: votePacket.body.status,
        created_at: votePacket.header.created_at,
        updated_at: votePacket.header.created_at,
      });

      if (votePacket.body.status !== 'active') {
        continue;
      }

      const currentAggregate =
        rawVoteSummaryByTarget.get(votePacket.body.target_ref.packet_id) ?? {
          upvote_count: 0,
          downvote_count: 0,
          net_score: 0,
          total_votes: 0,
          negative_ratio: 0,
          auto_hidden: false,
          deprioritized: false,
        };

      if (votePacket.body.value === 1) {
        currentAggregate.upvote_count += 1;
      } else {
        currentAggregate.downvote_count += 1;
      }

      currentAggregate.net_score =
        currentAggregate.upvote_count - currentAggregate.downvote_count;
      currentAggregate.total_votes =
        currentAggregate.upvote_count + currentAggregate.downvote_count;
      currentAggregate.negative_ratio =
        currentAggregate.total_votes === 0
          ? 0
          : currentAggregate.downvote_count / currentAggregate.total_votes;
      rawVoteSummaryByTarget.set(
        votePacket.body.target_ref.packet_id,
        currentAggregate
      );

      const actorVotes = viewerVotesByActor.get(actorKey) ?? new Map<string, PacketVoteValue>();
      actorVotes.set(votePacket.body.target_ref.packet_id, votePacket.body.value);
      viewerVotesByActor.set(actorKey, actorVotes);
    }

    const voteSummaryByTarget = new Map<string, Omit<PacketVoteSummary, 'viewer_value'>>();
    const voteTallyRows: PacketVoteTallyIndexRecord[] = [];

    for (const [targetPacketId, rawVoteSummary] of rawVoteSummaryByTarget.entries()) {
      const targetPacket = packetMap.get(targetPacketId) ?? null;
      const moderatedSummary = applyModerationThresholds(
        rawVoteSummary,
        targetPacket?.header.family ?? null
      );

      voteSummaryByTarget.set(targetPacketId, {
        upvote_count: moderatedSummary.upvote_count,
        downvote_count: moderatedSummary.downvote_count,
        net_score: moderatedSummary.net_score,
        total_votes: moderatedSummary.total_votes,
        negative_ratio: moderatedSummary.negative_ratio,
        auto_hidden: moderatedSummary.auto_hidden,
        deprioritized: moderatedSummary.deprioritized,
      });

      voteTallyRows.push({
        target_packet_id: targetPacketId,
        upvote_count: moderatedSummary.upvote_count,
        downvote_count: moderatedSummary.downvote_count,
        net_score: moderatedSummary.net_score,
        total_votes: moderatedSummary.total_votes,
        negative_ratio: moderatedSummary.negative_ratio,
        auto_hidden: Number(moderatedSummary.auto_hidden),
        deprioritized: Number(moderatedSummary.deprioritized),
      });
    }

    const childIdsByParent = new Map<string, string[]>();

    for (const postPacket of discussionPostPackets) {
      const parentPacketId = postPacket.body.reply_to_ref?.packet_id ?? null;

      if (!parentPacketId) {
        continue;
      }

      const currentChildIds = childIdsByParent.get(parentPacketId) ?? [];
      currentChildIds.push(postPacket.header.packet_id);
      childIdsByParent.set(parentPacketId, currentChildIds);
    }

    const discussionIndexRows: DiscussionPostIndexRecord[] = [];
    const postIndexByPacketId = new Map<string, DiscussionPostIndexRecord>();

    for (const postPacket of discussionPostPackets) {
      const rootPostPacketId = resolveRootPostId(
        postMap,
        postPacket.header.packet_id
      );
      let depth = 0;
      let currentParentPacketId = postPacket.body.reply_to_ref?.packet_id ?? null;

      while (currentParentPacketId) {
        depth += 1;
        currentParentPacketId =
          postMap.get(currentParentPacketId)?.body.reply_to_ref?.packet_id ?? null;
      }

      const postTreeSummary = summarizePostTree({
        postPacketId: postPacket.header.packet_id,
        childIdsByParent,
        postsByPacketId: postMap,
      });
      const discussionIndexRecord: DiscussionPostIndexRecord = {
        post_packet_id: postPacket.header.packet_id,
        thread_packet_id: postPacket.body.thread_ref.packet_id,
        root_post_packet_id: rootPostPacketId,
        reply_to_packet_id: postPacket.body.reply_to_ref?.packet_id ?? null,
        depth,
        author_key: getActorKeyFromPacket(postPacket),
        created_at: postPacket.header.created_at,
        last_activity_at: postTreeSummary.last_activity_at,
        direct_reply_count: postTreeSummary.direct_reply_count,
        descendant_count: postTreeSummary.descendant_count,
      };

      discussionIndexRows.push(discussionIndexRecord);
      postIndexByPacketId.set(postPacket.header.packet_id, discussionIndexRecord);
    }

    const actorLedgerByKey = new Map<string, DiscussionActorLedgerRecord>();

    for (const postPacket of discussionPostPackets) {
      const actorKey = getActorKeyFromPacket(postPacket);

      if (!actorKey) {
        continue;
      }

      const currentLedger = actorLedgerByKey.get(actorKey) ?? {
        actor_key: actorKey,
        earned_reply_points: 0,
        spent_top_level_points: 0,
        available_points: 0,
        negative_content_count: 0,
        trust_signal_score: 0,
        last_activity_at: null,
      };
      const voteSummary = voteSummaryByTarget.get(postPacket.header.packet_id);
      const netScore = voteSummary?.net_score ?? 0;
      const threadPacket = threadMap.get(postPacket.body.thread_ref.packet_id) ?? null;
      const participationRules = threadPacket
        ? getEffectiveParticipationRules(threadPacket)
        : null;

      if (postPacket.body.reply_to_ref) {
        currentLedger.earned_reply_points += Math.max(netScore, 0);
      } else if (participationRules) {
        currentLedger.spent_top_level_points += participationRules.top_level_post_cost;
      }

      if (netScore < 0) {
        currentLedger.negative_content_count += 1;
      }

      currentLedger.trust_signal_score += netScore;

      if (
        !currentLedger.last_activity_at ||
        postPacket.header.created_at > currentLedger.last_activity_at
      ) {
        currentLedger.last_activity_at = postPacket.header.created_at;
      }

      currentLedger.available_points =
        currentLedger.earned_reply_points - currentLedger.spent_top_level_points;
      actorLedgerByKey.set(actorKey, currentLedger);
    }

    const ledgerRows = Array.from(actorLedgerByKey.values());

    this.state = {
      packetMap,
      scopeMap,
      threadMap,
      postMap,
      voteSummaryByTarget,
      viewerVotesByActor,
      postIndexByPacketId,
      actorLedgerByKey,
      voteIndexRows,
      voteTallyRows,
      discussionIndexRows,
      ledgerRows,
    };

    this.persistDerivedState({
      voteIndexRows,
      voteTallyRows,
      discussionIndexRows,
      ledgerRows,
    });
  }

  /**
   * Inputs: discussion feed query input.
   * Output: forum tabs, viewer capabilities, and top-level post projections for that scope.
   */
  async getForumFeed(input: {
    scope_id: string;
    forum_id: string | null;
    sort: DiscussionSort | null;
    show_hidden: boolean;
    viewer_actor_key: string | null;
  }) {
    await this.syncDerivedState();

    if (!this.state) {
      throw new Error('Discussion state is unavailable.');
    }

    const scopeLens = buildScopeLens(input.scope_id, this.state.scopeMap);
    const scopePacketId = scopeLens.authority_scope_ref?.packet_id ?? null;
    const activeScopeNode = Array.from(this.state.scopeMap.values()).find(
      (scopeNode) => scopeNode.packetId === scopePacketId
    );
    const activeScopeName = activeScopeNode?.name ?? 'Scope';
    const forumEntries = this.getVisibleForums(scopeLens, activeScopeName);
    const selectedForum = selectForumEntry(forumEntries, input.forum_id);

    if (!selectedForum) {
      return {
        lens: scopeLens,
        forums: [],
        selected_forum_id: input.forum_id ?? 'visitor-lobby',
        selected_sort: 'new' as DiscussionSort,
        show_hidden: input.show_hidden,
        viewer: {
          actor_key: input.viewer_actor_key,
          actor_class: 'anonymous_guest' as DiscussionActorClass,
          available_points: 0,
          can_create_top_level: false,
          can_reply: false,
          can_vote: false,
        },
        top_level_posts: [],
      };
    }

    const actorIdentity = getActorIdentity(input.viewer_actor_key);
    const viewer = createViewerContext(
      selectedForum.threadPacket,
      actorIdentity,
      this.state.actorLedgerByKey
    );
    const selectedSort =
      input.sort ?? selectedForum.threadPacket.body.default_sort ?? 'new';
    const topLevelPosts = Array.from(this.state.postMap.values())
      .filter(
        (postPacket) =>
          postPacket.body.thread_ref.packet_id ===
            selectedForum.threadPacket.header.packet_id &&
          !postPacket.body.reply_to_ref
      )
      .map((postPacket) =>
        this.toDiscussionPostProjection(postPacket, actorIdentity.actor_key)
      )
      .filter((postProjection) => input.show_hidden || !postProjection.is_hidden)
      .sort((leftPost, rightPost) =>
        this.comparePosts(leftPost, rightPost, selectedSort)
      );

    return {
      lens: scopeLens,
      forums: forumEntries.map((forumEntry) =>
        this.toDiscussionForumProjection(
          forumEntry.threadPacket,
          forumEntry.displayTitle
        )
      ),
      selected_forum_id: selectedForum.forumId,
      selected_sort: selectedSort,
      show_hidden: input.show_hidden,
      viewer,
      top_level_posts: topLevelPosts,
    };
  }

  /**
   * Inputs: discussion thread-detail query input.
   * Output: one root post plus its nested replies for the selected scope and reply sort.
   */
  async getThreadDetail(input: {
    scope_id: string;
    post_packet_id: string;
    reply_sort: DiscussionReplySort | null;
    show_hidden: boolean;
    viewer_actor_key: string | null;
  }): Promise<DiscussionThreadDetailProjection> {
    await this.syncDerivedState();

    if (!this.state) {
      throw new Error('Discussion state is unavailable.');
    }

    const rootPostPacket = this.state.postMap.get(input.post_packet_id);

    if (!rootPostPacket) {
      throw new Error(`Unknown discussion post: ${input.post_packet_id}`);
    }

    const scopeLens = buildScopeLens(input.scope_id, this.state.scopeMap);
    const scopePacketId = scopeLens.authority_scope_ref?.packet_id ?? null;
    const activeScopeNode = Array.from(this.state.scopeMap.values()).find(
      (scopeNode) => scopeNode.packetId === scopePacketId
    );
    const activeScopeName = activeScopeNode?.name ?? 'Scope';
    const forumId = toDiscussionForumId(
      this.state.threadMap.get(rootPostPacket.body.thread_ref.packet_id)?.body
        .thread_kind ?? 'general'
    );
    const forumEntries = this.getVisibleForums(scopeLens, activeScopeName);
    const matchingForum =
      forumEntries.find((forumEntry) => forumEntry.forumId === forumId) ??
      forumEntries.find(
        (forumEntry) =>
          forumEntry.threadPacket.header.packet_id ===
          rootPostPacket.body.thread_ref.packet_id
      );

    if (!matchingForum) {
      throw new Error(`Unknown discussion forum for post ${input.post_packet_id}.`);
    }

    const actorIdentity = getActorIdentity(input.viewer_actor_key);
    const viewer = createViewerContext(
      matchingForum.threadPacket,
      actorIdentity,
      this.state.actorLedgerByKey
    );
    const selectedReplySort = input.reply_sort ?? 'top';
    const rootPostProjection = this.toDiscussionPostProjection(
      rootPostPacket,
      actorIdentity.actor_key
    );
    const nestedReplies = this.buildReplyTree({
      rootPostPacketId: rootPostPacket.header.packet_id,
      replySort: selectedReplySort,
      showHidden: input.show_hidden,
      viewerActorKey: actorIdentity.actor_key,
    });

    return {
      lens: scopeLens,
      forum: this.toDiscussionForumProjection(
        matchingForum.threadPacket,
        matchingForum.displayTitle
      ),
      selected_reply_sort: selectedReplySort,
      show_hidden: input.show_hidden,
      viewer,
      root_post: rootPostProjection,
      replies: nestedReplies,
    };
  }

  /**
   * Inputs: a universal packet-vote mutation.
   * Output: the refreshed tally summary for the target packet and current viewer.
   */
  async setPacketVote(input: {
    target_packet_id: string;
    actor_key: string;
    actor_class: DiscussionActorClass;
    authority_scope_id: string | null;
    value: PacketVoteValue | 0;
    session?: AnonymousSession;
  }): Promise<PacketVoteSummary> {
    await this.syncDerivedState();

    const targetPacket = await this.packetStore.fetchByPacket({
      packet_id: input.target_packet_id,
    });

    if (!targetPacket) {
      throw new Error(`Unknown vote target: ${input.target_packet_id}`);
    }

    if (targetPacket.header.family === 'DiscussionPost') {
      const discussionPost = targetPacket as PacketEnvelopeByType['DiscussionPost'];
      const discussionThread = await getDiscussionThreadById(
        this.packetStore,
        discussionPost.body.thread_ref.packet_id
      );

      if (!discussionThread) {
        throw new Error(
          `Missing discussion thread for post ${input.target_packet_id}.`
        );
      }

      if (
        !getEffectiveParticipationRules(discussionThread).reaction_actor_classes.includes(
          input.actor_class
        )
      ) {
        throw new Error('Voting is not open to your current actor class here.');
      }
    } else if (input.actor_class === 'anonymous_guest') {
      throw new Error(
        'Anonymous packet voting is only enabled for public discussion replies and posts right now.'
      );
    }

    const votePacketId = createPacketVotePacketId(
      input.target_packet_id,
      input.actor_key
    );
    const existingPreferredRevision = await this.packetStore.fetchPreferredRevision({
      packet_id: votePacketId,
    });
    const existingVotePacket =
      existingPreferredRevision === null
        ? null
        : await this.packetStore.fetchByRevision(existingPreferredRevision);

    if (input.value === 0 && !existingVotePacket) {
      await this.syncDerivedState();
      return this.getVoteSummaryForTarget(input.target_packet_id, input.actor_key);
    }

    const currentVotePacket =
      existingVotePacket?.header.family === 'PacketVote'
        ? (existingVotePacket as PacketEnvelopeByType['PacketVote'])
        : null;
    const nextVoteValue =
      input.value === 0 ? currentVotePacket?.body.value ?? 1 : input.value;
    const nextVotePacket = createPacketVotePacket({
      packet_id: votePacketId,
      revision_id: createNextRevisionId(
        votePacketId,
        existingPreferredRevision?.revision_id ?? null
      ),
      created_at: new Date().toISOString(),
      parent_revision_refs: existingPreferredRevision
        ? [existingPreferredRevision]
        : [],
      authority_scope_ref: input.authority_scope_id
        ? {
            packet_id: resolveScopePacketId(
              input.authority_scope_id,
              this.state?.scopeMap ?? new Map()
            ),
          }
        : null,
      applicable_scope_refs:
        targetPacket.header.applicable_scope_refs.length > 0
          ? targetPacket.header.applicable_scope_refs
          : targetPacket.header.authority_scope_ref
            ? [targetPacket.header.authority_scope_ref]
            : [],
      created_by: input.actor_key.startsWith('element:')
        ? {
            packet_id: input.actor_key.slice('element:'.length),
          }
        : null,
      external_refs: input.session ? [createAnonymousSessionExternalRef(input.session)] : [],
      adapter: 'nexus-web',
      metadata_tags: ['packet-vote', 'packet-signal'],
      target_ref: { packet_id: input.target_packet_id },
      value: nextVoteValue,
      status: input.value === 0 ? 'cleared' : 'active',
    });

    await this.packetStore.writeRevision(nextVotePacket);
    await this.packetStore.publishRevision({
      packet_id: nextVotePacket.header.packet_id,
      revision_id: nextVotePacket.header.revision_id,
    });
    await this.syncDerivedState();

    return this.getVoteSummaryForTarget(input.target_packet_id, input.actor_key);
  }

  /**
   * Inputs: top-level post mutation input.
   * Output: the saved post projection plus the viewer's refreshed eligibility.
   */
  async createPost(input: DiscussionPostWriteInput): Promise<{
    viewer: DiscussionViewerContext;
    post: DiscussionPostProjection;
  }> {
    await this.syncDerivedState();

    if (!this.state) {
      throw new Error('Discussion state is unavailable.');
    }

    const scopePacketId = resolveScopePacketId(input.scope_id, this.state.scopeMap);
    const threadPacket = await getDiscussionThreadById(
      this.packetStore,
      input.thread_packet_id
    );

    if (!threadPacket) {
      throw new Error(`Unknown discussion thread: ${input.thread_packet_id}`);
    }

    const actorKey = createAnonymousActorKey(input.session.session_id);
    const actorIdentity = getActorIdentity(actorKey);
    const viewer = createViewerContext(
      threadPacket,
      actorIdentity,
      this.state.actorLedgerByKey
    );
    const participationRules = getEffectiveParticipationRules(threadPacket);

    if (!viewer.can_create_top_level) {
      throw new Error(
        `You need ${participationRules.top_level_post_cost} points to start a new thread here. Reply and earn upvotes first.`
      );
    }

    const createdAt = new Date().toISOString();
    const normalizedTitle = input.title.trim();
    const postPacket = createDiscussionPostPacket({
      packet_id: createDiscussionPostPacketId({
        scopePacketId,
        threadPacketId: threadPacket.header.packet_id,
        createdAt,
      }),
      created_at: createdAt,
      authority_scope_ref: { packet_id: scopePacketId },
      applicable_scope_refs:
        threadPacket.header.applicable_scope_refs.length > 0
          ? threadPacket.header.applicable_scope_refs
          : [{ packet_id: scopePacketId }],
      adapter: 'nexus-web',
      metadata_tags: ['discussion-post', threadPacket.body.thread_kind],
      metadata_summary: createTextExcerpt(input.body),
      external_refs: [createAnonymousSessionExternalRef(input.session)],
      title:
        normalizedTitle.length > 0
          ? normalizedTitle
          : createFallbackDiscussionTitle(input.session.short_label, input.body, 'Post'),
      thread_ref: { packet_id: threadPacket.header.packet_id },
      post_kind: 'forum_post',
      content_markdown: input.body.trim(),
    });

    await this.packetStore.writeRevision(postPacket);
    await this.packetStore.publishRevision({
      packet_id: postPacket.header.packet_id,
      revision_id: postPacket.header.revision_id,
    });
    await this.syncDerivedState();

    const nextViewer = createViewerContext(
      threadPacket,
      actorIdentity,
      this.state.actorLedgerByKey
    );

    return {
      viewer: nextViewer,
      post: this.toDiscussionPostProjection(postPacket, actorIdentity.actor_key),
    };
  }

  /**
   * Inputs: reply mutation input.
   * Output: the saved reply projection plus refreshed viewer eligibility.
   */
  async createReply(input: DiscussionReplyWriteInput): Promise<{
    viewer: DiscussionViewerContext;
    post: DiscussionPostProjection;
  }> {
    await this.syncDerivedState();

    if (!this.state) {
      throw new Error('Discussion state is unavailable.');
    }

    const scopePacketId = resolveScopePacketId(input.scope_id, this.state.scopeMap);
    const parentPost = await getDiscussionPostById(
      this.packetStore,
      input.parent_post_packet_id
    );

    if (!parentPost) {
      throw new Error(`Unknown discussion post: ${input.parent_post_packet_id}`);
    }

    const threadPacket = await getDiscussionThreadById(
      this.packetStore,
      parentPost.body.thread_ref.packet_id
    );

    if (!threadPacket) {
      throw new Error(
        `Missing discussion thread for post ${input.parent_post_packet_id}.`
      );
    }

    const actorKey = createAnonymousActorKey(input.session.session_id);
    const actorIdentity = getActorIdentity(actorKey);
    const viewer = createViewerContext(
      threadPacket,
      actorIdentity,
      this.state.actorLedgerByKey
    );

    if (!viewer.can_reply) {
      throw new Error('Replies are not open to your current actor class here.');
    }

    const createdAt = new Date().toISOString();
    const replyPacket = createDiscussionPostPacket({
      packet_id: createDiscussionPostPacketId({
        scopePacketId,
        threadPacketId: threadPacket.header.packet_id,
        createdAt,
      }),
      created_at: createdAt,
      authority_scope_ref: { packet_id: scopePacketId },
      applicable_scope_refs:
        threadPacket.header.applicable_scope_refs.length > 0
          ? threadPacket.header.applicable_scope_refs
          : [{ packet_id: scopePacketId }],
      adapter: 'nexus-web',
      metadata_tags: ['discussion-reply', threadPacket.body.thread_kind],
      metadata_summary: createTextExcerpt(input.body),
      external_refs: [createAnonymousSessionExternalRef(input.session)],
      title: createFallbackDiscussionTitle(input.session.short_label, input.body, 'Reply'),
      thread_ref: { packet_id: threadPacket.header.packet_id },
      post_kind: 'reply',
      content_markdown: input.body.trim(),
      reply_to_ref: { packet_id: parentPost.header.packet_id },
    });

    await this.packetStore.writeRevision(replyPacket);
    await this.packetStore.publishRevision({
      packet_id: replyPacket.header.packet_id,
      revision_id: replyPacket.header.revision_id,
    });
    await this.syncDerivedState();

    const nextViewer = createViewerContext(
      threadPacket,
      actorIdentity,
      this.state.actorLedgerByKey
    );

    return {
      viewer: nextViewer,
      post: this.toDiscussionPostProjection(replyPacket, actorIdentity.actor_key),
    };
  }

  /**
   * Inputs: query-state tables to persist.
   * Output: replaces the derived SQLite index tables with the current canonical projection state.
   */
  private persistDerivedState(input: {
    voteIndexRows: PacketVoteIndexRecord[];
    voteTallyRows: PacketVoteTallyIndexRecord[];
    discussionIndexRows: DiscussionPostIndexRecord[];
    ledgerRows: DiscussionActorLedgerRecord[];
  }): void {
    const database = new DatabaseSync(this.packetStore.databasePath);

    try {
      database.exec('BEGIN IMMEDIATE');
      database.exec('DELETE FROM packet_vote_index');
      database.exec('DELETE FROM packet_vote_tally_index');
      database.exec('DELETE FROM discussion_post_index');
      database.exec('DELETE FROM discussion_actor_ledger');

      const insertVoteIndexStatement = database.prepare(`
        INSERT INTO packet_vote_index (
          vote_packet_id,
          target_packet_id,
          actor_key,
          vote_kind,
          value,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertVoteTallyStatement = database.prepare(`
        INSERT INTO packet_vote_tally_index (
          target_packet_id,
          upvote_count,
          downvote_count,
          net_score,
          total_votes,
          negative_ratio,
          auto_hidden,
          deprioritized
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertDiscussionIndexStatement = database.prepare(`
        INSERT INTO discussion_post_index (
          post_packet_id,
          thread_packet_id,
          root_post_packet_id,
          reply_to_packet_id,
          depth,
          author_key,
          created_at,
          last_activity_at,
          direct_reply_count,
          descendant_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertActorLedgerStatement = database.prepare(`
        INSERT INTO discussion_actor_ledger (
          actor_key,
          earned_reply_points,
          spent_top_level_points,
          available_points,
          negative_content_count,
          trust_signal_score,
          last_activity_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const row of input.voteIndexRows) {
        insertVoteIndexStatement.run(
          row.vote_packet_id,
          row.target_packet_id,
          row.actor_key,
          row.vote_kind,
          row.value,
          row.status,
          row.created_at,
          row.updated_at
        );
      }

      for (const row of input.voteTallyRows) {
        insertVoteTallyStatement.run(
          row.target_packet_id,
          row.upvote_count,
          row.downvote_count,
          row.net_score,
          row.total_votes,
          row.negative_ratio,
          row.auto_hidden,
          row.deprioritized
        );
      }

      for (const row of input.discussionIndexRows) {
        insertDiscussionIndexStatement.run(
          row.post_packet_id,
          row.thread_packet_id,
          row.root_post_packet_id,
          row.reply_to_packet_id,
          row.depth,
          row.author_key,
          row.created_at,
          row.last_activity_at,
          row.direct_reply_count,
          row.descendant_count
        );
      }

      for (const row of input.ledgerRows) {
        insertActorLedgerStatement.run(
          row.actor_key,
          row.earned_reply_points,
          row.spent_top_level_points,
          row.available_points,
          row.negative_content_count,
          row.trust_signal_score,
          row.last_activity_at
        );
      }

      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    } finally {
      database.close();
    }
  }

  /**
   * Inputs: a target packet id and viewer actor key.
   * Output: the current vote tally summary for that packet.
   */
  private getVoteSummaryForTarget(
    targetPacketId: string,
    viewerActorKey: string | null
  ): PacketVoteSummary {
    const viewerVotes = viewerActorKey
      ? this.state?.viewerVotesByActor.get(viewerActorKey)
      : null;
    const viewerValue = viewerVotes?.get(targetPacketId) ?? 0;

    return createVoteSummary(
      this.state?.voteSummaryByTarget.get(targetPacketId),
      viewerValue
    );
  }

  /**
   * Inputs: a scope lens and scope name.
   * Output: the discussion forums visible in that scope, with local threads preferred over inherited ones.
   */
  private getVisibleForums(
    scopeLens: ScopeLens,
    activeScopeName: string
  ): VisibleForumEntry[] {
    if (!this.state) {
      return [];
    }

    const winningThreadByForumId = new Map<
      string,
      {
        threadPacket: PacketEnvelopeByType['DiscussionThread'];
        rank: number;
      }
    >();

    for (const threadPacket of this.state.threadMap.values()) {
      if (!matchesScopeLens(threadPacket, scopeLens)) {
        continue;
      }

      const forumId = toDiscussionForumId(threadPacket.body.thread_kind);
      const candidateRank = getThreadScopeRank(threadPacket, scopeLens);
      const currentWinner = winningThreadByForumId.get(forumId);

      if (!currentWinner || candidateRank < currentWinner.rank) {
        winningThreadByForumId.set(forumId, {
          threadPacket,
          rank: candidateRank,
        });
        continue;
      }

      if (candidateRank === currentWinner.rank) {
        const createdAtComparison = threadPacket.header.created_at.localeCompare(
          currentWinner.threadPacket.header.created_at
        );

        if (
          createdAtComparison < 0 ||
          (createdAtComparison === 0 &&
            threadPacket.header.packet_id.localeCompare(
              currentWinner.threadPacket.header.packet_id
            ) < 0)
        ) {
          winningThreadByForumId.set(forumId, {
            threadPacket,
            rank: candidateRank,
          });
        }
      }
    }

    return Array.from(winningThreadByForumId.entries())
      .sort((leftForum, rightForum) => {
        const leftOrder = getDiscussionForumOrder(leftForum[0]);
        const rightOrder = getDiscussionForumOrder(rightForum[0]);

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return leftForum[1].threadPacket.body.title.localeCompare(
          rightForum[1].threadPacket.body.title
        );
      })
      .map(([forumId, entry]) => ({
        forumId,
        threadPacket: entry.threadPacket,
        displayTitle: getDiscussionForumDisplayTitle(
          forumId,
          activeScopeName,
          entry.threadPacket.body.title
        ),
      }));
  }

  /**
   * Inputs: a thread packet and display title.
   * Output: the API projection for one visible discussion forum.
   */
  private toDiscussionForumProjection(
    threadPacket: PacketEnvelopeByType['DiscussionThread'],
    displayTitle: string
  ) {
    return {
      id: toDiscussionForumId(threadPacket.body.thread_kind),
      title: displayTitle,
      description:
        threadPacket.body.summary ?? 'Packet-backed discussion surface.',
      cadence: threadPacket.body.status,
      public_posting: getEffectiveParticipationRules(threadPacket).top_level_actor_classes.includes(
        'anonymous_guest'
      ),
      linked_packet_label: `${threadPacket.header.family} packet`,
      thread_packet_id: threadPacket.header.packet_id,
      default_sort: threadPacket.body.default_sort,
      top_level_post_cost: getEffectiveParticipationRules(threadPacket).top_level_post_cost,
    };
  }

  /**
   * Inputs: one post packet and optional viewer actor key.
   * Output: the API projection card for that post.
   */
  private toDiscussionPostProjection(
    postPacket: PacketEnvelopeByType['DiscussionPost'],
    viewerActorKey: string | null
  ): DiscussionPostProjection {
    const postIndex = this.state?.postIndexByPacketId.get(postPacket.header.packet_id);
    const voteSummary = this.getVoteSummaryForTarget(
      postPacket.header.packet_id,
      viewerActorKey
    );

    return {
      packet: {
        packet_id: postPacket.header.packet_id,
      },
      revision: {
        packet_id: postPacket.header.packet_id,
        revision_id: postPacket.header.revision_id,
      },
      thread_ref: postPacket.body.thread_ref,
      title: postPacket.body.title,
      content_markdown: postPacket.body.content_markdown,
      excerpt: createTextExcerpt(postPacket.body.content_markdown, 180),
      author_label:
        (this.state && getAuthorLabel(postPacket, this.state.packetMap)) ||
        'Anonymous guest',
      author_key: getActorKeyFromPacket(postPacket),
      created_at: postPacket.header.created_at,
      last_activity_at:
        postIndex?.last_activity_at ?? postPacket.header.created_at,
      reply_count: postIndex?.direct_reply_count ?? 0,
      descendant_count: postIndex?.descendant_count ?? 0,
      depth: postIndex?.depth ?? 0,
      is_hidden: voteSummary.auto_hidden,
      hidden_reason: voteSummary.auto_hidden
        ? 'Hidden by the current negative-vote moderation threshold.'
        : null,
      vote_summary: voteSummary,
    };
  }

  /**
   * Inputs: a root post id and reply-tree settings.
   * Output: nested reply projections sorted at each sibling level.
   */
  private buildReplyTree(input: {
    rootPostPacketId: string;
    replySort: DiscussionReplySort;
    showHidden: boolean;
    viewerActorKey: string | null;
  }): DiscussionReplyProjection[] {
    if (!this.state) {
      return [];
    }

    const childPosts = Array.from(this.state.postMap.values()).filter(
      (postPacket) => postPacket.body.reply_to_ref?.packet_id === input.rootPostPacketId
    );
    const sortedChildPosts = childPosts
      .map((postPacket) =>
        this.toDiscussionPostProjection(postPacket, input.viewerActorKey)
      )
      .filter((postProjection) => input.showHidden || !postProjection.is_hidden)
      .sort((leftReply, rightReply) =>
        this.compareReplies(leftReply, rightReply, input.replySort)
      );

    return sortedChildPosts.map((replyProjection) => ({
      ...replyProjection,
      replies: this.buildReplyTree({
        rootPostPacketId: replyProjection.packet.packet_id,
        replySort: input.replySort,
        showHidden: input.showHidden,
        viewerActorKey: input.viewerActorKey,
      }),
    }));
  }

  /**
   * Inputs: two top-level post projections and a requested feed sort.
   * Output: sort ordering for discussion feeds.
   */
  private comparePosts(
    leftPost: DiscussionPostProjection,
    rightPost: DiscussionPostProjection,
    sort: DiscussionSort
  ): number {
    if (sort === 'old') {
      return leftPost.created_at.localeCompare(rightPost.created_at);
    }

    if (sort === 'new') {
      return rightPost.created_at.localeCompare(leftPost.created_at);
    }

    if (sort === 'active') {
      return (
        rightPost.last_activity_at.localeCompare(leftPost.last_activity_at) ||
        rightPost.created_at.localeCompare(leftPost.created_at)
      );
    }

    if (sort === 'top') {
      return (
        rightPost.vote_summary.net_score - leftPost.vote_summary.net_score ||
        rightPost.created_at.localeCompare(leftPost.created_at)
      );
    }

    if (sort === 'controversial') {
      return (
        getControversialScore(rightPost.vote_summary) -
          getControversialScore(leftPost.vote_summary) ||
        rightPost.created_at.localeCompare(leftPost.created_at)
      );
    }

    if (sort === 'most_downvoted') {
      return (
        rightPost.vote_summary.downvote_count - leftPost.vote_summary.downvote_count ||
        rightPost.vote_summary.negative_ratio - leftPost.vote_summary.negative_ratio ||
        rightPost.created_at.localeCompare(leftPost.created_at)
      );
    }

    return (
      getHotScore(rightPost.vote_summary, rightPost.created_at) -
        getHotScore(leftPost.vote_summary, leftPost.created_at) ||
      rightPost.created_at.localeCompare(leftPost.created_at)
    );
  }

  /**
   * Inputs: two reply projections and a requested reply-tree sort.
   * Output: sort ordering for nested replies.
   */
  private compareReplies(
    leftReply: DiscussionPostProjection,
    rightReply: DiscussionPostProjection,
    sort: DiscussionReplySort
  ): number {
    if (sort === 'old') {
      return leftReply.created_at.localeCompare(rightReply.created_at);
    }

    if (sort === 'new') {
      return rightReply.created_at.localeCompare(leftReply.created_at);
    }

    if (sort === 'controversial') {
      return (
        getControversialScore(rightReply.vote_summary) -
          getControversialScore(leftReply.vote_summary) ||
        rightReply.created_at.localeCompare(leftReply.created_at)
      );
    }

    return (
      rightReply.vote_summary.net_score - leftReply.vote_summary.net_score ||
      rightReply.created_at.localeCompare(leftReply.created_at)
    );
  }
}
