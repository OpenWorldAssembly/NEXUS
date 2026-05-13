/**
 * File: nexus-query-api.verification.ts
 * Description: Client-side helpers for runtime packet verification actions.
 */

import type {
  NexusPacketVerificationActionPayload,
  NexusPacketVerificationRequest,
} from '@runtime/nexus/nexus-api-types';
import { fetchMutationJsonOrThrow } from '@runtime/nexus/nexus-query-api.shared';

export function runNexusPacketVerification(
  requestBody: NexusPacketVerificationRequest
): Promise<NexusPacketVerificationActionPayload> {
  return fetchMutationJsonOrThrow<NexusPacketVerificationActionPayload>({
    path: '/api/nexus/packets/verification',
    method: 'POST',
    body: requestBody,
  });
}
