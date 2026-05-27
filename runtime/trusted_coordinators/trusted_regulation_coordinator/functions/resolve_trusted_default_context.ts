/**
 * File: resolve_trusted_default_context.ts
 * Description: Resolves definition and policy-backed default context without applying packet construction authority.
 */

import { resolvePacketDefaultProfile } from '@core/packets/packet-defaults.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { createRequirement, regulationTrace } from '../trusted_regulation_internal.ts';
import {
  TRUSTED_REGULATION_COORDINATOR_ID,
  type ResolveTrustedDefaultContextInput,
  type TrustedDefaultContext,
  type TrustedRegulationRequirement,
} from '../trusted_regulation_types.ts';

export function resolveTrustedDefaultContext(
  input: ResolveTrustedDefaultContextInput
): TrustedRuntimeCoordinatorResult<TrustedDefaultContext> {
  const operationKind = input.operation_kind ?? 'default_resolution';
  const profile = resolvePacketDefaultProfile({
    definition: input.definition,
    packet_subtype: input.packet_subtype,
    policy_packets: input.policy_packets,
    local_overrides: input.local_overrides,
  });
  const requirements: TrustedRegulationRequirement[] = [
    ...profile.definition_defaults.map((descriptor) => createRequirement({
      requirement_id: descriptor.default_id,
      requirement_kind: 'default',
      strength: 'definition_audit',
      source: 'definition_part',
      packet_type: profile.packet_type,
      packet_subtype: profile.packet_subtype,
      operation_kind: operationKind,
      notes: descriptor.notes ?? 'Definition-backed default values are available to planning/building.',
    })),
    ...profile.overrides.map((override, index) => createRequirement({
      requirement_id: `default.override.${index}.${override.path}`,
      requirement_kind: 'default',
      strength: 'advisory',
      source: 'local_override',
      packet_type: profile.packet_type,
      packet_subtype: profile.packet_subtype,
      operation_kind: operationKind,
      notes: `Default override is available at ${override.path}; building decides how to apply it to a packet candidate.`,
    })),
  ];

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_REGULATION_COORDINATOR_ID,
    coordinator_kind: 'policy',
    value: {
      context_kind: 'trusted.default_context',
      packet_type: profile.packet_type,
      packet_subtype: profile.packet_subtype,
      operation_kind: operationKind,
      profile,
      requirements,
      overrides_allowed: true,
      inherited_policy_ref_count:
        profile.policy_default_refs.length +
        profile.policy_defaults_definition_refs.length +
        profile.policy_template_refs.length +
        profile.policy_preference_refs.length +
        profile.policy_default_packet_set_refs.length,
      blocking_issue_count: 0,
    },
    issues: [],
    trace: [
      regulationTrace({
        step_id: 'regulation.defaults.context.resolve',
        status: 'ok',
        preset_ids: ['resolution.default_profile.v0'],
        notes: `Resolved default context for ${profile.packet_type}.${profile.packet_subtype ?? '*'}.`,
      }),
    ],
  });
}
