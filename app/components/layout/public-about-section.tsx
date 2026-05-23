/**
 * File: public-about-section.tsx
 * Description: Renders a single about-page section through the shared public card frame.
 */
import AboutHighlightTile from '@app/components/layout/about/about-highlight-tile';
import PublicCardFrame from '@app/components/public/public-card-frame';
import { PUBLIC_SURFACE_STYLE_VALUES } from '@app/components/public/public-surface';
import { PUBLIC_SECTION_FOCUS_LINE_RATIO } from '@app/components/public/sections/public-section.constants';
import type { SectionLayout } from '@app/components/public/sections/public-section.types';
import type { AboutHighlight, AboutSection } from '@app/public/content-types';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

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
 * Output: one about-page section using the shared public card frame and default card animation.
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
  const contentClassName = 'flex-1 px-7 py-8 md:px-9 md:py-9';

  const content = (
    <Pressable className={contentClassName} onPress={onPress}>
      <View className="items-center gap-3">
        <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-accent">
          {section.eyebrow}
        </Text>
        <Text className="max-w-5xl text-center text-[1.8rem] font-bold leading-tight text-public-heading md:text-[2.3rem]">
          {section.headline}
        </Text>
      </View>
      <Text className="mt-6 max-w-4xl text-center text-base leading-7 text-public-muted">
        {section.summary}
      </Text>
      <View style={styles.detailsArea}>
        <View className="flex-row flex-wrap gap-3">
          {section.highlights.map((highlight: AboutHighlight) => (
            <AboutHighlightTile key={highlight.title} highlight={highlight} />
          ))}
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.chapter, isContentDrivenMobile ? styles.chapterMobile : null]}>
      <PublicCardFrame
        backgroundImageUri={section.backgroundImageUri}
        backgroundPreset="none"
        className={isActive ? 'definition-public' : ''}
        focusLineRatio={PUBLIC_SECTION_FOCUS_LINE_RATIO}
        layoutOffsetY={sectionLayout?.y}
        scrollY={scrollY}
        style={styles.shell}
        variant="default"
        viewportHeight={viewportHeight}
      >
        {content}
      </PublicCardFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  chapter: {
    justifyContent: 'flex-start',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  chapterMobile: {
    justifyContent: 'flex-start',
    paddingVertical: 0,
  },
  detailsArea: {
    marginTop: 30,
  },
  shell: {
    definitionColor: PUBLIC_SURFACE_STYLE_VALUES.sectionDefinitionColor,
    definitionOffset: {
      width: 0,
      height: 18,
    },
    definitionOpacity: 0.22,
    definitionRadius: 26,
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
  },
});
