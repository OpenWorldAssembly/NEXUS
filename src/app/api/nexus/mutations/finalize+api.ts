/**
 * File: finalize+api.ts
 * Description: Finalizes signed packet candidates through the Dispatch-owned write pipeline.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';
import {
  toNexusAuthFailurePayload,
  toNexusAuthGatePayload,
} from '@runtime/nexus/server/auth-service.utils';
import { trustedDispatchCoordinator } from '@runtime/trusted_coordinators/trusted_dispatch_coordinator/index.ts';
import { decorateReactionFinalizeResponse } from '@runtime/nexus/server/reaction/reaction-finalize-response-adapter';

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

const FinalizeMutationRequestSchema = z
  .object({
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
    ticket_id: z.string().min(1),
    signed_packets: z.array(z.unknown()),
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

function getInterfaceEventHeader(request: Request, name: string): string | null {
  const value = request.headers.get(name);
  return value && value.trim().length > 0 ? value : null;
}

function assertCoordinatorValue<TValue>(
  result: { status: string; value: TValue | null; issues: { message: string }[] },
  fallbackMessage: string
): TValue {
  if (result.status === 'error' || result.status === 'blocked' || result.value === null) {
    throw new Error(result.issues[0]?.message ?? fallbackMessage);
  }

  return result.value;
}

export const POST: RequestHandler = async (request) => {
  try {
    const rawBody = await request.json();
    const parsedBody = FinalizeMutationRequestSchema.parse(rawBody);
    const { actor_assertion: _actorAssertion, ...signedMutationBody } =
      rawBody as Record<string, unknown>;
    const services = await getNexusPacketServices();

    const interfaceEventId = getInterfaceEventHeader(
      request,
      'x-nexus-interface-event-id'
    );
    const clientIntentId = getInterfaceEventHeader(
      request,
      'x-nexus-interface-event-client-intent-id'
    );

    const actorContext = await services.authService.verifyActorMutation({
      request,
      actorPacket: parsedBody.actor_packet,
      actorAssertion: parsedBody.actor_assertion,
      method: 'POST',
      path: '/api/nexus/mutations/finalize',
      body: signedMutationBody,
      csrfToken: parsedBody.csrf_token,
      reauthToken: parsedBody.reauth_token,
      writeRisk: 'standard',
      requiredProofLevel: 'session',
    });
    const result = await trustedDispatchCoordinator.finalizeEnrolledMutationWrite({
      source_route: '/api/nexus/mutations/finalize',
      client_intent_id: clientIntentId,
      request_id: interfaceEventId,
      actor_packet: actorContext.actorPacket,
      request: {
        ticket_id: parsedBody.ticket_id,
        signed_packets: parsedBody.signed_packets,
      },
      packet_store: services.packetStore,
    });

    const finalizedMutation = assertCoordinatorValue(
      result,
      'Unable to finalize the mutation.'
    );
    const responsePayload = await decorateReactionFinalizeResponse({
      finalized_mutation: finalizedMutation,
      actor_packet: actorContext.actorPacket,
      signed_packets: parsedBody.signed_packets,
      reaction_service: services.reactionService,
    });

    return createJsonResponse(responsePayload);
  } catch (error) {
    const authGate = toNexusAuthGatePayload(error);
    const authFailure = toNexusAuthFailurePayload(error);

    return createJsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to finalize the mutation.',
        ...(authGate ? { auth_gate: authGate } : {}),
        ...(authFailure ? { auth_failure: authFailure } : {}),
      },
      authGate ? 409 : 400
    );
  }
};
