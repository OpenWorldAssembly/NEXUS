/**
 * File: discussion-service.ts
 * Description: Projects packet-backed discussion forums, threads, root posts, replies, and attestation-backed reactions from the SQLite packet store.
 */

import { DatabaseSync } from 'node:sqlite';

import {
  assertMutationProofBundle,
  evaluateDiscussionReplyMutation,
  evaluateDiscussionThreadPostMutation,
  type MutationIntent,
} from '@core/auth/mutation-verifier';
import { createTextExcerpt } from '@core/packets/builders';
import {
  areDiscussionPacketIdsEquivalent,
  isCanonicalDiscussionPacketId,
  isDiscussionMessagePacket,
  resolvePreferredDiscussionPacketId,
  toDiscussionOperationalPacketId,
  type DiscussionLegacyFamily,
} from '@core/packets/discussion-compat';
import { interpretPacket } from '@core/packets/packet-interpreter';
import { resolvePacketTarget } from '@core/packets/packet-target-resolver';
import type {
  AttestationService,
  AttestationSummary,
  DiscussionForumProjection,
  DiscussionPostProjection,
  DiscussionQueryService,
  DiscussionReplyProjection,
  DiscussionThreadDetailProjection,
  DiscussionViewerContext,
  DiscussionWorkspaceModel,
  NexusActionMap,
} from '@core/contracts';
import type {
  AttestationValue,
  DiscussionActorClass,
  DiscussionReplySort,
  DiscussionSort,
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import type { MutationProofBundle } from '@core/auth/proof-types';
import { verifyPacketSignature } from '@runtime/nexus/identity-crypto';
import {
  paginateItems,
  resolvePageSize,
} from '@runtime/nexus/server/discussion-service.pagination';
import {
  filterClaimPackets,
  listClaimPackets,
} from '@runtime/nexus/server/claim-utils';
import {
  buildScopeLens,
  getDiscussionForumDisplayTitle,
  getDiscussionForumOrder,
  getPacketScopeRank,
  matchesAuthorityScope,
  selectForumEntry,
  toDiscussionForumId,
  toRouteScopeId,
  type DiscussionEntryPacket,
  type ScopeLens,
  type ScopeNode,
  type VisibleForumEntry,
} from '@runtime/nexus/server/discussion-service.scope';
import type {
  DiscussionPostIndexRecord,
  AttestationIndexRecord,
  AttestationTallyIndexRecord,
} from '@runtime/storage/sqlite-records';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';
import { DISCUSSION_ACTION_DESCRIPTORS } from '@runtime/nexus/discussion-action-contract';

const REDDIT_EPOCH_SECONDS = 1134028003;
const HOT_SCORE_DECAY_SECONDS = 45000;
const DEFAULT_FEED_PAGE_SIZE = 20;
const DEFAULT_REPLY_PAGE_SIZE = 10;

function projectDiscussionLegacyView<TFamily extends DiscussionLegacyFamily>(
  packet: PacketEnvelope,
  targetFamily: TFamily
): PacketEnvelopeByType[TFamily] | null {
  const interpretation = interpretPacket({
    packet,
    target: {
      family: targetFamily,
      mode: 'legacy',
    },
  });

  return (interpretation.interpreted as PacketEnvelopeByType[TFamily] | null) ?? null;
}
const MAX_FEED_PAGE_SIZE = 50;
const MAX_REPLY_PAGE_SIZE = 25;
const DEFAULT_COLLAPSED_REPLY_DEPTH = 5;

type DiscussionState = {
  packetMap: Map<string, PacketEnvelope>;
  scopeMap: Map<string, ScopeNode>;
  discussionSpaceMap: Map<string, PacketEnvelopeByType['DiscussionSpace']>;
  discussionSpaceOperationalMap: Map<string, PacketEnvelopeByType['DiscussionSpace']>;
  forumMap: Map<string, PacketEnvelopeByType['DiscussionForum']>;
  forumOperationalMap: Map<string, PacketEnvelopeByType['DiscussionForum']>;
  threadMap: Map<string, PacketEnvelopeByType['DiscussionThread']>;
  threadOperationalMap: Map<string, PacketEnvelopeByType['DiscussionThread']>;
  rootPostMap: Map<string, PacketEnvelopeByType['DiscussionPost']>;
  rootPostOperationalMap: Map<string, PacketEnvelopeByType['DiscussionPost']>;
  replyMap: Map<string, PacketEnvelopeByType['DiscussionReply']>;
  replyOperationalMap: Map<string, PacketEnvelopeByType['DiscussionReply']>;
  entryMap: Map<string, DiscussionEntryPacket>;
  entryOperationalMap: Map<string, DiscussionEntryPacket>;
  voteSummaryByTarget: Map<string, Omit<AttestationSummary, 'viewer_value'>>;
  viewerVotesByActor: Map<string, Map<string, AttestationValue>>;
  postIndexByPacketId: Map<string, DiscussionPostIndexRecord>;
  voteIndexRows: AttestationIndexRecord[];
  voteTallyRows: AttestationTallyIndexRecord[];
  discussionIndexRows: DiscussionPostIndexRecord[];
};

type DiscussionPostWriteInput = {
  scope_id: string;
  actor_key: string;
  actor_class: DiscussionActorClass;
  actor_packet: PacketEnvelopeByType['Element'];
  proof_bundle: MutationProofBundle;
  intent: Extract<MutationIntent, { kind: 'discussion.thread_post.create' }>;
  signed_thread_packet: PacketEnvelope;
  signed_post_packet: PacketEnvelope;
};

type DiscussionReplyWriteInput = {
  scope_id: string;
  actor_key: string;
  actor_class: DiscussionActorClass;
  actor_packet: PacketEnvelopeByType['Element'];
  proof_bundle: MutationProofBundle;
  intent: Extract<MutationIntent, { kind: 'discussion.reply.create' }>;
  signed_reply_packet: PacketEnvelope;
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
};

function toDiscussionAuthGateReason(
  writeBlockReason: DiscussionViewerContext['write_block_reason']
): 'sign_in_required' | 'community_claim_required' | null {
  if (writeBlockReason === 'signed_actor_required') {
    return 'sign_in_required';
  }

  if (writeBlockReason === 'home_locality_required') {
    return 'community_claim_required';
  }

  return null;
}

function isPersonElementPacket(
  packet: PacketEnvelope | null | undefined
): packet is PacketEnvelopeByType['Element'] {
  return (
    Boolean(packet) &&
    packet?.header.family === 'Element' &&
    (packet as PacketEnvelopeByType['Element']).body.kind === 'person'
  );
}

function getActorKeyFromPacket(packet: PacketEnvelope): string | null {
  const createdByPacketId = packet.header.provenance.created_by?.packet_id ?? null;

  if (!createdByPacketId) {
    return null;
  }

  return `element:${createdByPacketId}`;
}

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

  return 'Anonymous guest';
}

function getActorIdentity(
  actorKey: string | null,
  packetMap?: Map<string, PacketEnvelope>
): ActorIdentity {
  if (!actorKey) {
    return {
      actor_key: actorKey,
      actor_class: 'anonymous_guest',
    };
  }

  if (actorKey.startsWith('element:') && packetMap) {
    const actorPacket = packetMap.get(actorKey.slice('element:'.length));

    if (
      isPersonElementPacket(actorPacket) &&
      actorPacket.body.identity?.claim_status !== 'claimed'
    ) {
      return {
        actor_key: actorKey,
        actor_class: 'anonymous_guest',
      };
    }
  }

  return {
    actor_key: actorKey,
    actor_class: 'scope_member',
  };
}

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

function getHotScore(voteSummary: VoteAggregate, createdAt: string): number {
  const score = voteSummary.net_score;
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const seconds =
    Math.floor(new Date(createdAt).getTime() / 1000) - REDDIT_EPOCH_SECONDS;

  return sign * order + seconds / HOT_SCORE_DECAY_SECONDS;
}

