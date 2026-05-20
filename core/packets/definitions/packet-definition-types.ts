/**
 * File: packet-definition-types.ts
 * Description: Shared packet type manifest contracts for canonical and staged packet definitions.
 */

import type { z } from 'zod';
import type { PacketWorkflowPlanDescriptor } from '@core/packets/packet-workflow-planner.ts';

export type PacketDefinitionStatus =
  | 'experimental_shadow'
  | 'active'
  | 'canonical'
  | 'deprecated'
  | 'legacy_bridge';

export type PacketStorageClass =
  | 'public_record'
  | 'private_sync'
  | 'local_only'
  | 'sealed_private'
  | 'derived_cache'
  | 'system_report';

export type PacketRevisionBehavior =
  | 'append_only'
  | 'latest_active_projection'
  | 'replaceable'
  | 'mergeable'
  | 'supersedes_chain';

export type PacketActionKind =
  | 'create'
  | 'revise'
  | 'withdraw'
  | 'attest'
  | 'adapt'
  | 'bundle'
  | 'project'
  | 'index'
  | 'policy_action'
  | 'import'
  | 'export'
  | 'verify';

export type PacketManifestSectionKey =
  | 'identity'
  | 'schema'
  | 'storage'
  | 'revision'
  | 'actions'
  | 'builders'
  | 'planners'
  | 'policy'
  | 'projection'
  | 'indexing'
  | 'compatibility'
  | 'bundling'
  | 'fixtures'
  | 'notes';

export type PacketManifestSectionStatus =
  | 'supported'
  | 'unsupported'
  | 'deferred'
  | 'custom';

export type PacketManifestSectionDescriptor = {
  section_key: PacketManifestSectionKey;
  status: PacketManifestSectionStatus;
  summary: string;
  required_for_shadow_definition: boolean;
};

export type PacketCompatibilityPosture = {
  strategy: 'current_neighbor_adapters' | 'full_chain_bundle' | 'current_only';
  current_schema_version: string;
  supports_upcast: boolean;
  supports_downcast: boolean;
  loss_awareness: 'none' | 'loss_annotated' | 'loss_ack_required';
  notes: string;
};

export type PacketProjectionDescriptor = {
  projection_key: string;
  target_surface: string;
  mode: 'direct' | 'derived' | 'cache_only';
  notes: string;
};

export type PacketIndexDescriptor = {
  index_key: string;
  fields: readonly string[];
  notes: string;
};

export type PacketIdStrategyDescriptor = {
  strategy_id: string;
  packet_id_mode: 'deterministic' | 'content_addressed' | 'random' | 'import_preserved';
  revision_id_mode: 'deterministic' | 'content_addressed' | 'monotonic' | 'import_preserved';
  uniqueness_fields: readonly string[];
  notes: string;
};

export type PacketActionDescriptor = {
  action_id: string;
  action_kind: PacketActionKind;
  packet_subtype: string | null;
  label: string;
  policy_action_id: string | null;
  availability: 'shadow_only' | 'runtime_ready' | 'canonical';
  notes: string;
};

export type PacketBuilderDescriptor = {
  builder_id: string;
  packet_subtype: string | null;
  builder_kind:
    | 'single_packet_body'
    | 'single_packet_envelope'
    | 'multi_packet_bundle'
    | 'adapter_output';
  action_ids: readonly string[];
  input_schema_key: string;
  output_schema_key: string;
  availability: 'shadow_only' | 'runtime_ready' | 'canonical';
  notes: string;
};

export type PacketPlannerDescriptor = {
  planner_id: string;
  planner_kind:
    | 'single_packet_create'
    | 'single_packet_revision'
    | 'multi_packet_orchestration'
    | 'projection_only'
    | 'compatibility_adapter_chain';
  action_ids: readonly string[];
  builder_ids: readonly string[];
  policy_action_ids: readonly string[];
  workflow_plan_ids?: readonly string[];
  availability: 'shadow_only' | 'runtime_ready' | 'canonical';
  notes: string;
};

