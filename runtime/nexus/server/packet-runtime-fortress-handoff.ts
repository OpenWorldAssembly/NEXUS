/**
 * File: packet-runtime-fortress-handoff.ts
 * Description: Definition handoff contract between the runtime crossing guard and the signed fortress corridor.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import {
  getMutationIntentDescriptor,
  listMutationIntentDescriptors,
} from '@runtime/nexus/server/mutation-intent-registry';
import {
  getPacketWorkflowAlignmentCoverage,
  listPacketWorkflowAlignmentCoverage,
  type PacketWorkflowAlignmentCoverage,
  type PacketWorkflowAlignmentStatus,
} from '@runtime/nexus/server/packet-workflow-alignment-audit';

export type PacketRuntimeFortressHandoffStatus =
  | 'definition_ready'
  | 'missing_coverage'
  | 'runtime_owned'
  | 'legacy_bridge'
  | 'blocked';

export type PacketRuntimeFortressHandoffReasonCode =
  | 'workflow_alignment_ready'
  | 'external_definition_execution_disabled'
  | 'planner_extraction_gap'
  | 'runtime_owned_workflow'
  | 'legacy_bridge_to_canonical'
  | 'unknown_mutation_intent'
  | 'missing_workflow_alignment'
  | 'unready_workflow_dry_run'
  | 'missing_trusted_capability';

export type PacketRuntimeFortressReturnHint = {
  hint_kind: 'packet_runtime.fortress_return_hint';
  mutation_intent: MutationIntent['kind'];
  refresh_surfaces: string[];
  projection_dependency_ids: string[];
  notes: string[];
};

export type PacketRuntimeFortressHandoff = {
  handoff_kind: 'packet_runtime.fortress_handoff.definition';
  mutation_intent: MutationIntent['kind'] | string;
  canonical_intent: MutationIntent['kind'] | null;
  status: PacketRuntimeFortressHandoffStatus;
  workflow_alignment_status: PacketWorkflowAlignmentStatus | null;
  operation_kinds: string[];
  workflow_plan_ids: string[];
  workflow_plan_packet_types: string[];
  composition_adapter_ids: string[];
  trusted_capability_ids: string[];
  policy_action_ids: string[];
  dependency_ids: string[];
  resolver_ids: string[];
  reason_codes: PacketRuntimeFortressHandoffReasonCode[];
  external_definition_execution_enabled: false;
  normalized_prepare_intent_kind: MutationIntent['kind'] | null;
  fortress_prepare_handler: string | null;
  fortress_finalize_handler: string | null;
  return_hint: PacketRuntimeFortressReturnHint;
  notes: string[];
};

export type PacketRuntimeFortressHandoffCoverage = {
  mutation_intent: MutationIntent['kind'];
  status: PacketRuntimeFortressHandoffStatus;
  canonical_intent: MutationIntent['kind'] | null;
  reason_codes: PacketRuntimeFortressHandoffReasonCode[];
  workflow_plan_ids: string[];
  composition_adapter_ids: string[];
  trusted_capability_ids: string[];
  policy_action_ids: string[];
  dependency_ids: string[];
  external_definition_execution_enabled: false;
};

export type PacketRuntimeFortressHandoffAuditFinding = {
  severity: 'error';
  code: string;
  mutation_intent: string;
  message: string;
};

export type PacketRuntimeFortressHandoffAuditReport = {
  status: 'pass' | 'fail';
  checked_mutation_intents: string[];
  findings: PacketRuntimeFortressHandoffAuditFinding[];
};

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function createReturnHint(input: {
  mutationIntent: MutationIntent['kind'];
  dependencyIds: readonly string[];
  workflowPlanPacketTypes: readonly string[];
}): PacketRuntimeFortressReturnHint {
  return {
    hint_kind: 'packet_runtime.fortress_return_hint',
    mutation_intent: input.mutationIntent,
    refresh_surfaces: uniqueSorted([
      ...input.workflowPlanPacketTypes.map((packetType) =>
        `${packetType.toLowerCase()}.projection`
      ),
      input.dependencyIds.includes('generic.operation.projection')
        ? 'generic.projection'
        : null,
      input.dependencyIds.includes('generic.compatibility_projection')
        ? 'compatibility.projection'
        : null,
    ].filter((surface): surface is string => surface !== null)),
    projection_dependency_ids: input.dependencyIds.filter(
      (dependencyId) =>
        dependencyId.includes('projection') ||
        dependencyId.includes('compatibility')
    ),
    notes: [
      'Return hints are descriptive refresh metadata only; finalized mutation responses are unchanged.',
    ],
  };
}

function mapAlignmentToHandoffStatus(
  alignmentStatus: PacketWorkflowAlignmentStatus
): PacketRuntimeFortressHandoffStatus {
  if (alignmentStatus === 'workflow_aligned') {
    return 'definition_ready';
  }

  if (alignmentStatus === 'runtime_owned') {
    return 'runtime_owned';
  }

  if (alignmentStatus === 'legacy_bridge') {
    return 'legacy_bridge';
  }

  return 'missing_coverage';
}

function reasonCodesForCoverage(
  coverage: PacketWorkflowAlignmentCoverage
): PacketRuntimeFortressHandoffReasonCode[] {
  const reasonCodes: PacketRuntimeFortressHandoffReasonCode[] = [];

  if (coverage.workflow_alignment_status === 'workflow_aligned') {
    reasonCodes.push('workflow_alignment_ready');
  }

  if (coverage.workflow_alignment_status === 'missing_coverage') {
    reasonCodes.push('planner_extraction_gap');
  }

  if (coverage.workflow_alignment_status === 'runtime_owned') {
    reasonCodes.push('runtime_owned_workflow');
  }

  if (coverage.workflow_alignment_status === 'legacy_bridge') {
    reasonCodes.push('legacy_bridge_to_canonical');
  }

  if (coverage.workflow_plan_ids.length > 0 && !coverage.dry_run_ready) {
    reasonCodes.push('unready_workflow_dry_run');
  }

  if (coverage.workflow_plan_ids.length > 0 && coverage.trusted_capability_ids.length === 0) {
    reasonCodes.push('missing_trusted_capability');
  }

  reasonCodes.push('external_definition_execution_disabled');

  return uniqueSorted(reasonCodes) as PacketRuntimeFortressHandoffReasonCode[];
}

function isKnownMutationIntent(
  mutationIntent: string
): mutationIntent is MutationIntent['kind'] {
  return listMutationIntentDescriptors().some(
    (descriptor) => descriptor.kind === mutationIntent
  );
}

export function resolvePacketRuntimeFortressHandoff(input: {
  mutationIntent: string;
}): PacketRuntimeFortressHandoff {
  if (!isKnownMutationIntent(input.mutationIntent)) {
    return {
      handoff_kind: 'packet_runtime.fortress_handoff.definition',
      mutation_intent: input.mutationIntent,
      canonical_intent: null,
      status: 'blocked',
      workflow_alignment_status: null,
      operation_kinds: [],
      workflow_plan_ids: [],
      workflow_plan_packet_types: [],
      composition_adapter_ids: [],
      trusted_capability_ids: [],
      policy_action_ids: [],
      dependency_ids: [],
      resolver_ids: [],
      reason_codes: ['unknown_mutation_intent'],
      external_definition_execution_enabled: false,
      normalized_prepare_intent_kind: null,
      fortress_prepare_handler: null,
      fortress_finalize_handler: null,
      return_hint: {
        hint_kind: 'packet_runtime.fortress_return_hint',
        mutation_intent: 'actor.write_policy.update',
        refresh_surfaces: [],
        projection_dependency_ids: [],
        notes: [
          'Unknown mutation intents cannot produce fortress return hints.',
        ],
      },
      notes: [
        'The crossing guard refuses unknown mutation intents before fortress handoff.',
      ],
    };
  }

  const descriptor = getMutationIntentDescriptor(input.mutationIntent);
  const coverage = getPacketWorkflowAlignmentCoverage(input.mutationIntent);

  if (!coverage) {
    return {
      handoff_kind: 'packet_runtime.fortress_handoff.definition',
      mutation_intent: input.mutationIntent,
      canonical_intent: null,
      status: 'blocked',
      workflow_alignment_status: null,
      operation_kinds: [],
      workflow_plan_ids: [],
      workflow_plan_packet_types: [],
      composition_adapter_ids: [],
      trusted_capability_ids: [],
      policy_action_ids: [],
      dependency_ids: [],
      resolver_ids: [],
      reason_codes: ['missing_workflow_alignment'],
      external_definition_execution_enabled: false,
      normalized_prepare_intent_kind: input.mutationIntent,
      fortress_prepare_handler: descriptor.prepare,
      fortress_finalize_handler: descriptor.finalize,
      return_hint: createReturnHint({
        mutationIntent: input.mutationIntent,
        dependencyIds: [],
        workflowPlanPacketTypes: [],
      }),
      notes: [
        'The crossing guard found the live mutation intent but no workflow alignment record.',
      ],
    };
  }

  const reasonCodes = reasonCodesForCoverage(coverage);
  const status = reasonCodes.includes('unready_workflow_dry_run') ||
    reasonCodes.includes('missing_trusted_capability')
      ? 'blocked'
      : mapAlignmentToHandoffStatus(coverage.workflow_alignment_status);

  return {
    handoff_kind: 'packet_runtime.fortress_handoff.definition',
    mutation_intent: coverage.mutation_intent,
    canonical_intent: coverage.canonical_intent,
    status,
    workflow_alignment_status: coverage.workflow_alignment_status,
    operation_kinds: coverage.operation_kinds,
    workflow_plan_ids: coverage.workflow_plan_ids,
    workflow_plan_packet_types: coverage.workflow_plan_packet_types,
    composition_adapter_ids: coverage.composition_adapter_ids,
    trusted_capability_ids: coverage.trusted_capability_ids,
    policy_action_ids: coverage.policy_action_ids,
    dependency_ids: coverage.dependency_ids,
    resolver_ids: coverage.resolver_ids,
    reason_codes: reasonCodes,
    external_definition_execution_enabled: false,
    normalized_prepare_intent_kind: coverage.canonical_intent ?? coverage.mutation_intent,
    fortress_prepare_handler: descriptor.prepare,
    fortress_finalize_handler: descriptor.finalize,
    return_hint: createReturnHint({
      mutationIntent: coverage.mutation_intent,
      dependencyIds: coverage.dependency_ids,
      workflowPlanPacketTypes: coverage.workflow_plan_packet_types,
    }),
    notes: [
      'Definition crossing-guard handoff only: runtime may inspect manifest/workflow metadata, but fortress remains the live authority for prepare/finalize/proof/persistence.',
      ...coverage.remaining_packet_specific_assumptions,
    ],
  };
}

export function listPacketRuntimeFortressHandoffCoverage(): PacketRuntimeFortressHandoffCoverage[] {
  return listPacketWorkflowAlignmentCoverage().map((coverage) => {
    const handoff = resolvePacketRuntimeFortressHandoff({
      mutationIntent: coverage.mutation_intent,
    });

    return {
      mutation_intent: coverage.mutation_intent,
      status: handoff.status,
      canonical_intent: handoff.canonical_intent,
      reason_codes: handoff.reason_codes,
      workflow_plan_ids: handoff.workflow_plan_ids,
      composition_adapter_ids: handoff.composition_adapter_ids,
      trusted_capability_ids: handoff.trusted_capability_ids,
      policy_action_ids: handoff.policy_action_ids,
      dependency_ids: handoff.dependency_ids,
      external_definition_execution_enabled: false,
    };
  });
}

export function auditPacketRuntimeFortressHandoffs(): PacketRuntimeFortressHandoffAuditReport {
  const findings: PacketRuntimeFortressHandoffAuditFinding[] = [];

  for (const descriptor of listMutationIntentDescriptors()) {
    const handoff = resolvePacketRuntimeFortressHandoff({
      mutationIntent: descriptor.kind,
    });

    if (handoff.status === 'definition_ready') {
      if (
        handoff.workflow_plan_ids.length === 0 ||
        handoff.operation_kinds.length === 0 ||
        handoff.trusted_capability_ids.length === 0 ||
        handoff.policy_action_ids.length === 0 ||
        handoff.dependency_ids.length === 0
      ) {
        findings.push({
          severity: 'error',
          code: 'definition_ready_handoff_incomplete',
          mutation_intent: descriptor.kind,
          message: `${descriptor.kind} is definition-ready but missing workflow, operation, policy, dependency, or trusted capability metadata.`,
        });
      }
    }

    if (
      handoff.status === 'runtime_owned' &&
      !handoff.reason_codes.includes('runtime_owned_workflow')
    ) {
      findings.push({
        severity: 'error',
        code: 'runtime_owned_handoff_missing_reason',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} is runtime-owned but lacks the runtime-owned reason code.`,
      });
    }

    if (
      handoff.status === 'legacy_bridge' &&
      (!handoff.canonical_intent ||
        !handoff.reason_codes.includes('legacy_bridge_to_canonical'))
    ) {
      findings.push({
        severity: 'error',
        code: 'legacy_bridge_handoff_missing_canonical',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} is a legacy bridge but lacks canonical handoff direction.`,
      });
    }

    if (handoff.external_definition_execution_enabled !== false) {
      findings.push({
        severity: 'error',
        code: 'handoff_external_definition_execution_enabled',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} handoff must remain runtime-ready in this pass.`,
      });
    }
  }

  return {
    status: findings.length > 0 ? 'fail' : 'pass',
    checked_mutation_intents: listMutationIntentDescriptors().map(
      (descriptor) => descriptor.kind
    ),
    findings,
  };
}
