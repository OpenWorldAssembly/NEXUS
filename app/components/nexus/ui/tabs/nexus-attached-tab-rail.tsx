/**
 * File: nexus-attached-tab-rail.tsx
 * Description: Shared Nexus attached tab rail primitive.
 */
import { ScrollView, View } from 'react-native';

import {
  NexusTabDetail,
  NexusTabFrame,
  NexusTabLabel,
} from './nexus-tab-primitives';

export type NexusAttachedTabRailProps = {
  tabs: {
    id: string;
    title: string;
    detail?: string;
  }[];
  activeId: string;
  onSelect: (tabId: string) => void;
  compact?: boolean;
};

export function NexusAttachedTabRail({
  tabs,
  activeId,
  onSelect,
  compact = false,
}: NexusAttachedTabRailProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-grow-0"
    >
      <View className="flex-row items-end gap-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;

          return (
            <NexusTabFrame
              key={tab.id}
              active={isActive}
              compact={compact}
              depth={compact ? 1 : 0}
              maxWidth={compact ? 220 : 260}
              minWidth={140}
              onPress={() => onSelect(tab.id)}
            >
              <View className="min-w-0 gap-1">
                <NexusTabLabel
                  active={isActive}
                  depth={compact ? 1 : 0}
                  label={tab.title}
                />
                {tab.detail ? (
                  <NexusTabDetail active={isActive}>{tab.detail}</NexusTabDetail>
                ) : null}
              </View>
            </NexusTabFrame>
          );
        })}
      </View>
    </ScrollView>
  );
}
