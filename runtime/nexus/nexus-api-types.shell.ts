/**
 * File: nexus-api-types.shell.ts
 * Description: Shell and dashboard API payloads shared across Nexus routes and clients.
 */

import type { NexusPacketCardProjection, NexusScopeLens } from '@core/contracts';
import type {
  NexusGuestChecklistItem,
  NexusGuestProfile,
} from '@runtime/nexus/nexus-content';
import type {
  NexusGuestCapability,
  NexusScopeSummary,
} from '@runtime/nexus/nexus-shell';

export interface NexusShellPayload {
  scope_summaries: NexusScopeSummary[];
  default_scope_id: string;
  default_expanded_scope_ids: string[];
  geographic_mounted_scope_ids: string[];
  associated_scope_ids: string[];
  followed_scope_ids: string[];
  known_scope_ids: string[];
  known_unmounted_scope_ids: string[];
  personal_parent_scope_id: string | null;
  home_scope_id: string | null;
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
  created_at: string;
}

export interface NexusDashboardPayload {
  lens: NexusScopeLens;
  metrics: NexusDashboardMetric[];
  queue: NexusDashboardQueueItem[];
  recent_activity_packets?: NexusPacketCardProjection[];
  discussion_preview_packets?: NexusPacketCardProjection[];
  role_preview_packets?: NexusPacketCardProjection[];
  trust_review_packets: NexusPacketCardProjection[];
  vote_preview_packets?: NexusPacketCardProjection[];
  recommended_packets?: NexusPacketCardProjection[];
}
