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
  NexusScopeMountReason,
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

type ScopeResolution = {
  resolvedScopeId: string;
  summary: NexusScopeSummary;
  lens: NexusScopeLens;
};

type HomeLocalityContext = {
  claimPacket: ClaimPacket;
  scopeRouteId: string;
  scopePacketId: string;
  ancestorRouteIds: string[];
};

type MountedScopeContext = {
  defaultScopeId: string;
  personalParentScopeId: string | null;
  mountedScopeIds: Set<string>;
  mountReasonsByScopeId: Map<string, NexusScopeMountReason[]>;
  homeScopeId: string | null;
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

function addMountReason(
  mountReasonsByScopeId: Map<string, NexusScopeMountReason[]>,
  scopeId: string,
  mountReason: NexusScopeMountReason
): void {
  const currentReasons = mountReasonsByScopeId.get(scopeId) ?? [];

  if (!currentReasons.includes(mountReason)) {
    mountReasonsByScopeId.set(scopeId, [...currentReasons, mountReason]);
  }
}

function buildPersonalScopeSummary(input: {
  actorPacket: PacketEnvelopeByType['Element'];
  parentScopeId?: string | null;
}): NexusScopeSummary {
  return {
    id: 'you',
    packetId: input.actorPacket.header.packet_id,
    name: 'You',
    shortLabel: 'You',
    level: 'personal',
    description:
      'Packet-backed personal scope lens anchored to the current actor element.',
    localityLabel: input.actorPacket.body.locality_label ?? input.actorPacket.body.name,
    badge:
      input.actorPacket.body.identity?.claim_status === 'claimed'
        ? 'Claimed actor'
        : 'Guest actor',
    relationshipLabel: 'Current actor scope',
    parentId: input.parentScopeId ?? undefined,
    childIds: [],
    followedScopeIds: [],
    isMounted: true,
    isDiscoverable: false,
    mountReasons: ['personal_default'],
    publicLobbyLabel: 'Personal trust lens',
    stats: {
      members: 1,
      activeVotes: 0,
      hotDiscussions: 0,
      missions: 0,
      guestLobbyOpen: false,
    },
  };
}

/**
 * Inputs: scope name and subtype.
 * Output: compact short label used in sidebar rows and badges.
 */
function toScopeShortLabel(name: string, subtype: string | null): string {
  const subtypeLeaf = getElementSubtypeLeaf(subtype);

  if (subtypeLeaf === 'global') {
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
  const scopeNodes = await listScopeNodes();
  const scopeMap = new Map(
    scopeNodes.map((scopeNode) => [scopeNode.routeId, scopeNode])
  );
  const services = await getNexusPacketServices();
  const claimPackets = await listClaimPackets(services.packetStore);
  const mountedScopeContext = buildMountedScopeContext({
    scopeNodes,
    claimPackets,
    actorPacketId: input.actorPacketId ?? null,
    followedScopeIds: [],
  });

  if (input.requestedScopeId === 'you') {
    const actorPacket = await getActorElementPacket(input.actorPacketId ?? null);

    if (actorPacket) {
      const summary = buildPersonalScopeSummary({
        actorPacket,
        parentScopeId: mountedScopeContext.personalParentScopeId,
      });

      return {
        resolvedScopeId: 'you',
        summary,
        lens: buildPersonalScopeLens(actorPacket),
      };
    }
  }

  const scopeLens = buildScopeLens(input.requestedScopeId, scopeMap);
  const scopeSummaries = scopeNodes.map((scopeNode) => ({
    id: scopeNode.routeId,
    packetId: scopeNode.packetId,
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
    childIds: scopeNodes
      .filter((candidateNode) => candidateNode.parentRouteId === scopeNode.routeId)
      .map((childNode) => childNode.routeId),
    followedScopeIds: [],
    isMounted: mountedScopeContext.mountedScopeIds.has(scopeNode.routeId),
    isDiscoverable: true,
    mountReasons: mountedScopeContext.mountReasonsByScopeId.get(scopeNode.routeId) ?? [],
    publicLobbyLabel: `${scopeNode.name} visitor lobby`,
    stats: {
      members: 0,
      activeVotes: 0,
      hotDiscussions: 0,
      missions: 0,
      guestLobbyOpen: false,
    },
  })) satisfies NexusScopeSummary[];

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

function getAssemblyPacketIdForScope(
  scopeSummary: NexusScopeSummary,
  actorPacket: PacketEnvelopeByType['Element'] | null
): string | null {
  return scopeSummary.level === 'personal'
    ? actorPacket?.header.authority_scope_ref?.packet_id ?? null
    : scopeSummary.packetId;
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
      subtype: getElementSubtypeLeaf(packet.body.subtype ?? null),
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

function getAncestorRouteIds(
  scopeMap: Map<string, ScopeNode>,
  scopeRouteId: string
): string[] {
  const ancestorRouteIds: string[] = [];
  let currentParentRouteId = scopeMap.get(scopeRouteId)?.parentRouteId ?? null;

  while (currentParentRouteId) {
    ancestorRouteIds.unshift(currentParentRouteId);
    currentParentRouteId = scopeMap.get(currentParentRouteId)?.parentRouteId ?? null;
  }

  return ancestorRouteIds;
}

function getActiveHomeLocalityContext(input: {
  claimPackets: ClaimPacket[];
  actorPacketId?: string | null;
  scopeMap: Map<string, ScopeNode>;
}): HomeLocalityContext | null {
  if (!input.actorPacketId) {
    return null;
  }

  const activeHomeClaims = filterClaimPackets({
    claims: input.claimPackets,
    claimKind: 'home_locality',
    subjectPacketId: input.actorPacketId,
    activeOnly: true,
  });
  const rankedHomeClaims = activeHomeClaims
    .map((claimPacket) => {
      const scopeRouteId = Array.from(input.scopeMap.values()).find(
        (scopeNode) =>
          scopeNode.packetId === claimPacket.body.target_ref.packet_id &&
          isHomeLocalityLevel(toScopeLevel(scopeNode.subtype))
      )?.routeId;

      if (!scopeRouteId) {
        return null;
      }

      const ancestorRouteIds = getAncestorRouteIds(input.scopeMap, scopeRouteId);

      return {
        claimPacket,
        scopeRouteId,
        scopePacketId: claimPacket.body.target_ref.packet_id,
        ancestorRouteIds,
        depth: ancestorRouteIds.length,
      };
    })
    .filter(
      (
        value
      ): value is HomeLocalityContext & {
        depth: number;
      } => value !== null
    )
    .sort((leftClaim, rightClaim) => rightClaim.depth - leftClaim.depth);

  if (rankedHomeClaims.length === 0) {
    return null;
  }

  const { depth: _depth, ...homeContext } = rankedHomeClaims[0];

  return homeContext;
}

function buildMountedScopeContext(input: {
  scopeNodes: ScopeNode[];
  claimPackets: ClaimPacket[];
  actorPacketId?: string | null;
  followedScopeIds: string[];
}): MountedScopeContext {
  const scopeMap = new Map(
    input.scopeNodes.map((scopeNode) => [scopeNode.routeId, scopeNode])
  );
  const globalScopeId =
    input.scopeNodes.find((scopeNode) => scopeNode.subtype === 'global')?.routeId ??
    input.scopeNodes[0]?.routeId ??
    '';
  const homeLocalityContext = getActiveHomeLocalityContext({
    claimPackets: input.claimPackets,
    actorPacketId: input.actorPacketId ?? null,
    scopeMap,
  });
  const mountedScopeIds = new Set<string>();
  const mountReasonsByScopeId = new Map<string, NexusScopeMountReason[]>();

  if (globalScopeId) {
    mountedScopeIds.add(globalScopeId);
    addMountReason(mountReasonsByScopeId, globalScopeId, 'global_default');
  }

  if (homeLocalityContext) {
    mountedScopeIds.add(homeLocalityContext.scopeRouteId);
    addMountReason(
      mountReasonsByScopeId,
      homeLocalityContext.scopeRouteId,
      'home_locality'
    );

    homeLocalityContext.ancestorRouteIds.forEach((ancestorRouteId) => {
      mountedScopeIds.add(ancestorRouteId);
      addMountReason(mountReasonsByScopeId, ancestorRouteId, 'home_ancestor');
    });
  }

  input.followedScopeIds.forEach((followedScopeId) => {
    if (!scopeMap.has(followedScopeId)) {
      return;
    }

    mountedScopeIds.add(followedScopeId);
    addMountReason(mountReasonsByScopeId, followedScopeId, 'followed');
  });

  return {
    defaultScopeId: homeLocalityContext?.scopeRouteId ?? globalScopeId,
    personalParentScopeId: homeLocalityContext?.scopeRouteId ?? globalScopeId,
    mountedScopeIds,
    mountReasonsByScopeId,
    homeScopeId: homeLocalityContext?.scopeRouteId ?? null,
  };
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
export async function getNexusShellPayload(
  actorPacketId?: string | null,
  request?: Request | null
): Promise<NexusShellPayload> {
  const services = await getNexusPacketServices();
  const scopeNodes = await listScopeNodes();
  const scopeMap = new Map(
    scopeNodes.map((scopeNode) => [scopeNode.routeId, scopeNode])
  );
  const claimPackets = await listClaimPackets(services.packetStore);
  const followedScopeIds = readFollowedScopeIds(request ?? null, actorPacketId ?? null)
    .filter((scopeId) => scopeMap.has(scopeId));
  const mountedScopeContext = buildMountedScopeContext({
    scopeNodes,
    claimPackets,
    actorPacketId: actorPacketId ?? null,
    followedScopeIds,
  });
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
      packetId: scopeNode.packetId,
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
      followedScopeIds,
      isMounted: mountedScopeContext.mountedScopeIds.has(scopeNode.routeId),
      isDiscoverable: true,
      mountReasons:
        mountedScopeContext.mountReasonsByScopeId.get(scopeNode.routeId) ?? [],
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
    mountedScopeContext.defaultScopeId || scopeSummaries[0]?.id || '';
  const defaultScope = getScopeByIdOrDefault(scopeSummaries, defaultScopeId);
  const personalParentScopeId =
    mountedScopeContext.personalParentScopeId ?? defaultScope.id;
  const defaultExpandedScopeIds = scopeSummaries
    .filter(
      (scopeSummary) => scopeSummary.isMounted && scopeSummary.childIds.length > 0
    )
    .map((scopeSummary) => scopeSummary.id);

  return {
    scope_summaries: scopeSummaries,
    default_scope_id: defaultScope.id,
    default_expanded_scope_ids: defaultExpandedScopeIds,
    followed_scope_ids: followedScopeIds,
    personal_parent_scope_id: personalParentScopeId,
    home_scope_id: mountedScopeContext.homeScopeId,
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
  const scopeNodes = await listScopeNodes();
  const scopeMap = new Map(
    scopeNodes.map((scopeNode) => [scopeNode.routeId, scopeNode])
  );
  const homeLocalityContext = getActiveHomeLocalityContext({
    claimPackets,
    actorPacketId: actorPacket?.header.packet_id ?? null,
    scopeMap,
  });
  const homeLocalityRouteIds = homeLocalityContext
    ? [
        ...homeLocalityContext.ancestorRouteIds,
        homeLocalityContext.scopeRouteId,
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
      claim_packet_id: homeLocalityContext?.claimPacket.header.packet_id ?? null,
      scope_packet_id: homeLocalityContext?.scopePacketId ?? null,
      scope_id: homeLocalityContext?.scopeRouteId ?? null,
      scope_name:
        shellPayload.scope_summaries.find(
          (scopeSummary) => scopeSummary.id === homeLocalityContext?.scopeRouteId
        )?.name ?? null,
      is_active_scope: homeLocalityContext?.scopeRouteId === scopeResolution.summary.id,
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
