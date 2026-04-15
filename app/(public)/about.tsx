/**
 * File: about.tsx
 * Description: Renders the public OWA about page with a midpoint-focused chapter scroll experience.
 */
import { useMemo, useRef, useState } from 'react';
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
  useWindowDimensions
} from 'react-native';

import PublicAboutSection from '@/components/layout/public-about-section';
import { aboutPageContent } from '@/data/public/about-content';

const sections = aboutPageContent.sections;

type SectionLayout = {
  y: number;
  height: number;
};

const SECTION_FOCUS_LINE_RATIO = 0.3;
const SECTION_RAIL_BREAKPOINT = 1100;
const SECTION_RAIL_WIDTH = 200;
const PUBLIC_CONTENT_MAX_WIDTH = 1152;

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
  let nextFocusedSectionId = sections[0]?.id ?? '';
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const section of sections) {
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
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? '');
  const [sectionLayouts, setSectionLayouts] = useState<Record<string, SectionLayout>>({});
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const sectionLayoutsRef = useRef<Record<string, SectionLayout>>({});
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const viewportHeight = scrollViewportHeight || windowHeight;
  const expandedHeight = Math.min(Math.max(viewportHeight * 0.64, 440), 600);
  const collapsedHeight = Math.min(Math.max(viewportHeight * 0.28, 210), 252);
  const chapterHeight = Math.round(expandedHeight * 0.88);
  const bottomRunway = Math.max(220, viewportHeight * 0.34);
  const showSectionRail = windowWidth >= SECTION_RAIL_BREAKPOINT;
  const railAwareContentPaddingRight = showSectionRail ? SECTION_RAIL_WIDTH * 0.8: 0;
  const railShellHeight = Math.min(Math.max(viewportHeight * 0.68, 600), 1200);
  const outerSideSpace = Math.max(0, (windowWidth - PUBLIC_CONTENT_MAX_WIDTH) / 2);
  const railRightOffset = Math.min(140, Math.max(28, Math.round(outerSideSpace * 0.42)));
  const activeSectionIndex = useMemo(
    () => Math.max(0, sections.findIndex((section) => section.id === activeSectionId)),
    [activeSectionId]
  );

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

  /**
   * Inputs: a section id.
   * Output: returns animated styles for the side rail item based on distance from the focus line.
   */
  function getRailAnimatedState(sectionId: string) {
    const layout = sectionLayouts[sectionId];

    if (!layout) {
      return {
        containerAnimatedStyle: undefined,
        dotAnimatedStyle: undefined,
        titleAnimatedStyle: undefined,
        subtitleAnimatedStyle: undefined,
      };
    }

    const focusY = layout.y + layout.height / 2 - viewportHeight * SECTION_FOCUS_LINE_RATIO;
    const itemRange = viewportHeight * 0.9;

    const distanceProgress = scrollY.interpolate({
      inputRange: [focusY - itemRange, focusY, focusY + itemRange],
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    });

    const plateWidth = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [SECTION_RAIL_WIDTH - 58, SECTION_RAIL_WIDTH - 12],
      extrapolate: 'clamp',
    });

    const opacity = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.78, 1],
      extrapolate: 'clamp',
    });

    const borderColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(137, 183, 255, 0.12)', 'rgba(198, 214, 112, 0.82)'],
      extrapolate: 'clamp',
    });

    const backgroundColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(255,255,255,0.025)', 'rgba(198, 214, 112, 0.18)'],
      extrapolate: 'clamp',
    });

    const dotScale = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.08],
      extrapolate: 'clamp',
    });

    const dotColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(142, 202, 230, 0.38)', 'rgba(198, 214, 112, 0.85)'],
      extrapolate: 'clamp',
    });

    const titleColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(232, 238, 246, 0.72)', '#f7f4ea'],
      extrapolate: 'clamp',
    });

    const subtitleOpacity = distanceProgress.interpolate({
      inputRange: [0, 0.55, 1],
      outputRange: [0, 0.18, 1],
      extrapolate: 'clamp',
    });

    const subtitleTranslateY = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [4, 0],
      extrapolate: 'clamp',
    });

    const subtitleColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(142, 202, 230, 0.35)', 'rgba(243, 196, 92, 0.92)'],
      extrapolate: 'clamp',
    });

    return {
      plateAnimatedStyle: {
        width: plateWidth,
        opacity,
        borderColor,
        backgroundColor,
      },
      dotAnimatedStyle: {
        backgroundColor: dotColor,
        transform: [{ scale: dotScale }],
      },
      titleAnimatedStyle: {
        color: titleColor,
      },
      subtitleAnimatedStyle: {
        opacity: subtitleOpacity,
        transform: [{ translateY: subtitleTranslateY }],
        color: subtitleColor,
      },
    };
  }

  /**
   * Inputs: a section id.
   * Output: true when the section is close enough to the focus line to show its subtitle.
   */
  function shouldShowRailSubtitle(sectionId: string) {
    const index = sections.findIndex((section) => section.id === sectionId);
    return Math.abs(index - activeSectionIndex) <= 1;
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
            <View
              className="mx-auto w-full max-w-6xl px-5 py-8"
              style={showSectionRail ? { paddingRight: railAwareContentPaddingRight } : undefined}
            >          
            <View className="overflow-hidden rounded-[2rem] border border-public-line/0 bg-public-shell/70 px-6 py-4 shadow-public md:px-10 md:py-4">
              <View className="absolute left-8 top-8 h-36 w-36 rounded-full bg-public-accent/10 blur-3xl" />
              <View className="absolute right-8 top-20 h-44 w-44 rounded-full bg-public-cyan/15 blur-3xl" />
            </View>

          <View className="mt-12 gap-0 md:gap-0">
            {sections.map((section) => (
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
        </View>
      </Animated.ScrollView>
            {showSectionRail ? (
        <View
          pointerEvents="box-none"
          style={[styles.railViewportOverlay, { right: railRightOffset }]}
        >
          <View style={[styles.railShell, { height: railShellHeight }]}>
          <View style={styles.railHeader}>
            <Text style={styles.railEyebrow}>{aboutPageContent.railTitle}</Text>
            <Text style={styles.railEyebrowSubtext}>{aboutPageContent.railSubtitle}</Text>
          </View>

          <View style={styles.railStack}>
              {sections.map((section) => {
                const isActive = section.id === activeSectionId;
                const animatedState = getRailAnimatedState(section.id);

                return (
                  <Pressable
                    key={section.id}
                    onPress={() => handleSectionPress(section.id)}
                    style={styles.railItemPressable}
                  >
                    <View style={styles.railItemBase}>
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.railItemPlate, animatedState.plateAnimatedStyle]}
                      />

                      <View style={styles.railItemContent}>
                        <Animated.View
                          style={[styles.railDotBase, animatedState.dotAnimatedStyle]}
                        />

                        <View style={styles.railTextWrap}>
                          <Animated.Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={[styles.railTitleBase, animatedState.titleAnimatedStyle]}
                          >
                            {section.id}
                          </Animated.Text>

                          <Animated.Text
                            numberOfLines={1}
                            style={[
                              styles.railSubtitleBase,
                              animatedState.subtitleAnimatedStyle,
                              !shouldShowRailSubtitle(section.id) && styles.railSubtitleHidden,
                            ]}
                          >
                            {section.eyebrow}
                          </Animated.Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}
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


  railShell: {
    width: SECTION_RAIL_WIDTH,
    backgroundColor: 'rgba(10, 18, 30, 0.72)',
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
  },

  railHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginBottom: 8,
  },

  railEyebrow: {
    color: '#8ecae6',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '100%',
  },

  railEyebrowSubtext: {
    marginTop: 4,
    color: 'rgba(232, 238, 246, 0.62)',
    fontSize: 10,
    lineHeight: 11,
    fontWeight: '700',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    textAlign: 'center',
    maxWidth: 144,
  },

  railStack: {
    flex: 1,
    justifyContent: 'space-evenly',
  },

  railItemPressable: {
    width: SECTION_RAIL_WIDTH - 12,
    alignSelf: 'center',
  },

  railItemBase: {
    minHeight: 64,
    width: SECTION_RAIL_WIDTH - 28,
    alignSelf: 'center',
    justifyContent: 'center',
  },

  railItemPlate: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 18,
    borderWidth: 0,
  },

  railItemContent: {
    minHeight: 58,
    width: SECTION_RAIL_WIDTH - 28,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  railDotBase: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginBottom: 6,
    flexShrink: 0,
  },

  railTextWrap: {
    width: '100%',
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },

  railTitleBase: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    textAlign: 'center',
    width: '100%',
  },

  railSubtitleBase: {
    marginTop: 1,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '100%',
  },

  railSubtitleHidden: {
    opacity: 0,
  },
  
  railViewportOverlay: {
    position: 'absolute',
    top: 0,
    right: 60,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
    pointerEvents: 'box-none',
  },
  actionCardPressable: {
    minWidth: 220,
    flexGrow: 1,
    flexBasis: 0,
  },

  actionCardAnimatedShell: {
    width: '100%',
  },

  actionCardSheen: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 120,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
  },
});
