/**
 * File: public-docs-section-grid.tsx
 * Description: Renders the responsive, slightly staggered charter card layout for the docs page.
 */
import { useState } from 'react';
import { Animated, type LayoutChangeEvent, View } from 'react-native';

import PublicDocsSectionCard from '@/app/components/public/public-docs-section-card';
import type { CharterPrincipleCard } from '@/app/public/docs-content';

type PublicDocsSectionGridProps = {
  scrollY: Animated.Value;
  sections: CharterPrincipleCard[];
  viewportHeight: number;
};

const LARGE_SCREEN_STAGGER_CLASSES = ['xl:mt-0', 'xl:mt-10', 'xl:mt-20'] as const;

/**
 * Inputs: docs card data plus shared scroll state.
 * Output: a responsive 1/2/3-column grid with a gentle organic stagger on wider screens.
 */
export default function PublicDocsSectionGrid({
  scrollY,
  sections,
  viewportHeight,
}: PublicDocsSectionGridProps) {
  const [gridOffsetY, setGridOffsetY] = useState(0);

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setGridOffsetY(nativeEvent.layout.y);
  };

  return (
    <View
      className="flex-row flex-wrap justify-between gap-y-6 md:gap-y-7 xl:gap-y-8"
      onLayout={handleLayout}
    >
      {sections.map((section, index) => (
        <View
          key={section.id}
          className={`w-full md:w-[48.2%] xl:w-[31.2%] ${LARGE_SCREEN_STAGGER_CLASSES[index % LARGE_SCREEN_STAGGER_CLASSES.length]}`}
        >
          <PublicDocsSectionCard
            scrollY={scrollY}
            section={section}
            viewportHeight={viewportHeight}
            offsetY={gridOffsetY}
          />
        </View>
      ))}
    </View>
  );
}
