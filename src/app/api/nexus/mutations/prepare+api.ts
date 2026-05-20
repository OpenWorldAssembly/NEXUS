/**
 * File: prepare+api.ts
 * Description: Prepares canonical unsigned packet candidates and one-time tickets for the fortress mutation corridor.
 */

import type { RequestHandler } from 'expo-router/server';

import type { MutationIntent } from '@core/auth/mutation-corridor';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';
import {
  toNexusAuthFailurePayload,
  toNexusAuthGatePayload,
} from '@runtime/nexus/server/auth-service.utils';
import { LocalityDuplicateWarningError } from '@runtime/nexus/server/locality-directory-service';
import { resolvePrepareMutationApiPreflight } from '@runtime/nexus/server/packet-api-crossing-guard';
import { PrepareMutationRequestSchema } from '@runtime/nexus/server/prepare-mutation-intent-schema';

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
    resolvePrepareMutationApiPreflight(parsedBody.intent);
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
    if (error instanceof LocalityDuplicateWarningError) {
      return createJsonResponse(
        {
          error: error.message,
          duplicate_warnings: error.duplicateWarnings,
        },
        409
      );
    }

    const authGate = toNexusAuthGatePayload(error);
    const authFailure = toNexusAuthFailurePayload(error);

    return createJsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to prepare the mutation.',
        ...(authGate ? { auth_gate: authGate } : {}),
        ...(authFailure ? { auth_failure: authFailure } : {}),
      },
      authGate ? 409 : 400
    );
  }
};
