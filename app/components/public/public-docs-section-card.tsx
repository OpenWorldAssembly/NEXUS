/**
 * File: public-docs-section-card.tsx
 * Description: Renders one animated charter principle card for the public docs page.
 */
import { useEffect, useMemo, useState } from 'react';
import { Animated, type LayoutChangeEvent, Text, View } from 'react-native';

import PublicPanelShell from '@/app/components/public/public-panel-shell';
import { getSectionProgress } from '@/app/components/public/sections/public-section-motion';
import type { SectionLayout } from '@/app/components/public/sections/public-section.types';
import type { CharterPrincipleCard } from '@/app/public/docs-content';

type PublicDocsSectionCardProps = {
  section: CharterPrincipleCard;
  scrollY: Animated.Value;
  viewportHeight: number;
  offsetY: number;
};

/**
 * Inputs: a docs card definition and shared page scroll state.
 * Output: an animated principle card that subtly intensifies near the viewport midpoint.
 */
export default function PublicDocsSectionCard({
  section,
  scrollY,
  viewportHeight,
  offsetY,
}: PublicDocsSectionCardProps) {
  const [sectionLayout, setSectionLayout] = useState<SectionLayout | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!sectionLayout) {
      return undefined;
    }

    const initialScrollY = typeof scrollY.__getValue === 'function' ? scrollY.__getValue() : 0;
    setProgress(
      getSectionProgress(initialScrollY, sectionLayout.y, sectionLayout.height, viewportHeight),
    );

    const listenerId = scrollY.addListener(({ value }) => {
      setProgress(getSectionProgress(value, sectionLayout.y, sectionLayout.height, viewportHeight));
    });

    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [offsetY, scrollY, sectionLayout, viewportHeight]);

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setSectionLayout({
      y: offsetY + nativeEvent.layout.y,
      height: nativeEvent.layout.height,
    });
  };

  const isRightAnchored = section.anchor === 'right';
  const titleClassName = isRightAnchored ? 'text-right' : 'text-left';
  const detailClassName = isRightAnchored ? 'self-start items-start' : 'self-end items-end';
  const detailTextClassName = isRightAnchored ? 'text-left' : 'text-right';

  const cardScale = useMemo(() => 0.985 + progress * 0.015, [progress]);
  const accentOpacity = useMemo(() => 0.16 + progress * 0.16, [progress]);
  const borderColor = useMemo(
    () => `rgba(142, 197, 255, ${0.14 + progress * 0.2})`,
    [progress],
  );

  return (
    <Animated.View
      onLayout={handleLayout}
      style={{
        transform: [{ scale: cardScale }],
      }}
    >
      <PublicPanelShell
        accentOpacity={accentOpacity}
        className="min-h-[320px] overflow-hidden px-6 py-6 md:min-h-[340px] md:px-7 md:py-7"
        contentClassName="h-full"
        style={{ borderColor }}
      >
        <View className="flex-1 justify-between gap-8">
          <View className={isRightAnchored ? 'max-w-[78%] self-end items-end' : 'max-w-[78%]'}>
            <Text className="text-[10px] font-medium uppercase tracking-[2.8px] text-[#8cb1d9] md:text-[11px]">
              {section.label}
            </Text>
            <Text
              className={`mt-3 font-larken text-[28px] leading-[31px] text-[#d3e6ff] md:text-[34px] md:leading-[37px] ${titleClassName}`}
            >
              {section.title}
            </Text>
          </View>

          <View className={`max-w-[88%] gap-4 ${detailClassName}`}>
            <Text
              className={`font-larken text-[17px] leading-[23px] text-[#ecf3c8] md:text-[19px] md:leading-[25px] ${detailTextClassName}`}
            >
              {section.body}
            </Text>
          </View>
        </View>
      </PublicPanelShell>
    </Animated.View>
  );
}
