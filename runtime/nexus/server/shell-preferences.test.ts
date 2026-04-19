import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readFollowedScopeIds,
  writeFollowedScopePreference,
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
