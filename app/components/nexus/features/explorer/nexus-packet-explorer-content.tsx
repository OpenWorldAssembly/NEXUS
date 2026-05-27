import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/ui';
import type { NexusPacketExplorerSearchPayload } from '@runtime/nexus/nexus-api-types';
import type { PacketExplorerTab } from '@runtime/nexus/packet-explorer-session';

import type { NexusPacketExplorerSearchCategory } from './nexus-packet-explorer-search-panel';
import type { ExplorerPacketLoadState } from './nexus-packet-explorer-types';
import { NexusPacketExplorerHomePanel } from './nexus-packet-explorer-home-panel';
import {
  NexusPacketExplorerSeededSummary,
  renderPayloadPanel,
} from './nexus-packet-explorer-inspection-panels';

type PacketExplorerRoutePacketInput = {
  packetId: string;
  preferredRevisionId?: string | null;
  titleSnapshot?: string | null;
  seedSummary?: {
    type: string | null;
    summary: string | null;
    label: string | null;
  } | null;
  activePrimaryTab?: 'data' | 'lineage' | 'verification' | 'links' | 'actions';
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
  onViewInLibrary: (packetId: string, type?: string | null) => void;
  onRunVerificationForActivePacket: (packetId: string) => Promise<void>;
};

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
  onRunVerificationForActivePacket,
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
    onRunVerificationForActivePacket,
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
