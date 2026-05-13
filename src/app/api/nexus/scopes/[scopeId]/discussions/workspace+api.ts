/**
 * File: workspace+api.ts
 * Description: Serves the additive discussion workspace payload for one Nexus scope.
 */

import type { RequestHandler } from 'expo-router/server';

import {
  DISCUSSION_REPLY_SORTS,
  DISCUSSION_SORTS,
  type DiscussionReplySort,
  type DiscussionSort,
} from '@core/schema/packet-schema';
import {
  getNexusDiscussionWorkspacePayload,
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
 * Inputs: route scope id plus workspace query params.
 * Output: additive discussion workspace payload resolved to a valid packet-backed scope id.
 */
export const GET: RequestHandler = async (request, params) => {
  try {
    const requestUrl = new URL(request.url);
    const requestedForumId = requestUrl.searchParams.get('forum');
    const requestedSort = requestUrl.searchParams.get('sort');
    const requestedView = requestUrl.searchParams.get('view');
    const requestedPostPacketId =
      requestUrl.searchParams.get('post_packet_id') ??
      requestUrl.searchParams.get('post');
    const requestedTargetPacketId =
      requestUrl.searchParams.get('target_packet_id') ??
      requestUrl.searchParams.get('packet_id');
    const requestedFocusPacketId = requestUrl.searchParams.get('focus_packet_id');
    const requestedHighlightPacketId = requestUrl.searchParams.get(
      'highlight_packet_id'
    );
    const requestedReplyTargetPacketId = requestUrl.searchParams.get(
      'reply_target_packet_id'
    ) ?? requestUrl.searchParams.get(
      'replyTo'
    );
    const requestedReplySort =
      requestUrl.searchParams.get('reply_sort') ??
      requestUrl.searchParams.get('replySort');
    const requestedShowHidden = requestUrl.searchParams.get('show_hidden');
    const viewerActorPacketId = requestUrl.searchParams.get('viewer_actor_packet_id');
    const feedLimit = parsePositiveInteger(requestUrl.searchParams.get('feed_limit'));
    const replyLimit = parsePositiveInteger(
      requestUrl.searchParams.get('reply_limit')
    );
    const shellPayload = await getNexusShellPayload();
    const scopeId = resolveScopeIdFromShell(
      shellPayload,
      params.scopeId,
      viewerActorPacketId
    );
    const workspacePayload = await getNexusDiscussionWorkspacePayload({
      scopeId,
      forumId: requestedForumId,
      sort:
        requestedSort &&
        (DISCUSSION_SORTS as readonly string[]).includes(requestedSort)
          ? (requestedSort as DiscussionSort)
          : null,
      view:
        requestedView === 'thread' || requestedView === 'post'
          ? requestedView
          : 'feed',
      postPacketId: requestedPostPacketId,
      targetPacketId: requestedTargetPacketId,
      focusPacketId: requestedFocusPacketId,
      highlightPacketId: requestedHighlightPacketId,
      replyTargetPacketId: requestedReplyTargetPacketId,
      replySort:
        requestedReplySort &&
        (DISCUSSION_REPLY_SORTS as readonly string[]).includes(requestedReplySort)
          ? (requestedReplySort as DiscussionReplySort)
          : null,
      showHidden:
        requestedShowHidden === 'true' || requestedShowHidden === '1',
      viewerActorKey: viewerActorPacketId
        ? `element:${viewerActorPacketId}`
        : null,
      feedLimit,
      replyLimit,
    });

    return createJsonResponse(workspacePayload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load the discussion workspace.';

    return createJsonResponse({ error: message }, 500);
  }
};
