/**
 * File: about-highlight-tile.tsx
 * Description: Renders a single about-page highlight tile, optionally as a linked CTA card.
 */
import PublicSurface, { PUBLIC_SURFACE_CLASSES } from '@app/components/public/public-surface';
import type { AboutHighlight } from '@app/public/content-types';
import { Link, type Href } from 'expo-router';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

type AboutHighlightTileProps = {
  highlight: AboutHighlight;
};

/**
 * Inputs: one highlight record.
 * Output: a static or linked subsection tile with subtle hover animation for linked items.
 */
export default function AboutHighlightTile({ highlight }: AboutHighlightTileProps) {
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

  const background = isLink ? (
    <>
      <Animated.View
        className={PUBLIC_SURFACE_CLASSES.card.decorativeGlowClassName}
        pointerEvents="none"
        style={[styles.highlightGlow, animatedGlowStyle]}
      />
      <Animated.View
        className={PUBLIC_SURFACE_CLASSES.card.decorativeSheenClassName}
        pointerEvents="none"
        style={[styles.highlightSheen, sheenStyle]}
      />
    </>
  ) : null;

  const content = (
    <PublicSurface
      animated
      background={background}
      className={PUBLIC_SURFACE_CLASSES.card.contentTileClassName}
      style={animatedTileStyle}
      variant="standardCard"
    >
      <View className="flex-1 items-center justify-between">
        <Text className={`text-center text-sm font-bold uppercase tracking-[0.18em] ${PUBLIC_SURFACE_CLASSES.text.bodyWarmClassName}`}>
          {highlight.title}
        </Text>
        <Text className={`mt-3 text-center text-sm leading-6 ${PUBLIC_SURFACE_CLASSES.text.bodyClassName}`}>
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
    </PublicSurface>
  );

  if (!isLink || !highlight.href) {
    return <View style={styles.highlightOuter}>{content}</View>;
  }

  return (
    <Link href={highlight.href as Href} asChild>
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

const styles = StyleSheet.create({
  highlightOuter: {
    minWidth: 220,
    flex: 1,
    alignSelf: 'stretch',
  },
  highlightGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
  },
  highlightSheen: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 90,
    borderRadius: 999,
  },
  highlightCtaWrap: {
    marginTop: 28,
    alignItems: 'center',
    width: '100%',
  },
});
