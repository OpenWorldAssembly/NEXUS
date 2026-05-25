/**
 * File: nexus-loading-context.tsx
 * Description: Provides scoped loading state for Nexus UI boundaries.
 */
import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type NexusLoadingScope = string;

export type NexusLoadingOptions = {
  label?: string;
  delayMs?: number;
  minVisibleMs?: number;
};

export type NexusLoadingState = {
  isActive: boolean;
  isVisible: boolean;
  operationCount: number;
  label?: string;
};

type NexusLoadingOperation = {
  id: string;
  scope: NexusLoadingScope;
  label?: string;
  minVisibleMs: number;
};

type NexusLoadingContextValue = {
  beginLoading: (
    scope: NexusLoadingScope,
    options?: NexusLoadingOptions
  ) => string;
  endLoading: (operationId: string) => void;
  getLoadingState: (scope: NexusLoadingScope) => NexusLoadingState;
  isLoading: (scope: NexusLoadingScope) => boolean;
  runWithLoading: <TResult>(
    scope: NexusLoadingScope,
    action: () => TResult | Promise<TResult>,
    options?: NexusLoadingOptions
  ) => Promise<TResult>;
};

const DEFAULT_DELAY_MS = 200;
const DEFAULT_MIN_VISIBLE_MS = 300;
const EMPTY_LOADING_STATE: NexusLoadingState = {
  isActive: false,
  isVisible: false,
  operationCount: 0,
};

const NexusLoadingContext = createContext<NexusLoadingContextValue | null>(null);

