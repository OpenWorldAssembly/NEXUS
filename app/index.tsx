/**
 * File: index.tsx
 * Description: Renders the public OWA landing page with a sliding hero carousel and revised public-site messaging.
 */
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  publicHeroSlides,
  publicPrinciples,
  type PublicHeroSlide,
} from '@/data/public/public-site-content';

type HeroSlideLayerProps = {
  slide: PublicHeroSlide;
  translateX: number | Animated.AnimatedInterpolation<number>;
};

const HERO_TRANSITION_DURATION_MS = 1100;

/**
 * Inputs: the current slide index, a signed step amount, and the available slide count.
 * Output: the wrapped slide index after moving backward or forward through the hero list.
 */
function getWrappedSlideIndex(currentIndex: number, step: number, slideCount: number) {
  return (currentIndex + step + slideCount) % slideCount;
}

/**
 * Inputs: the current slide index, requested slide index, and available slide count.
 * Output: the preferred slide direction where `1` means next/leftward and `-1` means previous/rightward.
 */
function getSlideDirection(currentIndex: number, nextIndex: number, slideCount: number) {
  const forwardDistance = (nextIndex - currentIndex + slideCount) % slideCount;
  const backwardDistance = (currentIndex - nextIndex + slideCount) % slideCount;

  if (forwardDistance === 0) {
    return 1;
  }

  return forwardDistance <= backwardDistance ? 1 : -1;
}

/**
 * Inputs: a single hero slide plus its horizontal animation value.
 * Output: one animated hero layer containing the slide artwork and public-facing copy.
 */
function HeroSlideLayer({ slide, translateX }: HeroSlideLayerProps) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          transform: [{ translateX }],
        },
      ]}
    >
      <Image
        source={{ uri: slide.backgroundImageUri }}
        contentFit="cover"
        transition={0}
        style={StyleSheet.absoluteFillObject}
      />
      <View className="absolute inset-0 bg-public-canvas/45" />
      <View className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-public-cyan/20 blur-3xl" />
      <View className="absolute right-0 top-16 h-48 w-48 rounded-full bg-public-accent/10 blur-3xl" />

      <View className="flex-1 gap-8 px-6 py-10 md:px-10 md:py-14">
        <View className="gap-6">
          <Text className="text-sm font-bold uppercase tracking-[0.35em] text-public-accentSoft">
            {slide.eyebrow}
          </Text>

          <View className="max-w-4xl gap-4 pr-2 md:pr-8">
            <Text className="text-5xl font-black leading-[1.05] text-public-text md:text-6xl lg:text-7xl">
              {slide.title}
            </Text>

            <Text className="max-w-3xl text-lg leading-8 text-public-muted md:text-xl">
              {slide.body}
            </Text>
          </View>
        </View>

        <View className="mt-2 max-w-3xl gap-2 rounded-[1.75rem] border border-public-line/70 bg-public-panel/60 p-6">
          <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-sand">
            {slide.kicker}
          </Text>
          <Text className="text-base leading-7 text-public-muted md:text-lg">
            {slide.detail}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * Inputs: none.
 * Output: the redesigned public splash page for OWA.
 */
