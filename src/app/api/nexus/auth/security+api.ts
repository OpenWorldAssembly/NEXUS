/**
 * File: security+api.ts
 * Description: Reads the effective claimed-identity write-approval preference.
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

export const GET: RequestHandler = async (request) => {
  try {
    const services = await getNexusPacketServices();
    const payload = await services.authService.getSecurityPreferences(
      request,
      request.headers.get('x-csrf-token')
    );

    return createJsonResponse(payload);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load security preferences.',
      },
      500
    );
  }
};

export const PUT: RequestHandler = async () => {
  return createJsonResponse(
    {
      error:
        'Direct write-approval updates are deprecated. Use actor.write_policy.update through the mutation corridor.',
    },
    410
  );
};
