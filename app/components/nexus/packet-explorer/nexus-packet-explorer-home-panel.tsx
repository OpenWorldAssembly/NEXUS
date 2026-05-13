import { View } from 'react-native';

import { NexusPacketExplorerExportPanel } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-export-panel';
import { NexusPacketExplorerImportPanel } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-import-panel';
import {
  NexusPacketExplorerSearchPanel,
  type NexusPacketExplorerSearchCategory,
} from '@app/components/nexus/packet-explorer/nexus-packet-explorer-search-panel';
import type { NexusPacketExplorerSearchPayload } from '@runtime/nexus/nexus-api-types';
import type { PacketExplorerHomeSubtab } from '@runtime/nexus/packet-explorer-session';

type PacketExplorerRoutePacketInput = {
  packetId: string;
  preferredRevisionId?: string | null;
  titleSnapshot?: string | null;
  seedSummary?: {
    family: string | null;
    summary: string | null;
      label: string | null;
    } | null;
  activePrimaryTab?: 'data' | 'lineage' | 'verification' | 'links' | 'actions';
};

type NexusPacketExplorerHomePanelProps = {
  activeHomeSubtab: PacketExplorerHomeSubtab;
  selectedPacketId: string | null;
  selectedPacketTitle: string | null;
  searchValue: string;
  searchResult: NexusPacketExplorerSearchPayload | null;
  searchError: string | null;
  isSearching: boolean;
  activeSearchCategory: NexusPacketExplorerSearchCategory;
  onChangeSearchValue: (value: string) => void;
  onSearchPackets: () => void;
  onClearSearch: () => void;
  onSelectSearchCategory: (category: NexusPacketExplorerSearchCategory) => void;
  onChangeSearchCategoryPage: (
    category: Exclude<NexusPacketExplorerSearchCategory, 'all'>,
    nextPage: number
  ) => void;
  onOpenPacketInExplorer: (input: PacketExplorerRoutePacketInput) => void;
  onRoutePacketToExport: (input: PacketExplorerRoutePacketInput) => void;
  onClearExportTarget: () => void;
};

export function NexusPacketExplorerHomePanel({
  activeHomeSubtab,
  selectedPacketId,
  selectedPacketTitle,
  searchValue,
  searchResult,
  searchError,
  isSearching,
  activeSearchCategory,
  onChangeSearchValue,
  onSearchPackets,
  onClearSearch,
  onSelectSearchCategory,
  onChangeSearchCategoryPage,
  onOpenPacketInExplorer,
  onRoutePacketToExport,
  onClearExportTarget,
}: NexusPacketExplorerHomePanelProps) {
  return (
    <View className="gap-4">
      {activeHomeSubtab === 'search' ? (
        <NexusPacketExplorerSearchPanel
          searchValue={searchValue}
          searchResult={searchResult}
          searchError={searchError}
          isSearching={isSearching}
          activeCategory={activeSearchCategory}
          onChangeSearchValue={onChangeSearchValue}
          onSearch={onSearchPackets}
          onClear={onClearSearch}
          onSelectCategory={onSelectSearchCategory}
          onChangeCategoryPage={onChangeSearchCategoryPage}
          onOpenPacketInExplorer={onOpenPacketInExplorer}
          onRoutePacketToExport={onRoutePacketToExport}
        />
      ) : activeHomeSubtab === 'import' ? (
        <NexusPacketExplorerImportPanel
          onOpenPacketInExplorer={onOpenPacketInExplorer}
        />
      ) : (
        <NexusPacketExplorerExportPanel
          selectedPacketId={selectedPacketId}
          selectedPacketTitle={selectedPacketTitle}
          onSelectPacketForExport={onRoutePacketToExport}
          onClearPacketExportTarget={onClearExportTarget}
        />
      )}
    </View>
  );
}
