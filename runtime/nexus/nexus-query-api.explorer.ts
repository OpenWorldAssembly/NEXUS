/**
 * File: nexus-query-api.explorer.ts
 * Description: Client-side query helpers for the Packet Explorer payload.
 */

import type {
  NexusPacketExplorerExportPreviewPayload,
  NexusPacketExplorerExportRequest,
  NexusPacketExplorerInspectionLens,
  NexusPacketExplorerPayload,
} from '@runtime/nexus/nexus-api-types';
import {
  NexusApiError,
  fetchJsonOrThrow,
  fetchMutationJsonOrThrow,
} from '@runtime/nexus/nexus-query-api.shared';

export function fetchNexusPacketExplorerPayload(input: {
  packetId: string;
  actorPacketId?: string | null;
  inspectionLens?: NexusPacketExplorerInspectionLens;
  signal?: AbortSignal;
}): Promise<NexusPacketExplorerPayload> {
  const searchParams = new URLSearchParams();

  searchParams.set('packet_id', input.packetId);
  if (input.actorPacketId) {
    searchParams.set('actor_packet_id', input.actorPacketId);
  }
  if (input.inspectionLens) {
    searchParams.set('inspection_lens', input.inspectionLens);
  }

  return fetchJsonOrThrow<NexusPacketExplorerPayload>(
    `/api/nexus/packets/explorer?${searchParams.toString()}`,
    {
      signal: input.signal,
    }
  );
}

export function previewNexusPacketExplorerExport(
  requestBody: NexusPacketExplorerExportRequest
): Promise<NexusPacketExplorerExportPreviewPayload> {
  return fetchMutationJsonOrThrow<NexusPacketExplorerExportPreviewPayload>({
    path: '/api/nexus/packets/explorer?action=export_preview',
    method: 'POST',
    body: requestBody,
  });
}

async function readDownloadErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };

    if (payload.error) {
      return payload.error;
    }
  } catch {
    // Fall back to status text below when the response body is not JSON.
  }

  return response.statusText || 'Unable to download the Explorer export.';
}

export async function downloadNexusPacketExplorerExport(
  requestBody: NexusPacketExplorerExportRequest
): Promise<void> {
  const response = await fetch('/api/nexus/packets/explorer?action=export_download', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new NexusApiError({
      message: await readDownloadErrorMessage(response),
      status: response.status,
      payload: null,
    });
  }

  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    throw new Error('Explorer downloads are only available in a browser session.');
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('content-disposition');
  const fileNameMatch = contentDisposition?.match(/filename="([^"]+)"/i);
  const fileName = fileNameMatch?.[1] ?? 'nexus-export.json';
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
