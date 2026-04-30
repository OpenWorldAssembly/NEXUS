/**
 * File: packet-explorer-session.ts
 * Description: Defines the shell-level Packet Explorer session model and session-storage helpers.
 */

export const PACKET_EXPLORER_VIEW_MODES = [
  'summary',
  'raw',
  'adapted',
  'read_model',
  'lineage',
  'links',
  'actions',
] as const;

export const PACKET_EXPLORER_LIVE_VIEW_MODES = [
  'summary',
  'raw',
  'adapted',
  'read_model',
  'lineage',
  'links',
  'actions',
] as const;

export type PacketExplorerViewMode =
  (typeof PACKET_EXPLORER_VIEW_MODES)[number];

export type PacketExplorerReadMode = 'raw' | 'adapted' | 'read_model';

export type PacketExplorerSeedSummary = {
  family: string | null;
  summary: string | null;
  label: string | null;
};

export type PacketExplorerTab = {
  id: string;
  kind: 'home' | 'packet';
  title_snapshot: string;
  packet_id: string | null;
  preferred_revision_id: string | null;
  active_view_mode: PacketExplorerViewMode;
  selected_read_mode: PacketExplorerReadMode;
  selected_target_schema_version: string | null;
  seed_summary: PacketExplorerSeedSummary | null;
};

export type PacketExplorerSession = {
  is_open: boolean;
  active_tab_id: string | null;
  tabs: PacketExplorerTab[];
};

export type PacketExplorerRequestIdentity = {
  packetId: string;
  viewerActorPacketId?: string | null;
  preferredRevisionId?: string | null;
  retryNonce?: number;
};

const EXPLORER_SESSION_STORAGE_KEY = 'owa.packet-explorer.session.v1';

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

function isExplorerReadMode(value: unknown): value is PacketExplorerReadMode {
  return value === 'raw' || value === 'adapted' || value === 'read_model';
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
    !isExplorerViewMode(candidate.active_view_mode) ||
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
    active_view_mode: candidate.active_view_mode,
    selected_read_mode: candidate.selected_read_mode,
    selected_target_schema_version:
      typeof candidate.selected_target_schema_version === 'string'
        ? candidate.selected_target_schema_version
        : null,
    seed_summary:
      candidate.seed_summary &&
      typeof candidate.seed_summary === 'object' &&
      !Array.isArray(candidate.seed_summary)
        ? {
            family:
              typeof (candidate.seed_summary as Record<string, unknown>).family ===
              'string'
                ? ((candidate.seed_summary as Record<string, unknown>)
                    .family as string)
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
    tabs,
  };
}

export function createEmptyPacketExplorerSession(): PacketExplorerSession {
  return {
    is_open: false,
    active_tab_id: null,
    tabs: [],
  };
}

export function createPacketExplorerHomeTab(): PacketExplorerTab {
  return {
    id: createExplorerTabId('home'),
    kind: 'home',
    title_snapshot: 'Explorer',
    packet_id: null,
    preferred_revision_id: null,
    active_view_mode: 'summary',
    selected_read_mode: 'raw',
    selected_target_schema_version: null,
    seed_summary: null,
  };
}

export function createPacketExplorerPacketTab(input: {
  packetId: string;
  preferredRevisionId?: string | null;
  titleSnapshot?: string | null;
  seedSummary?: PacketExplorerSeedSummary | null;
}): PacketExplorerTab {
  return {
    id: createExplorerTabId('packet'),
    kind: 'packet',
    title_snapshot: input.titleSnapshot?.trim() || input.packetId,
    packet_id: input.packetId,
    preferred_revision_id: input.preferredRevisionId ?? null,
    active_view_mode: 'summary',
    selected_read_mode: 'raw',
    selected_target_schema_version: null,
    seed_summary: input.seedSummary ?? null,
  };
}

export function openPacketExplorerHome(
  session: PacketExplorerSession
): PacketExplorerSession {
  const existingHomeTab = session.tabs.find((tab) => tab.kind === 'home') ?? null;
  const homeTab = existingHomeTab ?? createPacketExplorerHomeTab();
  const tabs = existingHomeTab ? session.tabs : [...session.tabs, homeTab];

  return {
    is_open: true,
    active_tab_id: homeTab.id,
    tabs,
  };
}

export function openPacketExplorerPacket(
  session: PacketExplorerSession,
  input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: PacketExplorerSeedSummary | null;
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
      tabs: session.tabs.map((tab) =>
        tab.id === existingTab.id
          ? {
              ...tab,
              title_snapshot: input.titleSnapshot?.trim() || tab.title_snapshot,
              preferred_revision_id:
                input.preferredRevisionId ?? tab.preferred_revision_id,
              seed_summary: input.seedSummary ?? tab.seed_summary,
            }
          : tab
      ),
    };
  }

  const nextTab = createPacketExplorerPacketTab(input);

  return {
    is_open: true,
    active_tab_id: nextTab.id,
    tabs: [...session.tabs, nextTab],
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
  };
}

export function closePacketExplorer(
  session: PacketExplorerSession
): PacketExplorerSession {
  return {
    ...session,
    is_open: false,
  };
}

export function closePacketExplorerTab(
  session: PacketExplorerSession,
  tabId: string
): PacketExplorerSession {
  const nextTabs = session.tabs.filter((tab) => tab.id !== tabId);

  if (nextTabs.length === 0) {
    return createEmptyPacketExplorerSession();
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
    tabs: nextTabs,
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
      tabs: session.tabs.map((tab) =>
        tab.id === input.tabId
          ? {
              ...tab,
              active_view_mode: input.viewMode,
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
