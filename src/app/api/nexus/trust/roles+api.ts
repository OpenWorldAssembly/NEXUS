/**
 * File: roles+api.ts
 * Description: Updates the current actor's claimed role refs through verified actor assertions.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { createElementRoleClaimsRevision } from '@core/packets/identity';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
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

const RoleClaimMutationSchema = z
  .object({
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
    role_packet_id: z.string().min(1),
    claimed: z.boolean(),
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

export const PUT: RequestHandler = async (request) => {
  try {
    const parsedBody = RoleClaimMutationSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const actorContext = await services.authService.verifyActorMutation({
      request,
      actorPacket: parsedBody.actor_packet,
      actorAssertion: parsedBody.actor_assertion,
      method: 'PUT',
      path: '/api/nexus/trust/roles',
      body: {
        actor_packet: parsedBody.actor_packet,
        csrf_token: parsedBody.csrf_token,
        reauth_token: parsedBody.reauth_token,
        role_packet_id: parsedBody.role_packet_id,
        claimed: parsedBody.claimed,
      },
      csrfToken: parsedBody.csrf_token,
      reauthToken: parsedBody.reauth_token,
      writeRisk: 'standard',
    });
    const rolePacket = await services.packetStore.fetchByPacket({
      packet_id: parsedBody.role_packet_id,
    });

    if (!rolePacket || rolePacket.header.family !== 'Role') {
      return createJsonResponse({ error: 'Unknown role packet.' }, 404);
    }

    const currentRoleRefs = new Set(
      actorContext.actorPacket.body.claimed_role_refs.map(
        (roleRef) => roleRef.packet_id
      )
    );

    if (parsedBody.claimed) {
      currentRoleRefs.add(parsedBody.role_packet_id);
    } else {
      currentRoleRefs.delete(parsedBody.role_packet_id);
    }

    const nextActorPacket = createElementRoleClaimsRevision({
      actorPacket: actorContext.actorPacket as PacketEnvelopeByType['Element'],
      claimedRoleRefs: Array.from(currentRoleRefs).map((packetId) => ({
        packet_id: packetId,
      })),
    });

    await services.packetStore.writeRevision(nextActorPacket);
    await services.packetStore.publishRevision({
      packet_id: nextActorPacket.header.packet_id,
      revision_id: nextActorPacket.header.revision_id,
    });

    return createJsonResponse({
      actor_packet_id: nextActorPacket.header.packet_id,
      claimed_role_refs: nextActorPacket.body.claimed_role_refs.map(
        (roleRef) => roleRef.packet_id
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update the role claim.';
    const status =
      message.includes('Actor assertion') || message.includes('Sign in')
        ? 400
        : 500;

    return createJsonResponse({ error: message }, status);
  }
};
