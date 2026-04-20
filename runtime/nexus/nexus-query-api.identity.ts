/**
 * File: nexus-query-api.identity.ts
 * Description: Client-side query helpers for identity and location search APIs.
 */

import type {
  NexusCreateLocalityPayload,
  NexusIdentitySearchPayload,
  NexusLocationSearchPayload,
} from '@runtime/nexus/nexus-api-types';
import {
  fetchJsonOrThrow,
  fetchMutationJsonOrThrow,
} from '@runtime/nexus/nexus-query-api.shared';

export class NexusLocalityDuplicateWarningClientError extends Error {
  readonly duplicateWarnings: NexusCreateLocalityPayload['duplicate_warnings'];

  constructor(
    message: string,
    duplicateWarnings: NexusCreateLocalityPayload['duplicate_warnings']
  ) {
    super(message);
    this.duplicateWarnings = duplicateWarnings;
  }
}

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

export async function createNexusLocality(input: {
  requestBody: Record<string, unknown>;
}): Promise<NexusCreateLocalityPayload> {
  const response = await fetch('/api/nexus/locality', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input.requestBody),
  });

  if (response.ok) {
    return (await response.json()) as NexusCreateLocalityPayload;
  }

  const errorPayload = (await response.json().catch(() => ({}))) as {
    error?: string;
    duplicate_warnings?: NexusCreateLocalityPayload['duplicate_warnings'];
  };

  if (response.status === 409 && errorPayload.duplicate_warnings) {
    throw new NexusLocalityDuplicateWarningClientError(
      errorPayload.error ?? 'Similar localities already exist.',
      errorPayload.duplicate_warnings
    );
  }

  throw new Error(errorPayload.error ?? response.statusText);
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
