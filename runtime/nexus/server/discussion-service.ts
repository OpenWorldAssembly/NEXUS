/**
 * File: discussion-service.ts
 * Description: Projects packet-backed discussion forums, threads, root posts, replies, and attestation-backed reactions from the SQLite packet store.
 */

import { DatabaseSync } from 'node:sqlite';

import { createTextExcerpt } from '@core/packets/builders';
import type {
  AttestationService,
  AttestationSummary,
  DiscussionForumProjection,
  DiscussionPostProjection,
  DiscussionQueryService,
  DiscussionReplyProjection,
  DiscussionThreadDetailProjection,
  DiscussionViewerContext,
} from '@core/contracts';
import type {
  AttestationValue,
  DiscussionActorClass,
  DiscussionReplySort,
  DiscussionSort,
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import { verifyPacketSignature } from '@runtime/nexus/identity-crypto';
import {
  paginateItems,
  resolvePageSize,
} from '@runtime/nexus/server/discussion-service.pagination';
import {
  buildScopeLens,
  getDiscussionForumDisplayTitle,
  getDiscussionForumOrder,
  getPacketScopeRank,
  matchesScopeLens,
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

const REDDIT_EPOCH_SECONDS = 1134028003;
const HOT_SCORE_DECAY_SECONDS = 45000;
const DEFAULT_FEED_PAGE_SIZE = 20;
const DEFAULT_REPLY_PAGE_SIZE = 10;
const MAX_FEED_PAGE_SIZE = 50;
const MAX_REPLY_PAGE_SIZE = 25;
const DEFAULT_COLLAPSED_REPLY_DEPTH = 5;

type DiscussionState = {
  packetMap: Map<string, PacketEnvelope>;
  scopeMap: Map<string, ScopeNode>;
  discussionSpaceMap: Map<string, PacketEnvelopeByType['DiscussionSpace']>;
  forumMap: Map<string, PacketEnvelopeByType['DiscussionForum']>;
  threadMap: Map<string, PacketEnvelopeByType['DiscussionThread']>;
  rootPostMap: Map<string, PacketEnvelopeByType['DiscussionPost']>;
  replyMap: Map<string, PacketEnvelopeByType['DiscussionReply']>;
  entryMap: Map<string, DiscussionEntryPacket>;
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
  thread_packet: PacketEnvelopeByType['DiscussionThread'];
  post_packet: PacketEnvelopeByType['DiscussionPost'];
};

type DiscussionReplyWriteInput = {
  scope_id: string;
  actor_key: string;
  actor_class: DiscussionActorClass;
  actor_packet: PacketEnvelopeByType['Element'];
  parent_post_packet_id: string;
  reply_packet: PacketEnvelopeByType['DiscussionReply'];
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

function getEntryReplyToPacketId(entryPacket: DiscussionEntryPacket): string | null {
  if (entryPacket.header.family === 'DiscussionReply') {
    return (entryPacket as PacketEnvelopeByType['DiscussionReply']).body.reply_to_ref
      .packet_id;
  }

  return (entryPacket as PacketEnvelopeByType['DiscussionPost']).body.reply_to_ref
    ?.packet_id ?? null;
}

function resolveRootPostId(
  entriesByPacketId: Map<string, DiscussionEntryPacket>,
  postPacketId: string
): string {
  const currentEntry = entriesByPacketId.get(postPacketId);

  if (!currentEntry) {
    return postPacketId;
  }

  if (currentEntry.header.family === 'DiscussionPost') {
    return currentEntry.header.packet_id;
  }

  return (currentEntry as PacketEnvelopeByType['DiscussionReply']).body.root_post_ref
    .packet_id;
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
  const packet = await packetStore.fetchByPacket({ packet_id: forumPacketId });

  if (!packet || packet.header.family !== 'DiscussionForum') {
    return null;
  }

  return packet as PacketEnvelopeByType['DiscussionForum'];
}

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

async function getDiscussionEntryById(
  packetStore: NodeSQLitePacketStore,
  packetId: string
): Promise<DiscussionEntryPacket | null> {
  const packet = await packetStore.fetchByPacket({ packet_id: packetId });

  if (
    !packet ||
    (packet.header.family !== 'DiscussionPost' &&
      packet.header.family !== 'DiscussionReply')
  ) {
    return null;
  }

  return packet as DiscussionEntryPacket;
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
      allPackets,
    ] = await Promise.all([
      this.packetStore.listPreferredPacketsByFamily('Element'),
      this.packetStore.listPreferredPacketsByFamily('DiscussionSpace'),
      this.packetStore.listPreferredPacketsByFamily('DiscussionForum'),
      this.packetStore.listPreferredPacketsByFamily('DiscussionThread'),
      this.packetStore.listPreferredPacketsByFamily('DiscussionPost'),
      this.packetStore.listPreferredPacketsByFamily('DiscussionReply'),
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
    const discussionSpaceMap = new Map(
      discussionSpacePackets.map((packet) => [packet.header.packet_id, packet])
    );
    const forumMap = new Map(
      discussionForumPackets.map((packet) => [packet.header.packet_id, packet])
    );
    const threadMap = new Map(
      discussionThreadPackets.map((packet) => [packet.header.packet_id, packet])
    );
    const rootPostMap = new Map(
      discussionPostPackets.map((packet) => [packet.header.packet_id, packet])
    );
    const replyMap = new Map(
      discussionReplyPackets.map((packet) => [packet.header.packet_id, packet])
    );
    const entryMap = new Map<string, DiscussionEntryPacket>([
      ...discussionPostPackets.map((packet) => [packet.header.packet_id, packet] as const),
      ...discussionReplyPackets.map((packet) => [packet.header.packet_id, packet] as const),
    ]);
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

    for (const replyPacket of discussionReplyPackets) {
      const parentPacketId = replyPacket.body.reply_to_ref.packet_id;
      const currentChildIds = childIdsByParent.get(parentPacketId) ?? [];

      currentChildIds.push(replyPacket.header.packet_id);
      childIdsByParent.set(parentPacketId, currentChildIds);
    }

    const discussionIndexRows: DiscussionPostIndexRecord[] = [];
    const postIndexByPacketId = new Map<string, DiscussionPostIndexRecord>();

    for (const entryPacket of entryMap.values()) {
      const rootPostPacketId = resolveRootPostId(entryMap, entryPacket.header.packet_id);
      let depth = 0;
      let currentParentPacketId = getEntryReplyToPacketId(entryPacket);

      while (currentParentPacketId) {
        depth += 1;
        currentParentPacketId =
          entryMap.get(currentParentPacketId) === undefined
            ? null
            : getEntryReplyToPacketId(entryMap.get(currentParentPacketId)!);
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
      forumMap,
      threadMap,
      rootPostMap,
      replyMap,
      entryMap,
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
    const hasForumAccess =
      requiresMembership && actorPacketId && assemblyPacketId
        ? await this.attestationService.hasActiveAssemblyAssociationClaim({
            actor_packet_id: actorPacketId,
            assembly_packet_id: assemblyPacketId,
          })
        : !requiresMembership && Boolean(actorPacketId);

    return {
      actor_key: actorIdentity.actor_key,
      actor_class: actorClass,
      can_create_top_level: hasForumAccess,
      can_reply: hasForumAccess,
      can_vote: hasForumAccess,
    };
  }

  private async verifySignedDiscussionPacket<TPacket extends DiscussionEntryPacket | PacketEnvelopeByType['DiscussionThread']>(
    packet: TPacket,
    actorPacket: PacketEnvelopeByType['Element']
  ): Promise<void> {
    if (packet.header.provenance.created_by?.packet_id !== actorPacket.header.packet_id) {
      throw new Error('Discussion packet provenance does not match the actor packet.');
    }

    if (
      packet.header.integrity.embedded_signatures[0]?.signer_packet_ref?.packet_id !==
      actorPacket.header.packet_id
    ) {
      throw new Error('Discussion packet signature does not match the actor packet.');
    }

    const signatureIsValid = await verifyPacketSignature({
      packet,
      signerPacket: actorPacket,
    });

    if (!signatureIsValid) {
      throw new Error('Discussion packet signature verification failed.');
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
    const topLevelPosts = Array.from(this.state.rootPostMap.values())
      .filter((rootPostPacket) => {
        const threadPacket = this.state?.threadMap.get(
          rootPostPacket.body.thread_ref.packet_id
        );

        return (
          threadPacket?.body.forum_ref.packet_id ===
          selectedForum.forumPacket.header.packet_id
        );
      })
      .map((rootPostPacket) =>
        this.toDiscussionPostProjection(rootPostPacket, actorIdentity.actor_key)
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

    const canonicalRootPostId = resolveRootPostId(
      this.state.entryMap,
      input.post_packet_id
    );
    const rootPostPacket = this.state.rootPostMap.get(canonicalRootPostId);

    if (!rootPostPacket) {
      throw new Error(`Unknown discussion post: ${input.post_packet_id}`);
    }

    const threadPacket = this.state.threadMap.get(rootPostPacket.body.thread_ref.packet_id);

    if (!threadPacket) {
      throw new Error(
        `Missing discussion thread for post ${input.post_packet_id}.`
      );
    }

    const forumPacket = this.state.forumMap.get(threadPacket.body.forum_ref.packet_id);

    if (!forumPacket) {
      throw new Error(
        `Missing discussion forum for thread ${threadPacket.header.packet_id}.`
      );
    }

    const discussionSpacePacket = this.state.discussionSpaceMap.get(
      forumPacket.body.discussion_space_ref.packet_id
    );

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
          forumEntry.forumPacket.header.packet_id === forumPacket.header.packet_id
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
      actorIdentity.actor_key
    );
    const rootReplyPage = this.getReplyChildrenPage({
      root_post_packet_id: rootPostPacket.header.packet_id,
      parent_post_packet_id: rootPostPacket.header.packet_id,
      reply_sort: selectedReplySort,
      show_hidden: input.show_hidden,
      viewer_actor_key: actorIdentity.actor_key,
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

    return this.getReplyChildrenPage({
      root_post_packet_id: input.thread_post_packet_id,
      parent_post_packet_id: input.parent_post_packet_id,
      reply_sort: input.reply_sort ?? null,
      show_hidden: input.show_hidden,
      viewer_actor_key: input.viewer_actor_key,
      cursor: input.cursor ?? null,
      limit: input.limit ?? null,
    });
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
      input.thread_packet.body.forum_ref.packet_id
    );

    if (!forumPacket) {
      throw new Error(
        `Unknown discussion forum: ${input.thread_packet.body.forum_ref.packet_id}`
      );
    }

    const scopeLens = buildScopeLens(input.scope_id, this.state.scopeMap);

    if (!matchesScopeLens(forumPacket, scopeLens)) {
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

    if (!viewer.can_create_top_level) {
      throw new Error('Top-level posting is not open to your current actor here.');
    }

    await this.verifySignedDiscussionPacket(input.thread_packet, input.actor_packet);
    await this.verifySignedDiscussionPacket(input.post_packet, input.actor_packet);

    if (
      input.thread_packet.body.forum_ref.packet_id !== forumPacket.header.packet_id
    ) {
      throw new Error('Discussion thread packet does not match the selected forum.');
    }

    if (input.thread_packet.body.thread_kind !== forumPacket.body.forum_kind) {
      throw new Error('Discussion thread packet uses the wrong forum kind.');
    }

    if (
      input.post_packet.body.thread_ref.packet_id !== input.thread_packet.header.packet_id
    ) {
      throw new Error('Discussion post packet does not reference the submitted thread.');
    }

    if (input.post_packet.body.reply_to_ref) {
      throw new Error('Top-level discussion posts cannot include a reply target.');
    }

    await this.packetStore.writeRevision(input.thread_packet);
    await this.packetStore.publishRevision({
      packet_id: input.thread_packet.header.packet_id,
      revision_id: input.thread_packet.header.revision_id,
    });
    await this.packetStore.writeRevision(input.post_packet);
    await this.packetStore.publishRevision({
      packet_id: input.post_packet.header.packet_id,
      revision_id: input.post_packet.header.revision_id,
    });
    await this.syncDerivedState();

    const nextViewer = await this.buildViewerContext(
      forumPacket,
      actorIdentity,
      input.thread_packet
    );

    return {
      viewer: nextViewer,
      post: this.toDiscussionPostProjection(input.post_packet, actorIdentity.actor_key),
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
      input.parent_post_packet_id
    );

    if (!parentEntry) {
      throw new Error(`Unknown discussion post: ${input.parent_post_packet_id}`);
    }

    const threadPacket = await getDiscussionThreadById(
      this.packetStore,
      getEntryThreadPacketId(parentEntry)
    );

    if (!threadPacket) {
      throw new Error(
        `Missing discussion thread for post ${input.parent_post_packet_id}.`
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

    const rootPostPacketId = resolveRootPostId(
      this.state.entryMap,
      parentEntry.header.packet_id
    );
    const rootPostPacket = this.state.rootPostMap.get(rootPostPacketId);

    if (!rootPostPacket) {
      throw new Error(
        `Missing root discussion post for reply target ${input.parent_post_packet_id}.`
      );
    }

    const scopeLens = buildScopeLens(input.scope_id, this.state.scopeMap);

    if (!matchesScopeLens(forumPacket, scopeLens)) {
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

    if (!viewer.can_reply) {
      throw new Error('Replies are not open to your current actor class here.');
    }

    await this.verifySignedDiscussionPacket(input.reply_packet, input.actor_packet);

    if (
      input.reply_packet.body.thread_ref.packet_id !== threadPacket.header.packet_id
    ) {
      throw new Error('Reply packet does not reference the selected thread.');
    }

    if (
      input.reply_packet.body.root_post_ref.packet_id !== rootPostPacket.header.packet_id
    ) {
      throw new Error('Reply packet does not reference the root post of this thread.');
    }

    if (
      input.reply_packet.body.reply_to_ref.packet_id !== parentEntry.header.packet_id
    ) {
      throw new Error('Reply packet does not reference the selected parent post.');
    }

    await this.packetStore.writeRevision(input.reply_packet);
    await this.packetStore.publishRevision({
      packet_id: input.reply_packet.header.packet_id,
      revision_id: input.reply_packet.header.revision_id,
    });
    await this.syncDerivedState();

    const nextViewer = await this.buildViewerContext(
      forumPacket,
      actorIdentity,
      threadPacket
    );

    return {
      viewer: nextViewer,
      post: this.toDiscussionPostProjection(
        input.reply_packet,
        actorIdentity.actor_key
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

    for (const forumPacket of this.state.forumMap.values()) {
      if (!matchesScopeLens(forumPacket, scopeLens)) {
        continue;
      }

      const discussionSpacePacket = this.state.discussionSpaceMap.get(
        forumPacket.body.discussion_space_ref.packet_id
      );

      if (!discussionSpacePacket || !matchesScopeLens(discussionSpacePacket, scopeLens)) {
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
    };
  }

  private toDiscussionReplyProjection(
    replyPacket: PacketEnvelopeByType['DiscussionReply'],
    viewerActorKey: string | null
  ): DiscussionReplyProjection {
    const postProjection = this.toDiscussionPostProjection(
      replyPacket,
      viewerActorKey
    );

    return {
      ...postProjection,
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
    cursor?: string | null;
    limit?: number | null;
  }) {
    if (!this.state) {
      throw new Error('Discussion state is unavailable.');
    }

    const canonicalRootPostId = resolveRootPostId(
      this.state.entryMap,
      input.root_post_packet_id
    );
    const parentEntry = this.state.entryMap.get(input.parent_post_packet_id);

    if (!parentEntry) {
      throw new Error(`Unknown discussion post: ${input.parent_post_packet_id}`);
    }

    const parentRootPostId = resolveRootPostId(
      this.state.entryMap,
      input.parent_post_packet_id
    );

    if (parentRootPostId !== canonicalRootPostId) {
      throw new Error(
        `Reply parent ${input.parent_post_packet_id} is outside thread ${canonicalRootPostId}.`
      );
    }

    const selectedReplySort = input.reply_sort ?? 'top';
    const childReplies = Array.from(this.state.replyMap.values()).filter(
      (replyPacket) =>
        replyPacket.body.reply_to_ref.packet_id === input.parent_post_packet_id
    );
    const sortedReplies = childReplies
      .map((replyPacket) =>
        this.toDiscussionReplyProjection(replyPacket, input.viewer_actor_key)
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
