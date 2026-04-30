import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  NexusBadge,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import type { PacketExplorerTab } from '@runtime/nexus/packet-explorer-session';

import { getExplorerTabLabel } from './nexus-packet-explorer-utils';

type NexusPacketExplorerTabDeckProps = {
  tabs: PacketExplorerTab[];
  activeTabId: string;
  notice: string | null;
  headingTextClass: string;
  mutedTextClass: string;
  inactiveTabClass: string;
  attachedActiveTabClass: string;
  onFocusTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
};

export function NexusPacketExplorerTabDeck({
  tabs,
  activeTabId,
  notice,
  headingTextClass,
  mutedTextClass,
  inactiveTabClass,
  attachedActiveTabClass,
  onFocusTab,
  onCloseTab,
}: NexusPacketExplorerTabDeckProps) {
  const appearance = useNexusAppearance();

  return (
    <View className="gap-3">
      <ScrollView
        className="max-h-[180px] flex-grow-0"
        contentContainerClassName="flex-row flex-wrap items-end gap-2"
        showsVerticalScrollIndicator
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <View
              key={tab.id}
              className={`min-w-[150px] max-w-[240px] flex-row items-start justify-between gap-3 border px-4 py-3 ${
                isActive
                  ? `-mb-px rounded-t-[20px] ${attachedActiveTabClass}`
                  : `rounded-t-[20px] ${inactiveTabClass}`
              }`}
            >
              <Pressable
                accessibilityRole="button"
                className="min-w-0 flex-1"
                onPress={() => onFocusTab(tab.id)}
              >
                <Text className={`text-sm font-semibold ${headingTextClass}`}>
                  {getExplorerTabLabel(tab)}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => onCloseTab(tab.id)}
              >
                <Text className={`text-xs font-semibold ${mutedTextClass}`}>x</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      {notice ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <NexusBadge label="Explorer notice" tone="gold" />
          <Text className={appearance.itemBodyClass}>{notice}</Text>
        </View>
      ) : null}
    </View>
  );
}
