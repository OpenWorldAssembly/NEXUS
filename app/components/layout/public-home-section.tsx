/**
 * File: public-home-section.tsx
 * Description: Renders a single homepage rail section by mapping Home content into the shared public section shell.
 */
import { Link } from 'expo-router';
import { Pressable, Text, View, Animated, useWindowDimensions } from 'react-native';

import { getSectionProgress } from '@/app/components/public/sections/public-section-motion';
import PublicPageActions from '@app/components/public/public-page-actions';
import { PUBLIC_SECTION_FOCUS_LINE_RATIO } from '@app/components/public/sections/public-section.constants';
import type { SectionLayout } from '@app/components/public/sections/public-section.types';
import PublicSectionShell from '@app/components/public/sections/public-section-shell';
import type { HomeRailSection } from '@app/public/home-content';

type PublicHomeSectionProps = {
  isActive: boolean;
  scrollY: Animated.Value;
  section: HomeRailSection;
  sectionLayout?: SectionLayout;
  viewportHeight: number;
};

const noBreakTextStyle = {
  wordBreak: 'keep-all',
  overflowWrap: 'normal',
  hyphens: 'none',
} as any;

/**
 * Inputs: the homepage section copy, scroll driver, and viewport/layout measurements.
 * Output: one homepage section with shared focus-aware accent motion and the existing alternating layout.
 */
