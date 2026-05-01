/**
 * File: index.tsx
 * Description: Renders the public homepage as a continuous animated rail of sections.
 */
import { Animated, View } from 'react-native';

import { useHomePageController } from '@app/components/layout/home/use-home-page-controller';
import PublicHomeRailSection from '@app/components/public/public-home-rail-section';
import { homePageContent } from '@app/public/home-content';

const AnimatedScrollView = Animated.ScrollView;

/**
 * Inputs: none.
 * Output: the public homepage rendered as one shared section system.
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
        <View className="gap-24 md:gap-28">
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
