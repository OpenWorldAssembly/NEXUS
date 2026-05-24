/**
 * File: nexus-loading-boundary.tsx
 * Description: Defines visual regions that can be blocked by Nexus loading scopes.
 */
import type { PropsWithChildren } from 'react';
import { Pressable, View } from 'react-native';

import { useNexusLoading, type NexusLoadingScope } from './nexus-loading-context';
import { NexusLoadingOverlay } from './nexus-loading-overlay';

type NexusLoadingBoundaryProps = PropsWithChildren<{
  className?: string;
  label?: string;
  scope: NexusLoadingScope;
}>;

function joinClasses(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Inputs: a caller-owned visual loading scope and child UI.
 * Output: a layout-preserving boundary that blocks input immediately and delays visible loading chrome.
 */
export function NexusLoadingBoundary({
  children,
  className,
  label,
  scope,
}: NexusLoadingBoundaryProps) {
  const { getLoadingState } = useNexusLoading();
  const loadingState = getLoadingState(scope);
  const shouldBlockInput = loadingState.isActive || loadingState.isVisible;

  return (
    <View className={joinClasses('relative', className)}>
      {children}
      {shouldBlockInput ? (
        <Pressable
          accessibilityRole="progressbar"
          className="absolute inset-0 z-40"
          disabled={!shouldBlockInput}
          onPress={() => {}}
        />
      ) : null}
      {loadingState.isVisible ? (
        <NexusLoadingOverlay label={loadingState.label ?? label} />
      ) : null}
    </View>
  );
}
