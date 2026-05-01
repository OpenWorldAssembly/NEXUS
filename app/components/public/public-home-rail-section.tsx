/**
 * File: public-home-rail-section.tsx
 * Description: Renders one animated homepage panel with alternating left/right layout.
 */
import type { LayoutChangeEvent } from 'react-native';
import { Animated, View } from 'react-native';

import PublicHomeSection from '@app/components/layout/public-home-section';
import { PUBLIC_SURFACE_CLASSES } from '@app/components/public/public-surface';
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

const RAIL_LINE_OFFSET = 16;
const RAIL_DOT_OFFSET = 8;

/**
 * Inputs: a homepage section descriptor and shared scroll/layout state.
 * Output: one animated homepage panel with a stable card gutter and alternating rail decoration.
 */
export default function PublicHomeRailSection({
  isActive,
  onLayout,
  scrollY,
  section,
  sectionLayout,
  viewportHeight,
}: PublicHomeRailSectionProps) {
  const isRightRail = section.align === 'right';
  const railLineSideStyle = isRightRail ? { right: RAIL_LINE_OFFSET } : { left: RAIL_LINE_OFFSET };
  const railDotSideStyle = isRightRail ? { right: RAIL_DOT_OFFSET } : { left: RAIL_DOT_OFFSET };

  return (
    <View onLayout={(event) => onLayout(section.id, event)} className="relative px-10">
      <View className="absolute bottom-0 top-0 w-px bg-public-line/60" style={railLineSideStyle} />
      <View
        className={`absolute top-14 h-3 w-3 rounded-full border border-public-line ${PUBLIC_SURFACE_CLASSES.homeRail.dotClassName}`}
        style={railDotSideStyle}
      />

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
