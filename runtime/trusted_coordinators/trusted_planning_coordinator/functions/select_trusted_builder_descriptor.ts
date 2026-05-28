/**
 * File: select_trusted_builder_descriptor.ts
 * Description: Selects the trusted local builder descriptor that should feed a packet operation plan.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { inferActionIds, planningTrace } from '../trusted_planning_internal.ts';
import {
  TRUSTED_PLANNING_COORDINATOR_ID,
  type SelectTrustedBuilderDescriptorInput,
  type TrustedBuilderSelection,
} from '../trusted_planning_types.ts';

export function selectTrustedBuilderDescriptor(
  input: SelectTrustedBuilderDescriptorInput
): TrustedRuntimeCoordinatorResult<TrustedBuilderSelection> {
  const operationKind = input.operation_kind ?? 'builder_selection';
  const packetSubtype = input.packet_subtype ?? input.definition.default_subtype ?? null;
  const actionIds = inferActionIds({
    definition: input.definition,
    operation_kind: operationKind,
    explicit_action_ids: input.action_ids,
  });
  const subtypeCandidates = input.definition.builders.filter(
    (builder) => builder.packet_subtype === null || builder.packet_subtype === packetSubtype
  );
  const actionCandidates = actionIds.length > 0
    ? subtypeCandidates.filter((builder) => actionIds.some((actionId) => builder.action_ids.includes(actionId)))
    : subtypeCandidates;
  const runtimeReadyCandidates = actionCandidates.filter((builder) => builder.availability === 'runtime_ready');
  const builder = runtimeReadyCandidates[0] ?? actionCandidates[0] ?? subtypeCandidates[0] ?? null;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const issues: TrustedRuntimeCoordinatorIssue[] = [];

  if (!builder) {
    blockers.push(`No builder descriptor is available for ${input.definition.packet_type}.${packetSubtype ?? '*'}.`);
    issues.push(trustedIssue({
      severity: 'error',
      code: 'trusted_builder_descriptor_missing',
      path: `${input.definition.packet_type}.builders`,
      message: blockers[0],
    }));
  } else if (builder.availability !== 'runtime_ready') {
    warnings.push(`${builder.builder_id} is canonical metadata but not runtime-ready.`);
  }

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_PLANNING_COORDINATOR_ID,
    coordinator_kind: 'planning',
    value: {
      selection_kind: 'trusted.builder_selection',
      packet_type: input.definition.packet_type,
      packet_subtype: packetSubtype,
      operation_kind: operationKind,
      action_ids: actionIds,
      builder,
      candidate_builder_count: actionCandidates.length,
      reason: builder
        ? `Selected ${builder.builder_id} from ${actionCandidates.length} matching builder candidate(s).`
        : 'No matching builder candidate could be selected.',
      blockers,
      warnings,
    },
    issues,
    trace: [
      planningTrace({
        step_id: 'planning.builder.select',
        status: blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'partial' : 'ok',
        preset_ids: ['resolution.builder_selection.v0'],
        notes: builder
          ? `Selected builder ${builder.builder_id} for ${input.definition.packet_type}.${packetSubtype ?? '*'}.`
          : `No builder selected for ${input.definition.packet_type}.${packetSubtype ?? '*'}.`,
      }),
    ],
  });
}
