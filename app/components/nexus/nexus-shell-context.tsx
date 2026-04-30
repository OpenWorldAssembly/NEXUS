/**
 * File: nexus-shell-context.tsx
 * Description: Shares the nexus shell state across all `/nexus/*` routes.
 */
import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';

import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import type {
  PacketExplorerSession,
  PacketExplorerTab,
  PacketExplorerPrimaryTab,
  PacketExplorerViewMode,
} from '@runtime/nexus/packet-explorer-session';
import {
  closePacketExplorer,
  closePacketExplorerTabs,
  closePacketExplorerTab,
  focusPacketExplorerTab,
  openPacketExplorerHome,
  openPacketExplorerPacket,
  persistPacketExplorerSession,
  readPacketExplorerSession,
  retargetActivePacketExplorerTab,
  setPacketExplorerPanelWidth,
  setPacketExplorerPrimaryTab,
  setPacketExplorerTabViewMode,
} from '@runtime/nexus/packet-explorer-session';
import {
  NEXUS_GUEST_CAPABILITIES,
} from '@runtime/nexus/nexus-content';
import {
  fetchNexusShellPayload,
  setNexusScopeFollowPreference,
} from '@runtime/nexus/nexus-query-api';
import {
  buildNexusBranchNodes,
  getNexusScopeSelectionHref,
  getNexusAncestorIds,
  getNexusSectionFromPathname,
  getNexusSectionHref,
  isNexusGeographicTreeScope,
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
  discoverableScopes: NexusScopeSummary[];
  followedScopes: NexusScopeSummary[];
  scopeSummaries: NexusScopeSummary[];
  isPreferencesDrawerOpen: boolean;
  isPrimaryRailCollapsed: boolean;
  isSecondaryRailCollapsed: boolean;
  packetExplorerSession: PacketExplorerSession;
  setNavigationMode: (mode: NexusNavMode) => void;
  setThemeMode: (mode: NexusThemeMode) => void;
  setUiDensity: (density: NexusUiDensity) => void;
  setActiveScopeId: (scopeId: string) => void;
  toggleScopeExpansion: (scopeId: string) => void;
  setActiveSection: (section: NexusSection) => void;
  setScopeFollowed: (scopeId: string, isFollowed: boolean) => Promise<void>;
  refreshShellData: () => Promise<void>;
  togglePreferencesDrawer: () => void;
  togglePrimaryRailCollapsed: () => void;
  toggleSecondaryRailCollapsed: () => void;
  collapseOuterRail: () => void;
  expandInnerRail: () => void;
  openExplorer: () => void;
  openPacketInExplorer: (input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      family: string | null;
      summary: string | null;
      label: string | null;
    } | null;
  }) => void;
  focusExplorerTab: (tabId: string) => void;
  closeExplorer: () => void;
  closeExplorerTabs: () => void;
  closeExplorerTab: (tabId: string) => void;
  retargetActiveExplorerPacket: (input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      family: string | null;
      summary: string | null;
      label: string | null;
    } | null;
  }) => void;
  setExplorerTabViewMode: (input: {
    tabId: string;
    viewMode: PacketExplorerViewMode;
  }) => void;
  setExplorerPrimaryTab: (input: {
    tabId: string;
    primaryTab: PacketExplorerPrimaryTab;
  }) => void;
  setExplorerPanelWidth: (panelWidth: number | null) => void;
  getActiveExplorerTab: () => PacketExplorerTab | null;
};

