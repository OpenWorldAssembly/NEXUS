/**
 * File: nexus-action-list-item.tsx
 * Description: Renders one compact row with shared Nexus badges and action menu behavior.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { NexusCardActionCluster, hasNexusCardActionClusterContent } from '@app/components/nexus/ui/cards/action-card';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { useNexusAppearance } from '@app/components/nexus/nexus-ui';
import type { NexusActionMenuItem, NexusCardBadge } from '@app/components/nexus/ui/cards/action-card';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}


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
  const hasTopRightCluster = hasNexusCardActionClusterContent({ actions, badges });

  return (
    <View
      className={joinClasses(
        'relative min-h-[64px] overflow-visible',
        !isLast ? (themeMode === 'dark' ? 'border-b border-nexus-line/60' : 'border-b border-slate-200') : undefined,
        isMenuOpen ? 'z-50' : undefined,
        disabled ? 'opacity-60' : undefined,
        className,
      )}
    >
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={onPress ? 'button' : undefined}
        className={joinClasses(
          'min-h-[64px] px-3.5 py-2.5',
          onPress && !disabled
            ? themeMode === 'dark'
              ? 'active:bg-white/5'
              : 'active:bg-slate-100'
            : undefined,
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
      </Pressable>

      {hasTopRightCluster ? (
        <NexusCardActionCluster
          actions={actions}
          actionMenuAlign={actionMenuAlign}
          badges={badges}
          dismissAccessibilityLabel="Close row actions"
          layout="absolute"
          menuClassName="min-w-[170px]"
          onMenuOpenChange={setIsMenuOpen}
        />
      ) : null}
    </View>
  );
}
