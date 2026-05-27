/**
 * File: interface-event-types.ts
 * Description: Shared client-side event lifecycle types for Nexus interface orchestration.
 */

import type { NexusLoadingOptions, NexusLoadingScope } from '@app/components/nexus/ui';

export type InterfaceEventSourceKind =
  | 'nexus_surface'
  | 'packet_card'
  | 'action_menu'
  | 'form'
  | 'debug_panel';

export type InterfaceEventStatus =
  | 'created'
  | 'validating'
  | 'preflighting'
  | 'dispatching'
  | 'refreshing'
  | 'succeeded'
  | 'failed'
  | 'settled';

export type InterfaceEventResultStatus =
  | 'succeeded'
  | 'failed'
  | 'blocked'
  | 'validation_failed'
  | 'preflight_failed';

export type InterfaceEventValidationIssue = {
  field: string;
  code: string;
  message: string;
};

export type InterfaceEventValidationResult = {
  status: 'valid' | 'invalid';
  issues: InterfaceEventValidationIssue[];
};

export type InterfaceEventPreflightResult = {
  status: 'allowed' | 'blocked';
  reason_codes: string[];
  notes: string[];
};

export type InterfaceEventEnvelope = {
  event_kind: 'interface.event';
  event_id: string;
  source_kind: InterfaceEventSourceKind;
  source_surface: string;
  client_intent_id: string;
  mutation_intent: string | null;
  connector_id: string | null;
  target_route: string;
  actor_packet_id: string | null;
  payload: unknown;
  status: InterfaceEventStatus;
  validation: InterfaceEventValidationResult | null;
  preflight: InterfaceEventPreflightResult | null;
  created_at: string;
  updated_at: string;
  settled_at: string | null;
};

export type InterfaceEventHeaders = Record<string, string>;

export type InterfaceEventDispatchContext = {
  event: InterfaceEventEnvelope;
  headers: InterfaceEventHeaders;
};

export type InterfaceEventSourceInput = {
  kind: InterfaceEventSourceKind;
  surface: string;
};

export type InterfaceEventIntentInput = {
  clientIntentId: string;
  targetRoute: string;
  mutationIntent?: string | null;
  connectorId?: string | null;
  actorPacketId?: string | null;
  payload?: unknown;
};

export type InterfaceEventLoadingInput = {
  scope: NexusLoadingScope;
  label?: string;
  options?: NexusLoadingOptions;
};

export type InterfaceEventRunInput<TResult> = {
  source: InterfaceEventSourceInput;
  intent: InterfaceEventIntentInput;
  loading?: InterfaceEventLoadingInput | null;
  validate?: InterfaceEventValidator[];
  preflight?: (event: InterfaceEventEnvelope) => InterfaceEventPreflightResult | Promise<InterfaceEventPreflightResult>;
  dispatch: (context: InterfaceEventDispatchContext) => TResult | Promise<TResult>;
  refresh?: (context: InterfaceEventDispatchContext, result: TResult) => void | Promise<void>;
  onSuccess?: (result: TResult, event: InterfaceEventEnvelope) => void | Promise<void>;
  onError?: (error: unknown, event: InterfaceEventEnvelope) => void | Promise<void>;
};

export type InterfaceEventRunResult<TResult> = {
  status: InterfaceEventResultStatus;
  event: InterfaceEventEnvelope;
  result: TResult | null;
  validation: InterfaceEventValidationResult | null;
  preflight: InterfaceEventPreflightResult | null;
  error: unknown | null;
};

export type InterfaceEventValidator = () => InterfaceEventValidationIssue | null;
