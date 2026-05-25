/**
 * File: nexus-search-states.tsx
 * Description: Shared status, empty, and error states for Nexus search surfaces.
 */
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { NexusCard } from '../../cards';
import { useNexusAppearance } from '../../layout';

export function NexusSearchStatusText({ children }: { children: ReactNode }) {
  const appearance = useNexusAppearance();

  return <Text className={appearance.itemMetaClass}>{children}</Text>;
}

export function NexusSearchEmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard className={className}>
      <Text className={appearance.itemBodyClass}>{children}</Text>
    </NexusCard>
  );
}

export function NexusSearchErrorState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard className={className} tone="rose">
      <Text className={appearance.itemBodyClass}>{children}</Text>
    </NexusCard>
  );
}
