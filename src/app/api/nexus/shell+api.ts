/**
 * File: shell+api.ts
 * Description: Serves packet-backed shell state for Nexus scope navigation and guest defaults.
 */

import type { RequestHandler } from 'expo-router/server';

import { getNexusShellPayload } from '@runtime/nexus/server/nexus-query-data';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';
import {
  resolveAuthenticatedShellActorPreferenceContext,
} from '@runtime/nexus/server/shell-auth-context';

function createJsonResponse(
  body: unknown,
  status = 200,
  setCookieHeaders: string[] = []
): Response {
  const headers = new Headers({
    'content-type': 'application/json',
  });

  setCookieHeaders.forEach((cookie) => headers.append('set-cookie', cookie));

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

/**
 * Inputs: none.
 * Output: shell payload derived from packet-backed scope and projection data.
 */
export const GET: RequestHandler = async (request) => {
  try {
    const requestUrl = new URL(request.url);
    const requestedActorPacketId = requestUrl.searchParams.get('actor_packet_id');
    const services = await getNexusPacketServices();
    const currentSession = await services.authService.getCurrentSession(request);
    const actorContext = resolveAuthenticatedShellActorPreferenceContext({
      requestedActorPacketId,
      authenticatedActorPacketId: currentSession.session.actor_packet_id,
      isAuthenticated: currentSession.session.is_authenticated,
    });
    const shellPayload = await getNexusShellPayload(
      actorContext.actorPacketId,
      request
    );

    return createJsonResponse(shellPayload, 200, currentSession.setCookieHeaders);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load packet-backed shell data.';

    return createJsonResponse({ error: message }, 500);
  }
};
