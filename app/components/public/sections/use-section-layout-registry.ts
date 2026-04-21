/**
 * File: use-section-layout-registry.ts
 * Description: Shared layout registry for public-page sections and scroll viewports.
 */
import { useRef, useState, type MutableRefObject } from 'react';
import { type LayoutChangeEvent } from 'react-native';

import type { SectionLayout } from './public-section.types';

type UseSectionLayoutRegistryArgs = {
  windowHeight: number;
};

type UseSectionLayoutRegistryResult = {
  handleSectionLayout: (sectionId: string, event: LayoutChangeEvent) => void;
  handleViewportLayout: (event: LayoutChangeEvent) => void;
  sectionLayouts: Record<string, SectionLayout>;
  sectionLayoutsRef: MutableRefObject<Record<string, SectionLayout>>;
  viewportHeight: number;
};

/**
 * Inputs: the current window height.
 * Output: viewport-aware layout handlers and a shared section layout registry.
 */
export function useSectionLayoutRegistry({
  windowHeight,
}: UseSectionLayoutRegistryArgs): UseSectionLayoutRegistryResult {
  const [sectionLayouts, setSectionLayouts] = useState<Record<string, SectionLayout>>({});
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const sectionLayoutsRef = useRef<Record<string, SectionLayout>>({});

  const viewportHeight = scrollViewportHeight || windowHeight;

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

  return {
    handleSectionLayout,
    handleViewportLayout,
    sectionLayouts,
    sectionLayoutsRef,
    viewportHeight,
  };
}
