/**
 * File: verify+api.ts
 * Description: Verifies a signed sign-in challenge response and issues Nexus auth cookies.
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

const VerifyRequestSchema = z
  .object({
    challenge_id: z.string().min(1),
    nonce: z.string().min(1),
    keep_me_logged_in: z.boolean().default(false),
    device_label: z.string().trim().max(120).optional().nullable().default(null),
    actor_assertion: ActorAssertionSchema,
  })
  .strict();

function createJsonResponse(
  body: unknown,
  status = 200,
  setCookieHeaders: string[] = []
): Response {
  const headers = new Headers({
    'content-type': 'application/json',
  });

  setCookieHeaders.forEach((cookie) => headers.append('set-cookie', cookie));

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

export const POST: RequestHandler = async (request) => {
  try {
    const parsedBody = VerifyRequestSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const rateLimitKey =
      request.headers.get('x-forwarded-for') ??
      request.headers.get('user-agent') ??
      'local';
    const result = await services.authService.verifySignInChallenge({
      request,
      actorAssertion: parsedBody.actor_assertion,
      keepMeLoggedIn: parsedBody.keep_me_logged_in,
      challengeId: parsedBody.challenge_id,
      nonce: parsedBody.nonce,
      rateLimitKey,
      deviceLabel: parsedBody.device_label,
    });

    return createJsonResponse(
      {
        session: result.session,
      },
      200,
      result.setCookieHeaders
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to verify sign-in.';
    const status =
      message.includes('Too many')
        ? 429
        : message.includes('verification failed') ||
            message.includes('expired') ||
            message.includes('already been used') ||
            message.includes('does not match')
          ? 400
          : 500;

    return createJsonResponse({ error: message }, status);
  }
};
