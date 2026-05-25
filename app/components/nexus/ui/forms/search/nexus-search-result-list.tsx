/**
 * File: nexus-search-result-list.tsx
 * Description: Shared Nexus containers for search result lists and dropdowns.
 */
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

export type NexusSearchResultListProps = PropsWithChildren<{
  attached?: boolean;
  className?: string;
}>;

function joinClasses(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function NexusSearchResultList({
  attached = false,
  children,
  className,
}: NexusSearchResultListProps) {
  return (
    <View
      className={joinClasses(
        attached
          ? 'overflow-hidden rounded-b-[18px] border border-t-0 border-nexus-line/70 bg-white/[0.03]'
          : 'gap-2',
        className
      )}
    >
      {children}
    </View>
  );
}
