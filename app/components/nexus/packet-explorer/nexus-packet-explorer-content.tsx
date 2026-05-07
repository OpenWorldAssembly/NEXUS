import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import type {
  NexusPacketExplorerPayload,
  NexusPacketExplorerSearchPayload,
} from '@runtime/nexus/nexus-api-types';
import type {
  PacketExplorerPrimaryTab,
  PacketExplorerTab,
} from '@runtime/nexus/packet-explorer-session';

import type { NexusPacketExplorerSearchCategory } from './nexus-packet-explorer-search-panel';
import type { ExplorerPacketLoadState } from './nexus-packet-explorer-types';
import { NexusPacketExplorerDataPanel } from './nexus-packet-explorer-data-panel';
import { NexusPacketExplorerHomePanel } from './nexus-packet-explorer-home-panel';
import { NexusPacketExplorerLinksPanel } from './nexus-packet-explorer-links-panel';
import {
  formatActionLabel,
  getActionState,
  getActionsBasisLabel,
  getViewModeLabel,
} from './nexus-packet-explorer-utils';

type PacketExplorerRoutePacketInput = {
  packetId: string;
  preferredRevisionId?: string | null;
  titleSnapshot?: string | null;
  seedSummary?: {
    family: string | null;
    summary: string | null;
    label: string | null;
  } | null;
};

type NexusPacketExplorerContentProps = {
  activeTab: PacketExplorerTab;
  activePacketId: string | null;
  activePacketState: ExplorerPacketLoadState | undefined;
  searchValue: string;
  searchResult: NexusPacketExplorerSearchPayload | null;
  searchError: string | null;
  isSearching: boolean;
  activeSearchCategory: NexusPacketExplorerSearchCategory;
  rawCodeCardClass: string;
  headingTextClass: string;
  onChangeSearchValue: (value: string) => void;
  onSearchPackets: () => void;
  onClearSearch: () => void;
  onSelectSearchCategory: (category: NexusPacketExplorerSearchCategory) => void;
  onChangeSearchCategoryPage: (
    category: Exclude<NexusPacketExplorerSearchCategory, 'all'>,
    nextPage: number
  ) => void;
  onRetryActivePacket: () => void;
  onOpenPacketInNewTab: (input: PacketExplorerRoutePacketInput) => void;
  onOpenPacketInCurrentTab: (input: PacketExplorerRoutePacketInput) => void;
  onRoutePacketToExport: (input: PacketExplorerRoutePacketInput) => void;
  onClearExportTarget: () => void;
  onViewInLibrary: (packetId: string, family?: string | null) => void;
};

function NexusPacketExplorerSeededSummary({
  activeTab,
}: {
  activeTab: PacketExplorerTab;
}) {
  const appearance = useNexusAppearance();

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
}

