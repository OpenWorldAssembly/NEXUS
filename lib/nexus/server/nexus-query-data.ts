/**
 * File: nexus-query-data.ts
 * Description: Builds Nexus shell and route payloads from packet-store query services.
 */

import type {
  NexusScopeLens,
} from '@/domain/core/contracts';
import {
  PACKET_FAMILIES,
  type PacketEnvelopeByType,
  type PacketFamily,
} from '@/domain/schema/packet-schema';
import {
  NEXUS_COMING_SOON_SURFACES,
  NEXUS_GUEST_CAPABILITIES,
  NEXUS_GUEST_CHECKLIST,
  NEXUS_GUEST_PROFILE,
  NEXUS_VOTE_MECHANICS,
} from '@/lib/nexus/nexus-content';
import type {
  NexusDashboardPayload,
  NexusDiscussionReplyChildrenPayload,
  NexusDiscussionThreadPayload,
  NexusDiscussionsPayload,
  NexusLibraryPayload,
  NexusShellPayload,
  NexusVotesPayload,
} from '@/lib/nexus/nexus-api-types';
import type { NexusScopeSummary } from '@/lib/nexus/nexus-shell';
import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';
import type {
  DiscussionReplySort,
  DiscussionSort,
} from '@/domain/schema/packet-schema';

const DEFAULT_FOLLOWED_SCOPE_IDS = [
  'moreno-valley',
  'sunnymead-ranch',
];
const DISCUSSION_FORUM_DISPLAY_ORDER = [
  'visitor-lobby',
  'general',
  'proposals',
  'reports',
] as const;

type ScopeNode = {
  routeId: string;
  packetId: string;
  name: string;
  subtype: string | null;
  summary: string | null;
  localityLabel: string | null;
  parentRouteId: string | null;
};

/**
 * Inputs: a canonical element packet id.
 * Output: a URL-safe scope id used by nexus API routes and shell state.
 */
