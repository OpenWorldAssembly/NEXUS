/**
 * File: normalize_trusted_request.ts
 * Description: Normalizes an interface/API request into a trusted runtime request envelope.
 */

import { randomUUID } from 'node:crypto';

import {
  createTrustedRuntimeCoordinatorResult,
  createTrustedTraceEntry,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import type {
  NormalizeTrustedRequestInput,
  TrustedRuntimeRequest,
} from '../trusted_request_types.ts';

function normalizeOperationKind(input: NormalizeTrustedRequestInput): TrustedRuntimeRequest['operation_kind'] {
  if (input.operation_kind) {
    return input.operation_kind;
  }

  if (input.mutation_intent) {
    return 'mutation_prepare';
  }

  return 'debug_audit';
}

export function normalizeTrustedRequest(
  input: NormalizeTrustedRequestInput
): TrustedRuntimeCoordinatorResult<TrustedRuntimeRequest> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];

  if (!input.source_route || input.source_route.trim().length === 0) {
    issues.push(
      trustedIssue({
        severity: 'error',
        code: 'trusted_request_missing_source_route',
        path: 'source_route',
        message: 'Trusted Request Coordinator requires a source route before handing work to downstream coordinators.',
      })
    );
  }

  if (!input.client_intent_id && !input.mutation_intent && !input.connector_id) {
    issues.push(
      trustedIssue({
        severity: 'warning',
        code: 'trusted_request_unidentified_intent',
        path: 'client_intent_id',
        message: 'Request has no client intent, mutation intent, or connector id. Downstream coordinators may only treat it as a debug/internal request.',
      })
    );
  }

  const request: TrustedRuntimeRequest = {
    request_kind: 'trusted.runtime_request',
    request_id: input.request_id ?? randomUUID(),
    source_kind: input.source_kind,
    source_route: input.source_route,
    operation_kind: normalizeOperationKind(input),
    client_intent_id: input.client_intent_id ?? null,
    mutation_intent: input.mutation_intent ?? null,
    connector_id: input.connector_id ?? null,
    actor_packet_id: input.actor_packet_id ?? null,
    node_packet_id: input.node_packet_id ?? null,
    payload: input.payload ?? null,
    mode: input.mode ?? 'normal_runtime',
    normalized_at: new Date().toISOString(),
  };

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: 'trusted_request_coordinator.v0',
    coordinator_kind: 'request',
    value: issues.some((issue) => issue.severity === 'error') ? null : request,
    issues,
    mode: request.mode,
    request_id: request.request_id,
    trace: [
      createTrustedTraceEntry({
        step_id: 'request.normalize',
        coordinator_id: 'trusted_request_coordinator.v0',
        status: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'partial' : 'ok',
        notes: 'Normalized interface/API input into a trusted runtime request envelope.',
      }),
    ],
  });
}
