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
  shouldShowItemSubtitle,
}: PublicSecondaryNavProps) {
  const sharedNavProps = {
    items,
    activeId,
    onItemPress,
    title,
    subtitle,
    getItemAnimatedState,
    shouldShowItemSubtitle,
  };

  if (mode === 'topbar') {
    return <PublicSecondaryNavTopbar {...sharedNavProps} topbarShellHeight={topbarShellHeight} />;
  }

  return (
    <PublicSecondaryNavRail
      {...sharedNavProps}
      title={title ?? ''}
      subtitle={subtitle ?? ''}
      railWidth={railWidth}
      railShellHeight={railShellHeight ?? 540}
      railRightOffset={railRightOffset}
    />
  );
}

export default PublicSecondaryNav;
