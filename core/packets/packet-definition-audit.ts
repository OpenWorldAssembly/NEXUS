/**
 * File: packet-definition-audit.ts
 * Description: Shadow-mode audit helpers for packet definition manifests, descriptor references, and local runtime capability support.
 */

import type {
  PacketActionDescriptor,
  PacketBuilderDescriptor,
  PacketCompatibilityAdapterDescriptor,
  PacketDefinitionManifest,
  PacketIndexDescriptor,
  PacketMutationDescriptor,
  PacketPlannerDescriptor,
  PacketProjectionDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import type { PacketDefinitionRuntimeCapabilities } from '@core/packets/packet-definition-action-bridge.ts';
import {
  GENERIC_SHADOW_PACKET_RUNTIME_CAPABILITIES,
  resolvePacketDefinitionMutationActionPlan,
} from '@core/packets/packet-definition-action-bridge.ts';
import {
  getPacketDefinitionSectionStatus,
  validatePacketDefinitionTemplateCompliance,
} from '@core/packets/packet-definition-helpers.ts';
import { PACKET_MANIFEST_TEMPLATE_VERSION } from '@core/packets/packet-definition-template.ts';

export type PacketDefinitionAuditSeverity = 'error' | 'warning' | 'info';

export type PacketDefinitionAuditFinding = {
  severity: PacketDefinitionAuditSeverity;
  packet_type: string;
  code: string;
  path: string;
  message: string;
};

export type PacketDefinitionAuditStatus = 'pass' | 'warn' | 'fail';

export type PacketDefinitionAuditReport = {
  audit_version: '0.1.0';
  status: PacketDefinitionAuditStatus;
  packet_type: string | null;
  checked_packet_types: string[];
  finding_counts: Record<PacketDefinitionAuditSeverity, number>;
  findings: PacketDefinitionAuditFinding[];
};

function makeFinding(input: PacketDefinitionAuditFinding): PacketDefinitionAuditFinding {
  return input;
}

function createFindingCounts(
  findings: readonly PacketDefinitionAuditFinding[]
): Record<PacketDefinitionAuditSeverity, number> {
  return findings.reduce<Record<PacketDefinitionAuditSeverity, number>>(
    (counts, finding) => ({
      ...counts,
      [finding.severity]: counts[finding.severity] + 1,
    }),
    { error: 0, warning: 0, info: 0 }
  );
}

function createAuditReport(input: {
  packetType: string | null;
  checkedPacketTypes: readonly string[];
  findings: readonly PacketDefinitionAuditFinding[];
}): PacketDefinitionAuditReport {
  const findingCounts = createFindingCounts(input.findings);

  return {
    audit_version: '0.1.0',
    status:
      findingCounts.error > 0
        ? 'fail'
        : findingCounts.warning > 0
          ? 'warn'
          : 'pass',
    packet_type: input.packetType,
    checked_packet_types: [...input.checkedPacketTypes],
    finding_counts: findingCounts,
    findings: [...input.findings],
  };
}

function findDuplicateIds<TDescriptor>(
  descriptors: readonly TDescriptor[],
  getId: (descriptor: TDescriptor) => string
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const descriptor of descriptors) {
    const id = getId(descriptor);

    if (seen.has(id)) {
      duplicates.add(id);
      continue;
    }

    seen.add(id);
  }

  return Array.from(duplicates).sort((left, right) => left.localeCompare(right));
}

function pushDuplicateFindings<TDescriptor>(input: {
  findings: PacketDefinitionAuditFinding[];
  packetType: string;
  collectionName: string;
  descriptors: readonly TDescriptor[];
  getId: (descriptor: TDescriptor) => string;
}): void {
  for (const duplicateId of findDuplicateIds(input.descriptors, input.getId)) {
    input.findings.push(
      makeFinding({
        severity: 'error',
        packet_type: input.packetType,
        code: 'duplicate_descriptor_id',
        path: `${input.collectionName}.${duplicateId}`,
        message: `Duplicate ${input.collectionName} descriptor id: ${duplicateId}`,
      })
    );
  }
}

function hasSubtype(definition: PacketTypeDefinition, packetSubtype: string | null): boolean {
  return packetSubtype === null || definition.declared_subtypes.includes(packetSubtype);
}

