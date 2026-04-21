/**
 * File: public-about-section.tsx
 * Description: Renders a single about-page section by mapping About content into the shared public section shell.
 */
import AboutHighlightTile from '@app/components/layout/about/about-highlight-tile';
import { getSectionProgress } from '@app/components/layout/about/about-section-motion';
import type { SectionLayout } from '@app/components/public/sections/public-section.types';
import PublicSectionShell from '@app/components/public/sections/public-section-shell';
import type { AboutHighlight, AboutSection } from '@app/public/content-types';
import { Animated, Text, View, useWindowDimensions } from 'react-native';

type PublicAboutSectionProps = {
  isActive: boolean;
  onPress: () => void;
  scrollY: Animated.Value;
  section: AboutSection;
  focusLineRatio: number;
  sectionLayout?: SectionLayout;
  viewportHeight: number;
};

/**
 * Inputs: the section copy, scroll driver, and viewport/layout measurements.
 * Output: one about-page section with stable layout and subtle focus-aware accent motion.
 */
export default function PublicAboutSection({
  isActive,
  onPress,
  scrollY,
  section,
  focusLineRatio,
  sectionLayout,
  viewportHeight,
}: PublicAboutSectionProps) {
  const { width } = useWindowDimensions();
  const isContentDrivenMobile = width <= 720;

  const rawProgress = getSectionProgress(scrollY, sectionLayout, viewportHeight, focusLineRatio);
  const progress =
    typeof rawProgress === 'number'
      ? rawProgress
      : rawProgress.interpolate({
          inputRange: [0, 0.24, 0.6, 0.86, 1],
          outputRange: [0, 0.2, 0.76, 0.94, 1],
          extrapolate: 'clamp',
        });
  const shellScale =
    typeof progress === 'number'
      ? 0.997
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.997, 1],
          extrapolate: 'clamp',
        });
  const shellTranslateY =
    typeof progress === 'number'
      ? 8
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
          extrapolate: 'clamp',
        });
  const backgroundTranslateY =
    typeof progress === 'number'
      ? 10
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
          extrapolate: 'clamp',
        });
  const backgroundScale =
    typeof progress === 'number'
      ? 1.03
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1.03, 1],
          extrapolate: 'clamp',
        });
  const shellBackgroundColor =
    typeof progress === 'number'
      ? 'rgba(7, 19, 42, 0.56)'
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['rgba(7, 19, 42, 0.56)', 'rgba(8, 25, 54, 0.72)'],
          extrapolate: 'clamp',
        });
  const shellBorderColor =
    typeof progress === 'number'
      ? 'rgba(117, 149, 186, 0.4)'
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['rgba(117, 149, 186, 0.4)', 'rgba(109, 211, 255, 0.9)'],
          extrapolate: 'clamp',
        });
  const accentOverlayOpacity =
    typeof progress === 'number'
      ? 0.06
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.06, 0.15],
          extrapolate: 'clamp',
        });
  const bodyTranslateY =
    typeof progress === 'number'
      ? 8
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
          extrapolate: 'clamp',
        });
  const bodyOpacity =
    typeof progress === 'number'
      ? 0.9
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1],
          extrapolate: 'clamp',
        });
  const detailTranslateY =
    typeof progress === 'number'
      ? 10
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
          extrapolate: 'clamp',
        });
  const detailOpacity =
    typeof progress === 'number'
      ? 0.92
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
          extrapolate: 'clamp',
        });
  const eyebrowColor =
    typeof progress === 'number'
      ? '#9ec7ea'
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['#9ec7ea', '#b7f38d'],
          extrapolate: 'clamp',
        });
  const headlineColor =
    typeof progress === 'number'
      ? '#8ec5ff'
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['#8ec5ff', '#b5dcff'],
          extrapolate: 'clamp',
        });

  return (
    <PublicSectionShell
      accentAnimatedStyle={{ opacity: accentOverlayOpacity }}
      backgroundAnimatedStyle={{ transform: [{ translateY: backgroundTranslateY }, { scale: backgroundScale }] }}
      backgroundImageUri={section.backgroundImageUri}
      details={
        <View className="flex-row flex-wrap gap-3">
          {section.highlights.map((highlight: AboutHighlight) => (
            <AboutHighlightTile key={highlight.title} highlight={highlight} />
          ))}
        </View>
      }
      detailsAnimatedStyle={{
        opacity: detailOpacity,
        transform: [{ translateY: detailTranslateY }],
      }}
      header={
        <View className="items-center gap-3">
          <Animated.Text
            className="text-xs font-bold uppercase tracking-[0.28em]"
            style={{ color: eyebrowColor }}
          >
            {section.eyebrow}
          </Animated.Text>
          <Animated.Text
            className="max-w-5xl text-center text-[1.8rem] font-bold leading-tight md:text-[2.3rem]"
            style={{ color: headlineColor }}
          >
            {section.headline}
          </Animated.Text>
        </View>
      }
      isActive={isActive}
      isMobile={isContentDrivenMobile}
      onPress={onPress}
      shellAnimatedStyle={{
        backgroundColor: shellBackgroundColor,
        borderColor: shellBorderColor,
        transform: [{ translateY: shellTranslateY }, { scale: shellScale }],
      }}
      summary={
        <Animated.View style={{ opacity: bodyOpacity, transform: [{ translateY: bodyTranslateY }] }}>
          <Text className="mt-6 max-w-4xl text-center text-base leading-7 text-public-muted">
            {section.summary}
          </Text>
        </Animated.View>
      }
    />
  );
}
