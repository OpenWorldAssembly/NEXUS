/**
 * File: nexus-query-data.ts
 * Description: Builds Nexus shell and route payloads from packet-store query services.
 */

import type {
  AssociationRelationProjection,
  NexusPacketCardProjection,
  NexusScopeLens,
} from '@core/contracts';
import { normalizeShellChromePreferenceValue } from '@core/packets/packet-definition-manifest';
import {
  PACKET_TYPES,
  getElementSubtypeLeaf,
  type DiscussionReplySort,
  type DiscussionSort,
  type PacketEnvelope,
  type PacketEnvelopeByType,
  type PacketType,
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
  NexusRoleParticipantProjection,
  NexusRolesPayload,
  NexusShellPayload,
  NexusTrustPayload,
  NexusTrustRoleProjection,
  NexusVotesPayload,
} from '@runtime/nexus/nexus-api-types';
import type {
  NexusProjectedScopeSection,
  NexusScopeSummary,
} from '@runtime/nexus/nexus-shell';
import {
  buildNexusHomeScopeIds,
  buildNexusProjectedScopeSection,
} from '@runtime/nexus/nexus-shell';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';
import { readElementPreferencePacket } from '@runtime/nexus/server/element-preference-packets';
import { readScopeDisplayPreferences } from '@runtime/nexus/server/scope-display-preferences';
import { readShellChromePreferencesCompatibility } from '@runtime/nexus/server/shell-preferences';
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
  filterRelationPackets,
  listRelationPackets,
  type AssociationRelationProjection,
} from '@runtime/nexus/server/relation-utils';
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
  scopeSummaries: NexusScopeSummary[];
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
 * Inputs: dashboard card projection text.
 * Output: whether the packet appears to describe an association relationship.
 */
function isAssociationCardText(card: { title: string; label: string; summary: string | null }): boolean {
  const searchableText = [card.title, card.label, card.summary ?? '']
    .join(' ')
    .toLowerCase();

  return searchableText.includes('association') || searchableText.includes('associate');
}

type DashboardDiscussionCardKind =
  | 'space'
  | 'forum'
  | 'thread'
  | 'root_post'
  | 'reply'
  | 'other';

function classifyDashboardDiscussionCard(input: {
  card: NexusPacketCardProjection;
  packet: PacketEnvelope | null;
}): DashboardDiscussionCardKind {
  if (input.packet?.header.type === 'Discussion') {
    const body = (input.packet as PacketEnvelopeByType['Discussion']).body;

    if (body.subtype === 'space') {
      return 'space';
    }

    if (body.subtype === 'forum') {
      return 'forum';
    }

    if (body.subtype === 'topic') {
      return 'thread';
    }

    if (body.subtype === 'message') {
      return body.root_message_ref ? 'reply' : 'root_post';
    }
  }

  return 'other';
}

function getScopeTreePacketIds(
  scopeSummary: NexusScopeSummary,
  scopeSummaries: NexusScopeSummary[]
): Set<string> {
  const scopeIds = new Set<string>([scopeSummary.id]);
  let previousSize = 0;

  while (scopeIds.size !== previousSize) {
    previousSize = scopeIds.size;

    for (const candidateSummary of scopeSummaries) {
      if (candidateSummary.parentId && scopeIds.has(candidateSummary.parentId)) {
        scopeIds.add(candidateSummary.id);
      }
    }
  }

  return new Set(
    scopeSummaries
      .filter((candidateSummary) => scopeIds.has(candidateSummary.id))
      .map((candidateSummary) => candidateSummary.packetId)
  );
}

function getClaimRelationSubjectPacketId(claimPacket: ClaimPacket): string | null {
  return (
    claimPacket.body.relation_assertion?.subject_ref.packet_id ??
    claimPacket.body.subject_ref?.packet_id ??
    null
  );
}

function getClaimRelationTargetPacketId(claimPacket: ClaimPacket): string | null {
  return (
    claimPacket.body.relation_assertion?.target_ref.packet_id ??
    claimPacket.body.target_ref.packet_id
  );
}

