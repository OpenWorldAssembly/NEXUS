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

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import NexusSidebar from '@app/components/nexus/nexus-sidebar';
import {
  getNexusRailWidth,
  NEXUS_COLLAPSED_RAIL_WIDTH,
} from '@runtime/nexus/nexus-shell';

/**
 * Inputs: nested nexus route content.
 * Output: the responsive nexus shell with left-edge overlay and swipe-controlled rail collapse behavior.
 */
export default function NexusShell({ children }: PropsWithChildren) {
  const {
    activeScope,
    navigationMode,
    themeMode,
    uiDensity,
    collapseOuterRail,
    expandInnerRail,
    isPrimaryRailCollapsed,
    isSecondaryRailCollapsed,
  } = useNexusShell();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1100;
  const [isSidebarOpen, setIsSidebarOpen] = useState(isDesktop);
  const railWidth = getNexusRailWidth(uiDensity);
  const desktopSidebarWidth =
    (isPrimaryRailCollapsed ? NEXUS_COLLAPSED_RAIL_WIDTH : railWidth) +
    (isSecondaryRailCollapsed ? NEXUS_COLLAPSED_RAIL_WIDTH : railWidth);
  const shellCanvasClass =
    themeMode === 'dark' ? 'bg-nexus-canvas' : 'bg-slate-100';
  const mobileBarClass =
    themeMode === 'dark'
      ? 'border-nexus-line bg-nexus-ink'
      : 'border-slate-300 bg-white';
  const mobileHeadingClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const mobileMetaClass =
    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600';
  const mobileButtonClass =
    themeMode === 'dark'
      ? 'border-nexus-line bg-white/5'
      : 'border-slate-300 bg-slate-100';
  const sidebarBorderClass =
    themeMode === 'dark' ? 'border-nexus-line' : 'border-slate-300';
  const overlayBackdropClass =
    themeMode === 'dark' ? 'bg-slate-950/60' : 'bg-slate-500/25';

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
    <View className={`flex-1 ${shellCanvasClass}`}>
      <View
        className={`absolute -left-20 top-0 h-72 w-72 rounded-full ${
          themeMode === 'dark' ? 'bg-nexus-sky/10' : 'bg-sky-200/60'
        }`}
      />
      <View
        className={`absolute right-0 top-28 h-80 w-80 rounded-full ${
          themeMode === 'dark' ? 'bg-nexus-mint/10' : 'bg-emerald-200/40'
        }`}
      />

      {!isDesktop ? (
        <View className={`border-b px-4 pb-4 pt-5 ${mobileBarClass}`}>
          <View className="flex-row items-center justify-between">
            <View className="gap-1">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Nexus shell
              </Text>
              <Text className={`text-xl font-bold ${mobileHeadingClass}`}>
                {activeScope.name}
              </Text>
              <Text className={`text-sm ${mobileMetaClass}`}>
                {navigationMode === 'function'
                  ? 'Function-first view'
                  : 'Scope-first view'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              className={`rounded-full border px-4 py-3 ${mobileButtonClass}`}
              onPress={() => setIsSidebarOpen(true)}
            >
              <Text className={`text-sm font-semibold ${mobileHeadingClass}`}>
                Open shell
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View className="flex-1 lg:flex-row">
        {isDesktop ? (
          <View
            className={`border-r ${sidebarBorderClass}`}
            style={{ width: desktopSidebarWidth }}
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
            className={`w-[96%] max-w-[760px] border-r ${sidebarBorderClass}`}
            {...sidebarPanResponder.panHandlers}
          >
            <NexusSidebar
              isDesktop={isDesktop}
              onRequestClose={() => setIsSidebarOpen(false)}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            className={`flex-1 ${overlayBackdropClass}`}
            onPress={() => setIsSidebarOpen(false)}
          />
        </View>
      ) : null}
    </View>
  );
}
