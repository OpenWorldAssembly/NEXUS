/**
 * File: nexus-content.ts
 * Description: Provides static copy constants that remain UI content while packet projections come online.
 */

import type { NexusGuestCapability } from '@runtime/nexus/nexus-shell';

export type NexusCardTone = 'sky' | 'mint' | 'gold' | 'rose';

export interface NexusGuestProfile {
  displayName: string;
  trustLabel: string;
  statusLabel: string;
  localityLabel: string;
  note: string;
}

export interface NexusGuestChecklistItem {
  id: string;
  title: string;
  detail: string;
  tone: NexusCardTone;
}

export const NEXUS_GUEST_CAPABILITIES: NexusGuestCapability[] = [
  'browse-public-scopes',
  'browse-public-packets',
  'post-visitor-lobby',
];

export const NEXUS_GUEST_PROFILE: NexusGuestProfile = {
  displayName: 'Anonymous Guest',
  trustLabel: 'Self-proclaimed assembly member',
  statusLabel: 'Global Guest',
  localityLabel: 'No locality pinned yet',
  note: 'Guests can browse public assemblies, switch scopes, and post only inside visitor lobby discussions.',
};

export const NEXUS_GUEST_CHECKLIST: NexusGuestChecklistItem[] = [
  {
    id: 'pick-locality',
    title: 'Pick or search a locality',
    detail:
      'Guests can browse globally first, then claim a locality later without being forced into location capture.',
    tone: 'sky',
  },
  {
    id: 'join-lobby',
    title: 'Introduce yourself in a visitor lobby',
    detail:
      'Public lobbies stay open to guests and outsiders while deeper posting rights remain trust-gated.',
    tone: 'mint',
  },
  {
    id: 'review-packets',
    title: 'Review linked packets before asking for access',
    detail:
      'Proposal, charter, and report packets should be easy to inspect before any commitment is requested.',
    tone: 'gold',
  },
];

export const NEXUS_COMING_SOON_SURFACES = [
  'Missions',
  'Assemblies',
  'Map / Nexus',
  'Messages / Chat',
  'Notifications',
  'Admin / Stewardship',
];

export const NEXUS_VOTE_MECHANICS = [
  'Quorum, thresholds, and timing should be legible without opening a separate admin panel.',
  'Delegation remains visible as a later system, but this slice does not implement delegation flows.',
  'Guests can inspect public ballots and linked discussions, but they cannot cast votes in this phase.',
  'Fork and compare affordances stay visible as packet-native cues even when the actions remain disabled.',
];

