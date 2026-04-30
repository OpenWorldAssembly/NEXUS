/**
 * File: nexus-query-api.explorer.ts
 * Description: Client-side query helpers for the Packet Explorer payload.
 */

import type { NexusPacketExplorerPayload } from '@runtime/nexus/nexus-api-types';
import { fetchJsonOrThrow } from '@runtime/nexus/nexus-query-api.shared';

export function fetchNexusPacketExplorerPayload(input: {
  packetId: string;
  actorPacketId?: string | null;
  signal?: AbortSignal;
}): Promise<NexusPacketExplorerPayload> {
  const searchParams = new URLSearchParams();

  searchParams.set('packet_id', input.packetId);
  if (input.actorPacketId) {
    searchParams.set('actor_packet_id', input.actorPacketId);
  }

  return fetchJsonOrThrow<NexusPacketExplorerPayload>(
    `/api/nexus/packets/explorer?${searchParams.toString()}`,
    {
      signal: input.signal,
    }
  );
}
