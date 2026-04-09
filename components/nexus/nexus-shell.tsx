/**
 * File: nexus-shell.tsx
 * Description: Defines the dedicated shell for all nexus routes, including responsive sidebar behavior and swipe controls.
 */
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  PanResponder,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { useNexusShell } from '@/components/nexus/nexus-shell-context';
import NexusSidebar from '@/components/nexus/nexus-sidebar';

/**
 * Inputs: nested nexus route content.
 * Output: the responsive nexus shell with left-edge overlay and swipe-controlled rail collapse behavior.
 */
export default function NexusShell({ children }: PropsWithChildren) {
  const {
    activeScope,
    navigationMode,
    collapseOuterRail,
    expandInnerRail,
    isPrimaryRailCollapsed,
    isSecondaryRailCollapsed,
  } = useNexusShell();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1100;
  const [isSidebarOpen, setIsSidebarOpen] = useState(isDesktop);

  useEffect(() => {
    setIsSidebarOpen(isDesktop);
  }, [isDesktop]);

  const sidebarPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 24 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx <= -60) {
            collapseOuterRail();
          }

          if (gestureState.dx >= 60) {
            expandInnerRail();
          }
        },
      }),
    [collapseOuterRail, expandInnerRail],
  );

  return (
    <View className="flex-1 bg-nexus-canvas">
      <View className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-nexus-sky/10" />
      <View className="absolute right-0 top-28 h-80 w-80 rounded-full bg-nexus-mint/10" />

      {!isDesktop ? (
        <View className="border-b border-nexus-line bg-nexus-ink px-4 pb-4 pt-5">
          <View className="flex-row items-center justify-between">
            <View className="gap-1">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Nexus shell
              </Text>
              <Text className="text-xl font-bold text-nexus-text">
                {activeScope.name}
              </Text>
              <Text className="text-sm text-nexus-muted">
                {navigationMode === 'function'
                  ? 'Function-first view'
                  : 'Scope-first view'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              className="rounded-full border border-nexus-line bg-white/5 px-4 py-3"
              onPress={() => setIsSidebarOpen(true)}
            >
              <Text className="text-sm font-semibold text-nexus-text">
                Open shell
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View className="flex-1 lg:flex-row">
        {isDesktop ? (
          <View
            className={`border-r border-nexus-line ${
              isPrimaryRailCollapsed && isSecondaryRailCollapsed
                ? 'w-[56px]'
                : isPrimaryRailCollapsed
                  ? 'w-[416px]'
                  : isSecondaryRailCollapsed
                    ? 'w-[288px]'
                    : 'w-[676px]'
            }`}
            {...sidebarPanResponder.panHandlers}
          >
            <NexusSidebar
              isDesktop={isDesktop}
              onRequestClose={() => setIsSidebarOpen(false)}
            />
          </View>
        ) : null}

        <View className="flex-1">{children}</View>
      </View>

      {!isDesktop && isSidebarOpen ? (
        <View className="absolute inset-0 z-20 flex-row">
          <View
            className="w-[96%] max-w-[760px] border-r border-nexus-line bg-nexus-ink"
            {...sidebarPanResponder.panHandlers}
          >
            <NexusSidebar
              isDesktop={isDesktop}
              onRequestClose={() => setIsSidebarOpen(false)}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            className="flex-1 bg-slate-950/60"
            onPress={() => setIsSidebarOpen(false)}
          />
        </View>
      ) : null}
    </View>
  );
}
