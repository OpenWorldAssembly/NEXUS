/**
 * File: nexus-feature-status-registry.ts
 * Description: Central registry and fallback wording for disabled/partial Nexus feature explainers.
 */

export type NexusFeatureStatusKind =
  | 'coming_soon'
  | 'read_only'
  | 'partial'
  | 'custom';

export type NexusFeatureStatusEntry = {
  kind: NexusFeatureStatusKind;
  short_label?: string;
  title?: string;
  summary?: string;
  details?: string;
  learn_more_label?: string;
};

type NexusResolvedFeatureStatusEntry = NexusFeatureStatusEntry & {
  id: NexusFeatureStatusId;
  short_label: string;
  title: string;
  summary: string;
};

const NEXUS_FEATURE_STATUS_DEFAULTS: Record<
  NexusFeatureStatusKind,
  Pick<NexusResolvedFeatureStatusEntry, 'short_label' | 'title' | 'summary'>
> = {
  coming_soon: {
    short_label: 'Soon',
    title: 'Coming soon',
    summary:
      'This control is visible now as a planned seam, but it is not wired yet.',
  },
  read_only: {
    short_label: 'Read-only',
    title: 'Read-only in this phase',
    summary:
      'This surface can be inspected now, but writing or executing this action is not available yet.',
  },
  partial: {
    short_label: 'Partial',
    title: 'Partially implemented',
    summary:
      'Some behavior exists, but this feature is still incomplete or unstable.',
  },
  custom: {
    short_label: 'Info',
    title: 'More information',
    summary:
      'This visible control is not fully available yet in the current Nexus phase.',
  },
};

const NEXUS_FEATURE_STATUS_REGISTRY = {
  'explorer.follow': {
    kind: 'coming_soon',
    title: 'Follow is coming later',
    summary:
      'Explorer can inspect packet state today, but packet and initiative follow/subscription flows are not wired from this surface yet.',
  },
  'explorer.fork': {
    kind: 'coming_soon',
    title: 'Fork is not wired yet',
    summary:
      'Fork will eventually let you create your own version of an existing packet lineage. This Explorer pass keeps that seam visible but disabled.',
  },
  'explorer.adapt': {
    kind: 'coming_soon',
    title: 'Adapt is reserved for a later pass',
    summary:
      'Adapt will cover re-signing or adapting the same lineage with changes. The distinction is deliberate, but the write flow is not live yet.',
  },
  'explorer.export': {
    kind: 'coming_soon',
    title: 'Export is coming later',
    summary:
      'Explorer export and portability workflows are planned, but this read-only phase does not yet let you package packets or bundles from here.',
  },
  'explorer.home.search_packets': {
    kind: 'partial',
    title: 'Packet search is not wired yet',
    summary:
      'The Home workspace already exposes the packet and revision lookup seam, but search execution is still pending.',
    details:
      'Use Library and Open packet for live inspection today. This field is reserved for direct packet-id and revision-id lookup in a later pass.',
  },
  'explorer.home.import_packet': {
    kind: 'coming_soon',
    title: 'Packet import is coming later',
    summary:
      'Packet import will land here once Explorer grows real portability workflows. The current phase is inspection-only.',
  },
  'explorer.home.import_bundle': {
    kind: 'coming_soon',
    title: 'Bundle import is coming later',
    summary:
      'Bundle import is planned for future portability work, but this surface does not accept bundle ingestion yet.',
  },
  'explorer.home.open_recent': {
    kind: 'coming_soon',
    title: 'Recent packet history is not wired yet',
    summary:
      'Recent opens and quick revisit flows are planned for the Explorer home workspace, but they are not live in this pass.',
  },
  'explorer.links.by_edge_type': {
    kind: 'coming_soon',
    title: 'More link grouping modes are planned',
    summary:
      'Links currently group by related packet. Alternate views like grouping by edge type are visible future seams, not live controls yet.',
  },
  'explorer.links.by_family': {
    kind: 'coming_soon',
    title: 'Family grouping is not live yet',
    summary:
      'Packet-family grouping for link relationships is planned, but the current Explorer pass only ships the related-packet view.',
  },
  'explorer.lineage.compare_revisions': {
    kind: 'coming_soon',
    title: 'Revision comparison is planned',
    summary:
      'Lineage remains read-only in this phase. Revision comparison and richer history inspection are reserved for a later Explorer pass.',
  },
  'explorer.lineage.diff': {
    kind: 'coming_soon',
    title: 'Diff is a future seam',
    summary:
      'Diff will arrive when packet-family-aware comparison and schema-targeting are ready. This placeholder is visible now so the layout can stabilize early.',
  },
  'votes.support_petition': {
    kind: 'read_only',
    title: 'Voting actions are still read-only',
    summary:
      'The Votes surface already projects packet-backed lanes and proposal cards, but support flows are not writable from Nexus yet.',
  },
  'votes.object': {
    kind: 'read_only',
    title: 'Objection flows are not live yet',
    summary:
      'You can inspect vote and petition state in this phase, but objection writes and related governance actions are still disabled.',
  },
  'votes.compare_lineages': {
    kind: 'coming_soon',
    title: 'Vote comparison is planned',
    summary:
      'Lineage comparison for votes and proposals is planned, but the current vote floor remains inspection-only.',
  },
  'library.fork_draft': {
    kind: 'coming_soon',
    title: 'Draft forking is not wired yet',
    summary:
      'Library can open packets into Explorer today, but draft forking and packet-creation flows are still queued for a later pass.',
  },
  'library.trace_lineage': {
    kind: 'partial',
    title: 'Lineage tracing starts in Explorer today',
    summary:
      'Lineage-aware inspection exists in Packet Explorer, but this Library shortcut is not wired directly from the card yet.',
    details:
      'Use Open packet to inspect the packet now, then switch to Lineage inside Explorer.',
  },
} as const satisfies Record<string, NexusFeatureStatusEntry>;

export type NexusFeatureStatusId = keyof typeof NEXUS_FEATURE_STATUS_REGISTRY;

/**
 * Inputs: a feature-status registry id.
 * Output: the raw registry entry, or throws in development if the id is unknown.
 */
export function getNexusFeatureStatusEntry(
  featureStatusId: NexusFeatureStatusId
): NexusFeatureStatusEntry {
  const entry = NEXUS_FEATURE_STATUS_REGISTRY[featureStatusId];

  if (!entry) {
    throw new Error(`Unknown Nexus feature status id: ${featureStatusId}`);
  }

  return entry;
}

/**
 * Inputs: a feature-status registry id.
 * Output: the registry entry with shared status defaults filled in for any omitted fields.
 */
export function resolveNexusFeatureStatusEntry(
  featureStatusId: NexusFeatureStatusId
): NexusResolvedFeatureStatusEntry {
  const entry = getNexusFeatureStatusEntry(featureStatusId);
  const defaults = NEXUS_FEATURE_STATUS_DEFAULTS[entry.kind];

  return {
    ...entry,
    id: featureStatusId,
    short_label: entry.short_label ?? defaults.short_label,
    title: entry.title ?? defaults.title,
    summary: entry.summary ?? defaults.summary,
  };
}
