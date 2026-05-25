/**
 * File: nexus-stat-card.tsx
 * Description: Renders a compact Nexus metric card for scope totals and overview stats.
 */
import { Text } from 'react-native';

import { NexusCard, useNexusAppearance } from '@app/components/nexus/ui';
import type { NexusCardTone } from '@runtime/nexus/nexus-content';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type NexusStatCardProps = {
  className?: string;
  label: string;
  value: string;
  tone?: NexusCardTone | 'default';
};

/**
 * Inputs: one metric label and value.
 * Output: a compact reusable Nexus stat card.
 */
export function NexusStatCard({
  className,
  label,
  value,
  tone = 'default',
}: NexusStatCardProps) {
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
