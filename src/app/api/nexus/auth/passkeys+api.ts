/**
 * File: passkeys+api.ts
 * Description: Lists and revokes registered claimed-identity passkeys.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

const RevokePasskeyRequestSchema = z
  .object({
    credential_id: z.string().min(1),
    reauth_token: z.string().min(1),
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

export const GET: RequestHandler = async (request) => {
  try {
    const services = await getNexusPacketServices();
    const payload = await services.authService.listPasskeys(
      request,
      request.headers.get('x-csrf-token')
    );

    return createJsonResponse(payload);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Unable to load passkeys.',
      },
      500
    );
  }
};

export const DELETE: RequestHandler = async (request) => {
  try {
    const parsedBody = RevokePasskeyRequestSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const payload = await services.authService.revokePasskey({
      request,
      credentialId: parsedBody.credential_id,
      csrfToken: request.headers.get('x-csrf-token'),
      reauthToken: parsedBody.reauth_token,
    });

    return createJsonResponse(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to revoke that passkey.';

    return createJsonResponse({ error: message }, 500);
  }
};
