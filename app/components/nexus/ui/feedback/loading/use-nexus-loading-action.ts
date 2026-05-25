/**
 * File: use-nexus-loading-action.ts
 * Description: Provides an ergonomic hook for running handlers through a Nexus loading scope.
 */
import { useCallback } from 'react';

import {
  useNexusLoading,
  type NexusLoadingOptions,
  type NexusLoadingScope,
} from './nexus-loading-context';

/**
 * Inputs: a visual loading scope, an action, and optional timing/label options.
 * Output: a stable async handler that activates the scope while the action runs.
 */
export function useNexusLoadingAction<TResult>(
  scope: NexusLoadingScope,
  action: () => TResult | Promise<TResult>,
  options?: NexusLoadingOptions
): () => Promise<TResult> {
  const { runWithLoading } = useNexusLoading();

  return useCallback(
    () => runWithLoading(scope, action, options),
    [action, options, runWithLoading, scope]
  );
}
