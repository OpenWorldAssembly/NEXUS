/**
 * File: target+api.ts
 * Description: Returns raw attestation summaries and edges for one packet target.
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
    const requestUrl = new URL(request.url);
    const targetPacketId = requestUrl.searchParams.get('target_packet_id');
    const viewerActorPacketId =
      requestUrl.searchParams.get('viewer_actor_packet_id');
    const attestationKind = requestUrl.searchParams.get('attestation_kind');
    const contextPacketId = requestUrl.searchParams.get('context_packet_id');

    if (!targetPacketId) {
      return createJsonResponse(
        {
          error: 'target_packet_id is required.',
        },
        400
      );
    }

    const services = await getNexusPacketServices();
    const summary = await services.attestationService.getTargetSummary({
      target_packet_id: targetPacketId,
      viewer_actor_key: viewerActorPacketId
        ? `element:${viewerActorPacketId}`
        : null,
    });
    const attestations = await services.attestationService.listTargetAttestations({
      target_packet_id: targetPacketId,
      attestation_kind: attestationKind,
      context_packet_id: contextPacketId,
      active_only: false,
    });

    return createJsonResponse({
      target_packet_id: targetPacketId,
      summary,
      attestations,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load target attestations.';

    return createJsonResponse({ error: message }, 500);
  }
};
