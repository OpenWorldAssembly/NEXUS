/**
 * File: resolve_trusted_write_policy_gate.ts
 * Description: Resolves live write-policy gate decisions for trusted regulation without assuming packet creation.
 */

import { resolveWritePolicyForActions } from '@core/auth/write-policy.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { regulationTrace } from '../trusted_regulation_internal.ts';
import {
  TRUSTED_REGULATION_COORDINATOR_ID,
  type ResolveTrustedWritePolicyGateInput,
  type TrustedWritePolicyGate,
} from '../trusted_regulation_types.ts';

export function resolveTrustedWritePolicyGate(
  input: ResolveTrustedWritePolicyGateInput
): TrustedRuntimeCoordinatorResult<TrustedWritePolicyGate> {
  const operationKind = input.operation_kind ?? 'write_gate';
  const actionIds = [...input.action_ids];
  const decision = resolveWritePolicyForActions({
    governingScopePacket: input.governing_scope_packet ?? null,
    policyPackets: [...(input.policy_packets ?? [])],
    actionIds,
  });

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_REGULATION_COORDINATOR_ID,
    coordinator_kind: 'policy',
    value: {
      gate_kind: 'trusted.write_policy_gate',
      operation_kind: operationKind,
      action_ids: actionIds,
      decision,
      governing_scope_packet_id: input.governing_scope_packet?.header.packet_id ?? null,
      policy_packet_ids: input.policy_packets?.map((packet) => packet.header.packet_id) ?? [],
      satisfied: null,
      notes:
        'Resolved write-policy decision. Proof satisfaction remains the caller/finalization gate responsibility.',
    },
    issues: [],
    trace: [
      regulationTrace({
        step_id: 'regulation.write_policy_gate.resolve',
        status: 'ok',
        preset_ids: ['resolution.write_policy_gate.v0'],
        notes: `Resolved write policy gate for ${actionIds.length} action(s).`,
      }),
    ],
  });
}
