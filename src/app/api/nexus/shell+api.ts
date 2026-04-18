/**
 * File: shell+api.ts
 * Description: Serves packet-backed shell state for Nexus scope navigation and guest defaults.
 */

import type { RequestHandler } from 'expo-router/server';

import { getNexusShellPayload } from '@runtime/nexus/server/nexus-query-data';

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

/**
 * Inputs: none.
 * Output: shell payload derived from packet-backed scope and projection data.
 */
export const GET: RequestHandler = async (request) => {
  try {
    const requestUrl = new URL(request.url);
    const actorPacketId = requestUrl.searchParams.get('actor_packet_id');
    const shellPayload = await getNexusShellPayload(actorPacketId);

    return createJsonResponse(shellPayload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load packet-backed shell data.';

    return createJsonResponse({ error: message }, 500);
  }
};
