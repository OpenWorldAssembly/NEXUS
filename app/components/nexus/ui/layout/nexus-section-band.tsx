/**
 * File: nexus-section-band.tsx
 * Description: Shared Nexus section grouping container.
 */
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { joinClasses } from './nexus-chrome';

export type NexusSectionBandProps = PropsWithChildren<{
  className?: string;
}>;

export function NexusSectionBand({ children, className }: NexusSectionBandProps) {
  return <View className={joinClasses('gap-4', className)}>{children}</View>;
}
