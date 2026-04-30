/**
 * File: nexus-packet-explorer.tsx
 * Description: Coordinates the shell-level Packet Explorer overlay, packet payload loading, and responsive panel layout.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  PanResponder,
  Pressable,
  View,
  useWindowDimensions,
} from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { NexusPacketExplorerContent } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-content';
import { NexusPacketExplorerPrimaryRail } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-primary-rail';
import { NexusPacketExplorerShellHeader } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-shell-header';
import { NexusPacketExplorerTabDeck } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-tab-deck';
import { NexusPacketExplorerToolbar } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-toolbar';
import type {
  ExplorerPacketLoadState,
  ExplorerPacketStateMap,
} from '@app/components/nexus/packet-explorer/nexus-packet-explorer-types';
import {
  PACKET_FETCH_TIMEOUT_MS,
  logExplorerClientEvent,
} from '@app/components/nexus/packet-explorer/nexus-packet-explorer-utils';
import { fetchNexusPacketExplorerPayload } from '@runtime/nexus/nexus-query-api';
import {
  createPacketExplorerRequestKey,
  type PacketExplorerViewMode,
} from '@runtime/nexus/packet-explorer-session';

const VIEW_AS_MODES: PacketExplorerViewMode[] = [
  'summary',
  'raw',
  'adapted',
  'read_model',
];
const EXPLORER_DESKTOP_BREAKPOINT = 1100;
const MIN_EXPLORER_PANEL_WIDTH = 720;
const MAX_EXPLORER_PANEL_MARGIN = 64;

function clampExplorerPanelWidth(
  panelWidth: number,
  viewportWidth: number
): number {
  const maxWidth = Math.max(
    MIN_EXPLORER_PANEL_WIDTH,
    viewportWidth - MAX_EXPLORER_PANEL_MARGIN
  );

  return Math.min(Math.max(panelWidth, MIN_EXPLORER_PANEL_WIDTH), maxWidth);
}

/**
 * Inputs: none.
 * Output: the global Packet Explorer overlay when the session is open.
 */
