/**
 * File: preference.ts
 * Description: Core-native bootstrap definition and body schema for actor-owned Preference.element values.
 */

import { z } from 'zod';

import { PacketRefSchema, PacketRevisionRefSchema } from '@core/schema/packet-schema';

import type { PacketTypeDefinition } from './packet-definition-types.ts';

export const PREFERENCE_PACKET_SUBTYPES = ['element', 'node'] as const;

export const PreferencePrivacyModeSchema = z.enum([
  'local_only',
  'private_sync',
  'sealed_private',
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


export const NodeDefinitionProfileUpdateModeSchema = z.enum([
  'pinned_only',
  'manual_review',
  'auto_sync_minor',
]);

export const NodeTrustLevelSchema = z.enum([
  'blocked',
  'unknown',
  'observed',
  'trusted',
  'high_trust',
]);

export const NodeImportReviewModeSchema = z.enum([
  'block',
  'quarantine',
  'advisory',
  'accept_after_verification',
]);

export const NodeTrustedCapabilitySchema = z.enum([
  'definition_source',
  'packet_signer',
  'verification_reporter',
  'import_source',
]);

export const NodeDefinitionPreferenceValueSchema = z
  .object({
    active_definition_profile_ref: PacketRefSchema.nullable().default(null),
    trusted_definition_profile_refs: z.array(PacketRefSchema).default([]),
    update_mode: NodeDefinitionProfileUpdateModeSchema.default('manual_review'),
    allow_seeded_definition_fallback: z.boolean().default(true),
  })
  .strict();

export const NodeTrustGraphPreferenceValueSchema = z
  .object({
    default_unknown_node_trust_level: NodeTrustLevelSchema.default('unknown'),
    minimum_import_trust_level: NodeTrustLevelSchema.default('trusted'),
    trusted_node_refs: z.array(PacketRefSchema).default([]),
    trusted_node_attestation_refs: z.array(PacketRefSchema).default([]),
    accepted_capabilities: z.array(NodeTrustedCapabilitySchema).default([]),
    require_attestation_for_trusted_import: z.boolean().default(true),
  })
  .strict();

export const NodeImportVerificationPreferenceValueSchema = z
  .object({
    unsigned_packet_mode: NodeImportReviewModeSchema.default('quarantine'),
    unknown_signer_mode: NodeImportReviewModeSchema.default('quarantine'),
    trusted_signer_mode: NodeImportReviewModeSchema.default(
      'accept_after_verification'
    ),
    random_reverification_rate: z.number().min(0).max(1).default(0.05),
    require_definition_profile_match: z.boolean().default(true),
  })
  .strict();

export const NodeStorageCleanupPreferenceValueSchema = z
  .object({
    cleanup_mode: z.enum(['manual', 'suggest', 'automatic_safe_only']).default('manual'),
    retain_superseded_revisions_days: z.number().int().positive().nullable().default(null),
    retain_rejected_imports_days: z.number().int().positive().nullable().default(30),
    retain_cached_projection_days: z.number().int().positive().nullable().default(30),
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


const DEFAULT_NODE_DEFINITION_PREFERENCE_VALUE = {
  active_definition_profile_ref: null,
  trusted_definition_profile_refs: [],
  update_mode: 'manual_review',
  allow_seeded_definition_fallback: true,
} as const;

const DEFAULT_NODE_TRUST_GRAPH_PREFERENCE_VALUE = {
  default_unknown_node_trust_level: 'unknown',
  minimum_import_trust_level: 'trusted',
  trusted_node_refs: [],
  trusted_node_attestation_refs: [],
  accepted_capabilities: [],
  require_attestation_for_trusted_import: true,
} as const;

const DEFAULT_NODE_IMPORT_VERIFICATION_PREFERENCE_VALUE = {
  unsigned_packet_mode: 'quarantine',
  unknown_signer_mode: 'quarantine',
  trusted_signer_mode: 'accept_after_verification',
  random_reverification_rate: 0.05,
  require_definition_profile_match: true,
} as const;

const DEFAULT_NODE_STORAGE_CLEANUP_PREFERENCE_VALUE = {
  cleanup_mode: 'manual',
  retain_superseded_revisions_days: null,
  retain_rejected_imports_days: 30,
  retain_cached_projection_days: 30,
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

export const NodePreferenceValueSchema = z
  .object({
    definitions: NodeDefinitionPreferenceValueSchema.default(
      DEFAULT_NODE_DEFINITION_PREFERENCE_VALUE
    ),
    trust_graph: NodeTrustGraphPreferenceValueSchema.default(
      DEFAULT_NODE_TRUST_GRAPH_PREFERENCE_VALUE
    ),
    import_verification: NodeImportVerificationPreferenceValueSchema.default(
      DEFAULT_NODE_IMPORT_VERIFICATION_PREFERENCE_VALUE
    ),
    storage_cleanup: NodeStorageCleanupPreferenceValueSchema.default(
      DEFAULT_NODE_STORAGE_CLEANUP_PREFERENCE_VALUE
    ),
  })
  .strict();

export const NodePreferenceBodySchema = PreferenceBaseBodySchema.extend({
  subtype: z.literal('node'),
  privacy: PreferencePrivacyModeSchema.default('sealed_private'),
  value: NodePreferenceValueSchema.default({
    definitions: DEFAULT_NODE_DEFINITION_PREFERENCE_VALUE,
    trust_graph: DEFAULT_NODE_TRUST_GRAPH_PREFERENCE_VALUE,
    import_verification: DEFAULT_NODE_IMPORT_VERIFICATION_PREFERENCE_VALUE,
    storage_cleanup: DEFAULT_NODE_STORAGE_CLEANUP_PREFERENCE_VALUE,
  }),
}).strict();

export const PreferenceBodySchema = z.discriminatedUnion('subtype', [
  ElementPreferenceBodySchema,
  NodePreferenceBodySchema,
]);


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

export const NodePreferenceBuilderInputSchema = z
  .object({
    owner_ref: PacketRefSchema,
    context: PreferenceContextSchema.optional(),
    privacy: PreferencePrivacyModeSchema.optional(),
    supersedes_ref: PacketRevisionRefSchema.nullable().optional(),
    note: z.string().min(1).nullable().optional(),
    value: NodePreferenceValueSchema.optional(),
  })
  .strict();

export type ElementPreferenceBuilderInput = z.input<
  typeof ElementPreferenceBuilderInputSchema
>;

export type NodePreferenceBuilderInput = z.input<
  typeof NodePreferenceBuilderInputSchema
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
export type NodeDefinitionPreferenceValue = z.infer<
  typeof NodeDefinitionPreferenceValueSchema
>;
export type NodeTrustGraphPreferenceValue = z.infer<
  typeof NodeTrustGraphPreferenceValueSchema
>;
export type NodeImportVerificationPreferenceValue = z.infer<
  typeof NodeImportVerificationPreferenceValueSchema
>;
export type NodeStorageCleanupPreferenceValue = z.infer<
  typeof NodeStorageCleanupPreferenceValueSchema
>;
export type NodePreferenceValue = z.infer<typeof NodePreferenceValueSchema>;

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
      'Preference.element and Preference.node compatibility are represented as definition.packet_compatibility in the canonical definition-part model.',
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
    {
      action_id: 'preference.node.create',
      action_kind: 'create',
      packet_subtype: 'node',
      label: 'Create node preference',
      policy_action_id: 'preference.node.write',
      availability: 'canonical',
      notes:
        'Creates a node-owned preference packet for definition profile selection, trust-graph defaults, import verification, and storage cleanup policy.',
    },
    {
      action_id: 'preference.node.revise',
      action_kind: 'revise',
      packet_subtype: 'node',
      label: 'Revise node preference',
      policy_action_id: 'preference.node.write',
      availability: 'canonical',
      notes:
        'Supersedes the previous active node preference for the same node owner/context while keeping node trust attestations packet-native.',
    },
    {
      action_id: 'preference.node.withdraw',
      action_kind: 'withdraw',
      packet_subtype: 'node',
      label: 'Withdraw node preference',
      policy_action_id: 'preference.node.write',
      availability: 'canonical',
      notes:
        'Withdraws a node preference so the node falls back to pinned seed defaults or administrator-provided local configuration.',
    },
    {
      action_id: 'preference.node.project',
      action_kind: 'project',
      packet_subtype: 'node',
      label: 'Project node preference',
      policy_action_id: null,
      availability: 'canonical',
      notes:
        'Read-side projection for node definition, trust, verification, and cleanup defaults without adding an independent node preference service.',
    },
    {
      action_id: 'preference.node.index',
      action_kind: 'index',
      packet_subtype: 'node',
      label: 'Index node preference',
      policy_action_id: null,
      availability: 'canonical',
      notes:
        'Indexes owner/subtype/context fields for latest-active node preference projection.',
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
    {
      builder_id: 'preference.node.body.v0',
      packet_subtype: 'node',
      builder_kind: 'single_packet_body',
      action_ids: ['preference.node.create', 'preference.node.revise'],
      input_schema_key: 'NodePreferenceBuilderInputSchema',
      output_schema_key: 'NodePreferenceBodySchema',
      availability: 'canonical',
      notes:
        'Definition-backed body builder for node-owned preferences. The node remains an Element packet; this builder only prepares its Preference.node packet.',
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
    {
      planner_id: 'preference.node.latest_active_revision.v0',
      planner_kind: 'single_packet_revision',
      action_ids: [
        'preference.node.create',
        'preference.node.revise',
        'preference.node.withdraw',
      ],
      builder_ids: ['preference.node.body.v0'],
      policy_action_ids: ['preference.node.write'],
      availability: 'canonical',
      notes:
        'Plans latest-active Preference.node writes through the same generic single-packet revision corridor as Preference.element.',
    },
    {
      planner_id: 'preference.node.projection.v0',
      planner_kind: 'projection_only',
      action_ids: ['preference.node.project'],
      builder_ids: [],
      policy_action_ids: [],
      availability: 'canonical',
      notes:
        'Projects latest active Preference.node packets for node-owned definition/trust/verification defaults.',
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
    {
      mutation_intent: 'preference.node.set',
      action_ids: ['preference.node.create', 'preference.node.revise'],
      planner_id: 'preference.node.latest_active_revision.v0',
      result_type: 'packet_write',
      availability: 'canonical',
      notes:
        'Manifest mutation intent for node-owned preferences. Live ingress should enter through Dispatch and the generic Preference planner when enabled.',
    },
    {
      mutation_intent: 'preference.node.withdraw',
      action_ids: ['preference.node.withdraw'],
      planner_id: 'preference.node.latest_active_revision.v0',
      result_type: 'packet_write',
      availability: 'canonical',
      notes: 'Manifest mutation intent for withdrawing node preferences.',
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
    {
      workflow_plan_id: 'preference.node.set.workflow.v0',
      packet_type: 'Preference',
      packet_subtype: 'node',
      planner_id: 'preference.node.latest_active_revision.v0',
      mutation_intents: ['preference.node.set'],
      operation_kinds: ['single_packet.revise'],
      resolver_ids: ['node.ref', 'input.value', 'projection.current'],
      policy_action_ids: ['preference.node.write'],
      dependency_ids: [
        'runtime.packet_store.read',
        'runtime.policy_gate',
        'generic.preference.builder',
        'generic.preference.latest_active_planner',
        'trusted.definition.resolution',
        'trusted.verification.assessment',
        'trusted.archive.discovery',
      ],
      steps: [
        {
          step_id: 'revise_node_preference',
          step_kind: 'operation',
          operation_kind: 'single_packet.revise',
          packet_type: 'Preference',
          packet_subtype: 'node',
          resolver_ids: ['node.ref', 'input.value', 'projection.current'],
          input_bindings: {
            owner_ref: {
              binding_kind: 'node_ref',
              required: true,
            },
            node_preference_patch: {
              binding_kind: 'input_path',
              path: 'value',
              required: true,
            },
          },
          policy_action_ids: ['preference.node.write'],
          dependency_ids: [
            'runtime.packet_store.read',
            'runtime.policy_gate',
            'generic.preference.builder',
            'generic.preference.latest_active_planner',
          ],
          output_key: 'preference_revision',
          on_failure: 'abort_workflow',
          notes:
            'Definition workflow for node preference revisions. Trust ratings stay packet-native through attestations; this packet stores node defaults and pointers.',
        },
      ],
      availability: 'canonical',
      notes:
        'Describes Preference.node write semantics without introducing a new independent runtime service.',
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
    {
      adapter_id: 'preference.node.0_1_current_neighbor',
      packet_subtype: 'node',
      from_schema_version: '0.1.0',
      to_schema_version: '0.1.0',
      direction: 'bidirectional_neighbor',
      loss_awareness: 'none',
      availability: 'canonical',
      notes:
        'Identity adapter placeholder for the initial Preference.node schema; future versions should add nearest-current steps here.',
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
    {
      projection_key: 'node_preferences',
      target_surface: 'nexus_runtime',
      mode: 'derived',
      resolver_preset_ids: [
        'node.ref',
        'packet.lookup.latest_active',
        'projection.field_map',
      ],
      field_descriptors: [
        {
          field_key: 'owner_ref',
          label: 'Node owner',
          binding: { binding_kind: 'current_packet', path: 'body.owner_ref', required: true },
          display_role: 'meta',
          required: true,
        },
        {
          field_key: 'definitions',
          label: 'Definition profile preferences',
          binding: { binding_kind: 'current_packet', path: 'body.value.definitions', required: true },
          display_role: 'body',
          required: true,
        },
        {
          field_key: 'trust_graph',
          label: 'Node trust graph preferences',
          binding: { binding_kind: 'current_packet', path: 'body.value.trust_graph', required: true },
          display_role: 'body',
          required: true,
        },
        {
          field_key: 'import_verification',
          label: 'Import verification preferences',
          binding: { binding_kind: 'current_packet', path: 'body.value.import_verification', required: true },
          display_role: 'body',
          required: true,
        },
        {
          field_key: 'storage_cleanup',
          label: 'Storage cleanup preferences',
          binding: { binding_kind: 'current_packet', path: 'body.value.storage_cleanup', required: true },
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
      ],
      layout: {
        layout_key: 'preference.node.runtime.detail.v0',
        component_key: 'packet.detail_panel',
        density: 'standard',
        slots: [
          'owner_ref',
          'definitions',
          'trust_graph',
          'import_verification',
          'storage_cleanup',
          'context_key',
        ],
        notes: 'Shows node preference defaults and pointers without node-specific presentation code.',
      },
      preferred_surface: 'nexus_runtime',
      policy_action_ids: ['preference.node.write'],
      dependency_ids: [
        'generic.preference.latest_active_planner',
        'trusted.definition.resolution',
        'trusted.verification.assessment',
        'trusted.archive.discovery',
      ],
      notes:
        'Projects the latest active node preference for definition profile selection, trust-graph defaults, import verification, and storage cleanup.',
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

    {
      part_id: 'preference.node.packet_definition.v0',
      part_subtype: 'packet_definition',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'node',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: [
        'preference.node.packet_schema.v0',
        'preference.node.packet_action_registry.v0',
        'preference.node.packet_builder_descriptor.v0',
        'preference.node.packet_planner_descriptor.v0',
        'preference.node.packet_projection_descriptor.v0',
        'preference.node.packet_compatibility.v0',
        'preference.node.defaults_definition.v0',
        'preference.node.dependencies_definition.v0',
      ],
      notes:
        'Root definition record for node-owned Preference packets. Nodes are still Element packets; this subtype only stores node preferences.',
    },
    {
      part_id: 'preference.node.packet_schema.v0',
      part_subtype: 'packet_schema',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'node',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      covers_subtypes: ['node'],
      notes:
        'Schema part covering definition profile, trust graph, import verification, and storage cleanup preference sections.',
    },
    {
      part_id: 'preference.node.packet_action_registry.v0',
      part_subtype: 'packet_action_registry',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'node',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: [
        'preference.node.create',
        'preference.node.revise',
        'preference.node.withdraw',
        'preference.node.project',
        'preference.node.index',
      ],
      notes:
        'Action registry part for node preference create/revise/withdraw/project/index operations.',
    },
    {
      part_id: 'preference.node.packet_builder_descriptor.v0',
      part_subtype: 'packet_builder_descriptor',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'node',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: ['preference.node.body.v0'],
      notes: 'Builder descriptor part for the generic node preference body builder.',
    },
    {
      part_id: 'preference.node.packet_planner_descriptor.v0',
      part_subtype: 'packet_planner_descriptor',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'node',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: [
        'preference.node.latest_active_revision.v0',
        'preference.node.projection.v0',
      ],
      notes: 'Planner descriptor part for node preference latest-active write planning and read projection.',
    },
    {
      part_id: 'preference.node.packet_projection_descriptor.v0',
      part_subtype: 'packet_projection_descriptor',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'node',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: ['node_preferences'],
      notes: 'Projection descriptor part for node preference runtime/profile discovery.',
    },
    {
      part_id: 'preference.node.packet_compatibility.v0',
      part_subtype: 'packet_compatibility',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'node',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: ['preference.node.0_1_current_neighbor'],
      notes: 'Compatibility definition part for the initial Preference.node schema.',
    },
    {
      part_id: 'preference.node.defaults_definition.v0',
      part_subtype: 'defaults_definition',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'node',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      applies_to: { packet_type: 'Preference', packet_subtype: 'node' },
      default_values: {
        subtype: 'node',
        status: 'active',
        privacy: 'sealed_private',
        value: {},
      },
      default_merge_strategy: 'deep_overlay',
      notes:
        'Default-definition part for node preference packets; active node defaults can then point to trusted definition profiles and trust attestations.',
    },
    {
      part_id: 'preference.node.dependencies_definition.v0',
      part_subtype: 'dependencies_definition',
      defines_packet_type: 'Preference',
      defines_packet_subtype: 'node',
      schema_version: '0.1.0',
      availability: 'canonical',
      required: true,
      references: [
        'generic.preference.builder',
        'generic.preference.latest_active_planner',
        'trusted.definition.resolution',
        'trusted.verification.assessment',
        'trusted.archive.discovery',
      ],
      notes:
        'Dependency definition part for node preference projection and generic planning. Node trust ratings remain graph-derived through attestation packets.',
    },
  ],
  fixtures: [
    'preference.element.current_runtime_equivalence',
    'preference.element.legacy_v0_adapter',
    'preference.node.default_runtime_profile',
  ],
  notes: [
    'Bootstrap definition plus seeded Definition material; Preference.element packets are canonical for claimed actor preferences, while execution remains trusted-local.',
    'Preference packets never create graph relationships. They only configure display/behavior for already eligible packets.',
    'Preference.node is an official canonical subtype for node-owned defaults and pointers; live trust scores should still resolve from attestation/verification graph data, not from a private side table.',
  ],
} as const satisfies PacketTypeDefinition<typeof PreferenceBodySchema>;
