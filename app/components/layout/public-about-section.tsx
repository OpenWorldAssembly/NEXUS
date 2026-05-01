/**
 * File: public-about-section.tsx
 * Description: Renders a single about-page section by mapping About content into the shared public section shell.
 */
import AboutHighlightTile from '@app/components/layout/about/about-highlight-tile';
import { PUBLIC_SECTION_FOCUS_LINE_RATIO } from '@app/components/public/sections/public-section.constants';
import type { SectionLayout } from '@app/components/public/sections/public-section.types';
import PublicSectionShell from '@app/components/public/sections/public-section-shell';
import type { AboutHighlight, AboutSection } from '@app/public/content-types';
import { Animated, Text, View, useWindowDimensions } from 'react-native';

type PublicAboutSectionProps = {
  isActive: boolean;
  onPress: () => void;
  scrollY: Animated.Value;
  section: AboutSection;
  sectionLayout?: SectionLayout;
  viewportHeight: number;
};

/**
 * Inputs: the section copy, scroll driver, and viewport/layout measurements.
 * Output: one about-page section using the shared public section shell and default card animation.
 */
export default function PublicAboutSection({
  isActive,
  onPress,
  scrollY,
  section,
  sectionLayout,
  viewportHeight,
}: PublicAboutSectionProps) {
  const { width } = useWindowDimensions();
  const isContentDrivenMobile = width <= 720;

  return (
    <PublicSectionShell
      backgroundImageUri={section.backgroundImageUri}
      focusLineRatio={PUBLIC_SECTION_FOCUS_LINE_RATIO}
      layoutOffsetY={sectionLayout?.y}
      scrollY={scrollY}
      details={
        <View className="flex-row flex-wrap gap-3">
          {section.highlights.map((highlight: AboutHighlight) => (
            <AboutHighlightTile key={highlight.title} highlight={highlight} />
          ))}
        </View>
      }
      header={
        <View className="items-center gap-3">
          <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-accent">
            {section.eyebrow}
          </Text>
          <Text className="max-w-5xl text-center text-[1.8rem] font-bold leading-tight text-public-heading md:text-[2.3rem]">
            {section.headline}
          </Text>
        </View>
      }
      isActive={isActive}
      isMobile={isContentDrivenMobile}
      onPress={onPress}
      viewportHeight={viewportHeight}
      summary={
        <Text className="mt-6 max-w-4xl text-center text-base leading-7 text-public-muted">
          {section.summary}
        </Text>
      }
    />
  );
}
