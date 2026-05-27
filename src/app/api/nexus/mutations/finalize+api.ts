/**
 * File: finalize+api.ts
 * Description: Finalizes signed packet candidates against a prepared fortress mutation ticket and persists approved effects.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { parsePacketEnvelope } from '@core/schema/packet-schema';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';
import {
  toNexusAuthFailurePayload,
  toNexusAuthGatePayload,
} from '@runtime/nexus/server/auth-service.utils';
import { resolveFinalizeMutationApiPreflight } from '@runtime/nexus/server/packet-api-crossing-guard';
import { trustedDispatchCoordinator } from '@runtime/trusted_coordinators/trusted_dispatch_coordinator/index.ts';

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

function assertDispatchResult(result: { status: string; value: unknown; issues: { message: string }[] }) {
  if (result.status === 'error' || result.value === null) {
    throw new Error(
      result.issues[0]?.message ?? 'Trusted dispatch coordinator blocked this request.'
    );
  }
}

export const POST: RequestHandler = async (request) => {
  try {
    const rawBody = await request.json();
    const parsedBody = FinalizeMutationRequestSchema.parse(rawBody);
    const { actor_assertion: _actorAssertion, ...signedMutationBody } =
      rawBody as Record<string, unknown>;
    const services = await getNexusPacketServices();
    const storedTicket = services.mutationService.readTicket(parsedBody.ticket_id);

    if (!storedTicket) {
      throw new Error('Unknown mutation ticket.');
    }

    const interfaceEventId = getInterfaceEventHeader(
      request,
      'x-nexus-interface-event-id'
    );
    const normalizedDispatch = trustedDispatchCoordinator.normalizeRequest({
      source_kind: interfaceEventId ? 'interface_signal' : 'api_route',
      source_route: '/api/nexus/mutations/finalize',
      operation_kind: 'mutation_finalize',
      request_id: interfaceEventId,
      client_intent_id: getInterfaceEventHeader(
        request,
        'x-nexus-interface-event-client-intent-id'
      ),
      mutation_intent: storedTicket.intent.kind,
      actor_packet_id: parsedBody.actor_assertion.actor_packet_id,
      payload: {
        ticket_id: parsedBody.ticket_id,
        interface_event_source_kind: getInterfaceEventHeader(
          request,
          'x-nexus-interface-event-source-kind'
        ),
        interface_event_source_surface: getInterfaceEventHeader(
          request,
          'x-nexus-interface-event-source-surface'
        ),
      },
    });
    assertDispatchResult(normalizedDispatch);
    resolveFinalizeMutationApiPreflight(storedTicket.intent);

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
      requiredProofLevel: storedTicket.prepared_mutation.required_proof_level,
    });
    const result = await services.mutationService.finalizeMutation({
      request: {
        ticket_id: parsedBody.ticket_id,
        signed_packets: parsedBody.signed_packets.map((packetInput) =>
          parsePacketEnvelope(packetInput)
        ),
      },
      actorContext,
    });

    return createJsonResponse(result);
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