function NexusPacketExplorerLineagePanel({
  payload,
}: {
  payload: NexusPacketExplorerPayload;
}) {
  const appearance = useNexusAppearance();

  return (
    <View className="gap-4">
      <NexusCard className="gap-3">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Revision State
          </Text>
          <NexusBadge label={getViewModeLabel(payload.inspection_lens)} tone="default" />
        </View>
        <Text className={appearance.surfaceTitleClass}>
          {payload.revision_state}
        </Text>
        <Text className={appearance.itemMetaClass}>
          Preferred revision: {payload.preferred_revision.revision_id}
        </Text>
        <Text className={appearance.itemMetaClass}>
          Head count: {payload.head_revisions.length}
        </Text>
        <Text className={appearance.itemBodyClass}>
          Current lineage remains revision-graph based while the inspection lens is{' '}
          {getViewModeLabel(payload.inspection_lens)}.
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <NexusActionButton
            label="Compare revisions"
            disabled
            featureStatusId="explorer.lineage.compare_revisions"
          />
          <NexusActionButton
            label="Diff"
            disabled
            featureStatusId="explorer.lineage.diff"
          />
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
}

function NexusPacketExplorerActionsPanel({
  payload,
}: {
  payload: NexusPacketExplorerPayload;
}) {
  const appearance = useNexusAppearance();

  return (
    <View className="gap-4">
      <NexusCard className="gap-3">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Action Basis
          </Text>
          <NexusBadge label={getViewModeLabel(payload.inspection_lens)} tone="default" />
          <NexusBadge label={getActionsBasisLabel(payload)} tone="gold" />
        </View>
        <Text className={appearance.itemBodyClass}>
          Actions remain operational/runtime affordances in this pass, even when
          the selected inspection lens is {getViewModeLabel(payload.inspection_lens)}.
        </Text>
      </NexusCard>

      {payload.action_descriptors.length === 0 ? (
        <NexusCard>
          <Text className={appearance.itemBodyClass}>
            No runtime action descriptors are projected for this packet yet.
          </Text>
        </NexusCard>
      ) : (
        payload.action_descriptors.map((descriptor) => {
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
        })
      )}
    </View>
  );
}

function renderPayloadPanel(input: {
  payload: NexusPacketExplorerPayload;
  activePrimaryTab: PacketExplorerPrimaryTab;
  selectedDataViewMode: PacketExplorerTab['selected_data_view_mode'];
  rawCodeCardClass: string;
  headingTextClass: string;
  onOpenPacketInNewTab: NexusPacketExplorerContentProps['onOpenPacketInNewTab'];
  onOpenPacketInCurrentTab: NexusPacketExplorerContentProps['onOpenPacketInCurrentTab'];
  onViewInLibrary: NexusPacketExplorerContentProps['onViewInLibrary'];
}) {
  if (input.activePrimaryTab === 'data') {
    return (
      <NexusPacketExplorerDataPanel
        payload={input.payload}
        viewMode={input.selectedDataViewMode}
        rawCodeCardClass={input.rawCodeCardClass}
        headingTextClass={input.headingTextClass}
      />
    );
  }

  if (input.activePrimaryTab === 'lineage') {
    return <NexusPacketExplorerLineagePanel payload={input.payload} />;
  }

  if (input.activePrimaryTab === 'links') {
    return (
      <NexusPacketExplorerLinksPanel
        payload={input.payload}
        onOpenPacketInNewTab={input.onOpenPacketInNewTab}
        onOpenPacketInCurrentTab={input.onOpenPacketInCurrentTab}
        onViewInLibrary={input.onViewInLibrary}
      />
    );
  }

  return <NexusPacketExplorerActionsPanel payload={input.payload} />;
}

export function NexusPacketExplorerContent({
  activeTab,
  activePacketId,
  activePacketState,
  searchValue,
  searchResult,
  searchError,
  isSearching,
  activeSearchCategory,
  rawCodeCardClass,
  headingTextClass,
  onChangeSearchValue,
  onSearchPackets,
  onClearSearch,
  onSelectSearchCategory,
  onChangeSearchCategoryPage,
  onRetryActivePacket,
  onOpenPacketInNewTab,
  onOpenPacketInCurrentTab,
  onRoutePacketToExport,
  onClearExportTarget,
  onViewInLibrary,
}: NexusPacketExplorerContentProps) {
  const appearance = useNexusAppearance();

  const renderScrollableContent = (content: ReactNode) => (
    <ScrollView
      className="flex-1 min-h-0"
      contentContainerClassName="gap-4 pb-6"
      showsVerticalScrollIndicator
    >
      {content}
    </ScrollView>
  );

  if (activeTab.kind === 'home') {
    return renderScrollableContent(
      <NexusPacketExplorerHomePanel
        activeHomeSubtab={activeTab.active_home_subtab}
        selectedPacketId={activeTab.packet_id}
        selectedPacketTitle={activeTab.seed_summary?.label ?? null}
        searchValue={searchValue}
        searchResult={searchResult}
        searchError={searchError}
        isSearching={isSearching}
        activeSearchCategory={activeSearchCategory}
        onChangeSearchValue={onChangeSearchValue}
        onSearchPackets={onSearchPackets}
        onClearSearch={onClearSearch}
        onSelectSearchCategory={onSelectSearchCategory}
        onChangeSearchCategoryPage={onChangeSearchCategoryPage}
        onOpenPacketInExplorer={onOpenPacketInNewTab}
        onRoutePacketToExport={onRoutePacketToExport}
        onClearExportTarget={onClearExportTarget}
      />
    );
  }

  if (!activePacketId || !activePacketState) {
    return renderScrollableContent(
      <NexusPacketExplorerSeededSummary activeTab={activeTab} />
    );
  }

  if (activePacketState.status === 'loading' && !activePacketState.payload) {
    return renderScrollableContent(
      <NexusPacketExplorerSeededSummary activeTab={activeTab} />
    );
  }

  if (activePacketState.status === 'error' && !activePacketState.payload) {
    return renderScrollableContent(
      <View className="gap-4">
        <NexusPacketExplorerSeededSummary activeTab={activeTab} />
        <NexusCard tone="rose" className="gap-3">
          <Text className={appearance.itemBodyClass}>{activePacketState.error}</Text>
          <View className="flex-row flex-wrap gap-2">
            <NexusActionButton label="Retry" onPress={onRetryActivePacket} />
          </View>
        </NexusCard>
      </View>
    );
  }

  const payload = activePacketState.payload;

  if (!payload) {
    return renderScrollableContent(
      <NexusPacketExplorerSeededSummary activeTab={activeTab} />
    );
  }

  const content = renderPayloadPanel({
    payload,
    activePrimaryTab: activeTab.active_primary_tab,
    selectedDataViewMode: activeTab.selected_data_view_mode,
    rawCodeCardClass,
    headingTextClass,
    onOpenPacketInNewTab,
    onOpenPacketInCurrentTab,
    onViewInLibrary,
  });

  if (activePacketState.status === 'error') {
    return renderScrollableContent(
      <View className="gap-4">
        {content}
        <NexusCard tone="rose" className="gap-3">
          <Text className={appearance.itemBodyClass}>{activePacketState.error}</Text>
          <View className="flex-row flex-wrap gap-2">
            <NexusActionButton label="Retry" onPress={onRetryActivePacket} />
          </View>
        </NexusCard>
      </View>
    );
  }

  if (activePacketState.status === 'loading') {
    return renderScrollableContent(
      <View className="gap-4">
        {content}
        <NexusCard tone="gold">
          <Text className={appearance.itemBodyClass}>
            Refreshing packet details...
          </Text>
        </NexusCard>
      </View>
    );
  }

  return renderScrollableContent(content);
}
