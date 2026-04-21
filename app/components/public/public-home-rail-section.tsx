/**
 * File: public-home-rail-section.tsx
 * Description: Renders one animated homepage panel with alternating left/right layout.
 */
import type { LayoutChangeEvent } from 'react-native';
import { Animated, View } from 'react-native';

import PublicHomeSection from '@app/components/layout/public-home-section';
import type { SectionLayout } from '@app/components/public/sections/public-section.types';
import type { HomeRailSection } from '@app/public/home-content';

type PublicHomeRailSectionProps = {
  isActive: boolean;
  onLayout: (sectionId: string, event: LayoutChangeEvent) => void;
  scrollY: Animated.Value;
  section: HomeRailSection;
  sectionLayout?: SectionLayout;
  viewportHeight: number;
};

/**
 * Inputs: a homepage section descriptor and shared scroll/layout state.
 * Output: one animated homepage panel with the existing alternating rail layout.
 */
export default function PublicHomeRailSection({
  isActive,
  onLayout,
  scrollY,
  section,
  sectionLayout,
  viewportHeight,
}: PublicHomeRailSectionProps) {
  return (
    <View onLayout={(event) => onLayout(section.id, event)} className="relative pl-10">
      <View className="absolute bottom-0 left-4 top-0 w-px bg-public-line/60" />
      <View className="absolute left-[8px] top-14 h-3 w-3 rounded-full border border-public-line bg-[#8ec5ff]" />

      <PublicHomeSection
        isActive={isActive}
        scrollY={scrollY}
        section={section}
        sectionLayout={sectionLayout}
        viewportHeight={viewportHeight}
      />
    </View>
  );
}
