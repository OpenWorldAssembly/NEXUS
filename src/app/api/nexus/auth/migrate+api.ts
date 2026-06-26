/**
 * File: migrate+api.ts
 * Description: Persists a key-proven current-schema migration of a legacy local identity.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

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

const MigrateIdentityRequestSchema = z
  .object({
    migrated_actor_packet: z.unknown(),
    legacy_actor_packet_id: z.string().min(1),
    legacy_actor_packet_digest: z.string().min(1).optional(),
    actor_assertion: ActorAssertionSchema,
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
    const parsedBody = MigrateIdentityRequestSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const actorPacket = await services.authService.migrateIdentity({
      migratedActorPacket: parsedBody.migrated_actor_packet,
      legacyActorPacketId: parsedBody.legacy_actor_packet_id,
      legacyActorPacketDigest: parsedBody.legacy_actor_packet_digest ?? null,
      actorAssertion: parsedBody.actor_assertion,
    });

    return createJsonResponse({ actor_packet: actorPacket }, 200);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to migrate that identity.';
    const status =
      message.includes('not enabled') ||
      message.includes('verification failed') ||
      message.includes('does not match') ||
      message.includes('collides') ||
      message.includes('requires a claimed')
        ? 400
        : 500;

    return createJsonResponse({ error: message }, status);
  }
};