async function countResidentsInScopeTree(input: {
  packetStore: Awaited<ReturnType<typeof getNexusPacketServices>>['packetStore'];
  scopeResolution: ScopeResolution;
}): Promise<number> {
  const scopeTreePacketIds = getScopeTreePacketIds(
    input.scopeResolution.summary,
    input.scopeResolution.scopeSummaries
  );
  const [elementPackets, relationPackets, claimPackets] = await Promise.all([
    input.packetStore.listPreferredPacketsByType('Element'),
    listRelationPackets(input.packetStore),
    listClaimPackets(input.packetStore),
  ]);
  const personPacketIds = new Set(
    (elementPackets as PacketEnvelopeByType['Element'][])
      .filter((elementPacket) => elementPacket.body.subtype === 'person')
      .map((elementPacket) => elementPacket.header.packet_id)
  );
  const residentPacketIds = new Set<string>();

  for (const relationPacket of relationPackets) {
    if (
      relationPacket.body.subtype === 'residence' &&
      relationPacket.body.status === 'active' &&
      scopeTreePacketIds.has(relationPacket.body.target_ref.packet_id) &&
      personPacketIds.has(relationPacket.body.subject_ref.packet_id)
    ) {
      residentPacketIds.add(relationPacket.body.subject_ref.packet_id);
    }
  }

  for (const claimPacket of claimPackets) {
    if (claimPacket.body.status !== 'active') {
      continue;
    }

    if (
      claimPacket.body.subtype !== 'residence' &&
      claimPacket.body.relation_assertion?.subtype !== 'residence'
    ) {
      continue;
    }

    const subjectPacketId = getClaimRelationSubjectPacketId(claimPacket);
    const targetPacketId = getClaimRelationTargetPacketId(claimPacket);

    if (
      subjectPacketId &&
      targetPacketId &&
      personPacketIds.has(subjectPacketId) &&
      scopeTreePacketIds.has(targetPacketId)
    ) {
      residentPacketIds.add(subjectPacketId);
    }
  }

  return residentPacketIds.size;
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

function buildShellGraphSections(input: {
  scopeSummaries: NexusScopeSummary[];
  preferences: {
    main_visible_scope_packet_ids: string[];
    show_associated_parent_chains: boolean;
    show_followed_parent_chains: boolean;
  };
}): {
  homeGraph: NexusProjectedScopeSection;
  associatedGraph: NexusProjectedScopeSection;
  followedGraph: NexusProjectedScopeSection;
  mainGraph: NexusProjectedScopeSection;
  discoverableSection: NexusProjectedScopeSection;
  mainVisibleScopePacketIds: string[];
} {
  const scopeIdByPacketId = new Map(
    input.scopeSummaries.map((scopeSummary) => [scopeSummary.packetId, scopeSummary.id])
  );
  const scopeSummaryById = new Map(
    input.scopeSummaries.map((scopeSummary) => [scopeSummary.id, scopeSummary])
  );
  const homeScopeIds = buildNexusHomeScopeIds(input.scopeSummaries);
  const associatedScopeIds = input.scopeSummaries
    .filter((scopeSummary) => scopeSummary.isAssociated && !homeScopeIds.includes(scopeSummary.id))
    .map((scopeSummary) => scopeSummary.id);
  const followedScopeIds = input.scopeSummaries
    .filter(
      (scopeSummary) =>
        scopeSummary.isFollowed && !homeScopeIds.includes(scopeSummary.id)
    )
    .map((scopeSummary) => scopeSummary.id);
  const discoverableScopeIds = input.scopeSummaries
    .filter(
      (scopeSummary) =>
        scopeSummary.isDiscoverable &&
        !homeScopeIds.includes(scopeSummary.id) &&
        !associatedScopeIds.includes(scopeSummary.id) &&
        !followedScopeIds.includes(scopeSummary.id)
    )
    .map((scopeSummary) => scopeSummary.id);
  const eligibleMainScopeIds = new Set(
    [...homeScopeIds, ...associatedScopeIds, ...followedScopeIds]
  );
  const preferredMainScopeIds = Array.from(
    new Set(
      input.preferences.main_visible_scope_packet_ids
        .map((packetId) => scopeIdByPacketId.get(packetId) ?? null)
        .filter((scopeId): scopeId is string => Boolean(scopeId))
        .filter((scopeId) => eligibleMainScopeIds.has(scopeId))
    )
  );
  const mainScopeIds = preferredMainScopeIds.length > 0
    ? preferredMainScopeIds
    : homeScopeIds;
  const mainVisibleScopePacketIds = mainScopeIds
    .map((scopeId) => scopeSummaryById.get(scopeId)?.packetId ?? null)
    .filter((packetId): packetId is string => Boolean(packetId));

  return {
    homeGraph: buildNexusProjectedScopeSection({
      id: 'home',
      title: 'Home scopes',
      scopeSummaries: input.scopeSummaries,
      directScopeIds: homeScopeIds,
      showParentChains: false,
    }),
    associatedGraph: buildNexusProjectedScopeSection({
      id: 'associated',
      title: 'Associated scopes',
      scopeSummaries: input.scopeSummaries,
      directScopeIds: associatedScopeIds,
      showParentChains: input.preferences.show_associated_parent_chains,
    }),
    followedGraph: buildNexusProjectedScopeSection({
      id: 'followed',
      title: 'Followed scopes',
      scopeSummaries: input.scopeSummaries,
      directScopeIds: followedScopeIds,
      showParentChains: input.preferences.show_followed_parent_chains,
    }),
    mainGraph: buildNexusProjectedScopeSection({
      id: 'main',
      title: 'Main tree',
      scopeSummaries: input.scopeSummaries,
      directScopeIds: mainScopeIds,
      showParentChains: true,
    }),
    mainVisibleScopePacketIds,
    discoverableSection: buildNexusProjectedScopeSection({
      id: 'discoverable',
      title: 'Discoverable scopes',
      scopeSummaries: input.scopeSummaries,
      directScopeIds: discoverableScopeIds,
      showParentChains: false,
    }),
  };
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

  if (!actorPacket || actorPacket.header.type !== 'Element') {
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
        scopeSummaries: [],
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
      associationKind:
        scopeGraph.associationKindByRouteId.get(scopeNode.routeId) ?? null,
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
    scopeSummaries,
  };
}

function parseTrustPolicyFromPacket(
  packet: PacketEnvelopeByType['Policy']
): NexusTrustPolicySnapshot | null {
  if (packet.body.subtype !== 'trust_baseline' || !packet.body.trust_policy) {
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
  const policyPackets = await services.packetStore.listPreferredPacketsByType('Policy');
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

  return input.claimPacket.body.scope_ref?.packet_id === input.scopePacketId;
}

function getRoleClaimTrustStage(input: {
  hasAssociationRelation: boolean;
  associationSupportCount: number;
  roleSupportCount: number;
  thresholds: NexusTrustPolicySnapshot;
}): ReturnType<typeof deriveTrustStage> {
  return deriveTrustStage({
    has_association_relation: input.hasAssociationRelation,
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
  const scopeDisplayPreferences = await readScopeDisplayPreferences({
    packetStore: services.packetStore,
    request: request ?? null,
    actorPacketId: actorPacketId ?? null,
  });
  const elementPreferenceProjection = actorPacketId
    ? await readElementPreferencePacket({
        packetStore: services.packetStore,
        actorPacketId,
      })
    : null;
  const shellChromePreferences = normalizeShellChromePreferenceValue(
    elementPreferenceProjection?.shell_chrome ??
      readShellChromePreferencesCompatibility(
        request ?? null,
        actorPacketId ?? null
      )
  );
  const scopeGraph = await buildNexusScopeGraphProjection({
    packetStore: services.packetStore,
    actorPacketId: actorPacketId ?? null,
    request: request ?? null,
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
  const baseScopeSummaries: NexusScopeSummary[] = [];

  for (const scopeNode of scopeGraph.nodes) {
    const scopeLens = buildScopeLens(scopeNode.routeId, scopeMap);
    const [voteCards, discussionCards, missionCards] = await Promise.all([
      services.nexusQueryService.listVotes(scopeLens),
      services.nexusQueryService.listDiscussions(scopeLens),
      services.nexusQueryService.listLibraryPackets(scopeLens, 'Action'),
    ]);
    const memberPackets =
      await services.packetStore.listPreferredPacketsByType('Element');
    const membersInScope = memberPackets.filter(
      (memberPacket) =>
        memberPacket.body.subtype === 'person' &&
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
        discussionCard.type === 'Discussion' &&
        discussionCard.title.toLowerCase().includes('visitor lobby')
    );

    baseScopeSummaries.push(buildScopeSummaryFromGraph({
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
      associationKind:
        scopeGraph.associationKindByRouteId.get(scopeNode.routeId) ?? null,
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

  const actorPacket = await getActorElementPacket(actorPacketId ?? null);
  const personalScopeSummary =
    actorPacket && actorPacketId
      ? buildScopeGraphPersonalScopeSummary({
          actorPacket,
          parentScopeId: scopeGraph.personalParentScopeId,
        })
      : null;
  const scopeSummaries = [...baseScopeSummaries];

  if (personalScopeSummary) {
    const personalParentScopeId =
      personalScopeSummary.parentId ?? scopeGraph.defaultScopeId ?? null;

    if (personalParentScopeId) {
      for (let index = 0; index < scopeSummaries.length; index += 1) {
        if (scopeSummaries[index]?.id === personalParentScopeId) {
          scopeSummaries[index] = {
            ...scopeSummaries[index],
            childIds: Array.from(
              new Set([
                ...scopeSummaries[index].childIds,
                personalScopeSummary.id,
              ])
            ),
          };
        }
      }
    }

    scopeSummaries.push(personalScopeSummary);
  }

  scopeSummaries.sort((leftScope, rightScope) => leftScope.name.localeCompare(rightScope.name));

  const defaultScopeId = scopeGraph.defaultScopeId || scopeSummaries[0]?.id || '';
  const defaultScope = getScopeByIdOrDefault(scopeSummaries, defaultScopeId);
  const personalParentScopeId = scopeGraph.personalParentScopeId ?? defaultScope.id;
  const defaultExpandedScopeIds = scopeSummaries
    .filter(
      (scopeSummary) => scopeSummary.isMounted && scopeSummary.childIds.length > 0
    )
    .map((scopeSummary) => scopeSummary.id);
  const {
    homeGraph,
    associatedGraph,
    followedGraph,
    mainGraph,
    discoverableSection,
    mainVisibleScopePacketIds,
  } = buildShellGraphSections({
    scopeSummaries,
    preferences: scopeDisplayPreferences,
  });

  return {
    scope_summaries: scopeSummaries,
    default_scope_id: defaultScope.id,
    default_expanded_scope_ids: defaultExpandedScopeIds,
    geographic_mounted_scope_ids: scopeGraph.geographicMountedScopeIds,
    associated_scope_ids: Array.from(scopeGraph.associatedScopeIds),
    followed_scope_ids: Array.from(scopeGraph.followedScopeIds),
    main_visible_scope_packet_ids: mainVisibleScopePacketIds,
    shell_chrome: shellChromePreferences,
    known_scope_ids: Array.from(scopeGraph.knownScopeIds),
    known_unmounted_scope_ids: scopeGraph.knownUnmountedScopeIds,
    personal_parent_scope_id: personalParentScopeId,
    home_scope_id: scopeGraph.homeScopeId,
    home_graph: homeGraph,
    associated_graph: associatedGraph,
    followed_graph: followedGraph,
    main_graph: mainGraph,
    discoverable_section: discoverableSection,
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
  const [localLibraryCards, residentCount] = await Promise.all([
    services.nexusQueryService.listLibraryPackets(scopeLens, undefined, {
      scope_mode: 'local',
    }),
    countResidentsInScopeTree({
      packetStore: services.packetStore,
      scopeResolution,
    }),
  ]);
  const voteCards = localLibraryCards.filter(
    (libraryCard) =>
      libraryCard.type === 'Proposal' ||
      libraryCard.type === 'Reaction' ||
      libraryCard.type === 'Decision'
  );
  const discussionCards = localLibraryCards.filter(
    (libraryCard) => libraryCard.type === 'Discussion'
  );
  const discussionPackets = await Promise.all(
    discussionCards.map((discussionCard) =>
      services.packetStore.fetchByPacket(discussionCard.packet)
    )
  );
  const discussionCardKinds = new Map(
    discussionCards.map((discussionCard, index) => [
      discussionCard.packet.packet_id,
      classifyDashboardDiscussionCard({
        card: discussionCard,
        packet: discussionPackets[index] ?? null,
      }),
    ])
  );
  const rootPostCount = discussionCards.filter(
    (discussionCard) =>
      discussionCardKinds.get(discussionCard.packet.packet_id) === 'root_post'
  ).length;
  const topicThreadCount = discussionCards.filter(
    (discussionCard) =>
      discussionCardKinds.get(discussionCard.packet.packet_id) === 'thread'
  ).length;
  const threadCount = rootPostCount > 0 ? rootPostCount : topicThreadCount;
  const replyCount = discussionCards.filter(
    (discussionCard) =>
      discussionCardKinds.get(discussionCard.packet.packet_id) === 'reply'
  ).length;
  const discussionPreviewCards = discussionCards.filter(
    (discussionCard) =>
      discussionCardKinds.get(discussionCard.packet.packet_id) === 'root_post'
  );
  const proposalCount = voteCards.filter(
    (voteCard) => voteCard.type === 'Proposal'
  ).length;
  const decisionCount = voteCards.filter(
    (voteCard) => voteCard.type === 'Decision'
  ).length;
  const petitionCount = voteCards.filter(
    (voteCard) => toStatusCategory(voteCard.status ?? voteCard.label) === 'petitioning'
  ).length;
  const associationCount = localLibraryCards.filter(
    (libraryCard) =>
      (libraryCard.type === 'Claim' || libraryCard.type === 'Relation') &&
      isAssociationCardText(libraryCard)
  ).length;
  const trustReviewTypes = new Set<PacketType>([
    'Claim',
    'Relation',
    'Reaction',
    'Policy',
  ]);
  const rolePreviewTypes = new Set<PacketType>(['Role', 'Claim', 'Reaction']);
  const trustReviewCards = localLibraryCards.filter((libraryCard) =>
    trustReviewTypes.has(libraryCard.type)
  );
  const rolePreviewCards = localLibraryCards.filter((libraryCard) =>
    rolePreviewTypes.has(libraryCard.type)
  );
  return {
    lens: scopeLens,
    metrics: [
      {
        id: 'packets',
        title: 'Packets',
        value: localLibraryCards.length.toString(),
        detail: 'Current-scope packet revisions.',
        tone: 'sky',
      },
      {
        id: 'residents',
        title: 'Residents',
        value: residentCount.toString(),
        detail: 'Home-locality residents in this scope tree.',
        tone: 'mint',
      },
      {
        id: 'associates',
        title: 'Associates',
        value: associationCount.toString(),
        detail: 'Current-scope association claims and relations.',
        tone: 'gold',
      },
      {
        id: 'threads',
        title: 'Threads',
        value: threadCount.toString(),
        detail: 'Current-scope discussion thread packets.',
        tone: 'sky',
      },
      {
        id: 'replies',
        title: 'Replies',
        value: replyCount.toString(),
        detail: 'Current-scope discussion reply packets.',
        tone: 'mint',
      },
      {
        id: 'petitions',
        title: 'Petitions',
        value: petitionCount.toString(),
        detail: 'Petition-stage packets.',
        tone: 'gold',
      },
      {
        id: 'proposals',
        title: 'Proposals',
        value: proposalCount.toString(),
        detail: 'Proposal packets.',
        tone: 'rose',
      },
      {
        id: 'decisions',
        title: 'Decisions',
        value: decisionCount.toString(),
        detail: 'Decision packets.',
        tone: 'sky',
      },
    ],
    recent_activity_packets: localLibraryCards.slice(0, 6),
    queue: localLibraryCards.slice(0, 6).map((queueCard, index) => ({
      id: queueCard.packet.packet_id,
      title: queueCard.title,
      detail: queueCard.summary ?? 'No summary available yet.',
      stat: queueCard.status ?? queueCard.label,
      created_at: queueCard.created_at,
      tone: (['sky', 'mint', 'gold', 'rose'][index % 4] ?? 'sky') as
        | 'sky'
        | 'mint'
        | 'gold'
        | 'rose',
    })),
    discussion_preview_packets: discussionPreviewCards.slice(0, 4),
    role_preview_packets: rolePreviewCards.slice(0, 4),
    trust_review_packets: trustReviewCards.slice(0, 4),
    vote_preview_packets: voteCards.slice(0, 4),
    recommended_packets: trustReviewCards.slice(0, 4),
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
  focusPacketId?: string | null;
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
    focus_packet_id: input.focusPacketId ?? null,
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
  targetPacketId?: string | null;
  focusPacketId?: string | null;
  highlightPacketId?: string | null;
  replyTargetPacketId?: string | null;
  replySort?: DiscussionReplySort | null;
  showHidden?: boolean;
  viewerActorKey?: string | null;
  feedLimit?: number | null;
  replyLimit?: number | null;
}): Promise<NexusDiscussionWorkspacePayload> {
  const services = await getNexusPacketServices();
  const navigationTargetPacketId = input.targetPacketId ?? input.postPacketId ?? null;
  const navigationTarget = navigationTargetPacketId
    ? await services.discussionService.resolveNavigationTarget({
        scope_id: input.scopeId,
        packet_id: navigationTargetPacketId,
      })
    : null;
  const resolvedForumId = navigationTarget?.forum_id ?? input.forumId ?? null;
  const resolvedPostPacketId =
    navigationTarget?.root_post_packet_id ?? input.postPacketId ?? null;
  const resolvedFocusPacketId =
    input.highlightPacketId ??
    input.focusPacketId ??
    navigationTarget?.highlight_packet_id ??
    navigationTarget?.focus_packet_id ??
    input.postPacketId ??
    null;
  const resolvedView =
    input.view ?? (resolvedPostPacketId ? 'thread' : 'feed');
  const feed = await services.discussionService.getForumFeed({
    scope_id: input.scopeId,
    forum_id: resolvedForumId,
    sort: input.sort ?? null,
    show_hidden: input.showHidden ?? false,
    viewer_actor_key: input.viewerActorKey ?? null,
    limit: input.feedLimit ?? null,
  });
  const thread =
    resolvedPostPacketId
      ? await services.discussionService.getThreadDetail({
          scope_id: input.scopeId,
          post_packet_id: resolvedPostPacketId,
          focus_packet_id: resolvedFocusPacketId,
          reply_sort: input.replySort ?? null,
          show_hidden: input.showHidden ?? false,
          viewer_actor_key: input.viewerActorKey ?? null,
          limit: input.replyLimit ?? null,
        })
      : null;
  const workspace = await services.discussionService.getWorkspace({
    scope_id: input.scopeId,
    forum_id: resolvedForumId,
    sort: input.sort ?? null,
    view: resolvedView,
    post_packet_id: resolvedPostPacketId,
    focus_packet_id: resolvedFocusPacketId,
    highlight_packet_id:
      input.highlightPacketId ?? navigationTarget?.highlight_packet_id ?? null,
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
 * Inputs: scope id and optional type filter.
 * Output: packet library cards for the scope lens.
 */
export async function getNexusLibraryPayload(input: {
  scopeId: string;
  typeFilter: PacketType | null;
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
    input.typeFilter ?? undefined,
    {
      scope_mode: 'local',
    }
  );

  return {
    lens: scopeLens,
    type_filter: input.typeFilter,
    packets,
  };
}

/**
 * Inputs: unknown type query value.
 * Output: a validated packet type filter or null.
 */
export function parseTypeFilter(value: unknown): PacketType | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return (PACKET_TYPES as readonly string[]).includes(value)
    ? (value as PacketType)
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
  const rolePackets = await services.packetStore.listPreferredPacketsByType('Role');
  const trustPolicy = await getTrustPolicyForScope(scopeLens);
  const assemblyPacketId = getClaimAuthorityScopeId({
    scopeSummary: scopeResolution.summary,
    actorPacket,
    shellPayload,
  });
  const claimPackets = await listClaimPackets(services.packetStore);
  const relationPackets = await listRelationPackets(services.packetStore);
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
  const associationRelations =
    actorPacket?.header.packet_id
      ? await services.reactionService.listAssociationRelationsForActor(
          actorPacket.header.packet_id
        )
      : [];
  const activeAssociationRelation = assemblyPacketId
    ? associationRelations.find(
        (relation) =>
          relation.target_packet_id === assemblyPacketId &&
          relation.status === 'active'
      ) ?? null
    : null;
  const actorRoleParticipationRelations = filterRelationPackets({
    relations: relationPackets,
    relationSubtype: 'participation',
    subjectPacketId: actorPacket?.header.packet_id ?? null,
    scopePacketId: assemblyPacketId,
    activeOnly: true,
  });
  const roleCards: NexusTrustRoleProjection[] = [];

  for (const rolePacket of rolePackets) {
    const typedRolePacket = rolePacket as PacketEnvelopeByType['Role'];
    const scopedRelation =
      actorRoleParticipationRelations.find(
        (relationPacket) =>
          relationPacket.body.target_ref.packet_id === typedRolePacket.header.packet_id
      ) ?? null;
    const supportEdges =
      scopedRelation
        ? await services.reactionService.listTargetReactions({
            target_packet_id: scopedRelation.header.packet_id,
            attestation_value: 'support',
            active_only: true,
          })
        : [];
    const disputeEdges =
      scopedRelation
        ? await services.reactionService.listTargetReactions({
            target_packet_id: scopedRelation.header.packet_id,
            attestation_value: 'dispute',
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
      claim_packet_id: scopedRelation?.header.packet_id ?? null,
      claim_status: scopedRelation?.body.status ?? null,
      claimed_scope_packet_id: scopedRelation?.body.scope_ref?.packet_id ?? null,
      role_packet_id: typedRolePacket.header.packet_id,
      title: typedRolePacket.body.title,
      role_kind: typedRolePacket.body.subtype,
      summary: typedRolePacket.body.summary ?? null,
      responsibility_markdown: typedRolePacket.body.responsibility_markdown,
      is_claimed: scopedRelation !== null,
      support_count: scopedSupportEdges.length,
      dispute_count: scopedDisputeEdges.length,
      stage:
        scopedSupportEdges.length >= trustPolicy.role_support_threshold
          ? 'role_eligible'
          : scopedRelation !== null
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
    has_association_relation: activeAssociationRelation !== null,
    association_support_count: activeAssociationRelation?.supported_by_other_count ?? 0,
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
    residence: {
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
    association_relations:
      assemblyPacketId !== null
        ? associationRelations.filter(
            (relation) => relation.target_packet_id === assemblyPacketId
          )
        : associationRelations,
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
    await services.packetStore.listPreferredPacketsByType('Role')
  ) as PacketEnvelopeByType['Role'][];
  const elementPackets = (
    await services.packetStore.listPreferredPacketsByType('Element')
  ) as PacketEnvelopeByType['Element'][];
  const relationPackets = await listRelationPackets(services.packetStore);
  const currentActorPacketId = actorPacket?.header.packet_id ?? null;
  const eligibleParticipants = elementPackets.filter((packet) =>
    ['person', 'assembly', 'team'].includes(packet.body.subtype)
  );
  const associationRelationsByActor = new Map<
    string,
    AssociationRelationProjection[]
  >();

  for (const participantPacket of eligibleParticipants) {
    if (participantPacket.body.subtype !== 'person') {
      continue;
    }

    associationRelationsByActor.set(
      participantPacket.header.packet_id,
      await services.reactionService.listAssociationRelationsForActor(
        participantPacket.header.packet_id
      )
    );
  }

  const roleCards: NexusRoleCardProjection[] = [];

  for (const rolePacket of rolePackets) {
    const participants: NexusRoleParticipantProjection[] = [];
    const roleParticipationRelations = filterRelationPackets({
      relations: relationPackets,
      relationSubtype: 'participation',
      targetPacketId: rolePacket.header.packet_id,
      scopePacketId: assemblyPacketId,
      activeOnly: true,
    });

    for (const relationPacket of roleParticipationRelations) {
      const participantPacketId = relationPacket.body.subject_ref.packet_id;
      const participantPacket = eligibleParticipants.find(
        (packet) => packet.header.packet_id === participantPacketId
      );

      if (!participantPacket) {
        continue;
      }

      const participantAssociationRelations =
        associationRelationsByActor.get(participantPacket.header.packet_id) ?? [];
      const activeAssociationRelation =
        assemblyPacketId === null
          ? participantAssociationRelations.find((relation) => relation.status === 'active') ?? null
          : participantAssociationRelations.find(
              (relation) =>
                relation.target_packet_id === assemblyPacketId &&
                relation.status === 'active'
            ) ?? null;
      const matchesAuthorityScope =
        assemblyPacketId !== null &&
        participantPacket.header.authority_scope_ref?.packet_id === assemblyPacketId;
      const hasScopeAssociation =
        assemblyPacketId === null
          ? true
          : matchesAuthorityScope || activeAssociationRelation !== null;
      const associationSupportCount =
        activeAssociationRelation?.supported_by_other_count ?? 0;

      const supportEdges = await services.reactionService.listTargetReactions({
        target_packet_id: relationPacket.header.packet_id,
        attestation_value: 'support',
        active_only: true,
      });
      const disputeEdges = await services.reactionService.listTargetReactions({
        target_packet_id: relationPacket.header.packet_id,
        attestation_value: 'dispute',
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
      const viewerReaction =
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
        hasAssociationRelation: hasScopeAssociation,
        associationSupportCount,
        roleSupportCount: scopedSupportEdges.length,
        thresholds: trustPolicy,
      });
      const scopeTrustStage = deriveTrustStage({
        has_association_relation: hasScopeAssociation,
        association_support_count: associationSupportCount,
        claimed_role_count: 0,
        supported_role_count: 0,
        thresholds: trustPolicy,
      });

      participants.push({
        participation_relation_packet_id: relationPacket.header.packet_id,
        participation_status: relationPacket.body.status,
        actor_packet_id: participantPacket.header.packet_id,
        actor_label: participantPacket.body.name,
        actor_kind: participantPacket.body.subtype,
        is_current_actor: participantPacket.header.packet_id === currentActorPacketId,
        trust_stage: roleTrustStage,
        scope_trust_stage: scopeTrustStage,
        has_scope_association: hasScopeAssociation,
        scope_association_support_count: associationSupportCount,
        support_count: scopedSupportEdges.length,
        dispute_count: scopedDisputeEdges.length,
        viewer_reaction: viewerReaction,
        support_edges: scopedSupportEdges,
        dispute_edges: scopedDisputeEdges,
      });
    }

    participants.sort((leftParticipant, rightParticipant) => {
      if (leftParticipant.is_current_actor !== rightParticipant.is_current_actor) {
        return leftParticipant.is_current_actor ? -1 : 1;
      }

      if (leftParticipant.support_count !== rightParticipant.support_count) {
        return rightParticipant.support_count - leftParticipant.support_count;
      }

      if (leftParticipant.dispute_count !== rightParticipant.dispute_count) {
        return leftParticipant.dispute_count - rightParticipant.dispute_count;
      }

      return leftParticipant.actor_label.localeCompare(rightParticipant.actor_label);
    });

    roleCards.push({
      role_packet_id: rolePacket.header.packet_id,
      title: rolePacket.body.title,
      role_kind: rolePacket.body.subtype,
      summary: rolePacket.body.summary ?? null,
      responsibility_markdown: rolePacket.body.responsibility_markdown ?? null,
      is_participated_by_current_actor:
        currentActorPacketId === null
          ? false
          : roleParticipationRelations.some(
              (relationPacket) =>
                relationPacket.body.subject_ref.packet_id === currentActorPacketId
            ),
      participants,
    });
  }

  roleCards.sort((leftRole, rightRole) => {
    if (
      leftRole.is_participated_by_current_actor !==
      rightRole.is_participated_by_current_actor
    ) {
      return leftRole.is_participated_by_current_actor ? -1 : 1;
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
