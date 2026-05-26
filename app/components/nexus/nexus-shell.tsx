/**
 * File: nexus-shell.tsx
 * Description: Defines the dedicated shell for all nexus routes, including responsive sidebar behavior and swipe controls.
 */
import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PanResponder,
  Pressable,
  View,
  useWindowDimensions,
} from 'react-native';

import { NexusFeatureStatusProvider } from '@app/components/nexus/nexus-feature-status-context';
import { NexusShellChromeProvider } from '@app/components/nexus/nexus-shell-chrome-context';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import NexusPacketExplorer from '@app/components/nexus/features/explorer/nexus-packet-explorer';
import NexusShellEntryGate from '@app/components/nexus/nexus-shell-entry-gate';
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
    themeMode,
    uiDensity,
    isEarlyAccessGateOpen,
    dismissEarlyAccessGate,
    collapseOuterRail,
    collapseAllRails,
    expandInnerRail,
    expandAllRails,
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
  const resolvedMobileSidebarWidth =
    (isPrimaryRailCollapsed ? NEXUS_COLLAPSED_RAIL_WIDTH : railWidth) +
    (isSecondaryRailCollapsed ? NEXUS_COLLAPSED_RAIL_WIDTH : railWidth);
  const mobileSidebarWidth = Math.min(width * 0.96, resolvedMobileSidebarWidth);
  const shellCanvasClass =
    themeMode === 'dark' ? 'bg-nexus-canvas' : 'bg-slate-100';
  const sidebarBorderClass =
    themeMode === 'dark' ? 'border-nexus-line' : 'border-slate-300';
  const overlayBackdropClass =
    themeMode === 'dark' ? 'bg-slate-950/60' : 'bg-slate-500/25';

  useEffect(() => {
    setIsSidebarOpen(isDesktop);
  }, [isDesktop]);

  useEffect(() => {
    if (
      isDesktop ||
      !isSidebarOpen ||
      !isPrimaryRailCollapsed ||
      !isSecondaryRailCollapsed
    ) {
      return;
    }

    setIsSidebarOpen(false);
  }, [
    isDesktop,
    isPrimaryRailCollapsed,
    isSecondaryRailCollapsed,
    isSidebarOpen,
  ]);

  const toggleShellMenu = useCallback(() => {
    if (isDesktop) {
      if (!isSidebarOpen) {
        expandAllRails();
        setIsSidebarOpen(true);
        return;
      }

      if (isPrimaryRailCollapsed || isSecondaryRailCollapsed) {
        expandAllRails();
        return;
      }

      collapseAllRails();
      return;
    }

    setIsSidebarOpen((currentValue) => {
      if (currentValue) {
        return false;
      }

      expandAllRails();
      return true;
    });
  }, [
    collapseAllRails,
    expandAllRails,
    isDesktop,
    isSidebarOpen,
    isPrimaryRailCollapsed,
    isSecondaryRailCollapsed,
  ]);

  const openSidebarMenu = useCallback(() => {
    expandAllRails();
    setIsSidebarOpen(true);
  }, [expandAllRails]);

  const closeSidebarMenu = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

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

  const openSidebarPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !isDesktop &&
          !isSidebarOpen &&
          gestureState.x0 <= 32 &&
          gestureState.dx >= 18 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx >= 40) {
            openSidebarMenu();
          }
        },
      }),
    [isDesktop, isSidebarOpen, openSidebarMenu]
  );

  return (
    <View className={`flex-1 ${shellCanvasClass}`}>
      <NexusFeatureStatusProvider>
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

        <NexusShellChromeProvider
          value={{
            isDesktop,
            isSidebarOpen,
            isPrimaryRailCollapsed,
            isSecondaryRailCollapsed,
            toggleShellMenu,
            openShellMenu: openSidebarMenu,
            closeShellMenu: closeSidebarMenu,
          }}
        >
          <View className="flex-1 lg:flex-row">
            {isDesktop && isSidebarOpen ? (
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
                className={`border-r ${sidebarBorderClass}`}
                style={{ width: mobileSidebarWidth }}
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

          {!isDesktop && !isSidebarOpen ? (
            <View
              className="absolute inset-y-0 left-0 z-10 w-6"
              pointerEvents="box-only"
              {...openSidebarPanResponder.panHandlers}
            />
          ) : null}
        </NexusShellChromeProvider>

        <NexusPacketExplorer />
      </NexusFeatureStatusProvider>
      <NexusShellEntryGate
        isVisible={isEarlyAccessGateOpen}
        onDismiss={dismissEarlyAccessGate}
      />
    </View>
  );
}
