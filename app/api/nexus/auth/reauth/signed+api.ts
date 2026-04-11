/**
 * File: signed+api.ts
 * Description: Verifies a signed-key re-auth request and returns a short-lived Nexus re-auth token.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';

const ActorAssertionSchema = z
  .object({
    actor_packet_id: z.string().min(1),
    kid: z.string().min(1),
    method: z.string().min(1),
    path: z.string().min(1),
    body_digest: z.string().min(1),
    issued_at: z.string().min(1),
    signature: z.string().min(1),
  })
  .strict();

const VerifySignedReauthRequestSchema = z
  .object({
    purpose: z.enum(['sensitive', 'interaction']).default('sensitive'),
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
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
    const parsedBody = VerifySignedReauthRequestSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const payload = await services.authService.verifySignedReauth({
      request,
      csrfToken: request.headers.get('x-csrf-token'),
      actorPacket: parsedBody.actor_packet,
      actorAssertion: parsedBody.actor_assertion,
      purpose: parsedBody.purpose,
    });

    return createJsonResponse(payload);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Unable to verify signed re-auth.',
      },
      500
    );
  }
};
