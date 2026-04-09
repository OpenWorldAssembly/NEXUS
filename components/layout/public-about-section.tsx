/**
 * File: public-about-section.tsx
 * Description: Renders a single about-page section as a midpoint-driven chapter with smooth synchronized expansion.
 */
import { Image } from 'expo-image';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AboutSection } from '@/data/public/public-site-content';

type PublicAboutSectionProps = {
  isActive: boolean;
  onPress: () => void;
  scrollY: Animated.Value;
  section: AboutSection;
  focusLineRatio: number;
  chapterHeight: number;
  collapsedHeight: number;
  expandedHeight: number;
  sectionLayout?: {
    y: number;
    height: number;
  };
  viewportHeight: number;
};

/**
 * Inputs: the scroll driver, target section measurements, and the shared focus geometry.
 * Output: a normalized 0-1 progress value that ramps in early, holds through focus, and eases back out.
 */
function getSectionProgress(
  scrollY: Animated.Value,
  sectionLayout: { y: number; height: number } | undefined,
  viewportHeight: number,
  focusLineRatio: number
) {
  if (!sectionLayout) {
    return 0;
  }

  const focusLineOffset = viewportHeight * focusLineRatio;
  const sectionCenter = sectionLayout.y + sectionLayout.height / 2;
  const centeredScrollOffset = Math.max(0, sectionCenter - focusLineOffset);
  const outerRange = Math.max(sectionLayout.height * 0.9, viewportHeight * 0.54, 260);
  const holdRange = Math.max(sectionLayout.height * 0.18, viewportHeight * 0.1, 56);

  return scrollY.interpolate({
    inputRange: [
      centeredScrollOffset - outerRange,
      centeredScrollOffset - holdRange,
      centeredScrollOffset + holdRange,
      centeredScrollOffset + outerRange,
    ],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });
}

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
}: PublicAboutSectionProps) {
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
    typeof progress === 'number'
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
          outputRange: [84, 40, 12, 0],
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
    typeof progress === 'number'
      ? 0
      : progress.interpolate({
          inputRange: [0.08, 0.34, 0.7, 1],
          outputRange: [0, expandedHeight * 0.1, expandedHeight * 0.34, expandedHeight * 0.5],
          extrapolate: 'clamp',
        });
  const overlayOpacity =
    typeof progress === 'number'
      ? 0.74
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.74, 0.4],
          extrapolate: 'clamp',
        });

  return (
    <View style={[styles.chapter, { height: chapterHeight }]}>
      <Animated.View
        style={[
          styles.shell,
          {
            height: cardHeight,
            transform: [{ scale: cardScale }],
          },
        ]}
        className={[
          'overflow-hidden rounded-[1.9rem] border bg-public-panel/45',
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

        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { opacity: overlayOpacity }]}
          className="bg-public-canvas"
        />

        <View pointerEvents="none" style={styles.edgeBlurLayer}>
          <View style={[styles.edgeBlurStrip, styles.edgeBlurTop]}>
            <Animated.View
              style={[styles.parallaxLayer, { transform: [{ translateY: backgroundTranslateY }] }]}
            >
              <Image
                source={{ uri: section.backgroundImageUri }}
                blurRadius={42}
                contentFit="cover"
                style={styles.parallaxImage}
              />
            </Animated.View>
          </View>

          <View style={[styles.edgeBlurStrip, styles.edgeBlurBottom]}>
            <Animated.View
              style={[styles.parallaxLayer, { transform: [{ translateY: backgroundTranslateY }] }]}
            >
              <Image
                source={{ uri: section.backgroundImageUri }}
                blurRadius={42}
                contentFit="cover"
                style={styles.parallaxImage}
              />
            </Animated.View>
          </View>

          <View style={[styles.edgeBlurStrip, styles.edgeBlurLeft]}>
            <Animated.View
              style={[styles.parallaxLayer, { transform: [{ translateY: backgroundTranslateY }] }]}
            >
              <Image
                source={{ uri: section.backgroundImageUri }}
                blurRadius={42}
                contentFit="cover"
                style={styles.parallaxImage}
              />
            </Animated.View>
          </View>

          <View style={[styles.edgeBlurStrip, styles.edgeBlurRight]}>
            <Animated.View
              style={[styles.parallaxLayer, { transform: [{ translateY: backgroundTranslateY }] }]}
            >
              <Image
                source={{ uri: section.backgroundImageUri }}
                blurRadius={42}
                contentFit="cover"
                style={styles.parallaxImage}
              />
            </Animated.View>
          </View>
        </View>

        <Pressable className="flex-1 px-7 py-8 md:px-9 md:py-9" onPress={onPress}>
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1 gap-2">
              <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-accentSoft">
                {section.eyebrow}
              </Text>
              <Text className="text-[1.8rem] font-bold leading-tight text-public-text md:text-[2.3rem]">
                {section.headline}
              </Text>
            </View>

            <Text className="pt-1 text-xs font-bold uppercase tracking-[0.18em] text-public-cyan">
              {isActive ? 'In focus' : 'Scroll to open'}
            </Text>
          </View>

          <Animated.View
            style={{ opacity: bodyOpacity, transform: [{ translateY: bodyTranslateY }] }}
          >
            <Text className="mt-5 max-w-4xl text-base leading-7 text-public-muted">
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
              {section.highlights.map((highlight) => (
                <View
                  key={highlight.title}
                  className="min-w-[220px] flex-1 rounded-[1.25rem] border border-public-line/70 bg-public-shell/78 p-4"
                >
                  <Text className="text-sm font-bold uppercase tracking-[0.18em] text-public-sand">
                    {highlight.title}
                  </Text>
                  <Text className="mt-3 text-sm leading-6 text-public-muted">
                    {highlight.body}
                  </Text>
                </View>
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
  },
  detailsArea: {
    marginTop: 24,
    overflow: 'hidden',
  },
  edgeBlurBottom: {
    bottom: 0,
    height: 86,
    left: 0,
    right: 0,
  },
  edgeBlurLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  edgeBlurLeft: {
    bottom: 0,
    left: 0,
    top: 0,
    width: 76,
  },
  edgeBlurRight: {
    bottom: 0,
    right: 0,
    top: 0,
    width: 76,
  },
  edgeBlurStrip: {
    opacity: 0.72,
    overflow: 'hidden',
    position: 'absolute',
  },
  edgeBlurTop: {
    height: 86,
    left: 0,
    right: 0,
    top: 0,
  },
  parallaxImage: {
    height: '132%',
    width: '100%',
  },
  parallaxLayer: {
    ...StyleSheet.absoluteFillObject,
    top: -24,
    bottom: -24,
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
  },
});
