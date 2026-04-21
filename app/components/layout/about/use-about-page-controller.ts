/**
 * File: use-about-page-controller.ts
 * Description: Shared controller for the public OWA About page section focus and navigation state.
 */
import { useRef, type RefObject } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  useWindowDimensions,
} from 'react-native';

import { useSecondaryNavItemState } from '@app/components/public/navigation/use-secondary-nav-item-state';
import {
  SECTION_RAIL_BREAKPOINT,
  SECTION_RAIL_WIDTH,
  SECTION_TOPBAR_BASE_HEIGHT,
  SECTION_TOPBAR_COMPACT_BREAKPOINT,
  SECTION_TOPBAR_CONTENT_OFFSET,
  SECTION_TOPBAR_PILL_GAP,
  SECTION_TOPBAR_PILL_HEIGHT,
  SECTION_TOPBAR_PILL_ROW_GAP,
  SECTION_TOPBAR_PILL_WIDTH,
} from '@app/components/public/public-secondary-nav.constants';
import { useSectionLayoutRegistry } from '@app/components/public/sections/use-section-layout-registry';
import { useSectionScrollSpy } from '@app/components/public/sections/use-section-scroll-spy';
import type { AboutSection } from '@app/public/content-types';
import {
  ABOUT_BOTTOM_RUNWAY_MIN,
  ABOUT_BOTTOM_RUNWAY_VIEWPORT_RATIO,
  ABOUT_RAIL_RIGHT_OFFSET_BIAS,
  ABOUT_RAIL_RIGHT_OFFSET_SPACE_RATIO,
  ABOUT_RAIL_SHELL_HEIGHT_RATIO,
  ABOUT_RAIL_SHELL_MAX_HEIGHT,
  ABOUT_RAIL_SHELL_MIN_HEIGHT,
  PUBLIC_CONTENT_MAX_WIDTH,
  SECTION_FOCUS_LINE_RATIO,
} from './about.constants';
import type { SectionLayout } from '@app/components/public/sections/public-section.types';
import type { PublicSecondaryNavAnimatedState } from '@app/components/public/public-secondary-nav.types';

type UseAboutPageControllerArgs = {
  sections: AboutSection[];
};

type UseAboutPageControllerResult = {
  activeSectionId: string;
  activeSectionIndex: number;
  bottomRunway: number;
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
  getRailAnimatedState: (sectionId: string) => PublicSecondaryNavAnimatedState;
  getTopbarAnimatedState: (sectionId: string) => PublicSecondaryNavAnimatedState;
  handleSectionLayout: (sectionId: string, event: LayoutChangeEvent) => void;
  handleSectionPress: (sectionId: string) => void;
  handleViewportLayout: (event: LayoutChangeEvent) => void;
  shouldShowRailSubtitle: (sectionId: string) => boolean;
  shouldShowTopbarSubtitle: (sectionId: string) => boolean;
};

/**
 * Inputs: ordered About-page sections.
 * Output: section focus state, rail state, and viewport-aware handlers for the public About page.
 */
export function useAboutPageController({ sections }: UseAboutPageControllerArgs): UseAboutPageControllerResult {
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const {
    handleSectionLayout,
    handleViewportLayout,
    sectionLayouts,
    sectionLayoutsRef,
    viewportHeight,
  } = useSectionLayoutRegistry({ windowHeight });

  const secondaryNavLayoutMode = windowWidth >= SECTION_RAIL_BREAKPOINT ? 'rail' : 'topbar';

  const {
    activeSectionId,
    activeSectionIndex,
    handleScroll,
    handleSectionPress,
  } = useSectionScrollSpy({
    focusLineRatio: SECTION_FOCUS_LINE_RATIO,
    scrollViewRef,
    sectionLayoutsRef,
    sections,
    viewportHeight,
  });

  const railNavItemState = useSecondaryNavItemState({
    activeSectionId,
    activeSectionIndex,
    focusLineRatio: SECTION_FOCUS_LINE_RATIO,
    mode: 'rail',
    scrollY,
    sectionLayouts,
    sections,
    viewportHeight,
  });

  const topbarNavItemState = useSecondaryNavItemState({
    activeSectionId,
    activeSectionIndex,
    focusLineRatio: SECTION_FOCUS_LINE_RATIO,
    mode: 'topbar',
    scrollY,
    sectionLayouts,
    sections,
    viewportHeight,
  });

  const bottomRunway = Math.max(ABOUT_BOTTOM_RUNWAY_MIN, viewportHeight * ABOUT_BOTTOM_RUNWAY_VIEWPORT_RATIO);
  const showSectionRail = secondaryNavLayoutMode === 'rail';
  const railAwareContentPaddingRight = showSectionRail ? SECTION_RAIL_WIDTH * 0.8 : 0;
  const railShellHeight = Math.min(
    Math.max(viewportHeight * ABOUT_RAIL_SHELL_HEIGHT_RATIO, ABOUT_RAIL_SHELL_MIN_HEIGHT),
    ABOUT_RAIL_SHELL_MAX_HEIGHT,
  );
  const isCompactTopbar = windowWidth < SECTION_TOPBAR_COMPACT_BREAKPOINT;
  const topbarBaseHeight = isCompactTopbar ? 54 : SECTION_TOPBAR_BASE_HEIGHT;
  const topbarPillHeight = isCompactTopbar ? 32 : SECTION_TOPBAR_PILL_HEIGHT;
  const topbarPillGap = isCompactTopbar ? 6 : SECTION_TOPBAR_PILL_GAP;
  const topbarPillRowGap = isCompactTopbar ? 4 : SECTION_TOPBAR_PILL_ROW_GAP;
  const topbarAvailableWidth = Math.max(windowWidth - 24, SECTION_TOPBAR_PILL_WIDTH);
  const topbarItemsPerRow = Math.max(
    1,
    Math.floor((topbarAvailableWidth + topbarPillGap) / (SECTION_TOPBAR_PILL_WIDTH + topbarPillGap)),
  );
  const topbarRowCount = Math.max(1, Math.ceil(sections.length / topbarItemsPerRow));
  const topbarShellHeight =
    topbarBaseHeight +
    topbarRowCount * topbarPillHeight +
    Math.max(0, topbarRowCount - 1) * topbarPillRowGap;
  const topbarContentPaddingTop = secondaryNavLayoutMode === 'topbar'
    ? topbarShellHeight + SECTION_TOPBAR_CONTENT_OFFSET
    : 0;
  const outerSideSpace = Math.max(0, (windowWidth - PUBLIC_CONTENT_MAX_WIDTH) / 2);
  const railRightOffset = Math.round(
    (outerSideSpace - SECTION_RAIL_WIDTH) * ABOUT_RAIL_RIGHT_OFFSET_SPACE_RATIO +
      ABOUT_RAIL_RIGHT_OFFSET_BIAS,
  );

  const scrollEventHandler = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    listener: handleScroll,
    useNativeDriver: false,
  });

  return {
    activeSectionId,
    activeSectionIndex,
    bottomRunway,
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
    getRailAnimatedState: railNavItemState.getItemAnimatedState,
    getTopbarAnimatedState: topbarNavItemState.getItemAnimatedState,
    handleSectionLayout,
    handleSectionPress,
    handleViewportLayout,
    shouldShowRailSubtitle: railNavItemState.shouldShowItemSubtitle,
    shouldShowTopbarSubtitle: topbarNavItemState.shouldShowItemSubtitle,
  };
}
