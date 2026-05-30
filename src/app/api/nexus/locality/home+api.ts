/**
 * File: home+api.ts
 * Description: Deprecates the legacy direct-write home-locality route in favor of the Dispatch-owned mutation corridor.
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

export const PUT: RequestHandler = async () =>
  createJsonResponse(
    {
      error:
        'Home-locality writes have moved to the shared Dispatch-owned mutation corridor.',
    },
    410
  );
