/**
 * File: nexus-packet-explorer.tsx
 * Description: Renders the shell-level Packet Explorer overlay with session-persistent tabs.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import type {
  NexusActionIntentDescriptor,
  NexusActionState,
} from '@core/contracts';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import type {
  NexusPacketExplorerLinkRow,
  NexusPacketExplorerPayload,
} from '@runtime/nexus/nexus-api-types';
import { fetchNexusPacketExplorerPayload } from '@runtime/nexus/nexus-query-api';
import {
  createPacketExplorerRequestKey,
  PACKET_EXPLORER_VIEW_MODES,
  type PacketExplorerTab,
  type PacketExplorerViewMode,
} from '@runtime/nexus/packet-explorer-session';

type ExplorerPacketLoadState = {
  request_key: string;
  status: 'loading' | 'loaded' | 'error';
  payload: NexusPacketExplorerPayload | null;
  error: string | null;
  last_loaded_revision_id: string | null;
};

type ExplorerPacketStateMap = Record<string, ExplorerPacketLoadState | undefined>;

const PACKET_FETCH_TIMEOUT_MS = 15000;
const EXPLORER_CLIENT_DEBUG_ENABLED = process.env.NODE_ENV !== 'production';
const VIEW_AS_MODES: PacketExplorerViewMode[] = [
  'summary',
  'raw',
  'adapted',
  'read_model',
];

function logExplorerClientEvent(packetId: string, message: string): void {
  if (!EXPLORER_CLIENT_DEBUG_ENABLED) {
    return;
  }

  console.info(`[Packet Explorer UI] ${packetId} :: ${message}`);
}

function formatTimestamp(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return 'Unable to serialize this view as JSON.';
  }
}

function getExplorerTabLabel(tab: PacketExplorerTab): string {
  if (tab.kind === 'home') {
    return 'Explorer';
  }

  return tab.title_snapshot.length > 36
    ? `${tab.title_snapshot.slice(0, 33)}...`
    : tab.title_snapshot;
}

function getViewModeLabel(viewMode: PacketExplorerViewMode): string {
  return viewMode
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatActionLabel(actionId: string): string {
  const [, actionName = actionId] = actionId.split('.');

  return actionName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getLinkTitle(link: NexusPacketExplorerLinkRow): string {
  return link.title ?? link.label ?? link.packet_id;
}

function getActionState(
  payload: NexusPacketExplorerPayload,
  descriptor: NexusActionIntentDescriptor
): NexusActionState | null {
  return payload.actions[descriptor.id] ?? null;
}

/**
 * Inputs: none.
 * Output: the global Packet Explorer overlay when the session is open.
 */
