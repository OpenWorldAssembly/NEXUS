/**
 * File: nexus-field-shell.tsx
 * Description: Shared Nexus label, hint, error, and action-slot shell for form controls.
 */
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useNexusAppearance } from '../layout';

export type NexusFieldShellProps = {
  actionSlot?: ReactNode;
  children: ReactNode;
  containerClassName?: string;
  error?: ReactNode;
  hint?: ReactNode;
  label?: ReactNode;
};

function joinClasses(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function NexusFieldShell({
  actionSlot,
  children,
  containerClassName,
  error,
  hint,
  label,
}: NexusFieldShellProps) {
  const appearance = useNexusAppearance();

  return (
    <View className={joinClasses('gap-2', containerClassName)}>
      {label ? (
        typeof label === 'string' ? (
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            {label}
          </Text>
        ) : (
          label
        )
      ) : null}
      {children}
      {actionSlot}
      {hint ? (
        typeof hint === 'string' ? (
          <Text className={appearance.itemMetaClass}>{hint}</Text>
        ) : (
          hint
        )
      ) : null}
      {error ? (
        typeof error === 'string' ? (
          <Text className="text-sm text-nexus-rose">{error}</Text>
        ) : (
          error
        )
      ) : null}
    </View>
  );
}
