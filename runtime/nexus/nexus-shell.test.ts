import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNexusHomeScopeIds,
  buildNexusBranchNodes,
  buildNexusProjectedScopeSection,
  buildNexusScopeSidebarSections,
  getNexusScopeDepthWidth,
  getNexusScopeLevelGroupLabel,
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
  scopeSubtype: 'assembly.global',
  scopeSystem: 'geographic',
  structuralState: 'canonical',
  description: 'Global scope.',
  localityLabel: 'Global',
  badge: 'Root',
  relationshipLabel: 'Root assembly scope',
  childIds: ['moreno-valley'],
  followedScopeIds: [],
  isKnown: true,
  isMounted: true,
  isDiscoverable: true,
  isFollowed: false,
  isAssociated: false,
  isHomeAncestor: false,
  associationKind: null,
  mountReasons: ['global_default'],
  justificationPacketIds: [],
  structuralRelationPacketIds: [],
  locationPacketIds: [],
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
  scopeSubtype: 'assembly.city',
  scopeSystem: 'geographic',
  structuralState: 'canonical',
  description: 'Local scope.',
  localityLabel: 'Moreno Valley',
  badge: 'Assembly',
  relationshipLabel: 'Child of Global Commons',
  parentId: 'global-commons',
  childIds: ['you'],
  followedScopeIds: [],
  isKnown: true,
  isMounted: true,
  isDiscoverable: true,
  isFollowed: false,
  isAssociated: false,
  isHomeAncestor: false,
  associationKind: null,
  mountReasons: ['home_locality'],
  justificationPacketIds: [],
  structuralRelationPacketIds: [],
  locationPacketIds: [],
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
  scopeSubtype: null,
  scopeSystem: null,
  structuralState: 'canonical',
  description: 'Personal scope.',
  localityLabel: 'Current actor',
  badge: 'Claimed actor',
  relationshipLabel: 'Current actor scope',
  parentId: 'moreno-valley',
  childIds: [],
  followedScopeIds: [],
  isKnown: true,
  isMounted: true,
  isDiscoverable: false,
  isFollowed: false,
  isAssociated: false,
  isHomeAncestor: false,
  associationKind: null,
  mountReasons: ['personal_default'],
  justificationPacketIds: [],
  structuralRelationPacketIds: [],
  locationPacketIds: [],
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

test('associated mount reasons stay mounted without joining the geographic tree trunk', () => {
  assert.equal(
    isNexusGeographicTreeScope({
      mountReasons: ['associated'],
    }),
    false
  );
});

test('home scope ids are ordered from broadest geography toward the personal root', () => {
  assert.deepEqual(buildNexusHomeScopeIds([GLOBAL_SCOPE, LOCAL_SCOPE, PERSONAL_SCOPE]), [
    'global-commons',
    'moreno-valley',
    'you',
  ]);
});

