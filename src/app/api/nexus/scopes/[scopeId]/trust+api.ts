/**
 * File: trust+api.ts
 * Description: Serves scoped trust projections for a specific Nexus scope lens.
 */

import type { RequestHandler } from 'expo-router/server';

import {
  getNexusShellPayload,
  getNexusTrustPayload,
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

export const GET: RequestHandler = async (request, params) => {
  try {
    const requestUrl = new URL(request.url);
    const actorPacketId = requestUrl.searchParams.get('actor_packet_id');
    const shellPayload = await getNexusShellPayload(actorPacketId, request);
    const scopeId = resolveScopeIdFromShell(
      shellPayload,
      params.scopeId,
      actorPacketId
    );
    const trustPayload = await getNexusTrustPayload({
      scopeId,
      actorPacketId,
    });

    return createJsonResponse(trustPayload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load trust data.';

    return createJsonResponse({ error: message }, 500);
  }
};
