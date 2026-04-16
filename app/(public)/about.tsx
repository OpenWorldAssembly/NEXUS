/**
 * File: about.tsx
 * Description: Renders the public OWA about page with a midpoint-focused chapter scroll experience.
 */
import { Animated, View } from 'react-native';

import AboutSectionRail from '@/components/layout/about/about-section-rail';
import { useAboutPageController } from '@/components/layout/about/use-about-page-controller';
import PublicAboutSection from '@/components/layout/public-about-section';
import { aboutPageContent } from '@/data/public/about-content';

const sections = aboutPageContent.sections;

/**
 * Inputs: none.
 * Output: the public about page with midpoint-based section focus and synchronized chapter animation.
 */
export default function AboutPage() {
  const {
    activeSectionId,
    bottomRunway,
    chapterHeight,
    collapsedHeight,
    expandedHeight,
    railAwareContentPaddingRight,
    railRightOffset,
    railShellHeight,
    scrollEventHandler,
    scrollViewRef,
    scrollY,
    sectionLayouts,
    secondaryNavLayoutMode,
    topbarContentPaddingTop,
    topbarShellHeight,
    viewportHeight,
    getRailAnimatedState,
    getTopbarAnimatedState,
    handleSectionLayout,
    handleSectionPress,
    handleViewportLayout,
    shouldShowRailSubtitle,
    shouldShowTopbarSubtitle,
  } = useAboutPageController({ sections });

  const sectionNavAnimatedState =
    secondaryNavLayoutMode === 'rail' ? getRailAnimatedState : getTopbarAnimatedState;
  const shouldShowSectionNavSubtitle =
    secondaryNavLayoutMode === 'rail' ? shouldShowRailSubtitle : shouldShowTopbarSubtitle;

  return (
    <View style={{ flex: 1 }} onLayout={handleViewportLayout}>
      <Animated.ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: bottomRunway }}
        onScroll={scrollEventHandler}
        scrollEventThrottle={16}
        style={{ flex: 1, backgroundColor: '#020d26' }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="mx-auto w-full max-w-6xl px-5 py-8"
          style={[
            secondaryNavLayoutMode === 'rail' ? { paddingRight: railAwareContentPaddingRight } : null,
            secondaryNavLayoutMode === 'topbar' ? { paddingTop: topbarContentPaddingTop } : null,
          ]}
        >
          <View className="gap-0 md:gap-0">
            {sections.map((section, index) => (
              <View key={section.id} onLayout={(event) => handleSectionLayout(section.id, event)}>
                <PublicAboutSection
                  isActive={section.id === activeSectionId}
                  onPress={() => handleSectionPress(section.id)}
                  scrollY={scrollY}
                  section={section}
                  sectionIndex={index}
                  focusLineRatio={0.35}
                  chapterHeight={chapterHeight}
                  collapsedHeight={collapsedHeight}
                  expandedHeight={expandedHeight}
                  sectionLayout={sectionLayouts[section.id]}
                  viewportHeight={viewportHeight}
                />
              </View>
            ))}
          </View>
        </View>
      </Animated.ScrollView>

      <AboutSectionRail
        activeSectionId={activeSectionId}
        content={aboutPageContent}
        getItemAnimatedState={sectionNavAnimatedState}
        layoutMode={secondaryNavLayoutMode}
        onSectionPress={handleSectionPress}
        railRightOffset={railRightOffset}
        railShellHeight={railShellHeight}
        shouldShowItemSubtitle={shouldShowSectionNavSubtitle}
        topbarShellHeight={topbarShellHeight}
      />
    </View>
  );
}
