/**
 * File: preference.ts
 * Description: Core-native bootstrap definition and body schema for actor-owned Preference.element values.
 */

import { z } from 'zod';

import { PacketRefSchema, PacketRevisionRefSchema } from '@core/schema/packet-schema';

import type { PacketTypeDefinition } from './packet-definition-types.ts';

export const PREFERENCE_PACKET_SUBTYPES = ['element'] as const;

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

export const ShellChromeNavigationModeSchema = z.enum(['function', 'scope']);

export const ShellChromeThemeModeSchema = z.enum(['dark', 'light']);

export const ShellChromeUiDensitySchema = z.enum(['small', 'large']);

export const ShellChromePreferenceValueSchema = z
  .object({
    navigation_mode: ShellChromeNavigationModeSchema.default('function'),
    theme_mode: ShellChromeThemeModeSchema.default('dark'),
    ui_density: ShellChromeUiDensitySchema.default('small'),
  })
  .strict();

const DEFAULT_SCOPE_DISPLAY_PREFERENCE_VALUE = {
  main_visible_scope_packet_ids: [],
  show_associated_parent_chains: true,
  show_followed_parent_chains: true,
};

const DEFAULT_SHELL_CHROME_PREFERENCE_VALUE = {
  navigation_mode: 'function',
  theme_mode: 'dark',
  ui_density: 'small',
} as const;

