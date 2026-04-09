/**
 * File: thread+api.ts
 * Description: Serves one discussion root post and its nested replies for a specific Nexus scope using query-string packet refs.
 */

import type { RequestHandler } from 'expo-router/server';

import {
  DISCUSSION_REPLY_SORTS,
  type DiscussionReplySort,
} from '@/domain/schema/packet-schema';
import { createAnonymousActorKey } from '@/lib/nexus/anonymous-session';
import {
  getNexusDiscussionThreadPayload,
  getNexusShellPayload,
  resolveScopeIdFromShell,
} from '@/lib/nexus/server/nexus-query-data';

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

/**
 * Inputs: route scope id plus packet-id-based query params.
 * Output: the nested discussion thread payload resolved to a valid packet-backed scope id.
 */
export const GET: RequestHandler = async (request, params) => {
  try {
    const requestUrl = new URL(request.url);
    const postPacketId = requestUrl.searchParams.get('post_packet_id');
    const requestedReplySort = requestUrl.searchParams.get('reply_sort');
    const requestedShowHidden = requestUrl.searchParams.get('show_hidden');
    const viewerSessionId = requestUrl.searchParams.get('viewer_session_id');

    if (!postPacketId) {
      return createJsonResponse({ error: 'Missing post_packet_id query parameter.' }, 400);
    }

    const shellPayload = await getNexusShellPayload();
    const scopeId = resolveScopeIdFromShell(shellPayload, params.scopeId);
    const threadPayload = await getNexusDiscussionThreadPayload({
      scopeId,
      postPacketId,
      replySort:
        requestedReplySort &&
        (DISCUSSION_REPLY_SORTS as readonly string[]).includes(requestedReplySort)
          ? (requestedReplySort as DiscussionReplySort)
          : null,
      showHidden:
        requestedShowHidden === 'true' || requestedShowHidden === '1',
      viewerActorKey: viewerSessionId
        ? createAnonymousActorKey(viewerSessionId)
        : null,
    });

    return createJsonResponse(threadPayload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load the discussion thread.';

    return createJsonResponse({ error: message }, 500);
  }
};
