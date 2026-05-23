/**
 * File: packet-modernization-coverage.ts
 * Description: Audits packet-type modernization coverage for the manifest/runtime chapter.
 */

import {
  auditPacketCompatibilityStandard,
  getDefinedPacketTypeDefinition,
  listDefinedPacketTypeDefinitions,
  listPacketDefinitionParts,
  resolvePacketDefinitionMutationActionPlan,
} from '@core/packets/packet-definition-manifest';
import {
  GENERIC_PACKET_BUILD_TYPES,
  hasGenericPacketBuilderPipeline,
} from '@core/packets/packet-build-pipeline';
import { listPacketTypeBodyBuilders } from '@core/packets/packet-type-body-builders';
import {
  PACKET_BODY_SCHEMAS,
  PACKET_COMPATIBILITY_REGISTRY,
  PACKET_TYPES,
  type PacketType,
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
  | 'missing_coverage';

export interface PacketModernizationPlannedGap {
  area: PacketModernizationCoverageArea;
  status: 'missing_coverage';
  reason: string;
}

export interface PacketTypeModernizationCoverage {
  type: PacketType;
  packet_type: PacketType;
  ontology_enrolled: true;
  body_schema_status: Extract<PacketModernizationStatus, 'present' | 'missing_coverage'>;
  compatibility_registry_status: Extract<
    PacketModernizationStatus,
    'present' | 'missing_coverage'
  >;
  build_pipeline_status: Extract<
    PacketModernizationStatus,
    'supported' | 'missing_coverage'
  >;
  manifest_definition_status: Extract<
    PacketModernizationStatus,
    'defined' | 'missing_coverage'
  >;
  definition_parts_status: Extract<
    PacketModernizationStatus,
    'complete' | 'missing_coverage'
  >;
  descriptor_builder_status: Extract<
    PacketModernizationStatus,
    'defined' | 'missing_coverage'
  >;
  body_builder_status: Extract<
    PacketModernizationStatus,
    'supported' | 'missing_coverage'
  >;
  definition_mutation_plan_status: Extract<
    PacketModernizationStatus,
    'supported' | 'missing_coverage'
  >;
  compatibility_standard_status: Extract<
    PacketModernizationStatus,
    'supported' | 'missing_coverage'
  >;
  runtime_connector_status: 'not_checked_in_core';
  definition_part_count: number;
  missing_coverage_items: PacketModernizationPlannedGap[];
}

export interface PacketNextPhaseLiveEnrollmentTarget {
  packet_type: 'Definition' | 'Bundle';
  target_status: 'canonical_type';
  currently_in_packet_types: true;
  manifest_definition_status: 'defined';
  reason: string;
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
    status: 'missing_coverage',
    reason,
  };
}

