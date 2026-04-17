/**
 * File: upgrade+api.ts
 * Description: Reports whether the current claimed identity must finish passkey setup before normal use.
 */

import type { RequestHandler } from 'expo-router/server';

import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

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
    const payload = await services.authService.getUpgradeStatus(
      request,
      request.headers.get('x-csrf-token')
    );

    return createJsonResponse(payload);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Unable to load upgrade status.',
      },
      500
    );
  }
};
