/**
 * File: public-animated-surface.tsx
 * Description: Animated-capable public surface wrapper for future position-based card motion.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

import {
  usePublicLayoutOffset,
  usePublicScrollAnimationContext,
} from '@app/components/public/animation/public-scroll-context';
import type { PublicMeasuredLayout } from '@app/components/public/animation/public-position.types';
import { getPositionFocusProgress } from '@app/components/public/animation/public-position-motion';
import {
  getPublicAnimationStyle,
  type PublicAnimationPresetName,
} from '@app/components/public/animation/public-animation-presets';
import PublicSurface, { type PublicSurfaceProps } from '@app/components/public/public-surface';

export type PublicAnimatedSurfaceIdentity = {
  elementId: string;
  navLabel?: string;
};

type PublicAnimatedSurfaceBaseProps = Omit<PublicSurfaceProps, 'animated' | 'onLayout'>;

export type PublicAnimatedSurfaceProps = PublicAnimatedSurfaceBaseProps & {
  elementId?: string;
  navLabel?: string;
  animationEnabled?: boolean;
  animationPreset?: PublicAnimationPresetName;
  scrollY?: Animated.Value;
  viewportHeight?: number;
  focusLineRatio?: number;
  layoutOffsetY?: number;
  layoutClassName?: string;
  layoutStyle?: StyleProp<ViewStyle>;
  surfaceAnimated?: boolean;
  onMeasuredLayoutChange?: (
    layout: PublicMeasuredLayout,
    identity?: PublicAnimatedSurfaceIdentity,
  ) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

function buildIdentity(
  elementId?: string,
  navLabel?: string,
): PublicAnimatedSurfaceIdentity | undefined {
  if (!elementId) {
    return undefined;
  }

  return { elementId, navLabel };
}

function areLayoutsEqual(current: PublicMeasuredLayout | undefined, next: PublicMeasuredLayout) {
  return Boolean(current && current.y === next.y && current.height === next.height);
}

const styles = StyleSheet.create({
  layoutAnimationWrapper: {
    height: '100%',
    width: '100%',
  },
});

/**
 * Animated public cards use a three-layer structure:
 * layout wrapper -> animation wrapper -> PublicSurface.
 *
 * Keep visual NativeWind classes on PublicSurface, not Animated.View.
 * Animated.View should own motion styles only.
 */
export function PublicAnimatedSurface({
  elementId,
  navLabel,
  animationEnabled = false,
  animationPreset = 'none',
  scrollY,
  viewportHeight,
  focusLineRatio,
  layoutOffsetY,
  layoutClassName,
  layoutStyle,
  surfaceAnimated = false,
  onMeasuredLayoutChange,
  onLayout,
  style,
  ...surfaceProps
}: PublicAnimatedSurfaceProps) {
  const scrollAnimationContext = usePublicScrollAnimationContext();
  const inheritedLayoutOffsetY = usePublicLayoutOffset();
  const [rawMeasuredLayout, setRawMeasuredLayout] = useState<PublicMeasuredLayout | undefined>();

  const identity = useMemo(() => buildIdentity(elementId, navLabel), [elementId, navLabel]);
  const resolvedScrollY = scrollY ?? scrollAnimationContext?.scrollY;
  const resolvedViewportHeight = viewportHeight ?? scrollAnimationContext?.viewportHeight;
  const resolvedFocusLineRatio = focusLineRatio ?? scrollAnimationContext?.focusLineRatio;
  const resolvedLayoutOffsetY = layoutOffsetY ?? inheritedLayoutOffsetY;

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayout?.(event);

      const { height, y } = event.nativeEvent.layout;
      const nextLayout = { y, height };

      setRawMeasuredLayout(current => (areLayoutsEqual(current, nextLayout) ? current : nextLayout));
    },
    [onLayout],
  );

  const measuredLayout = useMemo(() => {
    if (!rawMeasuredLayout) {
      return undefined;
    }

    return {
      y: rawMeasuredLayout.y + resolvedLayoutOffsetY,
      height: rawMeasuredLayout.height,
    };
  }, [rawMeasuredLayout, resolvedLayoutOffsetY]);

  useEffect(() => {
    if (!measuredLayout) {
      return;
    }

    onMeasuredLayoutChange?.(measuredLayout, identity);
  }, [identity, measuredLayout, onMeasuredLayoutChange]);

  const progress = useMemo(() => {
    if (!animationEnabled || !resolvedScrollY || !resolvedViewportHeight || !measuredLayout) {
      return undefined;
    }

    return getPositionFocusProgress({
      scrollY: resolvedScrollY,
      layout: measuredLayout,
      viewportHeight: resolvedViewportHeight,
      focusLineRatio: resolvedFocusLineRatio,
    });
  }, [
    animationEnabled,
    measuredLayout,
    resolvedFocusLineRatio,
    resolvedScrollY,
    resolvedViewportHeight,
  ]);

  const animationStyle = animationEnabled
    ? getPublicAnimationStyle({ presetName: animationPreset, progress })
    : undefined;

  const surface = (
    <PublicSurface
      {...surfaceProps}
      animated={surfaceAnimated}
      onLayout={layoutClassName ? undefined : handleLayout}
      style={style}
    />
  );

  const animationWrapperStyle = layoutClassName
    ? [styles.layoutAnimationWrapper, animationStyle]
    : animationStyle;

  const animatedSurface = animationStyle ? (
    <Animated.View style={animationWrapperStyle}>{surface}</Animated.View>
  ) : (
    surface
  );

  if (layoutClassName) {
    return (
      <View className={layoutClassName} onLayout={handleLayout} style={layoutStyle}>
        {animatedSurface}
      </View>
    );
  }

  return animatedSurface;
}

export default PublicAnimatedSurface;
