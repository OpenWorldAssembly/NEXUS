/**
 * File: nexus-shell-context.tsx
 * Description: Shares the nexus shell state across all `/nexus/*` routes.
 */
import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';

import type {
  ShellChromePreferenceValue,
} from '@core/packets/packet-definition-manifest';
import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import type { NexusShellGateSession } from '@runtime/nexus/nexus-shell-gates';
import {
  dismissNexusShellGate,
  isNexusShellGateDismissed,
  persistNexusShellGateSession,
  readNexusShellGateSession,
} from '@runtime/nexus/nexus-shell-gates';
import type {
  PacketExplorerSession,
  PacketExplorerHomeSubtab,
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
  setPacketExplorerHomeSubtab,
  setPacketExplorerPanelWidth,
  setPacketExplorerPrimaryTab,
  setPacketExplorerTabViewMode,
} from '@runtime/nexus/packet-explorer-session';
import {
  NEXUS_GUEST_CAPABILITIES,
} from '@runtime/nexus/nexus-content';
import {
  fetchNexusShellPayload,
  updateNexusScopeDisplayPreferences,
} from '@runtime/nexus/nexus-query-api';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';
import { persistNexusElementPreference } from '@app/components/nexus/nexus-shell-preferences';
import {
  buildNexusBranchNodes,
  getNexusScopeSelectionHref,
  getNexusAncestorIds,
  getNexusSectionFromPathname,
  getNexusSectionHref,
  isNexusGeographicTreeScope,
  type NexusNavMode,
  type NexusProjectedScopeSection,
  type NexusScopeBranchNode,
  type NexusScopeSummary,
  type NexusSection,
  type NexusShellState,
  type NexusSidebarScopeSectionId,
  type NexusThemeMode,
  type NexusUiDensity,
} from '@runtime/nexus/nexus-shell';