export function getPacketTypeModernizationCoverage(
  type: PacketType
): PacketTypeModernizationCoverage {
  const definition = getDefinedPacketTypeDefinition(type);
  const definitionParts = definition ? listPacketDefinitionParts(definition) : [];
  const missing_coverage_items: PacketModernizationPlannedGap[] = [];
  const bodyBuilderPacketTypes = new Set<string>(
    listPacketTypeBodyBuilders().map((builder) => builder.packet_type)
  );
  const mutationPlans = definition
    ? definition.mutations.map((mutation) =>
        resolvePacketDefinitionMutationActionPlan({
          definition,
          mutation_intent: mutation.mutation_intent,
        })
      )
    : [];
  const compatibilityIssues = definition
    ? auditPacketCompatibilityStandard(definition)
    : [];

  const body_schema_status = hasOwnKey(PACKET_BODY_SCHEMAS, type)
    ? 'present'
    : 'missing_coverage';
  if (body_schema_status === 'missing_coverage') {
    missing_coverage_items.push(
      plannedGap(
        'body_schema',
        'Canonical packet ontology types must keep a body schema before modernization can promote them.'
      )
    );
  }

  const compatibility_registry_status = hasOwnKey(
    PACKET_COMPATIBILITY_REGISTRY,
    type
  )
    ? 'present'
    : 'missing_coverage';
  if (compatibility_registry_status === 'missing_coverage') {
    missing_coverage_items.push(
      plannedGap(
        'compatibility_registry',
        'Canonical packet ontology types must keep compatibility metadata before modernization can promote them.'
      )
    );
  }

  const build_pipeline_status = hasGenericPacketBuilderPipeline(type)
    ? 'supported'
    : 'missing_coverage';
  if (build_pipeline_status === 'missing_coverage') {
    missing_coverage_items.push(
      plannedGap(
        'build_pipeline',
        `Generic packet builders currently cover ${GENERIC_PACKET_BUILD_TYPES.length} types; this type is not covered by the active builder registry.`
      )
    );
  }

  const manifest_definition_status = definition ? 'defined' : 'missing_coverage';
  if (manifest_definition_status === 'missing_coverage') {
    missing_coverage_items.push(
      plannedGap(
        'manifest_definition',
        'Preference is the only live ontology type with a manifest definition in the current chapter baseline.'
      )
    );
  }

  const definition_parts_status =
    definitionParts.length > 0 ? 'complete' : 'missing_coverage';
  if (definition_parts_status === 'missing_coverage') {
    missing_coverage_items.push(
      plannedGap(
        'definition_parts',
        'Definition parts will be filled when this type receives its manifest definition.'
      )
    );
  }

  const descriptor_builder_status =
    definition && definition.builders.length > 0 ? 'defined' : 'missing_coverage';
  if (descriptor_builder_status === 'missing_coverage') {
    missing_coverage_items.push(
      plannedGap(
        'build_pipeline',
        'Packet definition has no builder descriptor for packet-type body candidates.'
      )
    );
  }

  const body_builder_status =
    bodyBuilderPacketTypes.has(type) ||
    (GENERIC_PACKET_BUILD_TYPES as readonly string[]).includes(type)
      ? 'supported'
      : 'missing_coverage';
  if (body_builder_status === 'missing_coverage') {
    missing_coverage_items.push(
      plannedGap(
        'build_pipeline',
        'No executable packet-type body builder is registered for this manifest packet type.'
      )
    );
  }

  const definition_mutation_plan_status =
    mutationPlans.length > 0 &&
    mutationPlans.every((plan) => plan.ready_for_runtime)
      ? 'supported'
      : 'missing_coverage';
  if (definition_mutation_plan_status === 'missing_coverage') {
    missing_coverage_items.push(
      plannedGap(
        'manifest_definition',
        'Packet mutation descriptors are missing or not runtime ready.'
      )
    );
  }

  const compatibility_standard_status =
    compatibilityIssues.some((issue) => issue.severity === 'error')
      ? 'missing_coverage'
      : 'supported';
  if (compatibility_standard_status === 'missing_coverage') {
    missing_coverage_items.push(
      plannedGap(
        'compatibility_definition',
        'Manifest compatibility descriptors do not yet meet the current adapter graph standard.'
      )
    );
  }

  return {
    type,
    packet_type: type,
    ontology_enrolled: true,
    body_schema_status,
    compatibility_registry_status,
    build_pipeline_status,
    manifest_definition_status,
    definition_parts_status,
    descriptor_builder_status,
    body_builder_status,
    definition_mutation_plan_status,
    compatibility_standard_status,
    runtime_connector_status: 'not_checked_in_core',
    definition_part_count: definitionParts.length,
    missing_coverage_items,
  };
}

export function listPacketTypeModernizationCoverage(): PacketTypeModernizationCoverage[] {
  return PACKET_TYPES.map((type) => getPacketTypeModernizationCoverage(type));
}

export function listPacketNextPhaseLiveEnrollmentTargets(): PacketNextPhaseLiveEnrollmentTarget[] {
  return (['Definition', 'Bundle'] as const).map((packet_type) => {
    const definition = getDefinedPacketTypeDefinition(packet_type);

    if (!definition) {
      throw new Error(
        `Expected ${packet_type} to remain available in the canonical packet definition manifest.`
      );
    }

    return {
      packet_type,
      target_status: 'canonical_type',
      currently_in_packet_types: true,
      manifest_definition_status: 'defined',
      reason:
        'Definition and Bundle are now canonical packet types with packetized definition-profile seed material.',
    };
  });
}
