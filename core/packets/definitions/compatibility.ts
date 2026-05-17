/**
 * File: compatibility.ts
 * Description: Experimental Compatibility packet type definition for portable adapter metadata and loss-aware schema travel.
 */

import { z } from 'zod';

import { PacketRefSchema } from '@core/schema/packet-schema';

import type { PacketTypeDefinition } from './packet-definition-types.ts';

export const COMPATIBILITY_PACKET_SUBTYPES = [
  'adapter_profile',
  'adapter_chain',
  'compatibility_bundle_manifest',
] as const;

export const CompatibilityDirectionSchema = z.enum([
  'upcast_to_current',
  'downcast_from_current',
  'bidirectional_neighbor',
]);

export const CompatibilityLossSchema = z
  .object({
    loss_kind: z.enum([
      'none',
      'safe_default',
      'omitted_feature',
      'value_coercion',
      'precision_detail_loss',
      'blocked',
    ]),
    path: z.string().min(1),
    message: z.string().min(1),
    requires_acknowledgement: z.boolean().default(false),
  })
  .strict();

export const CompatibilityAdapterStepSchema = z
  .object({
    adapter_id: z.string().min(1),
    source_packet_type: z.string().min(1),
    source_packet_subtype: z.string().min(1).nullable().default(null),
    source_schema_version: z.string().min(1),
    target_packet_type: z.string().min(1),
    target_packet_subtype: z.string().min(1).nullable().default(null),
    target_schema_version: z.string().min(1),
    direction: CompatibilityDirectionSchema,
    safe_defaults: z.record(z.string(), z.unknown()).default({}),
    required_features: z.array(z.string().min(1)).default([]),
    omitted_features: z.array(z.string().min(1)).default([]),
    losses: z.array(CompatibilityLossSchema).default([]),
  })
  .strict();

