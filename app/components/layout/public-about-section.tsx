/**
 * File: public-about-section.tsx
 * Description: Renders a single about-page section with midpoint-aware accent animation and fully visible detail content.
 */
import AboutHighlightTile from '@app/components/layout/about/about-highlight-tile';
import { getSectionProgress, type SectionLayout } from '@app/components/layout/about/about-section-motion';
import type { AboutHighlight, AboutSection } from '@app/public/content-types';
import { Image } from 'expo-image';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

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
  viewportHeight
}: PublicAboutSectionProps) {
  const { width } = useWindowDimensions();
  const isContentDrivenMobile = width <= 720;

  const rawProgress = getSectionProgress(
    scrollY,
    sectionLayout,
    viewportHeight,
    focusLineRatio
  );
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
    <View
      style={[
        styles.chapter,
        isContentDrivenMobile ? styles.chapterMobile : null,
      ]}
    >
      <Animated.View
        style={[
          styles.shell,
          {
            backgroundColor: shellBackgroundColor,
            borderColor: shellBorderColor,
            transform: [{ translateY: shellTranslateY }, { scale: shellScale }],
          },
        ]}
        className={[
          'overflow-hidden border',
          isActive ? 'shadow-public' : '',
        ].join(' ')}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.parallaxLayer,
            { transform: [{ translateY: backgroundTranslateY }, { scale: backgroundScale }] },
          ]}
        >
          <Image
            source={{ uri: section.backgroundImageUri }}
            contentFit="cover"
            style={styles.parallaxImage}
          />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[styles.accentOverlay, { opacity: accentOverlayOpacity }]}
        />

        <Pressable className="flex-1 px-7 py-8 md:px-9 md:py-9" onPress={onPress}>
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

          <Animated.View style={{ opacity: bodyOpacity, transform: [{ translateY: bodyTranslateY }] }}>
            <Text className="mt-6 max-w-4xl text-center text-base leading-7 text-public-muted">
              {section.summary}
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.detailsArea,
              {
                opacity: detailOpacity,
                transform: [{ translateY: detailTranslateY }],
              },
            ]}
          >
            <View className="flex-row flex-wrap gap-3">
              {section.highlights.map((highlight: AboutHighlight) => (
                <AboutHighlightTile key={highlight.title} highlight={highlight} />
              ))}
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
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
  parallaxImage: {
    height: '112%',
    width: '100%',
  },
  accentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#6dd3ff',
  },
  parallaxLayer: {
    ...StyleSheet.absoluteFillObject,
    top: -8,
    bottom: -8,
  },
  shell: {
    shadowColor: '#07121d',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.22,
    shadowRadius: 26,
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
  },
});
