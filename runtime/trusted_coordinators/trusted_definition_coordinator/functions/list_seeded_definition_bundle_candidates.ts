/**
 * File: list_seeded_definition_bundle_candidates.ts
 * Description: Converts the canonical seeded Definition Bundle.packet_set into Trusted Definition candidates.
 */

import {
  SEEDED_DEFINITION_PROFILE_ID,
  resolveSeededPacketDefinitionProfile,
  type SeededDefinitionPacketCandidate,
} from '@core/packets/packet-definition-seeds.ts';
import { getDefinedPacketTypeDefinition } from '@core/packets/packet-definition-manifest.ts';
import {
  BundleBodySchema,
} from '@core/packets/definitions/bundle.ts';
import {
  DefinitionBodySchema,
  type DefinitionBody,
} from '@core/packets/definitions/definition.ts';
import type {
  PacketDefinitionPartDescriptor,
  PacketDefinitionPartSubtype,
} from '@core/packets/definitions/packet-definition-types.ts';
import {
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import type {
  TrustedDefinitionCandidate,
  TrustedDefinitionSource,
} from '../trusted_definition_types.ts';

const SEEDED_DEFINITION_BUNDLE_SOURCE: TrustedDefinitionSource = {
  source_id: SEEDED_DEFINITION_PROFILE_ID,
  source_kind: 'seeded_bundle',
  trust_tier: 'core_seed',
  priority: 450,
  verified: true,
  notes:
    'Kernel-validated Definition packets carried by the canonical pre-reseed Bundle.packet_set profile.',
};

function referencesForStoredDefinitionBody(body: DefinitionBody): string[] {
  switch (body.subtype) {
    case 'packet_definition':
      return [
        ...body.required_parts.map((part) => part.part_id),
        ...body.optional_parts.map((part) => part.part_id),
      ];
    case 'packet_schema':
      return [body.schema_key, ...body.supported_subtypes];
    case 'packet_action_registry':
      return [...body.action_ids];
    case 'packet_builder_descriptor':
      return [...body.builder_ids];
    case 'packet_planner_descriptor':
      return [...body.planner_ids];
    case 'packet_projection_descriptor':
      return [...body.projection_keys];
    case 'packet_compatibility':
      return [...body.adapter_ids];
    case 'defaults_definition':
      return Object.keys(body.default_values);
    case 'dependencies_definition':
      return [
        ...body.required_refs.map((ref) => ref.packet_id),
        ...body.optional_refs.map((ref) => ref.packet_id),
        ...body.required_relation_subtypes,
        ...body.required_packet_types,
        ...body.required_definition_parts,
        ...body.required_runtime_capabilities,
      ];
  }
}

function toStoredDefinitionPartDescriptor(input: {
  seed: SeededDefinitionPacketCandidate;
  body: DefinitionBody;
}): PacketDefinitionPartDescriptor {
  const { seed, body } = input;

  return {
    part_id: seed.part_id,
    part_subtype: body.subtype as PacketDefinitionPartSubtype,
    defines_packet_type: body.defines_packet_type,
    defines_packet_subtype: body.defines_packet_subtype,
    schema_version: body.definition_version,
    availability: 'canonical',
    required: true,
    references: referencesForStoredDefinitionBody(body),
    covers_subtypes:
      body.subtype === 'packet_schema' ? [...body.supported_subtypes] : undefined,
    applies_to:
      body.subtype === 'defaults_definition' || body.subtype === 'dependencies_definition'
        ? body.applies_to
        : undefined,
    default_values:
      body.subtype === 'defaults_definition' ? body.default_values : undefined,
    default_merge_strategy:
      body.subtype === 'defaults_definition'
        ? body.default_merge_strategy
        : undefined,
    notes: body.summary,
  };
}

function storedCandidateId(input: {
  packetType: string;
  partSubtype: string;
  partId: string;
}): string {
  return `${input.packetType}.${input.partSubtype}.${input.partId}.seeded_bundle`;
}

function shouldIncludePacketType(input: {
  packetType: string;
  packetTypeFilters?: readonly string[];
}): boolean {
  return !input.packetTypeFilters || input.packetTypeFilters.length === 0 || input.packetTypeFilters.includes(input.packetType);
}

export function listSeededDefinitionBundleCandidates(input: {
  packet_type_filters?: readonly string[];
} = {}): {
  candidates: TrustedDefinitionCandidate[];
  issues: TrustedRuntimeCoordinatorIssue[];
  bundled_part_count: number;
} {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const profile = resolveSeededPacketDefinitionProfile();
  const bundleBody = BundleBodySchema.safeParse(profile.bundle_packet.packet.body);

  if (!bundleBody.success) {
    return {
      candidates: [],
      issues: [
        trustedIssue({
          severity: 'error',
          code: 'seeded_definition_bundle_kernel_validation_failed',
          path: profile.bundle_packet.packet_ref.packet_id,
          message:
            'Seeded Definition Bundle.packet_set failed Bundle kernel validation and was not listed as a trusted definition source.',
        }),
      ],
      bundled_part_count: 0,
    };
  }

  const bundledRevisionIds = new Set(
    bundleBody.data.items
      .map((item) => item.revision_ref?.revision_id ?? null)
      .filter((revisionId): revisionId is string => revisionId !== null)
  );
  const candidates: TrustedDefinitionCandidate[] = [];

  for (const seed of profile.definition_packets) {
    if (!shouldIncludePacketType({ packetType: seed.defines_packet_type, packetTypeFilters: input.packet_type_filters })) {
      continue;
    }

    if (!bundledRevisionIds.has(seed.revision_ref.revision_id)) {
      issues.push(
        trustedIssue({
          severity: 'warning',
          code: 'seeded_definition_part_not_bundled',
          path: seed.revision_ref.revision_id,
          message: `${seed.part_id} was generated as a Definition packet but is not present in the seeded definition bundle inventory.`,
        })
      );
      continue;
    }

    const parsedBody = DefinitionBodySchema.safeParse(seed.packet.body);

    if (!parsedBody.success) {
      issues.push(
        trustedIssue({
          severity: 'error',
          code: 'seeded_definition_part_kernel_validation_failed',
          path: seed.revision_ref.revision_id,
          message: `${seed.part_id} failed Definition kernel validation and was not listed as a trusted definition candidate.`,
        })
      );
      continue;
    }

    const body = parsedBody.data;
    const bootstrapDefinition = getDefinedPacketTypeDefinition(body.defines_packet_type);

    if (!bootstrapDefinition) {
      issues.push(
        trustedIssue({
          severity: 'warning',
          code: 'seeded_definition_part_without_bootstrap_snapshot',
          path: seed.revision_ref.revision_id,
          message: `${seed.part_id} defines ${body.defines_packet_type}, but no compiled bootstrap snapshot is available yet.`,
        })
      );
      continue;
    }

    const isCompatibility = body.subtype === 'packet_compatibility';

    candidates.push({
      candidate_id: storedCandidateId({
        packetType: body.defines_packet_type,
        partSubtype: body.subtype === 'packet_definition' ? 'packet_type_definition' : body.subtype,
        partId: seed.part_id,
      }),
      source: SEEDED_DEFINITION_BUNDLE_SOURCE,
      defines_packet_type: body.defines_packet_type,
      defines_packet_subtype: body.defines_packet_subtype,
      part_subtype:
        body.subtype === 'packet_definition'
          ? 'packet_type_definition'
          : body.subtype,
      definition_version: body.definition_version,
      schema_version: body.definition_version,
      status: isCompatibility ? 'compatibility_candidate' : 'active_candidate',
      verification_status: 'verified',
      trust_status: isCompatibility ? 'compatibility_only' : 'core_seed',
      priority: isCompatibility ? 240 : SEEDED_DEFINITION_BUNDLE_SOURCE.priority,
      compatibility_posture: isCompatibility ? 'compatibility_reader' : 'current_semantics',
      payload: {
        definition: body.subtype === 'packet_definition' ? bootstrapDefinition : undefined,
        part:
          body.subtype === 'packet_definition'
            ? undefined
            : toStoredDefinitionPartDescriptor({ seed, body }),
        body_candidate: seed.body_candidate,
        descriptor: {
          source: 'seeded_definition_bundle',
          profile_id: profile.profile_id,
          bundle_packet_ref: profile.bundle_packet.packet_ref,
          bundle_revision_ref: profile.bundle_packet.revision_ref,
          definition_packet_ref: seed.packet_ref,
          definition_revision_ref: seed.revision_ref,
          stored_definition_body: body,
          compiled_snapshot_note:
            'Runtime payload still uses the compiled bootstrap PacketTypeDefinition snapshot until stored Definition parts become complete enough to compile every PacketTypeDefinition field without TypeScript fallback.',
        },
      },
      issues: [],
    });
  }

  return {
    candidates,
    issues,
    bundled_part_count: bundleBody.data.items.length,
  };
}
