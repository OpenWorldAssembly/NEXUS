/**
 * File: sessions+api.ts
 * Description: Lists and revokes claimed-identity sessions and remembered devices.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';

const RevokeSessionsRequestSchema = z
  .object({
    target_session_id: z.string().min(1).optional().nullable().default(null),
    revoke_others: z.boolean().default(false),
    reauth_token: z.string().min(1),
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

export const GET: RequestHandler = async (request) => {
  try {
    const services = await getNexusPacketServices();
    const payload = await services.authService.listSessions(
      request,
      request.headers.get('x-csrf-token')
    );

    return createJsonResponse(payload);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Unable to load current sessions.',
      },
      500
    );
  }
};

export const DELETE: RequestHandler = async (request) => {
  try {
    const parsedBody = RevokeSessionsRequestSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const payload = await services.authService.revokeSessions({
      request,
      csrfToken: request.headers.get('x-csrf-token'),
      reauthToken: parsedBody.reauth_token,
      targetSessionId: parsedBody.target_session_id,
      revokeOthers: parsedBody.revoke_others,
    });

    return createJsonResponse(payload);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Unable to revoke those sessions.',
      },
      500
    );
  }
};
