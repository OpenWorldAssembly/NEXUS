/**
 * File: verification+api.ts
 * Description: Runs local packet verification and returns a modal-friendly summary payload.
 */

import type { RequestHandler } from 'expo-router/server';

import type { NexusPacketVerificationRequest } from '@runtime/nexus/nexus-api-types';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function parseVerificationRequest(value: unknown): NexusPacketVerificationRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Packet verification requests must use a JSON object body.');
  }

  const candidate = value as Record<string, unknown>;
  const packetId =
    typeof candidate.packet_id === 'string' ? candidate.packet_id.trim() : '';

  if (!packetId) {
    throw new Error('Packet verification requests must include a packet_id.');
  }

  return {
    packet_id: packetId,
  };
}

export const POST: RequestHandler = async (request) => {
  try {
    const requestBody = parseVerificationRequest(await request.json());
    const services = await getNexusPacketServices();
    const payload = await services.verificationService.validatePacket(
      requestBody.packet_id
    );

    return createJsonResponse(payload);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to validate this packet.',
      },
      400
    );
  }
};
