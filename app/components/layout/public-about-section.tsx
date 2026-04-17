/**
 * File: public-about-section.tsx
 * Description: Renders a single about-page section as a midpoint-driven chapter with smooth synchronized expansion.
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
  chapterHeight: number;
  collapsedHeight: number;
  expandedHeight: number;
  sectionLayout?: SectionLayout;
  viewportHeight: number;
  sectionIndex: number;
};

/**
 * Inputs: the section copy, scroll driver, height targets, and viewport/layout measurements.
 * Output: one large about-page chapter that expands and collapses smoothly around the midpoint focus line.
 */
export default function PublicAboutSection({
  isActive,
  onPress,
  scrollY,
  section,
  focusLineRatio,
  chapterHeight,
  collapsedHeight,
  expandedHeight,
  sectionLayout,
  viewportHeight,
  sectionIndex,
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
          inputRange: [0, 0.22, 0.55, 0.82, 1],
          outputRange: [0, 0.18, 0.72, 0.94, 1],
          extrapolate: 'clamp',
        });
  const cardHeight =
    isContentDrivenMobile
      ? undefined
      : typeof progress === 'number'
        ? collapsedHeight
        : progress.interpolate({
            inputRange: [0, 1],
            outputRange: [collapsedHeight, expandedHeight],
            extrapolate: 'clamp',
          });
  const backgroundTranslateY =
    typeof progress === 'number'
      ? 0
      : progress.interpolate({
          inputRange: [0, 0.35, 0.7, 1],
          outputRange: [32, 18, 8, 0],
          extrapolate: 'clamp',
        });
  const cardScale =
    typeof progress === 'number'
      ? 0.988
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.988, 1],
          extrapolate: 'clamp',
        });
  const bodyTranslateY =
    typeof progress === 'number'
      ? 18
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
          extrapolate: 'clamp',
        });
  const bodyOpacity =
    typeof progress === 'number'
      ? 0.78
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.78, 1],
          extrapolate: 'clamp',
        });
  const detailTranslateY =
    typeof progress === 'number'
      ? 20
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
          extrapolate: 'clamp',
        });
  const detailOpacity =
    typeof progress === 'number'
      ? 0
      : progress.interpolate({
          inputRange: [0.08, 0.35, 0.72, 1],
          outputRange: [0, 0.16, 0.68, 1],
          extrapolate: 'clamp',
        });
  const detailMaxHeight =
    isContentDrivenMobile
      ? undefined
      : typeof progress === 'number'
        ? 0
        : progress.interpolate({
            inputRange: [0.08, 0.34, 0.7, 1],
            outputRange: [0, expandedHeight * 0.1, expandedHeight * 0.34, expandedHeight * 0.5],
            extrapolate: 'clamp',
          });

  return (
    <View
      style={[
        styles.chapter,
        isContentDrivenMobile ? styles.chapterMobile : { height: chapterHeight },
      ]}
    >
      <Animated.View
        style={[
          styles.shell,
          {
            minHeight: isContentDrivenMobile ? undefined : collapsedHeight,
            height: cardHeight,
            transform: [{ scale: cardScale }],
          },
        ]}
        className={[
          'overflow-hidden border bg-public-panel/45',
          isActive ? 'border-public-accent/80 shadow-public' : 'border-public-line/70',
        ].join(' ')}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.parallaxLayer, { transform: [{ translateY: backgroundTranslateY }] }]}
        >
          <Image
            source={{ uri: section.backgroundImageUri }}
            contentFit="cover"
            style={styles.parallaxImage}
          />
        </Animated.View>

        <Pressable className="flex-1 px-7 py-8 md:px-9 md:py-9" onPress={onPress}>
          <View className="items-center gap-3">
            <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-accentSoft">
              {section.eyebrow}
            </Text>
            <Text className="max-w-5xl text-center text-[1.8rem] font-bold leading-tight text-[#8ec5ff] md:text-[2.3rem]">
              {section.headline}
            </Text>
          </View>

          <Animated.View style={{ opacity: bodyOpacity, transform: [{ translateY: bodyTranslateY }] }}>
            <Text className="mt-6 max-w-4xl text-center text-base leading-7 text-public-muted">
              {section.summary}
            </Text>
          </Animated.View>

          <Animated.View
            pointerEvents={isActive ? 'auto' : 'none'}
            style={[
              styles.detailsArea,
              {
                maxHeight: detailMaxHeight,
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
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  chapterMobile: {
    justifyContent: 'flex-start',
    paddingVertical: 0,
  },
  detailsArea: {
    marginTop: 59,
    overflow: 'hidden',
  },
  parallaxImage: {
    height: '112%',
    width: '100%',
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
  headline: {
  color: '#58A6FF',
}
});
