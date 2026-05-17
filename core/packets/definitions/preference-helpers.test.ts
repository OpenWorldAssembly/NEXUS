/**
 * File: preference-helpers.test.ts
 * Description: Shadow-mode tests for Preference.scope_display builders, projection, and compatibility helpers.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildScopeDisplayPreferenceBody,
  createScopeDisplayPreferenceContextKey,
  createScopeDisplayPreferencePacketId,
  downcastScopeDisplayPreferenceValueToLegacyV0,
  normalizeScopeDisplayPreferenceValue,
  projectLatestActiveScopeDisplayPreference,
  upcastLegacyScopeDisplayPreferenceValueV0,
} from './preference-helpers.ts';

test('Preference.scope_display builder normalizes current runtime preference shape', () => {
  const body = buildScopeDisplayPreferenceBody({
    owner_ref: { packet_id: 'nexus:element/person/alice' },
    value: {
      main_visible_scope_packet_ids: [
        'nexus:element/locality/city/example',
        ' nexus:element/locality/state/example ',
        'nexus:element/locality/city/example',
      ],
      show_associated_parent_chains: false,
      show_followed_parent_chains: true,
    },
  });

  assert.equal(body.type, 'preference');
  assert.equal(body.subtype, 'scope_display');
  assert.equal(body.status, 'active');
  assert.equal(body.privacy, 'private_sync');
  assert.deepEqual(body.value.main_visible_scope_packet_ids, [
    'nexus:element/locality/city/example',
    'nexus:element/locality/state/example',
  ]);
});

test('Preference.scope_display defaults match current runtime scope-display defaults', () => {
  assert.deepEqual(normalizeScopeDisplayPreferenceValue({}), {
    main_visible_scope_packet_ids: [],
    show_associated_parent_chains: true,
    show_followed_parent_chains: true,
  });
});

test('Preference.scope_display derives deterministic context key and packet id', () => {
  const context = {
    namespace: 'nexus',
    surface_key: 'sidebar',
  };

  assert.equal(
    createScopeDisplayPreferenceContextKey(context),
    'nexus|||sidebar|'
  );
  assert.match(
    createScopeDisplayPreferencePacketId({
      owner_ref: { packet_id: 'nexus:element/person/alice' },
      context,
    }),
    /^nexus:preference\/scope-display\//
  );
});

test('Preference.scope_display latest-active projection selects the newest matching active body', () => {
  const owner_ref = { packet_id: 'nexus:element/person/alice' };
  const older = buildScopeDisplayPreferenceBody({
    owner_ref,
    value: {
      main_visible_scope_packet_ids: ['nexus:element/locality/city/older'],
    },
  });
  const newer = buildScopeDisplayPreferenceBody({
    owner_ref,
    value: {
      main_visible_scope_packet_ids: ['nexus:element/locality/city/newer'],
    },
  });
  const otherOwner = buildScopeDisplayPreferenceBody({
    owner_ref: { packet_id: 'nexus:element/person/bob' },
    value: {
      main_visible_scope_packet_ids: ['nexus:element/locality/city/bob'],
    },
  });

  const projected = projectLatestActiveScopeDisplayPreference({
    owner_ref,
    records: [
      { body: newer, recorded_at: '2026-01-02T00:00:00.000Z' },
      { body: older, recorded_at: '2026-01-01T00:00:00.000Z' },
      { body: otherOwner, recorded_at: '2026-01-03T00:00:00.000Z' },
    ],
  });

  assert.deepEqual(projected?.value.main_visible_scope_packet_ids, [
    'nexus:element/locality/city/newer',
  ]);
});

test('Preference.scope_display compatibility helpers upcast and loss-aware downcast legacy values', () => {
  const upcast = upcastLegacyScopeDisplayPreferenceValueV0({
    main_scope_ids: ['nexus:element/a', 'nexus:element/a', ' nexus:element/b '],
    show_parent_chains: false,
  });

  assert.deepEqual(upcast.loss_notes, []);
  assert.deepEqual(upcast.value, {
    main_visible_scope_packet_ids: ['nexus:element/a', 'nexus:element/b'],
    show_associated_parent_chains: false,
    show_followed_parent_chains: false,
  });

  const downcast = downcastScopeDisplayPreferenceValueToLegacyV0({
    main_visible_scope_packet_ids: ['nexus:element/a'],
    show_associated_parent_chains: true,
    show_followed_parent_chains: false,
  });

  assert.equal(downcast.value.show_parent_chains, false);
  assert.equal(downcast.loss_notes.length, 1);
});
