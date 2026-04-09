/**
 * File: about.tsx
 * Description: Renders the public OWA about page with a midpoint-focused chapter scroll experience.
 */
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import {
    Animated,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';

import PublicAboutSection from '@/components/layout/public-about-section';
import { aboutSections } from '@/data/public/public-site-content';

type SectionLayout = {
  y: number;
  height: number;
};

const aboutActionCards = [
  {
    eyebrow: 'Read next',
    title: 'Follow the charter path',
    body: 'The charter page is where OWA will condense its public commitments into the shortest durable statement of the model and its principles.',
    href: '/docs' as const,
    label: 'Read the Charter',
  },
  {
    eyebrow: 'See the interface',
    title: 'Explore the Nexus as a civic browser',
    body: 'The Nexus is the browsing and participation layer for assemblies, proposals, votes, records, and the wider coordination surfaces that sit behind the public explanation site.',
    href: '/nexus/dashboard' as const,
    label: 'Browse the Nexus',
  },
] as const;

const SECTION_FOCUS_LINE_RATIO = 0.10;

/**
 * Inputs: the section layout map, current scroll offset, and viewport height.
 * Output: the section id that is closest to the shared midpoint focus line.
 */
function getFocusedSectionId(
  sectionLayouts: Record<string, SectionLayout>,
  scrollOffsetY: number,
  viewportHeight: number
) {
  const viewportFocusLine = scrollOffsetY + viewportHeight * SECTION_FOCUS_LINE_RATIO;
  let nextFocusedSectionId = aboutSections[0]?.id ?? '';
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const section of aboutSections) {
    const layout = sectionLayouts[section.id];

    if (!layout) {
      continue;
    }

    const sectionCenter = layout.y + layout.height / 2;
    const distance = Math.abs(sectionCenter - viewportFocusLine);

    if (distance < closestDistance) {
      closestDistance = distance;
      nextFocusedSectionId = section.id;
    }
  }

  return nextFocusedSectionId;
}

/**
 * Inputs: none.
 * Output: the public about page with midpoint-based section focus and synchronized chapter animation.
 */
