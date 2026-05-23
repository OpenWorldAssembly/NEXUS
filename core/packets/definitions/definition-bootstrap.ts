/**
 * File: definition-bootstrap.ts
 * Description: Native definition bootstrap helpers for resolving Definition packet parts into local packet definitions.
 */

import type {
  PacketDefinitionPartDescriptor,
  PacketDefinitionPartSubtype,
  PacketTypeDefinition,
} from './packet-definition-types.ts';

export const DEFINITION_BOOTSTRAP_VERSION = '0.1.0' as const;

export const REQUIRED_PACKET_DEFINITION_PARTS = [
  'packet_definition',
  'packet_schema',
  'packet_action_registry',
  'packet_builder_descriptor',
  'packet_planner_descriptor',
  'packet_projection_descriptor',
  'packet_compatibility',
  'packet_dependency',
] as const satisfies readonly PacketDefinitionPartSubtype[];

export type ResolvedDefinitionBootstrapProfile = {
  bootstrap_version: typeof DEFINITION_BOOTSTRAP_VERSION;
  packet_type: string;
  packet_subtype: string | null;
  definition_status: PacketTypeDefinition['definition_status'];
  schema_version: string;
  parts: readonly PacketDefinitionPartDescriptor[];
  missing_required_part_subtypes: PacketDefinitionPartSubtype[];
  supported_subtypes_from_schema_parts: string[];
  runtime_ready: boolean;
};

export function listPacketDefinitionParts(
  definition: PacketTypeDefinition
): PacketDefinitionPartDescriptor[] {
  return [...(definition.packet_definition_parts ?? [])];
}

export function listPacketDefinitionPartsBySubtype(
  definition: PacketTypeDefinition,
  partSubtype: PacketDefinitionPartSubtype
): PacketDefinitionPartDescriptor[] {
  return listPacketDefinitionParts(definition).filter(
    (part) => part.part_subtype === partSubtype
  );
}

export function getSupportedSubtypesFromSchemaParts(
  definition: PacketTypeDefinition
): string[] {
  const covered = listPacketDefinitionPartsBySubtype(definition, 'packet_schema').flatMap(
    (part) => part.covers_subtypes ?? []
  );

  return Array.from(new Set(covered)).sort((left, right) => left.localeCompare(right));
}

export function resolveDefinitionBootstrapProfile(
  definition: PacketTypeDefinition
): ResolvedDefinitionBootstrapProfile {
  const parts = listPacketDefinitionParts(definition);
  const partSubtypes = new Set(parts.filter((part) => part.required).map((part) => part.part_subtype));
  const missingRequired = REQUIRED_PACKET_DEFINITION_PARTS.filter(
    (partSubtype) => !partSubtypes.has(partSubtype)
  );

  return {
    bootstrap_version: DEFINITION_BOOTSTRAP_VERSION,
    packet_type: definition.packet_type,
    packet_subtype: definition.default_subtype ?? null,
    definition_status: definition.definition_status,
    schema_version: definition.current_schema_version,
    parts,
    missing_required_part_subtypes: missingRequired,
    supported_subtypes_from_schema_parts: getSupportedSubtypesFromSchemaParts(definition),
    runtime_ready:
      missingRequired.length === 0 &&
      parts.every((part) =>
        part.availability === 'runtime_ready' || part.availability === 'canonical'
      ) &&
      definition.definition_status === 'canonical',
  };
}

export function isDefinitionBootstrapComplete(definition: PacketTypeDefinition): boolean {
  return resolveDefinitionBootstrapProfile(definition).missing_required_part_subtypes.length === 0;
}
