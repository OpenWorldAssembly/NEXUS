/**
 * File: nexus-shell.ts
 * Description: Defines nexus shell types and helpers for route, scope, and guest state.
 */
export type NexusNavMode = 'function' | 'scope';
export type NexusThemeMode = 'dark' | 'light';
export type NexusUiDensity = 'small' | 'large';

export type NexusSection =
  | 'dashboard'
  | 'discussions'
  | 'votes'
  | 'roles'
  | 'trust'
  | 'library'
  | 'account';

export type NexusGuestCapability =
  | 'browse-public-scopes'
  | 'browse-public-packets'
  | 'post-visitor-lobby';

export type NexusScopeRelationship =
  | 'personal'
  | 'global'
  | 'parent'
  | 'current'
  | 'child'
  | 'followed';

export type NexusScopeMountReason =
  | 'global_default'
  | 'personal_default'
  | 'home_locality'
  | 'home_ancestor'
  | 'associated'
  | 'followed';

export type NexusScopeStructuralState =
  | 'canonical'
  | 'compatibility_parent'
  | 'conflicting_parents'
  | 'cyclic_ancestry'
  | 'missing_parent';

export type NexusScopeSummary = {
  id: string;
  packetId: string;
  name: string;
  shortLabel: string;
  level: 'personal' | 'global' | 'nation' | 'region' | 'city' | 'district';
  scopeSubtype: string | null;
  scopeSystem: string | null;
  description: string;
  localityLabel: string;
  badge: string;
  relationshipLabel: string;
  parentId?: string;
  childIds: string[];
  followedScopeIds: string[];
  isKnown: boolean;
  isMounted: boolean;
  isDiscoverable: boolean;
  isFollowed: boolean;
  isAssociated: boolean;
  isHomeAncestor: boolean;
  structuralState: NexusScopeStructuralState;
  associationKind: string | null;
  mountReasons: NexusScopeMountReason[];
  justificationPacketIds: string[];
  structuralRelationPacketIds: string[];
  locationPacketIds: string[];
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
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
  activeScopeId: string;
  expandedScopeIds: string[];
  activeSection: NexusSection;
  guestCapabilities: NexusGuestCapability[];
};

export const NEXUS_COLLAPSED_RAIL_WIDTH = 28;

export const NEXUS_RAIL_WIDTHS: Record<NexusUiDensity, number> = {
  small: 304,
  large: 352,
};

export const NEXUS_SECTION_ORDER: NexusSection[] = [
  'dashboard',
  'discussions',
  'votes',
  'roles',
  'trust',
  'library',
];

export const NEXUS_SECTION_LABELS: Record<NexusSection, string> = {
  dashboard: 'Dashboard',
  discussions: 'Discussions',
  votes: 'Votes',
  roles: 'Roles',
  trust: 'Trust',
  library: 'Library',
  account: 'Account',
};

/**
 * Inputs: a nexus pathname.
 * Output: whether the route is a wrapper-level account or identity surface.
 */
export function isWrapperLevelNexusPath(pathname: string): boolean {
  return pathname === '/nexus/account' || pathname.startsWith('/nexus/identity');
}

/**
 * Inputs: a route pathname string.
 * Output: the active nexus section represented by the pathname.
 */
export function getNexusSectionFromPathname(pathname: string): NexusSection {
  if (isWrapperLevelNexusPath(pathname)) {
    return 'account';
  }

  const section = pathname.replace('/nexus/', '').split('/')[0];
  const knownSections: NexusSection[] = [...NEXUS_SECTION_ORDER, 'account'];

  if (knownSections.includes(section as NexusSection)) {
    return section as NexusSection;
  }

  return 'dashboard';
}

/**
 * Inputs: the current pathname.
 * Output: the visible function route that should be shown after a scope change.
 */
export function getNexusScopeSelectionHref(pathname: string): `/nexus/${NexusSection}` | null {
  if (isWrapperLevelNexusPath(pathname)) {
    return '/nexus/trust';
  }

  return null;
}

