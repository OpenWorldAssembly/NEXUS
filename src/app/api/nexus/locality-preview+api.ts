/**
 * File: locality-preview+api.ts
 * Description: Serves non-mutating locality path previews for the guided Nexus locality creation flow.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { previewCanonicalLocalityPath } from '@runtime/nexus/server/locality-directory-service';

const LocalityPathEntrySchema = z
  .object({
    level: z.enum(['nation', 'region', 'city', 'district']),
    name: z.string().trim().max(120).default(''),
    existing_scope_id: z.string().min(1).optional().nullable().default(null),
    alias_keys: z.array(z.string().min(1)).optional().default([]),
    display_aliases: z.array(z.string().min(1)).optional().default([]),
  })
  .strict();

const PreviewLocalityPathRequestSchema = z
  .object({
    actor_packet_id: z.string().min(1).optional().nullable().default(null),
    path: z.array(LocalityPathEntrySchema).min(1).max(4),
    create_anyway: z.boolean().optional().default(false),
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
    const rawBody = await request.json();
    const parsedBody = PreviewLocalityPathRequestSchema.parse(rawBody);
    const payload = await previewCanonicalLocalityPath({
      actorPacketId: parsedBody.actor_packet_id,
      path: parsedBody.path,
      createAnyway: parsedBody.create_anyway,
    });

    return createJsonResponse(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to preview locality path.';

    return createJsonResponse({ error: message }, 400);
  }
};
