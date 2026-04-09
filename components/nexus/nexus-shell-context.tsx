/**
 * File: nexus-shell-context.tsx
 * Description: Shares the nexus shell state across all `/nexus/*` routes.
 */
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';

import {
  nexusDefaultExpandedScopeIds,
  nexusDefaultScopeId,
  nexusFollowedScopeIds,
  nexusGuestCapabilities,
  nexusScopeSummaries,
} from '@/data/nexus/mock-nexus-data';
import {
  buildNexusBranchNodes,
  getNexusAncestorIds,
  getNexusSectionFromPathname,
  getNexusSectionHref,
  type NexusNavMode,
  type NexusScopeBranchNode,
  type NexusScopeSummary,
  type NexusSection,
  type NexusShellState,
} from '@/lib/nexus/nexus-shell';

type NexusShellContextValue = NexusShellState & {
  activeScope: NexusScopeSummary;
  branchNodes: NexusScopeBranchNode[];
  followedScopes: NexusScopeSummary[];
  scopeSummaries: NexusScopeSummary[];
  isPrimaryRailCollapsed: boolean;
  isSecondaryRailCollapsed: boolean;
  setNavigationMode: (mode: NexusNavMode) => void;
  setActiveScopeId: (scopeId: string) => void;
  toggleScopeExpansion: (scopeId: string) => void;
  setActiveSection: (section: NexusSection) => void;
  togglePrimaryRailCollapsed: () => void;
  toggleSecondaryRailCollapsed: () => void;
  collapseOuterRail: () => void;
  expandInnerRail: () => void;
};

const NexusShellContext = createContext<NexusShellContextValue | null>(null);

/**
 * Inputs: nexus route children.
 * Output: a provider that keeps the scope navigation and menu preference state in sync.
 */
export function NexusShellProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const [navigationMode, setNavigationMode] = useState<NexusNavMode>('function');
  const [activeScopeId, setActiveScopeIdState] = useState(nexusDefaultScopeId);
  const [expandedScopeIds, setExpandedScopeIds] = useState(
    nexusDefaultExpandedScopeIds,
  );
  const [isPrimaryRailCollapsed, setIsPrimaryRailCollapsed] = useState(false);
  const [isSecondaryRailCollapsed, setIsSecondaryRailCollapsed] = useState(false);

  const activeSection = getNexusSectionFromPathname(pathname);
  const activeScope =
    nexusScopeSummaries.find((scope) => scope.id === activeScopeId) ??
    nexusScopeSummaries[0];
  const branchNodes = buildNexusBranchNodes(
    nexusScopeSummaries,
    activeScope.id,
    expandedScopeIds,
  );
  const followedScopes = nexusScopeSummaries.filter((scope) =>
    nexusFollowedScopeIds.includes(scope.id),
  );

  /**
   * Inputs: a new scope id.
   * Output: updates the active scope and ensures the scope lineage remains expanded.
   */
  const setActiveScopeId = (scopeId: string) => {
    const lineageIds = getNexusAncestorIds(nexusScopeSummaries, scopeId);

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
   * Inputs: a nexus section key.
   * Output: pushes the route that corresponds to the requested section.
   */
  const setActiveSection = (section: NexusSection) => {
    router.push(getNexusSectionHref(section));
  };

  /**
   * Inputs: none.
   * Output: toggles the primary rail open state while preserving the secondary preference.
   */
  const togglePrimaryRailCollapsed = () => {
    setIsPrimaryRailCollapsed((currentValue) => !currentValue);
  };

  /**
   * Inputs: none.
   * Output: toggles the secondary rail open state.
   */
  const toggleSecondaryRailCollapsed = () => {
    setIsSecondaryRailCollapsed((currentValue) => !currentValue);
  };

  /**
   * Inputs: none.
   * Output: collapses the outer-most visible rail first, then the primary rail.
   */
  const collapseOuterRail = () => {
    if (!isSecondaryRailCollapsed) {
      setIsSecondaryRailCollapsed(true);
      return;
    }

    if (!isPrimaryRailCollapsed) {
      setIsPrimaryRailCollapsed(true);
    }
  };

  /**
   * Inputs: none.
   * Output: expands the primary rail first, then the secondary rail.
   */
  const expandInnerRail = () => {
    if (isPrimaryRailCollapsed) {
      setIsPrimaryRailCollapsed(false);
      return;
    }

    if (isSecondaryRailCollapsed) {
      setIsSecondaryRailCollapsed(false);
    }
  };

  return (
    <NexusShellContext.Provider
      value={{
        navigationMode,
        activeScopeId: activeScope.id,
        expandedScopeIds,
        activeSection,
        guestCapabilities: nexusGuestCapabilities,
        activeScope,
        branchNodes,
        followedScopes,
        scopeSummaries: nexusScopeSummaries,
        isPrimaryRailCollapsed,
        isSecondaryRailCollapsed,
        setNavigationMode,
        setActiveScopeId,
        toggleScopeExpansion,
        setActiveSection,
        togglePrimaryRailCollapsed,
        toggleSecondaryRailCollapsed,
        collapseOuterRail,
        expandInnerRail,
      }}
    >
      {children}
    </NexusShellContext.Provider>
  );
}

/**
 * Inputs: none.
 * Output: the current shared nexus shell state and actions.
 */
export function useNexusShell(): NexusShellContextValue {
  const context = useContext(NexusShellContext);

  if (!context) {
    throw new Error('useNexusShell must be used inside NexusShellProvider.');
  }

  return context;
}
