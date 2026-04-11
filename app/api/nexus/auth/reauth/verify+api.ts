/**
 * File: verify+api.ts
 * Description: Verifies a passkey re-auth assertion and returns a short-lived Nexus re-auth token.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';

const VerifyReauthRequestSchema = z
  .object({
    challenge_id: z.string().min(1),
    purpose: z.enum(['sensitive', 'interaction']).default('sensitive'),
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
    const parsedBody = VerifyReauthRequestSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const payload = await services.authService.verifyPasskeyReauth({
      request,
      csrfToken: request.headers.get('x-csrf-token'),
      challengeId: parsedBody.challenge_id,
      credential: parsedBody.credential,
      purpose: parsedBody.purpose,
    });

    return createJsonResponse(payload);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Unable to verify passkey re-auth.',
      },
      500
    );
  }
};
