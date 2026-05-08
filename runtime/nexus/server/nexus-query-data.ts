/**
 * File: nexus-query-data.ts
 * Description: Builds Nexus shell and route payloads from packet-store query services.
 */

import type {
  AssemblyAssociationClaimProjection,
  NexusScopeLens,
} from '@core/contracts';
import {
  PACKET_FAMILIES,
  getElementSubtypeLeaf,
  type DiscussionReplySort,
  type DiscussionSort,
  type PacketEnvelopeByType,
  type PacketFamily,
  type PacketRef,
} from '@core/schema/packet-schema';
import {
  NEXUS_COMING_SOON_SURFACES,
  NEXUS_GUEST_CAPABILITIES,
  NEXUS_GUEST_CHECKLIST,
  NEXUS_GUEST_PROFILE,
  NEXUS_VOTE_MECHANICS,
} from '@runtime/nexus/nexus-content';
import type {
  NexusDiscussionWorkspacePayload,
  NexusDashboardPayload,
  NexusDiscussionReplyChildrenPayload,
  NexusDiscussionThreadPayload,
  NexusDiscussionsPayload,
  NexusLibraryPayload,
  NexusRoleCardProjection,
  NexusRoleClaimantProjection,
  NexusRolesPayload,
  NexusShellPayload,
  NexusTrustPayload,
  NexusTrustRoleProjection,
  NexusVotesPayload,
} from '@runtime/nexus/nexus-api-types';
import type {
  NexusScopeSummary,
} from '@runtime/nexus/nexus-shell';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';
import { readFollowedScopeIds } from '@runtime/nexus/server/shell-preferences';
import {
  DEFAULT_TRUST_POLICY_SNAPSHOT,
  deriveTrustStage,
  meetsTrustGate,
  type NexusTrustPolicySnapshot,
} from '@runtime/nexus/server/trust-logic';
import {
  filterClaimPackets,
  listClaimPackets,
  type ClaimPacket,
} from '@runtime/nexus/server/claim-utils';
import {
  buildNexusScopeGraphProjection,
  buildPersonalScopeSummary as buildScopeGraphPersonalScopeSummary,
  buildScopeSummaryFromGraph,
} from '@runtime/nexus/server/scope-graph';

type ScopeNode = {
  routeId: string;
  packetId: string;
  name: string;
  subtype: string | null;
  summary: string | null;
  localityLabel: string | null;
  parentRouteId: string | null;
};

type ScopeResolution = {
  resolvedScopeId: string;
  summary: NexusScopeSummary;
  lens: NexusScopeLens;
};

/**
 * Inputs: a URL-safe scope id.
 * Output: canonical element packet id fallback for unknown route ids.
 */
function toPacketScopeId(scopeId: string): string {
  return `nexus:element/${scopeId}`;
}

