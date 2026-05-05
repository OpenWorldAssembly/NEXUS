/**
 * File: preview+api.ts
 * Description: Generates Packet Explorer export previews without forcing a file download.
 */

import type { RequestHandler } from 'expo-router/server';

import {
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

export const POST: RequestHandler = async (request) => {
  try {
    const requestBody = parseNexusPacketExplorerExportRequest(
      await request.json()
    );
    const previewPayload = await getNexusPacketExplorerExportPreview(
      requestBody
    );

    return createJsonResponse(previewPayload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to preview the Packet Explorer export.';

    return createJsonResponse({ error: message }, 400);
  }
};
