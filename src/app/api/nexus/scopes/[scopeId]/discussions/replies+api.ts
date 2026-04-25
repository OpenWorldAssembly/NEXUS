/**
 * File: replies+api.ts
 * Description: Accepts new nested discussion replies for a Nexus scope using verified cryptographic actor assertions.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import {
  DISCUSSION_REPLY_SORTS,
  parsePacketEnvelope,
  type PacketEnvelopeByType,
  type DiscussionReplySort,
} from '@core/schema/packet-schema';
import {
  getNexusDiscussionReplyChildrenPayload,
  getNexusShellPayload,
  resolveScopeIdFromShell,
} from '@runtime/nexus/server/nexus-query-data';
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

const DiscussionReplyInputSchema = z
  .object({
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
    mutation_nonce: z.string().min(1),
    created_at: z.string().min(1),
    parent_post_packet_id: z.string().min(1),
    reply_markdown: z.string().min(1),
    signed_candidate_packets: z
      .object({
        reply_packet: z.unknown(),
      })
      .strict(),
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

function parsePositiveInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

export const GET: RequestHandler = async (request, params) => {
  try {
    const requestUrl = new URL(request.url);
    const threadPostPacketId = requestUrl.searchParams.get('thread_post_packet_id');
    const parentPostPacketId = requestUrl.searchParams.get('parent_post_packet_id');
    const requestedReplySort = requestUrl.searchParams.get('reply_sort');
    const requestedShowHidden = requestUrl.searchParams.get('show_hidden');
    const viewerActorPacketId = requestUrl.searchParams.get('viewer_actor_packet_id');
    const cursor = requestUrl.searchParams.get('cursor');
    const limit = parsePositiveInteger(requestUrl.searchParams.get('limit'));

    if (!threadPostPacketId || !parentPostPacketId) {
      return createJsonResponse(
        {
          error:
            'Missing thread_post_packet_id or parent_post_packet_id query parameter.',
        },
        400
      );
    }

    const shellPayload = await getNexusShellPayload();
    const scopeId = resolveScopeIdFromShell(
      shellPayload,
      params.scopeId,
      viewerActorPacketId
    );
    const repliesPayload = await getNexusDiscussionReplyChildrenPayload({
      scopeId,
      threadPostPacketId,
      parentPostPacketId,
      replySort:
        requestedReplySort &&
        (DISCUSSION_REPLY_SORTS as readonly string[]).includes(requestedReplySort)
          ? (requestedReplySort as DiscussionReplySort)
          : null,
      showHidden:
        requestedShowHidden === 'true' || requestedShowHidden === '1',
      viewerActorKey: viewerActorPacketId
        ? `element:${viewerActorPacketId}`
        : null,
      cursor,
      limit,
    });

    return createJsonResponse(repliesPayload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load reply children.';

    return createJsonResponse({ error: message }, 500);
  }
};

export const POST: RequestHandler = async (request, params) => {
  try {
    const parsedBody = DiscussionReplyInputSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const actorContext = await services.authService.verifyActorMutation({
      request,
      actorPacket: parsedBody.actor_packet,
      actorAssertion: parsedBody.actor_assertion,
      method: 'POST',
      path: '/api/nexus/scopes/[scopeId]/discussions/replies',
      body: {
        actor_packet: parsedBody.actor_packet,
        csrf_token: parsedBody.csrf_token,
        reauth_token: parsedBody.reauth_token,
        mutation_nonce: parsedBody.mutation_nonce,
        created_at: parsedBody.created_at,
        parent_post_packet_id: parsedBody.parent_post_packet_id,
        reply_markdown: parsedBody.reply_markdown,
        signed_candidate_packets: parsedBody.signed_candidate_packets,
      },
      csrfToken: parsedBody.csrf_token,
      reauthToken: parsedBody.reauth_token,
    });
    const parsedReplyPacket = parsePacketEnvelope(
      parsedBody.signed_candidate_packets.reply_packet
    );

    if (parsedReplyPacket.header.family !== 'DiscussionReply') {
      return createJsonResponse(
        { error: 'reply_packet must be a DiscussionReply packet.' },
        400
      );
    }

    const replyPacket =
      parsedReplyPacket as PacketEnvelopeByType['DiscussionReply'];

    const preparedMutation = await services.mutationService.prepareMutation({
      intent: {
        kind: 'discussion.reply.create',
        scope_id:
          params.scopeId === 'you'
            ? actorContext.actorPacket.header.packet_id
            : params.scopeId,
        parent_post_packet_id: parsedBody.parent_post_packet_id,
        reply_markdown: parsedBody.reply_markdown,
        created_at: parsedBody.created_at,
        mutation_nonce: parsedBody.mutation_nonce,
      },
      actorPacket: actorContext.actorPacket,
      actorKey: actorContext.actorKey,
    });
    const result = await services.mutationService.finalizeMutation({
      request: {
        ticket_id: preparedMutation.ticket.ticket_id,
        signed_packets: [replyPacket],
      },
      actorContext,
    });

    return createJsonResponse(result.result, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to save the reply.';
    const status = message.includes('Replies are not open')
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
