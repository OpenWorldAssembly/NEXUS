/**
 * File: nexus-metric-grid.tsx
 * Description: Shared Nexus wrapping grid for metric cards.
 */
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { joinClasses } from './nexus-chrome';

export type NexusMetricGridProps = PropsWithChildren<{
  className?: string;
}>;

export function NexusMetricGrid({ children, className }: NexusMetricGridProps) {
  return <View className={joinClasses('flex-row flex-wrap gap-4', className)}>{children}</View>;
}
