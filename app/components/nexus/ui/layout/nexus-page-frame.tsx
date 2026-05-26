/**
 * File: nexus-page-frame.tsx
 * Description: Shared Nexus page gutter and content frame.
 */
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { joinClasses, useNexusAppearance } from './nexus-chrome';

export type NexusPageFrameProps = PropsWithChildren<{
  className?: string;
}>;

export function NexusPageFrame({ children, className }: NexusPageFrameProps) {
  const appearance = useNexusAppearance();

  return (
    <View className={joinClasses(appearance.pageContainerClass, className)}>
      {children}
    </View>
  );
}
