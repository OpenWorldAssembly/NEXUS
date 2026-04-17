/**
 * File: challenge+api.ts
 * Description: Starts a challenge-response sign-in flow for a claimed identity.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

const ChallengeRequestSchema = z
  .object({
    actor_packet_id: z.string().min(1),
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
    const parsedBody = ChallengeRequestSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const rateLimitKey =
      request.headers.get('x-forwarded-for') ??
      request.headers.get('user-agent') ??
      'local';
    const challenge = await services.authService.startSignInChallenge({
      actorPacketId: parsedBody.actor_packet_id,
      rateLimitKey,
    });

    return createJsonResponse(challenge, 200);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to start sign-in.';
    const status =
      message.includes('Too many')
        ? 429
        : message.includes('Unknown') || message.includes('Only claimed')
          ? 400
          : 500;

    return createJsonResponse({ error: message }, status);
  }
};
