/**
 * File: preference.ts
 * Description: Experimental Preference packet type definition and body schema for shadow-mode runtime preference R&D.
 */

import { z } from 'zod';

import { PacketRefSchema, PacketRevisionRefSchema } from '@core/schema/packet-schema';

import type { PacketTypeDefinition } from './packet-definition-types.ts';

export const PREFERENCE_PACKET_SUBTYPES = [
  'scope_display',
  'draft_state',
  'notification_settings',
  'security_settings',
  'theme_settings',
  'packet_template_defaults',
  'element_defaults',
  'builder_defaults',
] as const;

export const PreferencePrivacyModeSchema = z.enum([
  'local_only',
  'private_sync',
  'shared_with_trusted',
  'public',
]);

export const PreferenceContextSchema = z
  .object({
    namespace: z.string().min(1).default('nexus'),
    initiative_ref: PacketRefSchema.nullable().default(null),
    scope_ref: PacketRefSchema.nullable().default(null),
    surface_key: z.string().min(1).nullable().default(null),
    device_key: z.string().min(1).nullable().default(null),
  })
  .strict();

export const ScopeDisplayPreferenceValueSchema = z
  .object({
    main_visible_scope_packet_ids: z.array(z.string().min(1)).default([]),
    show_associated_parent_chains: z.boolean().default(true),
    show_followed_parent_chains: z.boolean().default(true),
  })
  .strict();

const PreferenceBaseBodySchema = z
  .object({
    type: z.literal('preference').default('preference'),
    owner_ref: PacketRefSchema,
    status: z.enum(['active', 'superseded', 'withdrawn']).default('active'),
    privacy: PreferencePrivacyModeSchema.default('private_sync'),
    context: PreferenceContextSchema.default({
      namespace: 'nexus',
      initiative_ref: null,
      scope_ref: null,
      surface_key: null,
      device_key: null,
    }),
    supersedes_ref: PacketRevisionRefSchema.nullable().default(null),
    note: z.string().min(1).nullable().default(null),
  })
  .strict();

export const ScopeDisplayPreferenceBodySchema = PreferenceBaseBodySchema.extend({
  subtype: z.literal('scope_display'),
  value: ScopeDisplayPreferenceValueSchema,
}).strict();

export const PreferenceBodySchema = ScopeDisplayPreferenceBodySchema;


export const ScopeDisplayPreferenceBuilderInputSchema = z
  .object({
    owner_ref: PacketRefSchema,
    context: PreferenceContextSchema.optional(),
    privacy: PreferencePrivacyModeSchema.optional(),
    supersedes_ref: PacketRevisionRefSchema.nullable().optional(),
    note: z.string().min(1).nullable().optional(),
    value: ScopeDisplayPreferenceValueSchema,
  })
  .strict();

export type ScopeDisplayPreferenceBuilderInput = z.input<
  typeof ScopeDisplayPreferenceBuilderInputSchema
>;

export type PreferenceBody = z.infer<typeof PreferenceBodySchema>;
export type ScopeDisplayPreferenceContext = z.infer<
  typeof PreferenceContextSchema
>;
export type ScopeDisplayPreferenceValue = z.infer<
  typeof ScopeDisplayPreferenceValueSchema
>;

