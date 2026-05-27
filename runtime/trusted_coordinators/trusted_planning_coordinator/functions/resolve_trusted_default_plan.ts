/**
 * File: resolve_trusted_default_plan.ts
 * Description: Resolves definition and policy-backed default inputs for trusted packet planning.
 */

import { resolvePacketDefaultProfile } from '@core/packets/packet-defaults.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { createPlanningRequirement, planningTrace } from '../trusted_planning_internal.ts';
import {
  TRUSTED_PLANNING_COORDINATOR_ID,
  type ResolveTrustedDefaultPlanInput,
  type TrustedDefaultPlan,
  type TrustedPlanningRequirement,
} from '../trusted_planning_types.ts';

export function resolveTrustedDefaultPlan(
  input: ResolveTrustedDefaultPlanInput
): TrustedRuntimeCoordinatorResult<TrustedDefaultPlan> {
  const operationKind = input.operation_kind ?? 'default_resolution';
  const profile = resolvePacketDefaultProfile({
    definition: input.definition,
    packet_subtype: input.packet_subtype,
    policy_packets: input.policy_packets,
    local_overrides: input.local_overrides,
  });
  const requirements: TrustedPlanningRequirement[] = [
    ...profile.definition_defaults.map((descriptor) => createPlanningRequirement({
      requirement_id: descriptor.default_id,
      requirement_kind: 'default',
      strength: 'definition_audit',
      source: 'definition_part',
      packet_type: profile.packet_type,
      packet_subtype: profile.packet_subtype,
      operation_kind: operationKind,
      notes: descriptor.notes ?? 'Definition-backed default values are available to packet planning.',
    })),
    ...profile.overrides.map((override, index) => createPlanningRequirement({
      requirement_id: `default.override.${index}.${override.path}`,
      requirement_kind: 'default',
      strength: 'advisory',
      source: 'local_override',
      packet_type: profile.packet_type,
      packet_subtype: profile.packet_subtype,
      operation_kind: operationKind,
      notes: `Default override is available at ${override.path}; planning decides whether it feeds the build candidate.`,
    })),
  ];

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_PLANNING_COORDINATOR_ID,
    coordinator_kind: 'defaults',
    value: {
      plan_kind: 'trusted.default_plan',
      packet_type: profile.packet_type,
      packet_subtype: profile.packet_subtype,
      operation_kind: operationKind,
      profile,
      default_value_keys: Object.keys(profile.resolved_values).sort((left, right) => left.localeCompare(right)),
      inherited_policy_ref_count:
        profile.policy_default_refs.length +
        profile.policy_defaults_definition_refs.length +
        profile.policy_template_refs.length +
        profile.policy_preference_refs.length +
        profile.policy_default_packet_set_refs.length,
      overrides_allowed: true,
      requirements,
      blockers: [],
      warnings: [],
    },
    issues: [],
    trace: [
      planningTrace({
        step_id: 'planning.defaults.resolve',
        status: 'ok',
        preset_ids: ['resolution.default_profile.v0'],
        notes: `Resolved default plan for ${profile.packet_type}.${profile.packet_subtype ?? '*'}.`,
      }),
    ],
  });
}
