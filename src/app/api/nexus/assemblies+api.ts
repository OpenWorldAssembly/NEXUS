/**
 * File: assemblies+api.ts
 * Description: Lists or deprecates legacy assembly write routes now that first-party writes use the fortress corridor.
 */

import type { RequestHandler } from 'expo-router/server';

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

export const POST: RequestHandler = async () =>
  createJsonResponse(
    {
      error:
        'Assembly creation has moved to the shared fortress mutation corridor.',
    },
    410
  );
