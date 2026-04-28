/**
 * File: posts+api.ts
 * Description: Deprecates the legacy discussion-post write route in favor of the fortress mutation corridor.
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
        'Discussion-post writes have moved to /api/nexus/mutations/prepare and /api/nexus/mutations/finalize.',
    },
    410
  );
