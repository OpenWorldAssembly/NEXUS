import { useRef, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  useNexusAppearance,
  useNexusChrome,
} from '@app/components/nexus/nexus-ui';
import {
  NexusTabCloseButton,
  NexusTabFrame,
  NexusTabLabel,
} from '@app/components/nexus/ui/tabs/nexus-tab-primitives';
import type { PacketExplorerTab } from '@runtime/nexus/packet-explorer-session';

import { getExplorerTabLabel } from './nexus-packet-explorer-utils';

type NexusPacketExplorerTabDeckProps = {
  tabs: PacketExplorerTab[];
  activeTabId: string;
  notice: string | null;
  headingTextClass: string;
  mutedTextClass: string;
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
  isConfirmingCloseTabs,
  onFocusTab,
  onCloseTab,
  onToggleCloseTabsConfirmation,
  onConfirmCloseTabs,
}: NexusPacketExplorerTabDeckProps) {
  const appearance = useNexusAppearance();
  const chrome = useNexusChrome();
  const [tabHeight, setTabHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [hoveredTooltipState, setHoveredTooltipState] = useState<{
    tabId: string;
    text: string;
    anchorRect: {
      x: number;
      y: number;
      width: number;
      height: number;
      deckWidth: number;
    };
  } | null>(null);
  const deckRef = useRef<View | null>(null);
  const tabRefs = useRef<Record<string, View | null>>({});
  const packetTabCount = tabs.filter((tab) => tab.kind === 'packet').length;
  const threeRowHeight = tabHeight > 0 ? tabHeight * 3 + 16 : undefined;
  const isScrollable =
    typeof threeRowHeight === 'number' && contentHeight > threeRowHeight + 2;
  const canShowHoverTooltip = Platform.OS === 'web';
  const tooltipMaxWidth = hoveredTooltipState
    ? Math.max(160, Math.min(320, hoveredTooltipState.anchorRect.deckWidth - 16))
    : 160;
  const tooltipWidth = hoveredTooltipState
    ? Math.min(
        tooltipMaxWidth,
        Math.max(hoveredTooltipState.anchorRect.width, 160)
      )
    : 160;
  const tooltipLeft = hoveredTooltipState
    ? Math.min(
        Math.max(hoveredTooltipState.anchorRect.x, 0),
        Math.max(0, hoveredTooltipState.anchorRect.deckWidth - tooltipWidth)
      )
    : 0;
  const tooltipTop = hoveredTooltipState
    ? hoveredTooltipState.anchorRect.y - 44
    : 0;

  return (
    <View ref={deckRef} collapsable={false} className="relative gap-3 overflow-visible">
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
              collapsable={false}
              ref={(value) => {
                tabRefs.current[tab.id] = value;
              }}
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
            >
              <NexusTabFrame
                active={isActive}
                depth={0}
                maxWidth={240}
                minWidth={150}
                onHoverIn={
                  canShowHoverTooltip &&
                  tab.kind === 'packet' &&
                  getExplorerTabLabel(tab) !== tab.title_snapshot
                    ? () => {
                        const deckRefValue = deckRef.current;
                        const tabRef = tabRefs.current[tab.id];

                        if (!deckRefValue?.measureInWindow || !tabRef?.measureInWindow) {
                          return;
                        }

                        deckRefValue.measureInWindow((deckX, deckY, deckWidth) => {
                          tabRef.measureInWindow((x, y, width, height) => {
                            setHoveredTooltipState({
                              tabId: tab.id,
                              text: tab.title_snapshot,
                              anchorRect: {
                                x: x - deckX,
                                y: y - deckY,
                                width,
                                height,
                                deckWidth,
                              },
                            });
                          });
                        });
                      }
                    : undefined
                }
                onHoverOut={
                  canShowHoverTooltip &&
                  tab.kind === 'packet' &&
                  getExplorerTabLabel(tab) !== tab.title_snapshot
                    ? () =>
                        setHoveredTooltipState((currentValue) =>
                          currentValue?.tabId === tab.id ? null : currentValue
                        )
                    : undefined
                }
                onPress={() => onFocusTab(tab.id)}
                trailing={
                  <NexusTabCloseButton
                    accessibilityLabel={`Close ${getExplorerTabLabel(tab)} tab`}
                    onPress={() => onCloseTab(tab.id)}
                  />
                }
              >
                <NexusTabLabel
                  active={isActive}
                  depth={0}
                  label={getExplorerTabLabel(tab)}
                  numberOfLines={2}
                  truncate="none"
                />
              </NexusTabFrame>
            </View>
          );
        })}

        {packetTabCount > 1 ? (
          <NexusTabFrame
            active={false}
            depth={0}
            maxWidth={240}
            minWidth={150}
            onPress={onToggleCloseTabsConfirmation}
            trailing={
              <NexusTabCloseButton
                accessibilityLabel="Close all packet tabs"
                onPress={onToggleCloseTabsConfirmation}
              />
            }
          >
            <NexusTabLabel
              active={false}
              depth={0}
              label="Close tabs"
              truncate="none"
            />
          </NexusTabFrame>
        ) : null}
      </ScrollView>

      {hoveredTooltipState && canShowHoverTooltip ? (
        <View
          pointerEvents="none"
          className="absolute z-50"
          style={{
            left: tooltipLeft,
            top: tooltipTop,
            width: tooltipWidth,
            zIndex: 50,
            elevation: 50,
          }}
        >
          <View
            className={`overflow-hidden rounded-nexus border px-3 py-2 ${chrome.inlineSelectMenuClass}`}
          >
            <Text className={`text-sm font-semibold ${headingTextClass}`}>
              {hoveredTooltipState.text}
            </Text>
          </View>
        </View>
      ) : null}

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