function toRouteScopeId(packetId: string): string {
  if (packetId.startsWith('nexus:element/')) {
    return packetId.slice('nexus:element/'.length);
  }

  return packetId.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

/**
 * Inputs: a URL-safe scope id.
 * Output: canonical element packet id fallback for unknown route ids.
 */
function toPacketScopeId(scopeId: string): string {
  return `nexus:element/${scopeId}`;
}

/**
 * Inputs: optional scope subtype from an assembly element packet.
 * Output: the UI scope level used by shell navigation.
 */
function toScopeLevel(scopeSubtype: string | null): NexusScopeSummary['level'] {
  if (scopeSubtype === 'global') {
    return 'global';
  }

  if (scopeSubtype === 'nation') {
    return 'nation';
  }

  if (scopeSubtype === 'state' || scopeSubtype === 'region') {
    return 'region';
  }

  if (scopeSubtype === 'city') {
    return 'city';
  }

  return 'district';
}

/**
 * Inputs: scope name and subtype.
 * Output: compact short label used in sidebar rows and badges.
 */
function toScopeShortLabel(name: string, subtype: string | null): string {
  if (subtype === 'global') {
    return 'Global';
  }

  if (name === 'United States') {
    return 'U.S.';
  }

  if (name === 'California') {
    return 'CA';
  }

  const words = name.split(' ').filter((word) => word.length > 0);

  if (words.length === 1) {
    return words[0];
  }

  return words[0];
}

/**
 * Inputs: status text from proposal/vote/decision cards.
 * Output: normalized vote-stage bucket id.
 */
function toStatusCategory(status: string | null): 'petitioning' | 'under_review' | 'up_for_vote' | 'completed' {
  const normalizedStatus = (status ?? '').trim().toLowerCase();

  if (
    normalizedStatus.includes('petition') ||
    normalizedStatus.includes('support')
  ) {
    return 'petitioning';
  }

  if (normalizedStatus.includes('review')) {
    return 'under_review';
  }

  if (
    normalizedStatus.includes('vote') ||
    normalizedStatus.includes('open') ||
    normalizedStatus.includes('ballot')
  ) {
    return 'up_for_vote';
  }

  return 'completed';
}

/**
 * Inputs: status text from a vote-related card.
 * Output: whether that card should be treated as active/open.
 */
function isOpenVoteStatus(status: string | null): boolean {
  return toStatusCategory(status) !== 'completed';
}

/**
 * Inputs: target scope id and scope graph map.
 * Output: authority and applicable refs used for scope-lens query filtering.
 */
function buildScopeLens(
  scopeId: string,
  scopeMap: Map<string, ScopeNode>
): NexusScopeLens {
  const scopeNode = scopeMap.get(scopeId);
  const authorityPacketId = scopeNode?.packetId ?? toPacketScopeId(scopeId);
  const applicableScopeRefs = [{ packet_id: authorityPacketId }];
  const visitedScopeIds = new Set<string>([scopeId]);
  let currentParentRouteId = scopeNode?.parentRouteId ?? null;

  while (currentParentRouteId && !visitedScopeIds.has(currentParentRouteId)) {
    const parentScopeNode = scopeMap.get(currentParentRouteId);

    if (!parentScopeNode) {
      break;
    }

    applicableScopeRefs.push({ packet_id: parentScopeNode.packetId });
    visitedScopeIds.add(currentParentRouteId);
    currentParentRouteId = parentScopeNode.parentRouteId ?? null;
  }

  return {
    authority_scope_ref: {
      packet_id: authorityPacketId,
    },
    applicable_scope_refs: applicableScopeRefs,
  };
}

/**
 * Inputs: scope summaries plus a requested scope id.
 * Output: the requested scope when present, otherwise the first scope as fallback.
 */
function getScopeByIdOrDefault(
  scopeSummaries: NexusScopeSummary[],
  scopeId: string
): NexusScopeSummary {
  return (
    scopeSummaries.find((scopeSummary) => scopeSummary.id === scopeId) ??
    scopeSummaries[0]
  );
}

/**
 * Inputs: scope lens.
 * Output: best available scope id from authority or first applicable ref.
 */
function getScopeFromLens(
  lens: NexusScopeLens
): string {
  return (
    lens.authority_scope_ref?.packet_id ??
    lens.applicable_scope_refs[0]?.packet_id ??
    ''
  );
}

/**
 * Inputs: none.
 * Output: assembly scope nodes projected from preferred `Element` packet revisions.
 */
async function listScopeNodes(): Promise<ScopeNode[]> {
  const services = await getNexusPacketServices();
  const elementPackets =
    await services.packetStore.listPreferredPacketsByFamily('Element');

  return elementPackets
    .filter((packet) => packet.body.kind === 'assembly')
    .map((packet) => ({
      routeId: toRouteScopeId(packet.header.packet_id),
      packetId: packet.header.packet_id,
      name: packet.body.name,
      subtype: packet.body.subtype ?? null,
      summary: packet.body.summary ?? null,
      localityLabel: packet.body.locality_label ?? null,
      parentRouteId: (() => {
        const parentPacketId =
          packet.header.edges.find((edge) => edge.edge_type === 'parent_scope')
            ?.target.packet_id ?? null;

        return parentPacketId ? toRouteScopeId(parentPacketId) : null;
      })(),
    }));
}

/**
 * Inputs: one scope lens.
 * Output: scope packet ids visible in that lens.
 */
function getLensScopeIds(scopeLens: NexusScopeLens): Set<string> {
  return new Set(
    [
      scopeLens.authority_scope_ref?.packet_id ?? null,
      ...scopeLens.applicable_scope_refs.map((scopeRef) => scopeRef.packet_id),
    ].filter((scopeId): scopeId is string => typeof scopeId === 'string')
  );
}

/**
 * Inputs: one packet envelope plus a scope lens.
 * Output: whether the packet is visible through that scope lens.
 */
function matchesPacketScopeLens(
  packet: PacketEnvelopeByType['DiscussionThread'],
  scopeLens: NexusScopeLens
): boolean {
  const lensScopeIds = getLensScopeIds(scopeLens);

  if (lensScopeIds.size === 0) {
    return true;
  }

  if (
    packet.header.authority_scope_ref &&
    lensScopeIds.has(packet.header.authority_scope_ref.packet_id)
  ) {
    return true;
  }

  return packet.header.applicable_scope_refs.some((scopeRef) =>
    lensScopeIds.has(scopeRef.packet_id)
  );
}

/**
 * Inputs: one discussion thread packet and scope lens.
 * Output: ranking score where lower values are preferred for forum tabs.
 */
function getThreadScopeRank(
  threadPacket: PacketEnvelopeByType['DiscussionThread'],
  scopeLens: NexusScopeLens
): number {
  const authorityScopeId = scopeLens.authority_scope_ref?.packet_id;

  if (
    authorityScopeId &&
    threadPacket.header.authority_scope_ref?.packet_id === authorityScopeId
  ) {
    return 0;
  }

  return 1;
}

/**
 * Inputs: discussion thread kind.
 * Output: stable forum id used by discussions tab routes.
 */
function toDiscussionForumId(threadKind: string): string {
  const normalizedThreadKind = threadKind.trim().toLowerCase();

  if (normalizedThreadKind === 'visitor_lobby') {
    return 'visitor-lobby';
  }

  return normalizedThreadKind.replace(/[^a-z0-9]+/g, '-');
}

/**
 * Inputs: discussion forum id.
 * Output: sort rank for stable tab ordering.
 */
function getDiscussionForumOrder(forumId: string): number {
  const orderIndex = DISCUSSION_FORUM_DISPLAY_ORDER.indexOf(
    forumId as (typeof DISCUSSION_FORUM_DISPLAY_ORDER)[number]
  );

  return orderIndex >= 0 ? orderIndex : DISCUSSION_FORUM_DISPLAY_ORDER.length;
}

/**
 * Inputs: forum id, active scope display name, and source thread title.
 * Output: a scope-aware forum title for tab rendering, while preserving unknown kinds.
 */
function getDiscussionForumDisplayTitle(
  forumId: string,
  scopeName: string,
  sourceThreadTitle: string
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

  return sourceThreadTitle;
}

/**
 * Inputs: none.
 * Output: builds the shell payload from assembly element packets and query-derived counts.
 */
export async function getNexusShellPayload(): Promise<NexusShellPayload> {
  const services = await getNexusPacketServices();
  const scopeNodes = await listScopeNodes();
  const scopeMap = new Map(
    scopeNodes.map((scopeNode) => [scopeNode.routeId, scopeNode])
  );
  const scopeSummaries: NexusScopeSummary[] = [];

  for (const scopeNode of scopeNodes) {
    const scopeLens = buildScopeLens(scopeNode.routeId, scopeMap);
    const [voteCards, discussionCards, missionCards] = await Promise.all([
      services.nexusQueryService.listVotes(scopeLens),
      services.nexusQueryService.listDiscussions(scopeLens),
      services.nexusQueryService.listLibraryPackets(scopeLens, 'MissionPlan'),
    ]);
    const memberPackets =
      await services.packetStore.listPreferredPacketsByFamily('Element');
    const membersInScope = memberPackets.filter(
      (memberPacket) =>
        memberPacket.body.kind === 'person' &&
        memberPacket.header.edges.some(
          (edge) =>
            edge.edge_type === 'member_of' &&
            edge.target.packet_id === scopeNode.packetId
        )
    );
    const childIds = scopeNodes
      .filter((candidateNode) => candidateNode.parentRouteId === scopeNode.routeId)
      .map((childNode) => childNode.routeId);
    const hasVisitorLobbyForum = discussionCards.some(
      (discussionCard) =>
        discussionCard.family === 'DiscussionForum' &&
        discussionCard.title.toLowerCase().includes('visitor lobby')
    );

    scopeSummaries.push({
      id: scopeNode.routeId,
      name: scopeNode.name,
      shortLabel: toScopeShortLabel(scopeNode.name, scopeNode.subtype),
      level: toScopeLevel(scopeNode.subtype),
      description:
        scopeNode.summary ??
        `Packet-backed assembly scope for ${scopeNode.name}.`,
      localityLabel:
        scopeNode.localityLabel ?? `${scopeNode.name} assembly locality`,
      badge: scopeNode.subtype === 'global' ? 'Guest default' : 'Assembly scope',
      relationshipLabel:
        scopeNode.parentRouteId === null
          ? 'Root assembly scope'
          : `Child of ${scopeMap.get(scopeNode.parentRouteId)?.name ?? 'parent scope'}`,
      parentId: scopeNode.parentRouteId ?? undefined,
      childIds,
      followedScopeIds: DEFAULT_FOLLOWED_SCOPE_IDS,
      publicLobbyLabel: `${scopeNode.name} visitor lobby`,
      stats: {
        members: membersInScope.length,
        activeVotes: voteCards.filter((voteCard) => isOpenVoteStatus(voteCard.status))
          .length,
        hotDiscussions: discussionCards.length,
        missions: missionCards.length,
        guestLobbyOpen: hasVisitorLobbyForum,
      },
    });
  }

  scopeSummaries.sort((leftScope, rightScope) =>
    leftScope.name.localeCompare(rightScope.name)
  );

  const defaultScopeId =
    scopeSummaries.find((scopeSummary) => scopeSummary.level === 'global')?.id ??
    scopeSummaries[0]?.id ??
    '';
  const defaultScope = getScopeByIdOrDefault(scopeSummaries, defaultScopeId);
  const defaultExpandedScopeIds = [
    defaultScope.id,
    ...scopeSummaries
      .filter((scopeSummary) => scopeSummary.parentId === defaultScope.id)
      .map((scopeSummary) => scopeSummary.id),
  ];

  return {
    scope_summaries: scopeSummaries,
    default_scope_id: defaultScope.id,
    default_expanded_scope_ids: defaultExpandedScopeIds,
    followed_scope_ids: DEFAULT_FOLLOWED_SCOPE_IDS.filter((scopeId) =>
      scopeSummaries.some((scopeSummary) => scopeSummary.id === scopeId)
    ),
    guest_profile: NEXUS_GUEST_PROFILE,
    guest_capabilities: NEXUS_GUEST_CAPABILITIES,
    guest_checklist: NEXUS_GUEST_CHECKLIST,
    coming_soon_surfaces: NEXUS_COMING_SOON_SURFACES,
  };
}

/**
 * Inputs: scope id.
 * Output: dashboard metrics, queue cards, and recommended packets for that scope lens.
 */
export async function getNexusDashboardPayload(
  scopeId: string
): Promise<NexusDashboardPayload> {
  const services = await getNexusPacketServices();
  const scopeNodes = await listScopeNodes();
  const scopeMap = new Map(
    scopeNodes.map((scopeNode) => [scopeNode.routeId, scopeNode])
  );
  const scopeLens = buildScopeLens(scopeId, scopeMap);
  const [queueCards, voteCards, discussionCards, libraryCards] = await Promise.all([
    services.nexusQueryService.getDashboardQueue(scopeLens),
    services.nexusQueryService.listVotes(scopeLens),
    services.nexusQueryService.listDiscussions(scopeLens),
    services.nexusQueryService.listLibraryPackets(scopeLens),
  ]);
  const visitorLobbyForumCount = discussionCards.filter(
    (discussionCard) =>
      discussionCard.family === 'DiscussionForum' &&
      discussionCard.title.toLowerCase().includes('visitor lobby')
  ).length;

  return {
    lens: scopeLens,
    metrics: [
      {
        id: 'packet-count',
        title: 'Packets in scope',
        value: libraryCards.length.toString(),
        detail: 'Canonical packet revisions available in this scope lens.',
        tone: 'sky',
      },
      {
        id: 'open-votes',
        title: 'Open vote lanes',
        value: voteCards.filter((voteCard) => isOpenVoteStatus(voteCard.status)).length.toString(),
        detail: 'Proposal, vote, and decision packets still in active flow.',
        tone: 'rose',
      },
      {
        id: 'discussion-lanes',
        title: 'Discussion surfaces',
        value: discussionCards.length.toString(),
        detail: 'Discussion thread and post packets visible in this scope.',
        tone: 'mint',
      },
      {
        id: 'visitor-lobbies',
        title: 'Visitor lobby forums',
        value: visitorLobbyForumCount.toString(),
        detail: 'Public visitor-lobby discussion forums currently discoverable.',
        tone: 'gold',
      },
    ],
    queue: queueCards.slice(0, 6).map((queueCard, index) => ({
      id: queueCard.packet.packet_id,
      title: queueCard.title,
      detail: queueCard.summary ?? 'No summary available yet.',
      stat: queueCard.status ?? queueCard.label,
      tone: (['sky', 'mint', 'gold', 'rose'][index % 4] ?? 'sky') as
        | 'sky'
        | 'mint'
        | 'gold'
        | 'rose',
    })),
    recommended_packets: libraryCards.slice(0, 4),
  };
}

/**
 * Inputs: discussion feed query settings.
 * Output: discussion forums and top-level feed cards for the scope lens.
 */
export async function getNexusDiscussionsPayload(input: {
  scopeId: string;
  forumId?: string | null;
  sort?: DiscussionSort | null;
  showHidden?: boolean;
  viewerActorKey?: string | null;
  cursor?: string | null;
  limit?: number | null;
}): Promise<NexusDiscussionsPayload> {
  const services = await getNexusPacketServices();

  return services.discussionService.getForumFeed({
    scope_id: input.scopeId,
    forum_id: input.forumId ?? null,
    sort: input.sort ?? null,
    show_hidden: input.showHidden ?? false,
    viewer_actor_key: input.viewerActorKey ?? null,
    cursor: input.cursor ?? null,
    limit: input.limit ?? null,
  });
}

/**
 * Inputs: discussion thread-detail query settings.
 * Output: one root post plus its nested replies for the selected scope.
 */
export async function getNexusDiscussionThreadPayload(input: {
  scopeId: string;
  postPacketId: string;
  replySort?: DiscussionReplySort | null;
  showHidden?: boolean;
  viewerActorKey?: string | null;
  cursor?: string | null;
  limit?: number | null;
}): Promise<NexusDiscussionThreadPayload> {
  const services = await getNexusPacketServices();

  return services.discussionService.getThreadDetail({
    scope_id: input.scopeId,
    post_packet_id: input.postPacketId,
    reply_sort: input.replySort ?? null,
    show_hidden: input.showHidden ?? false,
    viewer_actor_key: input.viewerActorKey ?? null,
    cursor: input.cursor ?? null,
    limit: input.limit ?? null,
  });
}

/**
 * Inputs: a scope id, parent post id, and reply paging settings.
 * Output: one page of direct child replies for that parent post.
 */
export async function getNexusDiscussionReplyChildrenPayload(input: {
  scopeId: string;
  threadPostPacketId: string;
  parentPostPacketId: string;
  replySort?: DiscussionReplySort | null;
  showHidden?: boolean;
  viewerActorKey?: string | null;
  cursor?: string | null;
  limit?: number | null;
}): Promise<NexusDiscussionReplyChildrenPayload> {
  const services = await getNexusPacketServices();

  return services.discussionService.getReplyChildren({
    scope_id: input.scopeId,
    thread_post_packet_id: input.threadPostPacketId,
    parent_post_packet_id: input.parentPostPacketId,
    reply_sort: input.replySort ?? null,
    show_hidden: input.showHidden ?? false,
    viewer_actor_key: input.viewerActorKey ?? null,
    cursor: input.cursor ?? null,
    limit: input.limit ?? null,
  });
}

/**
 * Inputs: scope id.
 * Output: vote stage cards and vote packet projections for the scope lens.
 */
export async function getNexusVotesPayload(
  scopeId: string
): Promise<NexusVotesPayload> {
  const services = await getNexusPacketServices();
  const scopeNodes = await listScopeNodes();
  const scopeMap = new Map(
    scopeNodes.map((scopeNode) => [scopeNode.routeId, scopeNode])
  );
  const scopeLens = buildScopeLens(scopeId, scopeMap);
  const voteCards = await services.nexusQueryService.listVotes(scopeLens);
  const stageCounts = {
    petitioning: 0,
    under_review: 0,
    up_for_vote: 0,
    completed: 0,
  };

  for (const voteCard of voteCards) {
    stageCounts[toStatusCategory(voteCard.status)] += 1;
  }

  return {
    lens: scopeLens,
    stage_cards: [
      {
        id: 'petitioning',
        title: 'Petitioning',
        count: stageCounts.petitioning,
        detail: 'Support gathering before formal review.',
        tone: 'gold',
      },
      {
        id: 'under-review',
        title: 'Under review',
        count: stageCounts.under_review,
        detail: 'Clarification and objection window.',
        tone: 'sky',
      },
      {
        id: 'up-for-vote',
        title: 'Up for vote',
        count: stageCounts.up_for_vote,
        detail: 'Vote lanes currently open.',
        tone: 'rose',
      },
      {
        id: 'completed',
        title: 'Completed',
        count: stageCounts.completed,
        detail: 'Closed vote and decision records.',
        tone: 'mint',
      },
    ],
    vote_cards: voteCards,
    mechanics: NEXUS_VOTE_MECHANICS,
  };
}

/**
 * Inputs: scope id and optional family filter.
 * Output: packet library cards for the scope lens.
 */
export async function getNexusLibraryPayload(input: {
  scopeId: string;
  familyFilter: PacketFamily | null;
}): Promise<NexusLibraryPayload> {
  const services = await getNexusPacketServices();
  const scopeNodes = await listScopeNodes();
  const scopeMap = new Map(
    scopeNodes.map((scopeNode) => [scopeNode.routeId, scopeNode])
  );
  const scopeLens = buildScopeLens(input.scopeId, scopeMap);
  const packets = await services.nexusQueryService.listLibraryPackets(
    scopeLens,
    input.familyFilter ?? undefined
  );

  return {
    lens: scopeLens,
    family_filter: input.familyFilter,
    packets,
  };
}

/**
 * Inputs: unknown family query value.
 * Output: a validated packet family filter or null.
 */
export function parseFamilyFilter(value: unknown): PacketFamily | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return (PACKET_FAMILIES as readonly string[]).includes(value)
    ? (value as PacketFamily)
    : null;
}

/**
 * Inputs: shell payload and requested scope id.
 * Output: a safe scope id guaranteed to exist in current shell data.
 */
export function resolveScopeIdFromShell(
  shellPayload: NexusShellPayload,
  requestedScopeId: string
): string {
  const requestedScopeExists = shellPayload.scope_summaries.some(
    (scopeSummary) => scopeSummary.id === requestedScopeId
  );

  if (requestedScopeExists) {
    return requestedScopeId;
  }

  return shellPayload.default_scope_id;
}

/**
 * Inputs: scope lens.
 * Output: the authority scope id for logging and diagnostics.
 */
export function getScopeIdFromLens(lens: NexusScopeLens): string {
  return getScopeFromLens(lens);
}