export const preferencePacketDefinition = {
  packet_type: 'Preference',
  canonical_body_type: 'preference',
  definition_status: 'experimental_shadow',
  current_schema_version: '0.1.0',
  storage_class: 'private_sync',
  revision_behavior: 'latest_active_projection',
  body_schema: PreferenceBodySchema,
  declared_subtypes: PREFERENCE_PACKET_SUBTYPES,
  default_subtype: 'scope_display',
  compatibility: {
    strategy: 'current_neighbor_adapters',
    current_schema_version: '0.1.0',
    supports_upcast: true,
    supports_downcast: true,
    loss_awareness: 'loss_annotated',
    notes:
      'Preference packets use nearest-current adapters; long compatibility paths should travel in Compatibility bundles.',
  },
  id_strategy: {
    strategy_id: 'preference.latest_active.owner_subtype_context',
    packet_id_mode: 'deterministic',
    revision_id_mode: 'content_addressed',
    uniqueness_fields: [
      'body.owner_ref.packet_id',
      'body.subtype',
      'body.context.namespace',
      'body.context.initiative_ref.packet_id',
      'body.context.scope_ref.packet_id',
      'body.context.surface_key',
      'body.context.device_key',
    ],
    notes:
      'Projects as the latest active preference for one owner, subtype, and context; revisions may supersede older preference packets.',
  },
  actions: [
    {
      action_id: 'preference.scope_display.create',
      action_kind: 'create',
      packet_subtype: 'scope_display',
      label: 'Create scope display preference',
      policy_action_id: 'preference.scope_display.write',
      availability: 'shadow_only',
      notes:
        'Shadow action for creating an actor-owned scope display preference packet from runtime preference state.',
    },
    {
      action_id: 'preference.scope_display.revise',
      action_kind: 'revise',
      packet_subtype: 'scope_display',
      label: 'Revise scope display preference',
      policy_action_id: 'preference.scope_display.write',
      availability: 'shadow_only',
      notes:
        'Supersedes the previous active preference for the same owner/context without changing graph relations.',
    },
    {
      action_id: 'preference.scope_display.withdraw',
      action_kind: 'withdraw',
      packet_subtype: 'scope_display',
      label: 'Withdraw scope display preference',
      policy_action_id: 'preference.scope_display.write',
      availability: 'shadow_only',
      notes:
        'Marks the projected preference as withdrawn so runtime can fall back to defaults or older compatible state.',
    },
    {
      action_id: 'preference.scope_display.project',
      action_kind: 'project',
      packet_subtype: 'scope_display',
      label: 'Project scope display preference',
      policy_action_id: null,
      availability: 'shadow_only',
      notes:
        'Read-side projection into the current shell scope display preference shape.',
    },
    {
      action_id: 'preference.scope_display.index',
      action_kind: 'index',
      packet_subtype: 'scope_display',
      label: 'Index scope display preference',
      policy_action_id: null,
      availability: 'shadow_only',
      notes:
        'Indexes owner/subtype/context fields for latest-active preference projection.',
    },
    {
      action_id: 'preference.scope_display.bundle',
      action_kind: 'bundle',
      packet_subtype: 'scope_display',
      label: 'Bundle scope display preference',
      policy_action_id: null,
      availability: 'shadow_only',
      notes:
        'Allows private-sync preference packets to travel through bundle-aware node export/import flows when policy permits.',
    },
  ],
  builders: [
    {
      builder_id: 'preference.scope_display.body.v0',
      packet_subtype: 'scope_display',
      builder_kind: 'single_packet_body',
      action_ids: ['preference.scope_display.create', 'preference.scope_display.revise'],
      input_schema_key: 'ScopeDisplayPreferenceBuilderInputSchema',
      output_schema_key: 'ScopeDisplayPreferenceBodySchema',
      availability: 'shadow_only',
      notes:
        'Experimental body builder descriptor only; live runtime preference writes still use the runtime store.',
    },
  ],
  planners: [
    {
      planner_id: 'preference.scope_display.latest_active_revision.v0',
      planner_kind: 'single_packet_revision',
      action_ids: [
        'preference.scope_display.create',
        'preference.scope_display.revise',
        'preference.scope_display.withdraw',
      ],
      builder_ids: ['preference.scope_display.body.v0'],
      policy_action_ids: ['preference.scope_display.write'],
      availability: 'shadow_only',
      notes:
        'Plans the latest-active/supersedes-chain preference write once Preference packets become canonical.',
    },
    {
      planner_id: 'preference.scope_display.projection.v0',
      planner_kind: 'projection_only',
      action_ids: ['preference.scope_display.project'],
      builder_ids: [],
      policy_action_ids: [],
      availability: 'shadow_only',
      notes:
        'Projects latest active preference packets into shell display preferences without creating relations.',
    },
  ],
  mutations: [
    {
      mutation_intent: 'preference.scope_display.set',
      action_ids: ['preference.scope_display.create', 'preference.scope_display.revise'],
      planner_id: 'preference.scope_display.latest_active_revision.v0',
      result_family: 'packet_write',
      availability: 'shadow_only',
      notes:
        'Future manifest-driven mutation intent for creating or revising scope display preferences.',
    },
    {
      mutation_intent: 'preference.scope_display.withdraw',
      action_ids: ['preference.scope_display.withdraw'],
      planner_id: 'preference.scope_display.latest_active_revision.v0',
      result_family: 'packet_write',
      availability: 'shadow_only',
      notes: 'Future manifest-driven mutation intent for withdrawing scope display preferences.',
    },
  ],
  compatibility_adapters: [
    {
      adapter_id: 'preference.scope_display.legacy_v0_to_0_1',
      packet_subtype: 'scope_display',
      from_schema_version: 'legacy_v0',
      to_schema_version: '0.1.0',
      direction: 'upcast_to_current',
      loss_awareness: 'none',
      availability: 'shadow_only',
      notes:
        'Upcasts the old runtime-compatible shape using main_scope_ids and one show_parent_chains flag into current associated/followed parent-chain toggles.',
    },
    {
      adapter_id: 'preference.scope_display.0_1_to_legacy_v0',
      packet_subtype: 'scope_display',
      from_schema_version: '0.1.0',
      to_schema_version: 'legacy_v0',
      direction: 'downcast_from_current',
      loss_awareness: 'loss_annotated',
      availability: 'shadow_only',
      notes:
        'Downcasts current scope display preferences into the old one-toggle parent-chain shape; differing associated/followed toggles are loss-annotated.',
    },
    {
      adapter_id: 'preference.scope_display.0_1_current_neighbor',
      packet_subtype: 'scope_display',
      from_schema_version: '0.1.0',
      to_schema_version: '0.1.0',
      direction: 'bidirectional_neighbor',
      loss_awareness: 'none',
      availability: 'shadow_only',
      notes:
        'Identity adapter placeholder for the initial Preference.scope_display schema; future versions should add nearest-current steps here.',
    },
  ],
  projections: [
    {
      projection_key: 'scope_display_preferences',
      target_surface: 'nexus_shell',
      mode: 'derived',
      notes:
        'Projects the latest active owner/context preference into the existing shell scope display preference shape.',
    },
  ],
  indexes: [
    {
      index_key: 'preference_owner_subtype_context_latest',
      fields: ['body.owner_ref.packet_id', 'body.subtype', 'body.context.namespace'],
      notes:
        'Allows runtime to project the latest active preference for an owner, subtype, and context.',
    },
  ],
  fixtures: [
    'preference.scope_display.current_runtime_equivalence',
    'preference.scope_display.legacy_v0_adapter',
  ],
  notes: [
    'Experimental shadow definition only; runtime preference storage remains canonical for the alpha demo.',
    'Preference packets never create graph relationships. They only configure display/behavior for already eligible packets.',
  ],
} as const satisfies PacketTypeDefinition<typeof PreferenceBodySchema>;
