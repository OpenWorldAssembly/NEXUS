/**
 * File: nexus-query-api.roles.ts
 * Description: Client-side query helpers for the roles workspace.
 */

import type { NexusRolesPayload } from '@runtime/nexus/nexus-api-types';
import { fetchJsonOrThrow } from '@runtime/nexus/nexus-query-api.shared';

export function fetchNexusRolesPayload(input: {
  scopeId: string;
  actorPacketId?: string | null;
}): Promise<NexusRolesPayload> {
  const searchParams = new URLSearchParams();

  if (input.actorPacketId) {
    searchParams.set('actor_packet_id', input.actorPacketId);
  }

  const queryString = searchParams.toString();

  return fetchJsonOrThrow<NexusRolesPayload>(
    `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/roles${
      queryString.length > 0 ? `?${queryString}` : ''
    }`,
    {
      cache: 'no-store',
    }
  );
}
