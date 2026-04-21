/**
 * File: about-section-rail.tsx
 * Description: About-page adapter for the shared public secondary navigation shell.
 */
import { PublicSecondaryNav } from '@app/components/public/public-secondary-nav';
import type {
  PublicSecondaryNavConfig,
  PublicSecondaryNavRenderState,
} from '@app/components/public/public-secondary-nav.types';

type AboutSectionRailProps = {
  config: PublicSecondaryNavConfig;
  state: PublicSecondaryNavRenderState & {
    mode: 'rail' | 'topbar';
    railRightOffset: number;
    railShellHeight: number;
    topbarShellHeight: number;
  };
};

/**
 * Inputs: About-page navigation metadata and animation helpers.
 * Output: the shared public secondary nav configured for the About page.
 */
export default function AboutSectionRail({ config, state }: AboutSectionRailProps) {
  return (
    <PublicSecondaryNav
      {...config}
      {...state}
    />
  );
}
