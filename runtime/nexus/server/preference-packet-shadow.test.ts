/**
 * File: preference-packet-shadow.test.ts
 * Description: Shadow-mode conversion tests for Preference.element and runtime shell preferences.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  preferenceBodyToRuntimeScopeDisplayPreferences,
  runtimeScopeDisplayPreferencesToPreferenceBody,
} from './preference-packet-shadow.ts';

test('runtime scope display preferences round-trip through Preference.element body', () => {
  const runtimePreferences = {
    main_visible_scope_packet_ids: [
      'nexus:element/locality/city/example',
      'nexus:element/locality/city/example',
      ' nexus:element/locality/state/example ',
    ],
    show_associated_parent_chains: false,
    show_followed_parent_chains: true,
  };

  const body = runtimeScopeDisplayPreferencesToPreferenceBody({
    actorPacketId: 'nexus:element/person/alice',
    preferences: runtimePreferences,
  });

  assert.equal(body.type, 'preference');
  assert.equal(body.subtype, 'element');
  assert.equal(body.owner_ref.packet_id, 'nexus:element/person/alice');
  assert.equal(body.privacy, 'private_sync');

  assert.deepEqual(preferenceBodyToRuntimeScopeDisplayPreferences(body), {
    main_visible_scope_packet_ids: [
      'nexus:element/locality/city/example',
      'nexus:element/locality/state/example',
    ],
    show_associated_parent_chains: false,
    show_followed_parent_chains: true,
  });
});
