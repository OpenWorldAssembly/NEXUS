/**
 * File: nexus-packet-explorer.tsx
 * Description: Coordinates the shell-level Packet Explorer overlay, packet payload loading, and responsive panel layout.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  NexusActionButton,
  NexusCard,
  NexusChevronIcon,
  useNexusLoading,
} from '@app/components/nexus/ui';
import { NexusPacketExplorerContent } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-content';
import { NexusPacketExplorerPrimaryRail } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-primary-rail';
import {
  PACKET_EXPLORER_SEARCH_RESULTS_LOADING_SCOPE,
  type NexusPacketExplorerSearchCategory,
} from '@app/components/nexus/packet-explorer/nexus-packet-explorer-search-panel';
import { NexusPacketExplorerShellHeader } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-shell-header';
import { NexusPacketExplorerTabDeck } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-tab-deck';
import { NexusPacketExplorerToolbar } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-toolbar';
import type {
  ExplorerPacketLoadState,
  ExplorerPacketStateMap,
} from '@app/components/nexus/packet-explorer/nexus-packet-explorer-types';
import type {
  NexusPacketExplorerSearchPayload,
  NexusPacketVerificationActionPayload,
} from '@runtime/nexus/nexus-api-types';
import {
  EXPLORER_DESKTOP_BREAKPOINT,
} from '@app/components/nexus/packet-explorer/nexus-packet-explorer-resize-math';
import { useNexusPacketExplorerResize } from '@app/components/nexus/packet-explorer/use-nexus-packet-explorer-resize';
import {
  PACKET_FETCH_TIMEOUT_MS,
  logExplorerClientEvent,
} from '@app/components/nexus/packet-explorer/nexus-packet-explorer-utils';
import {
  fetchNexusPacketExplorerPayload,
  runNexusPacketVerification,
  searchNexusPacketExplorerPackets,
} from '@runtime/nexus/nexus-query-api';
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

const SEARCH_CATEGORY_PAGE_SIZE = 25;

function createDefaultSearchPageState(): Record<
  Exclude<NexusPacketExplorerSearchCategory, 'all'>,
  number
> {
  return {
    direct: 1,
    name: 1,
    text: 1,
  };
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
    openPacketInExplorer,
    retargetActiveExplorerPacket,
    setExplorerHomeSubtab,
    setExplorerPanelWidth,
    setExplorerPrimaryTab,
    setExplorerTabViewMode,
    openExplorer,
    getActiveExplorerTab,
    themeMode,
  } = useNexusShell();
  const router = useRouter();
  const loading = useNexusLoading();
  const { width } = useWindowDimensions();
  const [searchValue, setSearchValue] = useState('');
  const [searchResult, setSearchResult] =
    useState<NexusPacketExplorerSearchPayload | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchingPackets, setIsSearchingPackets] = useState(false);
  const [activeSearchCategory, setActiveSearchCategory] =
    useState<NexusPacketExplorerSearchCategory>('all');
  const [searchPageByCategory, setSearchPageByCategory] = useState<
    Record<Exclude<NexusPacketExplorerSearchCategory, 'all'>, number>
  >(createDefaultSearchPageState);
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState<string | null>(null);
  const [packetStates, setPacketStates] = useState<ExplorerPacketStateMap>({});
  const [retryNonceByPacketId, setRetryNonceByPacketId] = useState<
    Record<string, number>
  >({});
  const [isConfirmingCloseTabs, setIsConfirmingCloseTabs] = useState(false);
  const [isPacketShellBandCollapsed, setIsPacketShellBandCollapsed] = useState(false);
  const [isInspectorBandCollapsed, setIsInspectorBandCollapsed] = useState(false);
  const [validationNotice, setValidationNotice] =
    useState<NexusPacketVerificationActionPayload | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const activeTab = getActiveExplorerTab();
  const activePacketId = activeTab?.kind === 'packet' ? activeTab.packet_id : null;
  const isDesktop = width >= EXPLORER_DESKTOP_BREAKPOINT;
  const backdropClass =
    themeMode === 'dark' ? 'bg-slate-950/55' : 'bg-slate-900/20';
  const panelClass =
    themeMode === 'dark'
      ? 'border-nexus-line bg-nexus-canvas'
      : 'border-slate-300 bg-white';
  const dividerClass =
    themeMode === 'dark' ? 'border-nexus-line' : 'border-slate-300';
  const mutedTextClass =
    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600';
  const headingTextClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const rawCodeCardClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-black/20'
      : 'border-slate-300 bg-slate-100';
  const resizeHandleClass =
    themeMode === 'dark'
      ? 'border-nexus-line/80 bg-nexus-ink/90'
      : 'border-slate-300 bg-white/95';
  const sectionToggleClass =
    themeMode === 'dark'
      ? 'border-nexus-line bg-white/5'
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
  const {
    isDragging: isDraggingResizeHandle,
    resolvedPanelWidth,
    handleResizePressIn,
  } = useNexusPacketExplorerResize({
    isDesktop,
    viewportWidth: width,
    sessionPanelWidth: packetExplorerSession.panel_width,
    onCommitPanelWidth: setExplorerPanelWidth,
  });
  const overlayWidth = isDesktop ? resolvedPanelWidth : width;

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
    setSearchValue('');
    setSearchResult(null);
    setSearchError(null);
    setIsSearchingPackets(false);
    setActiveSearchCategory('all');
    setSearchPageByCategory(createDefaultSearchPageState());
    setSubmittedSearchQuery(null);
  }, [currentActorPacketId]);

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
  const activePacketType =
    activePayload?.packet_summary.type ?? activeTab.seed_summary?.type ?? null;

  const handleRetryActivePacket = () => {
    if (!activePacketId) {
      return;
    }

    setRetryNonceByPacketId((currentState) => ({
      ...currentState,
      [activePacketId]: (currentState[activePacketId] ?? 0) + 1,
    }));
  };

  const handleRunVerificationForActivePacket = async (packetId: string) => {
    try {
      const payload = await runNexusPacketVerification({
        packet_id: packetId,
      });

      setValidationError(null);
      setValidationNotice(payload);
      setRetryNonceByPacketId((currentState) => ({
        ...currentState,
        [packetId]: (currentState[packetId] ?? 0) + 1,
      }));
    } catch (error) {
      setValidationNotice(null);
      setValidationError(
        error instanceof Error ? error.message : 'Unable to validate packet.'
      );
    }
  };

  const handleOpenPacketInLibrary = (packetId: string, type?: string | null) => {
    router.push({
      pathname: '/nexus/library',
      params: {
        packet_id: packetId,
        ...(type ? { type } : {}),
      },
    });
    closeExplorer();
  };

  const handleRoutePacketToExport = (input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      type: string | null;
      summary: string | null;
      label: string | null;
    } | null;
  }) => {
    openExplorer({
      subtab: 'export',
      packetId: input.packetId,
      preferredRevisionId: input.preferredRevisionId ?? null,
      titleSnapshot: input.titleSnapshot ?? null,
      seedSummary: input.seedSummary ?? null,
    });
  };

  const handleClearExportTarget = () => {
    openExplorer({
      subtab: 'export',
      packetId: null,
      preferredRevisionId: null,
      titleSnapshot: null,
      seedSummary: null,
    });
  };

  const runPacketSearch = async (input: {
    query: string;
    category: NexusPacketExplorerSearchCategory;
    pageByCategory?: Record<Exclude<NexusPacketExplorerSearchCategory, 'all'>, number>;
  }) => {
    const nextPageByCategory = input.pageByCategory ?? searchPageByCategory;
    const activeGroup = input.category;
    const page = activeGroup === 'all' ? 1 : nextPageByCategory[activeGroup];
    const pageSize =
      activeGroup === 'all' ? 8 : SEARCH_CATEGORY_PAGE_SIZE;

    return searchNexusPacketExplorerPackets({
      query: input.query,
      active_group: activeGroup,
      page,
      page_size: pageSize,
      limit_per_group: 8,
      scope_mode: 'all_known',
      selected_packet_id: null,
    });
  };

  const handleSearchPackets = async () => {
    const trimmedQuery = searchValue.trim();
    const isIdentifierLike =
      trimmedQuery.includes(':') ||
      trimmedQuery.includes('@') ||
      trimmedQuery.includes('/');

    if ((!isIdentifierLike && trimmedQuery.length < 2) || trimmedQuery.length === 0) {
      setSearchError(
        trimmedQuery.length === 0
          ? 'Enter a packet clue before searching.'
          : 'Search text must be at least 2 characters long.'
      );
      setSearchResult(null);
      setActiveSearchCategory('all');
      return;
    }

    setIsSearchingPackets(true);
    setSearchError(null);
    const operationId = loading.beginLoading(
      PACKET_EXPLORER_SEARCH_RESULTS_LOADING_SCOPE,
      { label: 'Searching packets...' }
    );

    try {
      const nextPageByCategory = createDefaultSearchPageState();
      const nextSearchResult = await runPacketSearch({
        query: trimmedQuery,
        category: 'all',
        pageByCategory: nextPageByCategory,
      });

      setSearchResult(nextSearchResult);
      setActiveSearchCategory('all');
      setSearchPageByCategory(nextPageByCategory);
      setSubmittedSearchQuery(trimmedQuery);
    } catch (error) {
      setSearchResult(null);
      setSearchError(
        error instanceof Error
          ? error.message
          : 'Unable to search Packet Explorer packets right now.'
      );
    } finally {
      setIsSearchingPackets(false);
      loading.endLoading(operationId);
    }
  };

  const handleClearSearch = () => {
    setSearchValue('');
    setSearchResult(null);
    setSearchError(null);
    setActiveSearchCategory('all');
    setSearchPageByCategory(createDefaultSearchPageState());
    setSubmittedSearchQuery(null);
  };

  const handleSelectSearchCategory = async (
    category: NexusPacketExplorerSearchCategory
  ) => {
    setActiveSearchCategory(category);

    if (!submittedSearchQuery) {
      return;
    }

    setIsSearchingPackets(true);
    setSearchError(null);
    const operationId = loading.beginLoading(
      PACKET_EXPLORER_SEARCH_RESULTS_LOADING_SCOPE,
      { label: 'Searching packets...' }
    );

    try {
      const nextSearchResult = await runPacketSearch({
        query: submittedSearchQuery,
        category,
      });

      setSearchResult(nextSearchResult);
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : 'Unable to search Packet Explorer packets right now.'
      );
    } finally {
      setIsSearchingPackets(false);
      loading.endLoading(operationId);
    }
  };

  const handleChangeSearchCategoryPage = async (
    category: Exclude<NexusPacketExplorerSearchCategory, 'all'>,
    nextPage: number
  ) => {
    if (!submittedSearchQuery) {
      return;
    }

    const nextPageByCategory = {
      ...searchPageByCategory,
      [category]: nextPage,
    };

    setSearchPageByCategory(nextPageByCategory);
    setActiveSearchCategory(category);
    setIsSearchingPackets(true);
    setSearchError(null);
    const operationId = loading.beginLoading(
      PACKET_EXPLORER_SEARCH_RESULTS_LOADING_SCOPE,
      { label: 'Searching packets...' }
    );

    try {
      const nextSearchResult = await runPacketSearch({
        query: submittedSearchQuery,
        category,
        pageByCategory: nextPageByCategory,
      });

      setSearchResult(nextSearchResult);
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : 'Unable to change Packet Explorer search pages right now.'
      );
    } finally {
      setIsSearchingPackets(false);
      loading.endLoading(operationId);
    }
  };

  return (
    <>
    <View className="absolute inset-0 z-30 flex-row justify-end">
      {isDraggingResizeHandle ? (
        <View
          className="absolute inset-0 z-50"
          onMoveShouldSetResponder={() => true}
          onStartShouldSetResponder={() => true}
        />
      ) : null}

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
            <Pressable
              accessibilityRole="button"
              className="absolute left-0 top-0 z-40 h-full w-5 items-center justify-center"
              onPressIn={handleResizePressIn}
            >
              <View
                className={`h-20 w-[6px] rounded-full border ${resizeHandleClass}`}
              />
            </Pressable>
          ) : null}

          <View className={`gap-4 border-b px-4 py-4 ${dividerClass}`}>
            <NexusPacketExplorerShellHeader
              title={activeTitle}
              showPacketsButton={isPacketShellBandCollapsed}
              showViewsButton={isInspectorBandCollapsed}
              onOpenHomeTab={() => openExplorer()}
              onCloseExplorer={closeExplorer}
              onOpenPacketsBand={() => setIsPacketShellBandCollapsed(false)}
              onOpenViewsBand={() => setIsInspectorBandCollapsed(false)}
            />

            {!isPacketShellBandCollapsed ? (
              <View className="flex-row items-start gap-3">
                <View className="min-w-0 flex-1">
                  <NexusPacketExplorerTabDeck
                    tabs={packetExplorerSession.tabs}
                    activeTabId={activeTab.id}
                    notice={packetExplorerSession.notice}
                    headingTextClass={headingTextClass}
                    mutedTextClass={mutedTextClass}
                    isConfirmingCloseTabs={isConfirmingCloseTabs}
                    onFocusTab={focusExplorerTab}
                    onCloseTab={closeExplorerTab}
                    onToggleCloseTabsConfirmation={() =>
                      setIsConfirmingCloseTabs((currentValue) => !currentValue)
                    }
                    onConfirmCloseTabs={() => {
                      setIsConfirmingCloseTabs(false);
                      closeExplorerTabs();
                    }}
                  />
                </View>

                <Pressable
                  accessibilityRole="button"
                  className={`rounded-full border px-3 py-2 ${sectionToggleClass}`}
                  onPress={() => {
                    setIsConfirmingCloseTabs(false);
                    setIsPacketShellBandCollapsed(true);
                  }}
                >
                  <NexusChevronIcon isOpen={true} />
                </Pressable>
              </View>
            ) : null}
          </View>

          {!isInspectorBandCollapsed ? (
            <View className={`border-b px-4 py-4 ${dividerClass}`}>
              <View className="flex-row items-start gap-3">
                <View className="min-w-0 flex-1 gap-4">
                  <NexusPacketExplorerToolbar
                    activeTab={activeTab}
                    activePacketId={activePacketId}
                    activePacketType={activePacketType}
                    activeHomeSubtab={
                      activeTab.kind === 'home' ? activeTab.active_home_subtab : undefined
                    }
                    onExportPacket={(input) =>
                      openExplorer({
                        subtab: 'export',
                        packetId: input.packetId,
                        preferredRevisionId: input.preferredRevisionId ?? null,
                        titleSnapshot: input.titleSnapshot ?? null,
                        seedSummary: input.seedSummary ?? null,
                      })
                    }
                    onSelectHomeSubtab={(subtab) =>
                      setExplorerHomeSubtab({
                        tabId: activeTab.id,
                        subtab,
                      })
                    }
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

                <Pressable
                  accessibilityRole="button"
                  className={`rounded-full border px-3 py-2 ${sectionToggleClass}`}
                  onPress={() => setIsInspectorBandCollapsed(true)}
                >
                  <NexusChevronIcon isOpen={true} />
                </Pressable>
              </View>
            </View>
          ) : null}

        <View className="flex-1 min-h-0 px-4 py-4">
            <NexusPacketExplorerContent
              activeTab={activeTab}
              activePacketId={activePacketId}
              activePacketState={displayPacketState}
              searchValue={searchValue}
              searchResult={searchResult}
              searchError={searchError}
              isSearching={isSearchingPackets}
              activeSearchCategory={activeSearchCategory}
              rawCodeCardClass={rawCodeCardClass}
              headingTextClass={headingTextClass}
              onChangeSearchValue={(value) => {
                setSearchValue(value);
                setSearchError(null);
              }}
              onSearchPackets={() => void handleSearchPackets()}
              onClearSearch={handleClearSearch}
              onSelectSearchCategory={(category) =>
                void handleSelectSearchCategory(category)
              }
              onChangeSearchCategoryPage={(category, nextPage) =>
                void handleChangeSearchCategoryPage(category, nextPage)
              }
              onRetryActivePacket={handleRetryActivePacket}
              onOpenPacketInNewTab={openPacketInExplorer}
              onOpenPacketInCurrentTab={retargetActiveExplorerPacket}
              onRoutePacketToExport={handleRoutePacketToExport}
              onClearExportTarget={handleClearExportTarget}
              onViewInLibrary={handleOpenPacketInLibrary}
              onRunVerificationForActivePacket={handleRunVerificationForActivePacket}
            />
          </View>
        </View>
      </View>
    </View>
    <Modal
      animationType="fade"
      onRequestClose={() => {
        setValidationNotice(null);
        setValidationError(null);
      }}
      transparent
      visible={validationNotice !== null || validationError !== null}
    >
      <View className="flex-1">
        <Pressable
          accessibilityRole="button"
          className="absolute inset-0 bg-black/55"
          onPress={() => {
            setValidationNotice(null);
            setValidationError(null);
          }}
        />
        <View className="flex-1 items-center justify-center px-4">
          <NexusCard className="w-full max-w-[520px] gap-4">
            <Text className={headingTextClass}>
              {validationNotice?.title ?? 'Validation failed'}
            </Text>
            <Text className={mutedTextClass}>
              {validationNotice?.summary ?? validationError ?? ''}
            </Text>
            {validationNotice ? (
              <Text className={mutedTextClass}>
                Validated at: {validationNotice.validated_at}
              </Text>
            ) : null}
            {validationNotice?.warnings.length ? (
              <View className="gap-1">
                {validationNotice.warnings.map((warning) => (
                  <Text key={warning} className={mutedTextClass}>
                    {warning}
                  </Text>
                ))}
              </View>
            ) : null}
            <View className="flex-row justify-end">
              <NexusActionButton
                label="Dismiss"
                variant="ghost"
                onPress={() => {
                  setValidationNotice(null);
                  setValidationError(null);
                }}
              />
            </View>
          </NexusCard>
        </View>
      </View>
    </Modal>
    </>
  );
}
