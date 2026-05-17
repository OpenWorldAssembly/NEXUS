/**
 * File: packet-definition-helpers.ts
 * Description: Generic shadow-mode helpers for reading packet definition manifest sections.
 */

import type {
  PacketActionDescriptor,
  PacketActionKind,
  PacketBuilderDescriptor,
  PacketCompatibilityAdapterDescriptor,
  PacketIndexDescriptor,
  PacketManifestSectionKey,
  PacketManifestSectionStatus,
  PacketMutationDescriptor,
  PacketPlannerDescriptor,
  PacketProjectionDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import {
  PACKET_MANIFEST_DEFINITION_TEMPLATE,
  listRequiredPacketManifestTemplateSectionKeys,
} from '@core/packets/packet-definition-template.ts';

export type PacketDefinitionTemplateCompliance = {
  packet_type: string;
  template_version: string;
  missing_required_sections: PacketManifestSectionKey[];
  unsupported_sections: PacketManifestSectionKey[];
  derived_action_kinds: PacketActionKind[];
};

export function getPacketDefinitionIdentity(definition: PacketTypeDefinition) {
  return {
    packet_type: definition.packet_type,
    canonical_body_type: definition.canonical_body_type,
    definition_status: definition.definition_status,
    current_schema_version: definition.current_schema_version,
    declared_subtypes: definition.declared_subtypes,
    default_subtype: definition.default_subtype,
  } as const;
}

export function getPacketDefinitionSchema(definition: PacketTypeDefinition) {
  return {
    body_schema: definition.body_schema,
    canonical_body_type: definition.canonical_body_type,
    declared_subtypes: definition.declared_subtypes,
    default_subtype: definition.default_subtype,
  } as const;
}

export function getPacketDefinitionStorage(definition: PacketTypeDefinition) {
  return {
    storage_class: definition.storage_class,
  } as const;
}

export function getPacketDefinitionRevision(definition: PacketTypeDefinition) {
  return {
    revision_behavior: definition.revision_behavior,
    id_strategy: definition.id_strategy,
  } as const;
}

export function listPacketDefinitionActions(
  definition: PacketTypeDefinition,
  actionKind?: PacketActionKind
): PacketActionDescriptor[] {
  return definition.actions.filter(
    (action) => actionKind === undefined || action.action_kind === actionKind
  );
}

export function getPacketDefinitionAction(
  definition: PacketTypeDefinition,
  actionId: string
): PacketActionDescriptor | null {
  return definition.actions.find((action) => action.action_id === actionId) ?? null;
}

export function derivePacketDefinitionActionKinds(
  definition: PacketTypeDefinition
): PacketActionKind[] {
  return Array.from(new Set(definition.actions.map((action) => action.action_kind))).sort();
}

export function listPacketDefinitionBuilders(
  definition: PacketTypeDefinition,
  packetSubtype?: string | null
): PacketBuilderDescriptor[] {
  return definition.builders.filter(
    (builder) => packetSubtype === undefined || builder.packet_subtype === packetSubtype
  );
}

export function getPacketDefinitionBuilder(
  definition: PacketTypeDefinition,
  builderId: string
): PacketBuilderDescriptor | null {
  return definition.builders.find((builder) => builder.builder_id === builderId) ?? null;
}

export function listPacketDefinitionPlanners(
  definition: PacketTypeDefinition
): PacketPlannerDescriptor[] {
  return [...definition.planners];
}

export function getPacketDefinitionPlanner(
  definition: PacketTypeDefinition,
  plannerId: string
): PacketPlannerDescriptor | null {
  return definition.planners.find((planner) => planner.planner_id === plannerId) ?? null;
}

export function listPacketDefinitionPolicyActionIds(
  definition: PacketTypeDefinition
): string[] {
  const actionPolicyIds = definition.actions
    .map((action) => action.policy_action_id)
    .filter((policyActionId): policyActionId is string => policyActionId !== null);
  const plannerPolicyIds = definition.planners.flatMap(
    (planner) => planner.policy_action_ids
  );

  return Array.from(new Set([...actionPolicyIds, ...plannerPolicyIds])).sort();
}

export function listPacketDefinitionMutations(
  definition: PacketTypeDefinition
): PacketMutationDescriptor[] {
  return [...definition.mutations];
}

export function listPacketDefinitionProjections(
  definition: PacketTypeDefinition
): PacketProjectionDescriptor[] {
  return [...definition.projections];
}

export function listPacketDefinitionIndexes(
  definition: PacketTypeDefinition
): PacketIndexDescriptor[] {
  return [...definition.indexes];
}

export function getPacketDefinitionCompatibility(definition: PacketTypeDefinition) {
  return {
    posture: definition.compatibility,
    adapters: definition.compatibility_adapters,
  } as const;
}

export function listPacketDefinitionCompatibilityAdapters(
  definition: PacketTypeDefinition
): PacketCompatibilityAdapterDescriptor[] {
  return [...definition.compatibility_adapters];
}

export function listPacketDefinitionBundleActionIds(
  definition: PacketTypeDefinition
): string[] {
  return definition.actions
    .filter((action) => ['bundle', 'import', 'export'].includes(action.action_kind))
    .map((action) => action.action_id);
}

export function getPacketDefinitionSectionStatus(
  definition: PacketTypeDefinition,
  sectionKey: PacketManifestSectionKey
): PacketManifestSectionStatus {
  if (definition.section_statuses?.[sectionKey]) {
    return definition.section_statuses[sectionKey];
  }

  switch (sectionKey) {
    case 'actions':
      return definition.actions.length > 0 ? 'supported' : 'unsupported';
    case 'builders':
      return definition.builders.length > 0 ? 'supported' : 'unsupported';
    case 'planners':
      return definition.planners.length > 0 ? 'supported' : 'unsupported';
    case 'policy':
      return listPacketDefinitionPolicyActionIds(definition).length > 0
        ? 'supported'
        : 'deferred';
    case 'projection':
      return definition.projections.length > 0 ? 'supported' : 'deferred';
    case 'indexing':
      return definition.indexes.length > 0 ? 'supported' : 'deferred';
    case 'compatibility':
      return definition.compatibility_adapters.length > 0 ? 'supported' : 'deferred';
    case 'bundling':
      return listPacketDefinitionBundleActionIds(definition).length > 0
        ? 'supported'
        : 'deferred';
    case 'fixtures':
      return definition.fixtures && definition.fixtures.length > 0
        ? 'supported'
        : 'deferred';
    default:
      return 'supported';
  }
}

export function validatePacketDefinitionTemplateCompliance(
  definition: PacketTypeDefinition,
  templateVersion: string
): PacketDefinitionTemplateCompliance {
  const requiredSections = listRequiredPacketManifestTemplateSectionKeys();
  const missingRequiredSections = requiredSections.filter(
    (sectionKey) => getPacketDefinitionSectionStatus(definition, sectionKey) === 'unsupported'
  );
  const unsupportedSections = PACKET_MANIFEST_DEFINITION_TEMPLATE.filter(
    (section) => getPacketDefinitionSectionStatus(definition, section.section_key) === 'unsupported'
  ).map((section) => section.section_key);

  return {
    packet_type: definition.packet_type,
    template_version: templateVersion,
    missing_required_sections: missingRequiredSections,
    unsupported_sections: unsupportedSections,
    derived_action_kinds: derivePacketDefinitionActionKinds(definition),
  };
}