function isHomeLocalityLevel(
  level: NexusScopeSummary['level']
): boolean {
  return (
    level === 'nation' ||
    level === 'region' ||
    level === 'city' ||
    level === 'district'
  );
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

function buildPersonalScopeLens(
  actorPacket: PacketEnvelopeByType['Element']
): NexusScopeLens {
  const applicable_scope_refs: PacketRef[] =
    actorPacket.header.applicable_scope_refs.length > 0
      ? actorPacket.header.applicable_scope_refs
      : actorPacket.header.authority_scope_ref
        ? [actorPacket.header.authority_scope_ref]
        : [{ packet_id: actorPacket.header.packet_id }];

  return {
    authority_scope_ref: {
      packet_id: actorPacket.header.packet_id,
    },
    applicable_scope_refs,
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

export function getScopeSummaryByIdOrDefault(
  scopeSummaries: NexusScopeSummary[],
  scopeId: string
): NexusScopeSummary {
  return getScopeByIdOrDefault(scopeSummaries, scopeId);
}

export function getScopeSummaryByPacketId(
  scopeSummaries: NexusScopeSummary[],
  packetId: string
): NexusScopeSummary | null {
  return (
    scopeSummaries.find((scopeSummary) => scopeSummary.packetId === packetId) ?? null
  );
}

export function buildApplicableScopeRefsForSummary(
  scopeSummary: NexusScopeSummary,
  scopeSummaries: NexusScopeSummary[]
): PacketRef[] {
  const scopeRefs: PacketRef[] = [
    {
      packet_id: scopeSummary.packetId,
    },
  ];
  let currentParentId = scopeSummary.parentId ?? null;

  while (currentParentId) {
    const parentScope = scopeSummaries.find((scope) => scope.id === currentParentId);

    if (!parentScope) {
      break;
    }

    scopeRefs.push({
      packet_id: parentScope.packetId,
    });
    currentParentId = parentScope.parentId ?? null;
  }

  return scopeRefs;
}

async function getActorElementPacket(
  actorPacketId: string | null | undefined
): Promise<PacketEnvelopeByType['Element'] | null> {
  if (!actorPacketId) {
    return null;
  }

  const services = await getNexusPacketServices();
  const actorPacket = await services.packetStore.fetchByPacket({
    packet_id: actorPacketId,
  });

  if (!actorPacket || actorPacket.header.family !== 'Element') {
    return null;
  }

  return actorPacket as PacketEnvelopeByType['Element'];
}

async function resolveScopeResolution(input: {
  requestedScopeId: string;
  actorPacketId?: string | null;
}): Promise<ScopeResolution> {
  const services = await getNexusPacketServices();
  const scopeGraph = await buildNexusScopeGraphProjection({
    packetStore: services.packetStore,
    actorPacketId: input.actorPacketId ?? null,
    followedScopeIds: [],
  });
  const scopeNodes = scopeGraph.nodes.map((scopeNode) => ({
    routeId: scopeNode.routeId,
    packetId: scopeNode.packetId,
    name: scopeNode.name,
    subtype: getElementSubtypeLeaf(scopeNode.scopeSubtype),
    summary: scopeNode.summary,
    localityLabel: scopeNode.localityLabel,
    parentRouteId: scopeNode.parentRouteId,
  })) satisfies ScopeNode[];
  const scopeMap = new Map(
    scopeNodes.map((scopeNode) => [scopeNode.routeId, scopeNode])
  );

  if (input.requestedScopeId === 'you') {
    const actorPacket = await getActorElementPacket(input.actorPacketId ?? null);

    if (actorPacket) {
      const summary = buildScopeGraphPersonalScopeSummary({
        actorPacket,
        parentScopeId: scopeGraph.personalParentScopeId,
      });

      return {
        resolvedScopeId: 'you',
        summary,
        lens: buildPersonalScopeLens(actorPacket),
      };
    }
  }

  const scopeLens = buildScopeLens(input.requestedScopeId, scopeMap);
  const scopeSummaries = scopeGraph.nodes.map((scopeNode) =>
    buildScopeSummaryFromGraph({
      node: scopeNode,
      childIds: scopeGraph.nodes
        .filter((candidateNode) => candidateNode.parentRouteId === scopeNode.routeId)
        .map((childNode) => childNode.routeId),
      followedScopeIds: [],
      isMounted: scopeGraph.mountedScopeIds.has(scopeNode.routeId),
      isKnown: scopeGraph.knownScopeIds.has(scopeNode.routeId),
      isDiscoverable: scopeGraph.discoverableScopeIds.has(scopeNode.routeId),
      isFollowed: scopeGraph.followedScopeIds.has(scopeNode.routeId),
      isAssociated: scopeGraph.associatedScopeIds.has(scopeNode.routeId),
      isHomeAncestor:
        scopeGraph.effectiveHomeLocality?.ancestorRouteIds.includes(scopeNode.routeId) ??
        false,
      associationKind: scopeGraph.associatedScopeIds.has(scopeNode.routeId)
        ? 'assembly_association_claim_compatibility'
        : null,
      mountReasons: scopeGraph.mountReasonsByScopeId.get(scopeNode.routeId) ?? [],
      justificationPacketIds:
        scopeGraph.justificationPacketIdsByScopeId.get(scopeNode.routeId) ?? [],
      stats: {
        members: 0,
        activeVotes: 0,
        hotDiscussions: 0,
        missions: 0,
        guestLobbyOpen: false,
      },
      parentName: scopeGraph.nodes.find(
        (candidateNode) => candidateNode.routeId === scopeNode.parentRouteId
      )?.name ?? null,
    })
  ) satisfies NexusScopeSummary[];

  const summary = getScopeByIdOrDefault(scopeSummaries, input.requestedScopeId);

  return {
    resolvedScopeId: summary.id,
    summary,
    lens: scopeLens,
  };
}

function parseTrustPolicyFromPacket(
  packet: PacketEnvelopeByType['Policy']
): NexusTrustPolicySnapshot | null {
  if (packet.body.policy_kind !== 'trust_baseline' || !packet.body.trust_policy) {
    return null;
  }

  return {
    association_support_threshold:
      packet.body.trust_policy.association_support_threshold,
    role_support_threshold: packet.body.trust_policy.role_support_threshold,
    posting_gate: packet.body.trust_policy.posting_gate,
    voting_gate: packet.body.trust_policy.voting_gate,
    review_gate: packet.body.trust_policy.review_gate,
  };
}

async function getTrustPolicyForScope(
  scopeLens: NexusScopeLens
): Promise<NexusTrustPolicySnapshot> {
  const services = await getNexusPacketServices();
  const policyPackets = await services.packetStore.listPreferredPacketsByFamily('Policy');
  const applicableScopeIds = new Set(
    [
      scopeLens.authority_scope_ref?.packet_id ?? null,
      ...scopeLens.applicable_scope_refs.map((scopeRef) => scopeRef.packet_id),
    ].filter((packetId): packetId is string => typeof packetId === 'string')
  );

  return (
    policyPackets
      .filter((packet) =>
        applicableScopeIds.has(packet.header.authority_scope_ref?.packet_id ?? '')
      )
      .map((packet) => parseTrustPolicyFromPacket(packet as PacketEnvelopeByType['Policy']))
      .find((policy): policy is NexusTrustPolicySnapshot => policy !== null) ??
    DEFAULT_TRUST_POLICY_SNAPSHOT
  );
}

function getClaimAuthorityScopeId(input: {
  scopeSummary: NexusScopeSummary;
  actorPacket: PacketEnvelopeByType['Element'] | null;
  shellPayload?: NexusShellPayload | null;
}): string | null {
  if (input.scopeSummary.level !== 'personal') {
    return input.scopeSummary.packetId;
  }

  return (
    input.actorPacket?.header.authority_scope_ref?.packet_id ??
    input.shellPayload?.personal_parent_scope_id ??
    null
  );
}

function isClaimInExactScope(input: {
  claimPacket: ClaimPacket;
  scopePacketId: string | null;
}): boolean {
  if (!input.scopePacketId) {
    return false;
  }

  return input.claimPacket.body.scope_ref.packet_id === input.scopePacketId;
}

function getRoleClaimTrustStage(input: {
  hasAssociationClaim: boolean;
  associationSupportCount: number;
  roleSupportCount: number;
  thresholds: NexusTrustPolicySnapshot;
}): ReturnType<typeof deriveTrustStage> {
  return deriveTrustStage({
    has_association_claim: input.hasAssociationClaim,
    association_support_count: input.associationSupportCount,
    claimed_role_count: 1,
    supported_role_count:
      input.roleSupportCount >= input.thresholds.role_support_threshold ? 1 : 0,
    thresholds: input.thresholds,
  });
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
 * Output: builds the shell payload from assembly element packets and query-derived counts.
 */
export async function getNexusShellPayload(
  actorPacketId?: string | null,
  request?: Request | null
): Promise<NexusShellPayload> {
  const services = await getNexusPacketServices();
  const followedScopeIds = readFollowedScopeIds(request ?? null, actorPacketId ?? null);
  const scopeGraph = await buildNexusScopeGraphProjection({
    packetStore: services.packetStore,
    actorPacketId: actorPacketId ?? null,
    followedScopeIds,
  });
  const scopeNodes = scopeGraph.nodes.map((scopeNode) => ({
    routeId: scopeNode.routeId,
    packetId: scopeNode.packetId,
    name: scopeNode.name,
    subtype: getElementSubtypeLeaf(scopeNode.scopeSubtype),
    summary: scopeNode.summary,
    localityLabel: scopeNode.localityLabel,
    parentRouteId: scopeNode.parentRouteId,
  })) satisfies ScopeNode[];
  const scopeMap = new Map(
    scopeNodes.map((scopeNode) => [scopeNode.routeId, scopeNode])
  );
  const scopeSummaries: NexusScopeSummary[] = [];

  for (const scopeNode of scopeGraph.nodes) {
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

    scopeSummaries.push(buildScopeSummaryFromGraph({
      node: scopeNode,
      childIds,
      followedScopeIds: Array.from(scopeGraph.followedScopeIds),
      isMounted: scopeGraph.mountedScopeIds.has(scopeNode.routeId),
      isKnown: scopeGraph.knownScopeIds.has(scopeNode.routeId),
      isDiscoverable: scopeGraph.discoverableScopeIds.has(scopeNode.routeId),
      isFollowed: scopeGraph.followedScopeIds.has(scopeNode.routeId),
      isAssociated: scopeGraph.associatedScopeIds.has(scopeNode.routeId),
      isHomeAncestor:
        scopeGraph.effectiveHomeLocality?.ancestorRouteIds.includes(scopeNode.routeId) ??
        false,
      associationKind: scopeGraph.associatedScopeIds.has(scopeNode.routeId)
        ? 'assembly_association_claim_compatibility'
        : null,
      mountReasons:
        scopeGraph.mountReasonsByScopeId.get(scopeNode.routeId) ?? [],
      justificationPacketIds:
        scopeGraph.justificationPacketIdsByScopeId.get(scopeNode.routeId) ?? [],
      stats: {
        members: membersInScope.length,
        activeVotes: voteCards.filter((voteCard) => isOpenVoteStatus(voteCard.status))
          .length,
        hotDiscussions: discussionCards.length,
        missions: missionCards.length,
        guestLobbyOpen: hasVisitorLobbyForum,
      },
      parentName: scopeGraph.nodes.find(
        (candidateNode) => candidateNode.routeId === scopeNode.parentRouteId
      )?.name ?? null,
    }));
  }

  scopeSummaries.sort((leftScope, rightScope) =>
    leftScope.name.localeCompare(rightScope.name)
  );

  const defaultScopeId =
    scopeGraph.defaultScopeId || scopeSummaries[0]?.id || '';
  const defaultScope = getScopeByIdOrDefault(scopeSummaries, defaultScopeId);
  const personalParentScopeId =
    scopeGraph.personalParentScopeId ?? defaultScope.id;
  const defaultExpandedScopeIds = scopeSummaries
    .filter(
      (scopeSummary) => scopeSummary.isMounted && scopeSummary.childIds.length > 0
    )
    .map((scopeSummary) => scopeSummary.id);

  return {
    scope_summaries: scopeSummaries,
    default_scope_id: defaultScope.id,
    default_expanded_scope_ids: defaultExpandedScopeIds,
    geographic_mounted_scope_ids: scopeGraph.geographicMountedScopeIds,
    associated_scope_ids: Array.from(scopeGraph.associatedScopeIds),
    followed_scope_ids: Array.from(scopeGraph.followedScopeIds),
    known_scope_ids: Array.from(scopeGraph.knownScopeIds),
    known_unmounted_scope_ids: scopeGraph.knownUnmountedScopeIds,
    personal_parent_scope_id: personalParentScopeId,
    home_scope_id: scopeGraph.homeScopeId,
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
  scopeId: string,
  actorPacketId?: string | null
): Promise<NexusDashboardPayload> {
  const services = await getNexusPacketServices();
  const scopeResolution = await resolveScopeResolution({
    requestedScopeId: scopeId,
    actorPacketId,
  });
  const scopeLens = scopeResolution.lens;
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
 * Inputs: unified discussion workspace query settings.
 * Output: additive workspace payload with feed, optional thread, and action-rich workspace state.
 */
export async function getNexusDiscussionWorkspacePayload(input: {
  scopeId: string;
  forumId?: string | null;
  sort?: DiscussionSort | null;
  view?: 'feed' | 'thread' | 'post';
  postPacketId?: string | null;
  replyTargetPacketId?: string | null;
  replySort?: DiscussionReplySort | null;
  showHidden?: boolean;
  viewerActorKey?: string | null;
  feedLimit?: number | null;
  replyLimit?: number | null;
}): Promise<NexusDiscussionWorkspacePayload> {
  const services = await getNexusPacketServices();
  const feed = await services.discussionService.getForumFeed({
    scope_id: input.scopeId,
    forum_id: input.forumId ?? null,
    sort: input.sort ?? null,
    show_hidden: input.showHidden ?? false,
    viewer_actor_key: input.viewerActorKey ?? null,
    limit: input.feedLimit ?? null,
  });
  const thread =
    input.postPacketId
      ? await services.discussionService.getThreadDetail({
          scope_id: input.scopeId,
          post_packet_id: input.postPacketId,
          reply_sort: input.replySort ?? null,
          show_hidden: input.showHidden ?? false,
          viewer_actor_key: input.viewerActorKey ?? null,
          limit: input.replyLimit ?? null,
        })
      : null;
  const workspace = await services.discussionService.getWorkspace({
    scope_id: input.scopeId,
    forum_id: input.forumId ?? null,
    sort: input.sort ?? null,
    view: input.view ?? 'feed',
    post_packet_id: input.postPacketId ?? null,
    reply_target_packet_id: input.replyTargetPacketId ?? null,
    reply_sort: input.replySort ?? null,
    show_hidden: input.showHidden ?? false,
    viewer_actor_key: input.viewerActorKey ?? null,
    feed_limit: input.feedLimit ?? null,
    reply_limit: input.replyLimit ?? null,
  });

  return {
    feed,
    thread,
    workspace,
  };
}

/**
 * Inputs: scope id.
 * Output: vote stage cards and vote packet projections for the scope lens.
 */
export async function getNexusVotesPayload(
  scopeId: string,
  actorPacketId?: string | null
): Promise<NexusVotesPayload> {
  const services = await getNexusPacketServices();
  const scopeResolution = await resolveScopeResolution({
    requestedScopeId: scopeId,
    actorPacketId,
  });
  const scopeLens = scopeResolution.lens;
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
  actorPacketId?: string | null;
}): Promise<NexusLibraryPayload> {
  const services = await getNexusPacketServices();
  const scopeResolution = await resolveScopeResolution({
    requestedScopeId: input.scopeId,
    actorPacketId: input.actorPacketId,
  });
  const scopeLens = scopeResolution.lens;
  const packets = await services.nexusQueryService.listLibraryPackets(
    scopeLens,
    input.familyFilter ?? undefined,
    {
      scope_mode: 'local',
    }
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
  requestedScopeId: string,
  actorPacketId?: string | null
): string {
  if (requestedScopeId === 'you' && actorPacketId) {
    return 'you';
  }

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

export async function getNexusTrustPayload(input: {
  scopeId: string;
  actorPacketId?: string | null;
}): Promise<NexusTrustPayload> {
  const services = await getNexusPacketServices();
  const actorPacket = await getActorElementPacket(input.actorPacketId ?? null);
  const shellPayload = await getNexusShellPayload(input.actorPacketId ?? null);
  const scopeGraph = await buildNexusScopeGraphProjection({
    packetStore: services.packetStore,
    actorPacketId: input.actorPacketId ?? null,
    followedScopeIds: shellPayload.followed_scope_ids,
  });
  const scopeResolution = await resolveScopeResolution({
    requestedScopeId: input.scopeId,
    actorPacketId: input.actorPacketId,
  });
  const scopeLens = scopeResolution.lens;
  const rolePackets = await services.packetStore.listPreferredPacketsByFamily('Role');
  const trustPolicy = await getTrustPolicyForScope(scopeLens);
  const assemblyPacketId = getClaimAuthorityScopeId({
    scopeSummary: scopeResolution.summary,
    actorPacket,
    shellPayload,
  });
  const claimPackets = await listClaimPackets(services.packetStore);
  const homeLocalityRouteIds = scopeGraph.effectiveHomeLocality
    ? [
        ...scopeGraph.effectiveHomeLocality.ancestorRouteIds,
        scopeGraph.effectiveHomeLocality.scopeRouteId,
      ]
    : [];
  const homeLocalityScopeNames = homeLocalityRouteIds
    .map(
      (scopeId) =>
        shellPayload.scope_summaries.find(
          (scopeSummary) => scopeSummary.id === scopeId
        )?.name ?? null
    )
    .filter((scopeName): scopeName is string => scopeName !== null);
  const assemblyClaims =
    actorPacket?.header.packet_id
      ? await services.attestationService.listAssemblyAssociationClaimsForActor(
          actorPacket.header.packet_id
        )
      : [];
  const activeAssemblyClaim = assemblyPacketId
    ? assemblyClaims.find(
        (claim) =>
          claim.assembly_packet_id === assemblyPacketId &&
          claim.status === 'active'
      ) ?? null
    : null;
  const actorRoleClaims = filterClaimPackets({
    claims: claimPackets,
    claimKind: 'role_association',
    subjectPacketId: actorPacket?.header.packet_id ?? null,
    activeOnly: true,
  });
  const roleCards: NexusTrustRoleProjection[] = [];

  for (const rolePacket of rolePackets) {
    const typedRolePacket = rolePacket as PacketEnvelopeByType['Role'];
    const scopedClaim =
      actorRoleClaims.find(
        (claimPacket) =>
          claimPacket.body.target_ref.packet_id === typedRolePacket.header.packet_id &&
          isClaimInExactScope({
            claimPacket,
            scopePacketId: assemblyPacketId,
          })
      ) ?? null;
    const supportEdges =
      scopedClaim
        ? await services.attestationService.listTargetAttestations({
            target_packet_id: scopedClaim.header.packet_id,
            attestation_kind: 'claim_support',
            active_only: true,
          })
        : [];
    const disputeEdges =
      scopedClaim
        ? await services.attestationService.listTargetAttestations({
            target_packet_id: scopedClaim.header.packet_id,
            attestation_kind: 'claim_dispute',
            active_only: true,
          })
        : [];
    const scopedSupportEdges =
      assemblyPacketId === null
        ? supportEdges
        : supportEdges.filter(
            (edge) => edge.authority_scope_packet_id === assemblyPacketId
          );
    const scopedDisputeEdges =
      assemblyPacketId === null
        ? disputeEdges
        : disputeEdges.filter(
            (edge) => edge.authority_scope_packet_id === assemblyPacketId
          );

    roleCards.push({
      claim_packet_id: scopedClaim?.header.packet_id ?? null,
      claim_status: scopedClaim?.body.status ?? null,
      claimed_scope_packet_id: scopedClaim?.body.scope_ref.packet_id ?? null,
      role_packet_id: typedRolePacket.header.packet_id,
      title: typedRolePacket.body.title,
      role_kind: typedRolePacket.body.role_kind,
      summary: typedRolePacket.body.summary ?? null,
      responsibility_markdown: typedRolePacket.body.responsibility_markdown,
      is_claimed: scopedClaim !== null,
      support_count: scopedSupportEdges.length,
      dispute_count: scopedDisputeEdges.length,
      stage:
        scopedSupportEdges.length >= trustPolicy.role_support_threshold
          ? 'role_eligible'
          : scopedClaim !== null
            ? 'emerging'
            : 'self_claimed',
      support_edges: scopedSupportEdges,
      dispute_edges: scopedDisputeEdges,
    });
  }

  const supportedRoleCount = roleCards.filter(
    (roleCard) => roleCard.support_count >= trustPolicy.role_support_threshold
  ).length;
  const trustStage = deriveTrustStage({
    has_association_claim: activeAssemblyClaim !== null,
    association_support_count: activeAssemblyClaim?.supported_by_other_count ?? 0,
    claimed_role_count: roleCards.filter((roleCard) => roleCard.is_claimed).length,
    supported_role_count: supportedRoleCount,
    thresholds: trustPolicy,
  });

  return {
    lens: scopeLens,
    scope: scopeResolution.summary,
    actor_packet_id: actorPacket?.header.packet_id ?? null,
    actor_label: actorPacket?.body.name ?? 'Anonymous Guest',
    trust_stage: trustStage,
    trust_score: null,
    policy_snapshot: trustPolicy,
    can_post: meetsTrustGate(trustStage, trustPolicy.posting_gate),
    can_vote: meetsTrustGate(trustStage, trustPolicy.voting_gate),
    can_review: meetsTrustGate(trustStage, trustPolicy.review_gate),
    home_locality: {
      relation_packet_id: scopeGraph.effectiveHomeLocality?.relationPacketId ?? null,
      claim_packet_id:
        scopeGraph.effectiveHomeLocality?.compatibilityClaimPacketId ??
        scopeGraph.effectiveHomeLocality?.supportingClaimPacketIds[0] ??
        null,
      compatibility_source: scopeGraph.effectiveHomeLocality?.source ?? null,
      policy_evaluation_state:
        scopeGraph.effectiveHomeLocality?.policyEvaluationState ?? null,
      scope_packet_id: scopeGraph.effectiveHomeLocality?.scopePacketId ?? null,
      scope_id: scopeGraph.effectiveHomeLocality?.scopeRouteId ?? null,
      scope_name:
        shellPayload.scope_summaries.find(
          (scopeSummary) => scopeSummary.id === scopeGraph.effectiveHomeLocality?.scopeRouteId
        )?.name ?? null,
      is_active_scope:
        scopeGraph.effectiveHomeLocality?.scopeRouteId === scopeResolution.summary.id,
      is_active_scope_in_chain: homeLocalityRouteIds.includes(scopeResolution.summary.id),
      can_set_active_scope: isHomeLocalityLevel(scopeResolution.summary.level),
      derived_scope_ids: homeLocalityRouteIds,
      derived_scope_names: homeLocalityScopeNames,
    },
    assembly_claims:
      assemblyPacketId !== null
        ? assemblyClaims.filter(
            (claim) => claim.assembly_packet_id === assemblyPacketId
          )
        : assemblyClaims,
    role_cards: roleCards,
  };
}

export async function getNexusRolesPayload(input: {
  scopeId: string;
  actorPacketId?: string | null;
}): Promise<NexusRolesPayload> {
  const services = await getNexusPacketServices();
  const actorPacket = await getActorElementPacket(input.actorPacketId ?? null);
  const shellPayload = await getNexusShellPayload(input.actorPacketId ?? null);
  const scopeResolution = await resolveScopeResolution({
    requestedScopeId: input.scopeId,
    actorPacketId: input.actorPacketId,
  });
  const scopeLens = scopeResolution.lens;
  const trustPolicy = await getTrustPolicyForScope(scopeLens);
  const assemblyPacketId = getClaimAuthorityScopeId({
    scopeSummary: scopeResolution.summary,
    actorPacket,
    shellPayload,
  });
  const rolePackets = (
    await services.packetStore.listPreferredPacketsByFamily('Role')
  ) as PacketEnvelopeByType['Role'][];
  const elementPackets = (
    await services.packetStore.listPreferredPacketsByFamily('Element')
  ) as PacketEnvelopeByType['Element'][];
  const claimPackets = await listClaimPackets(services.packetStore);
  const currentActorPacketId = actorPacket?.header.packet_id ?? null;
  const eligibleClaimants = elementPackets.filter((packet) =>
    ['person', 'assembly', 'team'].includes(packet.body.kind)
  );
  const assemblyClaimsByActor = new Map<
    string,
    AssemblyAssociationClaimProjection[]
  >();

  for (const claimantPacket of eligibleClaimants) {
    if (claimantPacket.body.kind !== 'person') {
      continue;
    }

    assemblyClaimsByActor.set(
      claimantPacket.header.packet_id,
      await services.attestationService.listAssemblyAssociationClaimsForActor(
        claimantPacket.header.packet_id
      )
    );
  }

  const roleCards: NexusRoleCardProjection[] = [];

  for (const rolePacket of rolePackets) {
    const claimants: NexusRoleClaimantProjection[] = [];
    const roleClaims = filterClaimPackets({
      claims: claimPackets,
      claimKind: 'role_association',
      targetPacketId: rolePacket.header.packet_id,
      scopePacketId: assemblyPacketId,
      activeOnly: true,
    });

    for (const claimPacket of roleClaims) {
      const claimantPacketId =
        claimPacket.body.subject_ref?.packet_id ??
        claimPacket.body.relation_assertion?.subject_ref.packet_id ??
        null;

      if (!claimantPacketId) {
        continue;
      }

      const claimantPacket = eligibleClaimants.find(
        (packet) => packet.header.packet_id === claimantPacketId
      );

      if (!claimantPacket) {
        continue;
      }

      const claimantAssemblyClaims =
        assemblyClaimsByActor.get(claimantPacket.header.packet_id) ?? [];
      const activeAssemblyClaim =
        assemblyPacketId === null
          ? claimantAssemblyClaims.find((claim) => claim.status === 'active') ?? null
          : claimantAssemblyClaims.find(
              (claim) =>
                claim.assembly_packet_id === assemblyPacketId &&
                claim.status === 'active'
            ) ?? null;
      const matchesAuthorityScope =
        assemblyPacketId !== null &&
        claimantPacket.header.authority_scope_ref?.packet_id === assemblyPacketId;
      const hasScopeAssociation =
        assemblyPacketId === null
          ? true
          : matchesAuthorityScope || activeAssemblyClaim !== null;
      const associationSupportCount =
        activeAssemblyClaim?.supported_by_other_count ?? 0;

      const supportEdges = await services.attestationService.listTargetAttestations({
        target_packet_id: claimPacket.header.packet_id,
        attestation_kind: 'claim_support',
        active_only: true,
      });
      const disputeEdges = await services.attestationService.listTargetAttestations({
        target_packet_id: claimPacket.header.packet_id,
        attestation_kind: 'claim_dispute',
        active_only: true,
      });
      const scopedSupportEdges =
        assemblyPacketId === null
          ? supportEdges
          : supportEdges.filter(
              (edge) => edge.authority_scope_packet_id === assemblyPacketId
            );
      const scopedDisputeEdges =
        assemblyPacketId === null
          ? disputeEdges
          : disputeEdges.filter(
              (edge) => edge.authority_scope_packet_id === assemblyPacketId
            );
      const viewerAttestation =
        scopedSupportEdges.some(
          (edge) => edge.source_actor_packet_id === currentActorPacketId
        )
          ? 'support'
          : scopedDisputeEdges.some(
                (edge) => edge.source_actor_packet_id === currentActorPacketId
              )
            ? 'dispute'
            : 'none';
      const roleTrustStage = getRoleClaimTrustStage({
        hasAssociationClaim: hasScopeAssociation,
        associationSupportCount,
        roleSupportCount: scopedSupportEdges.length,
        thresholds: trustPolicy,
      });
      const scopeTrustStage = deriveTrustStage({
        has_association_claim: hasScopeAssociation,
        association_support_count: associationSupportCount,
        claimed_role_count: 0,
        supported_role_count: 0,
        thresholds: trustPolicy,
      });

      claimants.push({
        claim_packet_id: claimPacket.header.packet_id,
        claim_status: claimPacket.body.status,
        actor_packet_id: claimantPacket.header.packet_id,
        actor_label: claimantPacket.body.name,
        actor_kind: claimantPacket.body.kind,
        is_current_actor: claimantPacket.header.packet_id === currentActorPacketId,
        trust_stage: roleTrustStage,
        scope_trust_stage: scopeTrustStage,
        has_scope_association: hasScopeAssociation,
        scope_association_support_count: associationSupportCount,
        support_count: scopedSupportEdges.length,
        dispute_count: scopedDisputeEdges.length,
        viewer_attestation: viewerAttestation,
        support_edges: scopedSupportEdges,
        dispute_edges: scopedDisputeEdges,
      });
    }

    claimants.sort((leftClaimant, rightClaimant) => {
      if (leftClaimant.is_current_actor !== rightClaimant.is_current_actor) {
        return leftClaimant.is_current_actor ? -1 : 1;
      }

      if (leftClaimant.support_count !== rightClaimant.support_count) {
        return rightClaimant.support_count - leftClaimant.support_count;
      }

      if (leftClaimant.dispute_count !== rightClaimant.dispute_count) {
        return leftClaimant.dispute_count - rightClaimant.dispute_count;
      }

      return leftClaimant.actor_label.localeCompare(rightClaimant.actor_label);
    });

    roleCards.push({
      role_packet_id: rolePacket.header.packet_id,
      title: rolePacket.body.title,
      role_kind: rolePacket.body.role_kind,
      summary: rolePacket.body.summary ?? null,
      responsibility_markdown: rolePacket.body.responsibility_markdown ?? null,
      is_claimed_by_current_actor:
        currentActorPacketId === null
          ? false
          : roleClaims.some(
              (claimPacket) =>
                (claimPacket.body.subject_ref?.packet_id ??
                  claimPacket.body.relation_assertion?.subject_ref.packet_id) ===
                currentActorPacketId
            ),
      claimants,
    });
  }

  roleCards.sort((leftRole, rightRole) => {
    if (
      leftRole.is_claimed_by_current_actor !==
      rightRole.is_claimed_by_current_actor
    ) {
      return leftRole.is_claimed_by_current_actor ? -1 : 1;
    }

    return leftRole.title.localeCompare(rightRole.title);
  });

  return {
    lens: scopeLens,
    scope: scopeResolution.summary,
    actor_packet_id: currentActorPacketId,
    actor_label: actorPacket?.body.name ?? 'Anonymous Guest',
    policy_snapshot: trustPolicy,
    role_cards: roleCards,
  };
}
