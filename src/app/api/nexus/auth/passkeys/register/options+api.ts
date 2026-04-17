/**
 * File: options+api.ts
 * Description: Starts a passkey registration ceremony for the current claimed session.
 */

import type { RequestHandler } from 'expo-router/server';

import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

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
    const services = await getNexusPacketServices();
    const rateLimitKey =
      request.headers.get('x-forwarded-for') ??
      request.headers.get('user-agent') ??
      'local';
    const payload = await services.authService.startPasskeyRegistration({
      request,
      csrfToken: request.headers.get('x-csrf-token'),
      reauthToken: request.headers.get('x-reauth-token'),
      rateLimitKey,
    });

    return createJsonResponse(payload);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to start passkey registration.',
      },
      500
    );
  }
};
