/**
 * File: identity-search+api.ts
 * Description: Serves graph-backed Nexus person-identity search results for sign-in flows.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { searchNexusIdentities } from '@runtime/nexus/server/identity-search-service';

const IdentitySearchRequestSchema = z
  .object({
    query: z.string().trim().max(120).default(''),
    saved_actor_packet_ids: z.array(z.string().min(1)).default([]),
  })
  .strict();

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
    const parsedBody = IdentitySearchRequestSchema.parse(await request.json());
    const results = await searchNexusIdentities({
      query: parsedBody.query,
      savedActorPacketIds: parsedBody.saved_actor_packet_ids,
    });

    return createJsonResponse({
      query: parsedBody.query,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to search identities.';

    return createJsonResponse({ error: message }, 400);
  }
};
