/**
 * File: nexus-query-api.trust.ts
 * Description: Client-side query helpers for the trust workspace.
 */

import type { NexusTrustPayload } from '@runtime/nexus/nexus-api-types';
import { fetchJsonOrThrow } from '@runtime/nexus/nexus-query-api.shared';

export function fetchNexusTrustPayload(input: {
  scopeId: string;
  actorPacketId?: string | null;
}): Promise<NexusTrustPayload> {
  const searchParams = new URLSearchParams();

  if (input.actorPacketId) {
    searchParams.set('actor_packet_id', input.actorPacketId);
  }

  const queryString = searchParams.toString();

  return fetchJsonOrThrow<NexusTrustPayload>(
    `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/trust${
      queryString.length > 0 ? `?${queryString}` : ''
    }`
  );
}