function auditDescriptorSubtypes(input: {
  findings: PacketDefinitionAuditFinding[];
  definition: PacketTypeDefinition;
  actions: readonly PacketActionDescriptor[];
  builders: readonly PacketBuilderDescriptor[];
  adapters: readonly PacketCompatibilityAdapterDescriptor[];
}): void {
  const descriptors = [
    ...input.actions.map((descriptor) => ({
      descriptorType: 'actions',
      id: descriptor.action_id,
      packetSubtype: descriptor.packet_subtype,
    })),
    ...input.builders.map((descriptor) => ({
      descriptorType: 'builders',
      id: descriptor.builder_id,
      packetSubtype: descriptor.packet_subtype,
    })),
    ...input.adapters.map((descriptor) => ({
      descriptorType: 'compatibility_adapters',
      id: descriptor.adapter_id,
      packetSubtype: descriptor.packet_subtype,
    })),
  ];

  for (const descriptor of descriptors) {
    if (hasSubtype(input.definition, descriptor.packetSubtype)) {
      continue;
    }

    input.findings.push(
      makeFinding({
        severity: 'error',
        packet_type: input.definition.packet_type,
        code: 'unknown_subtype_reference',
        path: `${descriptor.descriptorType}.${descriptor.id}.packet_subtype`,
        message: `${descriptor.descriptorType}.${descriptor.id} references undeclared subtype ${descriptor.packetSubtype}`,
      })
    );
  }
}

function auditPlannerReferences(input: {
  findings: PacketDefinitionAuditFinding[];
  definition: PacketTypeDefinition;
  planner: PacketPlannerDescriptor;
  actionIds: Set<string>;
  builderIds: Set<string>;
}): void {
  for (const actionId of input.planner.action_ids) {
    if (input.actionIds.has(actionId)) {
      continue;
    }

    input.findings.push(
      makeFinding({
        severity: 'error',
        packet_type: input.definition.packet_type,
        code: 'unknown_planner_action_reference',
        path: `planners.${input.planner.planner_id}.action_ids`,
        message: `Planner ${input.planner.planner_id} references unknown action ${actionId}`,
      })
    );
  }

  for (const builderId of input.planner.builder_ids) {
    if (input.builderIds.has(builderId)) {
      continue;
    }

    input.findings.push(
      makeFinding({
        severity: 'error',
        packet_type: input.definition.packet_type,
        code: 'unknown_planner_builder_reference',
        path: `planners.${input.planner.planner_id}.builder_ids`,
        message: `Planner ${input.planner.planner_id} references unknown builder ${builderId}`,
      })
    );
  }
}

function auditMutationReferences(input: {
  findings: PacketDefinitionAuditFinding[];
  definition: PacketTypeDefinition;
  mutation: PacketMutationDescriptor;
  actionIds: Set<string>;
  plannerIds: Set<string>;
}): void {
  if (!input.plannerIds.has(input.mutation.planner_id)) {
    input.findings.push(
      makeFinding({
        severity: 'error',
        packet_type: input.definition.packet_type,
        code: 'unknown_mutation_planner_reference',
        path: `mutations.${input.mutation.mutation_intent}.planner_id`,
        message: `Mutation ${input.mutation.mutation_intent} references unknown planner ${input.mutation.planner_id}`,
      })
    );
  }

  for (const actionId of input.mutation.action_ids) {
    if (input.actionIds.has(actionId)) {
      continue;
    }

    input.findings.push(
      makeFinding({
        severity: 'error',
        packet_type: input.definition.packet_type,
        code: 'unknown_mutation_action_reference',
        path: `mutations.${input.mutation.mutation_intent}.action_ids`,
        message: `Mutation ${input.mutation.mutation_intent} references unknown action ${actionId}`,
      })
    );
  }
}

function auditCompatibilityPosture(input: {
  findings: PacketDefinitionAuditFinding[];
  definition: PacketTypeDefinition;
}): void {
  const currentVersion = input.definition.current_schema_version;

  if (input.definition.compatibility.current_schema_version !== currentVersion) {
    input.findings.push(
      makeFinding({
        severity: 'error',
        packet_type: input.definition.packet_type,
        code: 'compatibility_version_mismatch',
        path: 'compatibility.current_schema_version',
        message: `Compatibility posture current version ${input.definition.compatibility.current_schema_version} does not match definition current version ${currentVersion}`,
      })
    );
  }

  for (const adapter of input.definition.compatibility_adapters) {
    const touchesCurrent =
      adapter.from_schema_version === currentVersion || adapter.to_schema_version === currentVersion;

    if (touchesCurrent) {
      continue;
    }

    input.findings.push(
      makeFinding({
        severity: 'warning',
        packet_type: input.definition.packet_type,
        code: 'compatibility_adapter_not_current_neighbor',
        path: `compatibility_adapters.${adapter.adapter_id}`,
        message: `Adapter ${adapter.adapter_id} does not touch current schema version ${currentVersion}; full chains should usually travel in Bundle packets instead.`,
      })
    );
  }
}

