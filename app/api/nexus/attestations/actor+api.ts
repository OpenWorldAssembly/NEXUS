/**
 * File: actor+api.ts
 * Description: Returns raw attestations authored by one actor element.
 */

import type { RequestHandler } from 'expo-router/server';

import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';

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
    const attestationKind = requestUrl.searchParams.get('attestation_kind');

    if (!actorPacketId) {
      return createJsonResponse(
        {
          error: 'actor_packet_id is required.',
        },
        400
      );
    }

    const services = await getNexusPacketServices();
    const attestations = await services.attestationService.listActorAttestations({
      actor_key: `element:${actorPacketId}`,
      attestation_kind: attestationKind,
      active_only: false,
    });

    return createJsonResponse({
      actor_key: `element:${actorPacketId}`,
      attestations,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load actor attestations.';

    return createJsonResponse({ error: message }, 500);
  }
};
