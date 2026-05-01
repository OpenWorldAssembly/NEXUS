/**
 * File: public-position.types.ts
 * Description: Shared position-measurement types for public-page animation primitives.
 */
import type { Animated } from 'react-native';

export type PublicMeasuredLayout = {
  y: number;
  height: number;
};

export type PublicPositionFocusConfig = {
  viewportHeight: number;
  focusLineRatio?: number;
};

export type PublicPositionProgressInput = PublicPositionFocusConfig & {
  scrollY: Animated.Value;
  layout?: PublicMeasuredLayout;
};

export type PublicPositionProgress = number | Animated.AnimatedInterpolation<number>;
