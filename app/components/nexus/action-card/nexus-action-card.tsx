/**
 * File: nexus-action-card.tsx
 * Description: Composes NexusCard with badges and a reusable action menu.
 */
import { useState, type PropsWithChildren } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { NexusCard } from '@app/components/nexus/nexus-ui';
import type { NexusCardTone } from '@runtime/nexus/nexus-content';
import { NexusActionMenu } from './nexus-action-menu';
import { NexusCardBadgeStrip } from './nexus-card-badge-strip';
import { NexusCardMenuButton } from './nexus-card-menu-button';
import type { NexusActionMenuItem, NexusCardBadge } from './nexus-card-types';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

const MENU_DISMISS_LAYER_STYLE =
  Platform.OS === 'web'
    ? ({ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 } as never)
    : undefined;

export type NexusActionCardProps = PropsWithChildren<{
  accessibilityLabel?: string;
  actions?: NexusActionMenuItem[];
  actionMenuAlign?: 'top' | 'bottom';
  badges?: NexusCardBadge[];
  className?: string;
  compact?: boolean;
  contentClassName?: string;
  disabled?: boolean;
  menuAccessibilityLabel?: string;
  onPress?: () => void;
  selected?: boolean;
  tone?: NexusCardTone | 'default';
}>;

/**
 * Inputs: card content, optional action descriptors, and compact badge descriptors.
 * Output: a Nexus card with a top-right badge/menu cluster.
 */
export function NexusActionCard({
  accessibilityLabel,
  actions = [],
  actionMenuAlign = 'top',
  badges = [],
  children,
  className,
  compact = false,
  contentClassName,
  disabled = false,
  menuAccessibilityLabel,
  onPress,
  selected = false,
  tone = 'default',
}: NexusActionCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const visibleActions = actions.filter((action) => !action.hidden);
  const visibleBadges = badges.filter((badge) => !badge.hidden);
  const hasTopRightCluster = visibleActions.length > 0 || visibleBadges.length > 0;

  return (
    <NexusCard
      accessibilityLabel={accessibilityLabel}
      action={
        hasTopRightCluster ? (
          <View className="relative min-w-[5.25rem] flex-row items-center justify-end gap-1 overflow-visible">
            <NexusCardBadgeStrip badges={visibleBadges} />
            {visibleActions.length > 0 ? (
              <View className="relative overflow-visible">
                {isMenuOpen ? (
                  <Pressable
                    accessibilityLabel="Close card actions"
                    accessibilityRole="button"
                    className={Platform.OS === 'web' ? 'fixed inset-0 z-40' : 'absolute inset-0 z-40'}
                    onPress={(event) => {
                      event.stopPropagation();
                      setIsMenuOpen(false);
                    }}
                    style={MENU_DISMISS_LAYER_STYLE}
                  />
                ) : null}
                <NexusCardMenuButton
                  accessibilityLabel={menuAccessibilityLabel}
                  onPress={() => setIsMenuOpen((current) => !current)}
                />
                <NexusActionMenu
                  actions={visibleActions}
                  align={actionMenuAlign}
                  isOpen={isMenuOpen}
                  onClose={() => setIsMenuOpen(false)}
                />
              </View>
            ) : null}
          </View>
        ) : null
      }
      actionClassName="right-2 top-2"
      className={joinClasses('overflow-visible', isMenuOpen ? 'z-50' : undefined, className)}
      compact={compact}
      contentClassName={joinClasses(hasTopRightCluster ? 'pr-24' : undefined, contentClassName)}
      disabled={disabled}
      onPress={onPress}
      selected={selected}
      tone={tone}
    >
      {children}
    </NexusCard>
  );
}
