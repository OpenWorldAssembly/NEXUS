/**
 * File: use-about-page-controller.ts
 * Description: Shared controller for the public OWA About page chapter scroll experience.
 */
import { useMemo, useRef, useState, type RefObject } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  useWindowDimensions,
} from 'react-native';

import type { AboutSection } from '@/data/public/content-types';

export type SectionLayout = {
  y: number;
  height: number;
};

export const SECTION_FOCUS_LINE_RATIO = 0.35;
export const SECTION_RAIL_BREAKPOINT = 1100;
export const SECTION_RAIL_WIDTH = 200;
export const PUBLIC_CONTENT_MAX_WIDTH = 1152;
export const SECTION_TOPBAR_BASE_HEIGHT = 72;
export const SECTION_TOPBAR_PILL_WIDTH = 104;
export const SECTION_TOPBAR_PILL_HEIGHT = 40;
export const SECTION_TOPBAR_PILL_GAP = 10;
export const SECTION_TOPBAR_PILL_ROW_GAP = 10;
export const SECTION_TOPBAR_CONTENT_OFFSET = 20;

type UseAboutPageControllerArgs = {
  sections: AboutSection[];
};

type UseAboutPageControllerResult = {
  activeSectionId: string;
  activeSectionIndex: number;
  bottomRunway: number;
  chapterHeight: number;
  collapsedHeight: number;
  expandedHeight: number;
  railAwareContentPaddingRight: number;
  railRightOffset: number;
  railShellHeight: number;
  scrollEventHandler: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollViewRef: RefObject<ScrollView | null>;
  scrollY: Animated.Value;
  sectionLayouts: Record<string, SectionLayout>;
  secondaryNavLayoutMode: 'rail' | 'topbar';
  topbarContentPaddingTop: number;
  topbarShellHeight: number;
  viewportHeight: number;
  getRailAnimatedState: (sectionId: string) => {
    plateAnimatedStyle:
      | {
          width: Animated.AnimatedInterpolation<string | number>;
          opacity: Animated.AnimatedInterpolation<string | number>;
          borderColor: Animated.AnimatedInterpolation<string | number>;
          backgroundColor: Animated.AnimatedInterpolation<string | number>;
        }
      | undefined;
    dotAnimatedStyle:
      | {
          backgroundColor: Animated.AnimatedInterpolation<string | number>;
          transform: { scale: Animated.AnimatedInterpolation<string | number> }[];
        }
      | undefined;
    titleAnimatedStyle:
      | {
          color: Animated.AnimatedInterpolation<string | number>;
        }
      | undefined;
    subtitleAnimatedStyle:
      | {
          opacity: Animated.AnimatedInterpolation<string | number>;
          transform: { translateY: Animated.AnimatedInterpolation<string | number> }[];
          color: Animated.AnimatedInterpolation<string | number>;
        }
      | undefined;
  };
  getTopbarAnimatedState: (sectionId: string) => {
    plateAnimatedStyle:
      | {
          opacity: Animated.AnimatedInterpolation<string | number>;
          borderColor: Animated.AnimatedInterpolation<string | number>;
          backgroundColor: Animated.AnimatedInterpolation<string | number>;
          transform: ({ translateY: Animated.AnimatedInterpolation<string | number> } | { scale: Animated.AnimatedInterpolation<string | number> })[];
        }
      | undefined;
    dotAnimatedStyle:
      | {
          backgroundColor: Animated.AnimatedInterpolation<string | number>;
          transform: { scale: Animated.AnimatedInterpolation<string | number> }[];
        }
      | undefined;
    titleAnimatedStyle:
      | {
          color: Animated.AnimatedInterpolation<string | number>;
        }
      | undefined;
    subtitleAnimatedStyle:
      | {
          opacity: Animated.AnimatedInterpolation<string | number>;
          transform: { translateY: Animated.AnimatedInterpolation<string | number> }[];
          color: Animated.AnimatedInterpolation<string | number>;
        }
      | undefined;
  };
  handleSectionLayout: (sectionId: string, event: LayoutChangeEvent) => void;
  handleSectionPress: (sectionId: string) => void;
  handleViewportLayout: (event: LayoutChangeEvent) => void;
  shouldShowRailSubtitle: (sectionId: string) => boolean;
  shouldShowTopbarSubtitle: (sectionId: string) => boolean;
};

