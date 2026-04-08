/**
 * File: portal-shell-context.tsx
 * Description: Shares the portal shell state across all `/portal/*` routes.
 */
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';

import {
  portalDefaultExpandedScopeIds,
  portalDefaultScopeId,
  portalFollowedScopeIds,
  portalGuestCapabilities,
  portalScopeSummaries,
} from '@/data/portal/mock-portal-data';
import {
  buildPortalBranchNodes,
  getPortalAncestorIds,
  getPortalSectionFromPathname,
  getPortalSectionHref,
  type PortalNavMode,
  type PortalScopeBranchNode,
  type PortalScopeSummary,
  type PortalSection,
  type PortalShellState,
} from '@/lib/portal/portal-shell';

type PortalShellContextValue = PortalShellState & {
  activeScope: PortalScopeSummary;
  branchNodes: PortalScopeBranchNode[];
  followedScopes: PortalScopeSummary[];
  scopeSummaries: PortalScopeSummary[];
  setNavigationMode: (mode: PortalNavMode) => void;
  setActiveScopeId: (scopeId: string) => void;
  toggleScopeExpansion: (scopeId: string) => void;
  setActiveSection: (section: PortalSection) => void;
};

const PortalShellContext = createContext<PortalShellContextValue | null>(null);

/**
 * Inputs: portal route children.
 * Output: a provider that keeps the scope tree and navigation mode state in sync.
 */
export function PortalShellProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const [navigationMode, setNavigationMode] = useState<PortalNavMode>('function');
  const [activeScopeId, setActiveScopeIdState] = useState(portalDefaultScopeId);
  const [expandedScopeIds, setExpandedScopeIds] = useState(
    portalDefaultExpandedScopeIds,
  );

  const activeSection = getPortalSectionFromPathname(pathname);
  const activeScope =
    portalScopeSummaries.find((scope) => scope.id === activeScopeId) ??
    portalScopeSummaries[0];
  const branchNodes = buildPortalBranchNodes(
    portalScopeSummaries,
    activeScope.id,
    expandedScopeIds,
  );
  const followedScopes = portalScopeSummaries.filter((scope) =>
    portalFollowedScopeIds.includes(scope.id),
  );

  /**
   * Inputs: a new scope id.
   * Output: updates the active scope and ensures the scope lineage remains expanded.
   */
  const setActiveScopeId = (scopeId: string) => {
    const lineageIds = getPortalAncestorIds(portalScopeSummaries, scopeId);

    setActiveScopeIdState(scopeId);
    setExpandedScopeIds((currentIds) =>
      Array.from(new Set([...currentIds, ...lineageIds, scopeId])),
    );
  };

  /**
   * Inputs: a scope id.
   * Output: toggles the visibility of that scope inside the branch tree.
   */
  const toggleScopeExpansion = (scopeId: string) => {
    setExpandedScopeIds((currentIds) =>
      currentIds.includes(scopeId)
        ? currentIds.filter((currentId) => currentId !== scopeId)
        : [...currentIds, scopeId],
    );
  };

  /**
   * Inputs: a portal section key.
   * Output: pushes the route that corresponds to the requested section.
   */
  const setActiveSection = (section: PortalSection) => {
    router.push(getPortalSectionHref(section));
  };

  return (
    <PortalShellContext.Provider
      value={{
        navigationMode,
        activeScopeId: activeScope.id,
        expandedScopeIds,
        activeSection,
        guestCapabilities: portalGuestCapabilities,
        activeScope,
        branchNodes,
        followedScopes,
        scopeSummaries: portalScopeSummaries,
        setNavigationMode,
        setActiveScopeId,
        toggleScopeExpansion,
        setActiveSection,
      }}
    >
      {children}
    </PortalShellContext.Provider>
  );
}

/**
 * Inputs: none.
 * Output: the current shared portal shell state and actions.
 */
export function usePortalShell(): PortalShellContextValue {
  const context = useContext(PortalShellContext);

  if (!context) {
    throw new Error('usePortalShell must be used inside PortalShellProvider.');
  }

  return context;
}
