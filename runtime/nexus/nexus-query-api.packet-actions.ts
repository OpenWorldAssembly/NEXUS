/**
 * File: nexus-query-api.packet-actions.ts
 * Description: Client-side helpers for runtime-projected PacketActions.
 */

import type {
  NexusPacketActionsBatchPayload,
  NexusPacketActionsBatchRequest,
} from '@runtime/nexus/nexus-api-types';
import { fetchMutationJsonOrThrow } from '@runtime/nexus/nexus-query-api.shared';

export function fetchNexusPacketActionsBatch(
  requestBody: NexusPacketActionsBatchRequest
): Promise<NexusPacketActionsBatchPayload> {
  return fetchMutationJsonOrThrow<NexusPacketActionsBatchPayload>({
    path: '/api/nexus/packets/actions',
    method: 'POST',
    body: requestBody,
  });
}
