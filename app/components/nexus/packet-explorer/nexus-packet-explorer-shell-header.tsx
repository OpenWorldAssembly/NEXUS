import { Text, View } from 'react-native';

import {
  NexusActionButton,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';

type NexusPacketExplorerShellHeaderProps = {
  title: string;
  showPacketsButton: boolean;
  showViewsButton: boolean;
  onOpenHomeTab: () => void;
  onCloseExplorer: () => void;
  onOpenPacketsBand: () => void;
  onOpenViewsBand: () => void;
};

export function NexusPacketExplorerShellHeader({
  title,
  showPacketsButton,
  showViewsButton,
  onOpenHomeTab,
  onCloseExplorer,
  onOpenPacketsBand,
  onOpenViewsBand,
}: NexusPacketExplorerShellHeaderProps) {
  const appearance = useNexusAppearance();

  return (
    <View className="gap-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Packet Explorer
          </Text>
          <Text className={appearance.surfaceTitleClass}>{title}</Text>
        </View>

        <View className="min-w-0 flex-row flex-wrap items-start justify-end gap-2">
          <NexusActionButton label="Home" onPress={onOpenHomeTab} />
          {showPacketsButton ? (
            <NexusActionButton label="Packets" onPress={onOpenPacketsBand} />
          ) : null}
          {showViewsButton ? (
            <NexusActionButton label="Views" onPress={onOpenViewsBand} />
          ) : null}
          <NexusActionButton label="Close" onPress={onCloseExplorer} />
        </View>
      </View>
    </View>
  );
}
