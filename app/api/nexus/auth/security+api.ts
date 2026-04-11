/**
 * File: security+api.ts
 * Description: Reads and updates claimed-identity write-approval preferences such as standard, guarded, and every-write behavior.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';

const SecurityModeSchema = z.enum(['standard', 'guarded', 'every_write']);

const UpdateSecurityRequestSchema = z
  .object({
    security_mode: SecurityModeSchema,
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
    const payload = await services.authService.getSecurityPreferences(
      request,
      request.headers.get('x-csrf-token')
    );

    return createJsonResponse(payload);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load security preferences.',
      },
      500
    );
  }
};

export const PUT: RequestHandler = async (request) => {
  try {
    const parsedBody = UpdateSecurityRequestSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const payload = await services.authService.updateSecurityPreferences({
      request,
      csrfToken: request.headers.get('x-csrf-token'),
      reauthToken: parsedBody.reauth_token,
      securityMode: parsedBody.security_mode,
    });

    return createJsonResponse(payload);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update security preferences.',
      },
      500
    );
  }
};
