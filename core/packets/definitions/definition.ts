/**
 * File: definition.ts
 * Description: Canonical Definition packet type and bootstrap definition parts for packet-definition.
 */

import { z } from 'zod';

import type { PacketTypeDefinition } from './packet-definition-types.ts';

export const DEFINITION_PACKET_SUBTYPES = [
  'packet_definition',
  'packet_schema',
  'packet_action_registry',
  'packet_builder_descriptor',
  'packet_planner_descriptor',
  'packet_projection_descriptor',
  'packet_compatibility',
  'default_definition',
  'packet_dependency',
] as const;

export const DefinitionPartRefSchema = z
  .object({
    part_id: z.string().min(1),
    part_subtype: z.enum(DEFINITION_PACKET_SUBTYPES),
    required: z.boolean().default(true),
    notes: z.string().min(1).nullable().default(null),
  })
  .strict();

const DefinitionBaseBodySchema = z
  .object({
    subtype: z.enum(DEFINITION_PACKET_SUBTYPES),
    status: z.enum(['active', 'superseded', 'withdrawn']).default('active'),
    definition_version: z.string().min(1).default('0.1.0'),
    defines_packet_type: z.string().min(1),
    defines_packet_subtype: z.string().min(1).nullable().default(null),
    summary: z.string().min(1),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const PacketDefinitionBodySchema = DefinitionBaseBodySchema.extend({
  subtype: z.literal('packet_definition'),
  required_parts: z.array(DefinitionPartRefSchema).default([]),
  optional_parts: z.array(DefinitionPartRefSchema).default([]),
  bootstrap_mode: z.enum(['core_native_v0', 'packet_defined']).default('packet_defined'),
}).strict();

export const PacketSchemaDefinitionBodySchema = DefinitionBaseBodySchema.extend({
  subtype: z.literal('packet_schema'),
  schema_key: z.string().min(1),
  supported_subtypes: z.array(z.string().min(1)).default([]),
  schema_language: z.enum(['zod_local_binding', 'json_schema', 'nexus_schema_dsl']).default('zod_local_binding'),
}).strict();

export const PacketActionRegistryDefinitionBodySchema = DefinitionBaseBodySchema.extend({
  subtype: z.literal('packet_action_registry'),
  action_ids: z.array(z.string().min(1)).default([]),
}).strict();

export const PacketBuilderDescriptorDefinitionBodySchema = DefinitionBaseBodySchema.extend({
  subtype: z.literal('packet_builder_descriptor'),
  builder_ids: z.array(z.string().min(1)).default([]),
}).strict();

export const PacketPlannerDescriptorDefinitionBodySchema = DefinitionBaseBodySchema.extend({
  subtype: z.literal('packet_planner_descriptor'),
  planner_ids: z.array(z.string().min(1)).default([]),
}).strict();

export const PacketProjectionDescriptorDefinitionBodySchema = DefinitionBaseBodySchema.extend({
  subtype: z.literal('packet_projection_descriptor'),
  projection_keys: z.array(z.string().min(1)).default([]),
}).strict();

export const PacketCompatibilityDefinitionBodySchema = DefinitionBaseBodySchema.extend({
  subtype: z.literal('packet_compatibility'),
  current_schema_version: z.string().min(1),
  adapter_ids: z.array(z.string().min(1)).default([]),
  supports_upcast: z.boolean().default(false),
  supports_downcast: z.boolean().default(false),
  loss_awareness: z.enum(['none', 'loss_annotated', 'loss_ack_required']).default('none'),
}).strict();

export const DefaultDefinitionAppliesToSchema = z
  .object({
    packet_type: z.string().min(1).optional(),
    packet_subtype: z.string().min(1).nullable().optional(),
    relation_subtype: z.string().min(1).optional(),
    policy_subtype: z.string().min(1).optional(),
    action_subtype: z.string().min(1).optional(),
    workflow_id: z.string().min(1).optional(),
  })
  .strict();

export const DefaultDefinitionBodySchema = DefinitionBaseBodySchema.extend({
  subtype: z.literal('default_definition'),
  applies_to: DefaultDefinitionAppliesToSchema,
  default_values: z.record(z.string(), z.unknown()).default({}),
  merge_strategy: z.enum(['deep_overlay', 'replace']).default('deep_overlay'),
}).strict();

export const PacketDependencyDefinitionBodySchema = DefinitionBaseBodySchema.extend({
  subtype: z.literal('packet_dependency'),
  required_packet_types: z.array(z.string().min(1)).default([]),
  required_definition_parts: z.array(z.string().min(1)).default([]),
  required_runtime_capabilities: z.array(z.string().min(1)).default([]),
  optional_runtime_capabilities: z.array(z.string().min(1)).default([]),
}).strict();

export const DefinitionBodySchema = z.discriminatedUnion('subtype', [
  PacketDefinitionBodySchema,
  PacketSchemaDefinitionBodySchema,
  PacketActionRegistryDefinitionBodySchema,
  PacketBuilderDescriptorDefinitionBodySchema,
  PacketPlannerDescriptorDefinitionBodySchema,
  PacketProjectionDescriptorDefinitionBodySchema,
  PacketCompatibilityDefinitionBodySchema,
  DefaultDefinitionBodySchema,
  PacketDependencyDefinitionBodySchema,
]);

export type DefinitionBody = z.infer<typeof DefinitionBodySchema>;

export const definitionPacketDefinition = {
  packet_type: 'Definition',
  canonical_body_type: 'definition',
  definition_status: 'canonical',
  current_schema_version: '0.1.0',
  storage_class: 'public_record',
  revision_behavior: 'supersedes_chain',
  body_schema: DefinitionBodySchema,
  declared_subtypes: DEFINITION_PACKET_SUBTYPES,
  default_subtype: 'packet_definition',
  section_statuses: {
    bundling: 'supported',
  },
  compatibility: {
    strategy: 'current_only',
    current_schema_version: '0.1.0',
    supports_upcast: false,
    supports_downcast: false,
    loss_awareness: 'none',
    notes:
        'Definition v0 is current-only/bootstrap. Packetized compatibility ladders can be added after the bootstrap kernel is stable.',
  },
  id_strategy: {
    strategy_id: 'definition.packet_type.subtype.part',
    packet_id_mode: 'deterministic',
    revision_id_mode: 'content_addressed',
    uniqueness_fields: [
      'body.subtype',
      'body.defines_packet_type',
      'body.defines_packet_subtype',
      'body.definition_version',
    ],
    notes:
      'Definition parts are deterministic by defined packet target, definition subtype, and definition version.',
  },
  actions: [
    {
      action_id: 'definition.part.create',
      action_kind: 'create',
      packet_subtype: null,
      label: 'Create definition part',
      policy_action_id: 'definition.part.write',
      availability: 'canonical',
      notes:
        'Creates a canonical Definition packet body for one packet definition part.',
    },
    {
      action_id: 'definition.part.revise',
      action_kind: 'revise',
      packet_subtype: null,
      label: 'Revise definition part',
      policy_action_id: 'definition.part.write',
      availability: 'canonical',
      notes:
        'Revises a canonical Definition packet body for one packet definition part.',
    },
    {
      action_id: 'definition.packet_definition.project',
      action_kind: 'project',
      packet_subtype: 'packet_definition',
      label: 'Project packet definition',
      policy_action_id: null,
      availability: 'canonical',
      notes:
        'Reads a packet definition and its parts into a resolved local definition profile.',
    },
    {
      action_id: 'definition.packet_definition.bundle',
      action_kind: 'bundle',
      packet_subtype: 'packet_definition',
      label: 'Bundle packet definition parts',
      policy_action_id: null,
      availability: 'canonical',
      notes:
        'Allows definition parts to travel in a carrier bundle without making Bundle the semantic home for definitions.',
    },
  ],
  builders: [
    {
      builder_id: 'definition.part.body.v0',
      packet_subtype: null,
      builder_kind: 'single_packet_body',
      action_ids: ['definition.part.create', 'definition.part.revise'],
      input_schema_key: 'DefinitionPartBodyBuilderInput',
      output_schema_key: 'DefinitionBodySchema',
      availability: 'canonical',
      notes:
        'Builds canonical Definition packet bodies from PacketDefinitionPartDescriptor records.',
    },
  ],
  planners: [
    {
      planner_id: 'definition.part.write.v0',
      planner_kind: 'single_packet_revision',
      action_ids: ['definition.part.create', 'definition.part.revise'],
      builder_ids: ['definition.part.body.v0'],
      policy_action_ids: ['definition.part.write'],
      availability: 'canonical',
      notes:
        'Plans trusted-local Definition part writes as canonical packet bodies.',
    },
    {
      planner_id: 'definition.packet_definition.resolve.v0',
      planner_kind: 'projection_only',
      action_ids: ['definition.packet_definition.project'],
      builder_ids: [],
      policy_action_ids: [],
      availability: 'canonical',
      notes:
        'Bootstrap resolver for combining Definition parts into a local resolved definition shape.',
    },
  ],
  mutations: [
    {
      mutation_intent: 'definition.part.write',
      action_ids: ['definition.part.create', 'definition.part.revise'],
      planner_id: 'definition.part.write.v0',
      result_type: 'packet_write',
      availability: 'canonical',
      notes:
        'Manifest mutation for creating or revising Definition packet bodies through trusted local code.',
    },
  ],
  compatibility_adapters: [
    {
      adapter_id: 'definition.0_1_current_neighbor',
      packet_subtype: null,
      from_schema_version: '0.1.0',
      to_schema_version: '0.1.0',
      direction: 'bidirectional_neighbor',
      loss_awareness: 'none',
      availability: 'canonical',
      notes:
        'Identity adapter for canonical Definition v0 packet_type compatibility metadata.',
    },
  ],
  projections: [
    {
      projection_key: 'resolved_packet_definition',
      target_surface: 'definition_bootstrap',
      mode: 'derived',
      notes:
        'Projects definition parts into a resolved packet definition for local audit and trusted planning.',
    },
  ],
  indexes: [
    {
      index_key: 'definition_target_subtype_version',
      fields: [
        'body.defines_packet_type',
        'body.defines_packet_subtype',
        'body.subtype',
        'body.definition_version',
      ],
      notes:
        'Indexes Definition parts by defined packet type, subtype, part subtype, and definition version.',
    },
  ],
  packet_definition_parts: [
    {
      part_id: 'definition.bootstrap.packet_definition.v0',
      part_subtype: 'packet_definition',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      notes: 'Core-native bootstrap definition for the Definition packet type itself.',
    },
    {
      part_id: 'definition.bootstrap.packet_schema.v0',
      part_subtype: 'packet_schema',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      covers_subtypes: DEFINITION_PACKET_SUBTYPES,
      notes: 'Local Zod binding for bootstrap Definition body schemas.',
    },
    {
      part_id: 'definition.bootstrap.packet_action_registry.v0',
      part_subtype: 'packet_action_registry',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: [
        'definition.part.create',
        'definition.part.revise',
        'definition.packet_definition.project',
        'definition.packet_definition.bundle',
      ],
      notes: 'Bootstrap action registry part for projecting and bundling definition parts.',
    },
    {
      part_id: 'definition.bootstrap.packet_builder_descriptor.v0',
      part_subtype: 'packet_builder_descriptor',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: ['definition.part.body.v0'],
      notes: 'Builder descriptor part for canonical Definition packet bodies.',
    },
    {
      part_id: 'definition.bootstrap.packet_planner_descriptor.v0',
      part_subtype: 'packet_planner_descriptor',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: [
        'definition.part.write.v0',
        'definition.packet_definition.resolve.v0',
      ],
      notes: 'Bootstrap planner descriptor part for resolving definition parts into local profiles.',
    },
    {
      part_id: 'definition.bootstrap.packet_projection_descriptor.v0',
      part_subtype: 'packet_projection_descriptor',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: ['resolved_packet_definition'],
      notes: 'Bootstrap projection descriptor part for resolved packet definitions.',
    },
    {
      part_id: 'definition.bootstrap.packet_compatibility.v0',
      part_subtype: 'packet_compatibility',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: ['definition.0_1_current_neighbor'],
      notes: 'Definition v0 compatibility uses an identity current-neighbor adapter descriptor.',
    },
    {
      part_id: 'definition.bootstrap.default_definition.v0',
      part_subtype: 'default_definition',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      applies_to: { packet_type: 'Definition', packet_subtype: null },
      default_values: { definition_version: '0.1.0', status: 'active' },
      merge_strategy: 'deep_overlay',
      notes: 'Default-definition section for Definition packets and definition parts.',
    },
    {
      part_id: 'definition.bootstrap.packet_dependency.v0',
      part_subtype: 'packet_dependency',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: [
        'core.definition_bootstrap.v0',
        'generic.packet_type.body_builder_registry',
      ],
      notes: 'Definition v0 depends on the local core-native bootstrap parser.',
    },
  ],
  notes: [
    'Definition v0 is intentionally bootstrapped by core code to avoid circular cold-start dependency.',
    'Packetized Definition records can later describe Definition itself after the native bootstrap kernel can validate them.',
  ],
} as const satisfies PacketTypeDefinition<typeof DefinitionBodySchema>;
