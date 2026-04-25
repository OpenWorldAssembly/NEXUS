/**
 * File: attestations+api.ts
 * Description: Deprecates the legacy direct-write role-attestation route in favor of the fortress corridor.
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
        'Role-attestation writes have moved to the shared fortress mutation corridor.',
    },
    410
  );