const NexusShellContext = createContext<NexusShellContextValue | null>(null);
const FALLBACK_SCOPE_SUMMARY: NexusScopeSummary = {
  id: 'global-commons',
  packetId: 'nexus:element/global-commons',
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

function buildPersonalScopeSummary(input: {
  actorPacketId: string;
  currentLabel: string;
  currentMode: 'ephemeral_guest' | 'persistent_guest' | 'claimed' | null;
  parentScopeId?: string | null;
}): NexusScopeSummary {
  return {
    id: 'you',
    packetId: input.actorPacketId,
    name: 'You',
    shortLabel: 'You',
    level: 'personal',
    description:
      'Personal scope lens anchored to the current actor packet and used across every Nexus function.',
    localityLabel: input.currentLabel,
    badge: input.currentMode === 'claimed' ? 'Claimed actor' : 'Guest actor',
    relationshipLabel: 'Current actor scope',
    parentId: input.parentScopeId ?? undefined,
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
}

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
  const [packetExplorerSession, setPacketExplorerSession] =
    useState<PacketExplorerSession>(() => readPacketExplorerSession());

  const activeSection = getNexusSectionFromPathname(pathname);
  const activeScope =
    scopeSummaries.find((scope) => scope.id === activeScopeId) ??
    scopeSummaries[0];
  const branchNodes = buildNexusBranchNodes(
    scopeSummaries.filter(
      (scope) => scope.isMounted && isNexusGeographicTreeScope(scope),
    ),
    activeScope.id,
    expandedScopeIds,
  );
  const discoverableScopes = scopeSummaries.filter(
    (scope) => scope.isDiscoverable && !scope.isMounted
  );
  const followedScopes = scopeSummaries.filter((scope) =>
    followedScopeIds.includes(scope.id),
  );

  const refreshShellData = useCallback(async () => {
    const shellPayload = await fetchNexusShellPayload({
      actorPacketId: currentActorPacketId,
    });

    if (shellPayload.scope_summaries.length === 0) {
      return;
    }

    const baseScopeSummaries = shellPayload.scope_summaries;
    const nextScopeSummaries =
      currentActorPacketId !== null
        ? (() => {
            const personalParentScopeId =
              shellPayload.personal_parent_scope_id ?? shellPayload.default_scope_id;
            const personalScopeSummary = buildPersonalScopeSummary({
              actorPacketId: currentActorPacketId,
              currentLabel,
              currentMode,
              parentScopeId: personalParentScopeId,
            });

            return [
              ...baseScopeSummaries.map((scopeSummary) =>
                scopeSummary.id === personalParentScopeId
                  ? {
                      ...scopeSummary,
                      childIds: Array.from(
                        new Set([...scopeSummary.childIds, personalScopeSummary.id])
                      ),
                    }
                  : scopeSummary
              ),
              personalScopeSummary,
            ];
          })()
        : baseScopeSummaries;

    setScopeSummaries(nextScopeSummaries);
    setFollowedScopeIds(shellPayload.followed_scope_ids);
    setGuestCapabilities(shellPayload.guest_capabilities);
    setActiveScopeIdState((currentScopeId) => {
      const currentScope = nextScopeSummaries.find(
        (scopeSummary) => scopeSummary.id === currentScopeId
      );

      return currentScope?.isMounted ? currentScopeId : shellPayload.default_scope_id;
    });
    setExpandedScopeIds((currentExpandedScopeIds) => {
      const currentScopeIds = currentExpandedScopeIds.filter((scopeId) =>
        nextScopeSummaries.some(
          (scopeSummary) => scopeSummary.id === scopeId,
        ),
      );

      return Array.from(
        new Set([
          ...shellPayload.default_expanded_scope_ids,
          ...currentScopeIds,
          ...(currentActorPacketId ? ['you'] : []),
        ]),
      );
    });
  }, [currentActorPacketId, currentLabel, currentMode]);

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
  }, [refreshShellData]);

  useEffect(() => {
    persistPacketExplorerSession(packetExplorerSession);
  }, [packetExplorerSession]);

  /**
   * Inputs: a new scope id.
   * Output: updates the active scope and ensures the scope lineage remains expanded.
   */
  const setActiveScopeId = (scopeId: string) => {
    const lineageIds = getNexusAncestorIds(scopeSummaries, scopeId);
    const nextVisibleHref = getNexusScopeSelectionHref(pathname);

    setActiveScopeIdState(scopeId);
    setExpandedScopeIds((currentIds) =>
      Array.from(new Set([...currentIds, ...lineageIds, scopeId])),
    );

    if (nextVisibleHref) {
      router.push(nextVisibleHref as Href);
    }
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
    router.push(getNexusSectionHref(section) as Href);
  };

  const setScopeFollowed = async (scopeId: string, isFollowed: boolean) => {
    await setNexusScopeFollowPreference({
      actorPacketId: currentActorPacketId,
      scopeId,
      isFollowed,
    });
    await refreshShellData();
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

  const openExplorer = () => {
    setPacketExplorerSession((currentSession) =>
      openPacketExplorerHome(currentSession)
    );
  };

  const openPacketInExplorer = (input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      family: string | null;
      summary: string | null;
      label: string | null;
    } | null;
  }) => {
    setPacketExplorerSession((currentSession) =>
      openPacketExplorerPacket(currentSession, input)
    );
  };

  const focusExplorerTab = (tabId: string) => {
    setPacketExplorerSession((currentSession) =>
      focusPacketExplorerTab(currentSession, tabId)
    );
  };

  const closeExplorer = () => {
    setPacketExplorerSession((currentSession) =>
      closePacketExplorer(currentSession)
    );
  };

  const closeExplorerTabById = (tabId: string) => {
    setPacketExplorerSession((currentSession) =>
      closePacketExplorerTab(currentSession, tabId)
    );
  };

  const closeExplorerTabsByMode = () => {
    setPacketExplorerSession((currentSession) =>
      closePacketExplorerTabs(currentSession)
    );
  };

  const setExplorerTabView = (input: {
    tabId: string;
    viewMode: PacketExplorerViewMode;
  }) => {
    setPacketExplorerSession((currentSession) =>
      setPacketExplorerTabViewMode(currentSession, input)
    );
  };

  const setExplorerPrimaryTab = (input: {
    tabId: string;
    primaryTab: PacketExplorerPrimaryTab;
  }) => {
    setPacketExplorerSession((currentSession) =>
      setPacketExplorerPrimaryTab(currentSession, input)
    );
  };

  const retargetActiveExplorerPacket = (input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      family: string | null;
      summary: string | null;
      label: string | null;
    } | null;
  }) => {
    setPacketExplorerSession((currentSession) =>
      retargetActivePacketExplorerTab(currentSession, input)
    );
  };

  const getActiveExplorerTab = () =>
    packetExplorerSession.tabs.find(
      (tab) => tab.id === packetExplorerSession.active_tab_id
    ) ?? null;

  const setExplorerPanelWidthValue = (panelWidth: number | null) => {
    setPacketExplorerSession((currentSession) =>
      setPacketExplorerPanelWidth(currentSession, panelWidth)
    );
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
        discoverableScopes,
        followedScopes,
        scopeSummaries,
        isPreferencesDrawerOpen,
        isPrimaryRailCollapsed,
        isSecondaryRailCollapsed,
        packetExplorerSession,
        setNavigationMode,
        setThemeMode,
        setUiDensity,
        setActiveScopeId,
        toggleScopeExpansion,
        setActiveSection,
        setScopeFollowed,
        refreshShellData,
        togglePreferencesDrawer,
        togglePrimaryRailCollapsed,
        toggleSecondaryRailCollapsed,
        collapseOuterRail,
        expandInnerRail,
        openExplorer,
        openPacketInExplorer,
        focusExplorerTab,
        closeExplorer,
        closeExplorerTabs: closeExplorerTabsByMode,
        closeExplorerTab: closeExplorerTabById,
        retargetActiveExplorerPacket,
        setExplorerTabViewMode: setExplorerTabView,
        setExplorerPrimaryTab,
        setExplorerPanelWidth: setExplorerPanelWidthValue,
        getActiveExplorerTab,
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
