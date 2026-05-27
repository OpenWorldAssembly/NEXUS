/**
 * File: trusted_inspection_internal.ts
 * Description: Internal helpers for trusted inspection traces, issue mapping, plan flattening, and candidate comparisons.
 */

import { PacketTypeSchema, type PacketType } from '@core/schema/packet-ontology';
import type { TrustedPacketCandidateNode } from '@runtime/trusted_coordinators/trusted_building_coordinator/index.ts';
import type { TrustedOperationPlan } from '@runtime/trusted_coordinators/trusted_planning_coordinator/index.ts';
import {
  createTrustedTraceEntry,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorStatus,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { TRUSTED_INSPECTION_COORDINATOR_ID } from './trusted_inspection_types.ts';

export function inspectionTrace(input: {
  step_id: string;
  status?: TrustedRuntimeCoordinatorStatus;
  preset_ids?: readonly string[];
  notes: string;
}): TrustedRuntimeCoordinatorTraceEntry {
  return createTrustedTraceEntry({
    coordinator_id: TRUSTED_INSPECTION_COORDINATOR_ID,
    preset_ids: input.preset_ids ?? ['trusted.inspection.v0'],
    status: input.status ?? 'ok',
    step_id: input.step_id,
    notes: input.notes,
  });
}

export function inspectionIssue(input: TrustedRuntimeCoordinatorIssue): TrustedRuntimeCoordinatorIssue {
  return trustedIssue(input);
}

export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function flattenPlanTree(plan: TrustedOperationPlan): TrustedOperationPlan[] {
  const plans: TrustedOperationPlan[] = [plan];

  for (const childPlan of plan.child_packet_plans?.child_plans ?? []) {
    plans.push(...flattenPlanTree(childPlan));
  }

  return plans;
}

export function indexPlanTree(plan: TrustedOperationPlan): Map<string, TrustedOperationPlan> {
  return new Map(flattenPlanTree(plan).map((planNode) => [planNode.plan_id, planNode]));
}

export function safePacketType(packetType: string | null | undefined): PacketType | null {
  const parsed = PacketTypeSchema.safeParse(packetType);

  return parsed.success ? parsed.data : null;
}

export function candidateBodyRecord(candidateNode: TrustedPacketCandidateNode): Record<string, unknown> | null {
  const body = candidateNode.body_candidate?.body;

  return body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : null;
}

export function stableComparable(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableComparable).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableComparable(record[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

export function sameTrustedValue(left: unknown, right: unknown): boolean {
  return stableComparable(left) === stableComparable(right);
}
