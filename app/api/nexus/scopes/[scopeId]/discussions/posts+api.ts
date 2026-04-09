/**
 * File: posts+api.ts
 * Description: Accepts new top-level discussion post writes for a Nexus scope.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { AnonymousSessionSchema } from '@/lib/nexus/visitor-lobby';
import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';

const DiscussionPostInputSchema = z
  .object({
    session_id: z.string().min(1),
    short_label: z.string().min(1),
    thread_packet_id: z.string().min(1),
    title: z.string().trim().max(160).optional().default(''),
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
 * Output: the saved top-level discussion post projection plus refreshed viewer state.
 */
export const POST: RequestHandler = async (request, params) => {
  try {
    const parsedBody = DiscussionPostInputSchema.parse(await request.json());
    const session = AnonymousSessionSchema.parse({
      session_id: parsedBody.session_id,
      short_label: parsedBody.short_label,
      started_at: new Date().toISOString(),
    });
    const services = await getNexusPacketServices();
    const result = await services.discussionService.createPost({
      scope_id: params.scopeId,
      thread_packet_id: parsedBody.thread_packet_id,
      title: parsedBody.title,
      body: parsedBody.body,
      session,
    });

    return createJsonResponse(result, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to save the discussion post.';
    const status = message.includes('need')
      ? 403
      : message.includes('Unknown')
        ? 404
        : message.includes('String must contain at least 1 character')
          ? 400
          : 500;

    return createJsonResponse({ error: message }, status);
  }
};