export default function PublicHomeSection({
  isActive,
  scrollY,
  section,
  sectionLayout,
  viewportHeight,
}: PublicHomeSectionProps) {
  const rawProgress = getSectionProgress(
    scrollY,
    sectionLayout,
    viewportHeight,
    PUBLIC_SECTION_FOCUS_LINE_RATIO,
  );
  const progress =
    typeof rawProgress === 'number'
      ? rawProgress
      : rawProgress.interpolate({
          inputRange: [0, 0.24, 0.6, 0.86, 1],
          outputRange: [0, 0.2, 0.76, 0.94, 1],
          extrapolate: 'clamp',
        });

  const shellScale =
    typeof progress === 'number'
      ? 0.997
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.997, 1],
          extrapolate: 'clamp',
        });
  const shellTranslateY =
    typeof progress === 'number'
      ? 8
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
          extrapolate: 'clamp',
        });
  const backgroundTranslateY =
    typeof progress === 'number'
      ? 10
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
          extrapolate: 'clamp',
        });
  const backgroundScale =
    typeof progress === 'number'
      ? 1.03
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1.03, 1],
          extrapolate: 'clamp',
        });
  const shellBackgroundColor =
    typeof progress === 'number'
      ? 'rgba(7, 19, 42, 0.52)'
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['rgba(7, 19, 42, 0.52)', 'rgba(8, 25, 54, 0.62)'],
          extrapolate: 'clamp',
        });
  const shellBorderColor =
    typeof progress === 'number'
      ? 'rgba(117, 149, 186, 0.64)'
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['rgba(117, 149, 186, 0.64)', 'rgba(109, 211, 255, 0.92)'],
          extrapolate: 'clamp',
        });
  const accentOverlayOpacity =
    typeof progress === 'number'
      ? 0.06
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.06, 0.15],
          extrapolate: 'clamp',
        });
  const contentTranslateY =
    typeof progress === 'number'
      ? 8
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
          extrapolate: 'clamp',
        });
  const contentOpacity =
    typeof progress === 'number'
      ? 0.9
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1],
          extrapolate: 'clamp',
        });
  const headlineColor =
    typeof progress === 'number'
      ? '#8ec5ff'
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['#8ec5ff', '#b5dcff'],
          extrapolate: 'clamp',
        });
  const subPointColor =
    typeof progress === 'number'
      ? '#d7ffbf'
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['#d7ffbf', '#edf7d1'],
          extrapolate: 'clamp',
        });

  const isHero = section.variant === 'hero';
  const isRightAligned = section.align === 'right';
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const actionAlignmentClassName = isRightAligned ? 'items-start' : 'items-end';
  const actionWrapperClassName =
    section.action?.variant === 'primary'
      ? 'rounded-full bg-public-accent px-6 py-3'
      : 'rounded-full border border-public-line bg-public-panel/70 px-6 py-3';
  const actionTextClassName =
    section.action?.variant === 'primary'
      ? 'text-sm font-extrabold uppercase tracking-[0.18em] text-public-canvas'
      : 'text-sm font-bold uppercase tracking-[0.18em] text-public-text';

  const mainTextStyle = {
    fontSize: isHero ? (isDesktop ? 78 : 52) : isDesktop ? 64 : 44,
    lineHeight: isHero ? (isDesktop ? 72 : 48) : isDesktop ? 58 : 40,
    fontWeight: '900' as const,
    letterSpacing: isHero ? (isDesktop ? -1.4 : -0.8) : isDesktop ? -1 : -0.5,
    maxWidth: isHero ? (isDesktop ? 370 : 240) : isDesktop ? 320 : 220,
  };

  const subTextStyle = {
    fontSize: isHero ? (isDesktop ? 28 : 22) : isDesktop ? 24 : 19,
    lineHeight: isHero ? (isDesktop ? 32 : 26) : isDesktop ? 28 : 23,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
    maxWidth: isHero ? (isDesktop ? 360 : 260) : isDesktop ? 300 : 230,
  };

  const mainRowClassName = isRightAligned
    ? 'w-full items-end md:pr-4'
    : 'w-full items-start md:pl-1';
  const subRowClassName = isRightAligned
    ? 'w-full items-start gap-5 md:pl-2'
    : 'w-full items-end gap-5 md:pr-2';
  const subRowOverlapClassName = isDesktop ? '-mt-10' : '-mt-4';
  const contentClassName = 'min-h-[350px] justify-center px-6 py-10 md:min-h-[460px] md:px-10 md:py-12';

  const mainBlock = (
    <View className={mainRowClassName}>
      <Animated.Text
        className={isRightAligned ? 'text-right' : 'text-left'}
        style={[noBreakTextStyle, mainTextStyle, { color: headlineColor }]}
      >
        {section.mainPoint}
      </Animated.Text>
    </View>
  );

  const actionNode = isHero && section.actions?.length ? (
    <View className={actionAlignmentClassName}>
      <PublicPageActions actions={section.actions} />
    </View>
  ) : section.action ? (
    <View className={actionAlignmentClassName}>
      <Link href={section.action.href} asChild>
        <Pressable className={actionWrapperClassName}>
          <Text className={actionTextClassName}>{section.action.label}</Text>
        </Pressable>
      </Link>
    </View>
  ) : null;

  const subBlock = (
    <View className={`${subRowClassName} ${subRowOverlapClassName}`}>
      <Animated.Text
        className={isRightAligned ? 'text-left' : 'text-right'}
        style={[noBreakTextStyle, subTextStyle, { color: subPointColor }]}
      >
        {section.subPoint}
      </Animated.Text>
      {actionNode}
    </View>
  );

  return (
    <PublicSectionShell
      accentAnimatedStyle={{ opacity: accentOverlayOpacity }}
      backgroundAnimatedStyle={{ transform: [{ translateY: backgroundTranslateY }, { scale: backgroundScale }] }}
      backgroundImageUri={section.backgroundImageUri}
      contentClassName={contentClassName}
      header={
        <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }}>
          <View className="min-h-[270px] justify-between md:min-h-[360px]">
            {mainBlock}
            {subBlock}
          </View>
        </Animated.View>
      }
      isActive={isActive}
      shellAnimatedStyle={{
        backgroundColor: shellBackgroundColor,
        borderColor: shellBorderColor,
        transform: [{ translateY: shellTranslateY }, { scale: shellScale }],
      }}
    />
  );
}
