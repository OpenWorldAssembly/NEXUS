/**
 * File: nexus-api-types.ts
 * Description: Shares Nexus API response types between server routes and client surfaces.
 */

import type {
  NexusPacketCardProjection,
  NexusScopeLens,
} from '@/domain/core/contracts';
import type { PacketFamily } from '@/domain/schema/packet-schema';
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

export interface NexusDiscussionForum {
  id: string;
  title: string;
  description: string;
  cadence: string;
  public_posting: boolean;
  linked_packet_label: string;
  thread_packet_id: string;
}

export interface NexusDiscussionsPayload {
  lens: NexusScopeLens;
  forums: NexusDiscussionForum[];
  latest_posts: NexusPacketCardProjection[];
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

