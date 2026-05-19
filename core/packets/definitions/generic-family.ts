/**
 * File: generic-family.ts
 * Description: Factory-backed shadow definitions for generic builder-supported packet families.
 */

import {
  ATTESTATION_SUBTYPES,
  CLAIM_SUBTYPES,
  DISCUSSION_KINDS,
  ELEMENT_KINDS,
  LOCATION_SUBTYPES,
  PACKET_BODY_SCHEMAS,
  PACKET_COMPATIBILITY_REGISTRY,
  RELATION_SUBTYPES,
  type PacketFamily,
} from '@core/schema/packet-schema';

import type {
  PacketDefinitionPartDescriptor,
  PacketProjectionDescriptor,
  PacketRevisionBehavior,
  PacketTypeDefinition,
} from './packet-definition-types.ts';
import {
  createRegistryCompatibilityAdapterDescriptors,
  derivePacketCompatibilityPosture,
} from './compatibility-standard.ts';

type GenericBuilderFamily =
  | 'Element'
  | 'Location'
  | 'Role'
  | 'Claim'
  | 'Relation'
  | 'Report'
  | 'Proposal'
  | 'Vote'
  | 'Attestation'
  | 'Decision'
  | 'Cause'
  | 'Action'
  | 'Discussion'
  | 'Policy';

type GenericFamilyDefinitionConfig<TFamily extends GenericBuilderFamily> = {
  family: TFamily;
  canonical_body_type: string;
  declared_subtypes: readonly string[];
  default_subtype: string;
  storage_class?: PacketTypeDefinition['storage_class'];
  projections?: readonly PacketProjectionDescriptor[];
  index_fields?: readonly string[];
  notes?: readonly string[];
};

const GENERIC_FAMILY_CONFIGS = [
  {
    family: 'Element',
    canonical_body_type: 'element',
    declared_subtypes: ELEMENT_KINDS,
    default_subtype: 'assembly',
    index_fields: ['body.kind', 'body.subtype', 'body.name'],
  },
  {
    family: 'Location',
    canonical_body_type: 'location',
    declared_subtypes: LOCATION_SUBTYPES,
    default_subtype: 'point',
    index_fields: ['body.subtype', 'body.title', 'body.status'],
  },
  {
    family: 'Role',
    canonical_body_type: 'role',
    declared_subtypes: ['role'],
    default_subtype: 'role',
    index_fields: ['body.role_kind', 'body.title', 'body.status'],
  },
  {
    family: 'Claim',
    canonical_body_type: 'claim',
    declared_subtypes: CLAIM_SUBTYPES,
    default_subtype: 'relation_assertion',
    index_fields: ['body.subtype', 'body.target_ref.packet_id', 'body.status'],
  },
  {
    family: 'Relation',
    canonical_body_type: 'relation',
    declared_subtypes: RELATION_SUBTYPES,
    default_subtype: 'assembly_association',
    index_fields: [
      'body.subtype',
      'body.subject_ref.packet_id',
      'body.target_ref.packet_id',
    ],
  },
  {
    family: 'Report',
    canonical_body_type: 'report',
    declared_subtypes: ['verification_report', 'import_report'],
    default_subtype: 'verification_report',
    index_fields: ['body.subtype', 'body.target_ref.packet_id', 'body.status'],
  },
  {
    family: 'Proposal',
    canonical_body_type: 'proposal',
    declared_subtypes: ['proposal'],
    default_subtype: 'proposal',
    index_fields: ['body.proposal_kind', 'body.title', 'body.status'],
  },
  {
    family: 'Vote',
    canonical_body_type: 'vote',
    declared_subtypes: ['vote'],
    default_subtype: 'vote',
    index_fields: ['body.proposal_ref.packet_id', 'body.vote_method', 'body.status'],
  },
  {
    family: 'Attestation',
    canonical_body_type: 'attestation',
    declared_subtypes: ATTESTATION_SUBTYPES,
    default_subtype: 'packet_signal',
    index_fields: ['body.subtype', 'body.target_ref.packet_id', 'body.status'],
  },
  {
    family: 'Decision',
    canonical_body_type: 'decision',
    declared_subtypes: ['decision'],
    default_subtype: 'decision',
    index_fields: ['body.outcome', 'body.title'],
  },
  {
    family: 'Cause',
    canonical_body_type: 'cause',
    declared_subtypes: ['cause'],
    default_subtype: 'cause',
    index_fields: ['body.subtype', 'body.title', 'body.status'],
  },
  {
    family: 'Action',
    canonical_body_type: 'action',
    declared_subtypes: ['action'],
    default_subtype: 'action',
    index_fields: ['body.subtype', 'body.title', 'body.status'],
  },
  {
    family: 'Discussion',
    canonical_body_type: 'discussion',
    declared_subtypes: DISCUSSION_KINDS,
    default_subtype: 'space',
    index_fields: ['body.kind', 'body.role', 'body.title'],
  },
  {
    family: 'Policy',
    canonical_body_type: 'policy',
    declared_subtypes: ['policy'],
    default_subtype: 'policy',
    index_fields: ['body.policy_kind', 'body.title', 'body.status'],
  },
] as const satisfies readonly GenericFamilyDefinitionConfig<GenericBuilderFamily>[];

