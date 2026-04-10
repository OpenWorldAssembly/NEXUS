/**
 * File: replies+api.ts
 * Description: Accepts new nested discussion replies for a Nexus scope using packet ids in the request body.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import {
  DISCUSSION_REPLY_SORTS,
  type DiscussionReplySort,
} from '@/domain/schema/packet-schema';
import { createAnonymousActorKey } from '@/lib/nexus/anonymous-session';
import { AnonymousSessionSchema } from '@/lib/nexus/visitor-lobby';
import {
  getNexusDiscussionReplyChildrenPayload,
  getNexusShellPayload,
  resolveScopeIdFromShell,
} from '@/lib/nexus/server/nexus-query-data';
import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';

const DiscussionReplyInputSchema = z
  .object({
    session_id: z.string().min(1),
    short_label: z.string().min(1),
    parent_post_packet_id: z.string().min(1),
    body: z.string().trim().min(1).max(4000),
  })
  .strict();

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
 * Inputs: route scope id plus reply-window query params.
 * Output: one page of direct child replies for the selected parent post.
 */
export const GET: RequestHandler = async (request, params) => {
  try {
    const requestUrl = new URL(request.url);
    const threadPostPacketId = requestUrl.searchParams.get('thread_post_packet_id');
    const parentPostPacketId = requestUrl.searchParams.get('parent_post_packet_id');
    const requestedReplySort = requestUrl.searchParams.get('reply_sort');
    const requestedShowHidden = requestUrl.searchParams.get('show_hidden');
    const viewerSessionId = requestUrl.searchParams.get('viewer_session_id');
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
    const scopeId = resolveScopeIdFromShell(shellPayload, params.scopeId);
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
      viewerActorKey: viewerSessionId
        ? createAnonymousActorKey(viewerSessionId)
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

/**
 * Inputs: the incoming request body and route scope id.
 * Output: the saved reply projection plus refreshed viewer state.
 */
export const POST: RequestHandler = async (request, params) => {
  try {
    const parsedBody = DiscussionReplyInputSchema.parse(await request.json());
    const session = AnonymousSessionSchema.parse({
      session_id: parsedBody.session_id,
      short_label: parsedBody.short_label,
      started_at: new Date().toISOString(),
    });
    const services = await getNexusPacketServices();
    const result = await services.discussionService.createReply({
      scope_id: params.scopeId,
      parent_post_packet_id: parsedBody.parent_post_packet_id,
      body: parsedBody.body,
      session,
    });

    return createJsonResponse(result, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to save the reply.';
    const status = message.includes('Replies are not open')
      ? 403
      : message.includes('Unknown')
        ? 404
        : message.includes('String must contain at least 1 character')
          ? 400
          : 500;

    return createJsonResponse({ error: message }, status);
  }
};
