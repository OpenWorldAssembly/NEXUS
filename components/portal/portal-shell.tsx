/**
 * File: portal-shell.tsx
 * Description: Defines the dedicated shell for all portal routes, including responsive sidebar behavior.
 */
import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

import { usePortalShell } from '@/components/portal/portal-shell-context';
import PortalSidebar from '@/components/portal/portal-sidebar';

/**
 * Inputs: nested portal route content.
 * Output: the responsive two-pane portal shell with mobile sidebar overlay behavior.
 */
export default function PortalShell({ children }: PropsWithChildren) {
  const { activeScope, navigationMode } = usePortalShell();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1100;
  const [isSidebarOpen, setIsSidebarOpen] = useState(isDesktop);

  useEffect(() => {
    setIsSidebarOpen(isDesktop);
  }, [isDesktop]);

  return (
    <View className="flex-1 bg-portal-canvas">
      <View className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-portal-sky/10" />
      <View className="absolute right-0 top-28 h-80 w-80 rounded-full bg-portal-mint/10" />

      {!isDesktop ? (
        <View className="border-b border-portal-line bg-portal-ink px-4 pb-4 pt-5">
          <View className="flex-row items-center justify-between">
            <View className="gap-1">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
                Portal shell
              </Text>
              <Text className="text-xl font-bold text-portal-text">
                {activeScope.name}
              </Text>
              <Text className="text-sm text-portal-muted">
                {navigationMode === 'function'
                  ? 'Function-first view'
                  : 'Scope-first view'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              className="rounded-full border border-portal-line bg-white/5 px-4 py-3"
              onPress={() => setIsSidebarOpen(true)}
            >
              <Text className="text-sm font-semibold text-portal-text">
                Open shell
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View className="flex-1 lg:flex-row">
        {isDesktop ? (
          <View className="w-[380px] border-r border-portal-line">
            <PortalSidebar
              isDesktop={isDesktop}
              onRequestClose={() => setIsSidebarOpen(false)}
            />
          </View>
        ) : null}

        <View className="flex-1">{children}</View>
      </View>

      {!isDesktop && isSidebarOpen ? (
        <View className="absolute inset-0 z-20 flex-row">
          <Pressable
            accessibilityRole="button"
            className="flex-1 bg-slate-950/60"
            onPress={() => setIsSidebarOpen(false)}
          />

          <View className="w-[88%] max-w-[380px] border-l border-portal-line bg-portal-ink">
            <PortalSidebar
              isDesktop={isDesktop}
              onRequestClose={() => setIsSidebarOpen(false)}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
