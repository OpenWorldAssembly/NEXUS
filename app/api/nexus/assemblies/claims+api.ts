/**
 * File: claims+api.ts
 * Description: Lists and mutates packet-backed assembly-association claims for Nexus actors.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { PacketVoteValueSchema } from '@/domain/schema/packet-schema';
import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';

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

const AssemblyClaimMutationSchema = z
  .object({
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
    assembly_packet_id: z.string().min(1),
    scope_id: z.string().min(1).optional().nullable().default(null),
    note: z.string().min(1).optional().nullable().default(null),
    value: z.union([PacketVoteValueSchema, z.literal(0)]).default(1),
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

export const GET: RequestHandler = async (request) => {
  try {
    const requestUrl = new URL(request.url);
    const actorPacketId = requestUrl.searchParams.get('actor_packet_id');

    if (!actorPacketId) {
      return createJsonResponse(
        {
          error: 'actor_packet_id is required.',
        },
        400
      );
    }

    const services = await getNexusPacketServices();
    const claims =
      await services.attestationService.listAssemblyAssociationClaimsForActor(
        actorPacketId
      );

    return createJsonResponse({
      actor_packet_id: actorPacketId,
      claims,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load assembly-association claims.';

    return createJsonResponse({ error: message }, 500);
  }
};

export const PUT: RequestHandler = async (request) => {
  try {
    const parsedBody = AssemblyClaimMutationSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const actorContext = await services.authService.verifyActorMutation({
      request,
      actorPacket: parsedBody.actor_packet,
      actorAssertion: parsedBody.actor_assertion,
      method: 'PUT',
      path: '/api/nexus/assemblies/claims',
      body: {
        actor_packet: parsedBody.actor_packet,
        csrf_token: parsedBody.csrf_token,
        reauth_token: parsedBody.reauth_token,
        assembly_packet_id: parsedBody.assembly_packet_id,
        scope_id: parsedBody.scope_id,
        note: parsedBody.note,
        value: parsedBody.value,
      },
      csrfToken: parsedBody.csrf_token,
      reauthToken: parsedBody.reauth_token,
    });
    const summary = await services.attestationService.setAttestation({
      target_packet_id: parsedBody.assembly_packet_id,
      actor_key: actorContext.actorKey,
      actor_class: actorContext.actorClass,
      authority_scope_id: parsedBody.scope_id,
      value: parsedBody.value,
      attestation_kind: 'assembly_association_claim',
      note: parsedBody.note,
    });
    const claims =
      await services.attestationService.listAssemblyAssociationClaimsForActor(
        actorContext.actorPacket.header.packet_id
      );

    return createJsonResponse({
      assembly_packet_id: parsedBody.assembly_packet_id,
      summary,
      claims,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to update the assembly-association claim.';
    const status = message.includes('Unknown') ? 404 : 500;

    return createJsonResponse({ error: message }, status);
  }
};
