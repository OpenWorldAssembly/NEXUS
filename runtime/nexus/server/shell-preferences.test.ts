import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readFollowedScopeIds,
  readScopeDisplayPreferencesCompatibility,
  writeFollowedScopePreference,
  writeScopeDisplayPreferencesCompatibility,
} from './shell-preferences.ts';

test('followed scopes are stored per actor when an actor packet id is present', () => {
  const request = new Request('https://example.test/api/nexus/shell/follows');
  const firstUpdate = writeFollowedScopePreference({
    request,
    actorPacketId: 'nexus:element/person-a',
    scopeId: 'moreno-valley',
    isFollowed: true,
  });
  const persistedRequest = new Request('https://example.test/api/nexus/shell', {
    headers: {
      cookie: firstUpdate.setCookieHeader.split(';')[0] ?? '',
    },
  });

  assert.deepEqual(
    readFollowedScopeIds(persistedRequest, 'nexus:element/person-a'),
    ['moreno-valley']
  );
  assert.deepEqual(
    readFollowedScopeIds(persistedRequest, 'nexus:element/person-b'),
    []
  );
});

test('scope display preferences are stored per actor and preserve main visibility plus chain toggles', () => {
  const request = new Request('https://example.test/api/nexus/shell-preferences');
  const firstUpdate = writeScopeDisplayPreferencesCompatibility({
    request,
    actorPacketId: 'nexus:element/person-a',
    preferences: {
      main_visible_scope_packet_ids: ['nexus:element/moreno-valley', 'nexus:element/canyon-lake'],
      show_associated_parent_chains: false,
      show_followed_parent_chains: true,
    },
  });
  const persistedRequest = new Request('https://example.test/api/nexus/shell-preferences', {
    headers: {
      cookie: firstUpdate.setCookieHeader.split(';')[0] ?? '',
    },
  });

  assert.deepEqual(
    readScopeDisplayPreferencesCompatibility(
      persistedRequest,
      'nexus:element/person-a'
    ),
    {
      main_visible_scope_packet_ids: [
        'nexus:element/canyon-lake',
        'nexus:element/moreno-valley',
      ],
      show_associated_parent_chains: false,
      show_followed_parent_chains: true,
    }
  );
  assert.deepEqual(
    readScopeDisplayPreferencesCompatibility(
      persistedRequest,
      'nexus:element/person-b'
    ),
    {
      main_visible_scope_packet_ids: [],
      show_associated_parent_chains: true,
      show_followed_parent_chains: true,
    }
  );
});
