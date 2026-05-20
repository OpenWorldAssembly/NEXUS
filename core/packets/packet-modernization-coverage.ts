/**
 * File: packet-modernization-coverage.ts
 * Description: Audits packet-family modernization coverage for the manifest/runtime chapter.
 */

import {
  auditPacketCompatibilityStandard,
  getExperimentalPacketTypeDefinition,
  listExperimentalPacketTypeDefinitions,
  listPacketDefinitionParts,
  resolvePacketDefinitionMutationActionPlan,
} from '@core/packets/packet-definition-manifest';
import {
  GENERIC_PACKET_BUILD_FAMILIES,
  hasGenericPacketBuilderPipeline,
} from '@core/packets/packet-build-pipeline';
import { listPacketTypeBodyBuilders } from '@core/packets/packet-type-body-builders';
import {
  PACKET_BODY_SCHEMAS,
  PACKET_COMPATIBILITY_REGISTRY,
  PACKET_FAMILIES,
  type PacketFamily,
} from '@core/schema/packet-schema';

export type PacketModernizationCoverageArea =
  | 'body_schema'
  | 'compatibility_registry'
  | 'build_pipeline'
  | 'manifest_definition'
  | 'definition_parts'
  | 'compatibility_definition'
  | 'runtime_connector';

export type PacketModernizationStatus =
  | 'present'
  | 'supported'
  | 'defined'
  | 'complete'
  | 'planned_gap';

export interface PacketModernizationPlannedGap {
  area: PacketModernizationCoverageArea;
  status: 'planned_gap';
  reason: string;
}

export interface PacketFamilyModernizationCoverage {
  family: PacketFamily;
  ontology_enrolled: true;
  body_schema_status: Extract<PacketModernizationStatus, 'present' | 'planned_gap'>;
  compatibility_registry_status: Extract<
    PacketModernizationStatus,
    'present' | 'planned_gap'
  >;
  build_pipeline_status: Extract<
    PacketModernizationStatus,
    'supported' | 'planned_gap'
  >;
  manifest_definition_status: Extract<
    PacketModernizationStatus,
    'defined' | 'planned_gap'
  >;
  definition_parts_status: Extract<
    PacketModernizationStatus,
    'complete' | 'planned_gap'
  >;
  definition_part_count: number;
  planned_gaps: PacketModernizationPlannedGap[];
}

export interface PacketNextPhaseLiveEnrollmentTarget {
  packet_type: 'Definition' | 'Bundle';
  target_status: 'canonical_family';
  currently_in_packet_families: true;
  manifest_definition_status: 'defined';
  reason: string;
}

export interface PacketTypeModernizationCoverage {
  packet_type: string;
  manifest_definition_status: 'defined';
  definition_parts_status: Extract<
    PacketModernizationStatus,
    'complete' | 'planned_gap'
  >;
  definition_part_count: number;
  descriptor_builder_status: Extract<
    PacketModernizationStatus,
    'defined' | 'planned_gap'
  >;
  body_builder_status: Extract<
    PacketModernizationStatus,
    'supported' | 'planned_gap'
  >;
  shadow_mutation_plan_status: Extract<
    PacketModernizationStatus,
    'supported' | 'planned_gap'
  >;
  compatibility_standard_status: Extract<
    PacketModernizationStatus,
    'supported' | 'planned_gap'
  >;
  runtime_connector_status: 'not_checked_in_core';
  planned_gaps: PacketModernizationPlannedGap[];
}

