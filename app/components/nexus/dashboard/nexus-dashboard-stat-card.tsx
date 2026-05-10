/**
 * File: nexus-dashboard-stat-card.tsx
 * Description: Renders compact scope-total dashboard metric cards.
 */
import { Text } from 'react-native';

import { NexusCard, useNexusAppearance } from '@app/components/nexus/nexus-ui';
import type { NexusCardTone } from '@runtime/nexus/nexus-content';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type NexusDashboardStatCardProps = {
  className?: string;
  label: string;
  value: string;
  tone?: NexusCardTone | 'default';
};

/**
 * Inputs: one aggregate metric label and value.
 * Output: a compact Nexus dashboard stat card.
 */
export function NexusDashboardStatCard({
  className,
  label,
  value,
  tone = 'default',
}: NexusDashboardStatCardProps) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard
      className={joinClasses('min-w-[118px] flex-1 basis-[118px] gap-1 px-3 py-2.5', className)}
      compact
      tone={tone}
    >
      <Text className={appearance.metricLabelClass} numberOfLines={1}>
        {label}
      </Text>
      <Text className={appearance.metricValueClass}>{value}</Text>
    </NexusCard>
  );
}
