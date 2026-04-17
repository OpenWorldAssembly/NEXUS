/**
 * File: options+api.ts
 * Description: Starts a passkey re-auth ceremony for a claimed identity sensitive or interaction action.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

const ReauthOptionsRequestSchema = z
  .object({
    purpose: z.enum(['sensitive', 'interaction']).default('sensitive'),
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
    const parsedBody = ReauthOptionsRequestSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const rateLimitKey =
      request.headers.get('x-forwarded-for') ??
      request.headers.get('user-agent') ??
      'local';
    const payload = await services.authService.startPasskeyReauth({
      request,
      csrfToken: request.headers.get('x-csrf-token'),
      rateLimitKey,
    });

    return createJsonResponse({
      ...payload,
      purpose: parsedBody.purpose,
    });
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Unable to start passkey re-auth.',
      },
      500
    );
  }
};
