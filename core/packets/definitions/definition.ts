/**
 * File: definition.ts
 * Description: Experimental Definition packet type and bootstrap definition parts for packet-definition R&D.
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
    type: z.literal('definition').default('definition'),
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
  PacketDependencyDefinitionBodySchema,
]);

export type DefinitionBody = z.infer<typeof DefinitionBodySchema>;

export const definitionPacketDefinition = {
  packet_type: 'Definition',
  canonical_body_type: 'definition',
  definition_status: 'experimental_shadow',
  current_schema_version: '0.1.0',
  storage_class: 'public_record',
  revision_behavior: 'supersedes_chain',
  body_schema: DefinitionBodySchema,
  declared_subtypes: DEFINITION_PACKET_SUBTYPES,
  default_subtype: 'packet_definition',
  section_statuses: {
    builders: 'deferred',
    policy: 'deferred',
    indexing: 'deferred',
    compatibility: 'deferred',
    bundling: 'supported',
  },
  compatibility: {
    strategy: 'current_neighbor_adapters',
    current_schema_version: '0.1.0',
    supports_upcast: false,
    supports_downcast: false,
    loss_awareness: 'none',
    notes:
      'Definition v0 is core-native/bootstrap. Packetized self-definition may be introduced after the bootstrap kernel is stable.',
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
      action_id: 'definition.packet_definition.project',
      action_kind: 'project',
      packet_subtype: 'packet_definition',
      label: 'Project packet definition',
      policy_action_id: null,
      availability: 'shadow_only',
      notes:
        'Reads a packet definition and its parts into a resolved local definition profile.',
    },
    {
      action_id: 'definition.packet_definition.bundle',
      action_kind: 'bundle',
      packet_subtype: 'packet_definition',
      label: 'Bundle packet definition parts',
      policy_action_id: null,
      availability: 'shadow_only',
      notes:
        'Allows definition parts to travel in a carrier bundle without making Bundle the semantic home for definitions.',
    },
  ],
  builders: [],
  planners: [
    {
      planner_id: 'definition.packet_definition.resolve.v0',
      planner_kind: 'projection_only',
      action_ids: ['definition.packet_definition.project'],
      builder_ids: [],
      policy_action_ids: [],
      availability: 'shadow_only',
      notes:
        'Bootstrap resolver for combining Definition parts into a local resolved definition shape.',
    },
  ],
  mutations: [],
  compatibility_adapters: [],
  projections: [
    {
      projection_key: 'resolved_packet_definition',
      target_surface: 'definition_bootstrap',
      mode: 'derived',
      notes:
        'Projects definition parts into a resolved packet definition for local audit and shadow fortress planning.',
    },
  ],
  indexes: [],
  packet_definition_parts: [
    {
      part_id: 'definition.bootstrap.packet_definition.v0',
      part_subtype: 'packet_definition',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'shadow_only',
      required: true,
      notes: 'Core-native bootstrap definition for the Definition packet type itself.',
    },
    {
      part_id: 'definition.bootstrap.packet_schema.v0',
      part_subtype: 'packet_schema',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'shadow_only',
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
      availability: 'shadow_only',
      required: true,
      references: ['definition.packet_definition.project', 'definition.packet_definition.bundle'],
      notes: 'Bootstrap action registry part for projecting and bundling definition parts.',
    },
    {
      part_id: 'definition.bootstrap.packet_builder_descriptor.v0',
      part_subtype: 'packet_builder_descriptor',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'shadow_only',
      required: true,
      references: [],
      notes: 'Definition v0 has no generic builder enrolled yet; this part records the explicit absence.',
    },
    {
      part_id: 'definition.bootstrap.packet_planner_descriptor.v0',
      part_subtype: 'packet_planner_descriptor',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'shadow_only',
      required: true,
      references: ['definition.packet_definition.resolve.v0'],
      notes: 'Bootstrap planner descriptor part for resolving definition parts into local profiles.',
    },
    {
      part_id: 'definition.bootstrap.packet_projection_descriptor.v0',
      part_subtype: 'packet_projection_descriptor',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'shadow_only',
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
      availability: 'shadow_only',
      required: true,
      references: [],
      notes: 'Definition v0 compatibility is native/bootstrap and has no external adapter enrolled yet.',
    },
    {
      part_id: 'definition.bootstrap.packet_dependency.v0',
      part_subtype: 'packet_dependency',
      defines_packet_type: 'Definition',
      defines_packet_subtype: null,
      schema_version: '0.1.0',
      availability: 'shadow_only',
      required: true,
      references: ['core.definition_bootstrap.v0'],
      notes: 'Definition v0 depends on the local core-native bootstrap parser.',
    },
  ],
  notes: [
    'Definition v0 is intentionally bootstrapped by core code to avoid circular cold-start dependency.',
    'Packetized Definition records can later describe Definition itself after the native bootstrap kernel can validate them.',
  ],
} as const satisfies PacketTypeDefinition<typeof DefinitionBodySchema>;
