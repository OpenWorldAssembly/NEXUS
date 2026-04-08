/**
 * File: portal-shell.ts
 * Description: Defines portal shell types and helpers for route, scope, and guest state.
 */
export type PortalNavMode = 'function' | 'scope';

export type PortalSection =
  | 'dashboard'
  | 'discussions'
  | 'votes'
  | 'library'
  | 'account';

export type PortalGuestCapability =
  | 'browse-public-scopes'
  | 'browse-public-packets'
  | 'post-visitor-lobby';

export type PortalScopeRelationship =
  | 'global'
  | 'parent'
  | 'current'
  | 'child'
  | 'followed';

export type PortalScopeSummary = {
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

export type PortalScopeBranchNode = {
  scopeId: string;
  relationship: PortalScopeRelationship;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
};

export type PortalShellState = {
  navigationMode: PortalNavMode;
  activeScopeId: string;
  expandedScopeIds: string[];
  activeSection: PortalSection;
  guestCapabilities: PortalGuestCapability[];
};

export const PORTAL_SECTION_ORDER: PortalSection[] = [
  'dashboard',
  'discussions',
  'votes',
  'library',
  'account',
];

export const PORTAL_SECTION_LABELS: Record<PortalSection, string> = {
  dashboard: 'Dashboard',
  discussions: 'Discussions',
  votes: 'Votes',
  library: 'Library',
  account: 'Account',
};

/**
 * Inputs: a route pathname string.
 * Output: the active portal section represented by the pathname.
 */
export function getPortalSectionFromPathname(pathname: string): PortalSection {
  const section = pathname.replace('/portal/', '').split('/')[0];

  if (PORTAL_SECTION_ORDER.includes(section as PortalSection)) {
    return section as PortalSection;
  }

  return 'dashboard';
}

/**
 * Inputs: a portal section key.
 * Output: the route path for the requested section.
 */
export function getPortalSectionHref(section: PortalSection): `/portal/${PortalSection}` {
  return `/portal/${section}`;
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
export function getPortalAncestorIds(
  scopes: PortalScopeSummary[],
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
export function buildPortalBranchNodes(
  scopes: PortalScopeSummary[],
  activeScopeId: string,
  expandedScopeIds: string[],
): PortalScopeBranchNode[] {
  const scopeMap = Object.fromEntries(scopes.map((scope) => [scope.id, scope]));
  const lineageIds = new Set([
    ...getPortalAncestorIds(scopes, activeScopeId),
    activeScopeId,
  ]);
  const expandedSet = new Set([
    ...expandedScopeIds,
    ...Array.from(lineageIds),
  ]);
  const rootScopes = scopes.filter((scope) => !scope.parentId);
  const nodes: PortalScopeBranchNode[] = [];

  const addNode = (scopeId: string, depth: number) => {
    const scope = scopeMap[scopeId];

    if (!scope) {
      return;
    }

    let relationship: PortalScopeRelationship = 'child';

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
