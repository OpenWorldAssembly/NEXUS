/**
 * File: packet-explorer-session.ts
 * Description: Defines the shell-level Packet Explorer session model and session-storage helpers.
 */

import { getPacketTitleFallbackFromPacketId } from '@core/projections/labels';

export const PACKET_EXPLORER_VIEW_MODES = [
  'summary',
  'raw',
  'adapted',
  'read_model',
 ] as const;

export const PACKET_EXPLORER_PRIMARY_TABS = [
  'data',
  'verification',
  'lineage',
  'links',
  'actions',
] as const;

export const MAX_PACKET_EXPLORER_PACKET_TABS = 100;

export const PACKET_EXPLORER_LIVE_VIEW_MODES = [
  'summary',
  'raw',
  'adapted',
  'read_model',
  'verification',
  'lineage',
  'links',
  'actions',
] as const;

export type PacketExplorerViewMode =
  (typeof PACKET_EXPLORER_VIEW_MODES)[number];

export type PacketExplorerPrimaryTab =
  (typeof PACKET_EXPLORER_PRIMARY_TABS)[number];

export type PacketExplorerReadMode = 'raw' | 'adapted' | 'read_model';
export const PACKET_EXPLORER_HOME_SUBTABS = ['search', 'import', 'export'] as const;
export type PacketExplorerHomeSubtab =
  (typeof PACKET_EXPLORER_HOME_SUBTABS)[number];

export type PacketExplorerSeedSummary = {
  type: string | null;
  summary: string | null;
  label: string | null;
};

export type PacketExplorerTab = {
  id: string;
  kind: 'home' | 'packet';
  title_snapshot: string;
  packet_id: string | null;
  preferred_revision_id: string | null;
  active_primary_tab: PacketExplorerPrimaryTab;
  selected_data_view_mode: PacketExplorerViewMode;
  selected_read_mode: PacketExplorerReadMode;
  selected_target_schema_version: string | null;
  active_home_subtab: PacketExplorerHomeSubtab;
  seed_summary: PacketExplorerSeedSummary | null;
};

export type PacketExplorerSession = {
  is_open: boolean;
  active_tab_id: string | null;
  tabs: PacketExplorerTab[];
  panel_width: number | null;
  notice: string | null;
};

export type PacketExplorerRequestIdentity = {
  packetId: string;
  viewerActorPacketId?: string | null;
  preferredRevisionId?: string | null;
  retryNonce?: number;
};

const EXPLORER_SESSION_STORAGE_KEY = 'owa.packet-explorer.session.v1';

function ensureHomeTabFirst(tabs: PacketExplorerTab[]): PacketExplorerTab[] {
  const homeTab = tabs.find((tab) => tab.kind === 'home') ?? null;

  if (!homeTab) {
    return tabs;
  }

  return [
    homeTab,
    ...tabs.filter((tab) => tab.id !== homeTab.id),
  ];
}

function countPacketTabs(tabs: PacketExplorerTab[]): number {
  return tabs.filter((tab) => tab.kind === 'packet').length;
}

