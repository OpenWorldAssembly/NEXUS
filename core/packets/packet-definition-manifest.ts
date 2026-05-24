/**
 * File: packet-definition-manifest.ts
 * Description: Active manifest surface for packet type definitions, compatibility posture, and trusted local builders.
 */

import {
  actionPacketDefinition,
  attestationPacketDefinition,
  bundlePacketDefinition,
  claimPacketDefinition,
  definitionPacketDefinition,
  decisionPacketDefinition,
  discussionPacketDefinition,
  elementPacketDefinition,
  locationPacketDefinition,
  policyPacketDefinition,
  preferencePacketDefinition,
  proposalPacketDefinition,
  relationPacketDefinition,
  reportPacketDefinition,
  rolePacketDefinition,
  votePacketDefinition,
  type PacketDefinitionManifest,
  type PacketTypeDefinition,
} from '@core/packets/definitions/index.ts';
import { derivePacketDefinitionActionKinds } from '@core/packets/packet-definition-helpers.ts';
import { createPacketOperationModernizationCoverage } from '@core/packets/packet-operation-ontology.ts';
import {
  getPacketWorkflowPlanDescriptorFromDefinitions,
  listPacketWorkflowPlanDescriptorsFromDefinitions,
} from '@core/packets/packet-workflow-planner.ts';
import {
  auditPacketPolicyDependencyCoverageFromDefinitions,
  listPacketDependencyRequirementDescriptorsFromDefinitions,
  listPacketPolicyRequirementDescriptorsFromDefinitions,
} from '@core/packets/packet-policy-dependency.ts';
import {
  auditPacketDependencySemanticAuthority as auditPacketDependencySemanticAuthorityFromDefinitions,
  listPacketDependencySemanticDescriptors as listPacketDependencySemanticDescriptorsFromDefinitions,
} from '@core/packets/packet-policy-semantics.ts';
import { PACKET_MANIFEST_TEMPLATE_VERSION } from '@core/packets/packet-definition-template.ts';

export const PACKET_TYPE_DEFINITIONS = {
  Definition: definitionPacketDefinition,
  Element: elementPacketDefinition,
  Location: locationPacketDefinition,
  Role: rolePacketDefinition,
  Claim: claimPacketDefinition,
  Relation: relationPacketDefinition,
  Report: reportPacketDefinition,
  Proposal: proposalPacketDefinition,
  Vote: votePacketDefinition,
  Attestation: attestationPacketDefinition,
  Decision: decisionPacketDefinition,
  Action: actionPacketDefinition,
  Discussion: discussionPacketDefinition,
  Policy: policyPacketDefinition,
  Preference: preferencePacketDefinition,
  Bundle: bundlePacketDefinition,
} as const satisfies Record<string, PacketTypeDefinition>;

export type DefinedPacketType =
  keyof typeof PACKET_TYPE_DEFINITIONS;

export const PACKET_DEFINITION_MANIFEST = {
  manifest_type: 'packet_definition_manifest',
  manifest_version: '0.1.0',
  status: 'active',
  template_version: PACKET_MANIFEST_TEMPLATE_VERSION,
  items: Object.values(PACKET_TYPE_DEFINITIONS).map(
    (definition) => ({
      packet_type: definition.packet_type,
      schema_version: definition.current_schema_version,
      definition_status: definition.definition_status,
      storage_class: definition.storage_class,
      action_kinds: derivePacketDefinitionActionKinds(definition),
      action_count: definition.actions.length,
      builder_count: definition.builders.length,
      planner_count: definition.planners.length,
      manifest_role:
        definition.packet_type === 'Bundle'
          ? 'bundle_definition'
          : definition.packet_type === 'Definition'
            ? 'definition_definition'
            : 'packet_type_definition',
    })
  ),
  dependencies: [],
  compatibility_notes: [
    'All active packet type descriptors are canonical definition material; executable behavior remains mapped to trusted local runtime capabilities.',
    'Definition.packet_compatibility parts carry current identity and adjacent version-ladder adapter metadata.',
    'Bundle packets remain carrier inventories and are not the semantic home for packet definitions.',
    'Stored Definition and Bundle packets describe packet semantics, but executable behavior remains trusted-local.',
  ],
} as const satisfies PacketDefinitionManifest;

export function listDefinedPacketTypeDefinitions(): PacketTypeDefinition[] {
  return Object.values(PACKET_TYPE_DEFINITIONS);
}

export function getDefinedPacketTypeDefinition(
  packetType: string
): PacketTypeDefinition | null {
  return PACKET_TYPE_DEFINITIONS[
    packetType as DefinedPacketType
  ] ?? null;
}

export function isDefinedPacketType(
  packetType: string
): packetType is DefinedPacketType {
  return packetType in PACKET_TYPE_DEFINITIONS;
}


