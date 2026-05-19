/**
 * File: bundle.ts
 * Description: Experimental Bundle packet type definition for portable packet collection inventories.
 */

import { z } from 'zod';

import { PacketRefSchema, PacketRevisionRefSchema } from '@core/schema/packet-schema';

import type { PacketTypeDefinition } from './packet-definition-types.ts';

export const BUNDLE_PACKET_SUBTYPES = ['packet_set', 'export', 'sync', 'archive'] as const;

export const BundleItemSchema = z
  .object({
    item_role: z.enum(['root', 'dependency', 'reference', 'definition_part', 'fixture']),
    packet_ref: PacketRefSchema.nullable().default(null),
    revision_ref: PacketRevisionRefSchema.nullable().default(null),
    packet_type: z.string().min(1).nullable().default(null),
    packet_subtype: z.string().min(1).nullable().default(null),
    schema_version: z.string().min(1).nullable().default(null),
    digest: z.string().min(1).nullable().default(null),
    required: z.boolean().default(true),
    notes: z.string().min(1).nullable().default(null),
  })
  .strict();

export const BundleBodySchema = z
  .object({
    type: z.literal('bundle').default('bundle'),
    subtype: z.enum(BUNDLE_PACKET_SUBTYPES),
    title: z.string().min(1),
    summary: z.string().min(1).nullable().default(null),
    status: z.enum(['active', 'superseded', 'withdrawn']).default('active'),
    bundle_version: z.string().min(1).default('0.1.0'),
    purpose: z.string().min(1),
    root_refs: z.array(PacketRefSchema).default([]),
    items: z.array(BundleItemSchema).default([]),
    manifest_digest: z.string().min(1).nullable().default(null),
    bundle_data: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type BundleBody = z.infer<typeof BundleBodySchema>;
export type BundleItem = z.infer<typeof BundleItemSchema>;

export const bundlePacketDefinition = {
  packet_type: 'Bundle',
  canonical_body_type: 'bundle',
  definition_status: 'experimental_shadow',
  current_schema_version: '0.1.0',
  storage_class: 'public_record',
  revision_behavior: 'supersedes_chain',
  body_schema: BundleBodySchema,
  declared_subtypes: BUNDLE_PACKET_SUBTYPES,
  default_subtype: 'packet_set',
  compatibility: {
    strategy: 'current_only',
    current_schema_version: '0.1.0',
    supports_upcast: false,
    supports_downcast: false,
    loss_awareness: 'none',
    notes:
      'Bundle is a carrier/container type. Definition parts, compatibility parts, resources, and packet sets keep their own packet semantics inside the bundle inventory.',
  },
  id_strategy: {
    strategy_id: 'bundle.subtype.manifest_digest_or_root_set',
    packet_id_mode: 'content_addressed',
    revision_id_mode: 'content_addressed',
    uniqueness_fields: ['body.subtype', 'body.manifest_digest', 'body.root_refs', 'body.items'],
    notes:
      'Bundle identity should be stable for equivalent inventories and packet sets; import may preserve source IDs when appropriate.',
  },
  actions: [
    {
      action_id: 'bundle.packet_set.create',
      action_kind: 'create',
      packet_subtype: 'packet_set',
      label: 'Create packet bundle inventory',
      policy_action_id: 'bundle.packet_set.write',
      availability: 'shadow_only',
      notes: 'Creates a portable packet-set inventory for export/import or local transport.',
    },
    {
      action_id: 'bundle.inspect',
      action_kind: 'project',
      packet_subtype: null,
      label: 'Inspect bundle inventory',
      policy_action_id: null,
      availability: 'shadow_only',
      notes: 'Projects bundle contents for import/export review without writing packets.',
    },
    {
      action_id: 'bundle.packet_set.import',
      action_kind: 'import',
      packet_subtype: 'packet_set',
      label: 'Import packet bundle',
      policy_action_id: 'bundle.packet_set.import',
      availability: 'shadow_only',
      notes: 'Future manifest-driven import action for validating and hydrating packet sets.',
    },
    {
      action_id: 'bundle.inventory.revise',
      action_kind: 'revise',
      packet_subtype: null,
      label: 'Revise bundle inventory',
      policy_action_id: 'bundle.packet_set.write',
      availability: 'shadow_only',
      notes:
        'Revises a manifest-native Bundle body candidate without enrolling Bundle in legacy PACKET_FAMILIES.',
    },
    {
      action_id: 'bundle.packet_set.export',
      action_kind: 'export',
      packet_subtype: 'packet_set',
      label: 'Export packet bundle',
      policy_action_id: 'bundle.packet_set.export',
      availability: 'shadow_only',
      notes: 'Future manifest-driven export action for collecting packet dependencies and definition parts.',
    },
  ],
  builders: [
    {
      builder_id: 'bundle.packet_set.body.v0',
      packet_subtype: 'packet_set',
      builder_kind: 'multi_packet_bundle',
      action_ids: ['bundle.packet_set.create'],
      input_schema_key: 'BundleBodySchema',
      output_schema_key: 'BundleBodySchema',
      availability: 'shadow_only',
      notes: 'Descriptor for packet-set bundle construction from packet refs and revision refs.',
    },
  ],
  planners: [
    {
      planner_id: 'bundle.packet_set.export.v0',
      planner_kind: 'multi_packet_orchestration',
      action_ids: [
        'bundle.packet_set.create',
        'bundle.inventory.revise',
        'bundle.packet_set.export',
      ],
      builder_ids: ['bundle.packet_set.body.v0'],
      policy_action_ids: ['bundle.packet_set.write'],
      availability: 'shadow_only',
      notes: 'Plans a bundle inventory from a root packet set and declared dependencies.',
    },
    {
      planner_id: 'bundle.packet_set.import.v0',
      planner_kind: 'multi_packet_orchestration',
      action_ids: ['bundle.packet_set.import', 'bundle.inspect'],
      builder_ids: [],
      policy_action_ids: ['bundle.packet_set.import'],
      availability: 'shadow_only',
      notes:
        'Plans manifest-native import review for packet-set bundle inventories without performing live hydration.',
    },
  ],
  mutations: [
    {
      mutation_intent: 'bundle.packet_set.create',
      action_ids: ['bundle.packet_set.create', 'bundle.inventory.revise'],
      planner_id: 'bundle.packet_set.export.v0',
      result_family: 'bundle_update',
      availability: 'shadow_only',
      notes: 'Future manifest-driven mutation for creating bundle inventory packets.',
    },
    {
      mutation_intent: 'bundle.packet_set.import',
      action_ids: ['bundle.packet_set.import'],
      planner_id: 'bundle.packet_set.import.v0',
      result_family: 'bundle_update',
      availability: 'shadow_only',
      notes:
        'Future manifest-driven mutation for reviewing and hydrating bundle inventory imports.',
    },
  ],
  compatibility_adapters: [
    {
      adapter_id: 'bundle.0_1_current_neighbor',
      packet_subtype: null,
      from_schema_version: '0.1.0',
      to_schema_version: '0.1.0',
      direction: 'bidirectional_neighbor',
      loss_awareness: 'none',
      availability: 'shadow_only',
      notes:
        'Identity adapter placeholder for Bundle v0 manifest-native inventory compatibility.',
    },
  ],
  projections: [
    {
      projection_key: 'bundle_inventory',
      target_surface: 'import_export_review',
      mode: 'direct',
      notes: 'Projects bundle contents for human and runtime import/export review.',
    },
  ],
  indexes: [
    {
      index_key: 'bundle_subtype_root_refs',
      fields: ['body.subtype', 'body.root_refs', 'body.status'],
      notes: 'Supports bundle search by subtype, status, and root packet refs.',
    },
  ],
  packet_definition_parts: [
    {
      part_id: 'bundle.packet_set.packet_definition.v0',
      part_subtype: 'packet_definition',
      defines_packet_type: 'Bundle',
      defines_packet_subtype: 'packet_set',
      schema_version: '0.1.0',
      availability: 'shadow_only',
      required: true,
      notes: 'Root definition part for Bundle.packet_set as a generic packet inventory carrier.',
    },
    {
      part_id: 'bundle.packet_set.packet_schema.v0',
      part_subtype: 'packet_schema',
      defines_packet_type: 'Bundle',
      defines_packet_subtype: 'packet_set',
      schema_version: '0.1.0',
      availability: 'shadow_only',
      required: true,
      covers_subtypes: BUNDLE_PACKET_SUBTYPES,
      notes: 'Schema part for bundle carrier inventory bodies.',
    },
    {
      part_id: 'bundle.packet_set.packet_action_registry.v0',
      part_subtype: 'packet_action_registry',
      defines_packet_type: 'Bundle',
      defines_packet_subtype: 'packet_set',
      schema_version: '0.1.0',
      availability: 'shadow_only',
      required: true,
      references: [
        'bundle.packet_set.create',
        'bundle.inspect',
        'bundle.packet_set.import',
        'bundle.inventory.revise',
        'bundle.packet_set.export',
      ],
      notes: 'Action registry part for the currently modeled generic bundle carrier actions.',
    },
    {
      part_id: 'bundle.packet_set.packet_builder_descriptor.v0',
      part_subtype: 'packet_builder_descriptor',
      defines_packet_type: 'Bundle',
      defines_packet_subtype: 'packet_set',
      schema_version: '0.1.0',
      availability: 'shadow_only',
      required: true,
      references: ['bundle.packet_set.body.v0'],
      notes: 'Builder descriptor part for packet-set bundle inventory construction.',
    },
    {
      part_id: 'bundle.packet_set.packet_planner_descriptor.v0',
      part_subtype: 'packet_planner_descriptor',
      defines_packet_type: 'Bundle',
      defines_packet_subtype: 'packet_set',
      schema_version: '0.1.0',
      availability: 'shadow_only',
      required: true,
      references: ['bundle.packet_set.export.v0', 'bundle.packet_set.import.v0'],
      notes: 'Planner descriptor part for bundle inventory export planning.',
    },
    {
      part_id: 'bundle.packet_set.packet_projection_descriptor.v0',
      part_subtype: 'packet_projection_descriptor',
      defines_packet_type: 'Bundle',
      defines_packet_subtype: 'packet_set',
      schema_version: '0.1.0',
      availability: 'shadow_only',
      required: true,
      references: ['bundle_inventory'],
      notes: 'Projection descriptor part for bundle inventory review.',
    },
    {
      part_id: 'bundle.packet_set.packet_compatibility.v0',
      part_subtype: 'packet_compatibility',
      defines_packet_type: 'Bundle',
      defines_packet_subtype: 'packet_set',
      schema_version: '0.1.0',
      availability: 'shadow_only',
      required: true,
      references: ['bundle.0_1_current_neighbor'],
      notes: 'Compatibility part records Bundle v0 identity current-neighbor compatibility.',
    },
    {
      part_id: 'bundle.packet_set.packet_dependency.v0',
      part_subtype: 'packet_dependency',
      defines_packet_type: 'Bundle',
      defines_packet_subtype: 'packet_set',
      schema_version: '0.1.0',
      availability: 'shadow_only',
      required: true,
      references: [
        'generic.bundle.builder',
        'generic.packet_type.body_builder_registry',
      ],
      notes: 'Dependency definition part for the generic bundle inventory builder capability.',
    },
  ],
  fixtures: ['bundle.packet_set.definition_parts_inventory'],
  notes: [
    'Bundle is a transport/inventory packet type, not the semantic home for definitions or compatibility.',
    'Definition and compatibility parts may travel inside bundle inventories while retaining their own packet semantics.',
  ],
} as const satisfies PacketTypeDefinition<typeof BundleBodySchema>;
