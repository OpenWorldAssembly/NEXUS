import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createElementPreferenceShadowSeed,
  createElementPreferenceShadowSeedBatch,
} from '@runtime/nexus/server/preference-packet-shadow';

test('creates a safe shadow seed candidate for current runtime preferences', () => {
  const seed = createElementPreferenceShadowSeed({
    actorPacketId: 'nexus:element/person-alice',
    preferences: {
      main_visible_scope_packet_ids: ['scope-b', 'scope-a', 'scope-a'],
      show_associated_parent_chains: true,
      show_followed_parent_chains: false,
    },
    context: {
      namespace: 'nexus',
      surface_key: 'shell',
    },
  });

  assert.equal(seed.seed_kind, 'preference.element.shadow_seed');
  assert.equal(seed.safe_to_seed_shadow, true);
  assert.equal(seed.live_fortress_ready, false);
  assert.equal(seed.packet_definition_audit_status, 'pass');
  assert.equal(seed.projection_equivalent, true);
  assert.deepEqual(seed.projected_runtime_preferences, {
    main_visible_scope_packet_ids: ['scope-a', 'scope-b'],
    show_associated_parent_chains: true,
    show_followed_parent_chains: false,
  });
  assert.match(seed.packet_id, /^nexus:preference\/element\//);
});

test('creates a batch of shadow seed candidates without persisting anything', () => {
  const seeds = createElementPreferenceShadowSeedBatch([
    {
      actorPacketId: 'nexus:element/person-alice',
      preferences: {
        main_visible_scope_packet_ids: [],
        show_associated_parent_chains: true,
        show_followed_parent_chains: true,
      },
    },
    {
      actorPacketId: 'nexus:element/person-bob',
      preferences: {
        main_visible_scope_packet_ids: ['scope-a'],
        show_associated_parent_chains: false,
        show_followed_parent_chains: false,
      },
    },
  ]);

  assert.equal(seeds.length, 2);
  assert.ok(seeds.every((seed) => seed.safe_to_seed_shadow));
  assert.notEqual(seeds[0].packet_id, seeds[1].packet_id);
});