export function listPacketDefinitionActions(packetType?: string) {
  const definitions = packetType
    ? [getDefinedPacketTypeDefinition(packetType)].filter(
        (definition): definition is PacketTypeDefinition => definition !== null
      )
    : listDefinedPacketTypeDefinitions();

  return definitions.flatMap((definition) =>
    definition.actions.map((action) => ({
      packet_type: definition.packet_type,
      ...action,
    }))
  );
}

export function listPacketDefinitionBuilders(packetType?: string) {
  const definitions = packetType
    ? [getDefinedPacketTypeDefinition(packetType)].filter(
        (definition): definition is PacketTypeDefinition => definition !== null
      )
    : listDefinedPacketTypeDefinitions();

  return definitions.flatMap((definition) =>
    definition.builders.map((builder) => ({
      packet_type: definition.packet_type,
      ...builder,
    }))
  );
}

export function listPacketDefinitionPlanners(packetType?: string) {
  const definitions = packetType
    ? [getDefinedPacketTypeDefinition(packetType)].filter(
        (definition): definition is PacketTypeDefinition => definition !== null
      )
    : listDefinedPacketTypeDefinitions();

  return definitions.flatMap((definition) =>
    definition.planners.map((planner) => ({
      packet_type: definition.packet_type,
      ...planner,
    }))
  );
}

export function listPacketDefinitionMutations(packetType?: string) {
  const definitions = packetType
    ? [getDefinedPacketTypeDefinition(packetType)].filter(
        (definition): definition is PacketTypeDefinition => definition !== null
      )
    : listDefinedPacketTypeDefinitions();

  return definitions.flatMap((definition) =>
    definition.mutations.map((mutation) => ({
      packet_type: definition.packet_type,
      ...mutation,
    }))
  );
}

export function listPacketOperationModernizationCoverage() {
  return createPacketOperationModernizationCoverage(
    listDefinedPacketTypeDefinitions()
  );
}

export function listPacketWorkflowPlanDescriptors(packetType?: string) {
  return listPacketWorkflowPlanDescriptorsFromDefinitions({
    definitions: listDefinedPacketTypeDefinitions(),
    packetType,
  });
}

export function getPacketWorkflowPlanDescriptor(
  packetType: string,
  workflowPlanId: string
) {
  return getPacketWorkflowPlanDescriptorFromDefinitions({
    definitions: listDefinedPacketTypeDefinitions(),
    packetType,
    workflowPlanId,
  });
}

export function listPacketPolicyRequirementDescriptors() {
  return listPacketPolicyRequirementDescriptorsFromDefinitions({
    definitions: listDefinedPacketTypeDefinitions(),
  });
}

export function listPacketDependencyRequirementDescriptors() {
  return listPacketDependencyRequirementDescriptorsFromDefinitions({
    definitions: listDefinedPacketTypeDefinitions(),
  });
}

export function auditPacketPolicyDependencyCoverage() {
  return auditPacketPolicyDependencyCoverageFromDefinitions({
    definitions: listDefinedPacketTypeDefinitions(),
  });
}

export function listPacketDependencySemanticDescriptors() {
  return listPacketDependencySemanticDescriptorsFromDefinitions({
    definitions: listDefinedPacketTypeDefinitions(),
  });
}

export function auditPacketDependencySemanticAuthority() {
  return auditPacketDependencySemanticAuthorityFromDefinitions({
    definitions: listDefinedPacketTypeDefinitions(),
  });
}

export * from '@core/packets/definitions/index.ts';
export * from '@core/packets/packet-definition-helpers.ts';
export * from '@core/packets/packet-definition-template.ts';
export * from '@core/packets/packet-definition-action-bridge.ts';
export * from '@core/packets/packet-definition-audit.ts';
export * from '@core/packets/packet-type-body-builders.ts';
export * from '@core/packets/packet-definition-seeds.ts';
export * from '@core/packets/packet-operation-ontology.ts';
export * from '@core/packets/packet-workflow-planner.ts';
export * from '@core/packets/packet-policy-dependency.ts';
export * from '@core/packets/packet-defaults.ts';
export {
  auditPacketPolicySemanticAuthority,
  listPacketPolicySemanticDescriptors,
  resolveInitiativePolicyAnchorRefs,
  resolvePacketDefaultPolicyRefs,
  resolvePacketDependencySemanticDescriptor,
  resolvePolicyPacketSemantics,
  type PacketDependencyAuthorityAuditReport,
  type PacketDependencySemanticAnchorKind,
  type PacketDependencySemanticDescriptor,
  type PacketPolicyAuthorityAuditReport,
  type PacketPolicySemanticDescriptor,
  type PacketPolicySemanticKind,
  type PacketSemanticAuthorityAuditFinding,
  type ResolvedPolicyPacketSemantics,
} from '@core/packets/packet-policy-semantics.ts';
