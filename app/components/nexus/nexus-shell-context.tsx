/**
 * File: nexus-shell-context.tsx
 * Description: Shares the nexus shell state across all `/nexus/*` routes.
 */
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';

import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import {
  NEXUS_GUEST_CAPABILITIES,
} from '@runtime/nexus/nexus-content';
import { fetchNexusShellPayload } from '@runtime/nexus/nexus-query-api';
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
  type NexusThemeMode,
  type NexusUiDensity,
} from '@runtime/nexus/nexus-shell';

type NexusShellContextValue = NexusShellState & {
  activeScope: NexusScopeSummary;
  currentActorLabel: string;
  currentActorPacketId: string | null;
  currentIdentityMode: 'ephemeral_guest' | 'persistent_guest' | 'claimed' | null;
  branchNodes: NexusScopeBranchNode[];
  followedScopes: NexusScopeSummary[];
  scopeSummaries: NexusScopeSummary[];
  isPreferencesDrawerOpen: boolean;
  isPrimaryRailCollapsed: boolean;
  isSecondaryRailCollapsed: boolean;
  setNavigationMode: (mode: NexusNavMode) => void;
  setThemeMode: (mode: NexusThemeMode) => void;
  setUiDensity: (density: NexusUiDensity) => void;
  setActiveScopeId: (scopeId: string) => void;
  toggleScopeExpansion: (scopeId: string) => void;
  setActiveSection: (section: NexusSection) => void;
  refreshShellData: () => Promise<void>;
  togglePreferencesDrawer: () => void;
  togglePrimaryRailCollapsed: () => void;
  toggleSecondaryRailCollapsed: () => void;
  collapseOuterRail: () => void;
  expandInnerRail: () => void;
};

const NexusShellContext = createContext<NexusShellContextValue | null>(null);
const FALLBACK_SCOPE_SUMMARY: NexusScopeSummary = {
  id: 'global-commons',
  name: 'Global Commons',
  shortLabel: 'Global',
  level: 'global',
  description:
    'Packet-backed scope data is loading. This temporary context keeps the shell stable.',
  localityLabel: 'Global',
  badge: 'Guest default',
  relationshipLabel: 'Root assembly scope',
  childIds: [],
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

/**
 * Inputs: nexus route children.
 * Output: a provider that keeps the scope navigation and menu preference state in sync.
 */
export function NexusShellProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    currentActorPacketId,
    currentLabel,
    currentMode,
  } = useIdentityShell();
  const [scopeSummaries, setScopeSummaries] = useState<NexusScopeSummary[]>([
    FALLBACK_SCOPE_SUMMARY,
  ]);
  const [followedScopeIds, setFollowedScopeIds] = useState<string[]>([]);
  const [guestCapabilities, setGuestCapabilities] = useState(
    NEXUS_GUEST_CAPABILITIES,
  );
  const [navigationMode, setNavigationMode] = useState<NexusNavMode>('function');
  const [themeMode, setThemeMode] = useState<NexusThemeMode>('dark');
  const [uiDensity, setUiDensity] = useState<NexusUiDensity>('small');
  const [activeScopeId, setActiveScopeIdState] = useState(
    FALLBACK_SCOPE_SUMMARY.id,
  );
  const [expandedScopeIds, setExpandedScopeIds] = useState(
    [FALLBACK_SCOPE_SUMMARY.id],
  );
  const [isPreferencesDrawerOpen, setIsPreferencesDrawerOpen] = useState(false);
  const [isPrimaryRailCollapsed, setIsPrimaryRailCollapsed] = useState(false);
  const [isSecondaryRailCollapsed, setIsSecondaryRailCollapsed] = useState(false);

  const activeSection = getNexusSectionFromPathname(pathname);
  const activeScope =
    scopeSummaries.find((scope) => scope.id === activeScopeId) ??
    scopeSummaries[0];
  const branchNodes = buildNexusBranchNodes(
    scopeSummaries,
    activeScope.id,
    expandedScopeIds,
  );
  const followedScopes = scopeSummaries.filter((scope) =>
    followedScopeIds.includes(scope.id),
  );

  const refreshShellData = async () => {
    const shellPayload = await fetchNexusShellPayload();

    if (shellPayload.scope_summaries.length === 0) {
      return;
    }

    setScopeSummaries(shellPayload.scope_summaries);
    setFollowedScopeIds(shellPayload.followed_scope_ids);
    setGuestCapabilities(shellPayload.guest_capabilities);
    setActiveScopeIdState((currentScopeId) =>
      shellPayload.scope_summaries.some(
        (scopeSummary) => scopeSummary.id === currentScopeId,
      )
        ? currentScopeId
        : shellPayload.default_scope_id,
    );
    setExpandedScopeIds((currentExpandedScopeIds) => {
      const currentScopeIds = currentExpandedScopeIds.filter((scopeId) =>
        shellPayload.scope_summaries.some(
          (scopeSummary) => scopeSummary.id === scopeId,
        ),
      );

      return Array.from(
        new Set([
          ...shellPayload.default_expanded_scope_ids,
          ...currentScopeIds,
        ]),
      );
    });
  };

  useEffect(() => {
    let isMounted = true;

    const loadShellPayload = async () => {
      try {
        await refreshShellData();

        if (!isMounted) {
          return;
        }
      } catch {
        // Keep the fallback scope model when the shell API is unavailable.
      }
    };

    void loadShellPayload();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Inputs: a new scope id.
   * Output: updates the active scope and ensures the scope lineage remains expanded.
   */
  const setActiveScopeId = (scopeId: string) => {
    const lineageIds = getNexusAncestorIds(scopeSummaries, scopeId);

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
   * Output: toggles the guest preference drawer open state.
   */
  const togglePreferencesDrawer = () => {
    setIsPreferencesDrawerOpen((currentValue) => !currentValue);
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
        themeMode,
        uiDensity,
        activeScopeId: activeScope.id,
        expandedScopeIds,
        activeSection,
        guestCapabilities,
        activeScope,
        currentActorLabel: currentLabel,
        currentActorPacketId,
        currentIdentityMode: currentMode,
        branchNodes,
        followedScopes,
        scopeSummaries,
        isPreferencesDrawerOpen,
        isPrimaryRailCollapsed,
        isSecondaryRailCollapsed,
        setNavigationMode,
        setThemeMode,
        setUiDensity,
        setActiveScopeId,
        toggleScopeExpansion,
        setActiveSection,
        refreshShellData,
        togglePreferencesDrawer,
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