function createOperationId(): string {
  return `nexus-loading:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function getScopeOperations(
  operations: Map<string, NexusLoadingOperation>,
  scope: NexusLoadingScope
): NexusLoadingOperation[] {
  return [...operations.values()].filter((operation) => operation.scope === scope);
}

function getScopeLabel(operations: NexusLoadingOperation[]): string | undefined {
  return [...operations].reverse().find((operation) => operation.label)?.label;
}

/**
 * Inputs: nested Nexus UI.
 * Output: a provider that tracks visual loading scopes without knowing operation semantics.
 */
export function NexusLoadingProvider({ children }: PropsWithChildren) {
  const operationsRef = useRef(new Map<string, NexusLoadingOperation>());
  const delayTimersRef = useRef(new Map<NexusLoadingScope, ReturnType<typeof setTimeout>>());
  const hideTimersRef = useRef(new Map<NexusLoadingScope, ReturnType<typeof setTimeout>>());
  const visibleSinceRef = useRef(new Map<NexusLoadingScope, number>());
  const minVisibleMsRef = useRef(new Map<NexusLoadingScope, number>());
  const [statesByScope, setStatesByScope] = useState<
    Record<NexusLoadingScope, NexusLoadingState>
  >({});

  const clearDelayTimer = useCallback((scope: NexusLoadingScope) => {
    const delayTimer = delayTimersRef.current.get(scope);

    if (!delayTimer) {
      return;
    }

    clearTimeout(delayTimer);
    delayTimersRef.current.delete(scope);
  }, []);

  const clearHideTimer = useCallback((scope: NexusLoadingScope) => {
    const hideTimer = hideTimersRef.current.get(scope);

    if (!hideTimer) {
      return;
    }

    clearTimeout(hideTimer);
    hideTimersRef.current.delete(scope);
  }, []);

  const updateScopeState = useCallback(
    (
      scope: NexusLoadingScope,
      createState: (currentState: NexusLoadingState | undefined) => NexusLoadingState
    ) => {
      setStatesByScope((currentStates) => {
        const nextState = createState(currentStates[scope]);

        if (!nextState.isActive && !nextState.isVisible) {
          const remainingStates = { ...currentStates };
          delete remainingStates[scope];
          return remainingStates;
        }

        return {
          ...currentStates,
          [scope]: nextState,
        };
      });
    },
    []
  );

  const hideScope = useCallback(
    (scope: NexusLoadingScope) => {
      hideTimersRef.current.delete(scope);
      visibleSinceRef.current.delete(scope);
      minVisibleMsRef.current.delete(scope);
      updateScopeState(scope, () => EMPTY_LOADING_STATE);
    },
    [updateScopeState]
  );

  const beginLoading = useCallback(
    (scope: NexusLoadingScope, options?: NexusLoadingOptions): string => {
      const operationId = createOperationId();
      const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
      const minVisibleMs = options?.minVisibleMs ?? DEFAULT_MIN_VISIBLE_MS;
      const operation: NexusLoadingOperation = {
        id: operationId,
        scope,
        label: options?.label,
        minVisibleMs,
      };

      clearHideTimer(scope);
      operationsRef.current.set(operationId, operation);
      minVisibleMsRef.current.set(
        scope,
        Math.max(minVisibleMsRef.current.get(scope) ?? 0, minVisibleMs)
      );

      const scopeOperations = getScopeOperations(operationsRef.current, scope);

      updateScopeState(scope, (currentState) => ({
        isActive: true,
        isVisible: currentState?.isVisible ?? false,
        operationCount: scopeOperations.length,
        label: getScopeLabel(scopeOperations) ?? currentState?.label,
      }));

      if (!visibleSinceRef.current.has(scope) && !delayTimersRef.current.has(scope)) {
        const delayTimer = setTimeout(() => {
          delayTimersRef.current.delete(scope);

          if (getScopeOperations(operationsRef.current, scope).length === 0) {
            return;
          }

          visibleSinceRef.current.set(scope, Date.now());
          updateScopeState(scope, (currentState) => ({
            isActive: true,
            isVisible: true,
            operationCount: currentState?.operationCount ?? 0,
            label: currentState?.label,
          }));
        }, delayMs);

        delayTimersRef.current.set(scope, delayTimer);
      }

      return operationId;
    },
    [clearHideTimer, updateScopeState]
  );

  const endLoading = useCallback(
    (operationId: string) => {
      const operation = operationsRef.current.get(operationId);

      if (!operation) {
        return;
      }

      operationsRef.current.delete(operationId);

      const scope = operation.scope;
      const scopeOperations = getScopeOperations(operationsRef.current, scope);

      if (scopeOperations.length > 0) {
        updateScopeState(scope, (currentState) => ({
          isActive: true,
          isVisible: currentState?.isVisible ?? false,
          operationCount: scopeOperations.length,
          label: getScopeLabel(scopeOperations) ?? currentState?.label,
        }));
        return;
      }

      clearDelayTimer(scope);

      const visibleSince = visibleSinceRef.current.get(scope);

      if (!visibleSince) {
        minVisibleMsRef.current.delete(scope);
        updateScopeState(scope, () => EMPTY_LOADING_STATE);
        return;
      }

      const minVisibleMs = Math.max(
        minVisibleMsRef.current.get(scope) ?? DEFAULT_MIN_VISIBLE_MS,
        operation.minVisibleMs
      );
      const elapsedVisibleMs = Date.now() - visibleSince;
      const remainingVisibleMs = Math.max(0, minVisibleMs - elapsedVisibleMs);

      updateScopeState(scope, (currentState) => ({
        isActive: false,
        isVisible: currentState?.isVisible ?? true,
        operationCount: 0,
        label: currentState?.label,
      }));

      if (remainingVisibleMs === 0) {
        hideScope(scope);
        return;
      }

      const hideTimer = setTimeout(() => {
        hideScope(scope);
      }, remainingVisibleMs);

      hideTimersRef.current.set(scope, hideTimer);
    },
    [clearDelayTimer, hideScope, updateScopeState]
  );

  const getLoadingState = useCallback(
    (scope: NexusLoadingScope): NexusLoadingState =>
      statesByScope[scope] ?? EMPTY_LOADING_STATE,
    [statesByScope]
  );

  const isLoading = useCallback(
    (scope: NexusLoadingScope): boolean => getLoadingState(scope).isActive,
    [getLoadingState]
  );

  const runWithLoading = useCallback(
    async <TResult,>(
      scope: NexusLoadingScope,
      action: () => TResult | Promise<TResult>,
      options?: NexusLoadingOptions
    ): Promise<TResult> => {
      const operationId = beginLoading(scope, options);

      try {
        return await action();
      } finally {
        endLoading(operationId);
      }
    },
    [beginLoading, endLoading]
  );

  useEffect(
    () => () => {
      for (const timer of delayTimersRef.current.values()) {
        clearTimeout(timer);
      }

      for (const timer of hideTimersRef.current.values()) {
        clearTimeout(timer);
      }
    },
    []
  );

  const value = useMemo<NexusLoadingContextValue>(
    () => ({
      beginLoading,
      endLoading,
      getLoadingState,
      isLoading,
      runWithLoading,
    }),
    [beginLoading, endLoading, getLoadingState, isLoading, runWithLoading]
  );

  return (
    <NexusLoadingContext.Provider value={value}>
      {children}
    </NexusLoadingContext.Provider>
  );
}

/**
 * Inputs: none.
 * Output: the nearest Nexus loading controller.
 */
export function useNexusLoading(): NexusLoadingContextValue {
  const context = useContext(NexusLoadingContext);

  if (!context) {
    throw new Error('useNexusLoading must be used inside NexusLoadingProvider.');
  }

  return context;
}

/**
 * Inputs: none.
 * Output: the nearest Nexus loading controller, when one is available.
 */
export function useOptionalNexusLoading(): NexusLoadingContextValue | null {
  return useContext(NexusLoadingContext);
}