function hasOwnKey<TObject extends object>(
  object: TObject,
  key: PropertyKey
): key is keyof TObject {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function plannedGap(
  area: PacketModernizationCoverageArea,
  reason: string
): PacketModernizationPlannedGap {
  return {
    area,
    status: 'planned_gap',
    reason,
  };
}

export function getPacketFamilyModernizationCoverage(
  family: PacketFamily
): PacketFamilyModernizationCoverage {
  const definition = getExperimentalPacketTypeDefinition(family);
  const definitionParts = definition ? listPacketDefinitionParts(definition) : [];
  const planned_gaps: PacketModernizationPlannedGap[] = [];

  const body_schema_status = hasOwnKey(PACKET_BODY_SCHEMAS, family)
    ? 'present'
    : 'planned_gap';
  if (body_schema_status === 'planned_gap') {
    planned_gaps.push(
      plannedGap(
        'body_schema',
        'Canonical packet ontology families must keep a body schema before modernization can promote them.'
      )
    );
  }

  const compatibility_registry_status = hasOwnKey(
    PACKET_COMPATIBILITY_REGISTRY,
    family
  )
    ? 'present'
    : 'planned_gap';
  if (compatibility_registry_status === 'planned_gap') {
    planned_gaps.push(
      plannedGap(
        'compatibility_registry',
        'Canonical packet ontology families must keep compatibility metadata before modernization can promote them.'
      )
    );
  }

  const build_pipeline_status = hasGenericPacketBuilderPipeline(family)
    ? 'supported'
    : 'planned_gap';
  if (build_pipeline_status === 'planned_gap') {
    planned_gaps.push(
      plannedGap(
        'build_pipeline',
        `Generic packet builders currently cover ${GENERIC_PACKET_BUILD_FAMILIES.length} families; this family is scheduled for a later builder pass.`
      )
    );
  }

  const manifest_definition_status = definition ? 'defined' : 'planned_gap';
  if (manifest_definition_status === 'planned_gap') {
    planned_gaps.push(
      plannedGap(
        'manifest_definition',
        'Preference is the only live ontology family with a manifest definition in the current chapter baseline.'
      )
    );
  }

  const definition_parts_status =
    definitionParts.length > 0 ? 'complete' : 'planned_gap';
  if (definition_parts_status === 'planned_gap') {
    planned_gaps.push(
      plannedGap(
        'definition_parts',
        'Definition parts will be filled when this family receives its manifest definition.'
      )
    );
  }

  return {
    family,
    ontology_enrolled: true,
    body_schema_status,
    compatibility_registry_status,
    build_pipeline_status,
    manifest_definition_status,
    definition_parts_status,
    definition_part_count: definitionParts.length,
    planned_gaps,
  };
}

export function listPacketFamilyModernizationCoverage(): PacketFamilyModernizationCoverage[] {
  return PACKET_FAMILIES.map((family) => getPacketFamilyModernizationCoverage(family));
}

export function getPacketTypeModernizationCoverage(
  packetType: string
): PacketTypeModernizationCoverage {
  const definition = getExperimentalPacketTypeDefinition(packetType);

  if (!definition) {
    throw new Error(`Unknown manifest packet type: ${packetType}`);
  }

  const parts = listPacketDefinitionParts(definition);
  const planned_gaps: PacketModernizationPlannedGap[] = [];
  const bodyBuilderPacketTypes = new Set(
    listPacketTypeBodyBuilders().map((builder) => builder.packet_type)
  );
  const mutationPlans = definition.mutations.map((mutation) =>
    resolvePacketDefinitionMutationActionPlan({
      definition,
      mutation_intent: mutation.mutation_intent,
    })
  );
  const compatibilityIssues = auditPacketCompatibilityStandard(definition);

  const definition_parts_status =
    parts.length > 0 ? 'complete' : 'planned_gap';
  if (definition_parts_status === 'planned_gap') {
    planned_gaps.push(
      plannedGap(
        'definition_parts',
        'Packet types should expose Definition parts before runtime enrollment.'
      )
    );
  }

  const descriptor_builder_status =
    definition.builders.length > 0 ? 'defined' : 'planned_gap';
  if (descriptor_builder_status === 'planned_gap') {
    planned_gaps.push(
      plannedGap(
        'build_pipeline',
        'Packet definition has no builder descriptor for packet-type body candidates.'
      )
    );
  }

  const body_builder_status =
    bodyBuilderPacketTypes.has(definition.packet_type) ||
    (GENERIC_PACKET_BUILD_FAMILIES as readonly string[]).includes(definition.packet_type)
    ? 'supported'
    : 'planned_gap';
  if (body_builder_status === 'planned_gap') {
    planned_gaps.push(
      plannedGap(
        'build_pipeline',
        'No executable packet-type body builder is registered for this manifest packet type.'
      )
    );
  }

  const shadow_mutation_plan_status =
    mutationPlans.length > 0 &&
    mutationPlans.every((plan) => plan.ready_for_shadow_runtime)
      ? 'supported'
      : 'planned_gap';
  if (shadow_mutation_plan_status === 'planned_gap') {
    planned_gaps.push(
      plannedGap(
        'manifest_definition',
        'Packet mutation descriptors are missing or not shadow-runtime ready.'
      )
    );
  }

  const compatibility_standard_status =
    compatibilityIssues.some((issue) => issue.severity === 'error')
      ? 'planned_gap'
      : 'supported';
  if (compatibility_standard_status === 'planned_gap') {
    planned_gaps.push(
      plannedGap(
        'compatibility_definition',
        'Manifest compatibility descriptors do not yet meet the current adapter graph standard.'
      )
    );
  }

  return {
    packet_type: definition.packet_type,
    manifest_definition_status: 'defined',
    definition_parts_status,
    definition_part_count: parts.length,
    descriptor_builder_status,
    body_builder_status,
    shadow_mutation_plan_status,
    compatibility_standard_status,
    runtime_connector_status: 'not_checked_in_core',
    planned_gaps,
  };
}

export function listPacketTypeModernizationCoverage(): PacketTypeModernizationCoverage[] {
  return listExperimentalPacketTypeDefinitions().map((definition) =>
    getPacketTypeModernizationCoverage(definition.packet_type)
  );
}

export function listPacketNextPhaseLiveEnrollmentTargets(): PacketNextPhaseLiveEnrollmentTarget[] {
  return (['Definition', 'Bundle'] as const).map((packet_type) => {
    const definition = getExperimentalPacketTypeDefinition(packet_type);

    if (!definition) {
      throw new Error(
        `Expected ${packet_type} to remain available in the experimental packet definition manifest.`
      );
    }

    return {
      packet_type,
      target_status: 'canonical_family',
      currently_in_packet_families: true,
      manifest_definition_status: 'defined',
      reason:
        'Definition and Bundle are now canonical packet families with packetized definition-profile seed material.',
    };
  });
}
