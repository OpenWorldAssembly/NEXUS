/**
 * File: about.tsx
 * Description: Renders the public OWA about page with a midpoint-focused chapter scroll experience.
 */
import { Animated, View } from 'react-native';

import AboutSectionRail from '@app/components/layout/about/about-section-rail';
import { useAboutPageController } from '@app/components/layout/about/use-about-page-controller';
import PublicAboutSection from '@app/components/layout/public-about-section';
import { aboutPageContent } from '@app/public/about-content';

const sections = aboutPageContent.sections;

/**
 * Inputs: none.
 * Output: the public about page with midpoint-based section focus and synchronized chapter animation.
 */
export default function AboutPage() {
  const {
    activeSectionId,
    bottomRunway,
    railAwareContentPaddingRight,
    railRightOffset,
    railShellHeight,
    scrollEventHandler,
    scrollViewRef,
    scrollY,
    sectionLayouts,
    secondaryNavLayoutMode,
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
      {secondaryNavLayoutMode === 'topbar' ? (
        <View style={{ height: topbarShellHeight, position: 'relative' }}>
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
      ) : null}

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
          ]}
        >
          <View className="gap-0 md:gap-0">
            {sections.map((section) => (
              <View key={section.id} onLayout={(event) => handleSectionLayout(section.id, event)}>
                <PublicAboutSection
                  isActive={section.id === activeSectionId}
                  onPress={() => handleSectionPress(section.id)}
                  scrollY={scrollY}
                  section={section}
                  focusLineRatio={0.35}
                  sectionLayout={sectionLayouts[section.id]}
                  viewportHeight={viewportHeight}
                />
              </View>
            ))}
          </View>
        </View>
      </Animated.ScrollView>

      {secondaryNavLayoutMode === 'rail' ? (
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
      ) : null}
    </View>
  );
}
