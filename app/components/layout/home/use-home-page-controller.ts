/**
 * File: use-home-page-controller.ts
 * Description: Shared controller for the public homepage section focus state and scroll tracking.
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

import { useSectionLayoutRegistry } from '@app/components/public/sections/use-section-layout-registry';
import { PUBLIC_SECTION_FOCUS_LINE_RATIO } from '@app/components/public/sections/public-section.constants';
import type { SectionLayout } from '@app/components/public/sections/public-section.types';
import { useSectionScrollSpy } from '@app/components/public/sections/use-section-scroll-spy';
import type { HomeRailSection } from '@app/public/home-content';

type UseHomePageControllerArgs = {
  sections: HomeRailSection[];
};

type UseHomePageControllerResult = {
  activeSectionId: string;
  scrollEventHandler: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollViewRef: RefObject<ScrollView | null>;
  scrollY: Animated.Value;
  sectionLayouts: Record<string, SectionLayout>;
  viewportHeight: number;
  handleSectionLayout: (sectionId: string, event: LayoutChangeEvent) => void;
  handleViewportLayout: (event: LayoutChangeEvent) => void;
};

/**
 * Inputs: ordered Home-page sections.
 * Output: section focus state and viewport-aware scroll handlers for the public homepage.
 */
export function useHomePageController({ sections }: UseHomePageControllerArgs): UseHomePageControllerResult {
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const { height: windowHeight } = useWindowDimensions();

  const {
    handleSectionLayout,
    handleViewportLayout,
    sectionLayouts,
    sectionLayoutsRef,
    viewportHeight,
  } = useSectionLayoutRegistry({ windowHeight });

  const { activeSectionId, handleScroll } = useSectionScrollSpy({
    focusLineRatio: PUBLIC_SECTION_FOCUS_LINE_RATIO,
    scrollViewRef,
    sectionLayoutsRef,
    sections,
    viewportHeight,
  });

  const scrollEventHandler = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    listener: handleScroll,
    useNativeDriver: false,
  });

  return {
    activeSectionId,
    scrollEventHandler,
    scrollViewRef,
    scrollY,
    sectionLayouts,
    viewportHeight,
    handleSectionLayout,
    handleViewportLayout,
  };
}
