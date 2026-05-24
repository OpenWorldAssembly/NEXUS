/**
 * File: claims+api.ts
 * Description: Lists association assertion claims and rejects direct-write mutation attempts.
 */

import type { RequestHandler } from 'expo-router/server';

import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

export const GET: RequestHandler = async (request) => {
  try {
    const requestUrl = new URL(request.url);
    const actorPacketId = requestUrl.searchParams.get('actor_packet_id');

    if (!actorPacketId) {
      return createJsonResponse(
        {
          error: 'actor_packet_id is required.',
        },
        400
      );
    }

    const services = await getNexusPacketServices();
    const claims =
      await services.reactionService.listAssociationClaimsForActor(
        actorPacketId
      );

    return createJsonResponse({
      actor_packet_id: actorPacketId,
      claims,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load association assertion claims.';

    return createJsonResponse({ error: message }, 500);
  }
};

export const PUT: RequestHandler = async () =>
  createJsonResponse(
    {
      error:
        'Association claim writes are not available through this route; use the shared fortress mutation corridor for supported workflows.',
    },
    410
  );
