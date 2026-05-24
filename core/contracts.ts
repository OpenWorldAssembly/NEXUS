/**
 * File: contracts.ts
 * Description: Declares the core packet-store and query-service interfaces for OWA.
 */

import type {
  MutationIntent,
} from '@core/auth/mutation-corridor';
import type {
  PacketAdaptedWritePreparation,
  PacketCompatibilityReadResult,
  PacketVersionedWritePreparation,
  ReactionAttestationValue,
  ReactionEmotionId,
  ReactionVoteValue,
  DiscussionActorClass,
  DiscussionReplySort,
  DiscussionSort,
  PacketEdge,
  PacketEnvelope,
  PacketEnvelopeByType,
  PacketType,
  PacketReadMode,
  PacketMergeStrategy,
  PacketRevisionState,
  PacketRef,
  PacketRevisionRef,
} from '@core/schema/packet-schema';

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

export type NexusPacketValidationMode =
  | 'dont_validate'
  | 'validate_before_commit'
  | 'validate_after_commit';

export type NexusPacketVerificationStatus =
  | 'not_validated'
  | 'unsigned'
  | 'signature_valid'
  | 'signature_invalid'
  | 'canonicalization_mismatch'
  | 'unknown_signer'
  | 'trusted_signer'
  | 'external_report_only';

export interface NexusPacketVerificationSummary {
  packet_id: string;
  target_revision_id: string | null;
  target_digest: string | null;
  latest_report_packet_id: string | null;
  latest_report_revision_id: string | null;
  latest_report_source: 'local' | 'external';
  status: NexusPacketVerificationStatus;
  structural_valid: boolean;
  compatibility_status: 'native' | 'adapted' | 'lossy' | 'blocked';
  signature_status:
    | 'missing'
    | 'valid'
    | 'unverifiable'
    | 'invalid'
    | 'canonicalization_mismatch';
  signer_status: 'missing' | 'unknown' | 'known' | 'trusted';
  provenance_status: 'local' | 'imported' | 'unknown';
  local_trust_status: 'trusted' | 'untrusted' | 'unknown';
  warnings_count: number;
  validated_at: string | null;
  validator_packet_id: string | null;
}

export interface PacketHeadStatus {
  preferred_revision: PacketRevisionRef | null;
  head_revisions: PacketRevisionRef[];
  revision_state: PacketRevisionState;
}

export type PacketReadValue<TMode extends PacketReadMode> = TMode extends 'raw'
  ? unknown
  : TMode extends 'raw_plus_adaptation'
    ? PacketCompatibilityReadResult
    : PacketEnvelope;

export interface PacketStore {
  validate(input: unknown): PacketEnvelope;
  writeRevision(packet: PacketEnvelope): Promise<PacketRevisionRef>;
  publishRevision(revision: PacketRevisionRef): Promise<void>;
  fetchByPacket(packet: PacketRef): Promise<PacketEnvelope | null>;
  fetchByRevision(revision: PacketRevisionRef): Promise<PacketEnvelope | null>;
  resolveRevisionRef(revision_id: string): Promise<PacketRevisionRef | null>;
  fetchPreferredRevision(packet: PacketRef): Promise<PacketRevisionRef | null>;
  fetchRevisionHeads(packet: PacketRef): Promise<PacketHeadStatus>;
  queryEdges(packet: PacketRef, query?: PacketEdgeQuery): Promise<PacketEdge[]>;
  mergeRevisions(input: {
    packet: PacketRef;
    parent_revisions: PacketRevisionRef[];
    strategy: PacketMergeStrategy;
    merged_packet: PacketEnvelope;
  }): Promise<PacketRevisionRef>;
  readByPacket<TMode extends PacketReadMode>(
    packet: PacketRef,
    options?: { mode?: TMode; target_schema_version?: string }
  ): Promise<PacketReadValue<TMode> | null>;
  readByRevision<TMode extends PacketReadMode>(
    revision: PacketRevisionRef,
    options?: { mode?: TMode; target_schema_version?: string }
  ): Promise<PacketReadValue<TMode> | null>;
  prepareRevisionForAdaptedSave(
    revision: PacketRevisionRef
  ): Promise<PacketAdaptedWritePreparation | null>;
  prepareRevisionForVersionedSave(
    revision: PacketRevisionRef,
    options?: {
      target_schema_version?: string;
    }
  ): Promise<PacketVersionedWritePreparation | null>;
  writePreparedRevision(
    preparation: PacketVersionedWritePreparation
  ): Promise<PacketRevisionRef>;
  importBundle(bundle: Uint8Array | ArrayBuffer | string): Promise<BundleImportResult>;
  exportBundle(packet_refs: PacketRef[]): Promise<BundleExportResult>;
  listPreferredPacketsByType<TType extends PacketType>(
    type: TType
  ): Promise<PacketEnvelopeByType[TType][]>;
  listPreferredPackets(): Promise<PacketEnvelope[]>;
  getPacketVerificationSummary(
    packet: PacketRef
  ): Promise<NexusPacketVerificationSummary | null>;
  listPacketVerificationSummaries(): Promise<NexusPacketVerificationSummary[]>;
  writePacketVerificationSummary(
    summary: NexusPacketVerificationSummary
  ): Promise<void>;
}

