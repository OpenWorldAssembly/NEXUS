/**
 * File: nexus-scroll-frame.tsx
 * Description: Shared Nexus route scroll container.
 */
import type { ComponentProps, PropsWithChildren } from 'react';
import { ScrollView } from 'react-native';

import { joinClasses } from './nexus-chrome';

export type NexusScrollFrameProps = PropsWithChildren<
  Omit<ComponentProps<typeof ScrollView>, 'className'>
> & {
  className?: string;
};

export function NexusScrollFrame({
  children,
  className,
  showsVerticalScrollIndicator = false,
  ...scrollViewProps
}: NexusScrollFrameProps) {
  return (
    <ScrollView
      className={joinClasses('flex-1', className)}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  );
}
