/**
 * File: nexus-section-header.tsx
 * Description: Adaptive Nexus section header and route chrome.
 */
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useNexusShellChrome } from '@app/components/nexus/nexus-shell-chrome-context';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { getNexusSectionMenuTitle } from '@runtime/nexus/nexus-shell';
import {
  NexusBevelEdges,
  getNexusChromeClasses,
  joinClasses,
} from './nexus-chrome';

export type NexusSectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
};

/**
 * Inputs: a route title plus compatibility props from existing callers.
 * Output: the adaptive Nexus route chrome for the current content column.
 */
export function NexusSectionHeader({ title }: NexusSectionHeaderProps) {
  const router = useRouter();
  const {
    activeScope,
    activeSection,
    themeMode,
    uiDensity,
    currentActorLabel,
    openExplorer,
  } = useNexusShell();
  const {
    isDesktop,
    isSidebarOpen,
    isPrimaryRailCollapsed,
    isSecondaryRailCollapsed,
    toggleShellMenu,
  } = useNexusShellChrome();
  const chrome = getNexusChromeClasses(themeMode, uiDensity);
  const headingTextClass = themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const mutedTextClass = themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600';
  const titleSizeClass = uiDensity === 'large' ? 'text-3xl lg:text-4xl' : 'text-2xl lg:text-3xl';
  const mobileTitleSizeClass = uiDensity === 'large' ? 'text-2xl' : 'text-xl';
  const actorBadgeSurfaceClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-white/5'
      : 'border-slate-300 bg-slate-100';
  const projectLink = (
    <Pressable
      accessibilityRole="link"
      className={joinClasses(
        chrome.secondaryActionSurfaceClass,
        'relative overflow-hidden rounded-nexus border px-3 py-2',
      )}
      onPress={() => router.push('/')}
    >
      <Text className="text-xs font-bold uppercase tracking-[2.5px] text-nexus-sky">
        Open World Assembly
      </Text>
      <NexusBevelEdges subtle />
    </Pressable>
  );
  const actorBadge = (
    <View
      className={joinClasses(
        chrome.badgeFrameClass,
        actorBadgeSurfaceClass,
        'max-w-[48%]',
      )}
    >
      <Text
        className={joinClasses(
          'text-xs font-semibold uppercase tracking-[2px]',
          mutedTextClass,
        )}
        numberOfLines={1}
      >
        {currentActorLabel}
      </Text>
    </View>
  );
  const explorerButton = (
    <Pressable
      accessibilityRole="button"
      className={chrome.mobileMenuButtonClass}
      onPress={() => openExplorer()}
    >
      <Text className={joinClasses('text-sm font-semibold', headingTextClass)}>
        Packet Explorer
      </Text>
      <NexusBevelEdges subtle />
    </Pressable>
  );
  const menuButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: isSidebarOpen }}
      className={chrome.mobileMenuButtonClass}
      onPress={toggleShellMenu}
    >
      <Text className={joinClasses('text-sm font-semibold', headingTextClass)}>
        â˜° Menu
      </Text>
      <NexusBevelEdges subtle />
    </Pressable>
  );

  if (!isDesktop) {
    return (
      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-2">
          <View className="min-w-0 flex-1 flex-row items-center">
            {projectLink}
          </View>

          <View className="shrink-0 flex-row items-center justify-end gap-2">
            {explorerButton}
            {menuButton}
          </View>
        </View>

        <View className="flex-row items-center justify-between gap-3">
          <Text
            className={joinClasses(
              mobileTitleSizeClass,
              'min-w-0 flex-1 font-bold',
              headingTextClass,
            )}
            numberOfLines={1}
          >
            {title}
          </Text>

          {actorBadge}
        </View>
      </View>
    );
  }

  const isProfileRailVisible =
    isSidebarOpen && !isPrimaryRailCollapsed;
  const isContextRailVisible =
    isSidebarOpen && !isSecondaryRailCollapsed;
  const activeSectionTitle = getNexusSectionMenuTitle(activeSection, activeScope);
  const scopedFunctionTitle = `${activeScope.name} ${activeSectionTitle}`.trim();
  const isScopedFunctionTitle =
    title.trim().toLowerCase() === scopedFunctionTitle.toLowerCase();
  const shouldShowProjectLink = !isProfileRailVisible;
  const shouldShowActorLabel = !isProfileRailVisible;
  const shouldShowTitle = !(isContextRailVisible && isScopedFunctionTitle);

  return (
    <View className="gap-3 lg:flex-row lg:items-center lg:justify-between">
      <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-3">
        {shouldShowProjectLink ? projectLink : null}

        {shouldShowTitle ? (
          <Text
            className={joinClasses(titleSizeClass, 'min-w-0 flex-1 font-bold', headingTextClass)}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
      </View>

      <View className="flex-row flex-wrap items-center justify-end gap-2">
        {shouldShowActorLabel ? actorBadge : null}
        {explorerButton}
        {menuButton}
      </View>
    </View>
  );
}
