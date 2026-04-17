/**
 * File: discussions+api.ts
 * Description: Serves packet-backed forum/thread data for a specific Nexus scope lens.
 */

import type { RequestHandler } from 'expo-router/server';

import {
  DISCUSSION_SORTS,
  type DiscussionSort,
} from '@core/schema/packet-schema';
import {
  getNexusDiscussionsPayload,
  getNexusShellPayload,
  resolveScopeIdFromShell,
} from '@runtime/nexus/server/nexus-query-data';

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function parsePositiveInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

/**
 * Inputs: route scope id.
 * Output: discussions payload resolved to a valid packet-backed scope id.
 */
export const GET: RequestHandler = async (_request, params) => {
  try {
    const requestUrl = new URL(_request.url);
    const requestedForumId = requestUrl.searchParams.get('forum');
    const requestedSort = requestUrl.searchParams.get('sort');
    const requestedShowHidden = requestUrl.searchParams.get('show_hidden');
    const viewerActorPacketId = requestUrl.searchParams.get('viewer_actor_packet_id');
    const cursor = requestUrl.searchParams.get('cursor');
    const limit = parsePositiveInteger(requestUrl.searchParams.get('limit'));
    const shellPayload = await getNexusShellPayload();
    const scopeId = resolveScopeIdFromShell(shellPayload, params.scopeId);
    const discussionsPayload = await getNexusDiscussionsPayload({
      scopeId,
      forumId: requestedForumId,
      sort:
        requestedSort &&
        (DISCUSSION_SORTS as readonly string[]).includes(requestedSort)
          ? (requestedSort as DiscussionSort)
          : null,
      showHidden:
        requestedShowHidden === 'true' || requestedShowHidden === '1',
      viewerActorKey: viewerActorPacketId
        ? `element:${viewerActorPacketId}`
        : null,
      cursor,
      limit,
    });

    return createJsonResponse(discussionsPayload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load packet-backed discussions data.';

    return createJsonResponse({ error: message }, 500);
  }
};
