/**
 * File: vote+api.ts
 * Description: Accepts universal packet vote mutations using packet ids in the request body instead of path params.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import {
  parsePacketEnvelope,
  type PacketEnvelopeByType,
} from '@core/schema/packet-schema';
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

const PacketVoteMutationSchema = z
  .object({
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
    attestation_packet: z.unknown(),
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

/**
 * Inputs: the incoming request body.
 * Output: the refreshed vote summary for that packet and session actor.
 */
export const PUT: RequestHandler = async (request) => {
  try {
    const parsedBody = PacketVoteMutationSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const actorContext = await services.authService.verifyActorMutation({
      request,
      actorPacket: parsedBody.actor_packet,
      actorAssertion: parsedBody.actor_assertion,
      method: 'PUT',
      path: '/api/nexus/packets/vote',
      body: {
        actor_packet: parsedBody.actor_packet,
        csrf_token: parsedBody.csrf_token,
        reauth_token: parsedBody.reauth_token,
        attestation_packet: parsedBody.attestation_packet,
      },
      csrfToken: parsedBody.csrf_token,
      reauthToken: parsedBody.reauth_token,
    });
    const parsedAttestationPacket = parsePacketEnvelope(
      parsedBody.attestation_packet
    );

    if (parsedAttestationPacket.header.family !== 'Attestation') {
      return createJsonResponse(
        { error: 'attestation_packet must be an Attestation packet.' },
        400
      );
    }

    const attestationPacket =
      parsedAttestationPacket as PacketEnvelopeByType['Attestation'];

    const preparedMutation = await services.mutationService.prepareMutation({
      intent: {
        kind: 'attestation.packet_signal.set',
        scope_id:
          attestationPacket.header.authority_scope_ref?.packet_id ??
          actorContext.actorPacket.header.packet_id,
        target_packet_id: attestationPacket.body.target_ref.packet_id,
        value:
          attestationPacket.body.status === 'cleared'
            ? 0
            : attestationPacket.body.value,
      },
      actorPacket: actorContext.actorPacket,
      actorKey: actorContext.actorKey,
    });
    const finalizedMutation = await services.mutationService.finalizeMutation({
      request: {
        ticket_id: preparedMutation.ticket.ticket_id,
        signed_packets: [attestationPacket],
      },
      actorContext,
    });
    const voteResult = finalizedMutation.result as {
      target_packet_id: string;
      value: 0 | -1 | 1;
      summary: unknown;
    };

    return createJsonResponse(
      {
        target_packet_id: voteResult.target_packet_id,
        value: voteResult.value,
        summary: voteResult.summary,
      },
      200
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update the packet vote.';
    const status = message.includes('not open')
      ? 403
      : message.includes('Unknown')
        ? 404
        : message.includes('String must contain at least 1 character')
          ? 400
          : 500;

    return createJsonResponse({ error: message }, status);
  }
};
