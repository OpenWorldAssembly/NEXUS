import { Text, TextInput, View } from 'react-native';

import {
  NexusAttachedTabRail,
  NexusActionButton,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import { NexusPacketExplorerExportPanel } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-export-panel';
import type { PacketExplorerHomeSubtab } from '@runtime/nexus/packet-explorer-session';

type NexusPacketExplorerHomePanelProps = {
  activeHomeSubtab: PacketExplorerHomeSubtab;
  selectedPacketId: string | null;
  selectedPacketTitle: string | null;
  searchValue: string;
  onChangeSearchValue: (value: string) => void;
  onSelectHomeSubtab: (subtab: PacketExplorerHomeSubtab) => void;
};

function NexusPacketExplorerSearchPanel({
  searchValue,
  onChangeSearchValue,
}: Pick<
  NexusPacketExplorerHomePanelProps,
  'searchValue' | 'onChangeSearchValue'
>) {
  const appearance = useNexusAppearance();

  return (
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
            Open packets from Library to inspect them here. Search is still
            visible as the future direct lookup seam.
          </Text>
        </View>

        <TextInput
          className={`rounded-[22px] border px-4 py-3 ${appearance.textInputClass}`}
          onChangeText={onChangeSearchValue}
          placeholder="Paste a packet id or revision id"
          placeholderTextColor={appearance.textInputPlaceholderColor}
          value={searchValue}
        />

        <View className="flex-row flex-wrap gap-2">
          <NexusActionButton
            label="Search packets"
            disabled
            featureStatusId="explorer.home.search_packets"
          />
          <NexusActionButton
            label="Import packet"
            disabled
            featureStatusId="explorer.home.import_packet"
          />
          <NexusActionButton
            label="Import bundle"
            disabled
            featureStatusId="explorer.home.import_bundle"
          />
          <NexusActionButton
            label="Open recent"
            disabled
            featureStatusId="explorer.home.open_recent"
          />
        </View>
      </NexusCard>

      <NexusCard tone="gold">
        <Text className={appearance.itemBodyClass}>
          Search and import remain visible but are not live in this export-first
          phase. Use Library `Open packet` to inspect data and `Export` to open
          the new portability workspace.
        </Text>
      </NexusCard>
    </View>
  );
}

export function NexusPacketExplorerHomePanel({
  activeHomeSubtab,
  selectedPacketId,
  selectedPacketTitle,
  searchValue,
  onChangeSearchValue,
  onSelectHomeSubtab,
}: NexusPacketExplorerHomePanelProps) {
  return (
    <View className="gap-4">
      <NexusAttachedTabRail
        tabs={[
          { id: 'search', title: 'Search' },
          { id: 'export', title: 'Export' },
        ]}
        activeId={activeHomeSubtab}
        compact
        onSelect={(tabId) =>
          onSelectHomeSubtab(tabId as PacketExplorerHomeSubtab)
        }
      />

      {activeHomeSubtab === 'search' ? (
        <NexusPacketExplorerSearchPanel
          searchValue={searchValue}
          onChangeSearchValue={onChangeSearchValue}
        />
      ) : (
        <NexusPacketExplorerExportPanel
          selectedPacketId={selectedPacketId}
          selectedPacketTitle={selectedPacketTitle}
        />
      )}
    </View>
  );
}
