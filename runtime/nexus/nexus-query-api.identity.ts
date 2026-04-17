/**
 * File: nexus-query-api.identity.ts
 * Description: Client-side query helpers for identity and location search APIs.
 */

import type {
  NexusIdentitySearchPayload,
  NexusLocationSearchPayload,
} from '@runtime/nexus/nexus-api-types';
import {
  fetchJsonOrThrow,
  fetchMutationJsonOrThrow,
} from '@runtime/nexus/nexus-query-api.shared';

export function fetchNexusLocationSearchPayload(
  query: string
): Promise<NexusLocationSearchPayload> {
  return fetchJsonOrThrow<NexusLocationSearchPayload>(
    `/api/nexus/location-search?query=${encodeURIComponent(query)}`
  );
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
