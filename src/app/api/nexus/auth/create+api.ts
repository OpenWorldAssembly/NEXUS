/**
 * File: create+api.ts
 * Description: Persists a newly created claimed identity packet.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

const CreateIdentityRequestSchema = z
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
    const parsedBody = CreateIdentityRequestSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const actorPacket = await services.authService.createIdentity({
      actorPacket: parsedBody.actor_packet,
    });

    return createJsonResponse({ actor_packet: actorPacket }, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to create that identity.';
    const status =
      message.includes('requires') || message.includes('verification failed')
        ? 400
        : message.includes('Too many')
          ? 429
          : 500;

    return createJsonResponse({ error: message }, status);
  }
};
