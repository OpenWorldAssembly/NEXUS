import { Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusAttachedTabRail,
  NexusInlineSelect,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import type {
  PacketExplorerHomeSubtab,
  PacketExplorerTab,
  PacketExplorerViewMode,
} from '@runtime/nexus/packet-explorer-session';

import { getViewModeLabel } from './nexus-packet-explorer-utils';

type NexusPacketExplorerToolbarProps = {
  activeTab: PacketExplorerTab;
  activePacketId: string | null;
  activePacketFamily: string | null;
  activeHomeSubtab?: PacketExplorerHomeSubtab;
  viewModes: PacketExplorerViewMode[];
  onExportPacket: (input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      family: string | null;
      summary: string | null;
      label: string | null;
    } | null;
  }) => void;
  onSelectHomeSubtab?: (subtab: PacketExplorerHomeSubtab) => void;
  onSelectViewMode: (viewMode: PacketExplorerViewMode) => void;
  onViewInLibrary: (packetId: string, family?: string | null) => void;
};

export function NexusPacketExplorerToolbar({
  activeTab,
  activePacketId,
  activePacketFamily,
  activeHomeSubtab = 'search',
  viewModes,
  onExportPacket,
  onSelectHomeSubtab,
  onSelectViewMode,
  onViewInLibrary,
}: NexusPacketExplorerToolbarProps) {
  const appearance = useNexusAppearance();

  if (activeTab.kind === 'home') {
    return (
      <NexusAttachedTabRail
        tabs={[
          { id: 'search', title: 'Search' },
          { id: 'import', title: 'Import' },
          { id: 'export', title: 'Export' },
        ]}
        activeId={activeHomeSubtab}
        compact
        onSelect={(tabId) => onSelectHomeSubtab?.(tabId as PacketExplorerHomeSubtab)}
      />
    );
  }

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Text className={appearance.itemMetaClass}>View as</Text>
      <NexusInlineSelect
        valueLabel={getViewModeLabel(activeTab.selected_data_view_mode)}
        options={viewModes.map((viewMode) => ({
          id: viewMode,
          label: getViewModeLabel(viewMode),
        }))}
        menuLayerClassName="z-40"
        onSelect={(viewModeId) => onSelectViewMode(viewModeId as PacketExplorerViewMode)}
      />
      <NexusActionButton
        label="Export"
        disabled={!activePacketId}
        onPress={() =>
          activePacketId
            ? onExportPacket({
                packetId: activePacketId,
                preferredRevisionId: activeTab.preferred_revision_id,
                titleSnapshot: activeTab.title_snapshot,
                seedSummary: activeTab.seed_summary,
              })
            : undefined
        }
      />
      <NexusActionButton
        label="View in Library"
        disabled={!activePacketId}
        onPress={() =>
          activePacketId
            ? onViewInLibrary(activePacketId, activePacketFamily)
            : undefined
        }
      />
    </View>
  );
}
