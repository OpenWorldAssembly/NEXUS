/**
 * File: verify+api.ts
 * Description: Verifies a completed passkey registration ceremony for the current claimed session.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';

const VerifyPasskeyRegistrationRequestSchema = z
  .object({
    challenge_id: z.string().min(1),
    credential: z
      .object({
        credential_id: z.string().min(1),
        raw_id: z.string().min(1),
        client_data_json: z.string().min(1),
        authenticator_data: z.string().min(1),
        public_key_spki: z.string().min(1),
        algorithm: z.number(),
        transports: z.array(z.string()).default([]),
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
    const parsedBody = VerifyPasskeyRegistrationRequestSchema.parse(
      await request.json()
    );
    const services = await getNexusPacketServices();
    const payload = await services.authService.verifyPasskeyRegistration({
      request,
      csrfToken: request.headers.get('x-csrf-token'),
      challengeId: parsedBody.challenge_id,
      credential: parsedBody.credential,
    });

    return createJsonResponse(payload);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to verify passkey registration.',
      },
      500
    );
  }
};
