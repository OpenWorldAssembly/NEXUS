/**
 * File: restore+api.ts
 * Description: Persists or refreshes a restored identity packet from an imported local bundle.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

const RestoreIdentityRequestSchema = z
  .object({
    actor_packet: z.unknown(),
  })
  .strict();

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

export const POST: RequestHandler = async (request) => {
  try {
    const parsedBody = RestoreIdentityRequestSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const actorPacket = await services.authService.restoreIdentity({
      actorPacket: parsedBody.actor_packet,
    });

    return createJsonResponse({ actor_packet: actorPacket }, 200);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to restore that identity.';
    const status = message.includes('verification failed') ? 400 : 500;

    return createJsonResponse({ error: message }, status);
  }
};