function lowerFirst(value: string): string {
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function toKebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function toRevisionBehavior(family: PacketFamily): PacketRevisionBehavior {
  const revisionMode = PACKET_COMPATIBILITY_REGISTRY[family].revision_mode;

  if (revisionMode === 'append_only') {
    return 'append_only';
  }

  if (revisionMode === 'mergeable') {
    return 'mergeable';
  }

  return 'replaceable';
}

function createDefinitionParts(input: {
  family: GenericBuilderFamily;
  defaultSubtype: string;
  schemaVersion: string;
  actionIds: readonly string[];
  builderId: string;
  plannerIds: readonly string[];
  projectionKey: string;
  indexKey: string;
  compatibilityAdapterIds: readonly string[];
  declaredSubtypes: readonly string[];
}): PacketDefinitionPartDescriptor[] {
  const baseId = lowerFirst(input.family);

  return [
    {
      part_id: `${baseId}.packet_definition.v0`,
      part_subtype: 'packet_definition',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      references: [
        `${baseId}.packet_schema.v0`,
        `${baseId}.packet_action_registry.v0`,
        `${baseId}.packet_builder_descriptor.v0`,
        `${baseId}.packet_planner_descriptor.v0`,
        `${baseId}.packet_projection_descriptor.v0`,
        `${baseId}.packet_compatibility.v0`,
        `${baseId}.packet_dependency.v0`,
      ],
      notes: `Root shadow definition record for ${input.family}.`,
    },
    {
      part_id: `${baseId}.packet_schema.v0`,
      part_subtype: 'packet_schema',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      covers_subtypes: input.declaredSubtypes,
      notes: `Schema part backed by the canonical ${input.family} body schema.`,
    },
    {
      part_id: `${baseId}.packet_action_registry.v0`,
      part_subtype: 'packet_action_registry',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      references: input.actionIds,
      notes: `Action registry part for generic ${input.family} packet operations.`,
    },
    {
      part_id: `${baseId}.packet_builder_descriptor.v0`,
      part_subtype: 'packet_builder_descriptor',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      references: [input.builderId],
      notes: `Builder descriptor part for the generic ${input.family} body builder.`,
    },
    {
      part_id: `${baseId}.packet_planner_descriptor.v0`,
      part_subtype: 'packet_planner_descriptor',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      references: input.plannerIds,
      notes: `Planner descriptor part for generic ${input.family} writes and projections.`,
    },
    {
      part_id: `${baseId}.packet_projection_descriptor.v0`,
      part_subtype: 'packet_projection_descriptor',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      references: [input.projectionKey],
      notes: `Projection descriptor part for generic ${input.family} read models.`,
    },
    {
      part_id: `${baseId}.packet_compatibility.v0`,
      part_subtype: 'packet_compatibility',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      references: input.compatibilityAdapterIds,
      notes: `Compatibility part summarizing the canonical ${input.family} compatibility registry entry.`,
    },
    {
      part_id: `${baseId}.packet_dependency.v0`,
      part_subtype: 'packet_dependency',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      references: [
        'generic.packet.builder_pipeline',
        'generic.packet.definition_action_bridge',
      ],
      notes:
        'Dependency definition part for the generic builder pipeline and shadow action-plan resolver.',
    },
  ];
}

export function createGenericFamilyPacketDefinition<
  TFamily extends GenericBuilderFamily,
>(
  config: GenericFamilyDefinitionConfig<TFamily>
): PacketTypeDefinition<(typeof PACKET_BODY_SCHEMAS)[TFamily]> {
  const family = config.family;
  const schemaVersion = PACKET_COMPATIBILITY_REGISTRY[family].current_schema_version;
  const baseId = lowerFirst(family);
  const label = toKebab(family);
  const createActionId = `${baseId}.generic.create`;
  const reviseActionId = `${baseId}.generic.revise`;
  const projectActionId = `${baseId}.generic.project`;
  const indexActionId = `${baseId}.generic.index`;
  const builderId = `${baseId}.generic.body.v0`;
  const writePlannerId = `${baseId}.generic.write.v0`;
  const projectionPlannerId = `${baseId}.generic.projection.v0`;
  const projectionKey = `${baseId}.generic_projection`;
  const indexKey = `${baseId}.generic_index`;
  const compatibilityAdapters = createRegistryCompatibilityAdapterDescriptors({
    packetType: family,
    family,
    baseId,
    currentSchemaVersion: schemaVersion,
    entry: PACKET_COMPATIBILITY_REGISTRY[family],
  });

  return {
    packet_type: family,
    canonical_body_type: config.canonical_body_type,
    definition_status: 'experimental_shadow',
    current_schema_version: schemaVersion,
    storage_class: config.storage_class ?? 'public_record',
    revision_behavior: toRevisionBehavior(family),
    body_schema: PACKET_BODY_SCHEMAS[family] as (typeof PACKET_BODY_SCHEMAS)[TFamily],
    declared_subtypes: config.declared_subtypes,
    default_subtype: config.default_subtype,
    compatibility: derivePacketCompatibilityPosture({
      currentSchemaVersion: schemaVersion,
      adapters: compatibilityAdapters,
      notes:
        'Compatibility posture is summarized from the existing canonical compatibility registry; manifest descriptors do not implement new adapters.',
    }),
    id_strategy: {
      strategy_id: `${baseId}.generic.import_preserved`,
      packet_id_mode: 'import_preserved',
      revision_id_mode: 'import_preserved',
      uniqueness_fields: ['header.packet_id'],
      notes:
        'Generic shadow definitions preserve packet and revision identities; family-specific deterministic IDs remain owned by builders/planners.',
    },
    actions: [
      {
        action_id: createActionId,
        action_kind: 'create',
        packet_subtype: null,
        label: `Create ${label} packet`,
        policy_action_id: `${baseId}.generic.write`,
        availability: 'shadow_only',
        notes: `Shadow action for creating ${family} packets through the generic builder pipeline.`,
      },
      {
        action_id: reviseActionId,
        action_kind: 'revise',
        packet_subtype: null,
        label: `Revise ${label} packet`,
        policy_action_id: `${baseId}.generic.write`,
        availability: 'shadow_only',
        notes: `Shadow action for revising ${family} packets through the generic builder pipeline.`,
      },
      {
        action_id: projectActionId,
        action_kind: 'project',
        packet_subtype: null,
        label: `Project ${label} packet`,
        policy_action_id: null,
        availability: 'shadow_only',
        notes: `Shadow action for projecting ${family} packets into read models.`,
      },
      {
        action_id: indexActionId,
        action_kind: 'index',
        packet_subtype: null,
        label: `Index ${label} packet`,
        policy_action_id: null,
        availability: 'shadow_only',
        notes: `Shadow action for indexing ${family} packets.`,
      },
    ],
    builders: [
      {
        builder_id: builderId,
        packet_subtype: null,
        builder_kind: 'single_packet_body',
        action_ids: [createActionId, reviseActionId],
        input_schema_key: `${family}PacketInput`,
        output_schema_key: `${family}BodySchema`,
        availability: 'shadow_only',
        notes:
          'Descriptor for the existing generic packet builder pipeline; the manifest does not execute it yet.',
      },
    ],
    planners: [
      {
        planner_id: writePlannerId,
        planner_kind: 'single_packet_revision',
        action_ids: [createActionId, reviseActionId],
        builder_ids: [builderId],
        policy_action_ids: [`${baseId}.generic.write`],
        availability: 'shadow_only',
        notes: `Shadow write planner descriptor for generic ${family} packet revisions.`,
      },
      {
        planner_id: projectionPlannerId,
        planner_kind: 'projection_only',
        action_ids: [projectActionId, indexActionId],
        builder_ids: [],
        policy_action_ids: [],
        availability: 'shadow_only',
        notes: `Shadow projection planner descriptor for generic ${family} read models.`,
      },
    ],
    mutations: [
      {
        mutation_intent: `${baseId}.generic.write`,
        action_ids: [createActionId, reviseActionId],
        planner_id: writePlannerId,
        result_family: 'packet_write',
        availability: 'shadow_only',
        notes:
          'Future manifest-driven generic write intent; live runtime routes are not enrolled in this pass.',
      },
    ],
    compatibility_adapters: compatibilityAdapters,
    projections: config.projections ?? [
      {
        projection_key: projectionKey,
        target_surface: 'generic_packet_runtime',
        mode: 'derived',
        notes: `Generic projection descriptor for ${family} packet read surfaces.`,
      },
    ],
    indexes: [
      {
        index_key: indexKey,
        fields: config.index_fields ?? ['header.packet_id', 'header.created_at'],
        notes: `Generic index descriptor for ${family} packet lookup and filtering.`,
      },
    ],
    packet_definition_parts: createDefinitionParts({
      family,
      defaultSubtype: config.default_subtype,
      schemaVersion,
      actionIds: [createActionId, reviseActionId, projectActionId, indexActionId],
      builderId,
      plannerIds: [writePlannerId, projectionPlannerId],
      projectionKey,
      indexKey,
      compatibilityAdapterIds: compatibilityAdapters.map((adapter) => adapter.adapter_id),
      declaredSubtypes: config.declared_subtypes,
    }),
    fixtures: [],
    notes: [
      ...(config.notes ?? []),
      'Shadow definition only; this pass does not change packet schemas, runtime routes, or connector enrollment.',
      'Generic family definitions describe existing builder and compatibility support without becoming canonical execution policy.',
    ],
  };
}

export const genericFamilyPacketDefinitions = Object.fromEntries(
  GENERIC_FAMILY_CONFIGS.map((config) => [
    config.family,
    createGenericFamilyPacketDefinition(config),
  ])
) as {
  [TFamily in GenericBuilderFamily]: PacketTypeDefinition<
    (typeof PACKET_BODY_SCHEMAS)[TFamily]
  >;
};

export const elementPacketDefinition = genericFamilyPacketDefinitions.Element;
export const locationPacketDefinition = genericFamilyPacketDefinitions.Location;
export const rolePacketDefinition = genericFamilyPacketDefinitions.Role;
export const claimPacketDefinition = genericFamilyPacketDefinitions.Claim;
export const relationPacketDefinition = genericFamilyPacketDefinitions.Relation;
export const reportPacketDefinition = genericFamilyPacketDefinitions.Report;
export const proposalPacketDefinition = genericFamilyPacketDefinitions.Proposal;
export const votePacketDefinition = genericFamilyPacketDefinitions.Vote;
export const attestationPacketDefinition = genericFamilyPacketDefinitions.Attestation;
export const decisionPacketDefinition = genericFamilyPacketDefinitions.Decision;
export const causePacketDefinition = genericFamilyPacketDefinitions.Cause;
export const actionPacketDefinition = genericFamilyPacketDefinitions.Action;
export const discussionPacketDefinition = genericFamilyPacketDefinitions.Discussion;
export const policyPacketDefinition = genericFamilyPacketDefinitions.Policy;
