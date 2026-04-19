/**
 * File: nexus-query-api.shell.ts
 * Description: Client-side query helpers for shell and dashboard payloads.
 */

import type {
  NexusDashboardPayload,
  NexusShellPayload,
} from '@runtime/nexus/nexus-api-types';
import { fetchJsonOrThrow } from '@runtime/nexus/nexus-query-api.shared';

export function fetchNexusShellPayload(input?: {
  actorPacketId?: string | null;
}): Promise<NexusShellPayload> {
  const searchParams = new URLSearchParams();

  if (input?.actorPacketId) {
    searchParams.set('actor_packet_id', input.actorPacketId);
  }

  const queryString = searchParams.toString();

  return fetchJsonOrThrow<NexusShellPayload>(
    `/api/nexus/shell${queryString.length > 0 ? `?${queryString}` : ''}`
  );
}

export function setNexusScopeFollowPreference(input: {
  actorPacketId?: string | null;
  scopeId: string;
  isFollowed: boolean;
}): Promise<{ followed_scope_ids: string[] }> {
  return fetchJsonOrThrow<{ followed_scope_ids: string[] }>('/api/nexus/shell/follows', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      actor_packet_id: input.actorPacketId ?? null,
      scope_id: input.scopeId,
      is_followed: input.isFollowed,
    }),
  });
}

export function fetchNexusDashboardPayload(
  scopeId: string,
  actorPacketId?: string | null
): Promise<NexusDashboardPayload> {
  const searchParams = new URLSearchParams();

  if (actorPacketId) {
    searchParams.set('actor_packet_id', actorPacketId);
  }

  const queryString = searchParams.toString();

  return fetchJsonOrThrow<NexusDashboardPayload>(
    `/api/nexus/scopes/${encodeURIComponent(scopeId)}/dashboard${
      queryString.length > 0 ? `?${queryString}` : ''
    }`
  );
}
