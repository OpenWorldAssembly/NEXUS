import assert from 'node:assert/strict';
import test from 'node:test';

import { NexusAuthGateError } from '@runtime/nexus/nexus-auth-gate-error';

import { fetchMutationJsonOrThrow } from './nexus-query-api.shared.ts';

test('mutation fetch helper raises structured auth-gate errors when the server provides them', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: 'Refresh the claimed session before approving this action.',
          auth_gate: {
            reason: 'stale_actor_packet',
            message: 'Refresh the claimed session before approving this action.',
            retryable: true,
            actor_required: true,
            failure_code: 'session_actor_mismatch',
            diagnostics: {
              client_actor_packet_id: 'nexus:element/testy',
            },
          },
        }),
        {
          status: 409,
          headers: {
            'content-type': 'application/json',
          },
        }
      )) as typeof fetch;

    await assert.rejects(
      () =>
        fetchMutationJsonOrThrow({
          path: '/api/nexus/mutations/prepare',
          method: 'POST',
          body: {},
        }),
      (error: unknown) =>
        error instanceof NexusAuthGateError &&
        error.reason === 'stale_actor_packet' &&
        error.failureCode === 'session_actor_mismatch' &&
        error.diagnostics?.client_actor_packet_id === 'nexus:element/testy'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