const PreferenceBaseBodySchema = z
  .object({
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

export const ElementInterfacePreferenceValueSchema = z
  .object({
    scope_display: ScopeDisplayPreferenceValueSchema.default(
      DEFAULT_SCOPE_DISPLAY_PREFERENCE_VALUE
    ),
    shell_chrome: ShellChromePreferenceValueSchema.default(
      DEFAULT_SHELL_CHROME_PREFERENCE_VALUE
    ),
  })
  .strict();

export const ElementPreferenceValueSchema = z
  .object({
    interface: ElementInterfacePreferenceValueSchema.default({
      scope_display: DEFAULT_SCOPE_DISPLAY_PREFERENCE_VALUE,
      shell_chrome: DEFAULT_SHELL_CHROME_PREFERENCE_VALUE,
    }),
  })
  .strict();

export const ElementPreferenceBodySchema = PreferenceBaseBodySchema.extend({
  subtype: z.literal('element'),
  value: ElementPreferenceValueSchema,
}).strict();

export const PreferenceBodySchema = ElementPreferenceBodySchema;


export const ElementPreferenceBuilderInputSchema = z
  .object({
    owner_ref: PacketRefSchema,
    context: PreferenceContextSchema.optional(),
    privacy: PreferencePrivacyModeSchema.optional(),
    supersedes_ref: PacketRevisionRefSchema.nullable().optional(),
    note: z.string().min(1).nullable().optional(),
    value: ScopeDisplayPreferenceValueSchema,
    shell_chrome: ShellChromePreferenceValueSchema.optional(),
  })
  .strict();

export type ElementPreferenceBuilderInput = z.input<
  typeof ElementPreferenceBuilderInputSchema
>;

export type PreferenceBody = z.infer<typeof PreferenceBodySchema>;
export type ScopeDisplayPreferenceContext = z.infer<
  typeof PreferenceContextSchema
>;
export type ScopeDisplayPreferenceValue = z.infer<
  typeof ScopeDisplayPreferenceValueSchema
>;
export type ShellChromePreferenceValue = z.infer<
  typeof ShellChromePreferenceValueSchema
>;
export type ElementPreferenceValue = z.infer<typeof ElementPreferenceValueSchema>;

export const preferencePacketDefinition = {
  packet_type: 'Preference',
  canonical_body_type: 'preference',
  definition_status: 'canonical',
  current_schema_version: '0.1.0',
  storage_class: 'private_sync',
  revision_behavior: 'latest_active_projection',
  body_schema: PreferenceBodySchema,
  declared_subtypes: PREFERENCE_PACKET_SUBTYPES,
  default_subtype: 'element',
  compatibility: {
    strategy: 'current_neighbor_adapters',
    current_schema_version: '0.1.0',
    supports_upcast: true,
    supports_downcast: true,
    loss_awareness: 'loss_annotated',
    notes:
      'Preference.element compatibility is represented as definition.packet_compatibility in the canonical definition-part model.',
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
      action_id: 'preference.element.create',
      action_kind: 'create',
      packet_subtype: 'element',
      label: 'Create element preference',
      policy_action_id: 'preference.element.write',
      availability: 'canonical',
      notes:
        'Definition action for creating an actor-owned element preference packet from runtime preference state.',
    },
    {
      action_id: 'preference.element.revise',
      action_kind: 'revise',
      packet_subtype: 'element',
      label: 'Revise element preference',
      policy_action_id: 'preference.element.write',
      availability: 'canonical',
      notes:
        'Supersedes the previous active preference for the same owner/context without changing graph relations.',
    },
    {
      action_id: 'preference.element.withdraw',
      action_kind: 'withdraw',
      packet_subtype: 'element',
      label: 'Withdraw element preference',
      policy_action_id: 'preference.element.write',
      availability: 'canonical',
      notes:
        'Marks the projected preference as withdrawn so runtime can fall back to defaults or older compatible state.',
    },
    {
      action_id: 'preference.element.project',
      action_kind: 'project',
      packet_subtype: 'element',
      label: 'Project element preference',
      policy_action_id: null,
      availability: 'canonical',
      notes:
        'Read-side projection into the current shell element preference shape.',
    },
    {
      action_id: 'preference.element.index',
      action_kind: 'index',
      packet_subtype: 'element',
      label: 'Index element preference',
      policy_action_id: null,
      availability: 'canonical',
      notes:
        'Indexes owner/subtype/context fields for latest-active preference projection.',
    },
  ],
  builders: [
    {
      builder_id: 'preference.element.body.v0',
      packet_subtype: 'element',
      builder_kind: 'single_packet_body',
      action_ids: ['preference.element.create', 'preference.element.revise'],
      input_schema_key: 'ElementPreferenceBuilderInputSchema',
      output_schema_key: 'ElementPreferenceBodySchema',
      availability: 'runtime_ready',
      notes:
        'Definition-backed body builder used by the live interface preference connector and ready for Dispatch-owned single-packet revision planning.',
    },
  ],
  planners: [
    {
      planner_id: 'preference.element.latest_active_revision.v0',
      planner_kind: 'single_packet_revision',
      action_ids: [
        'preference.element.create',
        'preference.element.revise',
        'preference.element.withdraw',
      ],
      builder_ids: ['preference.element.body.v0'],
      policy_action_ids: ['preference.element.write'],
      availability: 'runtime_ready',
      notes:
        'Plans latest-active/supersedes-chain Preference.element writes using definition metadata plus the generic single-packet revision corridor.',
    },
    {
      planner_id: 'preference.element.projection.v0',
      planner_kind: 'projection_only',
      action_ids: ['preference.element.project'],
      builder_ids: [],
      policy_action_ids: [],
      availability: 'runtime_ready',
      notes:
        'Projects latest active Preference.element packets into shell display and chrome preferences without preference-specific core runtime code.',
    },
  ],
  mutations: [
    {
      mutation_intent: 'preference.element.set',
      action_ids: ['preference.element.create', 'preference.element.revise'],
      planner_id: 'preference.element.latest_active_revision.v0',
      result_type: 'packet_write',
      availability: 'runtime_ready',
      notes:
        'Manifest mutation intent for creating or revising element preferences through the definition-backed connector and signed corridor.',
    },
    {
      mutation_intent: 'preference.element.withdraw',
      action_ids: ['preference.element.withdraw'],
      planner_id: 'preference.element.latest_active_revision.v0',
      result_type: 'packet_write',
      availability: 'canonical',
      notes: 'Manifest mutation intent for withdrawing element preferences.',
    },
  ],
  workflow_plans: [
    {
      workflow_plan_id: 'preference.element.set.workflow.v0',
      packet_type: 'Preference',
      packet_subtype: 'element',
      planner_id: 'preference.element.latest_active_revision.v0',
      mutation_intents: ['preference.element.set'],
      operation_kinds: ['single_packet.revise'],
      resolver_ids: ['actor.ref', 'input.value', 'projection.current'],
      policy_action_ids: ['preference.element.write'],
      dependency_ids: [
        'runtime.packet_store.read',
        'runtime.policy_gate',
        'generic.preference.builder',
        'generic.preference.latest_active_planner',
        'runtime.scope_display_projection',
        'runtime.shell_chrome_projection',
      ],
      steps: [
        {
          step_id: 'revise_element_interface_preference',
          step_kind: 'operation',
          operation_kind: 'single_packet.revise',
          packet_type: 'Preference',
          packet_subtype: 'element',
          resolver_ids: ['actor.ref', 'input.value', 'projection.current'],
          input_bindings: {
            owner_ref: {
              binding_kind: 'actor_ref',
              required: true,
            },
            interface_patch: {
              binding_kind: 'input_path',
              path: 'interface',
              required: true,
            },
          },
          policy_action_ids: ['preference.element.write'],
          dependency_ids: [
            'runtime.packet_store.read',
            'runtime.policy_gate',
            'generic.preference.builder',
            'generic.preference.latest_active_planner',
          ],
          output_key: 'preference_revision',
          on_failure: 'abort_workflow',
          notes:
            'Definition workflow for claimed actor interface preference revisions through the Dispatch corridor.',
        },
      ],
      availability: 'runtime_ready',
      notes:
        'Describes Preference.element set semantics with enough body/projection metadata for the generic revision corridor to build the live write path.',
    },
  ],
  compatibility_adapters: [
    {
      adapter_id: 'preference.element.legacy_v0_to_0_1',
      packet_subtype: 'element',
      from_schema_version: 'legacy_v0',
      to_schema_version: '0.1.0',
      direction: 'upcast_to_current',
      loss_awareness: 'none',
      availability: 'canonical',
      notes:
        'Upcasts the old runtime-compatible shape using main_scope_ids and one show_parent_chains flag into current associated/followed parent-chain toggles.',
    },
    {
      adapter_id: 'preference.element.0_1_to_legacy_v0',
      packet_subtype: 'element',
      from_schema_version: '0.1.0',
      to_schema_version: 'legacy_v0',
      direction: 'downcast_from_current',
      loss_awareness: 'loss_annotated',
      availability: 'canonical',
      notes:
        'Downcasts current element preferences into the old one-toggle parent-chain shape; differing associated/followed toggles are loss-annotated.',
    },
    {
      adapter_id: 'preference.element.0_1_current_neighbor',
      packet_subtype: 'element',
      from_schema_version: '0.1.0',
      to_schema_version: '0.1.0',
      direction: 'bidirectional_neighbor',
      loss_awareness: 'none',
      availability: 'canonical',
      notes:
        'Identity adapter placeholder for the initial Preference.element schema; future versions should add nearest-current steps here.',
    },
  ],
  projections: [
    {
      projection_key: 'scope_display_preferences',
      target_surface: 'nexus_shell',
      mode: 'derived',
      resolver_preset_ids: [
        'actor.ref',
        'packet.lookup.latest_active',
        'projection.field_map',
      ],
      field_descriptors: [
        {
          field_key: 'owner_ref',
          label: 'Owner',
          binding: { binding_kind: 'current_packet', path: 'body.owner_ref', required: true },
          display_role: 'meta',
          required: true,
        },
        {
          field_key: 'scope_display',
          label: 'Scope display preferences',
          binding: { binding_kind: 'current_packet', path: 'body.value.interface.scope_display', required: true },
          display_role: 'body',
          required: true,
        },
        {
          field_key: 'shell_chrome',
          label: 'Shell chrome preferences',
          binding: { binding_kind: 'current_packet', path: 'body.value.interface.shell_chrome', required: true },
          display_role: 'body',
          required: true,
        },
        {
          field_key: 'context_key',
          label: 'Context',
          binding: { binding_kind: 'current_packet', path: 'body.context', required: true },
          display_role: 'meta',
          required: true,
        },
        {
          field_key: 'status',
          label: 'Status',
          binding: { binding_kind: 'current_packet', path: 'body.status', required: true },
          display_role: 'status',
          required: true,
        },
      ],
      layout: {
        layout_key: 'preference.element.interface.detail.v0',
        component_key: 'packet.detail_panel',
        density: 'standard',
        slots: ['owner_ref', 'scope_display', 'shell_chrome', 'context_key', 'status'],
        notes: 'Shows the complete interface-preference projection without requiring shell-specific code paths.',
      },
      preferred_surface: 'nexus_shell',
      policy_action_ids: ['preference.element.write'],
      dependency_ids: [
        'generic.preference.latest_active_planner',
        'runtime.scope_display_projection',
        'runtime.shell_chrome_projection',
      ],
      notes:
        'Projects the latest active owner/context preference into shell scope-display and chrome preference shapes.',
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
  packet_definition_parts: [
    {
      part_id: 'preference.element.packet_definition.v0',
      part_subtype: 'packet_definition',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'element',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: [
        'preference.element.packet_schema.v0',
        'preference.element.packet_action_registry.v0',
        'preference.element.packet_builder_descriptor.v0',
        'preference.element.packet_planner_descriptor.v0',
        'preference.element.packet_projection_descriptor.v0',
        'preference.element.packet_compatibility.v0',
        'preference.element.defaults_definition.v0',
        'preference.element.dependencies_definition.v0',
      ],
      notes:
        'Root definition record for the canonical Preference.element packet subtype.',
    },
    {
      part_id: 'preference.element.packet_schema.v0',
      part_subtype: 'packet_schema',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'element',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      covers_subtypes: ['element'],
      notes:
        'Schema part covering the active canonical element subtype.',
    },
    {
      part_id: 'preference.element.packet_action_registry.v0',
      part_subtype: 'packet_action_registry',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'element',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: [
        'preference.element.create',
        'preference.element.revise',
        'preference.element.withdraw',
        'preference.element.project',
        'preference.element.index',
      ],
      notes:
        'Action registry part for the currently modeled element preference operations.',
    },
    {
      part_id: 'preference.element.packet_builder_descriptor.v0',
      part_subtype: 'packet_builder_descriptor',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'element',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: ['preference.element.body.v0'],
      notes: 'Builder descriptor part for the generic element preference body builder.',
    },
    {
      part_id: 'preference.element.packet_planner_descriptor.v0',
      part_subtype: 'packet_planner_descriptor',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'element',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: [
        'preference.element.latest_active_revision.v0',
        'preference.element.projection.v0',
      ],
      notes: 'Planner descriptor part for latest-active write planning and read projection.',
    },
    {
      part_id: 'preference.element.packet_projection_descriptor.v0',
      part_subtype: 'packet_projection_descriptor',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'element',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: ['scope_display_preferences'],
      notes: 'Projection descriptor part for current shell element preference parity.',
    },
    {
      part_id: 'preference.element.packet_compatibility.v0',
      part_subtype: 'packet_compatibility',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'element',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: [
        'preference.element.legacy_v0_to_0_1',
        'preference.element.0_1_to_legacy_v0',
        'preference.element.0_1_current_neighbor',
      ],
      notes: 'Compatibility definition part for nearest-current, loss-aware element preference adapters.',
    },
    {
      part_id: 'preference.element.defaults_definition.v0',
      part_subtype: 'defaults_definition',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'element',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      applies_to: { packet_type: 'Preference', packet_subtype: 'element' },
      default_values: {
        subtype: 'element',
        status: 'active',
        value: {},
      },
      default_merge_strategy: 'deep_overlay',
      notes: 'Default-definition part for Preference.element packets; concrete scope-display preferences layer in later seed/default packets.',
    },
    {
      part_id: 'preference.element.dependencies_definition.v0',
      part_subtype: 'dependencies_definition',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'element',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: [
        'generic.preference.builder',
        'generic.preference.latest_active_planner',
        'runtime.scope_display_projection',
        'runtime.shell_chrome_projection',
      ],
      notes:
        'Dependency definition part for the generic builder/planner/projection capabilities needed by trusted-local Preference planning.',
    },
  ],
  fixtures: [
    'preference.element.current_runtime_equivalence',
    'preference.element.legacy_v0_adapter',
  ],
  notes: [
    'Bootstrap definition plus seeded Definition material; Preference.element packets are canonical for claimed actor preferences, while execution remains trusted-local.',
    'Preference packets never create graph relationships. They only configure display/behavior for already eligible packets.',
    'Only element is currently enrolled as a supported Preference subtype; scope_display is the first live section under value.interface and shell_chrome is schema/helper-ready for the next bridge pass.',
  ],
} as const satisfies PacketTypeDefinition<typeof PreferenceBodySchema>;
