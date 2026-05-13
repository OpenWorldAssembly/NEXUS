/**
 * File: nexus-preview-target.ts
 * Description: Defines reusable Nexus preview navigation targets for cards, rows, and panels.
 */
import type { NexusPacketCardProjection } from '@core/contracts';
import type { PacketFamily } from '@core/schema/packet-schema';

export type NexusPreviewSurface =
  | 'dashboard'
  | 'discussions'
  | 'votes'
  | 'roles'
  | 'trust'
  | 'library'
  | 'explorer';

export type NexusPreviewTargetIntent = 'open' | 'focus';

export type NexusPreviewTarget = {
  surface: NexusPreviewSurface;
  packetId: string;
  revisionId?: string | null;
  focusPacketId?: string | null;
  highlightPacketId?: string | null;
  intent?: NexusPreviewTargetIntent;
  params?: Record<string, string | null | undefined>;
};

const ROUTABLE_PREVIEW_SURFACES = new Set<NexusPreviewSurface>([
  'dashboard',
  'discussions',
  'votes',
  'roles',
  'trust',
  'library',
]);

const DISCUSSION_FAMILIES = new Set<PacketFamily>([
  'Discussion',
  'DiscussionSpace',
  'DiscussionForum',
  'DiscussionThread',
  'DiscussionPost',
  'DiscussionReply',
]);

const VOTE_FAMILIES = new Set<PacketFamily>(['Proposal', 'Vote', 'Decision']);
const ROLE_FAMILIES = new Set<PacketFamily>(['Role']);
const TRUST_FAMILIES = new Set<PacketFamily>([
  'Claim',
  'Relation',
  'Attestation',
  'Policy',
]);

const SURFACE_LABELS: Record<NexusPreviewSurface, string> = {
  dashboard: 'Dashboard',
  discussions: 'Discussions',
  votes: 'Votes',
  roles: 'Roles',
  trust: 'Trust',
  library: 'Library',
  explorer: 'Explorer',
};