export default function AboutPage() {
  const [activeSectionId, setActiveSectionId] = useState(aboutSections[0]?.id ?? '');
  const [sectionLayouts, setSectionLayouts] = useState<Record<string, SectionLayout>>({});
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const sectionLayoutsRef = useRef<Record<string, SectionLayout>>({});
  const { height: windowHeight } = useWindowDimensions();
  const viewportHeight = scrollViewportHeight || windowHeight;
  const expandedHeight = Math.min(Math.max(viewportHeight * 0.68, 460), 640);
  const collapsedHeight = Math.min(Math.max(viewportHeight * 0.34, 228), 280);
  const chapterHeight = expandedHeight;
  const bottomRunway = Math.max(180, viewportHeight * 0.28);

  /**
   * Inputs: the visible layout event for the scroll viewport.
   * Output: stores the actual public-page viewport height so the focus line matches the visible shell area.
   */
  function handleViewportLayout(event: LayoutChangeEvent) {
    const nextViewportHeight = event.nativeEvent.layout.height;

    setScrollViewportHeight((currentViewportHeight) =>
      currentViewportHeight === nextViewportHeight ? currentViewportHeight : nextViewportHeight
    );
  }

  /**
   * Inputs: a section id and its layout event.
   * Output: stores section layout data for focus and click-centering calculations.
   */
  function handleSectionLayout(sectionId: string, event: LayoutChangeEvent) {
    const nextLayout = {
      y: event.nativeEvent.layout.y,
      height: event.nativeEvent.layout.height,
    };
    const currentLayout = sectionLayoutsRef.current[sectionId];

    if (
      currentLayout?.y === nextLayout.y &&
      currentLayout?.height === nextLayout.height
    ) {
      return;
    }

    sectionLayoutsRef.current = {
      ...sectionLayoutsRef.current,
      [sectionId]: nextLayout,
    };
    setSectionLayouts(sectionLayoutsRef.current);
  }

  /**
   * Inputs: the current scroll event.
   * Output: updates which about section should be tagged as in focus.
   */
  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextFocusedSectionId = getFocusedSectionId(
      sectionLayoutsRef.current,
      event.nativeEvent.contentOffset.y,
      viewportHeight
    );

    setActiveSectionId((currentSectionId) =>
      currentSectionId === nextFocusedSectionId ? currentSectionId : nextFocusedSectionId
    );
  }

  /**
   * Inputs: the target section id.
   * Output: scrolls the chosen section so its midpoint lands on the shared focus line.
   */
  function handleSectionPress(sectionId: string) {
    setActiveSectionId(sectionId);

    const layout = sectionLayoutsRef.current[sectionId];

    if (!layout) {
      return;
    }

    scrollViewRef.current?.scrollTo({
      y: Math.max(
        0,
        layout.y + layout.height / 2 - viewportHeight * SECTION_FOCUS_LINE_RATIO
      ),
      animated: true,
    });
  }

  return (
    <View style={styles.page} onLayout={handleViewportLayout}>
      <Animated.ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomRunway }]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            listener: handleScroll,
            useNativeDriver: false,
          }
        )}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        <View className="mx-auto w-full max-w-6xl px-5 py-8">
          <View className="overflow-hidden rounded-[2rem] border border-public-line/70 bg-public-shell/70 px-6 py-10 shadow-public md:px-10">
            <View className="absolute left-8 top-8 h-36 w-36 rounded-full bg-public-accent/10 blur-3xl" />
            <View className="absolute right-8 top-20 h-44 w-44 rounded-full bg-public-cyan/15 blur-3xl" />

            <Text className="text-sm font-bold uppercase tracking-[0.35em] text-public-cyan">
              About OWA
            </Text>
            <Text className="mt-4 max-w-4xl text-4xl font-black leading-tight text-public-text md:text-6xl">
              How the system works in public terms.
            </Text>
            <Text className="mt-5 max-w-3xl text-lg leading-8 text-public-muted">
              These sections translate the core public principles and features of Open World Assembly into a quick, scannable overview. As you scroll, the section in focus opens to show more detail.
            </Text>

            <View className="mt-8 gap-3 rounded-[1.5rem] border border-public-line/70 bg-public-panel/45 p-4">
              <View className="flex-row flex-wrap items-center justify-between gap-3">
                <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-sand">
                  Section navigator
                </Text>
                <Text className="text-sm text-public-muted">
                  Tap a chapter to center it in view.
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-3">
                {aboutSections.map((section) => {
                  const isActive = section.id === activeSectionId;

                  return (
                    <Pressable
                      key={section.id}
                      className={[
                        'rounded-full border px-4 py-2.5',
                        isActive
                          ? 'border-public-accent bg-public-accent'
                          : 'border-public-line bg-public-shell/70',
                      ].join(' ')}
                      onPress={() => handleSectionPress(section.id)}
                    >
                      <Text
                        className={[
                          'text-sm font-bold uppercase tracking-[0.18em]',
                          isActive ? 'text-public-canvas' : 'text-public-text',
                        ].join(' ')}
                      >
                        {section.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View className="mt-10 gap-10 md:gap-12">
            {aboutSections.map((section) => (
              <View
                key={section.id}
                onLayout={(event) => handleSectionLayout(section.id, event)}
              >
                <PublicAboutSection
                  isActive={section.id === activeSectionId}
                  onPress={() => handleSectionPress(section.id)}
                  scrollY={scrollY}
                  section={section}
                  focusLineRatio={SECTION_FOCUS_LINE_RATIO}
                  chapterHeight={chapterHeight}
                  collapsedHeight={collapsedHeight}
                  expandedHeight={expandedHeight}
                  sectionLayout={sectionLayouts[section.id]}
                  viewportHeight={viewportHeight}
                />
              </View>
            ))}
          </View>

          <View className="mt-14 flex-row flex-wrap gap-4">
            {aboutActionCards.map((card) => (
              <View
                key={card.title}
                className="min-w-[280px] flex-1 rounded-[1.75rem] border border-public-line/70 bg-public-panel/55 p-6"
              >
                <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-cyan">
                  {card.eyebrow}
                </Text>
                <Text className="mt-3 text-2xl font-bold text-public-text">
                  {card.title}
                </Text>
                <Text className="mt-3 text-base leading-7 text-public-muted">
                  {card.body}
                </Text>

                <Link href={card.href} asChild>
                  <Pressable className="mt-5 w-fit rounded-full bg-public-accent px-5 py-3">
                    <Text className="text-sm font-extrabold uppercase tracking-[0.18em] text-public-canvas">
                      {card.label}
                    </Text>
                  </Pressable>
                </Link>
              </View>
            ))}
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 64,
  },
});
