/**
 * File: nexus-query-api.ts
 * Description: Provides client-side helpers for packet-backed Nexus shell and route data APIs.
 */

import type { PacketFamily } from '@/domain/schema/packet-schema';
import type {
  NexusAssemblyClaimMutationPayload,
  NexusAssemblyClaimsPayload,
  NexusCreateAssemblyPayload,
  NexusDashboardPayload,
  NexusDiscussionPostMutationPayload,
  NexusDiscussionReplyChildrenPayload,
  NexusDiscussionThreadPayload,
  NexusDiscussionsPayload,
  NexusIdentitySearchPayload,
  NexusLibraryPayload,
  NexusLocationSearchPayload,
  NexusShellPayload,
  NexusVoteMutationPayload,
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

async function fetchMutationJsonOrThrow<TPayload>(input: {
  path: string;
  method: 'POST' | 'PUT';
  body: unknown;
}): Promise<TPayload> {
  const response = await fetch(input.path, {
    method: input.method,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input.body),
  });

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
 * Inputs: a location query string.
 * Output: canonical location matches for identity disclosure selection.
 */
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
  input: {
    scopeId: string;
    forumId?: string | null;
    sort?: string | null;
    showHidden?: boolean;
    viewerActorPacketId?: string | null;
    cursor?: string | null;
    limit?: number | null;
  }
): Promise<NexusDiscussionsPayload> {
  const searchParams = new URLSearchParams();

  if (input.forumId) {
    searchParams.set('forum', input.forumId);
  }

  if (input.sort) {
    searchParams.set('sort', input.sort);
  }

  if (input.showHidden) {
    searchParams.set('show_hidden', 'true');
  }

  if (input.viewerActorPacketId) {
    searchParams.set('viewer_actor_packet_id', input.viewerActorPacketId);
  }

  if (input.cursor) {
    searchParams.set('cursor', input.cursor);
  }

  if (typeof input.limit === 'number' && Number.isFinite(input.limit)) {
    searchParams.set('limit', String(input.limit));
  }

  const queryString = searchParams.toString();

  return fetchJsonOrThrow<NexusDiscussionsPayload>(
    `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/discussions${
      queryString.length > 0 ? `?${queryString}` : ''
    }`
  );
}

/**
 * Inputs: a scope id, root post id, and optional reply-tree settings.
 * Output: one discussion thread payload with the selected root post and nested replies.
 */
export function fetchNexusDiscussionThreadPayload(input: {
  scopeId: string;
  postPacketId: string;
  replySort?: string | null;
  showHidden?: boolean;
  viewerActorPacketId?: string | null;
  cursor?: string | null;
  limit?: number | null;
}): Promise<NexusDiscussionThreadPayload> {
  const searchParams = new URLSearchParams();

  if (input.replySort) {
    searchParams.set('reply_sort', input.replySort);
  }

  if (input.showHidden) {
    searchParams.set('show_hidden', 'true');
  }

  if (input.viewerActorPacketId) {
    searchParams.set('viewer_actor_packet_id', input.viewerActorPacketId);
  }

  if (input.cursor) {
    searchParams.set('cursor', input.cursor);
  }

  if (typeof input.limit === 'number' && Number.isFinite(input.limit)) {
    searchParams.set('limit', String(input.limit));
  }
  searchParams.set('post_packet_id', input.postPacketId);

  const queryString = searchParams.toString();

  return fetchJsonOrThrow<NexusDiscussionThreadPayload>(
    `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/discussions/thread${
      queryString.length > 0 ? `?${queryString}` : ''
    }`
  );
}

/**
 * Inputs: a scope id, parent post id, and optional reply pagination settings.
 * Output: one page of direct child replies for the selected parent post.
 */
export function fetchNexusDiscussionReplyChildrenPayload(input: {
  scopeId: string;
  threadPostPacketId: string;
  parentPostPacketId: string;
  replySort?: string | null;
  showHidden?: boolean;
  viewerActorPacketId?: string | null;
  cursor?: string | null;
  limit?: number | null;
}): Promise<NexusDiscussionReplyChildrenPayload> {
  const searchParams = new URLSearchParams();

  searchParams.set('thread_post_packet_id', input.threadPostPacketId);
  searchParams.set('parent_post_packet_id', input.parentPostPacketId);

  if (input.replySort) {
    searchParams.set('reply_sort', input.replySort);
  }

  if (input.showHidden) {
    searchParams.set('show_hidden', 'true');
  }

  if (input.viewerActorPacketId) {
    searchParams.set('viewer_actor_packet_id', input.viewerActorPacketId);
  }

  if (input.cursor) {
    searchParams.set('cursor', input.cursor);
  }

  if (typeof input.limit === 'number' && Number.isFinite(input.limit)) {
    searchParams.set('limit', String(input.limit));
  }

  return fetchJsonOrThrow<NexusDiscussionReplyChildrenPayload>(
    `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/discussions/replies?${searchParams.toString()}`
  );
}

/**
 * Inputs: a discussion scope id plus top-level post body.
 * Output: the saved post projection and refreshed viewer state.
 */
export function createNexusDiscussionPost(input: {
  scopeId: string;
  requestBody: Record<string, unknown>;
}): Promise<NexusDiscussionPostMutationPayload> {
  return fetchMutationJsonOrThrow<NexusDiscussionPostMutationPayload>({
    path: `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/discussions/posts`,
    method: 'POST',
    body: input.requestBody,
  });
}

/**
 * Inputs: a discussion scope id, parent post id, and reply body.
 * Output: the saved reply projection and refreshed viewer state.
 */
export function createNexusDiscussionReply(input: {
  scopeId: string;
  requestBody: Record<string, unknown>;
}): Promise<NexusDiscussionPostMutationPayload> {
  return fetchMutationJsonOrThrow<NexusDiscussionPostMutationPayload>({
    path: `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/discussions/replies`,
    method: 'POST',
    body: input.requestBody,
  });
}

/**
 * Inputs: a target packet id, scope id, and vote value for the current anonymous session.
 * Output: the refreshed vote summary for that packet.
 */
export function setNexusPacketVote(input: {
  requestBody: Record<string, unknown>;
}): Promise<NexusVoteMutationPayload> {
  return fetchMutationJsonOrThrow<NexusVoteMutationPayload>({
    path: '/api/nexus/packets/vote',
    method: 'PUT',
    body: input.requestBody,
  });
}

export function setNexusAttestation(input: {
  requestBody: Record<string, unknown>;
}): Promise<NexusVoteMutationPayload> {
  return setNexusPacketVote(input);
}

export function fetchNexusAssemblyClaims(input: {
  actorPacketId: string;
}): Promise<NexusAssemblyClaimsPayload> {
  return fetchJsonOrThrow<NexusAssemblyClaimsPayload>(
    `/api/nexus/assemblies/claims?actor_packet_id=${encodeURIComponent(input.actorPacketId)}`
  );
}

export function setNexusAssemblyAssociationClaim(input: {
  requestBody: Record<string, unknown>;
}): Promise<NexusAssemblyClaimMutationPayload> {
  return fetchMutationJsonOrThrow<NexusAssemblyClaimMutationPayload>({
    path: '/api/nexus/assemblies/claims',
    method: 'PUT',
    body: input.requestBody,
  });
}

export function createNexusAssembly(input: {
  requestBody: Record<string, unknown>;
}): Promise<NexusCreateAssemblyPayload> {
  return fetchMutationJsonOrThrow<NexusCreateAssemblyPayload>({
    path: '/api/nexus/assemblies',
    method: 'POST',
    body: input.requestBody,
  });
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
