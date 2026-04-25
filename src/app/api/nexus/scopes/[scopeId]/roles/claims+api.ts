/**
 * File: claims+api.ts
 * Description: Deprecates the legacy direct-write scoped role-claim route in favor of the fortress corridor.
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
        'Role-claim writes have moved to the shared fortress mutation corridor.',
    },
    410
  );
