import { Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';

type NexusPacketExplorerShellHeaderProps = {
  title: string;
  isConfirmingCloseTabs: boolean;
  onToggleCloseTabsConfirmation: () => void;
  onConfirmCloseTabs: () => void;
  onOpenHomeTab: () => void;
  onCloseExplorer: () => void;
};

export function NexusPacketExplorerShellHeader({
  title,
  isConfirmingCloseTabs,
  onToggleCloseTabsConfirmation,
  onConfirmCloseTabs,
  onOpenHomeTab,
  onCloseExplorer,
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

        <View className="flex-row flex-wrap gap-2">
          <NexusActionButton label="Home tab" onPress={onOpenHomeTab} />
          <NexusActionButton
            label={isConfirmingCloseTabs ? 'Cancel close tabs' : 'Close tabs'}
            onPress={onToggleCloseTabsConfirmation}
          />
          <NexusActionButton label="Close Explorer" onPress={onCloseExplorer} />
        </View>
      </View>

      {isConfirmingCloseTabs ? (
        <NexusCard tone="gold" className="gap-3">
          <Text className={appearance.itemBodyClass}>
            Close all packet tabs and return to Home? The Explorer session will stay
            restorable after close.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <NexusActionButton label="Keep tabs" onPress={onToggleCloseTabsConfirmation} />
            <NexusActionButton label="Close packet tabs" onPress={onConfirmCloseTabs} />
          </View>
        </NexusCard>
      ) : null}
    </View>
  );
}
