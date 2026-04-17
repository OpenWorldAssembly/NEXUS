/**
 * File: public-secondary-nav.tsx
 * Description: Shared entrypoint that swaps between the rail and topbar secondary-nav shells.
 */
import React from 'react';

import PublicSecondaryNavRail from './public-secondary-nav-rail';
import { PublicSecondaryNavTopbar } from './public-secondary-nav-topbar';
import type {
  PublicSecondaryNavAnimatedState,
  PublicSecondaryNavItem,
} from './public-secondary-nav.types';

type PublicSecondaryNavProps = {
  mode?: 'rail' | 'topbar';
  layoutMode?: 'rail' | 'topbar';
  items: PublicSecondaryNavItem[];
  activeId: string | null;
  onItemPress: (id: string) => void;
  title?: string;
  subtitle?: string;
  railWidth?: number;
  railRightOffset?: number;
  topbarShellHeight?: number;
  railShellHeight?: number;
  getItemAnimatedState?: (itemId: string) => PublicSecondaryNavAnimatedState | undefined;
  shouldShowSubtitle?: (itemId: string) => boolean;
};

export function PublicSecondaryNav({
  mode,
  layoutMode,
  items,
  activeId,
  onItemPress,
  title,
  subtitle,
  railWidth,
  railRightOffset,
  topbarShellHeight,
  railShellHeight,
  getItemAnimatedState,
  shouldShowSubtitle,
}: PublicSecondaryNavProps) {
  const resolvedMode = mode ?? layoutMode ?? 'rail';

  if (resolvedMode === 'topbar') {
    return (
      <PublicSecondaryNavTopbar
        items={items}
        activeId={activeId}
        onItemPress={onItemPress}
        title={title}
        subtitle={subtitle}
        topbarShellHeight={topbarShellHeight}
        getItemAnimatedState={getItemAnimatedState}
        shouldShowSubtitle={shouldShowSubtitle}
      />
    );
  }

  return (
    <PublicSecondaryNavRail
      items={items}
      activeId={activeId}
      onItemPress={onItemPress}
      title={title ?? ''}
      subtitle={subtitle ?? ''}
      railWidth={railWidth}
      railShellHeight={railShellHeight ?? 540}
      railRightOffset={railRightOffset}
      getItemAnimatedState={getItemAnimatedState}
      shouldShowSubtitle={shouldShowSubtitle}
    />
  );
}

export default PublicSecondaryNav;
