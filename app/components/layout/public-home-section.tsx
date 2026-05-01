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
  const isCompactMainPoint = section.mainPointScale === 'compact';
  const subPointItems = section.subPoints?.length
    ? section.subPoints
    : section.subPoint
      ? section.subPoint.split('\n').map((item) => item.trim()).filter(Boolean)
      : [];
  const hasSubPointList = subPointItems.length > 1;
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
    fontSize: isCompactMainPoint
      ? isHero
        ? isDesktop
          ? 36
          : 29
        : isDesktop
          ? 34
          : 27
      : isHero
        ? isDesktop
          ? 78
          : 52
        : isDesktop
          ? 64
          : 44,
    lineHeight: isCompactMainPoint
      ? isHero
        ? isDesktop
          ? 68
          : 52
        : isDesktop
          ? 66
          : 50
      : isHero
        ? isDesktop
          ? 114
          : 82
        : isDesktop
          ? 98
          : 72,
    fontWeight: '900' as const,
    letterSpacing: isCompactMainPoint
      ? isDesktop
        ? 0.55
        : 0.25
      : isHero
        ? isDesktop
          ? -0.35
          : 0.05
        : isDesktop
          ? 0
          : 0.15,
    maxWidth: isCompactMainPoint
      ? isHero
        ? isDesktop
          ? 460
          : 285
        : isDesktop
          ? 410
          : 265
      : isHero
        ? isDesktop
          ? 370
          : 240
        : isDesktop
          ? 320
          : 220,
    textShadowColor: 'rgba(2, 7, 14, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  };

  const subTextStyle = {
    fontSize: hasSubPointList ? (isDesktop ? 15 : 12.5) : isHero ? (isDesktop ? 24 : 19) : isDesktop ? 21 : 17,
    lineHeight: hasSubPointList ? (isDesktop ? 24 : 20.5) : isHero ? (isDesktop ? 29 : 23) : isDesktop ? 25 : 21,
    fontWeight: '700' as const,
    letterSpacing: 0.05,
    maxWidth: isHero ? (isDesktop ? 330 : 250) : isDesktop ? 305 : 225,
    opacity: 0.84,
    position: 'relative' as const,
    zIndex: 2,
    textShadowColor: 'rgba(2, 7, 14, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  };

  const mainRowClassName = isRightAligned
    ? 'w-full items-end md:pr-4'
    : 'w-full items-start md:pl-1';
  const subRowClassName = isRightAligned
    ? 'w-full items-start gap-5 md:pl-2'
    : 'w-full items-end gap-5 md:pr-2';
  const subRowOverlapClassName = isDesktop ? '-mt-8' : '-mt-4';
  const subPointListClassName = isRightAligned ? 'items-start' : 'items-end';
  const subPointTextClassName = isRightAligned ? 'text-left' : 'text-right';
  const subPointGap = hasSubPointList ? (isDesktop ? 16 : 11) : 0;
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
      <View className={subPointListClassName} style={{ maxWidth: subTextStyle.maxWidth }}>
        {subPointItems.map((subPoint, index) => {
          const isLastSubPoint = index === subPointItems.length - 1;

          return (
            <Animated.Text
              className={subPointTextClassName}
              key={subPoint}
              style={[
                subTextStyle,
                {
                  color: subPointColor,
                  marginBottom: isLastSubPoint ? 0 : subPointGap,
                  maxWidth: '100%',
                },
              ]}
            >
              {hasSubPointList ? `• ${subPoint}` : subPoint}
            </Animated.Text>
          );
        })}
      </View>
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
