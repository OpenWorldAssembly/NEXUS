/**
 * File: nexus-field-action-row.tsx
 * Description: Shared Nexus action row for form controls.
 */
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

export type NexusFieldActionRowProps = PropsWithChildren<{
  className?: string;
}>;

function joinClasses(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function NexusFieldActionRow({
  children,
  className,
}: NexusFieldActionRowProps) {
  return (
    <View className={joinClasses('flex-row flex-wrap gap-3', className)}>
      {children}
    </View>
  );
}
