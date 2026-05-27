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
    const parsedBody = PrepareMutationRequestSchema.parse(rawBody);
    const interfaceEventId = getInterfaceEventHeader(
      request,
      'x-nexus-interface-event-id'
    );
    const clientIntentId =
      getInterfaceEventHeader(request, 'x-nexus-interface-event-client-intent-id') ??
      parsedBody.intent.kind;
    const normalizedDispatch = trustedDispatchCoordinator.normalizeRequest({
      source_kind: interfaceEventId ? 'interface_signal' : 'api_route',
      source_route: '/api/nexus/mutations/prepare',
      operation_kind: 'mutation_prepare',
      request_id: interfaceEventId,
      client_intent_id: clientIntentId,
      mutation_intent: parsedBody.intent.kind,
      actor_packet_id: parsedBody.actor_assertion.actor_packet_id,
      payload: {
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
    const dispatchPreflight = trustedDispatchCoordinator.preflightClientIntent({
      sourceRoute: '/api/nexus/mutations/prepare',
      requestId: normalizedDispatch.value?.request_id ?? interfaceEventId,
      clientIntentId,
      mutationIntent: parsedBody.intent.kind,
    });
    assertDispatchResult(dispatchPreflight);
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
