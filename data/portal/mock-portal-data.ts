/**
 * File: mock-portal-data.ts
 * Description: Provides seeded portal mock data for the initial guest-facing civic shell.
 */
import type {
  PortalGuestCapability,
  PortalScopeSummary,
} from '@/lib/portal/portal-shell';

export type PortalCardTone = 'sky' | 'mint' | 'gold' | 'rose';

export type PortalDashboardMetric = {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: PortalCardTone;
  scopeIds: string[];
};

export type PortalDashboardQueue = {
  id: string;
  title: string;
  detail: string;
  stat: string;
  tone: PortalCardTone;
  scopeIds: string[];
};

export type PortalDiscussionForum = {
  id: string;
  title: string;
  description: string;
  cadence: string;
  publicPosting: boolean;
  linkedPacketLabel: string;
  scopeIds: string[];
};

export type PortalThreadPreview = {
  id: string;
  forumId: string;
  title: string;
  author: string;
  preview: string;
  activity: string;
  tone: PortalCardTone;
  scopeIds: string[];
};

export type PortalVoteStageCard = {
  id: string;
  title: string;
  count: number;
  detail: string;
  tone: PortalCardTone;
  scopeIds: string[];
};

export type PortalProposalPreview = {
  id: string;
  title: string;
  stage: string;
  summary: string;
  votingWindow: string;
  lineage: string;
  scopeIds: string[];
};

export type PortalPacketPreview = {
  id: string;
  title: string;
  type: 'proposal' | 'report' | 'assembly' | 'policy' | 'forum-post' | 'charter';
  summary: string;
  lineage: string;
  scopeIds: string[];
};

export type PortalGuestChecklistItem = {
  id: string;
  title: string;
  detail: string;
  tone: PortalCardTone;
};

export const portalGuestCapabilities: PortalGuestCapability[] = [
  'browse-public-scopes',
  'browse-public-packets',
  'post-visitor-lobby',
];

export const portalDefaultScopeId = 'global-commons';

export const portalDefaultExpandedScopeIds = [
  'global-commons',
  'united-states',
  'california',
  'east-bay',
];

export const portalFollowedScopeIds = [
  'oakland-lake-merritt',
  'richmond-waterfront',
];

export const portalGuestProfile = {
  displayName: 'Anonymous Guest',
  trustLabel: 'Self-proclaimed assembly member',
  statusLabel: 'Global Guest',
  localityLabel: 'No locality pinned yet',
  note: 'Guests can browse public assemblies, switch scopes, and post only inside visitor lobby discussions.',
};

export const portalComingSoonSurfaces = [
  'Missions',
  'Assemblies',
  'Map / Nexus Browser',
  'Messages / Chat',
  'Notifications',
  'Admin / Stewardship',
];

