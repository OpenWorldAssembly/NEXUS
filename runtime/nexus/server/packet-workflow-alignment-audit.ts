/**
 * File: packet-workflow-alignment-audit.ts
 * Description: Runtime-side audit map from live fortress intents to shadow workflow plans and trusted planner capabilities.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import {
  getExperimentalPacketTypeDefinition,
  listPacketWorkflowPlanDescriptors,
  listTrustedPacketPlannerCapabilities,
  resolvePacketWorkflowDryRunPlan,
  type PacketWorkflowDryRunPlan,
  type PacketWorkflowPlanDescriptor,
  type TrustedPlannerCapabilityDescriptor,
} from '@core/packets/packet-definition-manifest';
import type {
  FortressGenericizationStatus,
  FortressOperationMappingStatus,
} from '@runtime/nexus/server/fortress-handler-genericization-audit';
import {
  listFortressHandlerGenericizationEntries,
} from '@runtime/nexus/server/fortress-handler-genericization-audit';
import { listMutationIntentDescriptors } from '@runtime/nexus/server/mutation-intent-registry';
import {
  listTrustedCompositeWorkflowAdapters,
} from '@runtime/nexus/server/trusted-composite-workflow-adapters';

export type PacketWorkflowAlignmentStatus =
  | 'workflow_aligned'
  | 'planned_gap'
  | 'runtime_owned'
  | 'legacy_bridge';

export type PacketWorkflowAlignmentGap = {
  area:
    | 'workflow_plan'
    | 'trusted_capability'
    | 'runtime_orchestration'
    | 'legacy_bridge';
  status: 'planned_gap';
  reason: string;
};

export type PacketWorkflowAlignmentCoverage = {
  mutation_intent: MutationIntent['kind'];
  canonical_intent: MutationIntent['kind'] | null;
  genericization_status: FortressGenericizationStatus;
  operation_mapping_status: FortressOperationMappingStatus;
  operation_kinds: string[];
  workflow_alignment_status: PacketWorkflowAlignmentStatus;
  workflow_plan_ids: string[];
  workflow_plan_packet_types: string[];
  composition_adapter_ids: string[];
  dry_run_ready: boolean;
  resolver_ids: string[];
  dependency_ids: string[];
  trusted_capability_ids: string[];
  policy_action_ids: string[];
  remaining_packet_specific_assumptions: string[];
  planned_gaps: PacketWorkflowAlignmentGap[];
};

export type PacketWorkflowAlignmentAuditFinding = {
  severity: 'error';
  code: string;
  mutation_intent: string;
  message: string;
};

export type PacketWorkflowAlignmentAuditReport = {
  status: 'pass' | 'fail';
  checked_mutation_intents: string[];
  findings: PacketWorkflowAlignmentAuditFinding[];
};

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function plannedGap(
  area: PacketWorkflowAlignmentGap['area'],
  reason: string
): PacketWorkflowAlignmentGap {
  return {
    area,
    status: 'planned_gap',
    reason,
  };
}

function getWorkflowPlansByIntent(): Map<string, PacketWorkflowPlanDescriptor[]> {
  const plansByIntent = new Map<string, PacketWorkflowPlanDescriptor[]>();

  for (const plan of listPacketWorkflowPlanDescriptors()) {
    for (const mutationIntent of plan.mutation_intents) {
      plansByIntent.set(mutationIntent, [
        ...(plansByIntent.get(mutationIntent) ?? []),
        plan,
      ]);
    }
  }

  return plansByIntent;
}

function resolveDryRuns(
  plans: readonly PacketWorkflowPlanDescriptor[]
): PacketWorkflowDryRunPlan[] {
  return plans.map((plan) => {
    const definition = getExperimentalPacketTypeDefinition(plan.packet_type);

    if (!definition) {
      return {
        dry_run_kind: 'packet.workflow_plan.shadow_dry_run',
        packet_type: plan.packet_type,
        workflow_plan_id: plan.workflow_plan_id,
        mutation_intents: [...plan.mutation_intents],
        operation_kinds: [...plan.operation_kinds],
        step_order: [],
        steps: [],
        policy_action_ids: [],
        dependency_ids: [],
        resolver_ids: [],
        ready_for_shadow_interpretation: false,
        findings: [
          {
            severity: 'error',
            code: 'unknown_workflow_packet_type',
            packet_type: plan.packet_type,
            workflow_plan_id: plan.workflow_plan_id,
            path: 'packet_type',
            message: `Unknown workflow packet type ${plan.packet_type}.`,
          },
        ],
      };
    }

    return resolvePacketWorkflowDryRunPlan({
      definition,
      workflowPlanId: plan.workflow_plan_id,
    });
  });
}

function getTrustedCapabilities(
  dependencyIds: readonly string[]
): TrustedPlannerCapabilityDescriptor[] {
  const dependencyIdSet = new Set(dependencyIds);

  return listTrustedPacketPlannerCapabilities().filter(
    (capability) =>
      dependencyIdSet.has(capability.capability_id) ||
      capability.dependency_ids.some((dependencyId) =>
        dependencyIdSet.has(dependencyId)
      )
  );
}

function getCompositeAdapterIdsByIntent(): Map<string, string[]> {
  const adapterIdsByIntent = new Map<string, string[]>();

  for (const adapter of listTrustedCompositeWorkflowAdapters()) {
    for (const mutationIntent of adapter.mutation_intents) {
      adapterIdsByIntent.set(mutationIntent, [
        ...(adapterIdsByIntent.get(mutationIntent) ?? []),
        adapter.adapter_id,
      ]);
    }
  }

  return adapterIdsByIntent;
}

function resolveAlignmentStatus(input: {
  genericizationStatus: FortressGenericizationStatus;
  hasWorkflowPlans: boolean;
}): PacketWorkflowAlignmentStatus {
  if (input.genericizationStatus === 'legacy_bridge') {
    return 'legacy_bridge';
  }

  if (input.genericizationStatus === 'workflow_specific') {
    return 'runtime_owned';
  }

  return input.hasWorkflowPlans ? 'workflow_aligned' : 'planned_gap';
}

export function listPacketWorkflowAlignmentCoverage(): PacketWorkflowAlignmentCoverage[] {
  const plansByIntent = getWorkflowPlansByIntent();
  const compositeAdapterIdsByIntent = getCompositeAdapterIdsByIntent();

  return listFortressHandlerGenericizationEntries().map((entry) => {
    const lookupIntent = entry.canonical_intent ?? entry.mutation_intent;
    const workflowPlans = plansByIntent.get(lookupIntent) ?? [];
    const compositionAdapterIds = uniqueSorted(
      compositeAdapterIdsByIntent.get(lookupIntent) ?? []
    );
    const dryRuns = resolveDryRuns(workflowPlans);
    const resolverIds = uniqueSorted(dryRuns.flatMap((dryRun) => dryRun.resolver_ids));
    const dependencyIds = uniqueSorted(dryRuns.flatMap((dryRun) => dryRun.dependency_ids));
    const capabilityIds = uniqueSorted(
      getTrustedCapabilities(dependencyIds).map(
        (capability) => capability.capability_id
      )
    );
    const planned_gaps: PacketWorkflowAlignmentGap[] = [];

    if (entry.genericization_status === 'planner_extraction_needed' && workflowPlans.length === 0) {
      planned_gaps.push(
        plannedGap('workflow_plan', entry.next_step)
      );
    }

    if (entry.genericization_status === 'workflow_specific') {
      planned_gaps.push(
        plannedGap('runtime_orchestration', entry.next_step)
      );
    }

    if (entry.genericization_status === 'legacy_bridge') {
      planned_gaps.push(
        plannedGap(
          'legacy_bridge',
          entry.next_step
        )
      );
    }

    if (workflowPlans.length > 0 && capabilityIds.length === 0) {
      planned_gaps.push(
        plannedGap(
          'trusted_capability',
          'Workflow has a shadow plan but no matching trusted local planner capability descriptor.'
        )
      );
    }

    return {
      mutation_intent: entry.mutation_intent,
      canonical_intent: entry.canonical_intent ?? null,
      genericization_status: entry.genericization_status,
      operation_mapping_status: entry.operation_mapping_status,
      operation_kinds: [...entry.operation_kinds],
      workflow_alignment_status: resolveAlignmentStatus({
        genericizationStatus: entry.genericization_status,
        hasWorkflowPlans: workflowPlans.length > 0,
      }),
      workflow_plan_ids: workflowPlans.map((plan) => plan.workflow_plan_id),
      workflow_plan_packet_types: uniqueSorted(
        workflowPlans.map((plan) => plan.packet_type)
      ),
      composition_adapter_ids: compositionAdapterIds,
      dry_run_ready:
        workflowPlans.length > 0 &&
        dryRuns.every((dryRun) => dryRun.ready_for_shadow_interpretation),
      resolver_ids: resolverIds,
      dependency_ids: dependencyIds,
      trusted_capability_ids: capabilityIds,
      policy_action_ids: uniqueSorted([
        ...entry.policy_action_ids,
        ...dryRuns.flatMap((dryRun) => dryRun.policy_action_ids),
      ]),
      remaining_packet_specific_assumptions: [
        entry.notes,
        entry.next_step,
      ],
      planned_gaps,
    };
  });
}

export function getPacketWorkflowAlignmentCoverage(
  mutationIntent: MutationIntent['kind']
): PacketWorkflowAlignmentCoverage | null {
  return (
    listPacketWorkflowAlignmentCoverage().find(
      (coverage) => coverage.mutation_intent === mutationIntent
    ) ?? null
  );
}

export function auditPacketWorkflowAlignmentCoverage(): PacketWorkflowAlignmentAuditReport {
  const coverageByIntent = new Map(
    listPacketWorkflowAlignmentCoverage().map((coverage) => [
      coverage.mutation_intent,
      coverage,
    ])
  );
  const findings: PacketWorkflowAlignmentAuditFinding[] = [];

  for (const descriptor of listMutationIntentDescriptors()) {
    const coverage = coverageByIntent.get(descriptor.kind);

    if (!coverage) {
      findings.push({
        severity: 'error',
        code: 'missing_workflow_alignment_coverage',
        mutation_intent: descriptor.kind,
        message: `Missing workflow alignment coverage for ${descriptor.kind}.`,
      });
      continue;
    }

    if (
      coverage.genericization_status === 'generic_ready' &&
      (coverage.workflow_plan_ids.length === 0 ||
        !coverage.dry_run_ready ||
        coverage.trusted_capability_ids.length === 0)
    ) {
      findings.push({
        severity: 'error',
        code: 'generic_ready_workflow_not_aligned',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} is generic-ready and must have clean workflow and trusted capability coverage.`,
      });
    }

    if (
      coverage.genericization_status === 'planner_extraction_needed' &&
      coverage.workflow_plan_ids.length === 0 &&
      coverage.planned_gaps.length === 0
    ) {
      findings.push({
        severity: 'error',
        code: 'planner_extraction_missing_gap',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} needs either a shadow workflow plan or an explicit planner extraction gap.`,
      });
    }

    if (
      coverage.genericization_status === 'workflow_specific' &&
      !coverage.planned_gaps.some((gap) => gap.area === 'runtime_orchestration')
    ) {
      findings.push({
        severity: 'error',
        code: 'workflow_specific_missing_runtime_gap',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} must remain explicitly classified as runtime-owned workflow orchestration.`,
      });
    }

    if (
      coverage.genericization_status === 'legacy_bridge' &&
      (!coverage.canonical_intent || coverage.workflow_plan_ids.length === 0)
    ) {
      findings.push({
        severity: 'error',
        code: 'legacy_bridge_missing_canonical_workflow',
        mutation_intent: descriptor.kind,
        message: `${descriptor.kind} must point at a canonical workflow direction.`,
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
