/**
 * File: nexus-search-results-boundary.tsx
 * Description: Loading-aware wrapper for Nexus search result regions.
 */
import type { PropsWithChildren } from 'react';

import {
  NexusLoadingBoundary,
  type NexusLoadingScope,
} from '../../feedback/loading';

export type NexusSearchResultsBoundaryProps = PropsWithChildren<{
  className?: string;
  loadingLabel?: string;
  loadingScope?: NexusLoadingScope;
}>;

export function NexusSearchResultsBoundary({
  children,
  className,
  loadingLabel,
  loadingScope,
}: NexusSearchResultsBoundaryProps) {
  if (!loadingScope) {
    return <>{children}</>;
  }

  return (
    <NexusLoadingBoundary
      className={className}
      label={loadingLabel}
      scope={loadingScope}
    >
      {children}
    </NexusLoadingBoundary>
  );
}