export function createPacketExplorerRequestKey(
  input: PacketExplorerRequestIdentity
): string {
  return [
    input.packetId,
    input.viewerActorPacketId ?? 'anonymous-viewer',
    input.preferredRevisionId ?? 'preferred-current',
    String(input.retryNonce ?? 0),
  ].join('::');
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function createExplorerTabId(prefix: 'home' | 'packet'): string {
  return `explorer-${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function isExplorerViewMode(value: unknown): value is PacketExplorerViewMode {
  return (
    typeof value === 'string' &&
    (PACKET_EXPLORER_VIEW_MODES as readonly string[]).includes(value)
  );
}

function isExplorerPrimaryTab(value: unknown): value is PacketExplorerPrimaryTab {
  return (
    typeof value === 'string' &&
    (PACKET_EXPLORER_PRIMARY_TABS as readonly string[]).includes(value)
  );
}

function isExplorerReadMode(value: unknown): value is PacketExplorerReadMode {
  return value === 'raw' || value === 'adapted' || value === 'read_model';
}

function isExplorerHomeSubtab(value: unknown): value is PacketExplorerHomeSubtab {
  return (
    typeof value === 'string' &&
    (PACKET_EXPLORER_HOME_SUBTABS as readonly string[]).includes(value)
  );
}

function sanitizeExplorerTab(value: unknown): PacketExplorerTab | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.id !== 'string' ||
    (candidate.kind !== 'home' && candidate.kind !== 'packet') ||
    typeof candidate.title_snapshot !== 'string' ||
    !isExplorerPrimaryTab(candidate.active_primary_tab) ||
    !isExplorerViewMode(candidate.selected_data_view_mode) ||
    !isExplorerReadMode(candidate.selected_read_mode)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    kind: candidate.kind,
    title_snapshot: candidate.title_snapshot,
    packet_id:
      typeof candidate.packet_id === 'string' ? candidate.packet_id : null,
    preferred_revision_id:
      typeof candidate.preferred_revision_id === 'string'
        ? candidate.preferred_revision_id
        : null,
    active_primary_tab: candidate.active_primary_tab,
    selected_data_view_mode: candidate.selected_data_view_mode,
    selected_read_mode: candidate.selected_read_mode,
    selected_target_schema_version:
      typeof candidate.selected_target_schema_version === 'string'
        ? candidate.selected_target_schema_version
        : null,
    active_home_subtab: isExplorerHomeSubtab(candidate.active_home_subtab)
      ? candidate.active_home_subtab
      : 'search',
    seed_summary:
      candidate.seed_summary &&
      typeof candidate.seed_summary === 'object' &&
      !Array.isArray(candidate.seed_summary)
        ? {
            type:
              typeof (candidate.seed_summary as Record<string, unknown>).type ===
              'string'
                ? ((candidate.seed_summary as Record<string, unknown>)
                    .type as string)
                : null,
            summary:
              typeof (candidate.seed_summary as Record<string, unknown>).summary ===
              'string'
                ? ((candidate.seed_summary as Record<string, unknown>)
                    .summary as string)
                : null,
            label:
              typeof (candidate.seed_summary as Record<string, unknown>).label ===
              'string'
                ? ((candidate.seed_summary as Record<string, unknown>)
                    .label as string)
                : null,
          }
        : null,
  };
}

function sanitizeExplorerSession(value: unknown): PacketExplorerSession | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.is_open !== 'boolean' ||
    !Array.isArray(candidate.tabs) ||
    (candidate.active_tab_id !== null &&
      typeof candidate.active_tab_id !== 'string' &&
      typeof candidate.active_tab_id !== 'undefined')
  ) {
    return null;
  }

  const tabs = candidate.tabs
    .map((tabValue) => sanitizeExplorerTab(tabValue))
    .filter((tab): tab is PacketExplorerTab => tab !== null);
  const activeTabId =
    typeof candidate.active_tab_id === 'string' ? candidate.active_tab_id : null;
  const resolvedActiveTabId = tabs.some((tab) => tab.id === activeTabId)
    ? activeTabId
    : tabs[0]?.id ?? null;

  return {
    is_open: candidate.is_open && tabs.length > 0,
    active_tab_id: resolvedActiveTabId,
    tabs: ensureHomeTabFirst(tabs),
    panel_width:
      typeof candidate.panel_width === 'number' &&
      Number.isFinite(candidate.panel_width)
        ? candidate.panel_width
        : null,
    notice: typeof candidate.notice === 'string' ? candidate.notice : null,
  };
}

export function createEmptyPacketExplorerSession(): PacketExplorerSession {
  return {
    is_open: false,
    active_tab_id: null,
    tabs: [],
    panel_width: null,
    notice: null,
  };
}

export function createPacketExplorerHomeTab(): PacketExplorerTab {
  return {
    id: createExplorerTabId('home'),
    kind: 'home',
    title_snapshot: 'Explorer',
    packet_id: null,
    preferred_revision_id: null,
    active_primary_tab: 'data',
    selected_data_view_mode: 'summary',
    selected_read_mode: 'raw',
    selected_target_schema_version: null,
    active_home_subtab: 'search',
    seed_summary: null,
  };
}

export function createPacketExplorerPacketTab(input: {
  packetId: string;
  preferredRevisionId?: string | null;
  titleSnapshot?: string | null;
  seedSummary?: PacketExplorerSeedSummary | null;
  activePrimaryTab?: PacketExplorerPrimaryTab;
  selectedDataViewMode?: PacketExplorerViewMode;
}): PacketExplorerTab {
  return {
    id: createExplorerTabId('packet'),
    kind: 'packet',
    title_snapshot:
      input.titleSnapshot?.trim() ||
      input.seedSummary?.label?.trim() ||
      getPacketTitleFallbackFromPacketId(input.packetId),
    packet_id: input.packetId,
    preferred_revision_id: input.preferredRevisionId ?? null,
    active_primary_tab: input.activePrimaryTab ?? 'data',
    selected_data_view_mode: input.selectedDataViewMode ?? 'summary',
    selected_read_mode: 'raw',
    selected_target_schema_version: null,
    active_home_subtab: 'search',
    seed_summary: input.seedSummary ?? null,
  };
}

export function openPacketExplorerHome(
  session: PacketExplorerSession,
  input?: {
    subtab?: PacketExplorerHomeSubtab;
    packetId?: string | null;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: PacketExplorerSeedSummary | null;
  }
): PacketExplorerSession {
  const existingHomeTab = session.tabs.find((tab) => tab.kind === 'home') ?? null;
  const baseHomeTab = existingHomeTab ?? createPacketExplorerHomeTab();
  const hasPacketId = Boolean(input && 'packetId' in input);
  const hasPreferredRevisionId = Boolean(input && 'preferredRevisionId' in input);
  const hasSeedSummary = Boolean(input && 'seedSummary' in input);
  const homeTab: PacketExplorerTab = {
    ...baseHomeTab,
    packet_id: hasPacketId ? (input?.packetId ?? null) : baseHomeTab.packet_id,
    preferred_revision_id: hasPreferredRevisionId
      ? (input?.preferredRevisionId ?? null)
      : baseHomeTab.preferred_revision_id,
    active_home_subtab: input?.subtab ?? baseHomeTab.active_home_subtab,
    seed_summary: hasSeedSummary ? (input?.seedSummary ?? null) : baseHomeTab.seed_summary,
  };
  const tabs = ensureHomeTabFirst(
    existingHomeTab
      ? session.tabs.map((tab) => (tab.kind === 'home' ? homeTab : tab))
      : [homeTab, ...session.tabs]
  );

  return {
    is_open: true,
    active_tab_id: homeTab.id,
    tabs,
    panel_width: session.panel_width,
    notice: null,
  };
}

export function openPacketExplorerPacket(
  session: PacketExplorerSession,
  input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: PacketExplorerSeedSummary | null;
    activePrimaryTab?: PacketExplorerPrimaryTab;
    selectedDataViewMode?: PacketExplorerViewMode;
  }
): PacketExplorerSession {
  const existingTab =
    session.tabs.find(
      (tab) => tab.kind === 'packet' && tab.packet_id === input.packetId
    ) ?? null;

  if (existingTab) {
    return {
      ...session,
      is_open: true,
      active_tab_id: existingTab.id,
      notice: null,
      tabs: session.tabs.map((tab) =>
        tab.id === existingTab.id
          ? {
              ...tab,
              title_snapshot:
                input.titleSnapshot?.trim() ||
                input.seedSummary?.label?.trim() ||
                tab.title_snapshot,
              preferred_revision_id:
                input.preferredRevisionId ?? tab.preferred_revision_id,
              seed_summary: input.seedSummary ?? tab.seed_summary,
              active_primary_tab: input.activePrimaryTab ?? tab.active_primary_tab,
              selected_data_view_mode:
                input.selectedDataViewMode ?? tab.selected_data_view_mode,
            }
          : tab
      ),
    };
  }

  const homeTab = session.tabs.find((tab) => tab.kind === 'home') ?? createPacketExplorerHomeTab();
  const baseTabs = session.tabs.some((tab) => tab.kind === 'home')
    ? session.tabs
    : [homeTab, ...session.tabs];

  if (countPacketTabs(baseTabs) >= MAX_PACKET_EXPLORER_PACKET_TABS) {
    return {
      ...session,
      is_open: true,
      tabs: ensureHomeTabFirst(baseTabs),
      active_tab_id: session.active_tab_id ?? homeTab.id,
      notice: `Packet tab cap reached (${MAX_PACKET_EXPLORER_PACKET_TABS}). Close some packet tabs before opening more.`,
    };
  }

  const nextTab = createPacketExplorerPacketTab(input);

  return {
    is_open: true,
    active_tab_id: nextTab.id,
    tabs: ensureHomeTabFirst([...baseTabs, nextTab]),
    panel_width: session.panel_width,
    notice: null,
  };
}

export function focusPacketExplorerTab(
  session: PacketExplorerSession,
  tabId: string
): PacketExplorerSession {
  if (!session.tabs.some((tab) => tab.id === tabId)) {
    return session;
  }

  return {
    ...session,
    is_open: true,
    active_tab_id: tabId,
    notice: null,
  };
}

export function retargetActivePacketExplorerTab(
  session: PacketExplorerSession,
  input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: PacketExplorerSeedSummary | null;
  }
): PacketExplorerSession {
  const activeTab = session.tabs.find((tab) => tab.id === session.active_tab_id) ?? null;

  if (!activeTab || activeTab.kind !== 'packet') {
    return openPacketExplorerPacket(session, input);
  }

  return {
    ...session,
    is_open: true,
    notice: null,
    tabs: session.tabs.map((tab) =>
      tab.id === activeTab.id
        ? {
            ...tab,
            packet_id: input.packetId,
            preferred_revision_id: input.preferredRevisionId ?? null,
            title_snapshot:
              input.titleSnapshot?.trim() ||
              input.seedSummary?.label?.trim() ||
              getPacketTitleFallbackFromPacketId(input.packetId),
            seed_summary: input.seedSummary ?? null,
          }
        : tab
    ),
  };
}

export function closePacketExplorer(
  session: PacketExplorerSession
): PacketExplorerSession {
  return {
    ...session,
    is_open: false,
    notice: null,
  };
}

export function closePacketExplorerTab(
  session: PacketExplorerSession,
  tabId: string
): PacketExplorerSession {
  const nextTabs = session.tabs.filter((tab) => tab.id !== tabId);

  if (nextTabs.length === 0) {
    return {
      ...createEmptyPacketExplorerSession(),
      panel_width: session.panel_width,
    };
  }

  const currentActiveIndex = session.tabs.findIndex((tab) => tab.id === tabId);
  const fallbackTab =
    nextTabs[Math.max(0, currentActiveIndex - 1)] ?? nextTabs[0] ?? null;

  return {
    is_open: session.is_open,
    active_tab_id:
      session.active_tab_id === tabId
        ? (fallbackTab?.id ?? null)
        : session.active_tab_id,
    tabs: ensureHomeTabFirst(nextTabs),
    panel_width: session.panel_width,
    notice: null,
  };
}

export function closePacketExplorerTabs(
  session: PacketExplorerSession
): PacketExplorerSession {
  const existingHomeTab = session.tabs.find((tab) => tab.kind === 'home') ?? null;
  const homeTab = existingHomeTab ?? createPacketExplorerHomeTab();

  return {
    is_open: session.is_open,
    active_tab_id: homeTab.id,
    tabs: [homeTab],
    panel_width: session.panel_width,
    notice: null,
  };
}

export function setPacketExplorerTabViewMode(
  session: PacketExplorerSession,
  input: {
    tabId: string;
    viewMode: PacketExplorerViewMode;
  }
): PacketExplorerSession {
  if (!session.tabs.some((tab) => tab.id === input.tabId)) {
    return session;
  }

  return {
    ...session,
    notice: null,
    tabs: session.tabs.map((tab) =>
      tab.id === input.tabId
        ? {
            ...tab,
            selected_data_view_mode: input.viewMode,
            selected_read_mode:
              input.viewMode === 'raw' ||
              input.viewMode === 'adapted' ||
              input.viewMode === 'read_model'
                ? input.viewMode
                : tab.selected_read_mode,
          }
        : tab
    ),
  };
}

export function setPacketExplorerPrimaryTab(
  session: PacketExplorerSession,
  input: {
    tabId: string;
    primaryTab: PacketExplorerPrimaryTab;
  }
): PacketExplorerSession {
  if (!session.tabs.some((tab) => tab.id === input.tabId)) {
    return session;
  }

  return {
    ...session,
    notice: null,
    tabs: session.tabs.map((tab) =>
      tab.id === input.tabId
        ? {
            ...tab,
            active_primary_tab: input.primaryTab,
          }
        : tab
    ),
  };
}

export function setPacketExplorerHomeSubtab(
  session: PacketExplorerSession,
  input: {
    tabId: string;
    subtab: PacketExplorerHomeSubtab;
  }
): PacketExplorerSession {
  if (!session.tabs.some((tab) => tab.id === input.tabId)) {
    return session;
  }

  return {
    ...session,
    notice: null,
    tabs: session.tabs.map((tab) =>
      tab.id === input.tabId
        ? {
            ...tab,
            active_home_subtab: input.subtab,
          }
        : tab
    ),
  };
}

export function setPacketExplorerPanelWidth(
  session: PacketExplorerSession,
  panelWidth: number | null
): PacketExplorerSession {
  return {
    ...session,
    panel_width:
      typeof panelWidth === 'number' && Number.isFinite(panelWidth)
        ? panelWidth
        : null,
  };
}

export function readPacketExplorerSession(): PacketExplorerSession {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return createEmptyPacketExplorerSession();
  }

  const rawValue = sessionStorage.getItem(EXPLORER_SESSION_STORAGE_KEY);

  if (!rawValue) {
    return createEmptyPacketExplorerSession();
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    return sanitizeExplorerSession(parsed) ?? createEmptyPacketExplorerSession();
  } catch {
    return createEmptyPacketExplorerSession();
  }
}

export function persistPacketExplorerSession(
  session: PacketExplorerSession
): void {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return;
  }

  sessionStorage.setItem(
    EXPLORER_SESSION_STORAGE_KEY,
    JSON.stringify(session)
  );
}
