/**
 * File: nexus-api-types.discussions.ts
 * Description: Discussion, vote, and attestation payloads shared across Nexus routes and clients.
 */

import type {
  AttestationEdgeProjection,
  DiscussionFeedProjection,
  DiscussionForumProjection,
  DiscussionPostProjection,
  DiscussionReplyChildrenProjection,
  DiscussionReplyProjection,
  DiscussionThreadDetailProjection,
  DiscussionViewerContext,
} from '@core/contracts';
import type { AttestationValue } from '@core/schema/packet-schema';

export type NexusDiscussionForum = DiscussionForumProjection;
export type NexusDiscussionPost = DiscussionPostProjection;
export type NexusDiscussionReply = DiscussionReplyProjection;

export interface NexusDiscussionsPayload extends DiscussionFeedProjection {}

export interface NexusDiscussionThreadPayload
  extends DiscussionThreadDetailProjection {}

export interface NexusDiscussionReplyChildrenPayload
  extends DiscussionReplyChildrenProjection {}

export interface NexusVoteSummaryPayload {
  upvote_count: number;
  downvote_count: number;
  net_score: number;
  total_votes: number;
  negative_ratio: number;
  viewer_value: AttestationValue | 0;
  auto_hidden: boolean;
  deprioritized: boolean;
}

export interface NexusVoteMutationPayload {
  target_packet_id: string;
  value: AttestationValue | 0;
  summary: NexusVoteSummaryPayload;
}

export interface NexusAttestationSummaryPayload {
  target_packet_id: string;
  summary: NexusVoteSummaryPayload;
}

export interface NexusAttestationEdgesPayload {
  target_packet_id: string;
  attestations: AttestationEdgeProjection[];
}

export interface NexusActorAttestationsPayload {
  actor_key: string;
  attestations: AttestationEdgeProjection[];
}

export interface NexusDiscussionPostMutationPayload {
  viewer: DiscussionViewerContext;
  post: DiscussionPostProjection;
}

export interface NexusDiscussionSurfaceBundlePayload {
  created_packet_refs: {
    packet_id: string;
    revision_id: string;
  }[];
  discussions: NexusDiscussionsPayload;
}