export default function HomePage() {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [incomingSlideIndex, setIncomingSlideIndex] = useState<number | null>(null);
  const [transitionDirection, setTransitionDirection] = useState(1);
  const [heroWidth, setHeroWidth] = useState(0);
  const heroTransition = useRef(new Animated.Value(0)).current;
  const isTransitioningRef = useRef(false);
  const { width: windowWidth } = useWindowDimensions();
  const measuredHeroWidth = heroWidth || Math.max(windowWidth - 40, 320);
  const activeSlide = publicHeroSlides[activeSlideIndex];
  const incomingSlide =
    incomingSlideIndex === null ? null : publicHeroSlides[incomingSlideIndex];
  const highlightedSlideIndex =
    incomingSlideIndex === null ? activeSlideIndex : incomingSlideIndex;
  const incomingStartOffset = transitionDirection * measuredHeroWidth;
  const outgoingEndOffset = -transitionDirection * measuredHeroWidth;
  const outgoingTranslateX =
    incomingSlideIndex === null
      ? 0
      : heroTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [0, outgoingEndOffset],
          extrapolate: 'clamp',
        });
  const incomingTranslateX =
    incomingSlideIndex === null
      ? measuredHeroWidth
      : heroTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [incomingStartOffset, 0],
          extrapolate: 'clamp',
        });

  /**
   * Inputs: the next slide index and optional direction override.
   * Output: animates the hero from the current slide to the requested slide with eased horizontal motion.
   */
  const showSlide = useCallback(
    (nextIndex: number, directionOverride?: number) => {
      if (
        nextIndex === activeSlideIndex ||
        isTransitioningRef.current ||
        nextIndex < 0 ||
        nextIndex >= publicHeroSlides.length
      ) {
        return;
      }

      isTransitioningRef.current = true;
      setTransitionDirection(
        directionOverride ??
          getSlideDirection(activeSlideIndex, nextIndex, publicHeroSlides.length)
      );
      setIncomingSlideIndex(nextIndex);
      heroTransition.setValue(0);

      Animated.timing(heroTransition, {
        toValue: 1,
        duration: HERO_TRANSITION_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          isTransitioningRef.current = false;
          return;
        }

        setActiveSlideIndex(nextIndex);
        setIncomingSlideIndex(null);
        heroTransition.setValue(0);
        isTransitioningRef.current = false;
      });
    },
    [activeSlideIndex, heroTransition]
  );

  /**
   * Inputs: the hero viewport layout event.
   * Output: stores the viewport width so the carousel slide distance matches the real rendered container.
   */
  function handleHeroLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;

    setHeroWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  }

  /**
   * Inputs: none.
   * Output: advances the hero slider to the next slide.
   */
  function showNextSlide() {
    showSlide(getWrappedSlideIndex(activeSlideIndex, 1, publicHeroSlides.length), 1);
  }

  /**
   * Inputs: none.
   * Output: moves the hero slider to the previous slide.
   */
  function showPreviousSlide() {
    showSlide(getWrappedSlideIndex(activeSlideIndex, -1, publicHeroSlides.length), -1);
  }

  /**
   * Inputs: none.
   * Output: keeps the hero rotating while the home page remains mounted.
   */
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (isTransitioningRef.current) {
        return;
      }

      showSlide(getWrappedSlideIndex(activeSlideIndex, 1, publicHeroSlides.length), 1);
    }, 6500);

    return () => clearInterval(intervalId);
  }, [activeSlideIndex, showSlide]);

  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-16">
      <View className="mx-auto w-full max-w-6xl px-5 py-8">
        <View className="overflow-hidden rounded-[2rem] border border-public-line/70 bg-public-shell/70 shadow-public">
          <View
            className="relative min-h-[36rem] overflow-hidden md:min-h-[40rem]"
            onLayout={handleHeroLayout}
          >
            <HeroSlideLayer slide={activeSlide} translateX={outgoingTranslateX} />

            {incomingSlide ? (
              <HeroSlideLayer slide={incomingSlide} translateX={incomingTranslateX} />
            ) : null}
          </View>

          <View className="border-t border-public-line/70 bg-public-panel/55 px-6 py-5 md:px-10">
            <View className="flex-row flex-wrap items-center justify-between gap-4">
              <View className="flex-row flex-wrap gap-3">
                <Link href="/about" asChild>
                  <Pressable className="rounded-full bg-public-accent px-6 py-3">
                    <Text className="text-sm font-extrabold uppercase tracking-[0.18em] text-public-canvas">
                      Learn More
                    </Text>
                  </Pressable>
                </Link>

                <Link href="/docs" asChild>
                  <Pressable className="rounded-full border border-public-line bg-public-shell/75 px-6 py-3">
                    <Text className="text-sm font-bold uppercase tracking-[0.18em] text-public-text">
                      Read the Charter
                    </Text>
                  </Pressable>
                </Link>

                <Link href="/nexus/dashboard" asChild>
                  <Pressable className="rounded-full border border-public-line bg-public-shell/75 px-6 py-3">
                    <Text className="text-sm font-bold uppercase tracking-[0.18em] text-public-text">
                      Browse the Nexus
                    </Text>
                  </Pressable>
                </Link>
              </View>

              <View className="flex-row items-center gap-3">
                <Pressable
                  className="rounded-full border border-public-line bg-public-shell/75 px-4 py-2"
                  onPress={showPreviousSlide}
                >
                  <Text className="text-sm font-bold uppercase tracking-[0.18em] text-public-text">
                    Prev
                  </Text>
                </Pressable>

                <View className="flex-row items-center gap-2">
                  {publicHeroSlides.map((slide, slideIndex) => (
                    <Pressable
                      key={slide.title}
                      className={[
                        'h-3 w-3 rounded-full border border-public-line',
                        slideIndex === highlightedSlideIndex
                          ? 'bg-public-accent'
                          : 'bg-public-shell/70',
                      ].join(' ')}
                      onPress={() => showSlide(slideIndex)}
                    />
                  ))}
                </View>

                <Pressable
                  className="rounded-full border border-public-line bg-public-shell/75 px-4 py-2"
                  onPress={showNextSlide}
                >
                  <Text className="text-sm font-bold uppercase tracking-[0.18em] text-public-text">
                    Next
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <View className="mt-10 gap-4">
          <Text className="text-sm font-bold uppercase tracking-[0.3em] text-public-cyan">
            Antifragile direct democracy
          </Text>
          <View className="flex-row flex-wrap gap-4">
            {publicPrinciples.map((principle) => (
              <View
                key={principle.title}
                className="min-w-[280px] flex-1 rounded-[1.75rem] border border-public-line/70 bg-public-panel/55 p-6"
              >
                <Text className="mb-3 text-2xl font-bold text-public-text">
                  {principle.title}
                </Text>
                <Text className="text-base leading-7 text-public-muted">
                  {principle.body}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className="mt-10 flex-row flex-wrap gap-4">
          <View className="min-w-[280px] flex-1 rounded-[1.75rem] border border-public-line/70 bg-public-panel/55 p-6">
            <Text className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-public-sand">
              Built for real communities
            </Text>
            <Text className="text-2xl font-bold text-public-text">
              Local legitimacy can grow into wider coordination
            </Text>
            <Text className="mt-3 text-base leading-7 text-public-muted">
              OWA starts where people already live and work. Neighborhoods, cities, regions, and larger scales can all use the same democratic pattern without handing power to a permanent center.
            </Text>
          </View>

          <View className="min-w-[280px] flex-1 rounded-[1.75rem] border border-public-line/70 bg-public-panel/55 p-6">
            <Text className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-public-sand">
              More than discussion
            </Text>
            <Text className="text-2xl font-bold text-public-text">
              Deliberation, decisions, action, and memory stay connected
            </Text>
            <Text className="mt-3 text-base leading-7 text-public-muted">
              The aim is not another feed or petition tool. It is a durable democratic process that can carry shared intent from public reasoning into visible commitments and real-world follow-through.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
