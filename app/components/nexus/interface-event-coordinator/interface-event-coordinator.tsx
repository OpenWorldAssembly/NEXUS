/**
 * File: interface-event-coordinator.tsx
 * Description: Client-side Nexus interface event lifecycle coordinator.
 */

import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { useNexusLoading } from '@app/components/nexus/ui';
import {
  validateInterfaceEvent,
} from './interface-event-validation';
import {
  createInterfaceEvent,
  createInterfaceEventHeaders,
  updateInterfaceEventStatus,
} from './interface-event-state';
import type {
  InterfaceEventEnvelope,
  InterfaceEventRunInput,
  InterfaceEventRunResult,
  InterfaceEventStatus,
} from './interface-event-types';

type InterfaceEventCoordinatorContextValue = {
  events: InterfaceEventEnvelope[];
  createEvent: (input: Omit<InterfaceEventRunInput<unknown>, 'dispatch' | 'refresh' | 'validate' | 'preflight' | 'loading' | 'onSuccess' | 'onError'>) => InterfaceEventEnvelope;
  runEvent: <TResult>(input: InterfaceEventRunInput<TResult>) => Promise<InterfaceEventRunResult<TResult>>;
};

const InterfaceEventCoordinatorContext =
  createContext<InterfaceEventCoordinatorContextValue | null>(null);

function getErrorStatus(error: unknown): InterfaceEventRunResult<unknown>['status'] {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 'blocked'
  ) {
    return 'blocked';
  }

  return 'failed';
}

export function InterfaceEventCoordinatorProvider({ children }: PropsWithChildren) {
  const loading = useNexusLoading();
  const [events, setEvents] = useState<InterfaceEventEnvelope[]>([]);

  const rememberEvent = useCallback((event: InterfaceEventEnvelope) => {
    setEvents((currentEvents) => [
      event,
      ...currentEvents.filter((candidate) => candidate.event_id !== event.event_id),
    ].slice(0, 25));
  }, []);

  const createEvent = useCallback(
    (input: Parameters<InterfaceEventCoordinatorContextValue['createEvent']>[0]) => {
      const event = createInterfaceEvent(input);
      rememberEvent(event);
      return event;
    },
    [rememberEvent]
  );

  const runEvent = useCallback(
    async <TResult,>(
      input: InterfaceEventRunInput<TResult>
    ): Promise<InterfaceEventRunResult<TResult>> => {
      let event = createInterfaceEvent({
        source: input.source,
        intent: input.intent,
      });
      const headers = createInterfaceEventHeaders(event);
      const context = () => ({ event, headers });
      const setStatus = (
        status: InterfaceEventStatus,
        extra?: Parameters<typeof updateInterfaceEventStatus>[2]
      ) => {
        event = updateInterfaceEventStatus(event, status, extra);
        rememberEvent(event);
      };

      rememberEvent(event);
      setStatus('validating');

      const validation = validateInterfaceEvent(input.validate);

      if (validation.status === 'invalid') {
        setStatus('failed', { validation });
        setStatus('settled', { validation });
        return {
          status: 'validation_failed',
          event,
          result: null,
          validation,
          preflight: null,
          error: null,
        };
      }

      setStatus('preflighting', { validation });

      if (input.preflight) {
        const preflight = await input.preflight(event);

        if (preflight.status === 'blocked') {
          setStatus('failed', { validation, preflight });
          setStatus('settled', { validation, preflight });
          return {
            status: 'preflight_failed',
            event,
            result: null,
            validation,
            preflight,
            error: null,
          };
        }

        setStatus('dispatching', { validation, preflight });
      } else {
        setStatus('dispatching', { validation });
      }

      const dispatch = async () => {
        try {
          const result = await input.dispatch(context());

          if (input.refresh) {
            setStatus('refreshing');
            await input.refresh(context(), result);
          }

          setStatus('succeeded');
          await input.onSuccess?.(result, event);
          setStatus('settled');

          return {
            status: 'succeeded' as const,
            event,
            result,
            validation,
            preflight: event.preflight,
            error: null,
          };
        } catch (error) {
          setStatus('failed');
          await input.onError?.(error, event);
          setStatus('settled');

          return {
            status: getErrorStatus(error) as InterfaceEventRunResult<TResult>['status'],
            event,
            result: null,
            validation,
            preflight: event.preflight,
            error,
          };
        }
      };

      if (!input.loading) {
        return dispatch();
      }

      return loading.runWithLoading(
        input.loading.scope,
        dispatch,
        {
          ...input.loading.options,
          label: input.loading.label ?? input.loading.options?.label,
        }
      );
    },
    [loading, rememberEvent]
  );

  const value = useMemo<InterfaceEventCoordinatorContextValue>(
    () => ({
      events,
      createEvent,
      runEvent,
    }),
    [createEvent, events, runEvent]
  );

  return (
    <InterfaceEventCoordinatorContext.Provider value={value}>
      {children}
    </InterfaceEventCoordinatorContext.Provider>
  );
}

export function useInterfaceEventCoordinator(): InterfaceEventCoordinatorContextValue {
  const context = useContext(InterfaceEventCoordinatorContext);

  if (!context) {
    throw new Error(
      'useInterfaceEventCoordinator must be used inside InterfaceEventCoordinatorProvider.'
    );
  }

  return context;
}
