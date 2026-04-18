/**
 * File: nexus-query-api.trust.ts
 * Description: Client-side query helpers for the trust workspace and role-claim mutations.
 */

import type {
  NexusRoleClaimMutationPayload,
  NexusTrustPayload,
} from '@runtime/nexus/nexus-api-types';
import {
  fetchJsonOrThrow,
  fetchMutationJsonOrThrow,
} from '@runtime/nexus/nexus-query-api.shared';

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

export function setNexusRoleClaim(input: {
  requestBody: Record<string, unknown>;
}): Promise<NexusRoleClaimMutationPayload> {
  return fetchMutationJsonOrThrow<NexusRoleClaimMutationPayload>({
    path: '/api/nexus/trust/roles',
    method: 'PUT',
    body: input.requestBody,
  });
}
