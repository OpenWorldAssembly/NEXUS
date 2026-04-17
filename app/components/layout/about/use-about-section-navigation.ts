/**
 * File: use-about-section-navigation.ts
 * Description: Shared scroll-sync controller for the public About page section rail.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from 'react-native';

export type SectionLayout = {
  y: number;
  height: number;
};

type UseAboutSectionNavigationArgs = {
  sectionIds: string[];
  initialSectionId: string;
};

type UseAboutSectionNavigationResult = {
  activeSectionId: string;
  scrollViewRef: React.RefObject<ScrollView | null>;
  viewportHeight: number;
  getSectionLayout: (sectionId: string) => SectionLayout;
  handleViewportLayout: (event: LayoutChangeEvent) => void;
  handleSectionLayout: (sectionId: string, event: LayoutChangeEvent) => void;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  handleSectionPress: (sectionId: string) => void;
};

function buildInitialLayouts(sectionIds: string[]): Record<string, SectionLayout> {
  return Object.fromEntries(sectionIds.map((sectionId) => [sectionId, { y: 0, height: 0 }]));
}

function getSectionIndexByOffset(
  offsetY: number,
  viewportHeight: number,
  orderedSectionIds: string[],
  sectionLayouts: Record<string, SectionLayout>,
): number {
  const focusLine = offsetY + Math.max(viewportHeight * 0.18, 96);

  for (let index = orderedSectionIds.length - 1; index >= 0; index -= 1) {
    const sectionId = orderedSectionIds[index];
    const layout = sectionLayouts[sectionId];

    if (focusLine >= layout.y) {
      return index;
    }
  }

  return 0;
}

function getNextFocusedSectionId(
  currentSectionId: string,
  offsetY: number,
  viewportHeight: number,
  orderedSectionIds: string[],
  sectionLayouts: Record<string, SectionLayout>,
): string {
  const index = getSectionIndexByOffset(offsetY, viewportHeight, orderedSectionIds, sectionLayouts);
  return orderedSectionIds[index] ?? currentSectionId;
}

/**
 * Inputs: ordered about-page section ids and the initial active section id.
 * Output: scroll-synced handlers and state for the section navigation rail.
 */
export function useAboutSectionNavigation({
  sectionIds,
  initialSectionId,
}: UseAboutSectionNavigationArgs): UseAboutSectionNavigationResult {
  const [activeSectionId, setActiveSectionId] = useState(initialSectionId);
  const [isUserScrollSyncEnabled, setIsUserScrollSyncEnabled] = useState(true);
  const [viewportHeight, setViewportHeight] = useState(0);

  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionLayoutsRef = useRef<Record<string, SectionLayout>>(buildInitialLayouts(sectionIds));

  useEffect(() => {
    const nextLayouts = buildInitialLayouts(sectionIds);

    for (const sectionId of sectionIds) {
      if (sectionLayoutsRef.current[sectionId]) {
        nextLayouts[sectionId] = sectionLayoutsRef.current[sectionId];
      }
    }

    sectionLayoutsRef.current = nextLayouts;
  }, [sectionIds]);

  useEffect(() => {
    return () => {
      if (scrollSyncTimeoutRef.current) {
        clearTimeout(scrollSyncTimeoutRef.current);
      }
    };
  }, []);

  const handleViewportLayout = useCallback((event: LayoutChangeEvent) => {
    setViewportHeight(event.nativeEvent.layout.height);
  }, []);

  const handleSectionLayout = useCallback((sectionId: string, event: LayoutChangeEvent) => {
    sectionLayoutsRef.current[sectionId] = event.nativeEvent.layout;
  }, []);

  const updateActiveSectionFromOffset = useCallback(
    (offsetY: number) => {
      setActiveSectionId((currentSectionId) =>
        getNextFocusedSectionId(
          currentSectionId,
          offsetY,
          viewportHeight,
          sectionIds,
          sectionLayoutsRef.current,
        ),
      );
    },
    [sectionIds, viewportHeight],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isUserScrollSyncEnabled) {
        return;
      }

      updateActiveSectionFromOffset(event.nativeEvent.contentOffset.y);
    },
    [isUserScrollSyncEnabled, updateActiveSectionFromOffset],
  );

  const handleSectionPress = useCallback((sectionId: string) => {
    if (scrollSyncTimeoutRef.current) {
      clearTimeout(scrollSyncTimeoutRef.current);
    }

    setActiveSectionId(sectionId);
    setIsUserScrollSyncEnabled(false);

    scrollViewRef.current?.scrollTo({
      y: sectionLayoutsRef.current[sectionId]?.y ?? 0,
      animated: true,
    });

    scrollSyncTimeoutRef.current = setTimeout(() => {
      setIsUserScrollSyncEnabled(true);
    }, 420);
  }, []);

  const getSectionLayout = useCallback((sectionId: string) => sectionLayoutsRef.current[sectionId] ?? { y: 0, height: 0 }, []);

  return {
    activeSectionId,
    scrollViewRef,
    viewportHeight,
    getSectionLayout,
    handleViewportLayout,
    handleSectionLayout,
    handleScroll,
    handleSectionPress,
  };
}
