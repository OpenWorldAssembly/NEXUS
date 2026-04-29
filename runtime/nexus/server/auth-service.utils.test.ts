import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NexusAuthFailureError,
  NexusAuthGateError,
} from '@runtime/nexus/nexus-auth-gate-error';

import {
  toNexusAuthFailurePayload,
  toNexusAuthGatePayload,
} from './auth-service.utils.ts';

test('auth gate payload preserves explicit failure codes from gate errors', () => {
  const payload = toNexusAuthGatePayload(
    new NexusAuthGateError(
      'stale_actor_packet',
      'Refresh the claimed session before approving this action.',
      {
        failureCode: 'session_actor_mismatch',
        diagnostics: {
          client_actor_packet_id: 'nexus:element/testy',
        },
      }
    )
  );

  assert.equal(payload?.reason, 'stale_actor_packet');
  assert.equal(payload?.failure_code, 'session_actor_mismatch');
  assert.equal(payload?.diagnostics?.client_actor_packet_id, 'nexus:element/testy');
});

test('signature verification errors no longer get remapped into stale actor gates', () => {
  const payload = toNexusAuthGatePayload(
    new Error('Person element cryptographic signature verification failed.')
  );

  assert.equal(payload, null);
});

test('auth failure payloads remain available for non-gate auth diagnostics', () => {
  const payload = toNexusAuthFailurePayload(
    new NexusAuthFailureError('Signed re-auth assertion verification failed.', {
      failureCode: 'assertion_signature_invalid',
      diagnostics: {
        request_actor_packet_id: 'nexus:element/testy',
      },
    })
  );

  assert.equal(payload?.code, 'assertion_signature_invalid');
  assert.equal(payload?.diagnostics?.request_actor_packet_id, 'nexus:element/testy');
});
