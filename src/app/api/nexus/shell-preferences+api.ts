/**
 * File: shell-preferences+api.ts
 * Description: Persists guest shell preference compatibility state; claimed Preference.element writes use the signed mutation corridor.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { ShellChromePreferenceValueSchema } from '@core/packets/definitions/preference.ts';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';
import {
  writeScopeDisplayPreferencesCompatibility,
} from '@runtime/nexus/server/shell-preferences';

const ShellPreferencesRequestSchema = z
  .object({
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
    const scopeDisplayPatch = buildScopeDisplayPatch(parsedBody);

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

