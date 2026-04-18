/**
 * File: public-home-hero-slider.tsx
 * Description: Renders the homepage's high-impact hero slider with restrained text-led navigation.
 */
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import type { PublicHeroSlide } from '@app/public/content-types';
import PublicPageActions, { type PublicPageAction } from './public-page-actions';

type PublicHomeHeroSliderProps = {
  slides: PublicHeroSlide[];
  actions: PublicPageAction[];
};

type HeroSlideLayerProps = {
  slide: PublicHeroSlide;
  translateX: number | Animated.AnimatedInterpolation<number>;
};

const HERO_TRANSITION_DURATION_MS = 1100;
const HERO_ROTATION_INTERVAL_MS = 6800;

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

      <View className="absolute inset-0 bg-[#020d26]/44" />
      <View className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#020d26]/30 to-transparent" />

      <View className="flex-1 justify-between px-6 py-8 md:px-10 md:py-10">
        <View className="max-w-4xl gap-5 md:gap-6">
          <Text className="text-[11px] font-bold uppercase tracking-[0.34em] text-public-cyan md:text-xs">
            {slide.eyebrow}
          </Text>

          <Text className="text-[2.4rem] font-black leading-[1.02] text-public-text md:text-6xl lg:text-7xl">
            {slide.title}
          </Text>

          <Text className="max-w-3xl text-base leading-7 text-public-muted md:text-xl md:leading-8">
            {slide.body}
          </Text>
        </View>

        <View className="max-w-3xl rounded-[1.65rem] border border-public-line/65 bg-public-panel/45 p-5 md:p-6">
          <Text className="text-[11px] font-bold uppercase tracking-[0.3em] text-public-sand md:text-xs">
            {slide.kicker}
          </Text>
          <Text className="mt-3 text-sm leading-6 text-public-muted md:text-base md:leading-7">
            {slide.detail}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * Inputs: hero slides plus CTA actions.
 * Output: a homepage hero slider with restrained text-first navigation and autoplay.
 */
export default function PublicHomeHeroSlider({ slides, actions }: PublicHomeHeroSliderProps) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [incomingSlideIndex, setIncomingSlideIndex] = useState<number | null>(null);
  const [transitionDirection, setTransitionDirection] = useState(1);
  const [heroWidth, setHeroWidth] = useState(0);
  const heroTransition = useRef(new Animated.Value(0)).current;
  const isTransitioningRef = useRef(false);
  const { width: windowWidth } = useWindowDimensions();
  const measuredHeroWidth = heroWidth || Math.max(windowWidth - 40, 320);
  const activeSlide = slides[activeSlideIndex];
  const incomingSlide = incomingSlideIndex === null ? null : slides[incomingSlideIndex];
  const highlightedSlideIndex = incomingSlideIndex === null ? activeSlideIndex : incomingSlideIndex;
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
        nextIndex >= slides.length
      ) {
        return;
      }

      isTransitioningRef.current = true;
      setTransitionDirection(
        directionOverride ?? getSlideDirection(activeSlideIndex, nextIndex, slides.length)
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
    [activeSlideIndex, heroTransition, slides]
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
    showSlide(getWrappedSlideIndex(activeSlideIndex, 1, slides.length), 1);
  }

  /**
   * Inputs: none.
   * Output: moves the hero slider to the previous slide.
   */
  function showPreviousSlide() {
    showSlide(getWrappedSlideIndex(activeSlideIndex, -1, slides.length), -1);
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

      showSlide(getWrappedSlideIndex(activeSlideIndex, 1, slides.length), 1);
    }, HERO_ROTATION_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [activeSlideIndex, showSlide, slides.length]);

    return (
      <View className="overflow-hidden rounded-[2rem] bg-public-shell/70 shadow-public">
        <View
          className="relative overflow-hidden"
          style={{ minHeight: windowWidth < 768 ? 520 : 620 }}
          onLayout={handleHeroLayout}
        >
        <HeroSlideLayer slide={activeSlide} translateX={outgoingTranslateX} />

        {incomingSlide ? (
          <HeroSlideLayer slide={incomingSlide} translateX={incomingTranslateX} />
        ) : null}

        <View className="absolute inset-x-0 bottom-0 gap-4 border-t border-public-line/60 bg-[#03101f]/74 px-5 py-4 backdrop-blur-md md:px-8 md:py-5">
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1 pr-2">
              <Text className="text-[11px] font-bold uppercase tracking-[0.28em] text-public-muted">
                Open World Assembly
              </Text>
              <Text className="mt-2 text-sm leading-6 text-public-text md:text-base">
                A practical path from shared intent to coordinated action.
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous slide"
                className="h-11 w-11 items-center justify-center rounded-full border border-public-line/80 bg-public-panel/55"
                onPress={showPreviousSlide}
              >
                <Text className="text-xl font-semibold text-public-text">‹</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next slide"
                className="h-11 w-11 items-center justify-center rounded-full border border-public-line/80 bg-public-panel/55"
                onPress={showNextSlide}
              >
                <Text className="text-xl font-semibold text-public-text">›</Text>
              </Pressable>
            </View>
          </View>

          <PublicPageActions actions={actions} />

          <View className="flex-row flex-wrap gap-x-5 gap-y-3 border-t border-public-line/50 pt-4">
            {slides.map((slide, index) => {
              const isActive = highlightedSlideIndex === index;

              return (
                <Pressable
                  key={`${slide.kicker}:${index}`}
                  accessibilityRole="button"
                  className="min-w-[180px] max-w-[250px]"
                  onPress={() =>
                    showSlide(index, getSlideDirection(activeSlideIndex, index, slides.length))
                  }
                >
                  <Text
                    className={[
                      'text-[11px] font-bold uppercase tracking-[0.26em]',
                      isActive ? 'text-public-cyan' : 'text-public-muted',
                    ].join(' ')}
                  >
                    {slide.kicker}
                  </Text>
                  <Text
                    className={[
                      'mt-1 text-sm leading-6',
                      isActive ? 'text-public-text' : 'text-public-muted',
                    ].join(' ')}
                  >
                    {slide.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}
