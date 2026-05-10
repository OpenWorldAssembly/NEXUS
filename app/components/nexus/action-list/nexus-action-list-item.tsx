/**
 * File: nexus-action-list-item.tsx
 * Description: Renders one compact row with shared Nexus badges and action menu behavior.
 */
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { NexusActionMenu, NexusCardBadgeStrip, NexusCardMenuButton } from '@app/components/nexus/action-card';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { useNexusAppearance } from '@app/components/nexus/nexus-ui';
import type { NexusActionMenuItem, NexusCardBadge } from '@app/components/nexus/action-card';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

const MENU_DISMISS_LAYER_STYLE =
  Platform.OS === 'web'
    ? ({ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 } as never)
    : undefined;

export type NexusActionListItemProps = {
  accessibilityLabel?: string;
  actions?: NexusActionMenuItem[];
  actionMenuAlign?: 'top' | 'bottom';
  badges?: NexusCardBadge[];
  className?: string;
  detail?: string | null;
  disabled?: boolean;
  isLast?: boolean;
  meta?: string | null;
  onPress?: () => void;
  title: string;
};

/**
 * Inputs: compact row content, menu actions, badges, and optional press target.
 * Output: a dense clickable row suitable for dashboard preview lists.
 */
export function NexusActionListItem({
  accessibilityLabel,
  actions = [],
  actionMenuAlign = 'top',
  badges = [],
  className,
  detail,
  disabled = false,
  isLast = false,
  meta,
  onPress,
  title,
}: NexusActionListItemProps) {
  const { themeMode } = useNexusShell();
  const appearance = useNexusAppearance();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const visibleActions = actions.filter((action) => !action.hidden);
  const visibleBadges = badges.filter((badge) => !badge.hidden);
  const hasTopRightCluster = visibleActions.length > 0 || visibleBadges.length > 0;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={onPress ? 'button' : undefined}
      className={joinClasses(
        'relative min-h-[64px] overflow-visible px-3.5 py-2.5',
        !isLast ? (themeMode === 'dark' ? 'border-b border-nexus-line/60' : 'border-b border-slate-200') : undefined,
        onPress && !disabled
          ? themeMode === 'dark'
            ? 'active:bg-white/5'
            : 'active:bg-slate-100'
          : undefined,
        isMenuOpen ? 'z-50' : undefined,
        disabled ? 'opacity-60' : undefined,
        className,
      )}
      disabled={disabled}
      onPress={(event) => {
        event.stopPropagation();
        onPress?.();
      }}
    >
      <View className={joinClasses('gap-1', hasTopRightCluster ? 'pr-24' : undefined)}>
        <Text className={appearance.itemTitleClass} numberOfLines={1}>
          {title}
        </Text>
        {detail || meta ? (
          <Text className={appearance.itemBodyClass} numberOfLines={1}>
            {detail ?? meta}
            {detail && meta ? <Text className={appearance.itemMetaClass}> · {meta}</Text> : null}
          </Text>
        ) : null}
      </View>

      {hasTopRightCluster ? (
        <View className="absolute right-2 top-2 z-30 min-w-[5.25rem] flex-row items-center justify-end gap-1 overflow-visible">
          <NexusCardBadgeStrip badges={visibleBadges} />
          {visibleActions.length > 0 ? (
            <View className="relative overflow-visible">
              {isMenuOpen ? (
                <Pressable
                  accessibilityLabel="Close row actions"
                  accessibilityRole="button"
                  className={Platform.OS === 'web' ? 'fixed inset-0 z-40' : 'absolute inset-0 z-40'}
                  onPress={(event) => {
                    event.stopPropagation();
                    setIsMenuOpen(false);
                  }}
                  style={MENU_DISMISS_LAYER_STYLE}
                />
              ) : null}
              <NexusCardMenuButton onPress={() => setIsMenuOpen((current) => !current)} />
              <NexusActionMenu
                actions={visibleActions}
                align={actionMenuAlign}
                className="min-w-[170px]"
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