export type PacketMutationDescriptor = {
  mutation_intent: string;
  action_ids: readonly string[];
  planner_id: string;
  workflow_plan_ids?: readonly string[];
  result_family: 'packet_write' | 'projection_update' | 'compatibility_update' | 'bundle_update';
  availability: 'shadow_only' | 'runtime_ready' | 'canonical';
  notes: string;
};

export type PacketCompatibilityAdapterDescriptor = {
  adapter_id: string;
  packet_subtype: string | null;
  from_schema_version: string;
  to_schema_version: string;
  direction:
    | 'upcast_to_current'
    | 'upcast_to_next'
    | 'downcast_from_current'
    | 'downcast_to_previous'
    | 'bidirectional_neighbor';
  loss_awareness: 'none' | 'loss_annotated' | 'loss_ack_required';
  availability: 'shadow_only' | 'runtime_ready' | 'canonical';
  notes: string;
};


export type PacketDefinitionPartSubtype =
  | 'packet_definition'
  | 'packet_schema'
  | 'packet_action_registry'
  | 'packet_builder_descriptor'
  | 'packet_planner_descriptor'
  | 'packet_projection_descriptor'
  | 'packet_compatibility'
  | 'packet_dependency';

export type PacketDefinitionPartDescriptor = {
  part_id: string;
  part_subtype: PacketDefinitionPartSubtype;
  defines_packet_type: string;
  defines_packet_subtype: string | null;
  schema_version: string;
  availability: 'shadow_only' | 'runtime_ready' | 'canonical';
  required: boolean;
  references?: readonly string[];
  covers_subtypes?: readonly string[];
  notes: string;
};

export type PacketDefinitionSectionMap = Partial<
  Record<PacketManifestSectionKey, PacketManifestSectionStatus>
>;

export type PacketTypeDefinition<TBodySchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  packet_type: string;
  canonical_body_type: string;
  definition_status: PacketDefinitionStatus;
  current_schema_version: string;
  storage_class: PacketStorageClass;
  revision_behavior: PacketRevisionBehavior;
  body_schema: TBodySchema;
  declared_subtypes: readonly string[];
  default_subtype: string;
  section_statuses?: PacketDefinitionSectionMap;
  compatibility: PacketCompatibilityPosture;
  id_strategy: PacketIdStrategyDescriptor;
  actions: readonly PacketActionDescriptor[];
  builders: readonly PacketBuilderDescriptor[];
  planners: readonly PacketPlannerDescriptor[];
  mutations: readonly PacketMutationDescriptor[];
  workflow_plans?: readonly PacketWorkflowPlanDescriptor[];
  compatibility_adapters: readonly PacketCompatibilityAdapterDescriptor[];
  projections: readonly PacketProjectionDescriptor[];
  indexes: readonly PacketIndexDescriptor[];
  packet_definition_parts?: readonly PacketDefinitionPartDescriptor[];
  fixtures?: readonly string[];
  notes: readonly string[];
};

export type PacketDefinitionManifestItem = {
  packet_type: string;
  schema_version: string;
  definition_status: PacketDefinitionStatus;
  storage_class: PacketStorageClass;
  manifest_role: 'packet_type_definition' | 'definition_definition' | 'bundle_definition';
  action_kinds: readonly PacketActionKind[];
  action_count: number;
  builder_count: number;
  planner_count: number;
};

export type PacketDefinitionManifest = {
  manifest_type: 'packet_definition_manifest';
  manifest_version: string;
  status: PacketDefinitionStatus;
  template_version: string;
  items: readonly PacketDefinitionManifestItem[];
  dependencies: readonly string[];
  compatibility_notes: readonly string[];
};

/**
 * Transitional alias for old discussion language. Affordances are now derived
 * from action descriptors rather than stored as a second source of truth.
 */
export type PacketDefinitionAffordance = PacketActionKind;
