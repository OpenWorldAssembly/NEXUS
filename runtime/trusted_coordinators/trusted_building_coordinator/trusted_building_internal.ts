/**
 * File: trusted_building_internal.ts
 * Description: Internal helpers for trusted building traces, issue mapping, and candidate identity.
 */

import {
  createTrustedTraceEntry,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorStatus,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { TRUSTED_BUILDING_COORDINATOR_ID } from './trusted_building_types.ts';

export function buildingTrace(input: {
  step_id: string;
  status?: TrustedRuntimeCoordinatorStatus;
  preset_ids?: readonly string[];
  notes: string;
}): TrustedRuntimeCoordinatorTraceEntry {
  return createTrustedTraceEntry({
    coordinator_id: TRUSTED_BUILDING_COORDINATOR_ID,
    preset_ids: input.preset_ids ?? ['trusted.building.v0'],
    status: input.status ?? 'ok',
    step_id: input.step_id,
    notes: input.notes,
  });
}

export function buildingIssue(input: TrustedRuntimeCoordinatorIssue): TrustedRuntimeCoordinatorIssue {
  return trustedIssue(input);
}

export function candidateIdForPlan(input: {
  plan_id?: string | null;
  packet_type?: string | null;
  packet_subtype?: string | null;
  suffix?: string;
}): string {
  const base = input.plan_id ?? `trusted.build_candidate.${input.packet_type ?? 'unknown'}.${input.packet_subtype ?? 'default'}`;
  return input.suffix ? `${base}.${input.suffix}` : base;
}

export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
