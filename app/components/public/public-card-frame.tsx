/**
 * File: public-card-frame.tsx
 * Description: Shared public-site card frame that standardizes graphic treatment while leaving content layout to callers.
 */
import { useMemo, type ReactNode } from 'react';
import { Animated, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

import {
  PUBLIC_CARD_ANIMATION_DEFAULTS,
  type PublicAnimationPresetName,
} from '@app/components/public/animation/public-animation-presets';
import {
  buildPublicBackgroundImageUri,
  type PublicBackgroundMotif,
  type PublicBackgroundPalette,
  type PublicBackgroundVariant,
} from '@app/public/public-graphics';
import PublicAnimatedSurface from './public-animated-surface';
import {
  PUBLIC_SURFACE_CLASSES,
  type PublicSurfaceBackgroundFit,
  type PublicSurfaceBackgroundPosition,
  type PublicSurfaceVariant,
} from './public-surface';

export type PublicCardFrameVariant =
  | 'default'
  | 'decorated'
  | 'interactive'
  | 'background'
  | 'compact'
  | 'panel';

export type PublicCardFrameBackgroundPreset = 'ambient' | 'none';

export type PublicCardFrameProps = {
  children: ReactNode;
  variant?: PublicCardFrameVariant;
  className?: string;
  contentClassName?: string;
  baseClassName?: string;
  layoutClassName?: string;
  layoutStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle> | Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  background?: ReactNode;
  backgroundImageUri?: string;
  backgroundImageOpacity?: number;
  backgroundImagePosition?: PublicSurfaceBackgroundPosition;
  backgroundImageResizeMode?: PublicSurfaceBackgroundFit;
  backgroundMotif?: PublicBackgroundMotif;
  backgroundPalette?: Partial<PublicBackgroundPalette>;
  backgroundPreset?: PublicCardFrameBackgroundPreset;
  backgroundVariant?: PublicBackgroundVariant;
  animationEnabled?: boolean;
  animationPreset?: PublicAnimationPresetName;
  focusLineRatio?: number;
  layoutOffsetY?: number;
  scrollY?: Animated.Value;
  surfaceAnimated?: boolean;
  viewportHeight?: number;
  enableDecorativeAccents?: boolean;
  enableSheen?: boolean;
};

function mergeClassNames(...classNames: Array<string | undefined | false>) {
  return classNames.filter(Boolean).join(' ');
}

function getSurfaceVariant(variant: PublicCardFrameVariant): PublicSurfaceVariant {
  return variant === 'panel' ? 'panel' : 'standardCard';
}

function getVariantClassName(variant: PublicCardFrameVariant) {
  switch (variant) {
    case 'decorated':
      return PUBLIC_SURFACE_CLASSES.cardFrame.decoratedClassName;
    case 'interactive':
      return PUBLIC_SURFACE_CLASSES.cardFrame.interactiveClassName;
    case 'background':
      return PUBLIC_SURFACE_CLASSES.cardFrame.backgroundClassName;
    case 'compact':
      return PUBLIC_SURFACE_CLASSES.cardFrame.compactClassName;
    case 'panel':
      return PUBLIC_SURFACE_CLASSES.cardFrame.panelClassName;
    case 'default':
    default:
      return PUBLIC_SURFACE_CLASSES.cardFrame.defaultClassName;
  }
}

function getDefaultBackgroundPreset(variant: PublicCardFrameVariant): PublicCardFrameBackgroundPreset {
  return variant === 'background' || variant === 'compact' ? 'none' : 'ambient';
}

function getDefaultBackgroundVariant(variant: PublicCardFrameVariant): PublicBackgroundVariant {
  return variant === 'panel' ? 'panel' : 'card';
}

function shouldRenderGlowLayers(variant: PublicCardFrameVariant, enableDecorativeAccents: boolean) {
  return enableDecorativeAccents && variant !== 'background' && variant !== 'compact' && variant !== 'panel';
}

function shouldRenderBottomRule(variant: PublicCardFrameVariant, enableDecorativeAccents: boolean) {
  return enableDecorativeAccents && (variant === 'decorated' || variant === 'interactive');
}

function shouldRenderSheen(
  variant: PublicCardFrameVariant,
  enableDecorativeAccents: boolean,
  enableSheen?: boolean,
) {
  return enableDecorativeAccents && (enableSheen ?? variant === 'interactive');
}

/**
 * Inputs: optional frame variant, background art, animation settings, and caller-owned content.
 * Output: a reusable public card graphic frame that leaves internal layout untouched.
 */
export default function PublicCardFrame({
  children,
  variant = 'default',
  className,
  contentClassName,
  baseClassName,
  layoutClassName,
  layoutStyle,
  style,
  background,
  backgroundImageUri,
  backgroundImageOpacity,
  backgroundImagePosition,
  backgroundImageResizeMode,
  backgroundMotif = 'none',
  backgroundPalette,
  backgroundPreset,
  backgroundVariant,
  animationEnabled = PUBLIC_CARD_ANIMATION_DEFAULTS.enabled,
  animationPreset = PUBLIC_CARD_ANIMATION_DEFAULTS.preset,
  focusLineRatio,
  layoutOffsetY,
  scrollY,
  surfaceAnimated = false,
  viewportHeight,
  enableDecorativeAccents = true,
  enableSheen,
}: PublicCardFrameProps) {
  const renderGlows = shouldRenderGlowLayers(variant, enableDecorativeAccents);
  const renderBottomRule = shouldRenderBottomRule(variant, enableDecorativeAccents);
  const renderSheen = shouldRenderSheen(variant, enableDecorativeAccents, enableSheen);
  const resolvedBackgroundPreset = backgroundPreset ?? getDefaultBackgroundPreset(variant);
  const generatedBackgroundImageUri = useMemo(() => {
    if (backgroundImageUri || resolvedBackgroundPreset !== 'ambient') {
      return undefined;
    }

    return buildPublicBackgroundImageUri({
      variant: backgroundVariant ?? getDefaultBackgroundVariant(variant),
      motif: backgroundMotif,
      palette: backgroundPalette,
    });
  }, [
    backgroundImageUri,
    backgroundMotif,
    backgroundPalette,
    backgroundVariant,
    resolvedBackgroundPreset,
    variant,
  ]);
  const resolvedBackgroundImageUri = backgroundImageUri ?? generatedBackgroundImageUri;

  const frameBackground = (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {background}
      {renderGlows ? (
        <>
          <View
            className={mergeClassNames(
              'absolute -left-12 -top-12 h-40 w-40 rounded-full',
              PUBLIC_SURFACE_CLASSES.cardFrame.softGlowClassName,
            )}
            style={styles.softGlow}
          />
          <View
            className={mergeClassNames(
              'absolute -bottom-14 right-[-10%] h-44 w-44 rounded-full',
              PUBLIC_SURFACE_CLASSES.cardFrame.deepGlowClassName,
            )}
            style={styles.deepGlow}
          />
        </>
      ) : null}
      {enableDecorativeAccents ? (
        <View
          className={mergeClassNames(
            'absolute left-6 right-6 top-4 h-px',
            PUBLIC_SURFACE_CLASSES.cardFrame.defaultAccentClassName,
          )}
          style={styles.topRule}
        />
      ) : null}
      {renderBottomRule ? (
        <View
          className={mergeClassNames(
            'absolute bottom-4 left-6 h-px w-[58%]',
            PUBLIC_SURFACE_CLASSES.cardFrame.defaultAccentClassName,
          )}
          style={styles.bottomRule}
        />
      ) : null}
      {renderSheen ? (
        <View
          className={mergeClassNames(
            'absolute',
            PUBLIC_SURFACE_CLASSES.cardFrame.sheenClassName,
          )}
          style={styles.sheen}
        />
      ) : null}
    </View>
  );

  return (
    <PublicAnimatedSurface
      animationEnabled={animationEnabled}
      animationPreset={animationPreset}
      background={frameBackground}
      backgroundImageOpacity={backgroundImageOpacity}
      backgroundImagePosition={backgroundImagePosition}
      backgroundImageResizeMode={backgroundImageResizeMode}
      backgroundImageUri={resolvedBackgroundImageUri}
      baseClassName={baseClassName}
      className={mergeClassNames(getVariantClassName(variant), className)}
      contentClassName={mergeClassNames(
        PUBLIC_SURFACE_CLASSES.cardFrame.contentBaseClassName,
        contentClassName,
      )}
      focusLineRatio={focusLineRatio}
      layoutClassName={layoutClassName}
      layoutOffsetY={layoutOffsetY}
      layoutStyle={layoutStyle}
      scrollY={scrollY}
      style={style}
      surfaceAnimated={surfaceAnimated}
      variant={getSurfaceVariant(variant)}
      viewportHeight={viewportHeight}
    >
      {children}
    </PublicAnimatedSurface>
  );
}

const styles = StyleSheet.create({
  bottomRule: {
    opacity: 0.14,
  },
  deepGlow: {
    opacity: 0.12,
  },
  sheen: {
    top: -48,
    bottom: -48,
    width: 96,
    borderRadius: 999,
    opacity: 0.045,
    right: 28,
    transform: [{ rotate: '-18deg' }],
  },
  softGlow: {
    opacity: 0.16,
  },
  topRule: {
    opacity: 0.2,
  },
});
