/**
 * File: posts+api.ts
 * Description: Accepts new top-level discussion post writes for a Nexus scope using verified cryptographic actor assertions.
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

const DiscussionPostInputSchema = z
  .object({
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
    thread_packet: z.unknown(),
    post_packet: z.unknown(),
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

export const POST: RequestHandler = async (request, params) => {
  try {
    const parsedBody = DiscussionPostInputSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const actorContext = await services.authService.verifyActorMutation({
      request,
      actorPacket: parsedBody.actor_packet,
      actorAssertion: parsedBody.actor_assertion,
      method: 'POST',
      path: '/api/nexus/scopes/[scopeId]/discussions/posts',
      body: {
        actor_packet: parsedBody.actor_packet,
        csrf_token: parsedBody.csrf_token,
        reauth_token: parsedBody.reauth_token,
        thread_packet: parsedBody.thread_packet,
        post_packet: parsedBody.post_packet,
      },
      csrfToken: parsedBody.csrf_token,
      reauthToken: parsedBody.reauth_token,
      writeRisk: 'high_impact',
    });
    const parsedThreadPacket = parsePacketEnvelope(parsedBody.thread_packet);
    const parsedPostPacket = parsePacketEnvelope(parsedBody.post_packet);

    if (parsedThreadPacket.header.family !== 'DiscussionThread') {
      return createJsonResponse(
        { error: 'thread_packet must be a DiscussionThread packet.' },
        400
      );
    }

    if (parsedPostPacket.header.family !== 'DiscussionPost') {
      return createJsonResponse(
        { error: 'post_packet must be a DiscussionPost packet.' },
        400
      );
    }

    const threadPacket =
      parsedThreadPacket as PacketEnvelopeByType['DiscussionThread'];
    const postPacket =
      parsedPostPacket as PacketEnvelopeByType['DiscussionPost'];

    const result = await services.discussionService.createPost({
      scope_id:
        params.scopeId === 'you'
          ? actorContext.actorPacket.header.packet_id
          : params.scopeId,
      actor_key: actorContext.actorKey,
      actor_class: actorContext.actorClass,
      actor_packet: actorContext.actorPacket,
      thread_packet: threadPacket,
      post_packet: postPacket,
    });

    return createJsonResponse(result, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to save the discussion post.';
    const status = message.includes('not open')
      ? 403
      : message.includes('Unknown')
        ? 404
        : message.includes('Actor assertion') ||
            message.includes('signature') ||
            message.includes('String must contain')
          ? 400
          : 500;

    return createJsonResponse({ error: message }, status);
  }
};
