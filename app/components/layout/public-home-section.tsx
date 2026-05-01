/**
 * File: public-home-section.tsx
 * Description: Renders a single homepage rail section by mapping Home content into the shared public section shell.
 */
import { Link } from 'expo-router';
import { Pressable, Text, View, Animated, useWindowDimensions } from 'react-native';

import PublicPageActions from '@app/components/public/public-page-actions';
import { PUBLIC_SURFACE_CLASSES } from '@app/components/public/public-surface';
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
 * Output: one homepage section with unified card motion and same-side alternating text placement.
 */
export default function PublicHomeSection({
  isActive,
  scrollY,
  section,
  sectionLayout,
  viewportHeight,
}: PublicHomeSectionProps) {
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

  const actionAlignmentClassName = isRightAligned ? 'items-end' : 'items-start';
  const actionWrapperClassName =
    section.action?.variant === 'primary'
      ? PUBLIC_SURFACE_CLASSES.action.solidRootClassName
      : PUBLIC_SURFACE_CLASSES.action.outlineRootClassName;
  const actionTextClassName =
    section.action?.variant === 'primary'
      ? PUBLIC_SURFACE_CLASSES.action.solidTextClassName
      : PUBLIC_SURFACE_CLASSES.action.outlineTextClassName;

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
    maxWidth: isHero ? (isDesktop ? 360 : 250) : isDesktop ? 340 : 225,
    opacity: 0.84,
    position: 'relative' as const,
    zIndex: 2,
    textShadowColor: 'rgba(2, 7, 14, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  };

  const textStackClassName = isRightAligned ? 'w-full items-end md:pr-4' : 'w-full items-start md:pl-1';
  const textAlignClassName = isRightAligned ? 'text-right' : 'text-left';
  const subPointListClassName = isRightAligned ? 'items-end' : 'items-start';
  const subPointGap = hasSubPointList ? (isDesktop ? 16 : 11) : 0;
  const contentClassName = 'min-h-[350px] justify-center px-6 py-10 md:min-h-[460px] md:px-10 md:py-12';

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

  return (
    <PublicSectionShell
      backgroundImageUri={section.backgroundImageUri}
      enableDecorativeAccents={false}
      focusLineRatio={PUBLIC_SECTION_FOCUS_LINE_RATIO}
      layoutOffsetY={sectionLayout?.y}
      scrollY={scrollY}
      contentClassName={contentClassName}
      header={
        <View className={textStackClassName}>
          <Text
            className={`${textAlignClassName} ${PUBLIC_SURFACE_CLASSES.text.headingClassName}`}
            style={[noBreakTextStyle, mainTextStyle]}
          >
            {section.mainPoint}
          </Text>

          {subPointItems.length ? (
            <View className={`mt-8 md:mt-10 ${subPointListClassName}`} style={{ maxWidth: subTextStyle.maxWidth }}>
              {subPointItems.map((subPoint, index) => {
                const isLastSubPoint = index === subPointItems.length - 1;

                return (
                  <Text
                    className={`${textAlignClassName} ${PUBLIC_SURFACE_CLASSES.text.bodyWarmClassName}`}
                    key={subPoint}
                    style={[
                      subTextStyle,
                      {
                        marginBottom: isLastSubPoint ? 0 : subPointGap,
                        maxWidth: '100%',
                      },
                    ]}
                  >
                    {hasSubPointList ? `• ${subPoint}` : subPoint}
                  </Text>
                );
              })}
            </View>
          ) : null}

          {actionNode ? <View className="mt-8">{actionNode}</View> : null}
        </View>
      }
      isActive={isActive}
      viewportHeight={viewportHeight}
    />
  );
}
