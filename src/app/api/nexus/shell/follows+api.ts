/**
 * File: follows+api.ts
 * Description: Persists lightweight Nexus shell follow preferences for mounted-scope navigation.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { writeFollowedScopePreference } from '@runtime/nexus/server/shell-preferences';

const UpdateFollowPreferenceSchema = z
  .object({
    actor_packet_id: z.string().min(1).optional().nullable().default(null),
    scope_id: z.string().min(1),
    is_followed: z.boolean(),
  })
  .strict();

function createJsonResponse(
  body: unknown,
  status = 200,
  setCookieHeader?: string | null
): Response {
  const headers = new Headers({
    'content-type': 'application/json',
  });

  if (setCookieHeader) {
    headers.append('set-cookie', setCookieHeader);
  }

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

export const PUT: RequestHandler = async (request) => {
  try {
    const parsedBody = UpdateFollowPreferenceSchema.parse(await request.json());
    const preferenceUpdate = writeFollowedScopePreference({
      request,
      actorPacketId: parsedBody.actor_packet_id,
      scopeId: parsedBody.scope_id,
      isFollowed: parsedBody.is_followed,
    });

    return createJsonResponse(
      {
        followed_scope_ids: preferenceUpdate.followedScopeIds,
      },
      200,
      preferenceUpdate.setCookieHeader
    );
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update followed scopes.',
      },
      500
    );
  }
};