function createVoteSummary(
  voteSummary: Omit<AttestationSummary, 'viewer_value'> | undefined,
  viewerValue: AttestationValue | 0
): AttestationSummary {
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

function getEffectiveParticipationRules(
  forumPacket: PacketEnvelopeByType['DiscussionForum'],
  threadPacket?: PacketEnvelopeByType['DiscussionThread'] | null
): EffectiveParticipationRules {
  if (forumPacket.body.forum_kind === 'visitor_lobby') {
    return {
      top_level_actor_classes: [
        'anonymous_guest',
        'scope_member',
        'trusted_member',
        'steward',
      ],
      reply_actor_classes: [
        'anonymous_guest',
        'scope_member',
        'trusted_member',
        'steward',
      ],
      reaction_actor_classes: [
        'anonymous_guest',
        'scope_member',
        'trusted_member',
        'steward',
      ],
    };
  }

  const forumRules = forumPacket.body.participation_rules;
  const forumHasConfiguredActors =
    forumRules.top_level_actor_classes.length > 0 ||
    forumRules.reply_actor_classes.length > 0 ||
    forumRules.reaction_actor_classes.length > 0;

  if (forumHasConfiguredActors) {
    return {
      top_level_actor_classes: [...forumRules.top_level_actor_classes],
      reply_actor_classes: [...forumRules.reply_actor_classes],
      reaction_actor_classes: [...forumRules.reaction_actor_classes],
    };
  }

  const threadRules = threadPacket?.body.participation_rules;
  const threadHasConfiguredActors =
    (threadRules?.top_level_actor_classes.length ?? 0) > 0 ||
    (threadRules?.reply_actor_classes.length ?? 0) > 0 ||
    (threadRules?.reaction_actor_classes.length ?? 0) > 0;

  if (threadRules && threadHasConfiguredActors) {
    return {
      top_level_actor_classes: [...threadRules.top_level_actor_classes],
      reply_actor_classes: [...threadRules.reply_actor_classes],
      reaction_actor_classes: [...threadRules.reaction_actor_classes],
    };
  }

  return {
    top_level_actor_classes: ['scope_member', 'trusted_member', 'steward'],
    reply_actor_classes: ['scope_member', 'trusted_member', 'steward'],
    reaction_actor_classes: ['scope_member', 'trusted_member', 'steward'],
  };
}

function getEntryThreadPacketId(entryPacket: DiscussionEntryPacket): string {
  return entryPacket.body.thread_ref.packet_id;
}

function isSameDiscussionTarget(
  leftPacketId: string | null | undefined,
  rightPacketId: string | null | undefined
): boolean {
  if (!leftPacketId || !rightPacketId) {
    return false;
  }

  return areDiscussionPacketIdsEquivalent(leftPacketId, rightPacketId);
}

function preferOperationalDiscussionPacket<TPacket extends PacketEnvelope>(
  currentPacket: TPacket | null | undefined,
  nextPacket: TPacket
): TPacket {
  if (!currentPacket) {
    return nextPacket;
  }

  const currentIsCanonical = isCanonicalDiscussionPacketId(
    currentPacket.header.packet_id
  );
  const nextIsCanonical = isCanonicalDiscussionPacketId(nextPacket.header.packet_id);

  if (currentIsCanonical !== nextIsCanonical) {
    return nextIsCanonical ? nextPacket : currentPacket;
  }

  if (nextPacket.header.created_at !== currentPacket.header.created_at) {
    return nextPacket.header.created_at > currentPacket.header.created_at
      ? nextPacket
      : currentPacket;
  }

  return nextPacket.header.packet_id.localeCompare(currentPacket.header.packet_id) < 0
    ? nextPacket
    : currentPacket;
}

function createOperationalDiscussionMap<TPacket extends PacketEnvelope>(
  packets: Iterable<TPacket>
): Map<string, TPacket> {
  const operationalMap = new Map<string, TPacket>();

  for (const packet of packets) {
    const operationalPacketId = toDiscussionOperationalPacketId(
      packet.header.packet_id
    );
    const currentPacket = operationalMap.get(operationalPacketId);

    operationalMap.set(
      operationalPacketId,
      preferOperationalDiscussionPacket(currentPacket, packet)
    );
  }

  return operationalMap;
}

function resolveOperationalDiscussionPacket<TPacket extends PacketEnvelope>(input: {
  packetMap: Map<string, TPacket>;
  operationalMap: Map<string, TPacket>;
  packetId: string;
}): TPacket | null {
  const operationalPacketId = toDiscussionOperationalPacketId(input.packetId);
  const preferredPacketId = resolvePreferredDiscussionPacketId({
    candidate_packet_ids: input.packetMap.keys(),
    requested_packet_id: input.packetId,
  });

  return (
    (preferredPacketId ? input.packetMap.get(preferredPacketId) : null) ??
    input.operationalMap.get(operationalPacketId) ??
    input.packetMap.get(input.packetId) ??
    null
  );
}

function getEntryReplyToPacketId(entryPacket: DiscussionEntryPacket): string | null {
  if (entryPacket.header.family === 'DiscussionReply') {
    return (entryPacket as PacketEnvelopeByType['DiscussionReply']).body.reply_to_ref
      .packet_id;
  }

  return (entryPacket as PacketEnvelopeByType['DiscussionPost']).body.reply_to_ref
    ?.packet_id ?? null;
}

function resolveOperationalRootPostId(input: {
  entryMap: Map<string, DiscussionEntryPacket>;
  entryOperationalMap: Map<string, DiscussionEntryPacket>;
  packetId: string;
}): string {
  const currentEntry = resolveOperationalDiscussionPacket({
    packetMap: input.entryMap,
    operationalMap: input.entryOperationalMap,
    packetId: input.packetId,
  });

  if (!currentEntry) {
    return toDiscussionOperationalPacketId(input.packetId);
  }

  if (currentEntry.header.family === 'DiscussionPost') {
    return currentEntry.header.packet_id;
  }

  const rootPostPacketId = (currentEntry as PacketEnvelopeByType['DiscussionReply']).body
    .root_post_ref.packet_id;
  const operationalRootPacketId = toDiscussionOperationalPacketId(rootPostPacketId);

  return (
    input.entryOperationalMap.get(operationalRootPacketId)?.header.packet_id ??
    operationalRootPacketId
  );
}

function summarizePostTree(input: {
  postPacketId: string;
  childIdsByParent: Map<string, string[]>;
  entriesByPacketId: Map<string, DiscussionEntryPacket>;
}): {
  direct_reply_count: number;
  descendant_count: number;
  last_activity_at: string;
} {
  const childPacketIds = input.childIdsByParent.get(input.postPacketId) ?? [];
  const entryPacket = input.entriesByPacketId.get(input.postPacketId);
  let descendantCount = childPacketIds.length;
  let lastActivityAt = entryPacket?.header.created_at ?? new Date().toISOString();

  for (const childPacketId of childPacketIds) {
    const childSummary = summarizePostTree({
      postPacketId: childPacketId,
      childIdsByParent: input.childIdsByParent,
      entriesByPacketId: input.entriesByPacketId,
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

async function getDiscussionForumById(
  packetStore: NodeSQLitePacketStore,
  forumPacketId: string
): Promise<PacketEnvelopeByType['DiscussionForum'] | null> {
  const resolution = await resolvePacketTarget({
    packet_id: forumPacketId,
    fetchPacket: async (packetId) =>
      packetStore.fetchByPacket({ packet_id: packetId }),
    fetchRevisionHeads: async (packetId) =>
      packetStore.fetchRevisionHeads({ packet_id: packetId }),
  });
  const packet = resolution.resolved_packet ?? resolution.source_packet;

  if (!packet) {
    return null;
  }

  if (packet.header.family !== 'DiscussionForum') {
    return projectDiscussionLegacyView(packet, 'DiscussionForum');
  }

  return packet as PacketEnvelopeByType['DiscussionForum'];
}

async function getDiscussionThreadById(
  packetStore: NodeSQLitePacketStore,
  threadPacketId: string
): Promise<PacketEnvelopeByType['DiscussionThread'] | null> {
  const resolution = await resolvePacketTarget({
    packet_id: threadPacketId,
    fetchPacket: async (packetId) =>
      packetStore.fetchByPacket({ packet_id: packetId }),
    fetchRevisionHeads: async (packetId) =>
      packetStore.fetchRevisionHeads({ packet_id: packetId }),
  });
  const packet = resolution.resolved_packet ?? resolution.source_packet;

  if (!packet) {
    return null;
  }

  if (packet.header.family !== 'DiscussionThread') {
    return projectDiscussionLegacyView(packet, 'DiscussionThread');
  }

  return packet as PacketEnvelopeByType['DiscussionThread'];
}

async function getDiscussionEntryById(
  packetStore: NodeSQLitePacketStore,
  packetId: string
): Promise<DiscussionEntryPacket | null> {
  const resolution = await resolvePacketTarget({
    packet_id: packetId,
    fetchPacket: async (nextPacketId) =>
      packetStore.fetchByPacket({ packet_id: nextPacketId }),
    fetchRevisionHeads: async (nextPacketId) =>
      packetStore.fetchRevisionHeads({ packet_id: nextPacketId }),
  });
  const packet = resolution.resolved_packet ?? resolution.source_packet;

  if (!packet) {
    return null;
  }

  if (isDiscussionMessagePacket(packet)) {
    const asReply = projectDiscussionLegacyView(packet, 'DiscussionReply');

    if (asReply) {
      return asReply as DiscussionEntryPacket;
    }

    return projectDiscussionLegacyView(packet, 'DiscussionPost') as DiscussionEntryPacket | null;
  }

  if (
    packet.header.family !== 'DiscussionPost' &&
    packet.header.family !== 'DiscussionReply'
  ) {
    return null;
  }

  return packet as DiscussionEntryPacket;
}

async function getElementPacketById(
  packetStore: NodeSQLitePacketStore,
  packetId: string | null
): Promise<PacketEnvelopeByType['Element'] | null> {
  if (!packetId) {
    return null;
  }

  const packet = await packetStore.fetchByPacket({ packet_id: packetId });

  if (!packet || packet.header.family !== 'Element') {
    return null;
  }

  return packet as PacketEnvelopeByType['Element'];
}

async function getPolicyPacketsByRefs(
  packetStore: NodeSQLitePacketStore,
  policyRefs: PacketEnvelopeByType['Element']['header']['moderation']['policy_refs']
): Promise<PacketEnvelopeByType['Policy'][]> {
  const packets = await Promise.all(
    policyRefs.map((policyRef) => packetStore.fetchByPacket(policyRef))
  );

  return packets.filter(
    (packet): packet is PacketEnvelopeByType['Policy'] =>
      packet !== null && packet.header.family === 'Policy'
  );
}

export class SQLiteDiscussionService
  implements DiscussionQueryService
{
  private state: DiscussionState | null = null;

  constructor(
    private readonly packetStore: NodeSQLitePacketStore,
    private readonly attestationService: AttestationService
  ) {}

  async syncDerivedState(): Promise<void> {
    await this.attestationService.syncDerivedState();

    const [
      elementPackets,
      discussionSpacePackets,
      discussionForumPackets,
      discussionThreadPackets,
      discussionPostPackets,
      discussionReplyPackets,
      canonicalDiscussionPackets,
      allPackets,
    ] = await Promise.all([
      this.packetStore.listPreferredPacketsByFamily('Element'),
      this.packetStore.listPreferredPacketsByFamily('DiscussionSpace'),
      this.packetStore.listPreferredPacketsByFamily('DiscussionForum'),
      this.packetStore.listPreferredPacketsByFamily('DiscussionThread'),
      this.packetStore.listPreferredPacketsByFamily('DiscussionPost'),
      this.packetStore.listPreferredPacketsByFamily('DiscussionReply'),
      this.packetStore.listPreferredPacketsByFamily('Discussion'),
      this.packetStore.listPreferredPackets(),
    ]);
    const canonicalSpaces = canonicalDiscussionPackets
      .map((packet) => projectDiscussionLegacyView(packet, 'DiscussionSpace'))
      .filter(
        (packet): packet is PacketEnvelopeByType['DiscussionSpace'] =>
          packet !== null
      );
    const canonicalForums = canonicalDiscussionPackets
      .map((packet) => projectDiscussionLegacyView(packet, 'DiscussionForum'))
      .filter(
        (packet): packet is PacketEnvelopeByType['DiscussionForum'] =>
          packet !== null
      );
    const canonicalThreads = canonicalDiscussionPackets
      .map((packet) => projectDiscussionLegacyView(packet, 'DiscussionThread'))
      .filter(
        (packet): packet is PacketEnvelopeByType['DiscussionThread'] =>
          packet !== null
      );
    const canonicalRootPosts = canonicalDiscussionPackets
      .map((packet) => projectDiscussionLegacyView(packet, 'DiscussionPost'))
      .filter(
        (packet): packet is PacketEnvelopeByType['DiscussionPost'] =>
          packet !== null
      );
    const canonicalReplies = canonicalDiscussionPackets
      .map((packet) => projectDiscussionLegacyView(packet, 'DiscussionReply'))
      .filter(
        (packet): packet is PacketEnvelopeByType['DiscussionReply'] =>
          packet !== null
      );

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
    const discussionSpacePacketsAll = [...discussionSpacePackets, ...canonicalSpaces];
    const forumPacketsAll = [...discussionForumPackets, ...canonicalForums];
    const threadPacketsAll = [...discussionThreadPackets, ...canonicalThreads];
    const rootPostPacketsAll = [...discussionPostPackets, ...canonicalRootPosts];
    const replyPacketsAll = [...discussionReplyPackets, ...canonicalReplies];
    const entryPacketsAll = [
      ...rootPostPacketsAll,
      ...replyPacketsAll,
    ] as DiscussionEntryPacket[];
    const discussionSpaceMap = new Map(
      discussionSpacePacketsAll.map((packet) => [packet.header.packet_id, packet])
    );
    const discussionSpaceOperationalMap =
      createOperationalDiscussionMap(discussionSpacePacketsAll);
    const forumMap = new Map(
      forumPacketsAll.map((packet) => [packet.header.packet_id, packet])
    );
    const forumOperationalMap = createOperationalDiscussionMap(forumPacketsAll);
    const threadMap = new Map(
      threadPacketsAll.map((packet) => [packet.header.packet_id, packet])
    );
    const threadOperationalMap = createOperationalDiscussionMap(threadPacketsAll);
    const rootPostMap = new Map(
      rootPostPacketsAll.map((packet) => [packet.header.packet_id, packet])
    );
    const rootPostOperationalMap = createOperationalDiscussionMap(rootPostPacketsAll);
    const replyMap = new Map(
      replyPacketsAll.map((packet) => [packet.header.packet_id, packet])
    );
    const replyOperationalMap = createOperationalDiscussionMap(replyPacketsAll);
    const entryMap = new Map<string, DiscussionEntryPacket>(
      entryPacketsAll.map((packet) => [packet.header.packet_id, packet] as const)
    );
    const entryOperationalMap = createOperationalDiscussionMap(entryPacketsAll);
    const database = new DatabaseSync(this.packetStore.databasePath);
    const voteIndexRows = database
      .prepare(
        `
          SELECT
            attestation_packet_id,
            target_packet_id,
            actor_key,
            attestation_kind,
            value,
            status,
            context_packet_id,
            note,
            created_at,
            updated_at
          FROM attestation_index
        `
      )
      .all() as unknown as AttestationIndexRecord[];
    const voteTallyRows = database
      .prepare(
        `
          SELECT
            target_packet_id,
            upvote_count,
            downvote_count,
            net_score,
            total_votes,
            negative_ratio,
            auto_hidden,
            deprioritized
          FROM attestation_tally_index
        `
      )
      .all() as unknown as AttestationTallyIndexRecord[];
    database.close();

    const viewerVotesByActor = new Map<string, Map<string, AttestationValue>>();

    for (const voteIndexRow of voteIndexRows) {
      if (
        voteIndexRow.status !== 'active' ||
        voteIndexRow.attestation_kind !== 'packet_signal'
      ) {
        continue;
      }

      const actorVotes =
        viewerVotesByActor.get(voteIndexRow.actor_key) ??
        new Map<string, AttestationValue>();

      actorVotes.set(
        voteIndexRow.target_packet_id,
        voteIndexRow.value as AttestationValue
      );
      viewerVotesByActor.set(voteIndexRow.actor_key, actorVotes);
    }

    const voteSummaryByTarget = new Map<
      string,
      Omit<AttestationSummary, 'viewer_value'>
    >(
      voteTallyRows.map((voteTallyRow) => [
        voteTallyRow.target_packet_id,
        {
          upvote_count: voteTallyRow.upvote_count,
          downvote_count: voteTallyRow.downvote_count,
          net_score: voteTallyRow.net_score,
          total_votes: voteTallyRow.total_votes,
          negative_ratio: voteTallyRow.negative_ratio,
          auto_hidden: Boolean(voteTallyRow.auto_hidden),
          deprioritized: Boolean(voteTallyRow.deprioritized),
        },
      ])
    );

    const childIdsByParent = new Map<string, string[]>();

    for (const replyPacket of replyOperationalMap.values()) {
      const parentPacketId = toDiscussionOperationalPacketId(
        replyPacket.body.reply_to_ref.packet_id
      );
      const currentChildIds = childIdsByParent.get(parentPacketId) ?? [];

      currentChildIds.push(replyPacket.header.packet_id);
      childIdsByParent.set(parentPacketId, currentChildIds);
    }

      const discussionIndexRows: DiscussionPostIndexRecord[] = [];
      const postIndexByPacketId = new Map<string, DiscussionPostIndexRecord>();

      for (const entryPacket of entryOperationalMap.values()) {
        const rootPostPacketId = resolveOperationalRootPostId({
          entryMap,
          entryOperationalMap,
          packetId: entryPacket.header.packet_id,
        });
        let depth = 0;
        let currentParentPacketId = getEntryReplyToPacketId(entryPacket);

        while (currentParentPacketId) {
          depth += 1;
          const parentEntry = resolveOperationalDiscussionPacket({
            packetMap: entryMap,
            operationalMap: entryOperationalMap,
            packetId: currentParentPacketId,
          });
          currentParentPacketId = parentEntry
            ? getEntryReplyToPacketId(parentEntry)
            : null;
        }

      const postTreeSummary = summarizePostTree({
        postPacketId: entryPacket.header.packet_id,
        childIdsByParent,
        entriesByPacketId: entryMap,
      });
      const discussionIndexRecord: DiscussionPostIndexRecord = {
        post_packet_id: entryPacket.header.packet_id,
        thread_packet_id: getEntryThreadPacketId(entryPacket),
        root_post_packet_id: rootPostPacketId,
        reply_to_packet_id: getEntryReplyToPacketId(entryPacket),
        depth,
        author_key: getActorKeyFromPacket(entryPacket),
        created_at: entryPacket.header.created_at,
        last_activity_at: postTreeSummary.last_activity_at,
        direct_reply_count: postTreeSummary.direct_reply_count,
        descendant_count: postTreeSummary.descendant_count,
      };

      discussionIndexRows.push(discussionIndexRecord);
      postIndexByPacketId.set(entryPacket.header.packet_id, discussionIndexRecord);
    }

    this.state = {
      packetMap,
      scopeMap,
      discussionSpaceMap,
      discussionSpaceOperationalMap,
      forumMap,
      forumOperationalMap,
      threadMap,
      threadOperationalMap,
      rootPostMap,
      rootPostOperationalMap,
      replyMap,
      replyOperationalMap,
      entryMap,
      entryOperationalMap,
      voteSummaryByTarget,
      viewerVotesByActor,
      postIndexByPacketId,
      voteIndexRows,
      voteTallyRows,
      discussionIndexRows,
    };

    this.persistDerivedState({
      discussionIndexRows,
    });
  }

  private async buildViewerContext(
    forumPacket: PacketEnvelopeByType['DiscussionForum'],
    actorIdentity: ActorIdentity,
    threadPacket?: PacketEnvelopeByType['DiscussionThread'] | null
  ): Promise<DiscussionViewerContext> {
    const actorClass = actorIdentity.actor_class;
    const actorPacketId = actorIdentity.actor_key?.startsWith('element:')
      ? actorIdentity.actor_key.slice('element:'.length)
      : null;
    const requiresMembership = forumPacket.body.forum_kind !== 'visitor_lobby';
    const assemblyPacketId = forumPacket.header.authority_scope_ref?.packet_id ?? null;
    const hasSignedActor = Boolean(actorPacketId);
    const hasHomeLocalityAccess =
      requiresMembership && actorPacketId && assemblyPacketId
        ? await this.hasActiveHomeLocalityAccess({
            actorPacketId,
            scopePacketId: assemblyPacketId,
          })
        : false;
    const hasForumAccess =
      requiresMembership ? hasHomeLocalityAccess : hasSignedActor;
    const writeBlockReason: DiscussionViewerContext['write_block_reason'] =
      hasForumAccess
        ? 'none'
        : requiresMembership
          ? 'home_locality_required'
          : 'signed_actor_required';

    return {
      actor_key: actorIdentity.actor_key,
      actor_class: actorClass,
      can_create_top_level: hasForumAccess,
      can_reply: hasForumAccess,
      can_vote: hasForumAccess,
      write_block_reason: writeBlockReason,
    };
  }

  private async hasActiveHomeLocalityAccess(input: {
    actorPacketId: string;
    scopePacketId: string;
  }): Promise<boolean> {
    if (!this.state) {
      return false;
    }

    const homeClaims = filterClaimPackets({
      claims: await listClaimPackets(this.packetStore),
      claimKind: 'home_locality',
      subjectPacketId: input.actorPacketId,
      activeOnly: true,
    });
    const scopeByPacketId = new Map(
      Array.from(this.state.scopeMap.values()).map((scopeNode) => [
        scopeNode.packetId,
        scopeNode,
      ])
    );

    for (const homeClaim of homeClaims) {
      let currentScope =
        scopeByPacketId.get(homeClaim.body.target_ref.packet_id) ?? null;

      while (currentScope) {
        if (currentScope.packetId === input.scopePacketId) {
          return true;
        }

        currentScope = currentScope.parentRouteId
          ? this.state.scopeMap.get(currentScope.parentRouteId) ?? null
          : null;
      }
    }

    return false;
  }

  private async verifySignedCandidatePacket<TPacket extends PacketEnvelope>(
    packet: TPacket,
    actorPacket: PacketEnvelopeByType['Element']
  ): Promise<void> {
    if (
      packet.header.integrity.embedded_signatures[0]?.signer_packet_ref?.packet_id !==
      actorPacket.header.packet_id
    ) {
      throw new Error('Signed mutation packet signature does not match the actor packet.');
    }

    const signatureIsValid = await verifyPacketSignature({
      packet,
      signerPacket: actorPacket,
    });

    if (!signatureIsValid) {
      throw new Error('Signed mutation packet signature verification failed.');
    }
  }

  async getForumFeed(input: {
    scope_id: string;
    forum_id: string | null;
    sort: DiscussionSort | null;
    show_hidden: boolean;
    viewer_actor_key: string | null;
    cursor?: string | null;
    limit?: number | null;
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
          can_create_top_level: false,
          can_reply: false,
          can_vote: false,
          write_block_reason: 'signed_actor_required' as const,
        },
        top_level_posts: [],
        next_cursor: null,
        has_more: false,
      };
    }

    const actorIdentity = getActorIdentity(
      input.viewer_actor_key,
      this.state.packetMap
    );
    const viewer = await this.buildViewerContext(
      selectedForum.forumPacket,
      actorIdentity
    );
    const selectedSort =
      input.sort ?? selectedForum.forumPacket.body.default_sort ?? 'new';
    const topLevelPosts = Array.from(this.state.rootPostOperationalMap.values())
        .filter((rootPostPacket) => {
          const threadPacket = resolveOperationalDiscussionPacket({
            packetMap: this.state?.threadMap ?? new Map(),
            operationalMap: this.state?.threadOperationalMap ?? new Map(),
            packetId: rootPostPacket.body.thread_ref.packet_id,
          });

        return (
          isSameDiscussionTarget(
            threadPacket?.body.forum_ref.packet_id,
            selectedForum.forumPacket.header.packet_id
          )
        );
      })
      .map((rootPostPacket) =>
        this.toDiscussionPostProjection(
          rootPostPacket,
          actorIdentity.actor_key,
          viewer
        )
      )
      .filter((postProjection) => input.show_hidden || !postProjection.is_hidden)
      .sort((leftPost, rightPost) =>
        this.comparePosts(leftPost, rightPost, selectedSort)
      );
    const pagedPosts = paginateItems({
      items: topLevelPosts,
      cursor: input.cursor ?? null,
      limit: resolvePageSize(
        input.limit ?? null,
        DEFAULT_FEED_PAGE_SIZE,
        MAX_FEED_PAGE_SIZE
      ),
    });

    return {
      lens: scopeLens,
      forums: forumEntries.map((forumEntry) =>
        this.toDiscussionForumProjection(
          forumEntry.discussionSpacePacket,
          forumEntry.forumPacket,
          forumEntry.displayTitle
        )
      ),
      selected_forum_id: selectedForum.forumId,
      selected_sort: selectedSort,
      show_hidden: input.show_hidden,
      viewer,
      top_level_posts: pagedPosts.items,
      next_cursor: pagedPosts.next_cursor,
      has_more: pagedPosts.has_more,
    };
  }

  async getThreadDetail(input: {
    scope_id: string;
    post_packet_id: string;
    reply_sort: DiscussionReplySort | null;
    show_hidden: boolean;
    viewer_actor_key: string | null;
    cursor?: string | null;
    limit?: number | null;
  }): Promise<DiscussionThreadDetailProjection> {
    await this.syncDerivedState();

    if (!this.state) {
      throw new Error('Discussion state is unavailable.');
    }

    const canonicalRootPostId = resolveOperationalRootPostId({
      entryMap: this.state.entryMap,
      entryOperationalMap: this.state.entryOperationalMap,
      packetId: input.post_packet_id,
    });
    const rootPostPacket = this.state.rootPostOperationalMap.get(
      canonicalRootPostId
    );

    if (!rootPostPacket) {
      throw new Error(`Unknown discussion post: ${input.post_packet_id}`);
    }

    const threadPacket = resolveOperationalDiscussionPacket({
      packetMap: this.state.threadMap,
      operationalMap: this.state.threadOperationalMap,
      packetId: rootPostPacket.body.thread_ref.packet_id,
    });

    if (!threadPacket) {
      throw new Error(
        `Missing discussion thread for post ${input.post_packet_id}.`
      );
    }

    const forumPacket = resolveOperationalDiscussionPacket({
      packetMap: this.state.forumMap,
      operationalMap: this.state.forumOperationalMap,
      packetId: threadPacket.body.forum_ref.packet_id,
    });

    if (!forumPacket) {
      throw new Error(
        `Missing discussion forum for thread ${threadPacket.header.packet_id}.`
      );
    }

    const discussionSpacePacket = resolveOperationalDiscussionPacket({
      packetMap: this.state.discussionSpaceMap,
      operationalMap: this.state.discussionSpaceOperationalMap,
      packetId: forumPacket.body.discussion_space_ref.packet_id,
    });

    if (!discussionSpacePacket) {
      throw new Error(
        `Missing discussion space for forum ${forumPacket.header.packet_id}.`
      );
    }

    const scopeLens = buildScopeLens(input.scope_id, this.state.scopeMap);
    const scopePacketId = scopeLens.authority_scope_ref?.packet_id ?? null;
    const activeScopeNode = Array.from(this.state.scopeMap.values()).find(
      (scopeNode) => scopeNode.packetId === scopePacketId
    );
    const activeScopeName = activeScopeNode?.name ?? 'Scope';
    const forumEntries = this.getVisibleForums(scopeLens, activeScopeName);
    const matchingForum =
      forumEntries.find(
        (forumEntry) =>
          isSameDiscussionTarget(
            forumEntry.forumPacket.header.packet_id,
            forumPacket.header.packet_id
          )
      ) ?? null;

    if (!matchingForum) {
      throw new Error(`Unknown discussion forum for post ${input.post_packet_id}.`);
    }

    const actorIdentity = getActorIdentity(
      input.viewer_actor_key,
      this.state.packetMap
    );
    const viewer = await this.buildViewerContext(
      forumPacket,
      actorIdentity,
      threadPacket
    );
    const selectedReplySort = input.reply_sort ?? 'top';
    const rootPostProjection = this.toDiscussionPostProjection(
      rootPostPacket,
      actorIdentity.actor_key,
      viewer
    );
    const rootReplyPage = this.getReplyChildrenPage({
      root_post_packet_id: rootPostPacket.header.packet_id,
      parent_post_packet_id: rootPostPacket.header.packet_id,
      reply_sort: selectedReplySort,
      show_hidden: input.show_hidden,
      viewer_actor_key: actorIdentity.actor_key,
      viewer,
      cursor: input.cursor ?? null,
      limit: input.limit ?? null,
    });

    return {
      lens: scopeLens,
      forum: this.toDiscussionForumProjection(
        discussionSpacePacket,
        forumPacket,
        matchingForum.displayTitle
      ),
      selected_reply_sort: selectedReplySort,
      show_hidden: input.show_hidden,
      viewer,
      root_post: rootPostProjection,
      replies: rootReplyPage.replies,
      next_cursor: rootReplyPage.next_cursor,
      has_more: rootReplyPage.has_more,
    };
  }

  async getReplyChildren(input: {
    scope_id: string;
    thread_post_packet_id: string;
    parent_post_packet_id: string;
    reply_sort: DiscussionReplySort | null;
    show_hidden: boolean;
    viewer_actor_key: string | null;
    cursor?: string | null;
    limit?: number | null;
  }) {
    await this.syncDerivedState();

    if (!this.state) {
      throw new Error('Discussion state is unavailable.');
    }

    const rootPostPacket = this.state.rootPostOperationalMap.get(
      resolveOperationalRootPostId({
        entryMap: this.state.entryMap,
        entryOperationalMap: this.state.entryOperationalMap,
        packetId: input.thread_post_packet_id,
      })
    );
    const threadPacket = rootPostPacket
      ? resolveOperationalDiscussionPacket({
          packetMap: this.state.threadMap,
          operationalMap: this.state.threadOperationalMap,
          packetId: rootPostPacket.body.thread_ref.packet_id,
        })
      : null;
    const forumPacket = threadPacket
      ? resolveOperationalDiscussionPacket({
          packetMap: this.state.forumMap,
          operationalMap: this.state.forumOperationalMap,
          packetId: threadPacket.body.forum_ref.packet_id,
        })
      : null;
    const scopeLens = buildScopeLens(input.scope_id, this.state.scopeMap);

    if (!forumPacket || !matchesAuthorityScope(forumPacket, scopeLens)) {
      throw new Error('This discussion thread is not available from the current scope.');
    }

    return this.getReplyChildrenPage({
      root_post_packet_id: input.thread_post_packet_id,
      parent_post_packet_id: input.parent_post_packet_id,
      reply_sort: input.reply_sort ?? null,
      show_hidden: input.show_hidden,
      viewer_actor_key: input.viewer_actor_key,
      viewer: forumPacket
        ? await this.buildViewerContext(
            forumPacket,
            getActorIdentity(input.viewer_actor_key, this.state.packetMap),
            threadPacket
          )
        : null,
      cursor: input.cursor ?? null,
      limit: input.limit ?? null,
    });
  }

  async getWorkspace(input: {
    scope_id: string;
    forum_id: string | null;
    view: 'feed' | 'thread' | 'post';
    post_packet_id: string | null;
    reply_target_packet_id: string | null;
    sort: DiscussionSort | null;
    reply_sort: DiscussionReplySort | null;
    show_hidden: boolean;
    viewer_actor_key: string | null;
    feed_limit?: number | null;
    reply_limit?: number | null;
  }): Promise<DiscussionWorkspaceModel> {
    const feed = await this.getForumFeed({
      scope_id: input.scope_id,
      forum_id: input.forum_id,
      sort: input.sort,
      show_hidden: input.show_hidden,
      viewer_actor_key: input.viewer_actor_key,
      limit: input.feed_limit ?? null,
    });
    const selectedForum =
      feed.forums.find((forum) => forum.id === feed.selected_forum_id) ?? null;
    const thread =
      input.post_packet_id
        ? await this.getThreadDetail({
            scope_id: input.scope_id,
            post_packet_id: input.post_packet_id,
            reply_sort: input.reply_sort,
            show_hidden: input.show_hidden,
            viewer_actor_key: input.viewer_actor_key,
            limit: input.reply_limit ?? null,
          })
        : null;
    const viewer = thread?.viewer ?? feed.viewer ?? null;
    const replyTargetPacketId = input.reply_target_packet_id ?? null;
    const selectedThreadPacketId =
      thread?.root_post.packet.packet_id ?? input.post_packet_id ?? null;
    const feedItems = feed.top_level_posts.map((postProjection) =>
      this.withDiscussionNodeState(postProjection, {
        is_selected_thread:
          selectedThreadPacketId === postProjection.packet.packet_id,
      })
    );
    const threadRoot = thread
      ? this.withDiscussionNodeState(thread.root_post, {
          is_selected_thread: true,
          is_reply_target:
            thread.root_post.packet.packet_id === replyTargetPacketId,
          has_loaded_children: thread.replies.length > 0,
        })
      : null;
    const threadItems = this.markReplyTreeState({
      replies: thread?.replies ?? [],
      replyTargetPacketId,
    });
    const workspaceActions = this.createDiscussionWorkspaceActions({
      viewer,
      selectedForum,
      selectedThreadPacketId,
      feedHasMore: feed.has_more,
    });

    return {
      lens: feed.lens,
      active_view: input.view,
      available_forums: feed.forums,
      selected_forum: selectedForum,
      selected_thread_packet_id: selectedThreadPacketId,
      reply_target_packet_id: replyTargetPacketId,
      viewer,
      feed_items: feedItems,
      thread_root: threadRoot,
      thread_items: threadItems,
      workspace_actions: workspaceActions,
      action_descriptors: DISCUSSION_ACTION_DESCRIPTORS,
      composer: {
        mode:
          input.view === 'post'
            ? 'top_level'
            : replyTargetPacketId && threadRoot
              ? 'reply'
              : 'none',
        root_post_packet_id: threadRoot?.packet.packet_id ?? null,
        reply_target_packet_id: replyTargetPacketId,
      },
    };
  }

  async createPost(input: DiscussionPostWriteInput): Promise<{
    viewer: DiscussionViewerContext;
    post: DiscussionPostProjection;
  }> {
    await this.syncDerivedState();

    if (!this.state) {
      throw new Error('Discussion state is unavailable.');
    }

    const forumPacket = await getDiscussionForumById(
      this.packetStore,
      input.intent.forum_packet_id
    );

    if (!forumPacket) {
      throw new Error(
        `Unknown discussion forum: ${input.intent.forum_packet_id}`
      );
    }

    const scopeLens = buildScopeLens(input.scope_id, this.state.scopeMap);

    if (!matchesAuthorityScope(forumPacket, scopeLens)) {
      throw new Error('This discussion forum is not available from the current scope.');
    }

    const actorIdentity = {
      actor_key: input.actor_key,
      actor_class: input.actor_class,
    } satisfies ActorIdentity;
    const viewer = await this.buildViewerContext(
      forumPacket,
      actorIdentity
    );

    const governingScopePacket = await getElementPacketById(
      this.packetStore,
      forumPacket.header.authority_scope_ref?.packet_id ?? null
    );
    const policyPackets = governingScopePacket
      ? await getPolicyPacketsByRefs(
          this.packetStore,
          governingScopePacket.header.moderation.policy_refs
        )
      : [];
    const decision = evaluateDiscussionThreadPostMutation({
      intent: input.intent,
      actorPacket: input.actor_packet,
      viewer,
      governingScopePacket,
      policyPackets,
    });

    assertMutationProofBundle({
      decision,
      proofs: input.proof_bundle,
    });
    await this.verifySignedCandidatePacket(
      input.signed_thread_packet,
      input.actor_packet
    );
    await this.verifySignedCandidatePacket(
      input.signed_post_packet,
      input.actor_packet
    );

    await this.packetStore.writeRevision(input.signed_thread_packet);
    await this.packetStore.publishRevision({
      packet_id: input.signed_thread_packet.header.packet_id,
      revision_id: input.signed_thread_packet.header.revision_id,
    });
    await this.packetStore.writeRevision(input.signed_post_packet);
    await this.packetStore.publishRevision({
      packet_id: input.signed_post_packet.header.packet_id,
      revision_id: input.signed_post_packet.header.revision_id,
    });
    await this.syncDerivedState();

    const nextViewer = await this.buildViewerContext(
      forumPacket,
      actorIdentity,
      forumPacket.header.packet_id === input.signed_thread_packet.header.packet_id
        ? null
        : await getDiscussionThreadById(
            this.packetStore,
            input.signed_thread_packet.header.packet_id
          )
    );
    const createdPost = await getDiscussionEntryById(
      this.packetStore,
      input.signed_post_packet.header.packet_id
    );

    if (!createdPost) {
      throw new Error('Created discussion post could not be projected.');
    }

    return {
      viewer: nextViewer,
      post: this.toDiscussionPostProjection(
        createdPost,
        actorIdentity.actor_key,
        nextViewer
      ),
    };
  }

  async createReply(input: DiscussionReplyWriteInput): Promise<{
    viewer: DiscussionViewerContext;
    post: DiscussionPostProjection;
  }> {
    await this.syncDerivedState();

    if (!this.state) {
      throw new Error('Discussion state is unavailable.');
    }

    const parentEntry = await getDiscussionEntryById(
      this.packetStore,
      input.intent.parent_post_packet_id
    );

    if (!parentEntry) {
      throw new Error(`Unknown discussion post: ${input.intent.parent_post_packet_id}`);
    }

    const threadPacket = await getDiscussionThreadById(
      this.packetStore,
      getEntryThreadPacketId(parentEntry)
    );

    if (!threadPacket) {
      throw new Error(
        `Missing discussion thread for post ${input.intent.parent_post_packet_id}.`
      );
    }

    const forumPacket = await getDiscussionForumById(
      this.packetStore,
      threadPacket.body.forum_ref.packet_id
    );

    if (!forumPacket) {
      throw new Error(
        `Missing discussion forum for thread ${threadPacket.header.packet_id}.`
      );
    }

    const rootPostPacketId = resolveOperationalRootPostId({
      entryMap: this.state.entryMap,
      entryOperationalMap: this.state.entryOperationalMap,
      packetId: parentEntry.header.packet_id,
    });
    const rootPostPacket = this.state.rootPostOperationalMap.get(rootPostPacketId);

    if (!rootPostPacket) {
      throw new Error(
        `Missing root discussion post for reply target ${input.intent.parent_post_packet_id}.`
      );
    }

    const scopeLens = buildScopeLens(input.scope_id, this.state.scopeMap);

    if (!matchesAuthorityScope(forumPacket, scopeLens)) {
      throw new Error('This discussion forum is not available from the current scope.');
    }

    const actorIdentity = {
      actor_key: input.actor_key,
      actor_class: input.actor_class,
    } satisfies ActorIdentity;
    const viewer = await this.buildViewerContext(
      forumPacket,
      actorIdentity,
      threadPacket
    );

    const governingScopePacket = await getElementPacketById(
      this.packetStore,
      forumPacket.header.authority_scope_ref?.packet_id ?? null
    );
    const policyPackets = governingScopePacket
      ? await getPolicyPacketsByRefs(
          this.packetStore,
          governingScopePacket.header.moderation.policy_refs
        )
      : [];
    const decision = evaluateDiscussionReplyMutation({
      intent: input.intent,
      actorPacket: input.actor_packet,
      viewer,
      governingScopePacket,
      policyPackets,
    });

    assertMutationProofBundle({
      decision,
      proofs: input.proof_bundle,
    });
    await this.verifySignedCandidatePacket(
      input.signed_reply_packet,
      input.actor_packet
    );

    await this.packetStore.writeRevision(input.signed_reply_packet);
    await this.packetStore.publishRevision({
      packet_id: input.signed_reply_packet.header.packet_id,
      revision_id: input.signed_reply_packet.header.revision_id,
    });
    await this.syncDerivedState();

    const nextViewer = await this.buildViewerContext(
      forumPacket,
      actorIdentity,
      threadPacket
    );
    const createdReply = await getDiscussionEntryById(
      this.packetStore,
      input.signed_reply_packet.header.packet_id
    );

    if (!createdReply) {
      throw new Error('Created discussion reply could not be projected.');
    }

    return {
      viewer: nextViewer,
      post: this.toDiscussionPostProjection(
        createdReply,
        actorIdentity.actor_key,
        nextViewer
      ),
    };
  }

  private persistDerivedState(input: {
    discussionIndexRows: DiscussionPostIndexRecord[];
  }): void {
    const database = new DatabaseSync(this.packetStore.databasePath);

    try {
      database.exec('BEGIN IMMEDIATE');
      database.exec('DELETE FROM discussion_post_index');
      database.exec('DELETE FROM discussion_actor_ledger');
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

      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    } finally {
      database.close();
    }
  }

  private getVoteSummaryForTarget(
    targetPacketId: string,
    viewerActorKey: string | null
  ): AttestationSummary {
    const viewerVotes = viewerActorKey
      ? this.state?.viewerVotesByActor.get(viewerActorKey)
      : null;
    const viewerValue = viewerVotes?.get(targetPacketId) ?? 0;

    return createVoteSummary(
      this.state?.voteSummaryByTarget.get(targetPacketId),
      viewerValue
    );
  }

  private createDiscussionWorkspaceActions(input: {
    viewer: DiscussionViewerContext | null;
    selectedForum: DiscussionForumProjection | null;
    selectedThreadPacketId: string | null;
    feedHasMore: boolean;
  }): NexusActionMap {
    const createTopLevelEnabled = input.viewer?.can_create_top_level ?? false;
    const writeBlockReason = input.viewer?.write_block_reason ?? 'signed_actor_required';

    return {
      'discussion.create_top_level': {
        id: 'discussion.create_top_level',
        visible: input.selectedForum !== null,
        enabled: createTopLevelEnabled,
        reason: createTopLevelEnabled ? null : writeBlockReason,
        auth_gate_reason: createTopLevelEnabled
          ? null
          : toDiscussionAuthGateReason(writeBlockReason),
        target_packet_id: input.selectedForum?.forum_packet_id ?? null,
      },
      'discussion.load_more_feed': {
        id: 'discussion.load_more_feed',
        visible: input.feedHasMore,
        enabled: input.feedHasMore,
        reason: input.feedHasMore ? null : 'exhausted',
        target_packet_id: input.selectedThreadPacketId,
      },
    };
  }

  private createDiscussionPostActions(
    postProjection: DiscussionPostProjection,
    viewer: DiscussionViewerContext | null
  ): NexusActionMap {
    const canReply = viewer?.can_reply ?? false;
    const canVote = viewer?.can_vote ?? false;
    const writeBlockReason = viewer?.write_block_reason ?? 'signed_actor_required';
    const authGateReason = toDiscussionAuthGateReason(writeBlockReason);

    return {
      'discussion.open_thread': {
        id: 'discussion.open_thread',
        visible: postProjection.depth === 0,
        enabled: postProjection.depth === 0,
        reason: null,
        target_packet_id: postProjection.packet.packet_id,
        target_revision_id: postProjection.revision.revision_id,
      },
      'discussion.reply': {
        id: 'discussion.reply',
        visible: true,
        enabled: canReply,
        reason: canReply ? null : writeBlockReason,
        auth_gate_reason: canReply ? null : authGateReason,
        target_packet_id: postProjection.packet.packet_id,
        target_revision_id: postProjection.revision.revision_id,
      },
      'discussion.vote_up': {
        id: 'discussion.vote_up',
        visible: true,
        enabled: canVote,
        reason: canVote ? null : writeBlockReason,
        auth_gate_reason: canVote ? null : authGateReason,
        target_packet_id: postProjection.packet.packet_id,
        target_revision_id: postProjection.revision.revision_id,
      },
      'discussion.vote_down': {
        id: 'discussion.vote_down',
        visible: true,
        enabled: canVote,
        reason: canVote ? null : writeBlockReason,
        auth_gate_reason: canVote ? null : authGateReason,
        target_packet_id: postProjection.packet.packet_id,
        target_revision_id: postProjection.revision.revision_id,
      },
      'discussion.load_more_replies': {
        id: 'discussion.load_more_replies',
        visible: postProjection.reply_count > 0,
        enabled: postProjection.reply_count > 0,
        reason: postProjection.reply_count > 0 ? null : 'no_children',
        target_packet_id: postProjection.packet.packet_id,
        target_revision_id: postProjection.revision.revision_id,
      },
    };
  }

  private withDiscussionNodeState<TProjection extends DiscussionPostProjection>(
    projection: TProjection,
    state: Partial<TProjection['state']>
  ): TProjection {
    return {
      ...projection,
      state: {
        ...projection.state,
        ...state,
      },
    };
  }

  private markReplyTreeState(input: {
    replies: DiscussionReplyProjection[];
    replyTargetPacketId: string | null;
  }): DiscussionReplyProjection[] {
    return input.replies.map((replyProjection) => {
      const childReplies = this.markReplyTreeState({
        replies: replyProjection.replies,
        replyTargetPacketId: input.replyTargetPacketId,
      });

      return this.withDiscussionNodeState(
        {
          ...replyProjection,
          replies: childReplies,
        },
        {
          is_reply_target:
            replyProjection.packet.packet_id === input.replyTargetPacketId,
          has_loaded_children: childReplies.length > 0,
        }
      );
    });
  }

  private getVisibleForums(
    scopeLens: ScopeLens,
    activeScopeName: string
  ): VisibleForumEntry[] {
    if (!this.state) {
      return [];
    }

    const winningForumById = new Map<
      string,
      {
        discussionSpacePacket: PacketEnvelopeByType['DiscussionSpace'];
        forumPacket: PacketEnvelopeByType['DiscussionForum'];
        rank: number;
      }
    >();

    for (const forumPacket of this.state.forumOperationalMap.values()) {
      if (!matchesAuthorityScope(forumPacket, scopeLens)) {
        continue;
      }

      const discussionSpacePacket = resolveOperationalDiscussionPacket({
        packetMap: this.state.discussionSpaceMap,
        operationalMap: this.state.discussionSpaceOperationalMap,
        packetId: forumPacket.body.discussion_space_ref.packet_id,
      });

      if (
        !discussionSpacePacket ||
        !matchesAuthorityScope(discussionSpacePacket, scopeLens)
      ) {
        continue;
      }

      const forumId = toDiscussionForumId(forumPacket.body.forum_kind);
      const candidateRank = Math.min(
        getPacketScopeRank(forumPacket, scopeLens),
        getPacketScopeRank(discussionSpacePacket, scopeLens)
      );
      const currentWinner = winningForumById.get(forumId);

      if (!currentWinner || candidateRank < currentWinner.rank) {
        winningForumById.set(forumId, {
          discussionSpacePacket,
          forumPacket,
          rank: candidateRank,
        });
        continue;
      }

      if (candidateRank === currentWinner.rank) {
        const createdAtComparison = forumPacket.header.created_at.localeCompare(
          currentWinner.forumPacket.header.created_at
        );

        if (
          createdAtComparison < 0 ||
          (createdAtComparison === 0 &&
            forumPacket.header.packet_id.localeCompare(
              currentWinner.forumPacket.header.packet_id
            ) < 0)
        ) {
          winningForumById.set(forumId, {
            discussionSpacePacket,
            forumPacket,
            rank: candidateRank,
          });
        }
      }
    }

    return Array.from(winningForumById.entries())
      .sort((leftForum, rightForum) => {
        const leftOrder = getDiscussionForumOrder(leftForum[0]);
        const rightOrder = getDiscussionForumOrder(rightForum[0]);

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return leftForum[1].forumPacket.body.title.localeCompare(
          rightForum[1].forumPacket.body.title
        );
      })
      .map(([forumId, entry]) => ({
        forumId,
        discussionSpacePacket: entry.discussionSpacePacket,
        forumPacket: entry.forumPacket,
        displayTitle: getDiscussionForumDisplayTitle(
          forumId,
          activeScopeName,
          entry.forumPacket.body.title
        ),
      }));
  }

  private toDiscussionForumProjection(
    discussionSpacePacket: PacketEnvelopeByType['DiscussionSpace'],
    forumPacket: PacketEnvelopeByType['DiscussionForum'],
    displayTitle: string
  ): DiscussionForumProjection {
    const participationRules = getEffectiveParticipationRules(forumPacket);

    return {
      id: toDiscussionForumId(forumPacket.body.forum_kind),
      forum_kind: forumPacket.body.forum_kind,
      title: displayTitle,
      description:
        forumPacket.body.summary ?? 'Packet-backed discussion surface.',
      cadence: forumPacket.body.status,
      public_posting: participationRules.top_level_actor_classes.includes(
        'anonymous_guest'
      ),
      linked_packet_label: `${forumPacket.header.family} packet`,
      discussion_space_packet_id: discussionSpacePacket.header.packet_id,
      forum_packet_id: forumPacket.header.packet_id,
      thread_packet_id: forumPacket.header.packet_id,
      authority_scope_packet_id:
        forumPacket.header.authority_scope_ref?.packet_id ?? null,
      applicable_scope_packet_ids: forumPacket.header.applicable_scope_refs.map(
        (scopeRef) => scopeRef.packet_id
      ),
      default_sort: forumPacket.body.default_sort,
    };
  }

  private toDiscussionPostProjection(
    postPacket: DiscussionEntryPacket,
    viewerActorKey: string | null,
    viewer: DiscussionViewerContext | null = null
  ): DiscussionPostProjection {
    const postIndex = this.state?.postIndexByPacketId.get(postPacket.header.packet_id);
    const voteSummary = this.getVoteSummaryForTarget(
      postPacket.header.packet_id,
      viewerActorKey
    );
    const projection: DiscussionPostProjection = {
      packet: {
        packet_id: postPacket.header.packet_id,
      },
      revision: {
        packet_id: postPacket.header.packet_id,
        revision_id: postPacket.header.revision_id,
      },
      thread_ref: postPacket.body.thread_ref,
      authority_scope_packet_id:
        postPacket.header.authority_scope_ref?.packet_id ?? null,
      applicable_scope_packet_ids: postPacket.header.applicable_scope_refs.map(
        (scopeRef) => scopeRef.packet_id
      ),
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
      is_hidden: false,
      hidden_reason: null,
      vote_summary: voteSummary,
      state: {
        structural_kind: (postIndex?.depth ?? 0) > 0 ? 'reply' : 'root_post',
        is_selected_thread: false,
        is_reply_target: false,
        has_children: (postIndex?.direct_reply_count ?? 0) > 0,
        has_loaded_children: false,
      },
      actions: {},
    };

    return {
      ...projection,
      actions: this.createDiscussionPostActions(projection, viewer),
    };
  }

  private toDiscussionReplyProjection(
    replyPacket: PacketEnvelopeByType['DiscussionReply'],
    viewerActorKey: string | null,
    viewer: DiscussionViewerContext | null = null
  ): DiscussionReplyProjection {
    const postProjection = this.toDiscussionPostProjection(
      replyPacket,
      viewerActorKey,
      viewer
    );

    return {
      ...postProjection,
      actions: {
        ...postProjection.actions,
        'discussion.expand_branch': {
          id: 'discussion.expand_branch',
          visible: postProjection.reply_count > 0,
          enabled: postProjection.reply_count > 0,
          reason: postProjection.reply_count > 0 ? null : 'no_children',
          target_packet_id: postProjection.packet.packet_id,
          target_revision_id: postProjection.revision.revision_id,
        },
        'discussion.collapse_branch': {
          id: 'discussion.collapse_branch',
          visible: postProjection.reply_count > 0,
          enabled: postProjection.reply_count > 0,
          reason: postProjection.reply_count > 0 ? null : 'no_children',
          target_packet_id: postProjection.packet.packet_id,
          target_revision_id: postProjection.revision.revision_id,
        },
        'discussion.load_more_replies': {
          id: 'discussion.load_more_replies',
          visible: postProjection.reply_count > 0,
          enabled: postProjection.reply_count > 0,
          reason: postProjection.reply_count > 0 ? null : 'no_children',
          target_packet_id: postProjection.packet.packet_id,
          target_revision_id: postProjection.revision.revision_id,
        },
      },
      replies: [],
      child_page: {
        next_cursor: postProjection.reply_count > 0 ? '0' : null,
        has_more: postProjection.reply_count > 0,
      },
      is_collapsed_by_default:
        postProjection.depth >= DEFAULT_COLLAPSED_REPLY_DEPTH,
    };
  }

  private getReplyChildrenPage(input: {
    root_post_packet_id: string;
    parent_post_packet_id: string;
    reply_sort: DiscussionReplySort | null;
    show_hidden: boolean;
    viewer_actor_key: string | null;
    viewer?: DiscussionViewerContext | null;
    cursor?: string | null;
    limit?: number | null;
  }) {
    if (!this.state) {
      throw new Error('Discussion state is unavailable.');
    }

    const canonicalRootPostId = resolveOperationalRootPostId({
      entryMap: this.state.entryMap,
      entryOperationalMap: this.state.entryOperationalMap,
      packetId: input.root_post_packet_id,
    });
    const parentEntry = resolveOperationalDiscussionPacket({
      packetMap: this.state.entryMap,
      operationalMap: this.state.entryOperationalMap,
      packetId: input.parent_post_packet_id,
    });

    if (!parentEntry) {
      throw new Error(`Unknown discussion post: ${input.parent_post_packet_id}`);
    }

    const parentRootPostId = resolveOperationalRootPostId({
      entryMap: this.state.entryMap,
      entryOperationalMap: this.state.entryOperationalMap,
      packetId: input.parent_post_packet_id,
    });

    if (parentRootPostId !== canonicalRootPostId) {
      throw new Error(
        `Reply parent ${input.parent_post_packet_id} is outside thread ${canonicalRootPostId}.`
      );
    }

    const selectedReplySort = input.reply_sort ?? 'top';
    const childReplies = Array.from(this.state.replyOperationalMap.values()).filter(
        (replyPacket) =>
          isSameDiscussionTarget(
            replyPacket.body.reply_to_ref.packet_id,
          input.parent_post_packet_id
        )
    );
    const sortedReplies = childReplies
      .map((replyPacket) =>
        this.toDiscussionReplyProjection(
          replyPacket,
          input.viewer_actor_key,
          input.viewer ?? null
        )
      )
      .filter((replyProjection) => input.show_hidden || !replyProjection.is_hidden)
      .sort((leftReply, rightReply) =>
        this.compareReplies(leftReply, rightReply, selectedReplySort)
      );
    const pagedReplies = paginateItems({
      items: sortedReplies,
      cursor: input.cursor ?? null,
      limit: resolvePageSize(
        input.limit ?? null,
        DEFAULT_REPLY_PAGE_SIZE,
        MAX_REPLY_PAGE_SIZE
      ),
    });

    return {
      parent_post_packet_id: input.parent_post_packet_id,
      replies: pagedReplies.items,
      next_cursor: pagedReplies.next_cursor,
      has_more: pagedReplies.has_more,
    };
  }

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
