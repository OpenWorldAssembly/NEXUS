/**
 * File: public-surface.tsx
 * Description: Base public-site surface primitive for reusable card and panel shells.
 */
import type { ReactNode } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

type PublicSurfaceStyle =
  | StyleProp<ViewStyle>
  | Animated.WithAnimatedValue<StyleProp<ViewStyle>>;

export type PublicSurfaceProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  baseClassName?: string;
  style?: PublicSurfaceStyle;
  background?: ReactNode;
  animated?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
};

export const PUBLIC_SURFACE_CLASSES = {
  baseClassName: 'overflow-hidden border',
  defaultBaseClassName: 'overflow-hidden rounded-[30px] border border-public-surfaceBorderSoft bg-public-surfaceBase',
  standardCardBaseClassName: 'overflow-hidden rounded-[28px] border border-public-surfaceBorder bg-public-surface',
  panelBaseClassName: 'overflow-hidden rounded-[30px] border border-public-surfaceBorderSoft bg-public-surfaceBase',
  background: {
    panelBaseClassName: 'bg-public-surfaceBase',
  },
  border: {
    ruleClassName: 'border-public-surfaceRule',
  },
  glow: {
    surfaceClassName: 'bg-public-surfaceGlow',
    surfaceSoftClassName: 'bg-public-surfaceGlow/45',
    surfaceDeepClassName: 'bg-public-surfaceGlowDeep',
    surfaceDeepSoftClassName: 'bg-public-surfaceGlowDeep/35',
    panelClassName: 'bg-public-panelGlow',
    panelDeepClassName: 'bg-public-panelGlowDeep',
    panelRuleClassName: 'bg-public-panelRule',
  },
  text: {
    eyebrowClassName: 'text-public-signal',
    signalClassName: 'text-public-signal',
    headingClassName: 'text-public-heading',
    bodyClassName: 'text-public-body',
    bodyWarmClassName: 'text-public-bodyWarm',
    mutedClassName: 'text-public-mutedBlue',
  },
} as const;

export const DEFAULT_PUBLIC_SURFACE_CLASS_NAME = PUBLIC_SURFACE_CLASSES.defaultBaseClassName;

/**
 * Inputs: optional base/wrapper/content class names, optional style, optional background layer, and children.
 * Output: a reusable public-site surface with an overridable base shell treatment.
 */
export function PublicSurface({
  children,
  className,
  contentClassName,
  baseClassName,
  style,
  background,
  animated = false,
  onLayout,
}: PublicSurfaceProps) {
  const resolvedBaseClassName = baseClassName ?? DEFAULT_PUBLIC_SURFACE_CLASS_NAME;
  const rootClassName = `${resolvedBaseClassName} ${className ?? ''}`;
  const content = (
    <>
      {background}
      <View className={contentClassName}>{children}</View>
    </>
  );

  if (animated) {
    return (
      <Animated.View
        className={rootClassName}
        onLayout={onLayout}
        style={style as Animated.WithAnimatedValue<StyleProp<ViewStyle>>}
      >
        {content}
      </Animated.View>
    );
  }

  return (
    <View className={rootClassName} onLayout={onLayout} style={style as StyleProp<ViewStyle>}>
      {content}
    </View>
  );
}

export default PublicSurface;
