/**
 * File: about-section-rail.tsx
 * Description: About-page adapter for the shared public secondary navigation shell.
 */
import type { PublicSecondaryNavAnimatedState } from '@/components/public/public-secondary-nav.types';
import PublicSecondaryNav from '@/components/public/public-secondary-nav';
import type { AboutPageContent } from '@/data/public/about-content';

type AboutSectionRailProps = {
  activeSectionId: string;
  content: AboutPageContent;
  getItemAnimatedState: (sectionId: string) => PublicSecondaryNavAnimatedState;
  layoutMode: 'rail' | 'topbar';
  onSectionPress: (sectionId: string) => void;
  railRightOffset: number;
  railShellHeight: number;
  shouldShowItemSubtitle: (sectionId: string) => boolean;
  topbarShellHeight: number;
};

/**
 * Inputs: About-page navigation metadata and animation helpers.
 * Output: the shared public secondary nav configured for the About page.
 */
export default function AboutSectionRail({
  activeSectionId,
  content,
  getItemAnimatedState,
  layoutMode,
  onSectionPress,
  railRightOffset,
  railShellHeight,
  shouldShowItemSubtitle,
  topbarShellHeight,
}: AboutSectionRailProps) {
  const items = content.sections.map((section) => ({
    id: section.id,
    title: section.headline,
    subtitle: section.eyebrow,
  }));

  return (
    <PublicSecondaryNav
      activeId={activeSectionId}
      items={items}
      mode={layoutMode}
      title={content.railTitle}
      subtitle={content.railSubtitle}
      railRightOffset={railRightOffset}
      railShellHeight={railShellHeight}
      topbarShellHeight={topbarShellHeight}
      getItemAnimatedState={getItemAnimatedState}
      onItemPress={onSectionPress}
      shouldShowSubtitle={shouldShowItemSubtitle}
    />
  );
}
