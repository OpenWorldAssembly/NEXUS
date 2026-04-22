/**
 * File: docs.tsx
 * Description: Renders the public docs page as a responsive set of animated charter cards.
 */
import { useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent, Text, View } from 'react-native';

import PublicPageActions from '@/app/components/public/public-page-actions';
import PublicDocsSectionGrid from '@/app/components/public/public-docs-section-grid';
import PublicPanelShell from '@/app/components/public/public-panel-shell';
import {
  CHARTER_CLOSING,
  CHARTER_HERO,
  CHARTER_PRINCIPLE_CARDS,
} from '@/app/public/docs-content';

const AnimatedScrollView = Animated.ScrollView;

/**
 * Inputs: none.
 * Output: the public docs page with a fluid hero, responsive charter cards, and closing callout.
 */
export default function DocsPage() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [viewportHeight, setViewportHeight] = useState(0);

  const handleViewportLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setViewportHeight(nativeEvent.layout.height);
  };

  return (
    <AnimatedScrollView
      className="flex-1 bg-[#020d26]"
      contentContainerStyle={{ paddingBottom: 120 }}
      onLayout={handleViewportLayout}
      onScroll={(event) => {
        scrollY.setValue(event.nativeEvent.contentOffset.y);
      }}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      <View className="mx-auto w-full max-w-[1240px] px-5 py-8 md:px-6 md:py-10">
        <View className="gap-8 md:gap-10">
          <PublicPanelShell
            accentOpacity={0.22}
            className="min-h-[320px] px-6 py-7 md:min-h-[360px] md:px-8 md:py-8"
            contentClassName="h-full"
          >
            <View className="flex-1 justify-between gap-8 md:flex-row md:items-end md:gap-10">
              <View className="max-w-[720px] gap-4 md:gap-5">
                <Text className="text-[11px] font-medium uppercase tracking-[2.8px] text-[#8cb1d9] md:text-[12px]">
                  Founding Documents
                </Text>
                <Text className="font-larken text-[34px] leading-[36px] text-[#d8e9ff] md:text-[48px] md:leading-[50px]">
                  {CHARTER_HERO.title}
                </Text>
                <View className="gap-3">
                  {CHARTER_HERO.lines.map((line) => (
                    <Text
                      key={line}
                      className="max-w-[760px] text-[15px] leading-[25px] text-[#d5e0ef] md:text-[17px] md:leading-[28px]"
                    >
                      {line}
                    </Text>
                  ))}
                </View>
              </View>

              <View className="max-w-[440px] self-start gap-4 md:self-end">
                <Text className="font-larken text-[20px] leading-[24px] text-[#eef3c9] md:text-[24px] md:leading-[28px]">
                  Structured as a readable, reusable set of principles for every scope.
                </Text>
                <Text className="text-[14px] leading-[23px] text-[#c8d7ec] md:text-[15px] md:leading-[24px]">
                  The page now reads as a flexible field of panels instead of a rigid fixed grid,
                  while still scaling cleanly from one column on smaller screens to three on wide
                  layouts.
                </Text>
                <PublicPageActions actions={CHARTER_HERO.ctas} />
              </View>
            </View>
          </PublicPanelShell>

          <PublicDocsSectionGrid
            scrollY={scrollY}
            sections={CHARTER_PRINCIPLE_CARDS}
            viewportHeight={viewportHeight}
          />

          <PublicPanelShell
            accentOpacity={0.18}
            className="px-6 py-7 md:px-8 md:py-8"
            contentClassName="h-full"
          >
            <View className="gap-6 md:flex-row md:items-end md:justify-between md:gap-10">
              <View className="max-w-[720px] gap-4">
                <Text className="text-[11px] font-medium uppercase tracking-[2.8px] text-[#8cb1d9] md:text-[12px]">
                  Closing Perspective
                </Text>
                <Text className="font-larken text-[30px] leading-[33px] text-[#d8e9ff] md:text-[40px] md:leading-[42px]">
                  {CHARTER_CLOSING.title}
                </Text>
                <View className="gap-3">
                  {CHARTER_CLOSING.lines.map((line) => (
                    <Text
                      key={line}
                      className="text-[14px] leading-[23px] text-[#d5e0ef] md:text-[15px] md:leading-[24px]"
                    >
                      {line}
                    </Text>
                  ))}
                </View>
              </View>

              <View className="max-w-[460px] self-start gap-4 md:self-end">
                <Text className="font-larken text-[20px] leading-[24px] text-[#eef3c9] md:text-[24px] md:leading-[28px]">
                  A shared charter should feel alive, legible, and adaptable, not boxed into a
                  static wall of text.
                </Text>
                <PublicPageActions actions={CHARTER_CLOSING.ctas} />
              </View>
            </View>
          </PublicPanelShell>
        </View>
      </View>
    </AnimatedScrollView>
  );
}