export const portalScopeSummaries: PortalScopeSummary[] = [
  {
    id: 'global-commons',
    name: 'Global Commons',
    shortLabel: 'Global',
    level: 'global',
    description: 'The public-wide civic surface for guests, followed branches, and cross-scope packet discovery.',
    localityLabel: 'No locality required',
    badge: 'Guest default',
    relationshipLabel: 'Cross-scope coordination',
    childIds: ['united-states'],
    followedScopeIds: portalFollowedScopeIds,
    publicLobbyLabel: 'Global visitor lobby',
    stats: {
      members: 1820,
      activeVotes: 14,
      hotDiscussions: 38,
      missions: 11,
      guestLobbyOpen: true,
    },
  },
  {
    id: 'united-states',
    name: 'United States',
    shortLabel: 'U.S.',
    level: 'nation',
    description: 'National branch view for public proposals, propagation tracking, and major assemblies.',
    localityLabel: 'National branch',
    badge: 'Parent scope',
    relationshipLabel: 'Parent to California',
    parentId: 'global-commons',
    childIds: ['california'],
    followedScopeIds: portalFollowedScopeIds,
    publicLobbyLabel: 'National visitor lobby',
    stats: {
      members: 430,
      activeVotes: 8,
      hotDiscussions: 19,
      missions: 5,
      guestLobbyOpen: true,
    },
  },
  {
    id: 'california',
    name: 'California',
    shortLabel: 'CA',
    level: 'region',
    description: 'Regional scope showing statewide proposals, forkable packets, and locality health signals.',
    localityLabel: 'State branch',
    badge: 'Parent scope',
    relationshipLabel: 'Parent to East Bay',
    parentId: 'united-states',
    childIds: ['east-bay'],
    followedScopeIds: portalFollowedScopeIds,
    publicLobbyLabel: 'California visitor lobby',
    stats: {
      members: 112,
      activeVotes: 5,
      hotDiscussions: 13,
      missions: 3,
      guestLobbyOpen: true,
    },
  },
  {
    id: 'east-bay',
    name: 'East Bay',
    shortLabel: 'East Bay',
    level: 'city',
    description: 'Metro branch with active locality discovery, adoption flow, and nearby public assemblies.',
    localityLabel: 'Regional locality',
    badge: 'Current branch candidate',
    relationshipLabel: 'Parent to Oakland and Richmond',
    parentId: 'california',
    childIds: ['oakland-lake-merritt', 'richmond-waterfront'],
    followedScopeIds: portalFollowedScopeIds,
    publicLobbyLabel: 'East Bay visitor lobby',
    stats: {
      members: 57,
      activeVotes: 4,
      hotDiscussions: 9,
      missions: 2,
      guestLobbyOpen: true,
    },
  },
  {
    id: 'oakland-lake-merritt',
    name: 'Oakland Lake Merritt',
    shortLabel: 'Oakland',
    level: 'district',
    description: 'Local assembly branch with a public visitor lobby, assembly forum, and nearby coordination rooms.',
    localityLabel: 'Local assembly',
    badge: 'Followed scope',
    relationshipLabel: 'Child of East Bay',
    parentId: 'east-bay',
    childIds: [],
    followedScopeIds: portalFollowedScopeIds,
    publicLobbyLabel: 'Oakland visitor lobby',
    stats: {
      members: 29,
      activeVotes: 3,
      hotDiscussions: 5,
      missions: 1,
      guestLobbyOpen: true,
    },
  },
  {
    id: 'richmond-waterfront',
    name: 'Richmond Waterfront',
    shortLabel: 'Richmond',
    level: 'district',
    description: 'A nearby followed assembly that shares public packets, neighborhood updates, and local votes.',
    localityLabel: 'Followed neighboring assembly',
    badge: 'Followed scope',
    relationshipLabel: 'Child of East Bay',
    parentId: 'east-bay',
    childIds: [],
    followedScopeIds: portalFollowedScopeIds,
    publicLobbyLabel: 'Richmond visitor lobby',
    stats: {
      members: 18,
      activeVotes: 2,
      hotDiscussions: 4,
      missions: 1,
      guestLobbyOpen: true,
    },
  },
];

export const portalDashboardMetrics: PortalDashboardMetric[] = [
  {
    id: 'open-public-assemblies',
    title: 'Public assemblies open',
    value: '128',
    detail: 'Assemblies with active guest-visible surfaces right now.',
    tone: 'sky',
    scopeIds: ['global-commons'],
  },
  {
    id: 'petitions-needing-support',
    title: 'Petitions nearing threshold',
    value: '24',
    detail: 'Public proposals that need support before reaching vote review.',
    tone: 'gold',
    scopeIds: ['global-commons', 'united-states', 'california'],
  },
  {
    id: 'votes-closing',
    title: 'Votes closing soon',
    value: '7',
    detail: 'Open civic ballots with the closest deadlines across the visible branch.',
    tone: 'rose',
    scopeIds: ['global-commons', 'california', 'east-bay', 'oakland-lake-merritt'],
  },
  {
    id: 'visitor-lobbies-open',
    title: 'Visitor lobbies open',
    value: '5',
    detail: 'Public discussion spaces where guests can ask questions or introduce themselves.',
    tone: 'mint',
    scopeIds: ['global-commons', 'east-bay', 'oakland-lake-merritt', 'richmond-waterfront'],
  },
];

export const portalDashboardQueues: PortalDashboardQueue[] = [
  {
    id: 'discussion-heat',
    title: 'Hot discussions',
    detail: 'Guest-visible threads about charter drafts, moderation norms, and local onboarding.',
    stat: '38 threads',
    tone: 'sky',
    scopeIds: ['global-commons', 'east-bay', 'oakland-lake-merritt'],
  },
  {
    id: 'support-queue',
    title: 'Proposals needing support',
    detail: 'Items still in petition or support gathering before they can move into review.',
    stat: '11 open',
    tone: 'gold',
    scopeIds: ['global-commons', 'california', 'oakland-lake-merritt'],
  },
  {
    id: 'vote-floor',
    title: 'Up for vote',
    detail: 'Public ballot items where quorum, threshold, and time window are already legible.',
    stat: '6 ballots',
    tone: 'rose',
    scopeIds: ['global-commons', 'california', 'east-bay', 'oakland-lake-merritt'],
  },
  {
    id: 'report-loop',
    title: 'Mission activity',
    detail: 'Linked mission reports and next steps tied to recent proposal outcomes.',
    stat: '9 reports',
    tone: 'mint',
    scopeIds: ['global-commons', 'east-bay', 'richmond-waterfront'],
  },
  {
    id: 'recommended-packets',
    title: 'Recommended packets',
    detail: 'Suggested charters, proposal packets, and report bundles worth opening or forking later.',
    stat: '15 packets',
    tone: 'sky',
    scopeIds: ['global-commons', 'california', 'east-bay'],
  },
  {
    id: 'nearby-assemblies',
    title: 'Nearby assembly activity',
    detail: 'Followed local branches showing recent decisions, public questions, and visitor lobby traffic.',
    stat: '2 followed',
    tone: 'mint',
    scopeIds: ['east-bay', 'oakland-lake-merritt', 'richmond-waterfront'],
  },
];

