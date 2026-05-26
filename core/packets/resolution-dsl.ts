/**
 * File: resolution-dsl.ts
 * Description: Portable declarative resolution language shared by packet definitions and trusted runtime coordinators.
 */

export type ResolutionBindingKind =
  | 'input_path'
  | 'actor_ref'
  | 'packet_ref'
  | 'static_value'
  | 'step_output'
  | 'current_packet'
  | 'definition_path';

export type ResolutionValueBinding =
  | {
      binding_kind: 'input_path';
      path: string;
      required: boolean;
    }
  | {
      binding_kind: 'actor_ref';
      required: true;
    }
  | {
      binding_kind: 'packet_ref';
      packet_id_path?: string;
      revision_id_path?: string;
      required: boolean;
    }
  | {
      binding_kind: 'static_value';
      value: unknown;
    }
  | {
      binding_kind: 'step_output';
      step_id: string;
      output_key: string;
      required: boolean;
    }
  | {
      binding_kind: 'current_packet';
      path?: string;
      required: boolean;
    }
  | {
      binding_kind: 'definition_path';
      path: string;
      required: boolean;
    };

export type ResolutionConditionDescriptor = {
  condition_kind: 'equals' | 'not_equals' | 'present' | 'absent';
  left: ResolutionValueBinding;
  right?: ResolutionValueBinding;
};

export type ResolutionPresetKind =
  | 'primitive_binding'
  | 'packet_lookup'
  | 'policy_gate'
  | 'dependency_gate'
  | 'workflow_context'
  | 'projection_context'
  | 'compatibility_context'
  | 'ui_surface_context';

export type ResolutionPresetDescriptor = {
  preset_id: string;
  preset_kind: ResolutionPresetKind;
  resolver_ids: readonly string[];
  required_dependency_ids: readonly string[];
  policy_action_ids: readonly string[];
  input_keys: readonly string[];
  output_keys: readonly string[];
  notes: string;
};

export type ResolutionPresetRegistry = {
  registry_id: string;
  registry_version: string;
  presets: readonly ResolutionPresetDescriptor[];
};

export type ResolutionStepDescriptor = {
  step_id: string;
  preset_ids: readonly string[];
  input_bindings: Readonly<Record<string, ResolutionValueBinding>>;
  output_key: string;
  on_failure: 'abort_workflow' | 'skip_step';
  notes: string;
};

function preset(input: ResolutionPresetDescriptor): ResolutionPresetDescriptor {
  return input;
}