export default function NexusPacketExplorer() {
  const {
    currentActorPacketId,
    packetExplorerSession,
    closeExplorer,
    closeExplorerTab,
    closeExplorerTabs,
    focusExplorerTab,
    retargetActiveExplorerPacket,
    setExplorerPanelWidth,
    setExplorerPrimaryTab,
    setExplorerTabViewMode,
    openExplorer,
    getActiveExplorerTab,
    themeMode,
  } = useNexusShell();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [searchValue, setSearchValue] = useState('');
  const [packetStates, setPacketStates] = useState<ExplorerPacketStateMap>({});
  const [retryNonceByPacketId, setRetryNonceByPacketId] = useState<
    Record<string, number>
  >({});
  const [isConfirmingCloseTabs, setIsConfirmingCloseTabs] = useState(false);
  const [dragPanelWidth, setDragPanelWidth] = useState<number | null>(null);
  const resizeStartWidthRef = useRef<number>(MIN_EXPLORER_PANEL_WIDTH);
  const activeTab = getActiveExplorerTab();
  const activePacketId = activeTab?.kind === 'packet' ? activeTab.packet_id : null;
  const isDesktop = width >= EXPLORER_DESKTOP_BREAKPOINT;
  const defaultDesktopWidth = clampExplorerPanelWidth(width * 0.7, width);
  const resolvedDesktopWidth = clampExplorerPanelWidth(
    dragPanelWidth ?? packetExplorerSession.panel_width ?? defaultDesktopWidth,
    width
  );
  const overlayWidth = isDesktop ? resolvedDesktopWidth : width;
  const backdropClass =
    themeMode === 'dark' ? 'bg-slate-950/55' : 'bg-slate-900/20';
  const panelClass =
    themeMode === 'dark'
      ? 'border-nexus-line bg-nexus-canvas'
      : 'border-slate-300 bg-white';
  const dividerClass =
    themeMode === 'dark' ? 'border-nexus-line' : 'border-slate-300';
  const inactiveTabClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-white/5'
      : 'border-slate-300 bg-slate-100';
  const attachedActiveTabClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 border-b-nexus-panel bg-nexus-panel'
      : 'border-slate-300 border-b-white bg-white';
  const mutedTextClass =
    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600';
  const headingTextClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const rawCodeCardClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-black/20'
      : 'border-slate-300 bg-slate-100';
  const activePacketState = activePacketId ? packetStates[activePacketId] : undefined;
  const activePacketStateRef = useRef<ExplorerPacketLoadState | undefined>(
    activePacketState
  );
  const activeInspectionLensRef = useRef<PacketExplorerViewMode>('summary');
  const activeTabKind = activeTab?.kind ?? null;
  const activeRequestKey =
    activePacketId && activeTab?.kind === 'packet'
      ? createPacketExplorerRequestKey({
          packetId: activePacketId,
          viewerActorPacketId: currentActorPacketId,
          preferredRevisionId: activeTab.preferred_revision_id,
          retryNonce: retryNonceByPacketId[activePacketId] ?? 0,
        })
      : null;

  useEffect(() => {
    activePacketStateRef.current = activePacketState;
  }, [activePacketState]);

  useEffect(() => {
    activeInspectionLensRef.current =
      activeTab?.kind === 'packet' ? activeTab.selected_data_view_mode : 'summary';
  }, [activeTab]);

  useEffect(() => {
    setPacketStates({});
    setRetryNonceByPacketId({});
  }, [currentActorPacketId]);

  useEffect(() => {
    if (!isDesktop) {
      setDragPanelWidth(null);
    }
  }, [isDesktop]);

  useEffect(() => {
    setIsConfirmingCloseTabs(false);
  }, [packetExplorerSession.active_tab_id]);

  useEffect(() => {
    if (
      !packetExplorerSession.is_open ||
      !activePacketId ||
      activeTabKind === null ||
      activeTabKind !== 'packet' ||
      !activeRequestKey
    ) {
      return;
    }

    const currentPacketState = activePacketStateRef.current;

    if (
      currentPacketState?.request_key === activeRequestKey &&
      currentPacketState.status !== 'loading'
    ) {
      return;
    }

    const controller = new AbortController();
    let didTimeout = false;
    const timeoutHandle = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, PACKET_FETCH_TIMEOUT_MS);

    setPacketStates((currentState) => ({
      ...currentState,
      [activePacketId]: {
        request_key: activeRequestKey,
        status: 'loading',
        payload: currentState[activePacketId]?.payload ?? null,
        error: null,
        last_loaded_revision_id:
          currentState[activePacketId]?.last_loaded_revision_id ?? null,
      },
    }));

    void fetchNexusPacketExplorerPayload({
      packetId: activePacketId,
      actorPacketId: currentActorPacketId,
      inspectionLens: activeInspectionLensRef.current,
      signal: controller.signal,
    })
      .then((payload) => {
        setPacketStates((currentState) => ({
          ...currentState,
          [activePacketId]: {
            request_key: activeRequestKey,
            status: 'loaded',
            payload,
            error: null,
            last_loaded_revision_id: payload.preferred_revision.revision_id,
          },
        }));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted && !didTimeout) {
          logExplorerClientEvent(activePacketId, 'request cancelled');
          return;
        }

        if (didTimeout) {
          logExplorerClientEvent(activePacketId, 'request timed out');
        } else {
          logExplorerClientEvent(
            activePacketId,
            error instanceof Error ? `request failed: ${error.message}` : 'request failed'
          );
        }

        const message =
          didTimeout
            ? 'Packet Explorer timed out while loading this packet.'
            : error instanceof Error
              ? error.message
              : 'Unable to load the Packet Explorer payload.';

        setPacketStates((currentState) => ({
          ...currentState,
          [activePacketId]: {
            request_key: activeRequestKey,
            status: 'error',
            payload: currentState[activePacketId]?.payload ?? null,
            error: message,
            last_loaded_revision_id:
              currentState[activePacketId]?.last_loaded_revision_id ?? null,
          },
        }));
      })
      .finally(() => {
        clearTimeout(timeoutHandle);
      });

    return () => {
      clearTimeout(timeoutHandle);
      controller.abort();
    };
  }, [
    activePacketId,
    activeRequestKey,
    activeTabKind,
    activeTab?.preferred_revision_id,
    currentActorPacketId,
    packetExplorerSession.is_open,
  ]);

  const resizePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          isDesktop &&
          Math.abs(gestureState.dx) > 6 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderGrant: () => {
          resizeStartWidthRef.current = resolvedDesktopWidth;
          setDragPanelWidth(resolvedDesktopWidth);
        },
        onPanResponderMove: (_, gestureState) => {
          const nextWidth = clampExplorerPanelWidth(
            resizeStartWidthRef.current - gestureState.dx,
            width
          );

          setDragPanelWidth(nextWidth);
        },
        onPanResponderRelease: (_, gestureState) => {
          const nextWidth = clampExplorerPanelWidth(
            resizeStartWidthRef.current - gestureState.dx,
            width
          );

          setDragPanelWidth(null);
          setExplorerPanelWidth(nextWidth);
        },
        onPanResponderTerminate: () => {
          setDragPanelWidth(null);
        },
      }),
    [isDesktop, resolvedDesktopWidth, setExplorerPanelWidth, width]
  );

  if (!packetExplorerSession.is_open || !activeTab) {
    return null;
  }

  const displayPacketState =
    activePacketState?.payload && activeTab.kind === 'packet'
      ? {
          ...activePacketState,
          payload: {
            ...activePacketState.payload,
            inspection_lens: activeTab.selected_data_view_mode,
          },
        }
      : activePacketState;
  const activePayload = displayPacketState?.payload ?? null;
  const activeTitle =
    activeTab.kind === 'home'
      ? 'Explorer Home'
      : activePayload?.packet_summary.title ?? activeTab.title_snapshot;
  const activePacketFamily =
    activePayload?.packet_summary.family ?? activeTab.seed_summary?.family ?? null;

  const handleRetryActivePacket = () => {
    if (!activePacketId) {
      return;
    }

    setRetryNonceByPacketId((currentState) => ({
      ...currentState,
      [activePacketId]: (currentState[activePacketId] ?? 0) + 1,
    }));
  };

  const handleOpenPacketInLibrary = (packetId: string, family?: string | null) => {
    router.push({
      pathname: '/nexus/library',
      params: {
        packet_id: packetId,
        ...(family ? { family } : {}),
      },
    });
    closeExplorer();
  };

  return (
    <View className="absolute inset-0 z-30 flex-row justify-end">
      {isDesktop ? (
        <Pressable
          accessibilityRole="button"
          className={`flex-1 ${backdropClass}`}
          onPress={closeExplorer}
        />
      ) : null}

      <View
        className={`h-full ${isDesktop ? 'border-l' : ''} ${panelClass}`}
        style={{ width: overlayWidth }}
      >
        <View className="flex-1 min-h-0">
          {isDesktop ? (
            <View
              className="absolute left-0 top-0 z-40 h-full w-3"
              {...resizePanResponder.panHandlers}
            >
              <View className="mx-auto h-full w-[2px] bg-nexus-line/60" />
            </View>
          ) : null}

          <View className={`gap-4 border-b px-4 py-4 ${dividerClass}`}>
            <NexusPacketExplorerShellHeader
              title={activeTitle}
              isConfirmingCloseTabs={isConfirmingCloseTabs}
              onToggleCloseTabsConfirmation={() =>
                setIsConfirmingCloseTabs((currentValue) => !currentValue)
              }
              onConfirmCloseTabs={() => {
                setIsConfirmingCloseTabs(false);
                closeExplorerTabs();
              }}
              onOpenHomeTab={openExplorer}
              onCloseExplorer={closeExplorer}
            />

            <NexusPacketExplorerTabDeck
              tabs={packetExplorerSession.tabs}
              activeTabId={activeTab.id}
              notice={packetExplorerSession.notice}
              headingTextClass={headingTextClass}
              mutedTextClass={mutedTextClass}
              inactiveTabClass={inactiveTabClass}
              attachedActiveTabClass={attachedActiveTabClass}
              onFocusTab={focusExplorerTab}
              onCloseTab={closeExplorerTab}
            />
          </View>

          <View className={`gap-4 border-b px-4 py-4 ${dividerClass}`}>
            <NexusPacketExplorerToolbar
              activeTab={activeTab}
              activePacketId={activePacketId}
              activePacketFamily={activePacketFamily}
              viewModes={VIEW_AS_MODES}
              onSelectViewMode={(viewMode) =>
                setExplorerTabViewMode({
                  tabId: activeTab.id,
                  viewMode,
                })
              }
              onViewInLibrary={handleOpenPacketInLibrary}
            />

            {activeTab.kind === 'packet' ? (
              <NexusPacketExplorerPrimaryRail
                activeId={activeTab.active_primary_tab}
                onSelect={(primaryTab) =>
                  setExplorerPrimaryTab({
                    tabId: activeTab.id,
                    primaryTab,
                  })
                }
              />
            ) : null}
          </View>

          <View className="flex-1 min-h-0 px-4 py-4">
            <NexusPacketExplorerContent
              activeTab={activeTab}
              activePacketId={activePacketId}
              activePacketState={displayPacketState}
              searchValue={searchValue}
              rawCodeCardClass={rawCodeCardClass}
              headingTextClass={headingTextClass}
              onChangeSearchValue={setSearchValue}
              onRetryActivePacket={handleRetryActivePacket}
              onOpenPacketInExplorer={retargetActiveExplorerPacket}
              onViewInLibrary={handleOpenPacketInLibrary}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
