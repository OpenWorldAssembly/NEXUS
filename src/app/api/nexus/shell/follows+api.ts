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
        'Follow writes moved to the Dispatch-owned mutation corridor. Use relation.follow.add or relation.follow.clear.',
    },
    410
  );
