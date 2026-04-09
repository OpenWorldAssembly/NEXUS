/**
 * File: vote+api.ts
 * Description: Accepts universal packet vote mutations using packet ids in the request body instead of path params.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { PacketVoteValueSchema } from '@/domain/schema/packet-schema';
import { createAnonymousActorKey } from '@/lib/nexus/anonymous-session';
import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';
import { AnonymousSessionSchema } from '@/lib/nexus/visitor-lobby';

const PacketVoteMutationSchema = z
  .object({
    target_packet_id: z.string().min(1),
    session_id: z.string().min(1),
    short_label: z.string().min(1),
    scope_id: z.string().min(1).optional().nullable().default(null),
    value: z.union([PacketVoteValueSchema, z.literal(0)]),
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
    const session = AnonymousSessionSchema.parse({
      session_id: parsedBody.session_id,
      short_label: parsedBody.short_label,
      started_at: new Date().toISOString(),
    });
    const services = await getNexusPacketServices();
    const summary = await services.packetVoteService.setPacketVote({
      target_packet_id: parsedBody.target_packet_id,
      actor_key: createAnonymousActorKey(parsedBody.session_id),
      actor_class: 'anonymous_guest',
      authority_scope_id: parsedBody.scope_id,
      value: parsedBody.value,
      session,
    });

    return createJsonResponse(
      {
        target_packet_id: parsedBody.target_packet_id,
        value: parsedBody.value,
        summary,
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
