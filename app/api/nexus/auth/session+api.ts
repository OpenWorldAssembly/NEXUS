/**
 * File: session+api.ts
 * Description: Returns the current claimed-identity auth session and supports sign-out.
 */

import type { RequestHandler } from 'expo-router/server';

import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';

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

export const GET: RequestHandler = async (request) => {
  try {
    const services = await getNexusPacketServices();
    const result = await services.authService.getCurrentSession(request);

    return createJsonResponse(result.session, 200, result.setCookieHeaders);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load the current auth session.',
      },
      500
    );
  }
};

export const DELETE: RequestHandler = async (request) => {
  try {
    const services = await getNexusPacketServices();
    const setCookieHeaders = await services.authService.signOut(
      request,
      request.headers.get('x-csrf-token')
    );

    return createJsonResponse({ ok: true }, 200, setCookieHeaders);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Unable to sign out right now.',
      },
      500
    );
  }
};
