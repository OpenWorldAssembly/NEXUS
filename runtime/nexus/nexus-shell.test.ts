import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNexusBranchNodes,
  getNexusScopeDepthWidth,
  getNexusScopeLevelLabel,
  getNexusSectionMenuDetail,
  getNexusSectionMenuTitle,
  getNexusScopeSelectionHref,
  getNexusSectionFromPathname,
  isNexusGeographicTreeScope,
  NEXUS_SECTION_ORDER,
  resolveNexusReturnPath,
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
  isMounted: true,
  isDiscoverable: true,
  mountReasons: ['global_default'],
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
  isMounted: true,
  isDiscoverable: true,
  mountReasons: ['home_locality'],
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
  isMounted: true,
  isDiscoverable: false,
  mountReasons: ['personal_default'],
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
  assert.equal(getNexusSectionFromPathname('/nexus/identity/security'), 'account');
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

test('mounted followed scopes still render when their parent branch is not mounted', () => {
  const remoteScope: NexusScopeSummary = {
    ...LOCAL_SCOPE,
    id: 'sunnymead-ranch',
    packetId: 'nexus:element/sunnymead-ranch',
    name: 'Sunnymead Ranch',
    shortLabel: 'Sunnymead',
    level: 'district',
    parentId: 'unmounted-parent',
    childIds: [],
    isMounted: true,
    isDiscoverable: true,
    mountReasons: ['followed'],
  };
  const nodes = buildNexusBranchNodes([GLOBAL_SCOPE, remoteScope], 'global-commons', [
    'global-commons',
    'sunnymead-ranch',
  ]);
  const remoteNode = nodes.find((node) => node.scopeId === 'sunnymead-ranch');

  assert.ok(remoteNode);
  assert.equal(remoteNode?.depth, 0);
  assert.equal(remoteNode?.relationship, 'followed');
});

test('geographic tree excludes followed-only scopes but keeps followed home scopes', () => {
  assert.equal(
    isNexusGeographicTreeScope({
      mountReasons: ['followed'],
    }),
    false
  );
  assert.equal(
    isNexusGeographicTreeScope({
      mountReasons: ['home_ancestor', 'followed'],
    }),
    true
  );
});

test('scope selection routes wrapper-level account and identity pages back to trust', () => {
  assert.equal(getNexusScopeSelectionHref('/nexus/account'), '/nexus/trust');
  assert.equal(
    getNexusScopeSelectionHref('/nexus/identity/security'),
    '/nexus/trust'
  );
  assert.equal(getNexusScopeSelectionHref('/nexus/library'), null);
});

test('personal scope uses personal function labels and branch metadata', () => {
  assert.equal(getNexusSectionMenuTitle('dashboard', PERSONAL_SCOPE), 'Dashboard');
  assert.equal(getNexusSectionMenuDetail('trust', PERSONAL_SCOPE), 'Personal trust.');
  assert.equal(getNexusScopeLevelLabel('personal'), 'Personal branch');
  assert.ok(
    getNexusScopeDepthWidth('global') > getNexusScopeDepthWidth('district')
  );
  assert.ok(
    getNexusScopeDepthWidth('district') > getNexusScopeDepthWidth('personal')
  );
});

test('return destinations only accept in-app nexus paths', () => {
  assert.equal(resolveNexusReturnPath('/nexus/roles', '/nexus/account'), '/nexus/roles');
  assert.equal(
    resolveNexusReturnPath('https://example.com', '/nexus/account'),
    '/nexus/account'
  );
  assert.equal(
    resolveNexusReturnPath(['', '/nexus/trust'], '/nexus/account'),
    '/nexus/account'
  );
});