export default function NexusPacketExplorer() {
  const {
    currentActorPacketId,
    openPacketInExplorer,
    packetExplorerSession,
    closeExplorer,
    closeExplorerTab,
    focusExplorerTab,
    setExplorerTabViewMode,
    openExplorer,
    getActiveExplorerTab,
    themeMode,
  } = useNexusShell();
  const appearance = useNexusAppearance();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [searchValue, setSearchValue] = useState('');
  const [packetStates, setPacketStates] = useState<ExplorerPacketStateMap>({});
  const [retryNonceByPacketId, setRetryNonceByPacketId] = useState<
    Record<string, number>
  >({});
  const activeTab = getActiveExplorerTab();
  const activePacketId = activeTab?.kind === 'packet' ? activeTab.packet_id : null;
  const isDesktop = width >= 1100;
  const overlayWidth = isDesktop
    ? Math.min(Math.max(width * 0.7, 720), 980)
    : Math.min(width * 0.96, 760);
  const backdropClass =
    themeMode === 'dark' ? 'bg-slate-950/55' : 'bg-slate-900/20';
  const panelClass =
    themeMode === 'dark'
      ? 'border-nexus-line bg-nexus-canvas'
      : 'border-slate-300 bg-white';
  const dividerClass =
    themeMode === 'dark' ? 'border-nexus-line' : 'border-slate-300';
  const tabRailClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-white/5'
      : 'border-slate-300 bg-slate-100';
  const activeTabClass =
    themeMode === 'dark'
      ? 'border-nexus-sky/70 bg-nexus-sky/10'
      : 'border-sky-300 bg-sky-100';
  const inactiveTabClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-white/5'
      : 'border-slate-300 bg-slate-100';
  const mutedTextClass =
    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600';
  const headingTextClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const rawCodeCardClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-black/20'
      : 'border-slate-300 bg-slate-100';
  const activePacketState = activePacketId ? packetStates[activePacketId] : undefined;
  const activePayload = activePacketState?.payload ?? null;
  const activePacketStateRef = useRef<ExplorerPacketLoadState | undefined>(
    activePacketState
  );
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
    setPacketStates({});
    setRetryNonceByPacketId({});
  }, [currentActorPacketId]);

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
    currentActorPacketId,
    packetExplorerSession.is_open,
    activeTabKind,
  ]);

  const viewModes = useMemo(
    () =>
      PACKET_EXPLORER_VIEW_MODES.map((viewMode) => ({
        id: viewMode,
        label: getViewModeLabel(viewMode),
      })),
    []
  );

  if (!packetExplorerSession.is_open || !activeTab) {
    return null;
  }

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

  const renderHomeTab = () => (
    <View className="gap-4">
      <NexusCard className="gap-4">
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Packet Explorer
          </Text>
          <Text className={appearance.surfaceTitleClass}>
            Global Packet Workspace
          </Text>
          <Text className={appearance.sectionBodyClass}>
            Open packets from Library to inspect them here. Search, import, and
            bundle tools are visible now and will be wired in later passes.
          </Text>
        </View>

        <TextInput
          className={`rounded-[22px] border px-4 py-3 ${appearance.textInputClass}`}
          onChangeText={setSearchValue}
          placeholder="Paste a packet id or revision id"
          placeholderTextColor={appearance.textInputPlaceholderColor}
          value={searchValue}
        />

        <View className="flex-row flex-wrap gap-2">
          <NexusActionButton label="Search packets" disabled />
          <NexusActionButton label="Import packet" disabled />
          <NexusActionButton label="Import bundle" disabled />
          <NexusActionButton label="Open recent" disabled />
        </View>
      </NexusCard>

      <NexusCard tone="gold">
        <Text className={appearance.itemBodyClass}>
          Search and import flows remain visible but read-only in this phase.
          Use the live Library `Open packet` action to inspect packet data now.
        </Text>
      </NexusCard>
    </View>
  );

  const renderSeededSummary = () => {
    if (activeTab.kind !== 'packet') {
      return null;
    }

    return (
      <View className="gap-4">
        <NexusCard className="gap-4">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className={appearance.surfaceTitleClass}>
              {activeTab.title_snapshot}
            </Text>
            {activeTab.seed_summary?.family ? (
              <NexusBadge label={activeTab.seed_summary.family} tone="sky" />
            ) : null}
            <NexusBadge label="Seeded from current surface" tone="gold" />
          </View>

          <Text className={appearance.sectionBodyClass}>
            {activeTab.seed_summary?.summary ??
              activeTab.seed_summary?.label ??
              'Explorer is loading the full packet inspector payload.'}
          </Text>

          <View className="gap-2">
            <Text className={appearance.itemMetaClass}>
              Packet ID: {activeTab.packet_id}
            </Text>
            <Text className={appearance.itemMetaClass}>
              Preferred revision:{' '}
              {activeTab.preferred_revision_id ?? 'Loading current preferred revision...'}
            </Text>
          </View>
        </NexusCard>

        <NexusCard tone="gold">
          <Text className={appearance.itemBodyClass}>
            Loading packet details...
          </Text>
        </NexusCard>
      </View>
    );
  };

  const renderSummaryTab = (payload: NexusPacketExplorerPayload) => (
    <View className="gap-4">
      <NexusCard className="gap-4">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className={appearance.surfaceTitleClass}>
            {payload.packet_summary.title}
          </Text>
          <NexusBadge label={payload.packet_summary.family} tone="sky" />
          {payload.packet_summary.kind ? (
            <NexusBadge label={payload.packet_summary.kind} tone="default" />
          ) : null}
          <NexusBadge label={payload.revision_state} tone="gold" />
        </View>

        <Text className={appearance.sectionBodyClass}>
          {payload.packet_summary.summary ?? payload.packet_summary.label}
        </Text>

        <View className="gap-2">
          <Text className={appearance.itemMetaClass}>
            Packet ID: {payload.packet_summary.packet.packet_id}
          </Text>
          <Text className={appearance.itemMetaClass}>
            Preferred revision: {payload.preferred_revision.revision_id}
          </Text>
          <Text className={appearance.itemMetaClass}>
            Schema version: {payload.packet_summary.schema_version}
          </Text>
          <Text className={appearance.itemMetaClass}>
            Current revision timestamp:{' '}
            {formatTimestamp(payload.packet_summary.created_at)}
          </Text>
          <Text className={appearance.itemMetaClass}>
            Head revisions: {payload.head_revisions.length}
          </Text>
        </View>
      </NexusCard>

      <NexusCard className="gap-3">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          Scope Context
        </Text>
        <Text className={appearance.itemBodyClass}>
          Authority scope:{' '}
          {payload.packet_summary.authority_scope?.label ??
            payload.packet_summary.authority_scope?.packet_id ??
            'None'}
        </Text>
        <View className="gap-2">
          <Text className={appearance.itemMetaClass}>Applicable scopes</Text>
          {payload.packet_summary.applicable_scopes.length > 0 ? (
            payload.packet_summary.applicable_scopes.map((scope) => (
              <Text key={scope.packet_id} className={appearance.itemBodyClass}>
                {scope.label ?? scope.packet_id}
              </Text>
            ))
          ) : (
            <Text className={appearance.itemBodyClass}>No additional scopes.</Text>
          )}
        </View>
      </NexusCard>
    </View>
  );

  const renderJsonTab = (title: string, value: unknown) => (
    <NexusCard className={`gap-3 ${rawCodeCardClass}`}>
      <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
        {title}
      </Text>
      <ScrollView className="max-h-[560px]" showsVerticalScrollIndicator={false}>
        <Text className={`text-xs leading-6 ${headingTextClass}`} selectable>
          {formatJson(value)}
        </Text>
      </ScrollView>
    </NexusCard>
  );

  const renderAdaptationSummary = (payload: NexusPacketExplorerPayload) => (
    <NexusCard className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          Adaptation Summary
        </Text>
        <NexusBadge
          label={payload.adaptation_summary.compatibility_mode}
          tone={
            payload.adaptation_summary.compatibility_mode === 'native'
              ? 'mint'
              : payload.adaptation_summary.compatibility_mode === 'lossy' ||
                  payload.adaptation_summary.compatibility_mode === 'blocked'
                ? 'rose'
                : 'gold'
          }
        />
      </View>

      <Text className={appearance.itemMetaClass}>
        {payload.adaptation_summary.source_family} {payload.adaptation_summary.source_schema_version}
        {' -> '}
        {payload.adaptation_summary.target_family} {payload.adaptation_summary.target_schema_version}
      </Text>
      <Text className={appearance.itemBodyClass}>
        Stages: {payload.adaptation_summary.stages.join(', ')}
      </Text>
      <Text className={appearance.itemBodyClass}>
        Changes: {payload.adaptation_summary.changes.length} | Losses:{' '}
        {payload.adaptation_summary.losses.length}
      </Text>
      {payload.adaptation_summary.warnings.length > 0 ? (
        <View className="gap-2">
          <Text className={appearance.itemMetaClass}>Warnings</Text>
          {payload.adaptation_summary.warnings.map((warning) => (
            <Text key={warning} className={appearance.itemBodyClass}>
              {warning}
            </Text>
          ))}
        </View>
      ) : null}
    </NexusCard>
  );

  const renderLineageTab = (payload: NexusPacketExplorerPayload) => (
    <View className="gap-4">
      <NexusCard className="gap-3">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          Revision State
        </Text>
        <Text className={appearance.surfaceTitleClass}>
          {payload.revision_state}
        </Text>
        <Text className={appearance.itemMetaClass}>
          Preferred revision: {payload.preferred_revision.revision_id}
        </Text>
        <Text className={appearance.itemMetaClass}>
          Head count: {payload.head_revisions.length}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <NexusActionButton label="Compare revisions" disabled />
        </View>
      </NexusCard>

      <NexusCard className="gap-3">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          Head Revisions
        </Text>
        {payload.head_revisions.map((revision) => (
          <Text key={revision.revision_id} className={appearance.itemBodyClass}>
            {revision.revision_id}
          </Text>
        ))}
      </NexusCard>
    </View>
  );

  const renderLinkSection = (
    title: string,
    links: NexusPacketExplorerLinkRow[]
  ) => (
    <NexusCard className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          {title}
        </Text>
        <NexusBadge label={`${links.length}`} tone="gold" />
      </View>
      {links.length > 0 ? (
        links.map((link) => (
          <View
            key={`${link.direction}:${link.edge_type}:${link.packet_id}:${link.revision_id ?? 'current'}`}
            className={`gap-2 rounded-[24px] border p-4 ${tabRailClass}`}
          >
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className={`text-base font-semibold ${headingTextClass}`}>
                {getLinkTitle(link)}
              </Text>
              <NexusBadge label={link.edge_type} tone="sky" />
              {link.family ? (
                <NexusBadge label={link.family} tone="default" />
              ) : null}
            </View>
            <Text className={appearance.itemMetaClass}>{link.packet_id}</Text>
            {link.revision_id ? (
              <Text className={appearance.itemMetaClass}>
                Revision: {link.revision_id}
              </Text>
            ) : null}
            <View className="flex-row flex-wrap gap-2">
              <NexusActionButton
                label="Open in Explorer"
                onPress={() =>
                  openPacketInExplorer({
                    packetId: link.packet_id,
                    titleSnapshot: link.title ?? link.label ?? link.packet_id,
                    seedSummary: {
                      family: link.family,
                      summary: null,
                      label: link.label,
                    },
                  })
                }
              />
              <NexusActionButton
                label="View in Library"
                onPress={() => handleOpenPacketInLibrary(link.packet_id, link.family)}
              />
            </View>
          </View>
        ))
      ) : (
        <Text className={appearance.itemBodyClass}>No {title.toLowerCase()}.</Text>
      )}
    </NexusCard>
  );

  const renderLinksTab = (payload: NexusPacketExplorerPayload) => (
    <View className="gap-4">
      {renderLinkSection('Outgoing Links', payload.outgoing_links)}
      {renderLinkSection('Incoming Links', payload.incoming_links)}
    </View>
  );

  const renderActionsTab = (payload: NexusPacketExplorerPayload) => {
    if (payload.action_descriptors.length === 0) {
      return (
        <NexusCard>
          <Text className={appearance.itemBodyClass}>
            No runtime action descriptors are projected for this packet yet.
          </Text>
        </NexusCard>
      );
    }

    return (
      <View className="gap-4">
        {payload.action_descriptors.map((descriptor) => {
          const actionState = getActionState(payload, descriptor);

          return (
            <NexusCard key={descriptor.id} className="gap-3">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className={appearance.surfaceTitleClass}>
                  {formatActionLabel(descriptor.id)}
                </Text>
                <NexusBadge label={descriptor.execution_kind} tone="sky" />
                {descriptor.mutation_kind ? (
                  <NexusBadge label={descriptor.mutation_kind} tone="gold" />
                ) : null}
                <NexusBadge
                  label={
                    actionState
                      ? actionState.enabled
                        ? 'enabled'
                        : 'blocked'
                      : 'not_applicable'
                  }
                  tone={
                    actionState
                      ? actionState.enabled
                        ? 'mint'
                        : 'rose'
                      : 'default'
                  }
                />
              </View>

              <Text className={appearance.itemMetaClass}>
                Action id: {descriptor.id}
              </Text>
              {descriptor.target_kind ? (
                <Text className={appearance.itemMetaClass}>
                  Target kind: {descriptor.target_kind}
                </Text>
              ) : null}
              {actionState ? (
                <View className="gap-2">
                  <Text className={appearance.itemBodyClass}>
                    Reason: {actionState.reason ?? 'Available'}
                  </Text>
                  {actionState.auth_gate_reason ? (
                    <Text className={appearance.itemMetaClass}>
                      Auth gate: {actionState.auth_gate_reason}
                    </Text>
                  ) : null}
                  {actionState.target_packet_id ? (
                    <Text className={appearance.itemMetaClass}>
                      Target packet: {actionState.target_packet_id}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text className={appearance.itemBodyClass}>
                  No runtime state is projected for this action on the current
                  packet.
                </Text>
              )}
            </NexusCard>
          );
        })}
      </View>
    );
  };

  const renderPacketTab = () => {
    if (!activePacketId || !activeTab) {
      return null;
    }

    if (!activePacketState) {
      return renderSeededSummary();
    }

    if (activePacketState.status === 'loading' && !activePacketState.payload) {
      return renderSeededSummary();
    }

    if (activePacketState.status === 'error' && !activePacketState.payload) {
      return (
        <View className="gap-4">
          {renderSeededSummary()}
          <NexusCard tone="rose" className="gap-3">
            <Text className={appearance.itemBodyClass}>{activePacketState.error}</Text>
            <View className="flex-row flex-wrap gap-2">
              <NexusActionButton label="Retry" onPress={handleRetryActivePacket} />
            </View>
          </NexusCard>
        </View>
      );
    }

    const payload = activePacketState.payload;

    if (!payload) {
      return renderSeededSummary();
    }

    const renderActivePayloadView = () => {
      if (activeTab.active_view_mode === 'summary') {
        return renderSummaryTab(payload);
      }

      if (activeTab.active_view_mode === 'raw') {
        return renderJsonTab('Historical Raw Envelope', payload.raw_view);
      }

      if (activeTab.active_view_mode === 'adapted') {
        return (
          <View className="gap-4">
            {renderAdaptationSummary(payload)}
            {renderJsonTab('Current Adapted Packet', payload.adapted_view)}
          </View>
        );
      }

      if (activeTab.active_view_mode === 'read_model') {
        return (
          <View className="gap-4">
            {renderAdaptationSummary(payload)}
            {payload.read_model_view !== null ? (
              renderJsonTab('Read Model Projection', payload.read_model_view)
            ) : (
              <NexusCard tone="gold">
                <Text className={appearance.itemBodyClass}>
                  Read model projection is not available for this packet yet.
                </Text>
              </NexusCard>
            )}
          </View>
        );
      }

      if (activeTab.active_view_mode === 'lineage') {
        return renderLineageTab(payload);
      }

      if (activeTab.active_view_mode === 'links') {
        return renderLinksTab(payload);
      }

      if (activeTab.active_view_mode === 'actions') {
        return renderActionsTab(payload);
      }

      return null;
    };

    if (activePacketState.status === 'error') {
      return (
        <View className="gap-4">
          {renderActivePayloadView()}
          <NexusCard tone="rose" className="gap-3">
            <Text className={appearance.itemBodyClass}>{activePacketState.error}</Text>
            <View className="flex-row flex-wrap gap-2">
              <NexusActionButton label="Retry" onPress={handleRetryActivePacket} />
            </View>
          </NexusCard>
        </View>
      );
    }

    if (activePacketState.status === 'loading') {
      return (
        <View className="gap-4">
          {renderActivePayloadView()}
          <NexusCard tone="gold">
            <Text className={appearance.itemBodyClass}>
              Refreshing packet details...
            </Text>
          </NexusCard>
        </View>
      );
    }

    return renderActivePayloadView();
  };

  return (
    <View className="absolute inset-0 z-30 flex-row justify-end">
      <Pressable
        accessibilityRole="button"
        className={`flex-1 ${backdropClass}`}
        onPress={closeExplorer}
      />

      <View
        className={`h-full border-l ${panelClass}`}
        style={{ width: overlayWidth }}
      >
        <View className={`gap-4 border-b px-4 py-4 ${dividerClass}`}>
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Packet Explorer
              </Text>
              <Text className={`text-2xl font-bold ${headingTextClass}`}>
                {activeTab.kind === 'home'
                  ? 'Explorer Home'
                  : activePayload?.packet_summary.title ?? activeTab.title_snapshot}
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <NexusActionButton label="Home tab" onPress={openExplorer} />
              <NexusActionButton label="Close" onPress={closeExplorer} />
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-grow-0"
          >
            <View className="flex-row items-center gap-2">
              {packetExplorerSession.tabs.map((tab) => {
                const isActive = tab.id === activeTab.id;

                return (
                  <View
                    key={tab.id}
                    className={`flex-row items-center gap-2 rounded-full border px-3 py-2 ${
                      isActive ? activeTabClass : inactiveTabClass
                    }`}
                  >
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => focusExplorerTab(tab.id)}
                    >
                      <Text className={`text-sm font-semibold ${headingTextClass}`}>
                        {getExplorerTabLabel(tab)}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => closeExplorerTab(tab.id)}
                    >
                      <Text className={`text-xs font-semibold ${mutedTextClass}`}>
                        x
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <View className={`gap-4 border-b px-4 py-4 ${dividerClass}`}>
          <View className="flex-row flex-wrap items-center gap-2">
            {activeTab.kind === 'packet' ? (
              <>
                <Text className={appearance.itemMetaClass}>View as</Text>
                {VIEW_AS_MODES.map((viewMode) => (
                  <NexusActionButton
                    key={viewMode}
                    label={getViewModeLabel(viewMode)}
                    onPress={() =>
                      setExplorerTabViewMode({
                        tabId: activeTab.id,
                        viewMode,
                      })
                    }
                    variant={
                      activeTab.active_view_mode === viewMode ? 'primary' : 'secondary'
                    }
                  />
                ))}
              </>
            ) : (
              <NexusBadge label="Read-only preview" tone="gold" />
            )}
            <NexusActionButton label="Follow" disabled />
            <NexusActionButton label="Fork" disabled />
            <NexusActionButton label="Export" disabled />
            <NexusActionButton
              label="View in Library"
              disabled={activeTab.kind !== 'packet'}
              onPress={() =>
                activePacketId
                  ? handleOpenPacketInLibrary(
                      activePacketId,
                      activePayload?.packet_summary.family ??
                        activeTab.seed_summary?.family ??
                        null
                    )
                  : undefined
              }
            />
          </View>

          {activeTab.kind === 'packet' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-grow-0"
            >
              <View className="flex-row items-center gap-2">
                {viewModes.map((viewMode) => {
                  const isActive = activeTab.active_view_mode === viewMode.id;

                  return (
                    <Pressable
                      key={viewMode.id}
                      accessibilityRole="button"
                      className={`rounded-full border px-3 py-2 ${
                        isActive ? activeTabClass : tabRailClass
                      }`}
                      onPress={() =>
                        setExplorerTabViewMode({
                          tabId: activeTab.id,
                          viewMode: viewMode.id,
                        })
                      }
                    >
                      <Text className={`text-sm font-semibold ${headingTextClass}`}>
                        {viewMode.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          ) : null}
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-4 py-4"
          showsVerticalScrollIndicator={false}
        >
          {activeTab.kind === 'home' ? renderHomeTab() : renderPacketTab()}
        </ScrollView>
      </View>
    </View>
  );
}
