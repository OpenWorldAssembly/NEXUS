/**
 * File: interface-event-state.ts
 * Description: Pure state helpers for Nexus interface events.
 */

import type {
  InterfaceEventEnvelope,
  InterfaceEventHeaders,
  InterfaceEventRunInput,
  InterfaceEventStatus,
} from './interface-event-types';

function createInterfaceEventId(): string {
  return `interface.event.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createInterfaceEvent(input: {
  source: InterfaceEventRunInput<unknown>['source'];
  intent: InterfaceEventRunInput<unknown>['intent'];
}): InterfaceEventEnvelope {
  const timestamp = nowIso();

  return {
    event_kind: 'interface.event',
    event_id: createInterfaceEventId(),
    source_kind: input.source.kind,
    source_surface: input.source.surface,
    client_intent_id: input.intent.clientIntentId,
    mutation_intent: input.intent.mutationIntent ?? null,
    connector_id: input.intent.connectorId ?? null,
    target_route: input.intent.targetRoute,
    actor_packet_id: input.intent.actorPacketId ?? null,
    payload: input.intent.payload ?? null,
    status: 'created',
    validation: null,
    preflight: null,
    created_at: timestamp,
    updated_at: timestamp,
    settled_at: null,
  };
}

export function createInterfaceEventHeaders(
  event: InterfaceEventEnvelope
): InterfaceEventHeaders {
  return {
    'x-nexus-interface-event-id': event.event_id,
    'x-nexus-interface-event-source-kind': event.source_kind,
    'x-nexus-interface-event-source-surface': event.source_surface,
    'x-nexus-interface-event-client-intent-id': event.client_intent_id,
  };
}

export function updateInterfaceEventStatus(
  event: InterfaceEventEnvelope,
  status: InterfaceEventStatus,
  extra?: Partial<Pick<InterfaceEventEnvelope, 'validation' | 'preflight'>>
): InterfaceEventEnvelope {
  return {
    ...event,
    ...extra,
    status,
    updated_at: nowIso(),
    settled_at: status === 'settled' ? nowIso() : event.settled_at,
  };
}