export const RESOLUTION_DSL_PRESETS = [
  preset({
    preset_id: 'resolution.primitive_bindings.v0',
    preset_kind: 'primitive_binding',
    resolver_ids: ['actor.ref', 'input.value', 'static.value'],
    required_dependency_ids: [],
    policy_action_ids: [],
    input_keys: ['actor_ref', 'input_path', 'static_value'],
    output_keys: ['resolved_value'],
    notes:
      'Primitive actor, input-path, and static-value bindings shared by workflow, projection, and builder coordinators.',
  }),
  preset({
    preset_id: 'resolution.packet_ref.v0',
    preset_kind: 'packet_lookup',
    resolver_ids: ['input.packet_ref'],
    required_dependency_ids: ['runtime.packet_store.read'],
    policy_action_ids: [],
    input_keys: ['packet_id', 'revision_id'],
    output_keys: ['packet_ref', 'packet'],
    notes:
      'Normalizes and optionally loads a packet ref from runtime input or another resolved value.',
  }),
  preset({
    preset_id: 'resolution.current_projection.v0',
    preset_kind: 'projection_context',
    resolver_ids: ['projection.current'],
    required_dependency_ids: ['generic.resolver.projection'],
    policy_action_ids: [],
    input_keys: ['packet_ref', 'projection_key'],
    output_keys: ['projection'],
    notes:
      'Resolves current projection state for no-op detection, surface routing, and UI-ready read models.',
  }),
  preset({
    preset_id: 'resolution.policy_gate.v0',
    preset_kind: 'policy_gate',
    resolver_ids: [],
    required_dependency_ids: ['runtime.policy_gate'],
    policy_action_ids: [],
    input_keys: ['actor_ref', 'action_ids', 'scope_ref'],
    output_keys: ['policy_decision'],
    notes:
      'Declares the standard policy-gate seam used before trusted local write planning.',
  }),
  preset({
    preset_id: 'resolution.dependency_gate.v0',
    preset_kind: 'dependency_gate',
    resolver_ids: [],
    required_dependency_ids: ['generic.operation.projection'],
    policy_action_ids: [],
    input_keys: ['dependency_ids'],
    output_keys: ['dependency_status'],
    notes:
      'Declares dependency checks that keep builders, workflows, and projections from silently running with missing anchors.',
  }),
  preset({
    preset_id: 'resolution.relation.active_lookup.v0',
    preset_kind: 'workflow_context',
    resolver_ids: ['relation.active_lookup'],
    required_dependency_ids: ['runtime.packet_store.read', 'generic.resolver.relation_lookup'],
    policy_action_ids: [],
    input_keys: ['subject_ref', 'target_ref', 'scope_ref', 'subtype'],
    output_keys: ['existing_relation'],
    notes:
      'Shared relation lookup preset for set, clear, replacement, and projection workflows.',
  }),
  preset({
    preset_id: 'resolution.discussion.thread_context.v0',
    preset_kind: 'workflow_context',
    resolver_ids: ['discussion.parent_thread'],
    required_dependency_ids: ['runtime.discussion_service.read', 'generic.resolver.discussion_thread'],
    policy_action_ids: [],
    input_keys: ['thread_packet_id', 'parent_post_packet_id', 'forum_packet_id'],
    output_keys: ['forum_ref', 'thread_ref', 'parent_post_ref', 'scope_ref'],
    notes:
      'Shared discussion context preset for thread, reply, focus, and projection coordinators.',
  }),
  preset({
    preset_id: 'resolution.role.scope_context.v0',
    preset_kind: 'workflow_context',
    resolver_ids: ['role.scope'],
    required_dependency_ids: ['runtime.packet_store.read', 'generic.resolver.role_scope'],
    policy_action_ids: [],
    input_keys: ['role_packet_id', 'scope_id'],
    output_keys: ['authority_scope_ref', 'applicable_scope_refs'],
    notes:
      'Shared role-scope preset for role participation writes and role-aware UI projections.',
  }),
  preset({
    preset_id: 'resolution.compatibility_projection.v0',
    preset_kind: 'compatibility_context',
    resolver_ids: ['compatibility.projection'],
    required_dependency_ids: ['generic.compatibility_projection'],
    policy_action_ids: [],
    input_keys: ['packet_ref', 'target_schema_version'],
    output_keys: ['adapted_packet', 'compatibility_notes'],
    notes:
      'Shared compatibility projection preset used by old clients, fresh definitions, and legacy mirrors.',
  }),
  preset({
    preset_id: 'resolution.ui.card_projection.v0',
    preset_kind: 'ui_surface_context',
    resolver_ids: ['projection.current'],
    required_dependency_ids: ['runtime.packet_store.read', 'generic.resolver.projection'],
    policy_action_ids: [],
    input_keys: ['packet_ref', 'surface_key'],
    output_keys: ['title', 'label', 'summary', 'status', 'actions', 'layout_key'],
    notes:
      'Shared UI projection preset for packet cards, focus cards, explorer rows, and surface summaries.',
  }),
] as const satisfies readonly ResolutionPresetDescriptor[];

export const RESOLUTION_DSL_PRESET_REGISTRY = {
  registry_id: 'resolution.dsl.presets.v0',
  registry_version: '0.1.0',
  presets: RESOLUTION_DSL_PRESETS,
} as const satisfies ResolutionPresetRegistry;

export type ResolutionDslPresetId =
  (typeof RESOLUTION_DSL_PRESETS)[number]['preset_id'];

export function listResolutionDslPresets(): ResolutionPresetDescriptor[] {
  return [...RESOLUTION_DSL_PRESETS];
}

export function getResolutionDslPreset(
  presetId: string
): ResolutionPresetDescriptor | null {
  return RESOLUTION_DSL_PRESETS.find((preset) => preset.preset_id === presetId) ?? null;
}
