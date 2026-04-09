/**
 * File: nexus-query-api.ts
 * Description: Provides client-side helpers for packet-backed Nexus shell and route data APIs.
 */

import type { PacketFamily } from '@/domain/schema/packet-schema';
import type {
  NexusDashboardPayload,
  NexusDiscussionsPayload,
  NexusLibraryPayload,
  NexusShellPayload,
  NexusVotesPayload,
} from '@/lib/nexus/nexus-api-types';

async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const parsedError = (await response.json()) as { error?: string };

    if (parsedError.error) {
      return parsedError.error;
    }
  } catch {
    // Fallback to status text below when the body is not JSON.
  }

  return response.statusText || 'Nexus query request failed.';
}

async function fetchJsonOrThrow<TPayload>(path: string): Promise<TPayload> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }

  return (await response.json()) as TPayload;
}

/**
 * Inputs: none.
 * Output: packet-backed shell payload for scope and guest defaults.
 */
export function fetchNexusShellPayload(): Promise<NexusShellPayload> {
  return fetchJsonOrThrow<NexusShellPayload>('/api/nexus/shell');
}

/**
 * Inputs: a scope id.
 * Output: packet-backed dashboard payload for that scope lens.
 */
export function fetchNexusDashboardPayload(
  scopeId: string
): Promise<NexusDashboardPayload> {
  return fetchJsonOrThrow<NexusDashboardPayload>(
    `/api/nexus/scopes/${encodeURIComponent(scopeId)}/dashboard`
  );
}

/**
 * Inputs: a scope id.
 * Output: packet-backed discussion/forum payload for that scope lens.
 */
export function fetchNexusDiscussionsPayload(
  scopeId: string
): Promise<NexusDiscussionsPayload> {
  return fetchJsonOrThrow<NexusDiscussionsPayload>(
    `/api/nexus/scopes/${encodeURIComponent(scopeId)}/discussions`
  );
}

/**
 * Inputs: a scope id.
 * Output: packet-backed vote-lane payload for that scope lens.
 */
export function fetchNexusVotesPayload(
  scopeId: string
): Promise<NexusVotesPayload> {
  return fetchJsonOrThrow<NexusVotesPayload>(
    `/api/nexus/scopes/${encodeURIComponent(scopeId)}/votes`
  );
}

/**
 * Inputs: a scope id and optional packet family filter.
 * Output: packet-backed library payload for that scope lens.
 */
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

