/**
 * File: use-section-scroll-spy.ts
 * Description: Shared focus-line scroll spy for public-page section navigation.
 */
import { useMemo, useState, type MutableRefObject, type RefObject } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from 'react-native';

import type { PublicSectionWithId, SectionLayout } from './public-section.types';

type UseSectionScrollSpyArgs<TSection extends PublicSectionWithId> = {
  focusLineRatio: number;
  scrollViewRef: RefObject<ScrollView | null>;
  sectionLayoutsRef: MutableRefObject<Record<string, SectionLayout>>;
  sections: TSection[];
  viewportHeight: number;
};

type UseSectionScrollSpyResult = {
  activeSectionId: string;
  activeSectionIndex: number;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  handleSectionPress: (sectionId: string) => void;
};

/**
 * Inputs: ordered sections, their registered layouts, and the shared focus-line ratio.
 * Output: active-section tracking plus handlers for scroll-driven and click-driven navigation.
 */
export function useSectionScrollSpy<TSection extends PublicSectionWithId>({
  focusLineRatio,
  scrollViewRef,
  sectionLayoutsRef,
  sections,
  viewportHeight,
}: UseSectionScrollSpyArgs<TSection>): UseSectionScrollSpyResult {
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? '');

  const activeSectionIndex = useMemo(
    () => Math.max(0, sections.findIndex((section) => section.id === activeSectionId)),
    [activeSectionId, sections],
  );

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextFocusedSectionId = getFocusedSectionId(
      sections,
      sectionLayoutsRef.current,
      event.nativeEvent.contentOffset.y,
      viewportHeight,
      focusLineRatio,
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
      y: Math.max(0, layout.y + layout.height / 2 - viewportHeight * focusLineRatio),
      animated: true,
    });
  }

  return {
    activeSectionId,
    activeSectionIndex,
    handleScroll,
    handleSectionPress,
  };
}

/**
 * Inputs: the section layout map, current scroll offset, and viewport height.
 * Output: the section id closest to the shared focus line.
 */
function getFocusedSectionId<TSection extends PublicSectionWithId>(
  sections: TSection[],
  sectionLayouts: Record<string, SectionLayout>,
  scrollOffsetY: number,
  viewportHeight: number,
  focusLineRatio: number,
) {
  const viewportFocusLine = scrollOffsetY + viewportHeight * focusLineRatio;
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
