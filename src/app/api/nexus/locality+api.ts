/**
 * File: locality+api.ts
 * Description: Creates canonical geographic locality assembly Elements from a confirmed path.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';
import {
  createCanonicalLocalityPath,
  LocalityDuplicateWarningError,
} from '@runtime/nexus/server/locality-directory-service';

const ActorAssertionSchema = z
  .object({
    actor_packet_id: z.string().min(1),
    kid: z.string().min(1),
    method: z.string().min(1),
    path: z.string().min(1),
    body_digest: z.string().min(1),
    issued_at: z.string().min(1),
    signature: z.string().min(1),
  })
  .strict();

const LocalityPathEntrySchema = z
  .object({
    level: z.enum(['nation', 'region', 'city', 'district']),
    name: z.string().trim().max(120).default(''),
    existing_scope_id: z.string().min(1).optional().nullable().default(null),
    alias_keys: z.array(z.string().min(1)).optional().default([]),
    display_aliases: z.array(z.string().min(1)).optional().default([]),
  })
  .strict();

const CreateLocalitySchema = z
  .object({
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
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
    const parsedBody = CreateLocalitySchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const actorContext = await services.authService.verifyActorMutation({
      request,
      actorPacket: parsedBody.actor_packet,
      actorAssertion: parsedBody.actor_assertion,
      method: 'POST',
      path: '/api/nexus/locality',
      body: {
        actor_packet: parsedBody.actor_packet,
        csrf_token: parsedBody.csrf_token,
        reauth_token: parsedBody.reauth_token,
        path: parsedBody.path,
        create_anyway: parsedBody.create_anyway,
      },
      csrfToken: parsedBody.csrf_token,
      reauthToken: parsedBody.reauth_token,
      writeRisk: 'standard',
    });

    const result = await createCanonicalLocalityPath({
      actorPacketId: actorContext.actorPacket.header.packet_id,
      path: parsedBody.path,
      createAnyway: parsedBody.create_anyway,
    });

    return createJsonResponse(result);
  } catch (error) {
    if (error instanceof LocalityDuplicateWarningError) {
      return createJsonResponse(
        {
          error: error.message,
          duplicate_warnings: error.duplicateWarnings,
        },
        409
      );
    }

    const message =
      error instanceof Error ? error.message : 'Unable to create locality.';
    const status =
      message.includes('Actor assertion') || message.includes('Sign in')
        ? 400
        : message.includes('Unknown')
          ? 404
          : 500;

    return createJsonResponse({ error: message }, status);
  }
};
