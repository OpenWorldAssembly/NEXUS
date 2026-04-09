/**
 * File: index.tsx
 * Description: Renders the public OWA landing page with a rotating hero and revised public-site messaging.
 */
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  publicHeroSlides,
  publicPrinciples,
} from '@/data/public/public-site-content';

/**
 * Inputs: none.
 * Output: the redesigned public splash page for OWA.
 */
export default function HomePage() {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const activeSlide = publicHeroSlides[activeSlideIndex];

  /**
   * Inputs: none.
   * Output: advances the hero slider to the next slide.
   */
  function showNextSlide() {
    setActiveSlideIndex((currentIndex) => (currentIndex + 1) % publicHeroSlides.length);
  }

  /**
   * Inputs: none.
   * Output: keeps the hero rotating while the home page remains mounted.
   */
  useEffect(() => {
    const intervalId = setInterval(() => {
      setActiveSlideIndex((currentIndex) => (currentIndex + 1) % publicHeroSlides.length);
    }, 6500);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-16">
      <View className="mx-auto w-full max-w-6xl px-5 py-8">
        <View className="overflow-hidden rounded-[2rem] border border-public-line/70 bg-public-shell/70 shadow-public">
          <Image
            source={{ uri: activeSlide.backgroundImageUri }}
            contentFit="cover"
            transition={350}
            className="absolute inset-0"
          />
          <View className="absolute inset-0 bg-public-canvas/45" />
          <View className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-public-cyan/20 blur-3xl" />
          <View className="absolute right-0 top-16 h-48 w-48 rounded-full bg-public-accent/10 blur-3xl" />

          <View className="gap-6 px-6 py-10 md:px-10 md:py-14">
            <Text className="text-sm font-bold uppercase tracking-[0.35em] text-public-accentSoft">
              {activeSlide.eyebrow}
            </Text>

            <View className="max-w-4xl gap-4">
              <Text className="text-5xl font-black leading-[1.05] text-public-text md:text-7xl">
                {activeSlide.title}
              </Text>

              <Text className="max-w-3xl text-lg leading-8 text-public-muted md:text-xl">
                {activeSlide.body}
              </Text>
            </View>

            <View className="max-w-3xl gap-2 rounded-[1.75rem] border border-public-line/70 bg-public-panel/60 p-6">
              <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-sand">
                {activeSlide.kicker}
              </Text>
              <Text className="text-base leading-7 text-public-muted md:text-lg">
                {activeSlide.detail}
              </Text>
            </View>

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
                  <Pressable className="rounded-full border border-public-line bg-public-panel/70 px-6 py-3">
                    <Text className="text-sm font-bold uppercase tracking-[0.18em] text-public-text">
                      Read the Charter
                    </Text>
                  </Pressable>
                </Link>

                <Link href="/portal" asChild>
                  <Pressable className="rounded-full border border-public-line bg-public-panel/70 px-6 py-3">
                    <Text className="text-sm font-bold uppercase tracking-[0.18em] text-public-text">
                      Browse the Nexus
                    </Text>
                  </Pressable>
                </Link>
              </View>

              <View className="flex-row items-center gap-3">
                <Pressable
                  className="rounded-full border border-public-line bg-public-panel/70 px-4 py-2"
                  onPress={() =>
                    setActiveSlideIndex((currentIndex) =>
                      currentIndex === 0
                        ? publicHeroSlides.length - 1
                        : currentIndex - 1
                    )
                  }
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
                        slideIndex === activeSlideIndex
                          ? 'bg-public-accent'
                          : 'bg-public-panel/70',
                      ].join(' ')}
                      onPress={() => setActiveSlideIndex(slideIndex)}
                    />
                  ))}
                </View>

                <Pressable
                  className="rounded-full border border-public-line bg-public-panel/70 px-4 py-2"
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
