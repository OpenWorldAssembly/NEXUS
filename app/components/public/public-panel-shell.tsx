/**
 * File: public-panel-shell.tsx
 * Description: Lightweight reusable shell for non-hero public cards that need the site's panel language.
 */
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

import type { PublicAnimationPresetName } from '@app/components/public/animation/public-animation-presets';

import PublicCardFrame from './public-card-frame';
import { PUBLIC_SURFACE_CLASSES } from './public-surface';

type PublicPanelShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  style?: StyleProp<ViewStyle>;
  accentOpacity?: number;
  animationEnabled?: boolean;
  animationPreset?: PublicAnimationPresetName;
};

export function PublicPanelShell({
  children,
  className,
  contentClassName,
  style,
  accentOpacity = 0.2,
  animationEnabled,
  animationPreset,
}: PublicPanelShellProps) {
  return (
    <PublicCardFrame
      animationEnabled={animationEnabled}
      animationPreset={animationPreset}
      variant="panel"
      className={className}
      contentClassName={contentClassName}
      style={style}
      enableDecorativeAccents={false}
      background={
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <View
            className={[
              'absolute rounded-full',
              PUBLIC_SURFACE_CLASSES.glow.panelClassName,
            ].join(' ')}
            style={{
              top: -64,
              left: -42,
              width: 200,
              height: 200,
              borderRadius: 999,
              opacity: 0.12 + accentOpacity * 0.35,
            }}
          />
          <View
            className={[
              'absolute rounded-full',
              PUBLIC_SURFACE_CLASSES.glow.panelDeepClassName,
            ].join(' ')}
            style={{
              right: -36,
              bottom: -92,
              width: 240,
              height: 240,
              borderRadius: 999,
              opacity: 0.1 + accentOpacity * 0.28,
            }}
          />
          <View
            className={[
              'absolute',
              PUBLIC_SURFACE_CLASSES.glow.panelRuleClassName,
            ].join(' ')}
            style={{
              top: 28,
              left: 24,
              right: 24,
              height: 1,
              opacity: 0.08 + accentOpacity * 0.28,
            }}
          />
          <View
            className={[
              'absolute',
              PUBLIC_SURFACE_CLASSES.glow.panelRuleClassName,
            ].join(' ')}
            style={{
              bottom: 36,
              left: 42,
              width: '58%',
              height: 1,
              opacity: 0.05 + accentOpacity * 0.18,
            }}
          />
        </View>
      }
    >
      {children}
    </PublicCardFrame>
  );
}

export default PublicPanelShell;
