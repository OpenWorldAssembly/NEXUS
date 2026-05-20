/**
 * File: packet-definition-manifest.ts
 * Description: Active manifest surface for packet type definitions, compatibility posture, and trusted local builders.
 */

import {
  actionPacketDefinition,
  attestationPacketDefinition,
  bundlePacketDefinition,
  causePacketDefinition,
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

export const EXPERIMENTAL_PACKET_TYPE_DEFINITIONS = {
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
  Cause: causePacketDefinition,
  Action: actionPacketDefinition,
  Discussion: discussionPacketDefinition,
  Policy: policyPacketDefinition,
  Preference: preferencePacketDefinition,
  Bundle: bundlePacketDefinition,
} as const satisfies Record<string, PacketTypeDefinition>;

export type ExperimentalPacketType =
  keyof typeof EXPERIMENTAL_PACKET_TYPE_DEFINITIONS;

export const PACKET_DEFINITION_MANIFEST = {
  manifest_type: 'packet_definition_manifest',
  manifest_version: '0.1.0',
  status: 'active',
  template_version: PACKET_MANIFEST_TEMPLATE_VERSION,
  items: Object.values(EXPERIMENTAL_PACKET_TYPE_DEFINITIONS).map(
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
    'Definition, Bundle, and Preference are canonical packet families; generic family descriptors remain staged where their live runtime enrollment is still shadowed.',
    'Definition.packet_compatibility parts carry current identity and adjacent version-ladder adapter metadata.',
    'Bundle packets remain carrier inventories and are not the semantic home for packet definitions.',
    'Stored Definition and Bundle packets describe packet semantics, but executable behavior remains trusted-local.',
  ],
} as const satisfies PacketDefinitionManifest;

export function listExperimentalPacketTypeDefinitions(): PacketTypeDefinition[] {
  return Object.values(EXPERIMENTAL_PACKET_TYPE_DEFINITIONS);
}

export function getExperimentalPacketTypeDefinition(
  packetType: string
): PacketTypeDefinition | null {
  return EXPERIMENTAL_PACKET_TYPE_DEFINITIONS[
    packetType as ExperimentalPacketType
  ] ?? null;
}

export function isExperimentalPacketType(
  packetType: string
): packetType is ExperimentalPacketType {
  return packetType in EXPERIMENTAL_PACKET_TYPE_DEFINITIONS;
}


export function listExperimentalPacketActions(packetType?: string) {
  const definitions = packetType
    ? [getExperimentalPacketTypeDefinition(packetType)].filter(
        (definition): definition is PacketTypeDefinition => definition !== null
      )
    : listExperimentalPacketTypeDefinitions();

  return definitions.flatMap((definition) =>
    definition.actions.map((action) => ({
      packet_type: definition.packet_type,
      ...action,
    }))
  );
}

export function listExperimentalPacketBuilders(packetType?: string) {
  const definitions = packetType
    ? [getExperimentalPacketTypeDefinition(packetType)].filter(
        (definition): definition is PacketTypeDefinition => definition !== null
      )
    : listExperimentalPacketTypeDefinitions();

  return definitions.flatMap((definition) =>
    definition.builders.map((builder) => ({
      packet_type: definition.packet_type,
      ...builder,
    }))
  );
}

export function listExperimentalPacketPlanners(packetType?: string) {
  const definitions = packetType
    ? [getExperimentalPacketTypeDefinition(packetType)].filter(
        (definition): definition is PacketTypeDefinition => definition !== null
      )
    : listExperimentalPacketTypeDefinitions();

  return definitions.flatMap((definition) =>
    definition.planners.map((planner) => ({
      packet_type: definition.packet_type,
      ...planner,
    }))
  );
}

export function listExperimentalPacketMutations(packetType?: string) {
  const definitions = packetType
    ? [getExperimentalPacketTypeDefinition(packetType)].filter(
        (definition): definition is PacketTypeDefinition => definition !== null
      )
    : listExperimentalPacketTypeDefinitions();

  return definitions.flatMap((definition) =>
    definition.mutations.map((mutation) => ({
      packet_type: definition.packet_type,
      ...mutation,
    }))
  );
}

export function listPacketOperationModernizationCoverage() {
  return createPacketOperationModernizationCoverage(
    listExperimentalPacketTypeDefinitions()
  );
}

export function listPacketWorkflowPlanDescriptors(packetType?: string) {
  return listPacketWorkflowPlanDescriptorsFromDefinitions({
    definitions: listExperimentalPacketTypeDefinitions(),
    packetType,
  });
}

export function getPacketWorkflowPlanDescriptor(
  packetType: string,
  workflowPlanId: string
) {
  return getPacketWorkflowPlanDescriptorFromDefinitions({
    definitions: listExperimentalPacketTypeDefinitions(),
    packetType,
    workflowPlanId,
  });
}

export function listPacketPolicyRequirementDescriptors() {
  return listPacketPolicyRequirementDescriptorsFromDefinitions({
    definitions: listExperimentalPacketTypeDefinitions(),
  });
}

export function listPacketDependencyRequirementDescriptors() {
  return listPacketDependencyRequirementDescriptorsFromDefinitions({
    definitions: listExperimentalPacketTypeDefinitions(),
  });
}

export function auditPacketPolicyDependencyCoverage() {
  return auditPacketPolicyDependencyCoverageFromDefinitions({
    definitions: listExperimentalPacketTypeDefinitions(),
  });
}

export function listPacketDependencySemanticDescriptors() {
  return listPacketDependencySemanticDescriptorsFromDefinitions({
    definitions: listExperimentalPacketTypeDefinitions(),
  });
}

export function auditPacketDependencySemanticAuthority() {
  return auditPacketDependencySemanticAuthorityFromDefinitions({
    definitions: listExperimentalPacketTypeDefinitions(),
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
