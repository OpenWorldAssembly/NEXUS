/**
 * File: about-section-motion.ts
 * Description: Shared animation helpers for the about-page chapter cards.
 */
import { Animated } from 'react-native';

export type SectionLayout = {
  y: number;
  height: number;
};

/**
 * Inputs: the scroll driver, target section measurements, and the shared focus geometry.
 * Output: a normalized 0-1 progress value that ramps in early, holds through focus, and eases back out.
 */
export function getSectionProgress(
  scrollY: Animated.Value,
  sectionLayout: SectionLayout | undefined,
  viewportHeight: number,
  focusLineRatio: number
) {
  if (!sectionLayout) {
    return 0;
  }

  const focusLineOffset = viewportHeight * focusLineRatio;
  const sectionCenter = sectionLayout.y + sectionLayout.height / 2;
  const centeredScrollOffset = Math.max(0, sectionCenter - focusLineOffset);
  const outerRange = Math.max(sectionLayout.height * 0.9, viewportHeight * 0.54, 260);
  const holdRange = Math.max(sectionLayout.height * 0.18, viewportHeight * 0.1, 56);

  return scrollY.interpolate({
    inputRange: [
      centeredScrollOffset - outerRange,
      centeredScrollOffset - holdRange,
      centeredScrollOffset + holdRange,
      centeredScrollOffset + outerRange,
    ],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });
}
