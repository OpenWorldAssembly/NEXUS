/**
 * File: preflight_trusted_client_intent.ts
 * Description: Runs client/API ingress preflight through the trusted request boundary.
 */

import {
  resolvePacketClientIntentPreflight,
} from '@runtime/nexus/server/packet-client-intent-enrollment';
import {
  createTrustedRuntimeCoordinatorResult,
  createTrustedTraceEntry,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import type {
  PreflightTrustedClientIntentInput,
  TrustedRequestPreflight,
} from '../trusted_request_types.ts';

export function preflightTrustedClientIntent(
  input: PreflightTrustedClientIntentInput
): TrustedRuntimeCoordinatorResult<TrustedRequestPreflight> {
  const preflight = resolvePacketClientIntentPreflight({
    sourceRoute: input.sourceRoute,
    mutationIntent: input.mutationIntent,
    connectorId: input.connectorId,
    clientIntentId: input.clientIntentId,
  });
  const issues: TrustedRuntimeCoordinatorIssue[] = preflight.status === 'blocked'
    ? preflight.reason_codes.map((code) => trustedIssue({
        severity: 'error',
        code,
        path: 'client_intent',
        message: preflight.notes.join(' ') || 'Client/API intent preflight was blocked.',
      }))
    : [];

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: 'trusted_request_coordinator.v0',
    coordinator_kind: 'request',
    value: {
      ...preflight,
      request_id: input.requestId ?? null,
    },
    issues,
    mode: input.mode ?? 'normal_runtime',
    request_id: input.requestId ?? null,
    trace: [
      createTrustedTraceEntry({
        step_id: 'request.preflight_client_intent',
        coordinator_id: 'trusted_request_coordinator.v0',
        status: preflight.status === 'blocked' ? 'blocked' : 'ok',
        notes: `Client/API intent preflight resolved as ${preflight.status}.`,
      }),
    ],
  });
}
