/**
 * File: nexus-shell.ts
 * Description: Defines nexus shell types and helpers for route, scope, and guest state.
 */
export type NexusNavMode = 'function' | 'scope';

export type NexusSection =
  | 'dashboard'
  | 'discussions'
  | 'votes'
  | 'library'
  | 'account';

export type NexusGuestCapability =
  | 'browse-public-scopes'
  | 'browse-public-packets'
  | 'post-visitor-lobby';

export type NexusScopeRelationship =
  | 'global'
  | 'parent'
  | 'current'
  | 'child'
  | 'followed';

export type NexusScopeSummary = {
  id: string;
  name: string;
  shortLabel: string;
  level: 'global' | 'nation' | 'region' | 'city' | 'district';
  description: string;
  localityLabel: string;
  badge: string;
  relationshipLabel: string;
  parentId?: string;
  childIds: string[];
  followedScopeIds: string[];
  publicLobbyLabel: string;
  stats: {
    members: number;
    activeVotes: number;
    hotDiscussions: number;
    missions: number;
    guestLobbyOpen: boolean;
  };
};

export type NexusScopeBranchNode = {
  scopeId: string;
  relationship: NexusScopeRelationship;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
};

export type NexusShellState = {
  navigationMode: NexusNavMode;
  activeScopeId: string;
  expandedScopeIds: string[];
  activeSection: NexusSection;
  guestCapabilities: NexusGuestCapability[];
};

export const NEXUS_SECTION_ORDER: NexusSection[] = [
  'dashboard',
  'discussions',
  'votes',
  'library',
  'account',
];

export const NEXUS_SECTION_LABELS: Record<NexusSection, string> = {
  dashboard: 'Dashboard',
  discussions: 'Discussions',
  votes: 'Votes',
  library: 'Library',
  account: 'Account',
};

/**
 * Inputs: a route pathname string.
 * Output: the active nexus section represented by the pathname.
 */
export function getNexusSectionFromPathname(pathname: string): NexusSection {
  const section = pathname.replace('/nexus/', '').split('/')[0];

  if (NEXUS_SECTION_ORDER.includes(section as NexusSection)) {
    return section as NexusSection;
  }

  return 'dashboard';
}

/**
 * Inputs: a nexus section key.
 * Output: the route path for the requested section.
 */
export function getNexusSectionHref(section: NexusSection): `/nexus/${NexusSection}` {
  return `/nexus/${section}`;
}

/**
 * Inputs: a list of scope ids on an item and the currently selected scope id.
 * Output: whether the item should be visible inside the active scope lens.
 */
export function matchesScope(scopeIds: string[], activeScopeId: string): boolean {
  return scopeIds.includes('global-commons') || scopeIds.includes(activeScopeId);
}

/**
 * Inputs: all known scopes and a target scope id.
 * Output: ordered ancestor ids from the root scope to the parent of the target.
 */
export function getNexusAncestorIds(
  scopes: NexusScopeSummary[],
  scopeId: string,
): string[] {
  const ancestors: string[] = [];
  let currentScope = scopes.find((scope) => scope.id === scopeId);

  while (currentScope?.parentId) {
    ancestors.unshift(currentScope.parentId);
    currentScope = scopes.find((scope) => scope.id === currentScope?.parentId);
  }

  return ancestors;
}

/**
 * Inputs: scope summaries, the active scope id, and any expanded scope ids.
 * Output: the visible branch tree nodes for the persistent scope viewer.
 */
export function buildNexusBranchNodes(
  scopes: NexusScopeSummary[],
  activeScopeId: string,
  expandedScopeIds: string[],
): NexusScopeBranchNode[] {
  const scopeMap = Object.fromEntries(scopes.map((scope) => [scope.id, scope]));
  const lineageIds = new Set([
    ...getNexusAncestorIds(scopes, activeScopeId),
    activeScopeId,
  ]);
  const expandedSet = new Set([
    ...expandedScopeIds,
    ...Array.from(lineageIds),
  ]);
  const rootScopes = scopes.filter((scope) => !scope.parentId);
  const nodes: NexusScopeBranchNode[] = [];

  const addNode = (scopeId: string, depth: number) => {
    const scope = scopeMap[scopeId];

    if (!scope) {
      return;
    }

    let relationship: NexusScopeRelationship = 'child';

    if (depth === 0) {
      relationship = 'global';
    } else if (scopeId === activeScopeId) {
      relationship = 'current';
    } else if (lineageIds.has(scopeId)) {
      relationship = 'parent';
    }

    nodes.push({
      scopeId,
      relationship,
      depth,
      isExpanded: expandedSet.has(scopeId),
      hasChildren: scope.childIds.length > 0,
    });

    if (!expandedSet.has(scopeId)) {
      return;
    }

    scope.childIds.forEach((childId) => addNode(childId, depth + 1));
  };

  rootScopes.forEach((scope) => addNode(scope.id, 0));

  return nodes;
}
