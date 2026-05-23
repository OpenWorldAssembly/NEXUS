/**
 * File: library+api.ts
 * Description: Serves packet-backed library cards for a specific Nexus scope lens.
 */

import type { RequestHandler } from 'expo-router/server';

import {
  getNexusLibraryPayload,
  getNexusShellPayload,
  parseTypeFilter,
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

/**
 * Inputs: route scope id and optional `type` query parameter.
 * Output: library payload resolved to a valid packet-backed scope id.
 */
export const GET: RequestHandler = async (request, params) => {
  try {
    const shellPayload = await getNexusShellPayload();
    const requestUrl = new URL(request.url);
    const actorPacketId = requestUrl.searchParams.get('actor_packet_id');
    const scopeId = resolveScopeIdFromShell(
      shellPayload,
      params.scopeId,
      actorPacketId
    );
    const typeFilter = parseTypeFilter(requestUrl.searchParams.get('type'));
    const libraryPayload = await getNexusLibraryPayload({
      scopeId,
      typeFilter,
      actorPacketId,
    });

    return createJsonResponse(libraryPayload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load packet-backed library data.';

    return createJsonResponse({ error: message }, 500);
  }
};