/**
 * Inputs: the section layout map, current scroll offset, and viewport height.
 * Output: the section id that is closest to the shared midpoint focus line.
 */
function getFocusedSectionId(
  sections: AboutSection[],
  sectionLayouts: Record<string, SectionLayout>,
  scrollOffsetY: number,
  viewportHeight: number,
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
 * Inputs: ordered About-page sections.
 * Output: section focus state, rail state, and viewport-aware handlers for the public About page.
 */
export function useAboutPageController({ sections }: UseAboutPageControllerArgs): UseAboutPageControllerResult {
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
  const secondaryNavLayoutMode = windowWidth >= SECTION_RAIL_BREAKPOINT ? 'rail' : 'topbar';
  const showSectionRail = secondaryNavLayoutMode === 'rail';
  const railAwareContentPaddingRight = showSectionRail ? SECTION_RAIL_WIDTH * 0.8 : 0;
  const railShellHeight = Math.min(Math.max(viewportHeight * 0.68, 600), 1200);
  const topbarAvailableWidth = Math.max(windowWidth - 24, SECTION_TOPBAR_PILL_WIDTH);
  const topbarItemsPerRow = Math.max(
    1,
    Math.floor(
      (topbarAvailableWidth + SECTION_TOPBAR_PILL_GAP) /
        (SECTION_TOPBAR_PILL_WIDTH + SECTION_TOPBAR_PILL_GAP),
    ),
  );
  const topbarRowCount = Math.max(1, Math.ceil(sections.length / topbarItemsPerRow));
  const topbarShellHeight =
    SECTION_TOPBAR_BASE_HEIGHT +
    topbarRowCount * SECTION_TOPBAR_PILL_HEIGHT +
    Math.max(0, topbarRowCount - 1) * SECTION_TOPBAR_PILL_ROW_GAP;
  const topbarContentPaddingTop = secondaryNavLayoutMode === 'topbar'
    ? topbarShellHeight + SECTION_TOPBAR_CONTENT_OFFSET
    : 0;
  const outerSideSpace = Math.max(0, (windowWidth - PUBLIC_CONTENT_MAX_WIDTH) / 2);
  const railRightOffset = Math.round((outerSideSpace - SECTION_RAIL_WIDTH) * 0.5 + 90);
  const activeSectionIndex = useMemo(
    () => Math.max(0, sections.findIndex((section) => section.id === activeSectionId)),
    [activeSectionId, sections],
  );

  function handleViewportLayout(event: LayoutChangeEvent) {
    const nextViewportHeight = event.nativeEvent.layout.height;

    setScrollViewportHeight((currentViewportHeight) =>
      currentViewportHeight === nextViewportHeight ? currentViewportHeight : nextViewportHeight,
    );
  }

  function handleSectionLayout(sectionId: string, event: LayoutChangeEvent) {
    const nextLayout = {
      y: event.nativeEvent.layout.y,
      height: event.nativeEvent.layout.height,
    };
    const currentLayout = sectionLayoutsRef.current[sectionId];

    if (currentLayout?.y === nextLayout.y && currentLayout?.height === nextLayout.height) {
      return;
    }

    sectionLayoutsRef.current = {
      ...sectionLayoutsRef.current,
      [sectionId]: nextLayout,
    };
    setSectionLayouts(sectionLayoutsRef.current);
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextFocusedSectionId = getFocusedSectionId(
      sections,
      sectionLayoutsRef.current,
      event.nativeEvent.contentOffset.y,
      viewportHeight,
    );

    setActiveSectionId((currentSectionId) =>
      currentSectionId === nextFocusedSectionId ? currentSectionId : nextFocusedSectionId,
    );
  }

  function handleSectionPress(sectionId: string) {
    setActiveSectionId(sectionId);

    const layout = sectionLayoutsRef.current[sectionId];

    if (!layout) {
      return;
    }

    scrollViewRef.current?.scrollTo({
      y: Math.max(0, layout.y + layout.height / 2 - viewportHeight * SECTION_FOCUS_LINE_RATIO),
      animated: true,
    });
  }

  function getDistanceProgress(sectionId: string) {
    const layout = sectionLayouts[sectionId];

    if (!layout) {
      return undefined;
    }

    const focusY = layout.y + layout.height / 2 - viewportHeight * SECTION_FOCUS_LINE_RATIO;
    const itemRange = viewportHeight * 0.9;

    return scrollY.interpolate({
      inputRange: [focusY - itemRange, focusY, focusY + itemRange],
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    });
  }

  function getRailAnimatedState(sectionId: string) {
    const distanceProgress = getDistanceProgress(sectionId);

    if (!distanceProgress) {
      return {
        plateAnimatedStyle: undefined,
        dotAnimatedStyle: undefined,
        titleAnimatedStyle: undefined,
        subtitleAnimatedStyle: undefined,
      };
    }

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

  function getTopbarAnimatedState(sectionId: string) {
    const distanceProgress = getDistanceProgress(sectionId);

    if (!distanceProgress) {
      return {
        plateAnimatedStyle: undefined,
        dotAnimatedStyle: undefined,
        titleAnimatedStyle: undefined,
        subtitleAnimatedStyle: undefined,
      };
    }

    const plateOpacity = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.82, 1],
      extrapolate: 'clamp',
    });

    const plateBorderColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(137, 183, 255, 0.12)', 'rgba(198, 214, 112, 0.82)'],
      extrapolate: 'clamp',
    });

    const plateBackgroundColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(255,255,255,0.025)', 'rgba(198, 214, 112, 0.18)'],
      extrapolate: 'clamp',
    });

    const plateTranslateY = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -2],
      extrapolate: 'clamp',
    });

    const plateScale = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.01],
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
      inputRange: [0, 0.65, 1],
      outputRange: [0, 0.22, 1],
      extrapolate: 'clamp',
    });

    const subtitleTranslateY = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [3, 0],
      extrapolate: 'clamp',
    });

    const subtitleColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(142, 202, 230, 0.35)', 'rgba(243, 196, 92, 0.92)'],
      extrapolate: 'clamp',
    });

    return {
      plateAnimatedStyle: {
        opacity: plateOpacity,
        borderColor: plateBorderColor,
        backgroundColor: plateBackgroundColor,
        transform: [{ translateY: plateTranslateY }, { scale: plateScale }],
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

  function shouldShowRailSubtitle(sectionId: string) {
    const index = sections.findIndex((section) => section.id === sectionId);
    return Math.abs(index - activeSectionIndex) <= 1;
  }

  function shouldShowTopbarSubtitle(sectionId: string) {
    return sectionId === activeSectionId;
  }

  const scrollEventHandler = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    listener: handleScroll,
    useNativeDriver: false,
  });

  return {
    activeSectionId,
    activeSectionIndex,
    bottomRunway,
    chapterHeight,
    collapsedHeight,
    expandedHeight,
    railAwareContentPaddingRight,
    railRightOffset,
    railShellHeight,
    scrollEventHandler,
    scrollViewRef,
    scrollY,
    sectionLayouts,
    secondaryNavLayoutMode,
    topbarContentPaddingTop,
    topbarShellHeight,
    viewportHeight,
    getRailAnimatedState,
    getTopbarAnimatedState,
    handleSectionLayout,
    handleSectionPress,
    handleViewportLayout,
    shouldShowRailSubtitle,
    shouldShowTopbarSubtitle,
  };
}
