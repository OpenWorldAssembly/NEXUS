/**
 * File: replies+api.ts
 * Description: Accepts new nested discussion replies for a Nexus scope using verified cryptographic actor assertions.
 */

import type { RequestHandler } from 'expo-router/server';

import {
  DISCUSSION_REPLY_SORTS,
  type DiscussionReplySort,
} from '@core/schema/packet-schema';
import {
  getNexusDiscussionReplyChildrenPayload,
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

export const GET: RequestHandler = async (request, params) => {
  try {
    const requestUrl = new URL(request.url);
    const threadPostPacketId = requestUrl.searchParams.get('thread_post_packet_id');
    const parentPostPacketId = requestUrl.searchParams.get('parent_post_packet_id');
    const requestedReplySort = requestUrl.searchParams.get('reply_sort');
    const requestedShowHidden = requestUrl.searchParams.get('show_hidden');
    const viewerActorPacketId = requestUrl.searchParams.get('viewer_actor_packet_id');
    const cursor = requestUrl.searchParams.get('cursor');
    const limit = parsePositiveInteger(requestUrl.searchParams.get('limit'));

    if (!threadPostPacketId || !parentPostPacketId) {
      return createJsonResponse(
        {
          error:
            'Missing thread_post_packet_id or parent_post_packet_id query parameter.',
        },
        400
      );
    }

    const shellPayload = await getNexusShellPayload();
    const scopeId = resolveScopeIdFromShell(
      shellPayload,
      params.scopeId,
      viewerActorPacketId
    );
    const repliesPayload = await getNexusDiscussionReplyChildrenPayload({
      scopeId,
      threadPostPacketId,
      parentPostPacketId,
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
      cursor,
      limit,
    });

    return createJsonResponse(repliesPayload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load reply children.';

    return createJsonResponse({ error: message }, 500);
  }
};

export const POST: RequestHandler = async (request, params) => {
  void request;
  void params;

  return createJsonResponse(
    {
      error:
        'Discussion-reply writes have moved to /api/nexus/mutations/prepare and /api/nexus/mutations/finalize.',
    },
    410
  );
};
