/**
 * File: nexus-action-list.tsx
 * Description: Renders compact connected Nexus action-list rows for dashboard previews.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type NexusActionListProps = {
  children?: ReactNode;
  className?: string;
};

/**
 * Inputs: compact action-list rows.
 * Output: one connected Nexus list surface with row dividers instead of separate cards.
 */
export function NexusActionList({ children, className }: NexusActionListProps) {
  const { themeMode } = useNexusShell();

  return (
    <View
      className={joinClasses(
        'overflow-visible rounded-nexus border',
        themeMode === 'dark'
          ? 'border-nexus-line/70 bg-white/[0.03]'
          : 'border-slate-300 bg-white',
        className,
      )}
    >
      {children}
    </View>
  );
}
