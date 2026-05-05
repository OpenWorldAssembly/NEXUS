/**
 * File: explorer+api.ts
 * Description: Serves Packet Explorer read payloads plus export preview/download POST actions.
 */

import type { RequestHandler } from 'expo-router/server';

import { getNexusPacketExplorerPayload } from '@runtime/nexus/server/nexus-packet-explorer-data';
import {
  getNexusPacketExplorerExportDownload,
  getNexusPacketExplorerExportPreview,
  parseNexusPacketExplorerExportRequest,
} from '@runtime/nexus/server/nexus-packet-export';

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

/**
 * Inputs: `packet_id` query param.
 * Output: the additive Packet Explorer payload for the requested packet.
 */
export const GET: RequestHandler = async (request) => {
  try {
    const requestUrl = new URL(request.url);
    const packetId = requestUrl.searchParams.get('packet_id');
    const viewerActorPacketId = requestUrl.searchParams.get('actor_packet_id');
    const inspectionLens = requestUrl.searchParams.get('inspection_lens');

    if (!packetId) {
      return createJsonResponse(
        { error: 'Missing packet_id query parameter.' },
        400
      );
    }

    const explorerPayload = await getNexusPacketExplorerPayload({
      packetId,
      viewerActorPacketId,
      inspectionLens:
        inspectionLens === 'summary' ||
        inspectionLens === 'raw' ||
        inspectionLens === 'adapted' ||
        inspectionLens === 'read_model'
          ? inspectionLens
          : undefined,
    });

    return createJsonResponse(explorerPayload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load the packet explorer payload.';

    return createJsonResponse({ error: message }, 500);
  }
};

export const POST: RequestHandler = async (request) => {
  const requestUrl = new URL(request.url);
  const action = requestUrl.searchParams.get('action');

  try {
    const requestBody = parseNexusPacketExplorerExportRequest(
      await request.json()
    );

    if (action === 'export_download') {
      const downloadPayload = await getNexusPacketExplorerExportDownload(
        requestBody
      );

      return new Response(downloadPayload.bytes, {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-disposition': `attachment; filename="${downloadPayload.fileName}"`,
        },
      });
    }

    if (action === 'export_preview') {
      const previewPayload = await getNexusPacketExplorerExportPreview(
        requestBody
      );

      return createJsonResponse(previewPayload);
    }

    return createJsonResponse(
      { error: 'Unknown Packet Explorer POST action.' },
      404
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : action === 'export_download'
          ? 'Unable to download the Packet Explorer export.'
          : 'Unable to preview the Packet Explorer export.';

    return createJsonResponse({ error: message }, 400);
  }
};
