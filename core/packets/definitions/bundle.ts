/**
 * File: bundle.ts
 * Description: Canonical Bundle packet type definition for portable packet collection inventories.
 */

import {
  BUNDLE_PACKET_SUBTYPES,
  BundleBodySchema,
  BundleItemSchema,
} from '@core/schema/packet-schema';
import type { z } from 'zod';

import type { PacketTypeDefinition } from './packet-definition-types.ts';

export {
  BUNDLE_PACKET_SUBTYPES,
  BundleBodySchema,
  BundleItemSchema,
} from '@core/schema/packet-schema';

export type BundleBody = z.infer<typeof BundleBodySchema>;
export type BundleItem = z.infer<typeof BundleItemSchema>;

export const bundlePacketDefinition = {
  packet_type: 'Bundle',
  canonical_body_type: 'bundle',
  definition_status: 'canonical',
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
      availability: 'canonical',
      notes: 'Creates a portable packet-set inventory for export/import or local transport.',
    },
    {
      action_id: 'bundle.inspect',
      action_kind: 'project',
      packet_subtype: null,
      label: 'Inspect bundle inventory',
      policy_action_id: null,
      availability: 'canonical',
      notes: 'Projects bundle contents for import/export review without writing packets.',
    },
    {
      action_id: 'bundle.packet_set.import',
      action_kind: 'import',
      packet_subtype: 'packet_set',
      label: 'Import packet bundle',
      policy_action_id: 'bundle.packet_set.import',
      availability: 'canonical',
      notes: 'Trusted-local import action descriptor for validating and hydrating packet sets.',
    },
    {
      action_id: 'bundle.inventory.revise',
      action_kind: 'revise',
      packet_subtype: null,
      label: 'Revise bundle inventory',
      policy_action_id: 'bundle.packet_set.write',
      availability: 'canonical',
      notes:
        'Revises a canonical Bundle packet inventory body.',
    },
    {
      action_id: 'bundle.packet_set.export',
      action_kind: 'export',
      packet_subtype: 'packet_set',
      label: 'Export packet bundle',
      policy_action_id: 'bundle.packet_set.export',
      availability: 'canonical',
      notes: 'Trusted-local export action descriptor for collecting packet dependencies and definition parts.',
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
      availability: 'canonical',
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
      availability: 'canonical',
      notes: 'Plans a bundle inventory from a root packet set and declared dependencies.',
    },
    {
      planner_id: 'bundle.packet_set.import.v0',
      planner_kind: 'multi_packet_orchestration',
      action_ids: ['bundle.packet_set.import', 'bundle.inspect'],
      builder_ids: [],
      policy_action_ids: ['bundle.packet_set.import'],
      availability: 'canonical',
      notes:
        'Plans trusted-local import review for packet-set bundle inventories without performing live hydration.',
    },
  ],
  mutations: [
    {
      mutation_intent: 'bundle.packet_set.create',
      action_ids: ['bundle.packet_set.create', 'bundle.inventory.revise'],
      planner_id: 'bundle.packet_set.export.v0',
      result_family: 'bundle_update',
      availability: 'canonical',
      notes: 'Manifest mutation descriptor for creating canonical bundle inventory packets.',
    },
    {
      mutation_intent: 'bundle.packet_set.import',
      action_ids: ['bundle.packet_set.import'],
      planner_id: 'bundle.packet_set.import.v0',
      result_family: 'bundle_update',
      availability: 'canonical',
      notes:
        'Manifest mutation descriptor for reviewing and hydrating bundle inventory imports.',
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
      availability: 'canonical',
      notes:
        'Identity adapter for canonical Bundle v0 inventory compatibility.',
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
      availability: 'canonical',
      required: true,
      notes: 'Root definition part for Bundle.packet_set as a generic packet inventory carrier.',
    },
    {
      part_id: 'bundle.packet_set.packet_schema.v0',
      part_subtype: 'packet_schema',
      defines_packet_type: 'Bundle',
      defines_packet_subtype: 'packet_set',
      schema_version: '0.1.0',
      availability: 'canonical',
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
      availability: 'canonical',
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
      availability: 'canonical',
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
      availability: 'canonical',
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
      availability: 'canonical',
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
      availability: 'canonical',
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
      availability: 'canonical',
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
