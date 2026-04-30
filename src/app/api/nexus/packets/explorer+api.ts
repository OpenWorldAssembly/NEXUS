/**
 * File: explorer+api.ts
 * Description: Serves the read-only Packet Explorer payload for one packet id.
 */

import type { RequestHandler } from 'expo-router/server';

import { getNexusPacketExplorerPayload } from '@runtime/nexus/server/nexus-packet-explorer-data';

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

/**
 * Inputs: `packet_id` query param.
 * Output: the additive Packet Explorer payload for the requested packet.
 */
export const GET: RequestHandler = async (request) => {
  try {
    const requestUrl = new URL(request.url);
    const packetId = requestUrl.searchParams.get('packet_id');
    const viewerActorPacketId = requestUrl.searchParams.get('actor_packet_id');

    if (!packetId) {
      return createJsonResponse(
        { error: 'Missing packet_id query parameter.' },
        400
      );
    }

    const explorerPayload = await getNexusPacketExplorerPayload({
      packetId,
      viewerActorPacketId,
    });

    return createJsonResponse(explorerPayload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load the packet explorer payload.';

    return createJsonResponse({ error: message }, 500);
  }
};
