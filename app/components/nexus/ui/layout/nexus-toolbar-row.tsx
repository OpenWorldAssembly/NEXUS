/**
 * File: nexus-toolbar-row.tsx
 * Description: Shared compact Nexus toolbar/header row.
 */
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { joinClasses } from './nexus-chrome';

export type NexusToolbarRowProps = PropsWithChildren<{
  className?: string;
}>;

export function NexusToolbarRow({ children, className }: NexusToolbarRowProps) {
  return (
    <View
      className={joinClasses(
        'flex-row flex-wrap items-center justify-between gap-3',
        className
      )}
    >
      {children}
    </View>
  );
}
