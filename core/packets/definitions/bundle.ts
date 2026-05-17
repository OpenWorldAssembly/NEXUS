/**
 * File: bundle.ts
 * Description: Experimental Bundle packet type definition for portable packet sets, manifests, and compatibility-chain transport.
 */

import { z } from 'zod';

import { PacketRefSchema, PacketRevisionRefSchema } from '@core/schema/packet-schema';

import type { PacketTypeDefinition } from './packet-definition-types.ts';

export const BUNDLE_PACKET_SUBTYPES = [
  'packet_set',
  'export_bundle',
  'schema_manifest',
  'compatibility_bundle',
] as const;

export const BundleItemSchema = z
  .object({
    item_role: z.enum([
      'root',
      'dependency',
      'reference',
      'schema_definition',
      'adapter',
      'fixture',
    ]),
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

export const BundleCompatibilityChainSchema = z
  .object({
    packet_type: z.string().min(1),
    packet_subtype: z.string().min(1).nullable().default(null),
    current_schema_version: z.string().min(1),
    adapter_packet_refs: z.array(PacketRefSchema).default([]),
    known_schema_versions: z.array(z.string().min(1)).default([]),
    chain_digest: z.string().min(1).nullable().default(null),
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
    compatibility_chains: z.array(BundleCompatibilityChainSchema).default([]),
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
    strategy: 'current_neighbor_adapters',
    current_schema_version: '0.1.0',
    supports_upcast: true,
    supports_downcast: true,
    loss_awareness: 'loss_annotated',
    notes:
      'Bundle packets are the transport vessel for packet sets, schema manifests, and full compatibility-chain propagation.',
  },
  id_strategy: {
    strategy_id: 'bundle.subtype.manifest_digest_or_root_set',
    packet_id_mode: 'content_addressed',
    revision_id_mode: 'content_addressed',
    uniqueness_fields: ['body.subtype', 'body.manifest_digest', 'body.root_refs', 'body.items'],
    notes:
      'Bundle identity should be stable for equivalent manifests and packet sets; import may preserve source IDs when appropriate.',
  },
  actions: [
    {
      action_id: 'bundle.packet_set.create',
      action_kind: 'create',
      packet_subtype: 'packet_set',
      label: 'Create packet bundle',
      policy_action_id: 'bundle.packet_set.write',
      availability: 'shadow_only',
      notes: 'Creates a portable packet set manifest for export/import or local transport.',
    },
    {
      action_id: 'bundle.schema_manifest.create',
      action_kind: 'create',
      packet_subtype: 'schema_manifest',
      label: 'Create schema manifest bundle',
      policy_action_id: 'bundle.schema_manifest.write',
      availability: 'shadow_only',
      notes:
        'Creates a bundle-shaped schema manifest packet so packet definitions can propagate across nodes.',
    },
    {
      action_id: 'bundle.compatibility_bundle.create',
      action_kind: 'create',
      packet_subtype: 'compatibility_bundle',
      label: 'Create compatibility bundle',
      policy_action_id: 'bundle.compatibility.write',
      availability: 'shadow_only',
      notes:
        'Creates a full compatibility-chain bundle from individual nearest-current Compatibility packets.',
    },
    {
      action_id: 'bundle.inspect',
      action_kind: 'project',
      packet_subtype: null,
      label: 'Inspect bundle manifest',
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
      notes:
        'Future manifest-driven import action for validating and hydrating packet sets.',
    },
    {
      action_id: 'bundle.packet_set.export',
      action_kind: 'export',
      packet_subtype: 'packet_set',
      label: 'Export packet bundle',
      policy_action_id: 'bundle.packet_set.export',
      availability: 'shadow_only',
      notes:
        'Future manifest-driven export action for collecting packet dependencies and compatibility metadata.',
    },
    {
      action_id: 'bundle.packet_set.index',
      action_kind: 'index',
      packet_subtype: null,
      label: 'Index bundle manifest',
      policy_action_id: null,
      availability: 'shadow_only',
      notes:
        'Indexes bundle subtype, status, root refs, and compatibility-chain metadata for import/export review.',
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
      notes: 'Descriptor for packet set bundle construction from packet refs and revision refs.',
    },
    {
      builder_id: 'bundle.schema_manifest.body.v0',
      packet_subtype: 'schema_manifest',
      builder_kind: 'multi_packet_bundle',
      action_ids: ['bundle.schema_manifest.create'],
      input_schema_key: 'PacketDefinitionManifest',
      output_schema_key: 'BundleBodySchema',
      availability: 'shadow_only',
      notes:
        'Descriptor for turning the packet definition manifest surface into a portable Bundle.schema_manifest packet.',
    },
    {
      builder_id: 'bundle.compatibility_chain.body.v0',
      packet_subtype: 'compatibility_bundle',
      builder_kind: 'multi_packet_bundle',
      action_ids: ['bundle.compatibility_bundle.create'],
      input_schema_key: 'BundleCompatibilityChainSchema',
      output_schema_key: 'BundleBodySchema',
      availability: 'shadow_only',
      notes:
        'Descriptor for packaging a full adapter daisy-chain from Compatibility packet refs.',
    },
  ],
  planners: [
    {
      planner_id: 'bundle.packet_set.export.v0',
      planner_kind: 'multi_packet_orchestration',
      action_ids: ['bundle.packet_set.create'],
      builder_ids: ['bundle.packet_set.body.v0'],
      policy_action_ids: ['bundle.packet_set.write'],
      availability: 'shadow_only',
      notes:
        'Plans a portable packet-set bundle without changing the live importer/exporter path yet.',
    },
    {
      planner_id: 'bundle.schema_manifest.export.v0',
      planner_kind: 'multi_packet_orchestration',
      action_ids: ['bundle.schema_manifest.create'],
      builder_ids: ['bundle.schema_manifest.body.v0'],
      policy_action_ids: ['bundle.schema_manifest.write'],
      availability: 'shadow_only',
      notes:
        'Plans schema-manifest bundle propagation once packet definitions become portable packets.',
    },
    {
      planner_id: 'bundle.compatibility_chain.export.v0',
      planner_kind: 'multi_packet_orchestration',
      action_ids: ['bundle.compatibility_bundle.create'],
      builder_ids: ['bundle.compatibility_chain.body.v0'],
      policy_action_ids: ['bundle.compatibility.write'],
      availability: 'shadow_only',
      notes:
        'Plans compatibility bundle propagation so nodes can learn full adapter chains while individual packets stay nearest-current.',
    },
  ],
  mutations: [
    {
      mutation_intent: 'bundle.packet_set.create',
      action_ids: ['bundle.packet_set.create'],
      planner_id: 'bundle.packet_set.export.v0',
      result_family: 'bundle_update',
      availability: 'shadow_only',
      notes: 'Future manifest-driven mutation for creating packet set bundles.',
    },
    {
      mutation_intent: 'bundle.schema_manifest.create',
      action_ids: ['bundle.schema_manifest.create'],
      planner_id: 'bundle.schema_manifest.export.v0',
      result_family: 'bundle_update',
      availability: 'shadow_only',
      notes: 'Future manifest-driven mutation for creating portable schema manifest bundles.',
    },
    {
      mutation_intent: 'bundle.compatibility_bundle.create',
      action_ids: ['bundle.compatibility_bundle.create'],
      planner_id: 'bundle.compatibility_chain.export.v0',
      result_family: 'bundle_update',
      availability: 'shadow_only',
      notes: 'Future manifest-driven mutation for creating compatibility-chain bundles.',
    },
  ],
  compatibility_adapters: [
    {
      adapter_id: 'bundle.packet_set.0_1_current_neighbor',
      packet_subtype: 'packet_set',
      from_schema_version: '0.1.0',
      to_schema_version: '0.1.0',
      direction: 'bidirectional_neighbor',
      loss_awareness: 'none',
      availability: 'shadow_only',
      notes: 'Identity adapter placeholder for initial Bundle.packet_set packets.',
    },
  ],
  projections: [
    {
      projection_key: 'bundle_manifest_items',
      target_surface: 'import_export_runtime',
      mode: 'direct',
      notes:
        'Import/export can inspect bundle items before deciding which packet revisions or adapters to hydrate.',
    },
  ],
  indexes: [
    {
      index_key: 'bundle_subtype_status',
      fields: ['body.subtype', 'body.status'],
      notes:
        'Supports quick discovery of active schema manifests and compatibility bundles.',
    },
  ],
  notes: [
    'The packet definition manifest is bundle-shaped, but does not become a live Bundle packet until the bundle family is wired into runtime import/export.',
    'Compatibility bundles carry complete adapter daisy chains so individual packets only need nearest-current compatibility metadata.',
  ],
} as const satisfies PacketTypeDefinition<typeof BundleBodySchema>;
