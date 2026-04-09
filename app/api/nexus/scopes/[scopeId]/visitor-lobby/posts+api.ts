/**
 * File: posts+api.ts
 * Description: Accepts new visitor-lobby post writes for a Nexus scope.
 */
import type { RequestHandler } from 'expo-router/server';

import { visitorLobbyRepository } from '@/lib/nexus/server/visitor-lobby-packet-repository';
import {
  AnonymousSessionSchema,
  VisitorLobbyPostInputSchema,
} from '@/lib/nexus/visitor-lobby';

/**
 * Inputs: a JSON-serializable response body and optional status code.
 * Output: a JSON fetch response for the Nexus visitor-lobby API.
 */
function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

/**
 * Inputs: the incoming request and route params.
 * Output: the saved visitor-lobby post packet for the requested scope.
 */
export const POST: RequestHandler = async (request, params) => {
  try {
    const parsedBody = VisitorLobbyPostInputSchema.parse(await request.json());
    const session = AnonymousSessionSchema.parse({
      session_id: parsedBody.session_id,
      short_label: parsedBody.short_label,
      started_at: new Date().toISOString(),
    });
    const nextPost = await visitorLobbyRepository.createLobbyPost({
      scopeId: params.scopeId,
      session,
      title: parsedBody.title,
      body: parsedBody.body,
    });

    return createJsonResponse({ post: nextPost }, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to save the visitor lobby post.';
    const status =
      message.startsWith('Unknown public visitor lobby scope')
        ? 404
        : message.includes('String must contain at least 1 character')
          ? 400
          : 500;

    return createJsonResponse({ error: message }, status);
  }
};
