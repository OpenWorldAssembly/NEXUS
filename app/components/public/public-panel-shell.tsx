/**
 * File: public-panel-shell.tsx
 * Description: Lightweight reusable shell for non-hero public cards that need the site's panel language.
 */
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

type PublicPanelShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  style?: StyleProp<ViewStyle>;
  accentOpacity?: number;
};

/**
 * Inputs: child content plus optional styling knobs.
 * Output: a rounded, layered public-site panel with subtle glow and wave accents.
 */
export default function PublicPanelShell({
  children,
  className,
  contentClassName,
  style,
  accentOpacity = 0.2,
}: PublicPanelShellProps) {
  return (
    <View
      className={`overflow-hidden rounded-[30px] border border-[#19395c] bg-[#071224] ${className ?? ''}`}
      style={style}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <View className="absolute inset-0 bg-[#071224]" />
        <View
          style={{
            position: 'absolute',
            top: -64,
            left: -42,
            width: 200,
            height: 200,
            borderRadius: 999,
            backgroundColor: '#163d68',
            opacity: 0.12 + accentOpacity * 0.35,
          }}
        />
        <View
          style={{
            position: 'absolute',
            right: -36,
            bottom: -92,
            width: 240,
            height: 240,
            borderRadius: 999,
            backgroundColor: '#0b2a48',
            opacity: 0.1 + accentOpacity * 0.28,
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 28,
            left: 24,
            right: 24,
            height: 1,
            backgroundColor: `rgba(124, 177, 230, ${0.08 + accentOpacity * 0.28})`,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 36,
            left: 42,
            width: '58%',
            height: 1,
            backgroundColor: `rgba(124, 177, 230, ${0.05 + accentOpacity * 0.18})`,
          }}
        />
      </View>

      <View className={contentClassName}>{children}</View>
    </View>
  );
}
