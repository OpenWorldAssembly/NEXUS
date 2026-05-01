/**
 * File: public-animation-presets.ts
 * Description: Shared public-surface animation preset names and style resolution.
 */
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import type { PublicPositionProgress } from '@app/components/public/animation/public-position.types';

export type PublicAnimationPresetName = 'none' | 'focusLift';

export const PUBLIC_CARD_ANIMATION_DEFAULTS = {
  enabled: true,
  preset: 'focusLift' as PublicAnimationPresetName,
} as const;

export type PublicAnimationStyle =
  | StyleProp<ViewStyle>
  | Animated.WithAnimatedValue<StyleProp<ViewStyle>>;

export type PublicAnimationPresetInput = {
  presetName?: PublicAnimationPresetName;
  progress?: PublicPositionProgress;
};

export const PUBLIC_ANIMATION_PRESET_THEME = {
  focusLiftTranslateY: 28,
  focusLiftRestingOpacity: 0.52,
} as const;

function getInterpolatedValue(
  progress: PublicPositionProgress,
  outputRange: [number, number],
) {
  if (typeof progress === 'number') {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    return outputRange[0] + (outputRange[1] - outputRange[0]) * clampedProgress;
  }

  return progress.interpolate({
    inputRange: [0, 1],
    outputRange,
    extrapolate: 'clamp',
  });
}

/**
 * Inputs: a named animation preset and optional position progress.
 * Output: an animated style object, or undefined when no animation should be applied.
 */
export function getPublicAnimationStyle({
  presetName = 'none',
  progress,
}: PublicAnimationPresetInput): PublicAnimationStyle | undefined {
  if (presetName === 'none' || progress === undefined) {
    return undefined;
  }

  if (presetName === 'focusLift') {
    return {
      opacity: getInterpolatedValue(progress, [PUBLIC_ANIMATION_PRESET_THEME.focusLiftRestingOpacity, 1]),
      transform: [
        {
          translateY: getInterpolatedValue(progress, [PUBLIC_ANIMATION_PRESET_THEME.focusLiftTranslateY, 0]),
        },
      ],
    } as PublicAnimationStyle;
  }

  return undefined;
}
