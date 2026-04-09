/**
 * File: contracts.ts
 * Description: Declares the core packet-store and query-service interfaces for OWA.
 */

import type {
  DiscussionActorClass,
  DiscussionReplySort,
  DiscussionSort,
  PacketEdge,
  PacketEnvelope,
  PacketFamily,
  PacketMergeStrategy,
  PacketRevisionState,
  PacketRef,
  PacketRevisionRef,
  PacketVoteValue,
} from '@/domain/schema/packet-schema';

export interface PacketEdgeQuery {
  direction?: 'incoming' | 'outgoing' | 'both';
  edge_types?: string[];
}

export interface RevisionComparison {
  base: PacketRevisionRef;
  head: PacketRevisionRef;
  changed_header_fields: string[];
  changed_body_fields: string[];
}

export interface BundleExportResult {
  bytes: Uint8Array;
  packet_count: number;
  revision_count: number;
}

export interface BundleImportResult {
  packet_count: number;
  revision_count: number;
  edge_count: number;
}

export interface PacketHeadStatus {
  preferred_revision: PacketRevisionRef | null;
  head_revisions: PacketRevisionRef[];
  revision_state: PacketRevisionState;
}

export interface PacketStore {
  validate(input: unknown): PacketEnvelope;
  writeRevision(packet: PacketEnvelope): Promise<PacketRevisionRef>;
  publishRevision(revision: PacketRevisionRef): Promise<void>;
  fetchByPacket(packet: PacketRef): Promise<PacketEnvelope | null>;
  fetchByRevision(revision: PacketRevisionRef): Promise<PacketEnvelope | null>;
  fetchPreferredRevision(packet: PacketRef): Promise<PacketRevisionRef | null>;
  fetchRevisionHeads(packet: PacketRef): Promise<PacketHeadStatus>;
  queryEdges(packet: PacketRef, query?: PacketEdgeQuery): Promise<PacketEdge[]>;
  mergeRevisions(input: {
    packet: PacketRef;
    parent_revisions: PacketRevisionRef[];
    strategy: PacketMergeStrategy;
    merged_packet: PacketEnvelope;
  }): Promise<PacketRevisionRef>;
  importBundle(bundle: Uint8Array | ArrayBuffer | string): Promise<BundleImportResult>;
  exportBundle(packet_refs: PacketRef[]): Promise<BundleExportResult>;
}

export interface BrowserPacketProjection {
  packet: PacketRef;
  revision: PacketRevisionRef;
  family: PacketFamily;
  label: string;
  title: string;
  summary: string | null;
}

export interface BrowserQueryService {
  getPacket(packet: PacketRef): Promise<BrowserPacketProjection | null>;
  getRevisionHeads(packet: PacketRef): Promise<PacketHeadStatus>;
  listIncomingLinks(packet: PacketRef): Promise<PacketEdge[]>;
  listOutgoingLinks(packet: PacketRef): Promise<PacketEdge[]>;
  compareRevisions(
    base: PacketRevisionRef,
    head: PacketRevisionRef
  ): Promise<RevisionComparison>;
}

export interface NexusScopeLens {
  authority_scope_ref: PacketRef | null;
  applicable_scope_refs: PacketRef[];
}

export interface NexusPacketCardProjection {
  packet: PacketRef;
  revision: PacketRevisionRef;
  family: PacketFamily;
  label: string;
  title: string;
  summary: string | null;
  status: string | null;
}

export interface NexusQueryService {
  getDashboardQueue(lens: NexusScopeLens): Promise<NexusPacketCardProjection[]>;
  listVotes(lens: NexusScopeLens): Promise<NexusPacketCardProjection[]>;
  listDiscussions(lens: NexusScopeLens): Promise<NexusPacketCardProjection[]>;
  listLibraryPackets(
    lens: NexusScopeLens,
    family?: PacketFamily
  ): Promise<NexusPacketCardProjection[]>;
}

export interface DiscussionViewerContext {
  actor_key: string | null;
  actor_class: DiscussionActorClass;
  available_points: number;
  can_create_top_level: boolean;
  can_reply: boolean;
  can_vote: boolean;
}

export interface PacketVoteSummary {
  upvote_count: number;
  downvote_count: number;
  net_score: number;
  total_votes: number;
  negative_ratio: number;
  viewer_value: PacketVoteValue | 0;
  auto_hidden: boolean;
  deprioritized: boolean;
}

export interface DiscussionForumProjection {
  id: string;
  title: string;
  description: string;
  cadence: string;
  public_posting: boolean;
  linked_packet_label: string;
  thread_packet_id: string;
  default_sort: DiscussionSort;
  top_level_post_cost: number;
}

export interface DiscussionPostProjection {
  packet: PacketRef;
  revision: PacketRevisionRef;
  thread_ref: PacketRef;
  title: string;
  content_markdown: string | null;
  excerpt: string | null;
  author_label: string;
  author_key: string | null;
  created_at: string;
  last_activity_at: string;
  reply_count: number;
  descendant_count: number;
  depth: number;
  is_hidden: boolean;
  hidden_reason: string | null;
  vote_summary: PacketVoteSummary;
}

export interface DiscussionReplyProjection extends DiscussionPostProjection {
  replies: DiscussionReplyProjection[];
}

export interface DiscussionFeedProjection {
  lens: NexusScopeLens;
  forums: DiscussionForumProjection[];
  selected_forum_id: string;
  selected_sort: DiscussionSort;
  show_hidden: boolean;
  viewer: DiscussionViewerContext;
  top_level_posts: DiscussionPostProjection[];
}

export interface DiscussionThreadDetailProjection {
  lens: NexusScopeLens;
  forum: DiscussionForumProjection;
  selected_reply_sort: DiscussionReplySort;
  show_hidden: boolean;
  viewer: DiscussionViewerContext;
  root_post: DiscussionPostProjection;
  replies: DiscussionReplyProjection[];
}

export interface DiscussionQueryService {
  getForumFeed(input: {
    scope_id: string;
    forum_id: string | null;
    sort: DiscussionSort | null;
    show_hidden: boolean;
    viewer_actor_key: string | null;
  }): Promise<DiscussionFeedProjection>;
  getThreadDetail(input: {
    scope_id: string;
    post_packet_id: string;
    reply_sort: DiscussionReplySort | null;
    show_hidden: boolean;
    viewer_actor_key: string | null;
  }): Promise<DiscussionThreadDetailProjection>;
}

export interface PacketVoteService {
  setPacketVote(input: {
    target_packet_id: string;
    actor_key: string;
    actor_class: DiscussionActorClass;
    authority_scope_id: string | null;
    value: PacketVoteValue | 0;
  }): Promise<PacketVoteSummary>;
}
