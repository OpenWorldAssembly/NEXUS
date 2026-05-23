/**
 * File: nexus-preview-target.ts
 * Description: Defines reusable Nexus preview navigation targets for cards, rows, and panels.
 */
import type { NexusPacketCardProjection } from '@core/contracts';
import type { PacketType } from '@core/schema/packet-schema';

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

const DISCUSSION_TYPES = new Set<string>(['Discussion']);

const VOTE_FAMILIES = new Set<PacketType>(['Proposal', 'Vote', 'Decision']);
const ROLE_FAMILIES = new Set<PacketType>(['Role']);
const TRUST_FAMILIES = new Set<PacketType>([
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

function getTargetPacketType(target: NexusPreviewTarget): PacketType | null {
  const rawType = target.params?.packet_type;

  return typeof rawType === 'string' && rawType.length > 0
    ? (rawType as PacketType)
    : null;
}

function packetIdIncludesAny(packetId: string, fragments: string[]): boolean {
  return fragments.some((fragment) => packetId.includes(fragment));
}

function isThreadAddressableDiscussionTarget(target: NexusPreviewTarget): boolean {
  const packetType = getTargetPacketType(target);
  const packetIds = [target.packetId, target.focusPacketId, target.highlightPacketId]
    .filter((packetId): packetId is string => Boolean(packetId));

  if (packetType && DISCUSSION_TYPES.has(packetType)) {
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
  const packetType = getTargetPacketType(target);
  const packetIds = [target.focusPacketId, target.packetId]
    .filter((packetId): packetId is string => Boolean(packetId));

  if (packetType && DISCUSSION_TYPES.has(packetType)) {
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
 * Inputs: a packet type.
 * Output: the most specific Nexus surface that can contextualize that packet type.
 */
export function getNexusPreviewSurfaceForPacketType(
  type: PacketType | null,
): NexusPreviewSurface {
  if (!type) {
    return 'library';
  }

  if (DISCUSSION_TYPES.has(type)) {
    return 'discussions';
  }

  if (VOTE_FAMILIES.has(type)) {
    return 'votes';
  }

  if (ROLE_FAMILIES.has(type)) {
    return 'roles';
  }

  if (TRUST_FAMILIES.has(type)) {
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
    surface: input?.surface ?? getNexusPreviewSurfaceForPacketType(packet.type),
    packetId,
    revisionId: packet.revision.revision_id,
    focusPacketId: packetId,
    highlightPacketId: packetId,
    intent: input?.intent,
    params: {
      packet_type: packet.type,
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
