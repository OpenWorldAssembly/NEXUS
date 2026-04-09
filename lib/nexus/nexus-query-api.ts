/**
 * File: nexus-query-api.ts
 * Description: Provides client-side helpers for packet-backed Nexus shell and route data APIs.
 */

import type { PacketFamily } from '@/domain/schema/packet-schema';
import type {
  NexusDashboardPayload,
  NexusDiscussionPostMutationPayload,
  NexusDiscussionThreadPayload,
  NexusDiscussionsPayload,
  NexusLibraryPayload,
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
    viewerSessionId?: string | null;
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

  if (input.viewerSessionId) {
    searchParams.set('viewer_session_id', input.viewerSessionId);
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
  viewerSessionId?: string | null;
}): Promise<NexusDiscussionThreadPayload> {
  const searchParams = new URLSearchParams();

  if (input.replySort) {
    searchParams.set('reply_sort', input.replySort);
  }

  if (input.showHidden) {
    searchParams.set('show_hidden', 'true');
  }

  if (input.viewerSessionId) {
    searchParams.set('viewer_session_id', input.viewerSessionId);
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
 * Inputs: a discussion scope id plus top-level post body.
 * Output: the saved post projection and refreshed viewer state.
 */
export function createNexusDiscussionPost(input: {
  scopeId: string;
  threadPacketId: string;
  sessionId: string;
  shortLabel: string;
  title: string;
  body: string;
}): Promise<NexusDiscussionPostMutationPayload> {
  return fetchMutationJsonOrThrow<NexusDiscussionPostMutationPayload>({
    path: `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/discussions/posts`,
    method: 'POST',
    body: {
      session_id: input.sessionId,
      short_label: input.shortLabel,
      thread_packet_id: input.threadPacketId,
      title: input.title,
      body: input.body,
    },
  });
}

/**
 * Inputs: a discussion scope id, parent post id, and reply body.
 * Output: the saved reply projection and refreshed viewer state.
 */
export function createNexusDiscussionReply(input: {
  scopeId: string;
  postPacketId: string;
  sessionId: string;
  shortLabel: string;
  body: string;
}): Promise<NexusDiscussionPostMutationPayload> {
  return fetchMutationJsonOrThrow<NexusDiscussionPostMutationPayload>({
    path: `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/discussions/replies`,
    method: 'POST',
    body: {
      session_id: input.sessionId,
      short_label: input.shortLabel,
      parent_post_packet_id: input.postPacketId,
      body: input.body,
    },
  });
}

/**
 * Inputs: a target packet id, scope id, and vote value for the current anonymous session.
 * Output: the refreshed vote summary for that packet.
 */
export function setNexusPacketVote(input: {
  packetId: string;
  scopeId: string;
  sessionId: string;
  shortLabel: string;
  value: -1 | 0 | 1;
}): Promise<NexusVoteMutationPayload> {
  return fetchMutationJsonOrThrow<NexusVoteMutationPayload>({
    path: '/api/nexus/packets/vote',
    method: 'PUT',
    body: {
      target_packet_id: input.packetId,
      session_id: input.sessionId,
      short_label: input.shortLabel,
      scope_id: input.scopeId,
      value: input.value,
    },
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