function auditRuntimeCapabilitySupport(input: {
  findings: PacketDefinitionAuditFinding[];
  definition: PacketTypeDefinition;
  capabilities: PacketDefinitionRuntimeCapabilities;
  requireShadowRuntimeReady: boolean;
}): void {
  for (const mutation of input.definition.mutations) {
    const plan = resolvePacketDefinitionMutationActionPlan({
      definition: input.definition,
      mutation_intent: mutation.mutation_intent,
      capabilities: input.capabilities,
    });

    for (const missingId of plan.missing_descriptor_ids) {
      input.findings.push(
        makeFinding({
          severity: 'error',
          packet_type: input.definition.packet_type,
          code: 'mutation_plan_missing_descriptor',
          path: `mutations.${mutation.mutation_intent}`,
          message: `Mutation plan is missing descriptor ${missingId}`,
        })
      );
    }

    for (const unsupportedCapability of plan.unsupported_capabilities) {
      input.findings.push(
        makeFinding({
          severity: input.requireShadowRuntimeReady ? 'error' : 'warning',
          packet_type: input.definition.packet_type,
          code: 'mutation_plan_unsupported_capability',
          path: `mutations.${mutation.mutation_intent}`,
          message: `Mutation ${mutation.mutation_intent} requires unsupported ${unsupportedCapability}`,
        })
      );
    }

    if (input.requireShadowRuntimeReady && !plan.ready_for_shadow_runtime) {
      input.findings.push(
        makeFinding({
          severity: 'error',
          packet_type: input.definition.packet_type,
          code: 'mutation_plan_not_shadow_ready',
          path: `mutations.${mutation.mutation_intent}`,
          message: `Mutation ${mutation.mutation_intent} is not ready for the declared shadow runtime capabilities.`,
        })
      );
    }
  }
}

export function auditPacketTypeDefinition(input: {
  definition: PacketTypeDefinition;
  capabilities?: PacketDefinitionRuntimeCapabilities;
  requireShadowRuntimeReady?: boolean;
  templateVersion?: string;
}): PacketDefinitionAuditReport {
  const definition = input.definition;
  const findings: PacketDefinitionAuditFinding[] = [];
  const templateVersion = input.templateVersion ?? PACKET_MANIFEST_TEMPLATE_VERSION;
  const capabilities = input.capabilities ?? GENERIC_SHADOW_PACKET_RUNTIME_CAPABILITIES;
  const compliance = validatePacketDefinitionTemplateCompliance(definition, templateVersion);

  for (const sectionKey of compliance.missing_required_sections) {
    findings.push(
      makeFinding({
        severity: 'error',
        packet_type: definition.packet_type,
        code: 'missing_required_template_section',
        path: `sections.${sectionKey}`,
        message: `Required packet manifest section ${sectionKey} is unsupported.`,
      })
    );
  }

  if (!definition.declared_subtypes.includes(definition.default_subtype)) {
    findings.push(
      makeFinding({
        severity: 'error',
        packet_type: definition.packet_type,
        code: 'default_subtype_not_declared',
        path: 'default_subtype',
        message: `Default subtype ${definition.default_subtype} is not declared by ${definition.packet_type}.`,
      })
    );
  }

  if (definition.id_strategy.packet_id_mode === 'deterministic' && definition.id_strategy.uniqueness_fields.length === 0) {
    findings.push(
      makeFinding({
        severity: 'warning',
        packet_type: definition.packet_type,
        code: 'deterministic_id_without_uniqueness_fields',
        path: 'id_strategy.uniqueness_fields',
        message: 'Deterministic packet id strategies should declare at least one uniqueness field.',
      })
    );
  }

  const actionIds = new Set(definition.actions.map((descriptor) => descriptor.action_id));
  const builderIds = new Set(definition.builders.map((descriptor) => descriptor.builder_id));
  const plannerIds = new Set(definition.planners.map((descriptor) => descriptor.planner_id));

  pushDuplicateFindings({
    findings,
    packetType: definition.packet_type,
    collectionName: 'actions',
    descriptors: definition.actions,
    getId: (descriptor) => descriptor.action_id,
  });
  pushDuplicateFindings({
    findings,
    packetType: definition.packet_type,
    collectionName: 'builders',
    descriptors: definition.builders,
    getId: (descriptor) => descriptor.builder_id,
  });
  pushDuplicateFindings({
    findings,
    packetType: definition.packet_type,
    collectionName: 'planners',
    descriptors: definition.planners,
    getId: (descriptor) => descriptor.planner_id,
  });
  pushDuplicateFindings({
    findings,
    packetType: definition.packet_type,
    collectionName: 'mutations',
    descriptors: definition.mutations,
    getId: (descriptor) => descriptor.mutation_intent,
  });
  pushDuplicateFindings({
    findings,
    packetType: definition.packet_type,
    collectionName: 'compatibility_adapters',
    descriptors: definition.compatibility_adapters,
    getId: (descriptor) => descriptor.adapter_id,
  });
  pushDuplicateFindings({
    findings,
    packetType: definition.packet_type,
    collectionName: 'projections',
    descriptors: definition.projections,
    getId: (descriptor) => descriptor.projection_key,
  });
  pushDuplicateFindings({
    findings,
    packetType: definition.packet_type,
    collectionName: 'indexes',
    descriptors: definition.indexes,
    getId: (descriptor) => descriptor.index_key,
  });

  auditDescriptorSubtypes({
    findings,
    definition,
    actions: definition.actions,
    builders: definition.builders,
    adapters: definition.compatibility_adapters,
  });

  for (const builder of definition.builders) {
    for (const actionId of builder.action_ids) {
      if (actionIds.has(actionId)) {
        continue;
      }

      findings.push(
        makeFinding({
          severity: 'error',
          packet_type: definition.packet_type,
          code: 'unknown_builder_action_reference',
          path: `builders.${builder.builder_id}.action_ids`,
          message: `Builder ${builder.builder_id} references unknown action ${actionId}`,
        })
      );
    }
  }

  for (const planner of definition.planners) {
    auditPlannerReferences({ findings, definition, planner, actionIds, builderIds });
  }

  for (const mutation of definition.mutations) {
    auditMutationReferences({ findings, definition, mutation, actionIds, plannerIds });
  }

  auditCompatibilityPosture({ findings, definition });
  auditRuntimeCapabilitySupport({
    findings,
    definition,
    capabilities,
    requireShadowRuntimeReady: input.requireShadowRuntimeReady ?? false,
  });

  for (const sectionKey of compliance.unsupported_sections) {
    const status = getPacketDefinitionSectionStatus(definition, sectionKey);

    findings.push(
      makeFinding({
        severity: status === 'unsupported' ? 'warning' : 'info',
        packet_type: definition.packet_type,
        code: 'unsupported_template_section',
        path: `sections.${sectionKey}`,
        message: `Packet manifest section ${sectionKey} is currently ${status}.`,
      })
    );
  }

  return createAuditReport({
    packetType: definition.packet_type,
    checkedPacketTypes: [definition.packet_type],
    findings,
  });
}

