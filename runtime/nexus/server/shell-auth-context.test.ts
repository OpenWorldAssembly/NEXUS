/**
 * File: shell-auth-context.test.ts
 * Description: Tests authenticated actor binding for shell preference reads.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAuthenticatedShellActorPreferenceContext } from './shell-auth-context.ts';

test('shell preference read context uses the authenticated actor when no actor is requested', () => {
  assert.deepEqual(
    resolveAuthenticatedShellActorPreferenceContext({
      authenticatedActorPacketId: 'nexus:element/alice',
      isAuthenticated: true,
    }),
    {
      actorPacketId: 'nexus:element/alice',
      ignoredRequestedActorPacketId: null,
      reason: 'authenticated_default',
    }
  );
});

test('shell preference read context allows requested actor only when it matches the session', () => {
  assert.deepEqual(
    resolveAuthenticatedShellActorPreferenceContext({
      requestedActorPacketId: 'nexus:element/alice',
      authenticatedActorPacketId: 'nexus:element/alice',
      isAuthenticated: true,
    }),
    {
      actorPacketId: 'nexus:element/alice',
      ignoredRequestedActorPacketId: null,
      reason: 'authenticated_match',
    }
  );
});

test('shell preference read context falls back to guest on requested actor/session mismatch', () => {
  assert.deepEqual(
    resolveAuthenticatedShellActorPreferenceContext({
      requestedActorPacketId: 'nexus:element/bob',
      authenticatedActorPacketId: 'nexus:element/alice',
      isAuthenticated: true,
    }),
    {
      actorPacketId: null,
      ignoredRequestedActorPacketId: 'nexus:element/bob',
      reason: 'actor_mismatch',
    }
  );
});

test('shell preference read context treats unsigned actor requests as guest reads', () => {
  assert.deepEqual(
    resolveAuthenticatedShellActorPreferenceContext({
      requestedActorPacketId: 'nexus:element/alice',
      isAuthenticated: false,
    }),
    {
      actorPacketId: null,
      ignoredRequestedActorPacketId: 'nexus:element/alice',
      reason: 'guest',
    }
  );
});
