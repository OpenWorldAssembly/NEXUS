/**
 * File: packet-modernization-coverage.ts
 * Description: Audits packet-family modernization coverage for the manifest/runtime chapter.
 */

import {
  getExperimentalPacketTypeDefinition,
  listPacketDefinitionParts,
} from '@core/packets/packet-definition-manifest';
import {
  GENERIC_PACKET_BUILD_FAMILIES,
  hasGenericPacketBuilderPipeline,
} from '@core/packets/packet-build-pipeline';
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
  target_status: 'next_phase_live_enrollment';
  currently_in_packet_families: false;
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
      target_status: 'next_phase_live_enrollment',
      currently_in_packet_families: false,
      manifest_definition_status: 'defined',
      reason:
        'Definition and Bundle are experimental manifest packet types for this chapter, not live PacketEnvelope families yet.',
    };
  });
}