export function auditPacketDefinitionManifest(input: {
  manifest: PacketDefinitionManifest;
  definitions: readonly PacketTypeDefinition[];
  capabilities?: PacketDefinitionRuntimeCapabilities;
  requireShadowRuntimeReady?: boolean;
}): PacketDefinitionAuditReport {
  const findings: PacketDefinitionAuditFinding[] = [];
  const packetTypes = input.definitions.map((definition) => definition.packet_type);

  for (const duplicatePacketType of findDuplicateIds(input.definitions, (definition) => definition.packet_type)) {
    findings.push(
      makeFinding({
        severity: 'error',
        packet_type: duplicatePacketType,
        code: 'duplicate_packet_type_definition',
        path: `definitions.${duplicatePacketType}`,
        message: `Duplicate packet type definition registered for ${duplicatePacketType}.`,
      })
    );
  }

  if (input.manifest.template_version !== PACKET_MANIFEST_TEMPLATE_VERSION) {
    findings.push(
      makeFinding({
        severity: 'warning',
        packet_type: 'manifest',
        code: 'manifest_template_version_mismatch',
        path: 'manifest.template_version',
        message: `Manifest template version ${input.manifest.template_version} differs from local template ${PACKET_MANIFEST_TEMPLATE_VERSION}.`,
      })
    );
  }

  const manifestItemPacketTypes = new Set(input.manifest.items.map((item) => item.packet_type));

  for (const definition of input.definitions) {
    if (!manifestItemPacketTypes.has(definition.packet_type)) {
      findings.push(
        makeFinding({
          severity: 'error',
          packet_type: definition.packet_type,
          code: 'definition_missing_manifest_item',
          path: `manifest.items.${definition.packet_type}`,
          message: `Definition ${definition.packet_type} is not represented in the manifest items list.`,
        })
      );
    }

    findings.push(
      ...auditPacketTypeDefinition({
        definition,
        capabilities: input.capabilities,
        requireShadowRuntimeReady: input.requireShadowRuntimeReady,
        templateVersion: input.manifest.template_version,
      }).findings
    );
  }

  return createAuditReport({
    packetType: null,
    checkedPacketTypes: packetTypes,
    findings,
  });
}
