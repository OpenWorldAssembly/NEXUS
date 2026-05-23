/**
 * File: nexus-card-action-cluster.tsx
 * Description: Shares the compact badge/menu cluster used by Nexus action cards and list rows.
 */
import { useCallback, useEffect, useId, useRef } from 'react';
import { Platform, View } from 'react-native';

import { useNexusActionMenuController } from './nexus-action-menu-controller';
import { NexusCardBadgeStrip } from './nexus-card-badge-strip';
import { NexusCardMenuButton } from './nexus-card-menu-button';
import type { NexusActionMenuItem, NexusCardBadge } from './nexus-card-types';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type NexusCardActionClusterProps = {
  actionMenuAlign?: 'top' | 'bottom';
  actions?: NexusActionMenuItem[];
  badges?: NexusCardBadge[];
  className?: string;
  dismissAccessibilityLabel?: string;
  layout?: 'inline' | 'absolute';
  menuAccessibilityLabel?: string;
  menuClassName?: string;
  onMenuOpenChange?: (isOpen: boolean) => void;
};

/**
 * Inputs: optional action and badge descriptors.
 * Output: true when the card/list row needs a reserved action cluster slot.
 */
export function hasNexusCardActionClusterContent({
  actions = [],
  badges = [],
}: Pick<NexusCardActionClusterProps, 'actions' | 'badges'>): boolean {
  return actions.some((action) => !action.hidden) || badges.some((badge) => !badge.hidden);
}

function readAnchorRect(value: unknown) {
  const element = value as { getBoundingClientRect?: () => DOMRect } | null;
  const rect = element?.getBoundingClientRect?.();

  if (!rect) {
    return null;
  }

  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
}

/**
 * Inputs: action descriptors, badge descriptors, and optional positioning controls.
 * Output: a reusable top-right badge/menu cluster with shared menu dismissal behavior.
 */
export function NexusCardActionCluster({
  actionMenuAlign = 'top',
  actions = [],
  badges = [],
  className,
  layout = 'inline',
  menuAccessibilityLabel,
  menuClassName,
  onMenuOpenChange,
}: NexusCardActionClusterProps) {
  const menuId = useId();
  const { closeMenu, openMenu, openMenuId } = useNexusActionMenuController();
  const isMenuOpen = openMenuId === menuId;
  const previousIsMenuOpen = useRef(isMenuOpen);
  const menuAnchorRef = useRef<View | null>(null);
  const visibleActions = actions.filter((action) => !action.hidden);
  const visibleBadges = badges.filter((badge) => !badge.hidden);

  const toggleMenu = useCallback(() => {
    if (isMenuOpen) {
      closeMenu();
      return;
    }

    openMenu({
      actions: visibleActions,
      align: actionMenuAlign,
      anchorRect: Platform.OS === 'web' ? readAnchorRect(menuAnchorRef.current) : null,
      className: menuClassName,
      id: menuId,
    });
  }, [actionMenuAlign, closeMenu, isMenuOpen, menuClassName, menuId, openMenu, visibleActions]);

  useEffect(() => {
    if (previousIsMenuOpen.current === isMenuOpen) {
      return;
    }

    previousIsMenuOpen.current = isMenuOpen;
    onMenuOpenChange?.(isMenuOpen);
  }, [isMenuOpen, onMenuOpenChange]);

  if (visibleActions.length === 0 && visibleBadges.length === 0) {
    return null;
  }

  return (
    <View
      {...({ dataSet: { nexusActionMenuRoot: 'true' } } as {
        dataSet: { nexusActionMenuRoot: string };
      })}
      className={joinClasses(
        layout === 'absolute'
          ? isMenuOpen
            ? 'absolute right-2 top-2 z-50'
            : 'absolute right-2 top-2 z-30'
          : isMenuOpen
            ? 'relative z-50'
            : 'relative',
        'min-w-[5.25rem] flex-row items-center justify-end gap-1 overflow-visible',
        className,
      )}
    >
      <NexusCardBadgeStrip badges={visibleBadges} />
      {visibleActions.length > 0 ? (
        <View ref={menuAnchorRef} className="relative overflow-visible">
          <NexusCardMenuButton
            accessibilityLabel={menuAccessibilityLabel}
            onPress={toggleMenu}
          />
        </View>
      ) : null}
    </View>
  );
}
