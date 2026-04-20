/**
 * File: public-home-rail-section.tsx
 * Description: Renders one animated homepage panel with alternating left/right layout.
 */
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { HomeRailSection } from '@app/public/home-content';

type PublicHomeRailSectionProps = {
  scrollY: Animated.Value;
  section: HomeRailSection;
};

const noBreakTextStyle = {
  wordBreak: 'keep-all',
  overflowWrap: 'normal',
  hyphens: 'none',
} as any;

/**
 * Inputs: a homepage section descriptor and shared scroll position.
 * Output: one animated homepage panel with alternating left/right layout.
 */
export default function PublicHomeRailSection({
  scrollY,
  section,
}: PublicHomeRailSectionProps) {
  const [layoutY, setLayoutY] = useState(0);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const viewportHeight = Math.max(windowHeight, 760);
  const isRightAligned = section.align === 'right';
  const isCompact = windowWidth < 980;

  function handleLayout(event: LayoutChangeEvent) {
    setLayoutY(event.nativeEvent.layout.y);
  }

  const progress = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [layoutY - viewportHeight, layoutY - viewportHeight * 0.44, layoutY + 140],
        outputRange: [0, 0.88, 1],
        extrapolate: 'clamp',
      }),
    [layoutY, scrollY, viewportHeight],
  );

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [76, 0],
    extrapolate: 'clamp',
  });

  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.26, 1],
    extrapolate: 'clamp',
  });

  const outerAlignmentClassName = 'pl-10';

  const actionAlignmentClassName = isRightAligned ? 'items-start' : 'items-end';
  const subPointAlignmentClassName = isRightAligned ? 'items-start' : 'items-end';

  const actionWrapperClassName =
    section.action.variant === 'primary'
      ? 'rounded-full bg-public-accent px-6 py-3'
      : 'rounded-full border border-public-line bg-public-panel/70 px-6 py-3';

  const actionTextClassName =
    section.action.variant === 'primary'
      ? 'text-sm font-extrabold uppercase tracking-[0.18em] text-public-canvas'
      : 'text-sm font-bold uppercase tracking-[0.18em] text-public-text';

  const mainBlock = (
    <View className="flex-1 justify-center">
      <Text
        style={noBreakTextStyle}
        className="text-[2.05rem] font-black uppercase leading-[0.98] tracking-[0.03em] text-[#8ec5ff] md:text-[3.05rem]"
      >
        {section.mainPoint}
      </Text>
    </View>
  );

  const subBlock = (
    <View className={`flex-1 justify-center gap-6 ${subPointAlignmentClassName}`}>
      <Text
        style={noBreakTextStyle}
        className="max-w-[26rem] text-[1.38rem] font-semibold leading-[1.08] tracking-[0.02em] text-public-accentSoft md:text-[1.95rem]"
      >
        {section.subPoint}
      </Text>
      <View className={actionAlignmentClassName}>
        <Link href={section.action.href} asChild>
          <Pressable className={actionWrapperClassName}>
            <Text className={actionTextClassName}>{section.action.label}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );

  return (
    <View onLayout={handleLayout} className={`relative ${outerAlignmentClassName}`}>
      <View className="absolute bottom-0 left-4 top-0 w-px bg-public-line/60" />
      <View className="absolute left-[8px] top-14 h-3 w-3 rounded-full border border-public-line bg-[#8ec5ff]" />

      <Animated.View
        style={[styles.shell, { opacity, transform: [{ translateY }] }]}
        className="overflow-hidden rounded-[30px] border border-public-line/80 bg-public-panel/45"
      >
        <Image source={{ uri: section.backgroundImageUri }} contentFit="cover" style={styles.backgroundImage} />
          <View className="min-h-[390px] justify-center bg-public-canvas/52 px-6 py-10 md:min-h-[510px] md:px-10 md:py-12">
            <View className="gap-8 md:flex-row md:items-center md:gap-14">
              {isRightAligned ? (
                <>
                  {subBlock}
                  {mainBlock}
                </>
              ) : (
                <>
                  {mainBlock}
                  {subBlock}
                </>
              )}
            </View>
          </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    shadowColor: '#07121d',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.2,
    shadowRadius: 26,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
