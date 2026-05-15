/**
 * File: shell-preferences+api.ts
 * Description: Persists temporary shell scope-display preferences for claimed actors and guest compatibility sessions.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';
import { writeClaimedScopeDisplayPreferences } from '@runtime/nexus/server/scope-display-preferences';
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

export const POST: RequestHandler = async (request) => {
  try {
    const rawBody = await request.json();
    const parsedBody = ShellPreferencesRequestSchema.parse(rawBody);
    const services = await getNexusPacketServices();
    const preferencePatch = {
      main_visible_scope_packet_ids: parsedBody.main_visible_scope_packet_ids,
      show_associated_parent_chains: parsedBody.show_associated_parent_chains,
      show_followed_parent_chains: parsedBody.show_followed_parent_chains,
    };

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
      const preferences = await writeClaimedScopeDisplayPreferences({
        packetStore: services.packetStore,
        actorPacketId: actorContext.actorPacket.header.packet_id,
        preferences: preferencePatch,
      });

      return createJsonResponse({ preferences });
    }

    const guestPreferenceWrite = writeScopeDisplayPreferencesCompatibility({
      request,
      preferences: preferencePatch,
    });

    return createJsonResponse(
      { preferences: guestPreferenceWrite.preferences },
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