type NexusShellContextValue = NexusShellState & {
  activeScope: NexusScopeSummary;
  currentActorLabel: string;
  currentActorPacketId: string | null;
  currentIdentityMode: 'ephemeral_guest' | 'persistent_guest' | 'claimed' | null;
  branchNodes: NexusScopeBranchNode[];
  associatedScopes: NexusScopeSummary[];
  associatedGraph: NexusProjectedScopeSection;
  discoverableSection: NexusProjectedScopeSection;
  discoverableScopes: NexusScopeSummary[];
  followedScopes: NexusScopeSummary[];
  followedGraph: NexusProjectedScopeSection;
  homeGraph: NexusProjectedScopeSection;
  mainGraph: NexusProjectedScopeSection;
  mainVisibleScopePacketIds: string[];
  scopeSummaries: NexusScopeSummary[];
  isPreferencesDrawerOpen: boolean;
  isPrimaryRailCollapsed: boolean;
  isSecondaryRailCollapsed: boolean;
  isEarlyAccessGateOpen: boolean;
  packetExplorerSession: PacketExplorerSession;
  setNavigationMode: (mode: NexusNavMode) => void;
  setThemeMode: (mode: NexusThemeMode) => void;
  setUiDensity: (density: NexusUiDensity) => void;
  setActiveScopeId: (scopeId: string) => void;
  toggleScopeExpansion: (scopeId: string) => void;
  setActiveSection: (section: NexusSection) => void;
  setScopeFollowed: (scopeId: string, isFollowed: boolean) => Promise<void>;
  setScopeAssociated: (scopeId: string, isAssociated: boolean) => Promise<void>;
  setScopeMainVisible: (scopeId: string, isMainVisible: boolean) => Promise<void>;
  setScopeSectionParentChains: (
    sectionId: Extract<NexusSidebarScopeSectionId, 'associated' | 'followed'>,
    showParentChains: boolean
  ) => Promise<void>;
  refreshShellData: () => Promise<void>;
  togglePreferencesDrawer: () => void;
  dismissEarlyAccessGate: () => void;
  togglePrimaryRailCollapsed: () => void;
  toggleSecondaryRailCollapsed: () => void;
  collapseOuterRail: () => void;
  collapseAllRails: () => void;
  expandInnerRail: () => void;
  expandAllRails: () => void;
  openExplorer: (input?: {
    subtab?: PacketExplorerHomeSubtab;
    packetId?: string | null;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      type: string | null;
      summary: string | null;
      label: string | null;
    } | null;
  }) => void;
  openPacketInExplorer: (input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      type: string | null;
      summary: string | null;
      label: string | null;
    } | null;
    activePrimaryTab?: PacketExplorerPrimaryTab;
    selectedDataViewMode?: PacketExplorerViewMode;
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
      type: string | null;
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
  setExplorerHomeSubtab: (input: {
    tabId: string;
    subtab: PacketExplorerHomeSubtab;
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
  scopeSubtype: 'assembly.global',
  scopeSystem: 'geographic',
  description:
    'Packet-backed scope data is loading. This temporary context keeps the shell stable.',
  localityLabel: 'Global',
  badge: 'Guest default',
  relationshipLabel: 'Root assembly scope',
  childIds: [],
  followedScopeIds: [],
  isKnown: true,
  isMounted: true,
  isDiscoverable: true,
  isFollowed: false,
  isAssociated: false,
  isHomeAncestor: false,
  structuralState: 'canonical',
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
    runFortressMutation,
  } = useIdentityShell();
  const [scopeSummaries, setScopeSummaries] = useState<NexusScopeSummary[]>([
    FALLBACK_SCOPE_SUMMARY,
  ]);
  const [followedScopeIds, setFollowedScopeIds] = useState<string[]>([]);
  const [mainVisibleScopePacketIds, setMainVisibleScopePacketIds] = useState<string[]>([]);
  const [homeGraph, setHomeGraph] = useState<NexusProjectedScopeSection>({
    id: 'home',
    title: 'Home scopes',
    count: 0,
    showParentChains: false,
    groups: [],
  });
  const [associatedGraph, setAssociatedGraph] = useState<NexusProjectedScopeSection>({
    id: 'associated',
    title: 'Associated scopes',
    count: 0,
    showParentChains: true,
    groups: [],
  });
  const [followedGraph, setFollowedGraph] = useState<NexusProjectedScopeSection>({
    id: 'followed',
    title: 'Followed scopes',
    count: 0,
    showParentChains: true,
    groups: [],
  });
  const [mainGraph, setMainGraph] = useState<NexusProjectedScopeSection>({
    id: 'main',
    title: 'Main tree',
    count: 0,
    showParentChains: true,
    groups: [],
  });
  const [discoverableSection, setDiscoverableSection] =
    useState<NexusProjectedScopeSection>({
      id: 'discoverable',
      title: 'Discoverable scopes',
      count: 0,
      showParentChains: false,
      groups: [],
    });
  const [guestCapabilities, setGuestCapabilities] = useState(
    NEXUS_GUEST_CAPABILITIES,
  );
  const [navigationMode, setNavigationModeState] =
    useState<NexusNavMode>('function');
  const [themeMode, setThemeModeState] = useState<NexusThemeMode>('dark');
  const [uiDensity, setUiDensityState] = useState<NexusUiDensity>('small');
  const [activeScopeId, setActiveScopeIdState] = useState(
    FALLBACK_SCOPE_SUMMARY.id,
  );
  const [expandedScopeIds, setExpandedScopeIds] = useState(
    [FALLBACK_SCOPE_SUMMARY.id],
  );
  const [isPreferencesDrawerOpen, setIsPreferencesDrawerOpen] = useState(false);
  const [isPrimaryRailCollapsed, setIsPrimaryRailCollapsed] = useState(false);
  const [isSecondaryRailCollapsed, setIsSecondaryRailCollapsed] = useState(false);
  const [shellGateSession, setShellGateSession] = useState<NexusShellGateSession>(
    () => readNexusShellGateSession()
  );
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
  const associatedScopes = scopeSummaries.filter((scope) => scope.isAssociated);
  const discoverableScopes = scopeSummaries.filter(
    (scope) => scope.isDiscoverable && (!scope.isMounted || scope.isAssociated)
  );
  const followedScopes = scopeSummaries.filter((scope) =>
    followedScopeIds.includes(scope.id),
  );
  const isEarlyAccessGateOpen = !isNexusShellGateDismissed(
    shellGateSession,
    'early_access'
  );

  const refreshShellData = useCallback(async () => {
    const shellPayload = await fetchNexusShellPayload({
      actorPacketId: currentActorPacketId,
    });

    if (shellPayload.scope_summaries.length === 0) {
      return;
    }

    const nextScopeSummaries = shellPayload.scope_summaries;

    setScopeSummaries(nextScopeSummaries);
    setFollowedScopeIds(shellPayload.followed_scope_ids);
    setMainVisibleScopePacketIds(shellPayload.main_visible_scope_packet_ids);
    setHomeGraph(shellPayload.home_graph);
    setAssociatedGraph(shellPayload.associated_graph);
    setFollowedGraph(shellPayload.followed_graph);
    setMainGraph(shellPayload.main_graph);
    setDiscoverableSection(shellPayload.discoverable_section);
    setGuestCapabilities(shellPayload.guest_capabilities);
    setNavigationModeState(shellPayload.shell_chrome.navigation_mode);
    setThemeModeState(shellPayload.shell_chrome.theme_mode);
    setUiDensityState(shellPayload.shell_chrome.ui_density);
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
        ]),
      );
    });
  }, [currentActorPacketId]);

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
    persistNexusShellGateSession(shellGateSession);
  }, [shellGateSession]);

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

  const persistElementPreference = useCallback(
    async (input: {
      scopeDisplay?: Partial<NexusScopeDisplayPreferencesPayload>;
      shellChrome?: Partial<ShellChromePreferenceValue>;
      note: string;
    }): Promise<{
      preferences: NexusScopeDisplayPreferencesPayload;
      shell_chrome?: ShellChromePreferenceValue;
    }> => {
      return persistNexusElementPreference({
        currentMode,
        scopeDisplay: input.scopeDisplay,
        shellChrome: input.shellChrome,
        note: input.note,
        runFortressMutation,
        updateCompatibilityPreferences: (requestBody) =>
          updateNexusScopeDisplayPreferences({
            requestBody,
          }),
      });
    },
    [currentMode, runFortressMutation]
  );

  const persistShellChromePreference = useCallback(
    async (shellChromePatch: Partial<ShellChromePreferenceValue>) => {
      const updated = await persistElementPreference({
        shellChrome: shellChromePatch,
        note: 'Element interface preferences.',
      });

      if (updated.shell_chrome) {
        setNavigationModeState(updated.shell_chrome.navigation_mode);
        setThemeModeState(updated.shell_chrome.theme_mode);
        setUiDensityState(updated.shell_chrome.ui_density);
      }
    },
    [persistElementPreference]
  );

  const persistShellChromePreferenceSafely = (
    shellChromePatch: Partial<ShellChromePreferenceValue>
  ) => {
    void persistShellChromePreference(shellChromePatch).catch((error) => {
      console.warn('Unable to persist shell chrome preference.', error);
    });
  };

  const setNavigationMode = (mode: NexusNavMode) => {
    setNavigationModeState(mode);
    persistShellChromePreferenceSafely({ navigation_mode: mode });
  };

  const setThemeMode = (mode: NexusThemeMode) => {
    setThemeModeState(mode);
    persistShellChromePreferenceSafely({ theme_mode: mode });
  };

  const setUiDensity = (density: NexusUiDensity) => {
    setUiDensityState(density);
    persistShellChromePreferenceSafely({ ui_density: density });
  };

  const setScopeFollowed = async (scopeId: string, isFollowed: boolean) => {
    const targetScope = scopeSummaries.find((scope) => scope.id === scopeId) ?? null;

    if (!targetScope) {
      throw new Error('Unknown scope follow target.');
    }

    await runFortressMutation({
      intent: isFollowed
        ? {
            kind: 'follows.relation.set',
            scope_id: scopeId,
            target_scope_packet_id: targetScope.packetId,
          }
        : {
            kind: 'follows.relation.clear',
            scope_id: scopeId,
            target_scope_packet_id: targetScope.packetId,
          },
    });
    await refreshShellData();
  };

  const setScopeAssociated = async (scopeId: string, isAssociated: boolean) => {
    const targetScope = scopeSummaries.find((scope) => scope.id === scopeId) ?? null;

    if (!targetScope) {
      throw new Error('Unknown scope association target.');
    }

    await runFortressMutation({
      intent: isAssociated
        ? {
            kind: 'assembly_association.relation.set',
            scope_id: scopeId,
            assembly_packet_id: targetScope.packetId,
          }
        : {
            kind: 'assembly_association.relation.clear',
            scope_id: scopeId,
            assembly_packet_id: targetScope.packetId,
          },
      writeRisk: 'standard',
    });
    await refreshShellData();
  };

  const setScopeMainVisible = async (scopeId: string, isMainVisible: boolean) => {
    const targetScope = scopeSummaries.find((scope) => scope.id === scopeId) ?? null;

    if (!targetScope) {
      throw new Error('Unknown main-tree scope target.');
    }

    const nextMainVisibleScopePacketIds = isMainVisible
      ? Array.from(new Set([...mainVisibleScopePacketIds, targetScope.packetId]))
      : mainVisibleScopePacketIds.filter(
          (packetId) => packetId !== targetScope.packetId
        );
    const scopeDisplayPatch = {
      main_visible_scope_packet_ids: nextMainVisibleScopePacketIds,
    };
    const updated = await persistElementPreference({
      scopeDisplay: scopeDisplayPatch,
      note: 'Element scope-display preferences.',
    });

    setMainVisibleScopePacketIds(updated.preferences.main_visible_scope_packet_ids);
    await refreshShellData();
  };

  const setScopeSectionParentChains = async (
    sectionId: Extract<NexusSidebarScopeSectionId, 'associated' | 'followed'>,
    showParentChains: boolean
  ) => {
    const scopeDisplayPatch =
      sectionId === 'associated'
        ? { show_associated_parent_chains: showParentChains }
        : { show_followed_parent_chains: showParentChains };
    const updated = await persistElementPreference({
      scopeDisplay: scopeDisplayPatch,
      note: 'Element scope-display preferences.',
    });

    setAssociatedGraph((currentGraph) =>
      sectionId === 'associated'
        ? {
            ...currentGraph,
            showParentChains:
              updated.preferences.show_associated_parent_chains,
          }
        : currentGraph
    );
    setFollowedGraph((currentGraph) =>
      sectionId === 'followed'
        ? {
            ...currentGraph,
            showParentChains:
              updated.preferences.show_followed_parent_chains,
          }
        : currentGraph
    );
    setMainVisibleScopePacketIds(updated.preferences.main_visible_scope_packet_ids);
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
   * Output: dismisses the shell-level early-access gate for the current browser session.
   */
  const dismissEarlyAccessGate = () => {
    setShellGateSession((currentSession) =>
      dismissNexusShellGate(currentSession, 'early_access')
    );
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
   * Output: collapses both desktop rails while leaving the sidebar rail slivers mounted.
   */
  const collapseAllRails = () => {
    setIsPrimaryRailCollapsed(true);
    setIsSecondaryRailCollapsed(true);
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

  /**
   * Inputs: none.
   * Output: forces both rails open, used by the narrow-screen tray entry path.
   */
  const expandAllRails = () => {
    setIsPrimaryRailCollapsed(false);
    setIsSecondaryRailCollapsed(false);
  };

  const openExplorer = (input?: {
    subtab?: PacketExplorerHomeSubtab;
    packetId?: string | null;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      type: string | null;
      summary: string | null;
      label: string | null;
    } | null;
  }) => {
    setPacketExplorerSession((currentSession) =>
      openPacketExplorerHome(currentSession, input)
    );
  };

  const openPacketInExplorer = (input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      type: string | null;
      summary: string | null;
      label: string | null;
    } | null;
    activePrimaryTab?: PacketExplorerPrimaryTab;
    selectedDataViewMode?: PacketExplorerViewMode;
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

  const setExplorerHomeSubtab = (input: {
    tabId: string;
    subtab: PacketExplorerHomeSubtab;
  }) => {
    setPacketExplorerSession((currentSession) =>
      setPacketExplorerHomeSubtab(currentSession, input)
    );
  };

  const retargetActiveExplorerPacket = (input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      type: string | null;
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
        associatedScopes,
        associatedGraph,
        discoverableSection,
        discoverableScopes,
        followedScopes,
        followedGraph,
        homeGraph,
        mainGraph,
        mainVisibleScopePacketIds,
        scopeSummaries,
        isPreferencesDrawerOpen,
        isPrimaryRailCollapsed,
        isSecondaryRailCollapsed,
        isEarlyAccessGateOpen,
        packetExplorerSession,
        setNavigationMode,
        setThemeMode,
        setUiDensity,
        setActiveScopeId,
        toggleScopeExpansion,
        setActiveSection,
        setScopeFollowed,
        setScopeAssociated,
        setScopeMainVisible,
        setScopeSectionParentChains,
        refreshShellData,
        togglePreferencesDrawer,
        dismissEarlyAccessGate,
        togglePrimaryRailCollapsed,
        toggleSecondaryRailCollapsed,
        collapseOuterRail,
        collapseAllRails,
        expandInnerRail,
        expandAllRails,
        openExplorer,
        openPacketInExplorer,
        focusExplorerTab,
        closeExplorer,
        closeExplorerTabs: closeExplorerTabsByMode,
        closeExplorerTab: closeExplorerTabById,
        retargetActiveExplorerPacket,
        setExplorerTabViewMode: setExplorerTabView,
        setExplorerPrimaryTab,
        setExplorerHomeSubtab,
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