/**
 * Inputs: a nexus section key.
 * Output: the route path for the requested section.
 */
export function getNexusSectionHref(section: NexusSection): `/nexus/${NexusSection}` {
  return `/nexus/${section}`;
}

/**
 * Inputs: a possible query-param-style route value.
 * Output: a normalized single string value or null when absent.
 */
export function normalizeNexusRouteParam(
  value: string | string[] | null | undefined
): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
}

/**
 * Inputs: a possible return path and a fallback nexus path.
 * Output: a safe in-app Nexus path for post-auth navigation.
 */
export function resolveNexusReturnPath(
  value: string | string[] | null | undefined,
  fallback: string
): string {
  const normalizedValue = normalizeNexusRouteParam(value);

  if (!normalizedValue || !normalizedValue.startsWith('/nexus/')) {
    return fallback;
  }

  return normalizedValue;
}

/**
 * Inputs: an active section and scope summary.
 * Output: the function-menu title appropriate for that scope lens.
 */
export function getNexusSectionMenuTitle(
  section: NexusSection,
  scope: Pick<NexusScopeSummary, 'level'>
): string {
  return NEXUS_SECTION_LABELS[section];
}

/**
 * Inputs: an active section and scope summary.
 * Output: supporting function-menu copy for that scope lens.
 */
export function getNexusSectionMenuDetail(
  section: NexusSection,
  scope: Pick<NexusScopeSummary, 'level' | 'shortLabel'>
): string {
  if (scope.level === 'personal') {
    return `Personal ${NEXUS_SECTION_LABELS[section].toLowerCase()}.`;
  }

  return `${NEXUS_SECTION_LABELS[section]} across ${scope.shortLabel}.`;
}

/**
 * Inputs: a scope level string.
 * Output: a human-readable label for the scope row metadata line.
 */
export function getNexusScopeLevelLabel(
  level: NexusScopeSummary['level']
): string {
  switch (level) {
    case 'personal':
      return 'Personal branch';
    case 'global':
      return 'Global branch';
    case 'nation':
      return 'National branch';
    case 'region':
      return 'Regional branch';
    case 'city':
      return 'City branch';
    case 'district':
      return 'District branch';
    default:
      return 'Scope branch';
  }
}

/**
 * Inputs: a scope level string.
 * Output: the semantic width used by scope-map depth graphics.
 */
export function getNexusScopeDepthWidth(
  level: NexusScopeSummary['level']
): number {
  switch (level) {
    case 'global':
      return 34;
    case 'nation':
      return 28;
    case 'region':
      return 22;
    case 'city':
      return 16;
    case 'district':
      return 10;
    case 'personal':
      return 6;
    default:
      return 14;
  }
}

/**
 * Inputs: a nexus UI density.
 * Output: the consistent width used by each open sidebar rail for that density.
 */
export function getNexusRailWidth(uiDensity: NexusUiDensity): number {
  return NEXUS_RAIL_WIDTHS[uiDensity];
}

/**
 * Inputs: one scope summary.
 * Output: whether it belongs in the main geographic scope tree.
 */
export function isNexusGeographicTreeScope(
  scope: Pick<NexusScopeSummary, 'mountReasons'>
): boolean {
  return scope.mountReasons.some((mountReason) =>
    [
      'global_default',
      'home_ancestor',
      'home_locality',
      'personal_default',
    ].includes(mountReason)
  );
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
  const rootScopes = scopes.filter(
    (scope) => !scope.parentId || !scopeMap[scope.parentId]
  );
  const nodes: NexusScopeBranchNode[] = [];

  const addNode = (scopeId: string, depth: number) => {
    const scope = scopeMap[scopeId];

    if (!scope) {
      return;
    }

    let relationship: NexusScopeRelationship = 'child';

    if (scope.level === 'personal') {
      relationship = 'personal';
    } else if (scope.mountReasons.includes('followed') && depth === 0) {
      relationship = 'followed';
    } else if (depth === 0) {
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
