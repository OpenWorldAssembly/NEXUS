/**
 * File: visitor-lobby+api.ts
 * Description: Serves the shared visitor-lobby thread and saved posts for a Nexus scope.
 */
import type { RequestHandler } from 'expo-router/server';

import { visitorLobbyRepository } from '@/lib/nexus/server/visitor-lobby-packet-repository';

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
 * Output: the current visitor-lobby thread and saved posts for the requested scope.
 */
export const GET: RequestHandler = async (_request, params) => {
  try {
    const lobbyFeed = await visitorLobbyRepository.getLobby(params.scopeId);

    return createJsonResponse(lobbyFeed);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load the visitor lobby feed.';
    const status = message.startsWith('Unknown public visitor lobby scope') ? 404 : 500;

    return createJsonResponse({ error: message }, status);
  }
};
