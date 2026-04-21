/**
 * File: index.tsx
 * Description: Renders the public homepage hero and animated section rail.
 */
import { Image } from 'expo-image';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useHomePageController } from '@app/components/layout/home/use-home-page-controller';
import PublicPageActions from '@app/components/public/public-page-actions';
import PublicHomeRailSection from '@app/components/public/public-home-rail-section';
import { homePageContent } from '@app/public/home-content';

const AnimatedScrollView = Animated.ScrollView;

const noBreakTextStyle = {
  wordBreak: 'keep-all',
  overflowWrap: 'normal',
  hyphens: 'none',
} as any;

/**
 * Inputs: none.
 * Output: the public homepage hero and selected sharp sections.
 */
export default function HomePage() {
  const {
    activeSectionId,
    handleSectionLayout,
    handleViewportLayout,
    scrollEventHandler,
    scrollViewRef,
    scrollY,
    sectionLayouts,
    viewportHeight,
  } = useHomePageController({ sections: homePageContent.sections });

  return (
    <AnimatedScrollView
      ref={scrollViewRef}
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 128 }}
      onLayout={handleViewportLayout}
      onScroll={scrollEventHandler}
      scrollEventThrottle={16}
    >
      <View className="mx-auto w-full max-w-6xl px-5 py-8 md:py-10">
        <View className="relative pl-10">
          <View className="absolute bottom-0 left-4 top-0 w-px bg-public-line/60" />
          <View className="absolute left-[8px] top-14 h-3 w-3 rounded-full border border-public-line bg-[#8ec5ff]" />

          <View style={styles.heroShell} className="overflow-hidden rounded-[30px] bg-transparent">
            <Image source={{ uri: homePageContent.hero.backgroundImageUri }} contentFit="cover" style={styles.backgroundImage} />
            <View className="min-h-[260px] justify-center bg-public-canvas/52 px-6 py-10 md:min-h-[340px] md:px-10 md:py-12">
              <View className="gap-8 md:flex-row md:items-center md:gap-14">
                <View className="flex-1 justify-center">
                  <Text
                    style={noBreakTextStyle}
                    className="text-[2.3rem] font-black uppercase leading-[0.98] tracking-[0.03em] text-[#8ec5ff] md:text-[3.6rem]"
                  >
                    {homePageContent.hero.title}
                  </Text>
                </View>

                <View className="flex-1 justify-center gap-6 md:items-start">
                  <Text
                    style={noBreakTextStyle}
                    className="max-w-[28rem] text-[1.7rem] font-semibold leading-[1.08] tracking-[0.02em] text-public-accentSoft md:text-[2.5rem]"
                  >
                    {homePageContent.hero.statement}
                  </Text>

                  <View className="pt-2">
                    <PublicPageActions actions={homePageContent.heroActions} />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View className="gap-48 pt-20 md:gap-64 md:pt-28">
          {homePageContent.sections.map((section) => (
            <PublicHomeRailSection
              key={section.id}
              isActive={activeSectionId === section.id}
              onLayout={handleSectionLayout}
              scrollY={scrollY}
              section={section}
              sectionLayout={sectionLayouts[section.id]}
              viewportHeight={viewportHeight}
            />
          ))}
        </View>
      </View>
    </AnimatedScrollView>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroShell: {
    shadowColor: '#07121d',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.2,
    shadowRadius: 26,
  },
});
