/**
 * File: public-about-section.tsx
 * Description: Renders a single about-page section as a midpoint-driven chapter with smooth synchronized expansion.
 */
import type { AboutHighlight, AboutSection } from '@/data/public/public-site-content';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

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

type HighlightTileProps = {
  highlight: AboutHighlight;
};

/**
 * Inputs: one highlight record.
 * Output: a static or linked subsection tile with subtle hover animation for linked items.
 */
function HighlightTile({ highlight }: HighlightTileProps) {
  const hover = useRef(new Animated.Value(0)).current;
  const isLink = !!highlight.href;

  const ctaColor =
    highlight.color === 'sand'
      ? '#f7d995'
      : highlight.color === 'cyan'
        ? '#6dd3ff'
        : highlight.color === 'accent'
          ? '#9fe870'
          : '#cfd8e3';

  const animatedTileStyle = isLink
    ? {
        transform: [
          {
            scale: hover.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.018],
            }),
          },
          {
            translateY: hover.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -3],
            }),
          },
        ],
      }
    : undefined;

  const animatedCtaStyle = isLink
    ? {
        opacity: hover.interpolate({
          inputRange: [0, 1],
          outputRange: [0.82, 1],
        }),
        transform: [
          {
            translateY: hover.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -1],
            }),
          },
        ],
      }
    : undefined;

  const animatedGlowStyle = isLink
    ? {
        opacity: hover.interpolate({
          inputRange: [0, 1],
          outputRange: [0.04, 0.16],
        }),
      }
    : undefined;

  const sheenStyle = isLink
    ? {
        opacity: hover.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 0.18],
        }),
        transform: [
          {
            translateX: hover.interpolate({
              inputRange: [0, 1],
              outputRange: [-140, 220],
            }),
          },
          { rotate: '-18deg' as const },
        ],
      }
    : undefined;

    const content = (
      <Animated.View
        style={animatedTileStyle}
        className="min-w-[220px] flex-1 overflow-hidden rounded-[1.25rem] bg-public-shell/78 p-5"
      >
        {isLink ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[styles.highlightGlow, animatedGlowStyle]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.highlightSheen, sheenStyle]}
            />
          </>
        ) : null}

        <View className="flex-1 items-center justify-between">
          <Text className="text-center text-sm font-bold uppercase tracking-[0.18em] text-public-sand">
            {highlight.title}
          </Text>
          <Text className="mt-3 text-center text-sm leading-6 text-public-muted">
            {highlight.body}
          </Text>

          {highlight.cta ? (
            <View style={styles.highlightCtaWrap}>
              <Animated.Text
                className="text-center text-sm font-semibold"
                style={[{ color: ctaColor, alignSelf: 'center' }, animatedCtaStyle]}
              >
                → {highlight.cta}
              </Animated.Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
    );

  if (!isLink) {
    return (
      <View key={highlight.title} style={styles.highlightOuter}>
        {content}
      </View>
    );
  }

  const href = highlight.href;

  if (!href) {
    return (
      <View key={highlight.title} style={styles.highlightOuter}>
        {content}
      </View>
    );
  }

  return (
    <Link key={highlight.title} href={href} asChild>
      <Pressable
        style={styles.highlightOuter}
        onHoverIn={() => {
          Animated.timing(hover, {
            toValue: 1,
            duration: 170,
            useNativeDriver: true,
          }).start();
        }}
        onHoverOut={() => {
          Animated.timing(hover, {
            toValue: 0,
            duration: 170,
            useNativeDriver: true,
          }).start();
        }}
      >
        {content}
      </Pressable>
    </Link>
  );
}

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
    typeof progress === 'number'
      ? 0
      : progress.interpolate({
          inputRange: [0.08, 0.34, 0.7, 1],
          outputRange: [0, expandedHeight * 0.1, expandedHeight * 0.34, expandedHeight * 0.5],
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
            <Text className="max-w-5xl text-center text-[1.8rem] font-bold leading-tight text-public-text md:text-[2.3rem]">
              {section.headline}
            </Text>
          </View>

          <Animated.View
            style={{ opacity: bodyOpacity, transform: [{ translateY: bodyTranslateY }] }}
          >
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
              {section.highlights.map((highlight) => (
                <HighlightTile key={highlight.title} highlight={highlight} />
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
  highlightOuter: {
    minWidth: 220,
    flex: 1,
    alignSelf: 'stretch',
  },
  highlightGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
  },
  highlightSheen: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 90,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
  },
  highlightCtaWrap: {
    marginTop: 28,
    alignItems: 'center',
    width: '100%',
  },
});