/**
 * File: nexus-query-api.discussions.ts
 * Description: Client-side query helpers for discussion, reply, and vote APIs.
 */

import type {
  NexusDiscussionPostMutationPayload,
  NexusDiscussionReplyChildrenPayload,
  NexusDiscussionSurfaceBundlePayload,
  NexusDiscussionThreadPayload,
  NexusDiscussionsPayload,
  NexusVoteMutationPayload,
} from '@runtime/nexus/nexus-api-types';
import {
  fetchJsonOrThrow,
  fetchMutationJsonOrThrow,
} from '@runtime/nexus/nexus-query-api.shared';

export function fetchNexusDiscussionsPayload(input: {
  scopeId: string;
  forumId?: string | null;
  sort?: string | null;
  showHidden?: boolean;
  viewerActorPacketId?: string | null;
  cursor?: string | null;
  limit?: number | null;
}): Promise<NexusDiscussionsPayload> {
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

export function ensureNexusDiscussionSurfaces(input: {
  scopeId: string;
  requestBody: Record<string, unknown>;
}): Promise<NexusDiscussionSurfaceBundlePayload> {
  return fetchMutationJsonOrThrow<NexusDiscussionSurfaceBundlePayload>({
    path: `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/discussions/surfaces`,
    method: 'PUT',
    body: input.requestBody,
  });
}