test('sidebar sections allow associate and follow overlap while discoverable stays deduped', () => {
  const associatedScope: NexusScopeSummary = {
    ...LOCAL_SCOPE,
    id: 'canyon-lake',
    packetId: 'nexus:element/canyon-lake',
    name: 'Canyon Lake',
    shortLabel: 'CL',
    level: 'city',
    parentId: undefined,
    childIds: [],
    isMounted: true,
    isDiscoverable: true,
    isAssociated: true,
    isFollowed: true,
    associationKind: 'canonical_relation_assertion',
    mountReasons: ['associated', 'followed'],
  };
  const followedScope: NexusScopeSummary = {
    ...LOCAL_SCOPE,
    id: 'sunnymead-ranch',
    packetId: 'nexus:element/sunnymead-ranch',
    name: 'Sunnymead Ranch',
    shortLabel: 'Sunnymead',
    level: 'district',
    parentId: undefined,
    childIds: [],
    isMounted: true,
    isDiscoverable: true,
    isFollowed: true,
    mountReasons: ['followed'],
  };
  const discoverableScope: NexusScopeSummary = {
    ...LOCAL_SCOPE,
    id: 'riverside-county',
    packetId: 'nexus:element/riverside-county',
    name: 'Riverside County',
    shortLabel: 'County',
    level: 'region',
    parentId: undefined,
    childIds: [],
    isMounted: false,
    isDiscoverable: true,
    mountReasons: [],
  };
  const sections = buildNexusScopeSidebarSections({
    scopeSummaries: [
      GLOBAL_SCOPE,
      LOCAL_SCOPE,
      PERSONAL_SCOPE,
      associatedScope,
      followedScope,
      discoverableScope,
    ],
    homeScopeIds: buildNexusHomeScopeIds([GLOBAL_SCOPE, LOCAL_SCOPE, PERSONAL_SCOPE]),
  });
  const associatedSection = sections.find((section) => section.id === 'associated');
  const followedSection = sections.find((section) => section.id === 'followed');
  const discoverableSection = sections.find(
    (section) => section.id === 'discoverable'
  );

  assert.deepEqual(
    sections.find((section) => section.id === 'home')?.scopes.map((scope) => scope.id),
    ['global-commons', 'moreno-valley', 'you']
  );
  assert.deepEqual(
    associatedSection?.scopes.map((scope) => scope.id),
    ['canyon-lake']
  );
  assert.deepEqual(
    followedSection?.scopes.map((scope) => scope.id),
    ['canyon-lake', 'sunnymead-ranch']
  );
  assert.deepEqual(
    discoverableSection?.scopes.map((scope) => scope.id),
    ['riverside-county']
  );
  assert.equal(associatedSection?.groups[0]?.title, 'City');
  assert.deepEqual(
    followedSection?.groups.map((group) => group.title),
    ['City', 'District']
  );
  assert.equal(getNexusScopeLevelGroupLabel('global'), 'Global');
});

test('projected scope sections group by descriptor label and keep lightweight parent chains', () => {
  const associatedScope: NexusScopeSummary = {
    ...LOCAL_SCOPE,
    id: 'canyon-lake',
    packetId: 'nexus:element/canyon-lake',
    name: 'Canyon Lake',
    shortLabel: 'CL',
    level: 'city',
    parentId: 'global-commons',
    childIds: [],
    isMounted: true,
    isDiscoverable: true,
    isAssociated: true,
    scopeTypeLabel: 'City / Town / Village',
    mountReasons: ['associated'],
  };
  const projectedSection = buildNexusProjectedScopeSection({
    id: 'associated',
    title: 'Associated scopes',
    scopeSummaries: [GLOBAL_SCOPE, associatedScope],
    directScopeIds: ['canyon-lake'],
    showParentChains: true,
  });

  assert.equal(projectedSection.groups[0]?.title, 'City / Town / Village');
  assert.equal(projectedSection.groups[0]?.rows[0]?.scopeId, 'canyon-lake');
  assert.equal(
    projectedSection.groups[0]?.rows[0]?.parentChainPath,
    'Global Commons'
  );
});

test('projected main sections dedupe overlapping relation ids', () => {
  const bothRelationScope: NexusScopeSummary = {
    ...LOCAL_SCOPE,
    id: 'canyon-lake',
    packetId: 'nexus:element/canyon-lake',
    name: 'Canyon Lake',
    shortLabel: 'CL',
    level: 'city',
    parentId: 'global-commons',
    childIds: [],
    isMounted: true,
    isDiscoverable: true,
    isAssociated: true,
    isFollowed: true,
    associationKind: 'canonical_relation_assertion',
    mountReasons: ['associated', 'followed'],
  };
  const projectedSection = buildNexusProjectedScopeSection({
    id: 'main',
    title: 'Main tree',
    scopeSummaries: [GLOBAL_SCOPE, bothRelationScope],
    directScopeIds: ['canyon-lake', 'canyon-lake'],
    showParentChains: true,
  });

  assert.equal(projectedSection.count, 1);
  assert.deepEqual(
    projectedSection.groups.flatMap((group) => group.rows.map((row) => row.scopeId)),
    ['canyon-lake']
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

