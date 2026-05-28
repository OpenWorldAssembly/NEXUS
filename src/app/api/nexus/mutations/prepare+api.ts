/**
 * File: prepare+api.ts
 * Description: Prepares canonical unsigned packet candidates through the Dispatch-owned write pipeline.
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
import { trustedDispatchCoordinator } from '@runtime/trusted_coordinators/trusted_dispatch_coordinator/index.ts';

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
    const parsedBody = PrepareMutationRequestSchema.parse(rawBody);
    const interfaceEventId = getInterfaceEventHeader(
      request,
      'x-nexus-interface-event-id'
    );
    const clientIntentId =
      getInterfaceEventHeader(request, 'x-nexus-interface-event-client-intent-id') ??
      parsedBody.intent.kind;
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
    const result = await trustedDispatchCoordinator.prepareEnrolledMutationWrite({
      source_route: '/api/nexus/mutations/prepare',
      client_intent_id: clientIntentId,
      request_id: interfaceEventId,
      intent: parsedBody.intent as MutationIntent,
      actor_packet: actorContext.actorPacket,
      actor_key: actorContext.actorKey,
    });

    return createJsonResponse(assertCoordinatorValue(
      result,
      'Unable to prepare the mutation.'
    ));
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
