import { Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusInlineSelect,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import type { PacketExplorerTab, PacketExplorerViewMode } from '@runtime/nexus/packet-explorer-session';

import { getViewModeLabel } from './nexus-packet-explorer-utils';

type NexusPacketExplorerToolbarProps = {
  activeTab: PacketExplorerTab;
  activePacketId: string | null;
  activePacketFamily: string | null;
  viewModes: PacketExplorerViewMode[];
  onSelectViewMode: (viewMode: PacketExplorerViewMode) => void;
  onViewInLibrary: (packetId: string, family?: string | null) => void;
};

export function NexusPacketExplorerToolbar({
  activeTab,
  activePacketId,
  activePacketFamily,
  viewModes,
  onSelectViewMode,
  onViewInLibrary,
}: NexusPacketExplorerToolbarProps) {
  const appearance = useNexusAppearance();

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      {activeTab.kind === 'packet' ? (
        <>
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
        </>
      ) : (
        <NexusBadge label="Read-only preview" tone="gold" />
      )}
      <NexusActionButton
        label="Follow"
        disabled
        featureStatusId="explorer.follow"
      />
      <NexusActionButton label="Fork" disabled featureStatusId="explorer.fork" />
      <NexusActionButton
        label="Adapt"
        disabled
        featureStatusId="explorer.adapt"
      />
      <NexusActionButton
        label="Export"
        disabled
        featureStatusId="explorer.export"
      />
      <NexusActionButton
        label="View in Library"
        disabled={activeTab.kind !== 'packet'}
        onPress={() =>
          activePacketId
            ? onViewInLibrary(activePacketId, activePacketFamily)
            : undefined
        }
      />
    </View>
  );
}
