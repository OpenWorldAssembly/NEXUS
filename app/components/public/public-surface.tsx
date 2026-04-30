/**
 * File: public-surface.tsx
 * Description: Base public-site surface primitive for reusable card and panel shells.
 */
import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

type PublicSurfaceProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  baseClassName?: string;
  style?: StyleProp<ViewStyle>;
  background?: ReactNode;
};

const DEFAULT_PUBLIC_SURFACE_CLASS_NAME =
  'overflow-hidden rounded-[30px] border border-[#19395c] bg-[#071224]';

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
}: PublicSurfaceProps) {
  const resolvedBaseClassName = baseClassName ?? DEFAULT_PUBLIC_SURFACE_CLASS_NAME;

  return (
    <View className={`${resolvedBaseClassName} ${className ?? ''}`} style={style}>
      {background}
      <View className={contentClassName}>{children}</View>
    </View>
  );
}

export default PublicSurface;
