/**
 * File: roles+api.ts
 * Description: Serves packet-backed role data for a specific Nexus scope lens.
 */

import type { RequestHandler } from 'expo-router/server';

import {
  getNexusRolesPayload,
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

export const GET: RequestHandler = async (request, params) => {
  try {
    const requestUrl = new URL(request.url);
    const actorPacketId = requestUrl.searchParams.get('actor_packet_id');
    const shellPayload = await getNexusShellPayload(actorPacketId);
    const scopeId = resolveScopeIdFromShell(
      shellPayload,
      params.scopeId,
      actorPacketId
    );
    const rolesPayload = await getNexusRolesPayload({
      scopeId,
      actorPacketId,
    });

    return createJsonResponse(rolesPayload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load scoped role data.';

    return createJsonResponse({ error: message }, 500);
  }
};
