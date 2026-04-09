/**
 * File: replies+api.ts
 * Description: Accepts new nested discussion replies for a Nexus scope using packet ids in the request body.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { AnonymousSessionSchema } from '@/lib/nexus/visitor-lobby';
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
