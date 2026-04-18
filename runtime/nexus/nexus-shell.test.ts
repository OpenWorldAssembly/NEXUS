import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNexusBranchNodes,
  getNexusSectionFromPathname,
  NEXUS_SECTION_ORDER,
  type NexusScopeSummary,
} from './nexus-shell.ts';

const GLOBAL_SCOPE: NexusScopeSummary = {
  id: 'global-commons',
  packetId: 'nexus:element/global-commons',
  name: 'Global Commons',
  shortLabel: 'Global',
  level: 'global',
  description: 'Global scope.',
  localityLabel: 'Global',
  badge: 'Root',
  relationshipLabel: 'Root assembly scope',
  childIds: ['moreno-valley'],
  followedScopeIds: [],
  publicLobbyLabel: 'Global visitor lobby',
  stats: {
    members: 0,
    activeVotes: 0,
    hotDiscussions: 0,
    missions: 0,
    guestLobbyOpen: true,
  },
};

const LOCAL_SCOPE: NexusScopeSummary = {
  id: 'moreno-valley',
  packetId: 'nexus:element/moreno-valley',
  name: 'Moreno Valley',
  shortLabel: 'MV',
  level: 'city',
  description: 'Local scope.',
  localityLabel: 'Moreno Valley',
  badge: 'Assembly',
  relationshipLabel: 'Child of Global Commons',
  parentId: 'global-commons',
  childIds: ['you'],
  followedScopeIds: [],
  publicLobbyLabel: 'Moreno Valley visitor lobby',
  stats: {
    members: 0,
    activeVotes: 0,
    hotDiscussions: 0,
    missions: 0,
    guestLobbyOpen: true,
  },
};

const PERSONAL_SCOPE: NexusScopeSummary = {
  id: 'you',
  packetId: 'nexus:element/current-actor',
  name: 'You',
  shortLabel: 'You',
  level: 'personal',
  description: 'Personal scope.',
  localityLabel: 'Current actor',
  badge: 'Claimed actor',
  relationshipLabel: 'Current actor scope',
  parentId: 'moreno-valley',
  childIds: [],
  followedScopeIds: [],
  publicLobbyLabel: 'Personal trust lens',
  stats: {
    members: 1,
    activeVotes: 0,
    hotDiscussions: 0,
    missions: 0,
    guestLobbyOpen: false,
  },
};

test('roles is part of the visible section order and resolves from the pathname', () => {
  assert.deepEqual(NEXUS_SECTION_ORDER, [
    'dashboard',
    'discussions',
    'votes',
    'roles',
    'trust',
    'library',
  ]);
  assert.equal(getNexusSectionFromPathname('/nexus/roles'), 'roles');
});

test('personal scope renders as a child leaf under the local assembly branch', () => {
  const nodes = buildNexusBranchNodes(
    [GLOBAL_SCOPE, LOCAL_SCOPE, PERSONAL_SCOPE],
    'you',
    ['global-commons', 'moreno-valley', 'you']
  );

  const personalNode = nodes.find((node) => node.scopeId === 'you');
  const localNode = nodes.find((node) => node.scopeId === 'moreno-valley');

  assert.ok(personalNode);
  assert.ok(localNode);
  assert.equal(personalNode?.depth, (localNode?.depth ?? 0) + 1);
  assert.equal(personalNode?.relationship, 'personal');
});