export const portalDiscussionForums: PortalDiscussionForum[] = [
  {
    id: 'visitor-lobby',
    title: 'Visitor Lobby',
    description: 'Public channel for introductions, locality questions, and newcomer orientation.',
    cadence: 'Replies in the last hour',
    publicPosting: true,
    linkedPacketLabel: 'Guest-intro forum packet',
    scopeIds: ['global-commons', 'east-bay', 'oakland-lake-merritt', 'richmond-waterfront'],
  },
  {
    id: 'general',
    title: 'General',
    description: 'Assembly-wide conversation, updates, and context-setting threads.',
    cadence: 'Most active daily',
    publicPosting: false,
    linkedPacketLabel: 'General discussion packet space',
    scopeIds: ['global-commons', 'california', 'east-bay', 'oakland-lake-merritt'],
  },
  {
    id: 'proposals',
    title: 'Proposals',
    description: 'Packet-native discussion floor attached to formal proposal drafts and reviews.',
    cadence: 'Tracks vote-ready items',
    publicPosting: false,
    linkedPacketLabel: 'Proposal-linked forum space',
    scopeIds: ['global-commons', 'california', 'oakland-lake-merritt'],
  },
  {
    id: 'reports',
    title: 'Reports / AARs',
    description: 'Durable mission learning loop for reports, after-action notes, and adoption follow-ups.',
    cadence: 'Updates after actions close',
    publicPosting: false,
    linkedPacketLabel: 'Report archive surface',
    scopeIds: ['global-commons', 'east-bay', 'richmond-waterfront'],
  },
];

export const portalThreadPreviews: PortalThreadPreview[] = [
  {
    id: 'welcome-thread',
    forumId: 'visitor-lobby',
    title: 'Where should guests start if they only know their rough locality?',
    author: 'Harbor Steward',
    preview: 'We are collecting the cleanest first-run flow for people who want to browse before joining an assembly.',
    activity: '17 replies',
    tone: 'sky',
    scopeIds: ['global-commons', 'east-bay'],
  },
  {
    id: 'charter-thread',
    forumId: 'general',
    title: 'Charter language for open public lobbies',
    author: 'Packet Weaver',
    preview: 'Drafting a common policy that allows anonymous guests to speak in visitor-facing spaces without granting broader posting rights.',
    activity: '9 replies',
    tone: 'gold',
    scopeIds: ['global-commons', 'california'],
  },
  {
    id: 'oakland-thread',
    forumId: 'visitor-lobby',
    title: 'Oakland Lake Merritt newcomers thread',
    author: 'Lake Merritt Steward',
    preview: 'Local assembly members are keeping one public thread open for guests looking to join or start a nearby node.',
    activity: '6 replies',
    tone: 'mint',
    scopeIds: ['oakland-lake-merritt', 'east-bay'],
  },
  {
    id: 'report-thread',
    forumId: 'reports',
    title: 'East Bay rain response after-action notes',
    author: 'Mission Relay',
    preview: 'The report packet is live with turnout numbers, supply gaps, and recommendations for the next fork.',
    activity: '4 replies',
    tone: 'rose',
    scopeIds: ['east-bay', 'richmond-waterfront'],
  },
];

export const portalVoteStages: PortalVoteStageCard[] = [
  {
    id: 'petitioning',
    title: 'Petitioning',
    count: 11,
    detail: 'Public support gathering before review.',
    tone: 'gold',
    scopeIds: ['global-commons', 'california', 'oakland-lake-merritt'],
  },
  {
    id: 'under-review',
    title: 'Under review',
    count: 5,
    detail: 'Packets receiving objections or clarification requests.',
    tone: 'sky',
    scopeIds: ['global-commons', 'california'],
  },
  {
    id: 'up-for-vote',
    title: 'Up for vote',
    count: 6,
    detail: 'Ballots currently open with deadline and threshold visible.',
    tone: 'rose',
    scopeIds: ['global-commons', 'east-bay', 'oakland-lake-merritt'],
  },
  {
    id: 'completed',
    title: 'Completed',
    count: 23,
    detail: 'Recent decisions with lineages and downstream effects.',
    tone: 'mint',
    scopeIds: ['global-commons', 'california', 'east-bay'],
  },
];

