/**
 * File: nexus-query-api.workspaces.ts
 * Description: Client-side query helpers for the votes and library workspaces.
 */

import type { PacketFamily } from '@core/schema/packet-schema';
import type {
  NexusLibraryPayload,
  NexusVotesPayload,
} from '@runtime/nexus/nexus-api-types';
import { fetchJsonOrThrow } from '@runtime/nexus/nexus-query-api.shared';

export function fetchNexusVotesPayload(
  scopeId: string,
  actorPacketId?: string | null
): Promise<NexusVotesPayload> {
  const searchParams = new URLSearchParams();

  if (actorPacketId) {
    searchParams.set('actor_packet_id', actorPacketId);
  }

  return fetchJsonOrThrow<NexusVotesPayload>(
    `/api/nexus/scopes/${encodeURIComponent(scopeId)}/votes${
      searchParams.toString().length > 0 ? `?${searchParams.toString()}` : ''
    }`
  );
}

export function fetchNexusLibraryPayload(input: {
  scopeId: string;
  familyFilter: PacketFamily | null;
  actorPacketId?: string | null;
}): Promise<NexusLibraryPayload> {
  const searchParams = new URLSearchParams();

  if (input.familyFilter) {
    searchParams.set('family', input.familyFilter);
  }

  if (input.actorPacketId) {
    searchParams.set('actor_packet_id', input.actorPacketId);
  }

  const queryString = searchParams.toString();
  const path = `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/library${
    queryString.length > 0 ? `?${queryString}` : ''
  }`;

  return fetchJsonOrThrow<NexusLibraryPayload>(path);
}
