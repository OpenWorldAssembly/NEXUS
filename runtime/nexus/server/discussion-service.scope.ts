/**
 * File: discussion-service.scope.ts
 * Description: Scope-lens and forum-selection helpers for the SQLite discussion service.
 */

import type { PacketEnvelopeByType, PacketRef } from '@core/schema/packet-schema';
import { resolveDiscussionScopePacketId } from '@runtime/nexus/discussion-packets';

const DISCUSSION_FORUM_DISPLAY_ORDER = [
  'visitor-lobby',
  'general',
  'proposals',
  'reports',
] as const;

export type ScopeNode = {
  routeId: string;
  packetId: string;
  name: string;
  subtype: string | null;
  parentRouteId: string | null;
};

export type ScopeLens = {
  authority_scope_ref: PacketRef | null;
  applicable_scope_refs: PacketRef[];
};

export type DiscussionEntryPacket =
  | PacketEnvelopeByType['DiscussionPost']
  | PacketEnvelopeByType['DiscussionReply'];

export type VisibleForumEntry = {
  forumId: string;
  discussionSpacePacket: PacketEnvelopeByType['DiscussionSpace'];
  forumPacket: PacketEnvelopeByType['DiscussionForum'];
  displayTitle: string;
};

function decodeScopeId(scopeId: string): string {
  try {
    return decodeURIComponent(scopeId);
  } catch {
    return scopeId;
  }
}

export function toRouteScopeId(packetId: string): string {
  if (packetId.startsWith('nexus:element/')) {
    return packetId.slice('nexus:element/'.length);
  }

  return packetId.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

export function buildScopeLens(
  scopeId: string,
  scopeMap: Map<string, ScopeNode>
): ScopeLens {
  const normalizedScopeId = decodeScopeId(scopeId).trim();
  const scopeNode = scopeMap.get(normalizedScopeId);
  const authorityPacketId =
    scopeNode?.packetId ?? resolveDiscussionScopePacketId(normalizedScopeId);
  const applicable_scope_refs: PacketRef[] = [{ packet_id: authorityPacketId }];
  const visitedRouteIds = new Set<string>(
    scopeNode ? [scopeNode.routeId] : [normalizedScopeId]
  );
  let currentParentRouteId = scopeNode?.parentRouteId ?? null;

  while (currentParentRouteId && !visitedRouteIds.has(currentParentRouteId)) {
    const parentNode = scopeMap.get(currentParentRouteId);

    if (!parentNode) {
      break;
    }

    applicable_scope_refs.push({ packet_id: parentNode.packetId });
    visitedRouteIds.add(currentParentRouteId);
    currentParentRouteId = parentNode.parentRouteId;
  }

  return {
    authority_scope_ref: { packet_id: authorityPacketId },
    applicable_scope_refs,
  };
}

export function matchesScopeLens(
  packet:
    | PacketEnvelopeByType['DiscussionSpace']
    | PacketEnvelopeByType['DiscussionForum']
    | PacketEnvelopeByType['DiscussionThread']
    | DiscussionEntryPacket,
  lens: ScopeLens
): boolean {
  const visibleScopeIds = new Set(
    [
      lens.authority_scope_ref?.packet_id ?? null,
      ...lens.applicable_scope_refs.map((scopeRef) => scopeRef.packet_id),
    ].filter((scopeId): scopeId is string => typeof scopeId === 'string')
  );

  if (visibleScopeIds.size === 0) {
    return true;
  }

  if (
    packet.header.authority_scope_ref &&
    visibleScopeIds.has(packet.header.authority_scope_ref.packet_id)
  ) {
    return true;
  }

  return packet.header.applicable_scope_refs.some((scopeRef) =>
    visibleScopeIds.has(scopeRef.packet_id)
  );
}

export function matchesAuthorityScope(
  packet:
    | PacketEnvelopeByType['DiscussionSpace']
    | PacketEnvelopeByType['DiscussionForum']
    | PacketEnvelopeByType['DiscussionThread']
    | DiscussionEntryPacket,
  lens: ScopeLens
): boolean {
  const authorityPacketId = lens.authority_scope_ref?.packet_id ?? null;

  return (
    Boolean(authorityPacketId) &&
    packet.header.authority_scope_ref?.packet_id === authorityPacketId
  );
}

export function getPacketScopeRank(
  packet:
    | PacketEnvelopeByType['DiscussionSpace']
    | PacketEnvelopeByType['DiscussionForum'],
  lens: ScopeLens
): number {
  const authorityPacketId = packet.header.authority_scope_ref?.packet_id ?? null;

  if (!authorityPacketId) {
    return lens.applicable_scope_refs.length + 1;
  }

  const authorityIndex = lens.applicable_scope_refs.findIndex(
    (scopeRef) => scopeRef.packet_id === authorityPacketId
  );

  return authorityIndex >= 0 ? authorityIndex : lens.applicable_scope_refs.length + 1;
}

export function toDiscussionForumId(forumKind: string): string {
  const normalizedKind = forumKind.trim().toLowerCase();

  if (normalizedKind === 'visitor_lobby') {
    return 'visitor-lobby';
  }

  return normalizedKind.replace(/[^a-z0-9]+/g, '-');
}

export function getDiscussionForumOrder(forumId: string): number {
  const orderIndex = DISCUSSION_FORUM_DISPLAY_ORDER.indexOf(
    forumId as (typeof DISCUSSION_FORUM_DISPLAY_ORDER)[number]
  );

  return orderIndex >= 0 ? orderIndex : DISCUSSION_FORUM_DISPLAY_ORDER.length;
}

export function getDiscussionForumDisplayTitle(
  forumId: string,
  scopeName: string,
  sourceTitle: string
): string {
  if (forumId === 'visitor-lobby') {
    return `${scopeName} visitor lobby`;
  }

  if (forumId === 'general') {
    return `${scopeName} general`;
  }

  if (forumId === 'proposals') {
    return `${scopeName} proposals`;
  }

  if (forumId === 'reports') {
    return `${scopeName} reports and AARs`;
  }

  return sourceTitle;
}

export function selectForumEntry(
  forums: VisibleForumEntry[],
  requestedForumId: string | null
): VisibleForumEntry | null {
  if (forums.length === 0) {
    return null;
  }

  return forums.find((forum) => forum.forumId === requestedForumId) ?? forums[0];
}
