/**
 * File: packet-build-helpers.ts
 * Description: Shared packet-builder helper utilities used by generic type build modules.
 */

import type {
  PacketEdge,
  PacketRef,
  PacketRevisionRef,
} from '@core/schema/packet-schema';

/**
 * Inputs: a packet id string.
 * Output: a packet ref object suitable for scope refs, links, and graph edges.
 */
export function createPacketRef(packetId: string): PacketRef {
  return { packet_id: packetId };
}

/**
 * Inputs: a packet id and revision id string.
 * Output: an immutable revision ref object.
 */
export function createPacketRevisionRef(
  packetId: string,
  revisionId: string
): PacketRevisionRef {
  return {
    packet_id: packetId,
    revision_id: revisionId,
  };
}

/**
 * Inputs: a packet id and optional revision number.
 * Output: a deterministic initial revision id for seeds, fixtures, and imported packets.
 */
export function createInitialRevisionId(
  packetId: string,
  revisionNumber = 1
): string {
  return `${packetId}@r${revisionNumber}`;
}

/**
 * Inputs: an edge kind, one edge target, and optional edge metadata.
 * Output: one normalized packet edge entry.
 */
export function createPacketEdge(
  edgeType: string,
  target: PacketRef | string,
  metadata: Record<string, unknown> = {}
): PacketEdge {
  return {
    edge_type: edgeType,
    target: typeof target === 'string' ? createPacketRef(target) : target,
    metadata,
  };
}

/**
 * Inputs: freeform text and an optional excerpt length.
 * Output: a trimmed excerpt suitable for packet summaries and feed previews.
 */
export function createTextExcerpt(content: string, maxLength = 140): string {
  const normalized = content.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}
