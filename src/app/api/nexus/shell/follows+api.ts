/**
 * File: follows+api.ts
 * Description: Exposes the legacy shell-follow endpoint as an explicit deprecated compatibility route.
 */

import type { RequestHandler } from 'expo-router/server';
function createJsonResponse(
  body: unknown,
  status = 200,
): Response {
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
        'Follow writes moved to the fortress mutation corridor. Use follows.relation.set or follows.relation.clear.',
    },
    410
  );
