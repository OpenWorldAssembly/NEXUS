/**
 * File: verify+api.ts
 * Description: Verifies a passkey sign-in assertion and issues claimed-identity session cookies.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';

const VerifyPasskeySignInRequestSchema = z
  .object({
    challenge_id: z.string().min(1),
    keep_me_logged_in: z.boolean().default(false),
    device_label: z.string().trim().max(120).optional().nullable().default(null),
    credential: z
      .object({
        credential_id: z.string().min(1),
        raw_id: z.string().min(1),
        client_data_json: z.string().min(1),
        authenticator_data: z.string().min(1),
        signature: z.string().min(1),
        user_handle: z.string().nullable(),
      })
      .strict(),
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
    const parsedBody = VerifyPasskeySignInRequestSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const rateLimitKey =
      request.headers.get('x-forwarded-for') ??
      request.headers.get('user-agent') ??
      'local';
    const payload = await services.authService.verifyPasskeySignIn({
      request,
      challengeId: parsedBody.challenge_id,
      credential: parsedBody.credential,
      keepMeLoggedIn: parsedBody.keep_me_logged_in,
      rateLimitKey,
      deviceLabel: parsedBody.device_label,
    });

    return createJsonResponse(
      {
        session: payload.session,
      },
      200,
      payload.setCookieHeaders
    );
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Unable to verify passkey sign-in.',
      },
      500
    );
  }
};
