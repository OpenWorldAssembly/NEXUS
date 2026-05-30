/**
 * File: nexus-query-api.mutations.ts
 * Description: Client-side helpers for the Dispatch prepare/finalize mutation transport.
 */

import type {
  NexusFinalizedMutationPayload,
  NexusPreparedMutationPayload,
} from '@runtime/nexus/nexus-api-types';
import { fetchMutationJsonOrThrow } from '@runtime/nexus/nexus-query-api.shared';

export function prepareNexusMutation(input: {
  requestBody: Record<string, unknown>;
  headers?: Record<string, string>;
  interfaceEventHeaders?: Record<string, string>;
}): Promise<NexusPreparedMutationPayload> {
  return fetchMutationJsonOrThrow<NexusPreparedMutationPayload>({
    path: '/api/nexus/mutations/prepare',
    method: 'POST',
    body: input.requestBody,
    headers: {
      ...(input.headers ?? {}),
      ...(input.interfaceEventHeaders ?? {}),
    },
  });
}

export function finalizeNexusMutation(input: {
  requestBody: Record<string, unknown>;
  headers?: Record<string, string>;
  interfaceEventHeaders?: Record<string, string>;
}): Promise<NexusFinalizedMutationPayload> {
  return fetchMutationJsonOrThrow<NexusFinalizedMutationPayload>({
    path: '/api/nexus/mutations/finalize',
    method: 'POST',
    body: input.requestBody,
    headers: {
      ...(input.headers ?? {}),
      ...(input.interfaceEventHeaders ?? {}),
    },
  });
}
