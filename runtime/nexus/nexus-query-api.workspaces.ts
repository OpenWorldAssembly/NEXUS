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
  scopeId: string
): Promise<NexusVotesPayload> {
  return fetchJsonOrThrow<NexusVotesPayload>(
    `/api/nexus/scopes/${encodeURIComponent(scopeId)}/votes`
  );
}

export function fetchNexusLibraryPayload(input: {
  scopeId: string;
  familyFilter: PacketFamily | null;
}): Promise<NexusLibraryPayload> {
  const searchParams = new URLSearchParams();

  if (input.familyFilter) {
    searchParams.set('family', input.familyFilter);
  }

  const queryString = searchParams.toString();
  const path = `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/library${
    queryString.length > 0 ? `?${queryString}` : ''
  }`;

  return fetchJsonOrThrow<NexusLibraryPayload>(path);
}
