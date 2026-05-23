/**
 * File: public-surface.tsx
 * Description: Base public-site surface primitive for reusable cards and panels.
 */
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

type PublicSurfaceStyle =
  | StyleProp<ViewStyle>
  | Animated.WithAnimatedValue<StyleProp<ViewStyle>>;

export type PublicSurfaceVariant = 'default' | 'standardCard' | 'panel';

export type PublicSurfaceBackgroundFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

export type PublicSurfaceBackgroundPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top left'
  | 'top right'
  | 'bottom left'
  | 'bottom right'
  | { left?: number | `${number}%`; top?: number | `${number}%` };

export type PublicSurfaceProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  baseClassName?: string;
  variant?: PublicSurfaceVariant;
  style?: PublicSurfaceStyle;
  background?: ReactNode;
  backgroundImageUri?: string;
  backgroundImageOpacity?: number;
  backgroundImagePosition?: PublicSurfaceBackgroundPosition;
  backgroundImageResizeMode?: PublicSurfaceBackgroundFit;
  animated?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
};

export const PUBLIC_SURFACE_CLASSES = {
  baseClassName: 'overflow-hidden border',
  defaultBaseClassName: 'overflow-hidden rounded-[30px] border border-public-surfaceBorderSoft bg-public-surfaceBase',
  standardCardBaseClassName: 'overflow-hidden rounded-[28px] border border-public-surfaceBorder bg-public-surface',
  panelBaseClassName: 'overflow-hidden rounded-[30px] border border-public-surfaceBorderSoft bg-public-surfaceBase',
  variantBaseClassName: {
    default: 'overflow-hidden rounded-[30px] border border-public-surfaceBorderSoft bg-public-surfaceBase',
    standardCard: 'overflow-hidden rounded-[28px] border border-public-surfaceBorder bg-public-surface',
    panel: 'overflow-hidden rounded-[30px] border border-public-surfaceBorderSoft bg-public-surfaceBase',
  },
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
  card: {
    standardRootClassName: 'overflow-hidden rounded-[28px] border border-public-surfaceBorder bg-public-surface',
    contentTileClassName: 'min-w-[220px] flex-1 p-5',
    decorativeGlowClassName: 'bg-white/10',
    decorativeSheenClassName: 'bg-white/15',
  },
  cardFrame: {
    contentBaseClassName: 'relative z-10',
    defaultAccentClassName: 'bg-public-panelRule',
    softGlowClassName: 'bg-public-surfaceGlow/35',
    deepGlowClassName: 'bg-public-surfaceGlowDeep/30',
    sheenClassName: 'bg-white/10',
    defaultClassName: '',
    decoratedClassName: '',
    interactiveClassName: '',
    backgroundClassName: 'bg-public-surface',
    compactClassName: '',
    panelClassName: '',
  },
  navigation: {
    topbarShellClassName: 'border-b border-public-surfaceBorderSoft bg-public-surfaceBase/95',
    railShellClassName: 'px-3 pb-[14px] pt-[14px]',
    itemPlateClassName: 'border border-public-surfaceRule bg-public-surfaceBase/70',
  },
  homeRail: {
    dotClassName: 'bg-public-heading',
  },
  action: {
    solidRootClassName: 'rounded-full bg-public-accent px-6 py-3',
    outlineRootClassName: 'rounded-full border border-public-surfaceRule bg-public-surfaceBase/70 px-6 py-3',
    solidTextClassName: 'text-sm font-extrabold uppercase tracking-[0.18em] text-public-canvas',
    outlineTextClassName: 'text-sm font-bold uppercase tracking-[0.18em] text-public-heading',
  },
} as const;

export const DEFAULT_PUBLIC_SURFACE_CLASS_NAME = PUBLIC_SURFACE_CLASSES.defaultBaseClassName;

export const PUBLIC_SURFACE_STYLE_VALUES = {
  sectionDefinitionColor: '#07121d',
} as const;

const styles = StyleSheet.create({
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
    width: '100%',
  },
});

function getPublicSurfaceBaseClassName(
  variant: PublicSurfaceVariant,
  baseClassName?: string,
) {
  return baseClassName ?? PUBLIC_SURFACE_CLASSES.variantBaseClassName[variant];
}

function getBackgroundImagePosition(position: PublicSurfaceBackgroundPosition) {
  if (position === 'top left') {
    return { left: 0, top: 0 };
  }

  if (position === 'top right') {
    return { left: '100%', top: 0 };
  }

  if (position === 'bottom left') {
    return { left: 0, top: '100%' };
  }

  if (position === 'bottom right') {
    return { left: '100%', top: '100%' };
  }

  return position;
}

/**
 * Inputs: optional base/wrapper/content class names, optional style, optional background layer, and children.
 * Output: a reusable public-site surface with an overridable base shell treatment.
 */
export function PublicSurface({
  children,
  className,
  contentClassName,
  baseClassName,
  variant = 'default',
  style,
  background,
  backgroundImageUri,
  backgroundImageOpacity = 1,
  backgroundImagePosition = 'center',
  backgroundImageResizeMode = 'cover',
  animated = false,
  onLayout,
}: PublicSurfaceProps) {
  const resolvedBaseClassName = getPublicSurfaceBaseClassName(variant, baseClassName);
  const rootClassName = `${resolvedBaseClassName} ${className ?? ''}`;
  const renderedChildren = contentClassName ? (
    <View className={contentClassName}>{children}</View>
  ) : (
    children
  );
  const content = (
    <>
      {backgroundImageUri ? (
        <Image
          pointerEvents="none"
          source={{ uri: backgroundImageUri }}
          contentFit={backgroundImageResizeMode}
          contentPosition={getBackgroundImagePosition(backgroundImagePosition) as never}
          style={[styles.backgroundImage, { opacity: backgroundImageOpacity }]}
        />
      ) : null}
      {background}
      {renderedChildren}
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
