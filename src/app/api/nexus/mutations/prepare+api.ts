/**
 * File: prepare+api.ts
 * Description: Prepares canonical unsigned packet candidates and one-time tickets for the fortress mutation corridor.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import type { MutationIntent } from '@core/auth/mutation-corridor';
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

const MutationIntentSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('discussion.thread_post.create'),
      scope_id: z.string().min(1),
      forum_packet_id: z.string().min(1),
      thread_title: z.string(),
      post_markdown: z.string().min(1),
      related_packet_ids: z.array(z.string().min(1)).optional().default([]),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('discussion.reply.create'),
      scope_id: z.string().min(1),
      parent_post_packet_id: z.string().min(1),
      reply_markdown: z.string().min(1),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('attestation.packet_signal.set'),
      scope_id: z.string().min(1),
      target_packet_id: z.string().min(1),
      value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('actor.write_policy.update'),
      security_mode: z.enum(['standard', 'guarded', 'every_write']),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
]);

const PrepareMutationRequestSchema = z
  .object({
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
    intent: MutationIntentSchema,
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
    const parsedBody = PrepareMutationRequestSchema.parse(rawBody);
    const { actor_assertion: _actorAssertion, ...signedMutationBody } =
      rawBody as Record<string, unknown>;
    const services = await getNexusPacketServices();
    const actorContext = await services.authService.verifyActorMutation({
      request,
      actorPacket: parsedBody.actor_packet,
      actorAssertion: parsedBody.actor_assertion,
      method: 'POST',
      path: '/api/nexus/mutations/prepare',
      body: signedMutationBody,
      csrfToken: parsedBody.csrf_token,
      reauthToken: parsedBody.reauth_token,
      requiredProofLevel: 'session',
    });
    const result = await services.mutationService.prepareMutation({
      intent: parsedBody.intent as MutationIntent,
      actorPacket: actorContext.actorPacket,
      actorKey: actorContext.actorKey,
    });

    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to prepare the mutation.',
      },
      400
    );
  }
};