export const CompatibilityBodySchema = z
  .object({
    type: z.literal('compatibility').default('compatibility'),
    subtype: z.enum(COMPATIBILITY_PACKET_SUBTYPES).default('adapter_profile'),
    status: z.enum(['active', 'superseded', 'withdrawn']).default('active'),
    packet_type: z.string().min(1),
    packet_subtype: z.string().min(1).nullable().default(null),
    current_schema_version: z.string().min(1),
    supported_schema_versions: z.array(z.string().min(1)).default([]),
    nearest_current_steps: z.array(CompatibilityAdapterStepSchema).default([]),
    full_chain_bundle_ref: PacketRefSchema.nullable().default(null),
    policy: z
      .object({
        prefer_current_schema_version: z.boolean().default(true),
        allow_virtual_downcast: z.boolean().default(true),
        allow_safe_defaults: z.boolean().default(true),
        requires_loss_acknowledgement: z.boolean().default(false),
      })
      .strict()
      .default({
        prefer_current_schema_version: true,
        allow_virtual_downcast: true,
        allow_safe_defaults: true,
        requires_loss_acknowledgement: false,
      }),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type CompatibilityBody = z.infer<typeof CompatibilityBodySchema>;
export type CompatibilityAdapterStep = z.infer<
  typeof CompatibilityAdapterStepSchema
>;

export const compatibilityPacketDefinition = {
  packet_type: 'Compatibility',
  canonical_body_type: 'compatibility',
  definition_status: 'experimental_shadow',
  current_schema_version: '0.1.0',
  storage_class: 'public_record',
  revision_behavior: 'supersedes_chain',
  body_schema: CompatibilityBodySchema,
  declared_subtypes: COMPATIBILITY_PACKET_SUBTYPES,
  default_subtype: 'adapter_profile',
  compatibility: {
    strategy: 'current_neighbor_adapters',
    current_schema_version: '0.1.0',
    supports_upcast: true,
    supports_downcast: true,
    loss_awareness: 'loss_ack_required',
    notes:
      'Individual Compatibility packets carry nearest-current adapter steps. Full daisy chains propagate through compatibility bundles.',
  },
  id_strategy: {
    strategy_id: 'compatibility.packet_type.subtype.current_version',
    packet_id_mode: 'deterministic',
    revision_id_mode: 'content_addressed',
    uniqueness_fields: [
      'body.packet_type',
      'body.packet_subtype',
      'body.current_schema_version',
      'body.subtype',
    ],
    notes:
      'One active compatibility profile should describe the nearest-current adapter posture for a packet type/subtype/current schema version.',
  },
  actions: [
    {
      action_id: 'compatibility.adapter_profile.create',
      action_kind: 'create',
      packet_subtype: 'adapter_profile',
      label: 'Create compatibility adapter profile',
      policy_action_id: 'compatibility.adapter_profile.write',
      availability: 'shadow_only',
      notes:
        'Registers nearest-current adapter metadata for one packet type/subtype/schema version.',
    },
    {
      action_id: 'compatibility.adapter_profile.revise',
      action_kind: 'revise',
      packet_subtype: 'adapter_profile',
      label: 'Revise compatibility adapter profile',
      policy_action_id: 'compatibility.adapter_profile.write',
      availability: 'shadow_only',
      notes:
        'Supersedes an existing adapter profile when an adapter path or loss posture changes.',
    },
    {
      action_id: 'compatibility.packet.adapt',
      action_kind: 'adapt',
      packet_subtype: null,
      label: 'Adapt packet schema version',
      policy_action_id: null,
      availability: 'shadow_only',
      notes:
        'Runtime read/write affordance for applying registered upcast/downcast steps without treating adaptation as a normal actor write.',
    },
    {
      action_id: 'compatibility.bundle.chain',
      action_kind: 'bundle',
      packet_subtype: 'adapter_chain',
      label: 'Bundle compatibility adapter chain',
      policy_action_id: 'bundle.compatibility.write',
      availability: 'shadow_only',
      notes:
        'Prepares compatibility metadata for propagation as a Bundle.compatibility_bundle packet.',
    },
    {
      action_id: 'compatibility.adapter_profile.index',
      action_kind: 'index',
      packet_subtype: 'adapter_profile',
      label: 'Index compatibility adapter profile',
      policy_action_id: null,
      availability: 'shadow_only',
      notes:
        'Indexes packet type/subtype/schema-version fields so runtime can discover nearest-current adapters.',
    },
  ],
  builders: [
    {
      builder_id: 'compatibility.adapter_profile.body.v0',
      packet_subtype: 'adapter_profile',
      builder_kind: 'single_packet_body',
      action_ids: ['compatibility.adapter_profile.create', 'compatibility.adapter_profile.revise'],
      input_schema_key: 'CompatibilityBodySchema',
      output_schema_key: 'CompatibilityBodySchema',
      availability: 'shadow_only',
      notes:
        'Descriptor for future compatibility profile builders; live compatibility registry remains code-based for now.',
    },
    {
      builder_id: 'compatibility.adapter_step.output.v0',
      packet_subtype: null,
      builder_kind: 'adapter_output',
      action_ids: ['compatibility.packet.adapt'],
      input_schema_key: 'CompatibilityAdapterStepSchema',
      output_schema_key: 'adapted_packet_envelope',
      availability: 'shadow_only',
      notes:
        'Placeholder descriptor for nearest-current adapter execution outputs.',
    },
  ],
  planners: [
    {
      planner_id: 'compatibility.adapter_profile.supersedes_chain.v0',
      planner_kind: 'single_packet_revision',
      action_ids: ['compatibility.adapter_profile.create', 'compatibility.adapter_profile.revise'],
      builder_ids: ['compatibility.adapter_profile.body.v0'],
      policy_action_ids: ['compatibility.adapter_profile.write'],
      availability: 'shadow_only',
      notes:
        'Plans active/superseded compatibility profile revisions for adapter metadata propagation.',
    },
    {
      planner_id: 'compatibility.nearest_current_adapter.v0',
      planner_kind: 'compatibility_adapter_chain',
      action_ids: ['compatibility.packet.adapt'],
      builder_ids: ['compatibility.adapter_step.output.v0'],
      policy_action_ids: [],
      availability: 'shadow_only',
      notes:
        'Finds the nearest-current upcast/downcast path, while compatibility bundles carry full daisy chains.',
    },
  ],
  mutations: [
    {
      mutation_intent: 'compatibility.adapter_profile.register',
      action_ids: ['compatibility.adapter_profile.create', 'compatibility.adapter_profile.revise'],
      planner_id: 'compatibility.adapter_profile.supersedes_chain.v0',
      result_family: 'compatibility_update',
      availability: 'shadow_only',
      notes:
        'Future manifest-driven mutation for publishing compatibility adapter profile packets.',
    },
  ],
  compatibility_adapters: [
    {
      adapter_id: 'compatibility.adapter_profile.0_1_current_neighbor',
      packet_subtype: 'adapter_profile',
      from_schema_version: '0.1.0',
      to_schema_version: '0.1.0',
      direction: 'bidirectional_neighbor',
      loss_awareness: 'none',
      availability: 'shadow_only',
      notes:
        'Identity adapter placeholder for initial Compatibility.adapter_profile packets.',
    },
  ],
  projections: [
    {
      projection_key: 'compatibility_adapter_catalog',
      target_surface: 'runtime_adaptation_registry',
      mode: 'direct',
      notes:
        'Runtime can index active compatibility packets by packet type, subtype, and schema version pair.',
    },
  ],
  indexes: [
    {
      index_key: 'compatibility_packet_type_schema_pair',
      fields: ['body.packet_type', 'body.packet_subtype', 'body.current_schema_version'],
      notes:
        'Supports adapter discovery when reading packets from older or newer schema revisions.',
    },
  ],
  notes: [
    'Compatibility should be a two-way street whenever safe. Downcasts must stay loss-aware.',
    'Full adapter chains should be transported as Bundle packets so nodes can update their systems without every packet carrying every historical adapter.',
  ],
} as const satisfies PacketTypeDefinition<typeof CompatibilityBodySchema>;