export const portalProposalPreviews: PortalProposalPreview[] = [
  {
    id: 'public-lobby-charter',
    title: 'Standardize public visitor lobby policy',
    stage: 'Under review',
    summary: 'Creates a reusable packet defining what guests can post, what requires trust, and how visitor threads are moderated.',
    votingWindow: 'Clarifications due in 2 days',
    lineage: 'Forked from Global Commons charter notes',
    scopeIds: ['global-commons', 'california'],
  },
  {
    id: 'oakland-onboarding',
    title: 'Pilot locality onboarding packet for Oakland guests',
    stage: 'Petitioning',
    summary: 'Adds a scope-aware onboarding flow for guests who want to claim a locality without forced geolocation.',
    votingWindow: 'Support threshold at 62%',
    lineage: 'Fork of East Bay guest entry packet',
    scopeIds: ['east-bay', 'oakland-lake-merritt'],
  },
  {
    id: 'report-bundle-standard',
    title: 'Require mission report bundles on completed local actions',
    stage: 'Up for vote',
    summary: 'Makes mission reports easier to browse in the packet library and cross-links them into discussions and vote history.',
    votingWindow: 'Vote closes in 19 hours',
    lineage: 'Derived from East Bay report archive policy',
    scopeIds: ['global-commons', 'east-bay', 'richmond-waterfront'],
  },
];

export const portalVoteMechanics = [
  'Quorum, thresholds, and timing should be legible without opening a separate admin panel.',
  'Delegation remains visible as a later system, but this slice does not implement delegation flows.',
  'Guests can inspect public ballots and linked discussions, but they cannot cast votes in this phase.',
  'Fork and compare affordances stay visible as packet-native cues even when the actions remain disabled.',
];

export const portalPacketPreviews: PortalPacketPreview[] = [
  {
    id: 'packet-guest-lobby-policy',
    title: 'Visitor Lobby Policy Packet',
    type: 'policy',
    summary: 'Common rules for public guest channels, moderation expectations, and escalation boundaries.',
    lineage: 'Global policy packet',
    scopeIds: ['global-commons', 'california', 'east-bay'],
  },
  {
    id: 'packet-oakland-profile',
    title: 'Oakland Lake Merritt Assembly Profile',
    type: 'assembly',
    summary: 'Assembly overview packet with branch position, public lobby, and linked discussion spaces.',
    lineage: 'Assembly packet',
    scopeIds: ['oakland-lake-merritt', 'east-bay'],
  },
  {
    id: 'packet-onboarding-proposal',
    title: 'Guest Locality Onboarding Proposal',
    type: 'proposal',
    summary: 'Proposal packet for a self-claimed locality and trust-first assemblymember flow.',
    lineage: 'Fork of East Bay onboarding packet',
    scopeIds: ['east-bay', 'oakland-lake-merritt'],
  },
  {
    id: 'packet-rain-report',
    title: 'Rain Response After-Action Report',
    type: 'report',
    summary: 'Mission report packet with turnout, lessons learned, and resource gaps.',
    lineage: 'Mission report packet',
    scopeIds: ['east-bay', 'richmond-waterfront'],
  },
  {
    id: 'packet-charter-post',
    title: 'Charter thread: public lobbies and guest speech',
    type: 'forum-post',
    summary: 'Discussion packet linked into the proposal and moderation surfaces.',
    lineage: 'Forum packet',
    scopeIds: ['global-commons', 'california'],
  },
  {
    id: 'packet-charter-v1',
    title: 'Assembly Charter v1',
    type: 'charter',
    summary: 'Foundational charter packet with membership, trust, and moderation notes.',
    lineage: 'Canonical local charter',
    scopeIds: ['global-commons', 'oakland-lake-merritt'],
  },
];

export const portalGuestChecklist: PortalGuestChecklistItem[] = [
  {
    id: 'pick-locality',
    title: 'Pick or search a locality',
    detail: 'Guests can browse globally first, then claim a locality later without being forced into location capture.',
    tone: 'sky',
  },
  {
    id: 'join-lobby',
    title: 'Introduce yourself in a visitor lobby',
    detail: 'Public lobbies stay open to guests and outsiders while deeper posting rights remain trust-gated.',
    tone: 'mint',
  },
  {
    id: 'review-packets',
    title: 'Review linked packets before asking for access',
    detail: 'Proposal, charter, and report packets should be easy to inspect before any commitment is requested.',
    tone: 'gold',
  },
];