function encodeQuery(input: Record<string, string | null | undefined>): string {
  return Object.entries(input)
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`,
    )
    .join('&');
}

function getTargetPacketFamily(target: NexusPreviewTarget): PacketFamily | null {
  const rawFamily = target.params?.packet_family;

  return typeof rawFamily === 'string' && rawFamily.length > 0
    ? (rawFamily as PacketFamily)
    : null;
}

function packetIdIncludesAny(packetId: string, fragments: string[]): boolean {
  return fragments.some((fragment) => packetId.includes(fragment));
}

function isThreadAddressableDiscussionTarget(target: NexusPreviewTarget): boolean {
  const packetFamily = getTargetPacketFamily(target);
  const packetIds = [target.packetId, target.focusPacketId, target.highlightPacketId]
    .filter((packetId): packetId is string => Boolean(packetId));

  if (
    packetFamily === 'DiscussionThread' ||
    packetFamily === 'DiscussionPost' ||
    packetFamily === 'DiscussionReply'
  ) {
    return true;
  }

  return packetIds.some((packetId) =>
    packetIdIncludesAny(packetId, [
      'nexus:discussion-thread/',
      'nexus:discussion-post/',
      'nexus:discussion-reply/',
      '/thread/',
      '/topic/',
      '/post/',
      '/reply/',
      '/message/',
    ]),
  );
}

function isEntryDiscussionTarget(target: NexusPreviewTarget): boolean {
  const packetFamily = getTargetPacketFamily(target);
  const packetIds = [target.focusPacketId, target.packetId]
    .filter((packetId): packetId is string => Boolean(packetId));

  if (packetFamily === 'DiscussionPost' || packetFamily === 'DiscussionReply') {
    return true;
  }

  return packetIds.some((packetId) =>
    packetIdIncludesAny(packetId, [
      'nexus:discussion-post/',
      'nexus:discussion-reply/',
      '/post/',
      '/reply/',
      '/message/',
    ]),
  );
}

function getDiscussionRouteParams(target: NexusPreviewTarget) {
  const focusPacketId = target.focusPacketId ?? target.packetId;
  const isThreadAddressable = isThreadAddressableDiscussionTarget(target);
  const isEntryTarget = isEntryDiscussionTarget(target);

  return {
    view: isThreadAddressable ? 'thread' : 'feed',
    post: isEntryTarget ? focusPacketId : null,
    target_packet_id: target.packetId,
  };
}

/**
 * Inputs: a preview surface id.
 * Output: the human-facing label used in packet action menus.
 */
export function getNexusPreviewSurfaceLabel(
  surface: NexusPreviewSurface,
): string {
  return SURFACE_LABELS[surface];
}

/**
 * Inputs: a packet family.
 * Output: the most specific Nexus surface that can contextualize that packet family.
 */
export function getNexusPreviewSurfaceForPacketFamily(
  family: PacketFamily | null,
): NexusPreviewSurface {
  if (!family) {
    return 'library';
  }

  if (DISCUSSION_FAMILIES.has(family)) {
    return 'discussions';
  }

  if (VOTE_FAMILIES.has(family)) {
    return 'votes';
  }

  if (ROLE_FAMILIES.has(family)) {
    return 'roles';
  }

  if (TRUST_FAMILIES.has(family)) {
    return 'trust';
  }

  return 'library';
}

/**
 * Inputs: a packet card projection.
 * Output: a reusable preview target carrying packet identity for focus/highlight consumers.
 */
export function getNexusPreviewTargetForPacketProjection(
  packet: NexusPacketCardProjection,
  input?: { surface?: NexusPreviewSurface; intent?: NexusPreviewTargetIntent },
): NexusPreviewTarget {
  const packetId = packet.packet.packet_id;

  return {
    surface: input?.surface ?? getNexusPreviewSurfaceForPacketFamily(packet.family),
    packetId,
    revisionId: packet.revision.revision_id,
    focusPacketId: packetId,
    highlightPacketId: packetId,
    intent: input?.intent,
    params: {
      packet_family: packet.family,
    },
  };
}

/**
 * Inputs: a preview target.
 * Output: whether the target can become an in-app Nexus route.
 */
export function isNexusPreviewTargetRoutable(
  target: NexusPreviewTarget,
): boolean {
  return ROUTABLE_PREVIEW_SURFACES.has(target.surface);
}

/**
 * Inputs: a preview target.
 * Output: standard action-menu copy for focusing that packet in its best surface.
 */
export function getNexusPreviewTargetFocusActionLabel(
  target: NexusPreviewTarget,
): string {
  return `Focus in ${getNexusPreviewSurfaceLabel(target.surface)}`;
}

/**
 * Inputs: a preview target.
 * Output: route href with packet/focus/highlight query info, or null for non-route targets.
 */
export function resolveNexusPreviewTargetHref(
  target: NexusPreviewTarget,
  input?: { intent?: NexusPreviewTargetIntent },
): string | null {
  if (!isNexusPreviewTargetRoutable(target)) {
    return null;
  }

  const intent = input?.intent ?? target.intent ?? 'open';
  const discussionParams =
    target.surface === 'discussions' ? getDiscussionRouteParams(target) : null;
  const query = encodeQuery({
    ...target.params,
    packet_id: target.packetId,
    revision_id: target.revisionId,
    focus_packet_id: target.focusPacketId ?? target.packetId,
    highlight_packet_id: target.highlightPacketId ?? target.packetId,
    target_intent: intent === 'focus' ? intent : null,
    view: discussionParams?.view ?? null,
    post: discussionParams?.post ?? null,
    target_packet_id: discussionParams?.target_packet_id ?? null,
  });
  const baseHref = `/nexus/${target.surface}`;

  return query ? `${baseHref}?${query}` : baseHref;
}
