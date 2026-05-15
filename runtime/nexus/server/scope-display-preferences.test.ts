import test from 'node:test';
import assert from 'node:assert/strict';

import { reconcileScopeDisplayPreferences } from './scope-display-preferences.ts';

test('scope display preference reconciliation prunes stale main ids without changing toggles', () => {
  const preferences = reconcileScopeDisplayPreferences({
    preferences: {
      main_visible_scope_packet_ids: [
        'nexus:element/tempe',
        'nexus:element/stale-scope',
        'nexus:element/flagstaff',
        'nexus:element/tempe',
      ],
      show_associated_parent_chains: false,
      show_followed_parent_chains: true,
    },
    eligibleMainScopePacketIds: [
      'nexus:element/flagstaff',
      'nexus:element/tempe',
    ],
  });

  assert.deepEqual(preferences, {
    main_visible_scope_packet_ids: [
      'nexus:element/flagstaff',
      'nexus:element/tempe',
    ],
    show_associated_parent_chains: false,
    show_followed_parent_chains: true,
  });
});


test('scope display preference reconciliation leaves main ids alone without eligibility input', () => {
  const preferences = reconcileScopeDisplayPreferences({
    preferences: {
      main_visible_scope_packet_ids: [
        'nexus:element/tempe',
        'nexus:element/stale-scope',
      ],
    },
  });

  assert.deepEqual(preferences.main_visible_scope_packet_ids, [
    'nexus:element/stale-scope',
    'nexus:element/tempe',
  ]);
  assert.equal(preferences.show_associated_parent_chains, true);
  assert.equal(preferences.show_followed_parent_chains, true);
});
