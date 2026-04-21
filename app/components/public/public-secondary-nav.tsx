/**
 * File: public-secondary-nav.tsx
 * Description: Shared entrypoint that swaps between the rail and topbar secondary-nav shells.
 */
import React from 'react';

import PublicSecondaryNavRail from './public-secondary-nav-rail';
import { PublicSecondaryNavTopbar } from './public-secondary-nav-topbar';
import type { PublicSecondaryNavProps } from './public-secondary-nav.types';

export function PublicSecondaryNav({
  mode = 'rail',
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
  if (mode === 'topbar') {
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
