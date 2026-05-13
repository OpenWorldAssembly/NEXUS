/**
 * File: nexus-query-api.identity.ts
 * Description: Client-side query helpers for identity and location search APIs.
 */

import type {
  NexusIdentitySearchPayload,
  NexusLocalityPathPreviewPayload,
  NexusLocalityPathPreviewRequest,
  NexusLocationSearchPayload,
} from '@runtime/nexus/nexus-api-types';
import {
  fetchJsonOrThrow,
  fetchMutationJsonOrThrow,
} from '@runtime/nexus/nexus-query-api.shared';

export function fetchNexusLocationSearchPayload(
  query: string,
  options?: {
    level?: 'nation' | 'region' | 'city' | 'district' | null;
    parentScopeId?: string | null;
  }
): Promise<NexusLocationSearchPayload> {
  const params = new URLSearchParams({ query });

  if (options?.level) {
    params.set('level', options.level);
  }

  if (options?.parentScopeId) {
    params.set('parent_scope_id', options.parentScopeId);
  }

  return fetchJsonOrThrow<NexusLocationSearchPayload>(
    `/api/nexus/location-search?${params.toString()}`
  );
}

export function previewNexusLocalityPath(
  input: NexusLocalityPathPreviewRequest
): Promise<NexusLocalityPathPreviewPayload> {
  return fetchMutationJsonOrThrow<NexusLocalityPathPreviewPayload>({
    path: '/api/nexus/locality-preview',
    method: 'POST',
    body: input,
  });
}

export function fetchNexusIdentitySearchPayload(input: {
  query: string;
  savedActorPacketIds: string[];
}): Promise<NexusIdentitySearchPayload> {
  return fetchMutationJsonOrThrow<NexusIdentitySearchPayload>({
    path: '/api/nexus/identity-search',
    method: 'POST',
    body: {
      query: input.query,
      saved_actor_packet_ids: input.savedActorPacketIds,
    },
  });
}
