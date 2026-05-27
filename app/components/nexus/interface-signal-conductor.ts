/**
 * File: interface-signal-conductor.ts
 * Description: Compatibility bridge for the renamed Nexus Interface Event Coordinator.
 */

import {
  createInterfaceEvent,
  updateInterfaceEventStatus,
  type InterfaceEventEnvelope,
  type InterfaceEventSourceKind,
  type InterfaceEventStatus,
} from './interface-event-coordinator';

export type InterfaceSignalSourceKind = InterfaceEventSourceKind;
export type InterfaceSignalStatus = InterfaceEventStatus;
export type InterfaceSignal = InterfaceEventEnvelope;

export type CreateInterfaceSignalInput = {
  source_kind: InterfaceSignalSourceKind;
  source_surface: string;
  client_intent_id: string;
  target_route: string;
  mutation_intent?: string | null;
  connector_id?: string | null;
  actor_packet_id?: string | null;
  payload?: unknown;
};

export function createInterfaceSignal(input: CreateInterfaceSignalInput): InterfaceSignal {
  return createInterfaceEvent({
    source: {
      kind: input.source_kind,
      surface: input.source_surface,
    },
    intent: {
      clientIntentId: input.client_intent_id,
      targetRoute: input.target_route,
      mutationIntent: input.mutation_intent,
      connectorId: input.connector_id,
      actorPacketId: input.actor_packet_id,
      payload: input.payload,
    },
  });
}

export function markInterfaceSignalStatus(
  signal: InterfaceSignal,
  status: InterfaceSignalStatus
): InterfaceSignal {
  return updateInterfaceEventStatus(signal, status);
}

export {
  InterfaceEventCoordinatorProvider,
  useInterfaceEventCoordinator,
} from './interface-event-coordinator';
export type {
  InterfaceEventEnvelope,
  InterfaceEventResultStatus,
  InterfaceEventRunInput,
  InterfaceEventRunResult,
  InterfaceEventSourceKind,
  InterfaceEventStatus,
  InterfaceEventValidationIssue,
  InterfaceEventValidationResult,
} from './interface-event-coordinator';

export const interfaceSignalConductor = {
  id: 'interface_event_coordinator.v0',
  createSignal: createInterfaceSignal,
  markStatus: markInterfaceSignalStatus,
};
