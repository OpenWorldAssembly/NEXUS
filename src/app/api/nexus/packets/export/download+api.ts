/**
 * File: download+api.ts
 * Description: Generates Packet Explorer export downloads as JSON attachments.
 */

import type { RequestHandler } from 'expo-router/server';

import {
  getNexusPacketExplorerExportDownload,
  parseNexusPacketExplorerExportRequest,
} from '@runtime/nexus/server/nexus-packet-export';

function createJsonErrorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
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
  } catch (error) {
    return createJsonErrorResponse(
      error instanceof Error
        ? error.message
        : 'Unable to download the Packet Explorer export.'
    );
  }
};
