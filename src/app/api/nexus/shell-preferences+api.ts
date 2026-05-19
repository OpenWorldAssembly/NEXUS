/**
 * File: shell-preferences+api.ts
 * Description: Persists shell interface preferences through Preference.element for claimed actors and compatibility state for guests.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { ShellChromePreferenceValueSchema } from '@core/packets/packet-definition-manifest';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';
import { runRegisteredPacketRuntimeMutation } from '@runtime/nexus/server/packet-runtime-connectors';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';
import type { PreferenceElementInterfaceRuntimeResult } from '@runtime/nexus/server/preference-runtime-connectors';
import {
  writeScopeDisplayPreferencesCompatibility,
} from '@runtime/nexus/server/shell-preferences';

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

const ShellPreferencesRequestSchema = z
  .object({
    actor_packet: z.unknown().optional(),
    actor_assertion: ActorAssertionSchema.optional(),
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
    main_visible_scope_packet_ids: z.array(z.string().min(1)).optional(),
    show_associated_parent_chains: z.boolean().optional(),
    show_followed_parent_chains: z.boolean().optional(),
    shell_chrome: ShellChromePreferenceValueSchema.partial().optional(),
  })
  .strict();

function createJsonResponse(
  body: unknown,
  status = 200,
  headers?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...(headers ?? {}),
    },
  });
}

function buildScopeDisplayPatch(
  parsedBody: z.infer<typeof ShellPreferencesRequestSchema>
): Partial<NexusScopeDisplayPreferencesPayload> | undefined {
  const patch: Partial<NexusScopeDisplayPreferencesPayload> = {};

  if (parsedBody.main_visible_scope_packet_ids !== undefined) {
    patch.main_visible_scope_packet_ids = parsedBody.main_visible_scope_packet_ids;
  }

  if (parsedBody.show_associated_parent_chains !== undefined) {
    patch.show_associated_parent_chains = parsedBody.show_associated_parent_chains;
  }

  if (parsedBody.show_followed_parent_chains !== undefined) {
    patch.show_followed_parent_chains = parsedBody.show_followed_parent_chains;
  }

  return Object.keys(patch).length > 0 ? patch : undefined;
}

export const POST: RequestHandler = async (request) => {
  try {
    const rawBody = await request.json();
    const parsedBody = ShellPreferencesRequestSchema.parse(rawBody);
    const services = await getNexusPacketServices();
    const scopeDisplayPatch = buildScopeDisplayPatch(parsedBody);

    if (parsedBody.actor_packet && parsedBody.actor_assertion) {
      const { actor_assertion: _actorAssertion, ...signedRequestBody } =
        rawBody as Record<string, unknown>;
      const actorContext = await services.authService.verifyActorMutation({
        request,
        actorPacket: parsedBody.actor_packet,
        actorAssertion: parsedBody.actor_assertion,
        method: 'POST',
        path: '/api/nexus/shell-preferences',
        body: signedRequestBody,
        csrfToken: parsedBody.csrf_token,
        reauthToken: parsedBody.reauth_token,
        requiredProofLevel: 'session',
      });
      const runtimeResult = await runRegisteredPacketRuntimeMutation<PreferenceElementInterfaceRuntimeResult>({
        packetStore: services.packetStore,
        actorContext: {
          actorPacketId: actorContext.actorPacket.header.packet_id,
          actorPacket: actorContext.actorPacket,
          proofBundle: actorContext.proofBundle,
        },
        mutationIntent: 'preference.element.set',
        input: {
          scope_display: scopeDisplayPatch,
          shell_chrome: parsedBody.shell_chrome,
          note: parsedBody.shell_chrome
            ? 'Element interface preferences.'
            : 'Element scope-display preferences.',
        },
        request,
      });

      return createJsonResponse({
        preferences: runtimeResult.result.preferences,
        shell_chrome: runtimeResult.result.shell_chrome,
        packet_runtime: {
          connector_id: runtimeResult.connector_id,
          packet_type: runtimeResult.packet_type,
          packet_subtype: runtimeResult.packet_subtype,
          mutation_intent: runtimeResult.mutation_intent,
          availability: runtimeResult.availability,
          wrote_revision: runtimeResult.result.wrote_revision,
          action_ids: runtimeResult.action_ids,
          policy_action_ids: runtimeResult.policy_action_ids,
        },
      });
    }

    const guestPreferenceWrite = writeScopeDisplayPreferencesCompatibility({
      request,
      preferences: scopeDisplayPatch,
      shellChrome: parsedBody.shell_chrome,
    });

    return createJsonResponse(
      {
        preferences: guestPreferenceWrite.preferences,
        shell_chrome: guestPreferenceWrite.shell_chrome,
      },
      200,
      {
        'set-cookie': guestPreferenceWrite.setCookieHeader,
      }
    );
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update shell preferences.',
      },
      400
    );
  }
};
