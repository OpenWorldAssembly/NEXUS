/**
 * File: claims+api.ts
 * Description: Lists assembly-association claims and deprecates the legacy direct-write mutation route.
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
      await services.attestationService.listAssemblyAssociationClaimsForActor(
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
        : 'Unable to load assembly-association claims.';

    return createJsonResponse({ error: message }, 500);
  }
};

export const PUT: RequestHandler = async () =>
  createJsonResponse(
    {
      error:
        'Assembly-association claim writes have moved to the shared fortress mutation corridor.',
    },
    410
  );