export interface BrowserPacketProjection {
  packet: PacketRef;
  revision: PacketRevisionRef;
  type: PacketType;
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

export type NexusActionId =
  | 'packet.focus'
  | 'packet.open_surface'
  | 'packet.open_explorer'
  | 'packet.validate'
  | 'packet.revalidate'
  | 'packet.view_verification'
  | 'packet.view_library'
  | 'packet.view_raw'
  | 'packet.export'
  | 'packet.copy_id'
  | 'discussion.open_thread'
  | 'discussion.reply'
  | 'discussion.vote_up'
  | 'discussion.vote_down'
  | 'discussion.create_top_level'
  | 'discussion.expand_branch'
  | 'discussion.collapse_branch'
  | 'discussion.load_more_replies'
  | 'discussion.load_more_feed'
  | 'role.claim'
  | 'role.unclaim'
  | 'role.support_claim'
  | 'role.dispute_claim'
  | 'role.clear_reaction'
  | 'trust.set_residence';

export type NexusActionExecutionKind =
  | 'mutation'
  | 'navigation'
  | 'query'
  | 'local';

export interface NexusActionState {
  id: NexusActionId;
  visible: boolean;
  enabled: boolean;
  reason: string | null;
  auth_gate_reason?: string | null;
  target_packet_id?: string | null;
  target_revision_id?: string | null;
  target_type?: PacketType | null;
  target_surface?: string | null;
  target_intent?: string | null;
  target_view?: string | null;
  target_primary_tab?: string | null;
  target_home_subtab?: string | null;
  target_report_packet_id?: string | null;
}

export interface NexusActionIntentDescriptor {
  id: NexusActionId;
  execution_kind: NexusActionExecutionKind;
  label?: string;
  description?: string;
  mutation_kind?: MutationIntent['kind'];
  requires_selection?: boolean;
  target_kind?: string | null;
}

export type NexusActionMap = Partial<Record<NexusActionId, NexusActionState>>;

export interface NexusPacketCardProjection {
  packet: PacketRef;
  revision: PacketRevisionRef;
  type: PacketType;
  label: string;
  title: string;
  summary: string | null;
  status: string | null;
  created_at: string;
  verification: NexusPacketVerificationSummary | null;
}

export interface NexusLibraryQueryOptions {
  scope_mode?: 'lens' | 'local';
}

export interface NexusQueryService {
  getDashboardQueue(lens: NexusScopeLens): Promise<NexusPacketCardProjection[]>;
  listVotes(lens: NexusScopeLens): Promise<NexusPacketCardProjection[]>;
  listDiscussions(lens: NexusScopeLens): Promise<NexusPacketCardProjection[]>;
  listLibraryPackets(
    lens: NexusScopeLens,
    type?: PacketType,
    options?: NexusLibraryQueryOptions
  ): Promise<NexusPacketCardProjection[]>;
}

export interface DiscussionViewerContext {
  actor_key: string | null;
  actor_class: DiscussionActorClass;
  can_create_top_level: boolean;
  can_reply: boolean;
  can_vote: boolean;
  write_block_reason: 'none' | 'signed_actor_required' | 'residence_required';
}

export interface ReactionVoteSummary {
  upvote_count: number;
  downvote_count: number;
  net_score: number;
  total_votes: number;
  negative_ratio: number;
  viewer_value: ReactionVoteValue | 0;
  auto_hidden: boolean;
  deprioritized: boolean;
}

export interface ReactionEdgeProjection {
  packet: PacketRef;
  revision: PacketRevisionRef;
  source_actor_key: string;
  source_actor_packet_id: string | null;
  source_actor_label: string | null;
  authority_scope_packet_id: string | null;
  target_ref: PacketRef;
  vote_value: ReactionVoteValue | null;
  attestation_value: ReactionAttestationValue | null;
  emotion_ids: ReactionEmotionId[];
  status: 'active' | 'cleared';
  context_ref: PacketRef | null;
  supporting_refs: PacketRef[];
  note: string | null;
  supersedes_ref: PacketRef | null;
  created_at: string;
}

export interface AssociationRelationProjection {
  target_packet_id: string;
  target_name: string;
  relation_packet_id: string;
  status: 'active' | 'withdrawn';
  note: string | null;
  created_at: string;
  supported_by_other_count: number;
  is_self_issued_only: boolean;
  is_current: boolean;
}

export interface AssociationClaimProjection {
  target_packet_id: string;
  target_name: string;
  claim_packet_id: string;
  status: 'active' | 'withdrawn';
  note: string | null;
  created_at: string;
  supported_by_other_count: number;
  is_self_issued_only: boolean;
  is_current: boolean;
}

export interface DiscussionForumProjection {
  id: string;
  forum_kind: string;
  title: string;
  description: string;
  cadence: string;
  public_posting: boolean;
  linked_packet_label: string;
  discussion_space_packet_id: string;
  forum_packet_id: string;
  thread_packet_id: string;
  authority_scope_packet_id: string | null;
  applicable_scope_packet_ids: string[];
  default_sort: DiscussionSort;
}

export interface DiscussionNodeState {
  structural_kind: 'root_post' | 'reply';
  is_selected_thread: boolean;
  is_reply_target: boolean;
  has_children: boolean;
  has_loaded_children: boolean;
}

export interface DiscussionPostProjection {
  packet: PacketRef;
  revision: PacketRevisionRef;
  thread_ref: PacketRef;
  authority_scope_packet_id: string | null;
  applicable_scope_packet_ids: string[];
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
  vote_summary: ReactionVoteSummary;
  state: DiscussionNodeState;
  actions: NexusActionMap;
}

export interface DiscussionPageInfo {
  next_cursor: string | null;
  has_more: boolean;
}

export interface DiscussionReplyProjection extends DiscussionPostProjection {
  replies: DiscussionReplyProjection[];
  child_page: DiscussionPageInfo;
  is_collapsed_by_default: boolean;
}

export type DiscussionWorkspaceView = 'feed' | 'thread' | 'post';

export interface DiscussionWorkspaceComposer {
  mode: 'none' | 'reply' | 'top_level';
  root_post_packet_id: string | null;
  reply_target_packet_id: string | null;
}

export type DiscussionNavigationTargetKind =
  | 'space'
  | 'forum'
  | 'topic'
  | 'root_post'
  | 'reply'
  | 'unknown';

export interface DiscussionNavigationTarget {
  requested_packet_id: string;
  target_kind: DiscussionNavigationTargetKind;
  forum_id: string | null;
  root_post_packet_id: string | null;
  focus_packet_id: string | null;
  highlight_packet_id: string | null;
  focus_path_packet_ids: string[];
}

export interface DiscussionFocusModel {
  root_post_packet_id: string;
  focus_packet_id: string;
  highlight_packet_id: string;
  ancestor_packet_ids: string[];
  focus_path_packet_ids: string[];
  focus_chain_items: DiscussionPostProjection[];
}

export interface DiscussionWorkspaceModel {
  lens: NexusScopeLens;
  active_view: DiscussionWorkspaceView;
  available_forums: DiscussionForumProjection[];
  selected_forum: DiscussionForumProjection | null;
  selected_thread_packet_id: string | null;
  reply_target_packet_id: string | null;
  viewer: DiscussionViewerContext | null;
  feed_items: DiscussionPostProjection[];
  thread_root: DiscussionPostProjection | null;
  thread_items: DiscussionReplyProjection[];
  focus: DiscussionFocusModel | null;
  workspace_actions: NexusActionMap;
  action_descriptors: NexusActionIntentDescriptor[];
  composer: DiscussionWorkspaceComposer;
}

export interface DiscussionFeedProjection {
  lens: NexusScopeLens;
  forums: DiscussionForumProjection[];
  selected_forum_id: string;
  selected_sort: DiscussionSort;
  show_hidden: boolean;
  viewer: DiscussionViewerContext;
  top_level_posts: DiscussionPostProjection[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface DiscussionThreadDetailProjection {
  lens: NexusScopeLens;
  forum: DiscussionForumProjection;
  selected_reply_sort: DiscussionReplySort;
  show_hidden: boolean;
  viewer: DiscussionViewerContext;
  root_post: DiscussionPostProjection;
  replies: DiscussionReplyProjection[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface DiscussionReplyChildrenProjection {
  parent_post_packet_id: string;
  replies: DiscussionReplyProjection[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface DiscussionQueryService {
  getForumFeed(input: {
    scope_id: string;
    forum_id: string | null;
    sort: DiscussionSort | null;
    show_hidden: boolean;
    viewer_actor_key: string | null;
    cursor?: string | null;
    limit?: number | null;
  }): Promise<DiscussionFeedProjection>;
  getThreadDetail(input: {
    scope_id: string;
    post_packet_id: string;
    focus_packet_id?: string | null;
    reply_sort: DiscussionReplySort | null;
    show_hidden: boolean;
    viewer_actor_key: string | null;
    cursor?: string | null;
    limit?: number | null;
  }): Promise<DiscussionThreadDetailProjection>;
  getReplyChildren(input: {
    scope_id: string;
    thread_post_packet_id: string;
    parent_post_packet_id: string;
    reply_sort: DiscussionReplySort | null;
    show_hidden: boolean;
    viewer_actor_key: string | null;
    cursor?: string | null;
    limit?: number | null;
  }): Promise<DiscussionReplyChildrenProjection>;
  getWorkspace(input: {
    scope_id: string;
    forum_id: string | null;
    view: DiscussionWorkspaceView;
    post_packet_id: string | null;
    focus_packet_id?: string | null;
    highlight_packet_id?: string | null;
    reply_target_packet_id: string | null;
    sort: DiscussionSort | null;
    reply_sort: DiscussionReplySort | null;
    show_hidden: boolean;
    viewer_actor_key: string | null;
    feed_limit?: number | null;
    reply_limit?: number | null;
  }): Promise<DiscussionWorkspaceModel>;
  resolveNavigationTarget(input: {
    scope_id: string;
    packet_id: string;
  }): Promise<DiscussionNavigationTarget>;
}

export interface ReactionService {
  syncDerivedState(): Promise<void>;
  setReaction(input: {
    target_packet_id: string;
    actor_key: string;
    actor_class: DiscussionActorClass;
    authority_scope_id: string | null;
    vote_value?: ReactionVoteValue | 0 | null;
    attestation_value?: ReactionAttestationValue | null;
    emotion_ids?: ReactionEmotionId[];
    context_packet_id?: string | null;
    supporting_packet_ids?: string[];
    note?: string | null;
  }): Promise<ReactionVoteSummary>;
  getTargetSummary(input: {
    target_packet_id: string;
    viewer_actor_key: string | null;
  }): Promise<ReactionVoteSummary>;
  listTargetReactions(input: {
    target_packet_id: string;
    context_packet_id?: string | null;
    vote_only?: boolean;
    attestation_value?: ReactionAttestationValue | null;
    active_only?: boolean;
  }): Promise<ReactionEdgeProjection[]>;
  listActorReactions(input: {
    actor_key: string;
    active_only?: boolean;
  }): Promise<ReactionEdgeProjection[]>;
  listAssociationRelationsForActor(
    actor_packet_id: string
  ): Promise<AssociationRelationProjection[]>;
  listAssociationClaimsForActor(
    actor_packet_id: string
  ): Promise<AssociationClaimProjection[]>;
  hasActiveAssociationClaim(input: {
    actor_packet_id: string;
    target_packet_id: string;
  }): Promise<boolean>;
}
