/**
 * File: nexus-api-types.ts
 * Description: Shares Nexus API response types between server routes and client surfaces.
 */

import type {
  DiscussionFeedProjection,
  DiscussionForumProjection,
  DiscussionPostProjection,
  DiscussionThreadDetailProjection,
  DiscussionViewerContext,
  NexusPacketCardProjection,
  NexusScopeLens,
} from '@/domain/core/contracts';
import type {
  PacketFamily,
  PacketVoteValue,
} from '@/domain/schema/packet-schema';
import type {
  NexusGuestChecklistItem,
  NexusGuestProfile,
} from '@/lib/nexus/nexus-content';
import type {
  NexusGuestCapability,
  NexusScopeSummary,
} from '@/lib/nexus/nexus-shell';

export interface NexusShellPayload {
  scope_summaries: NexusScopeSummary[];
  default_scope_id: string;
  default_expanded_scope_ids: string[];
  followed_scope_ids: string[];
  guest_profile: NexusGuestProfile;
  guest_capabilities: NexusGuestCapability[];
  guest_checklist: NexusGuestChecklistItem[];
  coming_soon_surfaces: string[];
}

export interface NexusDashboardMetric {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: 'sky' | 'mint' | 'gold' | 'rose';
}

export interface NexusDashboardQueueItem {
  id: string;
  title: string;
  detail: string;
  stat: string;
  tone: 'sky' | 'mint' | 'gold' | 'rose';
}

export interface NexusDashboardPayload {
  lens: NexusScopeLens;
  metrics: NexusDashboardMetric[];
  queue: NexusDashboardQueueItem[];
  recommended_packets: NexusPacketCardProjection[];
}

export type NexusDiscussionForum = DiscussionForumProjection;
export type NexusDiscussionPost = DiscussionPostProjection;

export interface NexusDiscussionsPayload extends DiscussionFeedProjection {}

export interface NexusDiscussionThreadPayload
  extends DiscussionThreadDetailProjection {}

export interface NexusVoteMutationPayload {
  target_packet_id: string;
  value: PacketVoteValue | 0;
  summary: {
    upvote_count: number;
    downvote_count: number;
    net_score: number;
    total_votes: number;
    negative_ratio: number;
    viewer_value: PacketVoteValue | 0;
    auto_hidden: boolean;
    deprioritized: boolean;
  };
}

export interface NexusDiscussionPostMutationPayload {
  viewer: DiscussionViewerContext;
  post: DiscussionPostProjection;
}

export interface NexusVotesStage {
  id: string;
  title: string;
  count: number;
  detail: string;
  tone: 'sky' | 'mint' | 'gold' | 'rose';
}

export interface NexusVotesPayload {
  lens: NexusScopeLens;
  stage_cards: NexusVotesStage[];
  vote_cards: NexusPacketCardProjection[];
  mechanics: string[];
}

export interface NexusLibraryPayload {
  lens: NexusScopeLens;
  family_filter: PacketFamily | null;
  packets: NexusPacketCardProjection[];
}
