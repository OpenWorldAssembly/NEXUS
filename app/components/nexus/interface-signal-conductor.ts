/**
 * File: interface-signal-conductor.ts
 * Description: Client-side signal normalizer for Nexus UI actions before runtime request intake.
 */

export type InterfaceSignalSourceKind = 'nexus_surface' | 'packet_card' | 'action_menu' | 'form' | 'debug_panel';

export type InterfaceSignalStatus = 'ready' | 'pending' | 'sent' | 'failed';

export type InterfaceSignal = {
  signal_kind: 'interface.signal';
  signal_id: string;
  source_kind: InterfaceSignalSourceKind;
  source_surface: string;
  client_intent_id: string;
  mutation_intent: string | null;
  connector_id: string | null;
  target_route: string;
  actor_packet_id: string | null;
  payload: unknown;
  status: InterfaceSignalStatus;
  created_at: string;
};

export type CreateInterfaceSignalInput = {
  source_kind: InterfaceSignalSourceKind;
  source_surface: string;
  client_intent_id: string;
  target_route: string;
  mutation_intent?: string | null;
  connector_id?: string | null;
  actor_packet_id?: string | null;
  payload?: unknown;
  signal_id?: string | null;
  created_at?: string | null;
};

function createClientSignalId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `interface.signal.${Date.now().toString(36)}.${randomPart}`;
}

export function createInterfaceSignal(input: CreateInterfaceSignalInput): InterfaceSignal {
  return {
    signal_kind: 'interface.signal',
    signal_id: input.signal_id ?? createClientSignalId(),
    source_kind: input.source_kind,
    source_surface: input.source_surface,
    client_intent_id: input.client_intent_id,
    mutation_intent: input.mutation_intent ?? null,
    connector_id: input.connector_id ?? null,
    target_route: input.target_route,
    actor_packet_id: input.actor_packet_id ?? null,
    payload: input.payload ?? null,
    status: 'ready',
    created_at: input.created_at ?? new Date().toISOString(),
  };
}

export function markInterfaceSignalStatus(
  signal: InterfaceSignal,
  status: InterfaceSignalStatus
): InterfaceSignal {
  return {
    ...signal,
    status,
  };
}

export const interfaceSignalConductor = {
  id: 'interface_signal_conductor.v0',
  createSignal: createInterfaceSignal,
  markStatus: markInterfaceSignalStatus,
};
