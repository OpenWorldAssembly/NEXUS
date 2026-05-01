/**
 * File: public-position-motion.ts
 * Description: Position-based scroll progress helpers for public-page animation primitives.
 */
import type {
  PublicPositionProgress,
  PublicPositionProgressInput,
} from '@app/components/public/animation/public-position.types';

export const PUBLIC_POSITION_ANIMATION_THEME = {
  defaultFocusLineRatio: 0.35,
  outerHeightMultiplier: 0.9,
  outerViewportMultiplier: 0.54,
  outerMinimumRange: 260,
  holdHeightMultiplier: 0.18,
  holdViewportMultiplier: 0.1,
  holdMinimumRange: 56,
} as const;

/**
 * Inputs: the scroll driver, target element measurements, and shared focus geometry.
 * Output: a normalized 0-1 progress value that ramps in early, holds through focus, and eases back out.
 */
export function getPositionFocusProgress({
  scrollY,
  layout,
  viewportHeight,
  focusLineRatio = PUBLIC_POSITION_ANIMATION_THEME.defaultFocusLineRatio,
}: PublicPositionProgressInput): PublicPositionProgress {
  if (!layout || viewportHeight <= 0 || layout.height <= 0) {
    return 0;
  }

  const focusLineOffset = viewportHeight * focusLineRatio;
  const elementCenter = layout.y + layout.height / 2;
  const centeredScrollOffset = Math.max(0, elementCenter - focusLineOffset);
  const outerRange = Math.max(
    layout.height * PUBLIC_POSITION_ANIMATION_THEME.outerHeightMultiplier,
    viewportHeight * PUBLIC_POSITION_ANIMATION_THEME.outerViewportMultiplier,
    PUBLIC_POSITION_ANIMATION_THEME.outerMinimumRange,
  );
  const holdRange = Math.max(
    layout.height * PUBLIC_POSITION_ANIMATION_THEME.holdHeightMultiplier,
    viewportHeight * PUBLIC_POSITION_ANIMATION_THEME.holdViewportMultiplier,
    PUBLIC_POSITION_ANIMATION_THEME.holdMinimumRange,
  );

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
