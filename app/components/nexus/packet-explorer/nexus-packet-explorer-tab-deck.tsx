import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
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
  isConfirmingCloseTabs: boolean;
  onFocusTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onToggleCloseTabsConfirmation: () => void;
  onConfirmCloseTabs: () => void;
};

export function NexusPacketExplorerTabDeck({
  tabs,
  activeTabId,
  notice,
  headingTextClass,
  mutedTextClass,
  inactiveTabClass,
  attachedActiveTabClass,
  isConfirmingCloseTabs,
  onFocusTab,
  onCloseTab,
  onToggleCloseTabsConfirmation,
  onConfirmCloseTabs,
}: NexusPacketExplorerTabDeckProps) {
  const appearance = useNexusAppearance();
  const [tabHeight, setTabHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const packetTabCount = tabs.filter((tab) => tab.kind === 'packet').length;
  const threeRowHeight = tabHeight > 0 ? tabHeight * 3 + 16 : undefined;
  const isScrollable =
    typeof threeRowHeight === 'number' && contentHeight > threeRowHeight + 2;

  return (
    <View className="gap-3">
      <ScrollView
        className="flex-grow-0"
        contentContainerClassName="flex-row flex-wrap items-end gap-2"
        onContentSizeChange={(_, nextHeight) => setContentHeight(nextHeight)}
        scrollEnabled={isScrollable}
        showsVerticalScrollIndicator={isScrollable}
        style={isScrollable && threeRowHeight ? { maxHeight: threeRowHeight } : undefined}
      >
        {tabs.map((tab, tabIndex) => {
          const isActive = tab.id === activeTabId;

          return (
            <View
              key={tab.id}
              onLayout={
                tabIndex === 0
                  ? (event) => {
                      const nextHeight = event.nativeEvent.layout.height;

                      setTabHeight((currentHeight) =>
                        Math.abs(currentHeight - nextHeight) < 1
                          ? currentHeight
                          : nextHeight
                      );
                    }
                  : undefined
              }
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

        {packetTabCount > 1 ? (
          <Pressable
            accessibilityRole="button"
            className={`min-w-[150px] max-w-[240px] flex-row items-start justify-between gap-3 rounded-t-[20px] border px-4 py-3 ${inactiveTabClass}`}
            onPress={onToggleCloseTabsConfirmation}
          >
            <View className="min-w-0 flex-1">
              <Text className={`text-sm font-semibold ${headingTextClass}`}>
                Close tabs
              </Text>
            </View>
            <Text className={`text-xs font-semibold ${mutedTextClass}`}>x</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {notice ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <NexusBadge label="Explorer notice" tone="gold" />
          <Text className={appearance.itemBodyClass}>{notice}</Text>
        </View>
      ) : null}

      {isConfirmingCloseTabs ? (
        <NexusCard tone="gold" className="gap-3">
          <Text className={appearance.itemBodyClass}>
            Close all packet tabs and return to Home? The Explorer session will stay
            restorable after close.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <NexusActionButton
              label="Keep tabs"
              onPress={onToggleCloseTabsConfirmation}
            />
            <NexusActionButton
              label="Close packet tabs"
              onPress={onConfirmCloseTabs}
            />
          </View>
        </NexusCard>
      ) : null}
    </View>
  );
}
