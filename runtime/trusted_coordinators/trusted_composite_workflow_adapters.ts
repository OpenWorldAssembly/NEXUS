/**
 * File: trusted_composite_workflow_adapters.ts
 * Description: Trusted composite workflow adapter descriptors for enrolled runtime coordinators.
 */

import {
  getPacketOperationDefinition,
  type PacketOperationKind,
} from '@core/packets/packet-operation-ontology';
import {
  listPacketDependencyRequirementDescriptorsFromDefinitions,
  listPacketPolicyRequirementDescriptorsFromDefinitions,
} from '@core/packets/packet-policy-dependency.ts';
import { trustedDefinitionCoordinator } from '@runtime/trusted_coordinators/trusted_definition_coordinator';
import type { MutationIntent } from '@core/auth/mutation-corridor';
import type { MutationActionId } from '@core/auth/write-policy';

export type TrustedCompositeWorkflowAdapterKind =
  | 'composite.batch.packet_operations'
  | 'composite.default_packet_set.ensure'
  | 'composite.entity_create.with_followups'
  | 'composite.path_create.with_directory_projection'
  | 'composite.discussion_message.create'
  | 'composite.reaction_attestation'
  | 'composite.policy_self_update';

export type CompositeWorkflowPhaseDescriptor = {
  phase_id: string;
  phase_kind:
    | 'resolve_inputs'
    | 'plan_packets'
    | 'plan_operation_batch'
    | 'resolve_policy'
    | 'prepare_digests'
    | 'carry_result_metadata'
    | 'runtime_return_extension';
  operation_kinds: PacketOperationKind[];
  policy_action_ids: MutationActionId[];
  dependency_ids: string[];
  output_key: string;
  notes: string;
};

export type TrustedCompositeWorkflowAdapterDescriptor = {
  adapter_id: string;
  adapter_kind: TrustedCompositeWorkflowAdapterKind;
  mutation_intents: MutationIntent['kind'][];
  source_module: string;
  workflow_plan_ids: string[];
  operation_kinds: PacketOperationKind[];
  policy_action_ids: MutationActionId[];
  dependency_ids: string[];
  phase_order: string[];
  phases: CompositeWorkflowPhaseDescriptor[];
  availability: 'runtime_ready';
  notes: string;
};

export type CompositeWorkflowDryRunPlan = {
  dry_run_kind: 'trusted_composite_workflow.runtime_dry_run';
  adapter_id: string;
  adapter_kind: TrustedCompositeWorkflowAdapterKind;
  mutation_intents: MutationIntent['kind'][];
  operation_kinds: PacketOperationKind[];
  policy_action_ids: MutationActionId[];
  dependency_ids: string[];
  phase_order: string[];
  phases: CompositeWorkflowPhaseDescriptor[];
  ready_for_interpretation: boolean;
  findings: TrustedCompositeWorkflowAdapterAuditFinding[];
};

export type TrustedCompositeWorkflowAdapterAuditFinding = {
  severity: 'error';
  code: string;
  adapter_id: string;
  message: string;
};

export type TrustedCompositeWorkflowAdapterAuditReport = {
  status: 'pass' | 'fail';
  checked_adapter_ids: string[];
  findings: TrustedCompositeWorkflowAdapterAuditFinding[];
};

const TRUSTED_COMPOSITE_WORKFLOW_ADAPTERS = [
  {
    adapter_id: 'composite.locality_graph.apply.v0',
    adapter_kind: 'composite.batch.packet_operations',
    mutation_intents: ['locality.graph.apply'],
    source_module: 'runtime/nexus/server/locality-graph-apply-planner.ts',
    workflow_plan_ids: [],
    operation_kinds: [
      'workflow.compose',
      'single_packet.create',
      'relation.set',
      'relation.clear',
      'projection.refresh',
    ],
    policy_action_ids: [
      'locality.element.create',
      'relation.residence.add',
      'relation.residence.clear',
      'relation.association.add',
      'relation.association.clear',
      'relation.follow.add',
      'relation.follow.clear',
    ],
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.policy_gate',
      'generic.operation.relation',
      'generic.operation.projection',
      'generic.resolver.actor_ref',
      'generic.resolver.packet_ref',
      'generic.resolver.input_value',
      'runtime.planner.scoped_relation',
      'generic.compatibility_projection',
    ],
    phase_order: [
      'resolve_graph_inputs',
      'plan_locality_structure',
      'plan_relation_batches',
      'resolve_multi_scope_policy',
      'prepare_packet_digests',
      'carry_locality_result_metadata',
      'finalize_preference_refresh_extension',
    ],
    phases: [
      {
        phase_id: 'resolve_graph_inputs',
        phase_kind: 'resolve_inputs',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [
          'runtime.packet_store.read',
          'generic.resolver.actor_ref',
          'generic.resolver.input_value',
        ],
        output_key: 'resolved_graph_inputs',
        notes:
          'Validates claimed actor, locality path input, and selected scope packet targets.',
      },
      {
        phase_id: 'plan_locality_structure',
        phase_kind: 'plan_packets',
        operation_kinds: ['single_packet.create'],
        policy_action_ids: ['locality.element.create'],
        dependency_ids: ['runtime.packet_store.read'],
        output_key: 'created_locality_packets',
        notes:
          'Delegates to the existing canonical locality graph planner for Element/Location structural candidates.',
      },
      {
        phase_id: 'plan_relation_batches',
        phase_kind: 'plan_operation_batch',
        operation_kinds: ['relation.set', 'relation.clear'],
        policy_action_ids: [
          'relation.residence.add',
          'relation.residence.clear',
          'relation.association.add',
          'relation.association.clear',
          'relation.follow.add',
          'relation.follow.clear',
        ],
        dependency_ids: [
          'runtime.planner.scoped_relation',
          'generic.operation.relation',
          'generic.resolver.packet_ref',
          'generic.compatibility_projection',
        ],
        output_key: 'relation_packet_batches',
        notes:
          'Plans home, association, and follow relation packets as reusable relation operation batches.',
      },
      {
        phase_id: 'resolve_multi_scope_policy',
        phase_kind: 'resolve_policy',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [
          'locality.element.create',
          'relation.residence.add',
          'relation.residence.clear',
          'relation.association.add',
          'relation.association.clear',
          'relation.follow.add',
          'relation.follow.clear',
        ],
        dependency_ids: ['runtime.policy_gate'],
        output_key: 'multi_scope_policy_decision',
        notes:
          'Groups policy actions by governing scope before ticket creation, matching the current fortress policy path.',
      },
      {
        phase_id: 'prepare_packet_digests',
        phase_kind: 'prepare_digests',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [],
        output_key: 'prepared_packet_candidates',
        notes:
          'Prepares unsigned digest candidates for the packet bundle without signing or persistence.',
      },
      {
        phase_id: 'carry_locality_result_metadata',
        phase_kind: 'carry_result_metadata',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [],
        output_key: 'prepared_result',
        notes:
          'Carries locality graph path results and duplicate warnings through the mutation ticket.',
      },
      {
        phase_id: 'finalize_preference_refresh_extension',
        phase_kind: 'runtime_return_extension',
        operation_kinds: ['projection.refresh'],
        policy_action_ids: [],
        dependency_ids: ['generic.operation.projection'],
        output_key: 'shell_refresh_hint',
        notes:
          'Classifies scope display preference reconciliation and shell payload refresh as a post-fortress runtime extension, not hidden packet write authority.',
      },
    ],
    availability: 'runtime_ready',
    notes:
      'Reusable composite-batch adapter for graph-style workflows that create packet sets, plan operation batches, resolve grouped policy, and carry result metadata.',
  },
  {
    adapter_id: 'composite.discussion_surfaces.ensure.v0',
    adapter_kind: 'composite.default_packet_set.ensure',
    mutation_intents: ['discussion.surfaces.ensure'],
    source_module: 'runtime/nexus/server/default-discussion-surfaces.ts',
    workflow_plan_ids: [],
    operation_kinds: ['workflow.compose', 'single_packet.create'],
    policy_action_ids: ['discussion.surfaces.ensure'],
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.policy_gate',
      'generic.operation.discussion',
      'generic.operation.projection',
      'generic.resolver.packet_ref',
    ],
    phase_order: [
      'resolve_surface_scope',
      'plan_missing_default_surfaces',
      'resolve_surface_policy',
      'prepare_surface_digests',
      'refresh_discussion_projection',
    ],
    phases: [
      {
        phase_id: 'resolve_surface_scope',
        phase_kind: 'resolve_inputs',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: ['runtime.packet_store.read', 'generic.resolver.packet_ref'],
        output_key: 'discussion_scope',
        notes:
          'Resolves the assembly scope that owns the default discussion surface set.',
      },
      {
        phase_id: 'plan_missing_default_surfaces',
        phase_kind: 'plan_packets',
        operation_kinds: ['single_packet.create'],
        policy_action_ids: ['discussion.surfaces.ensure'],
        dependency_ids: [
          'runtime.packet_store.read',
          'generic.operation.discussion',
        ],
        output_key: 'discussion_surface_packets',
        notes:
          'Plans only missing default Discussion packets for the target scope.',
      },
      {
        phase_id: 'resolve_surface_policy',
        phase_kind: 'resolve_policy',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: ['discussion.surfaces.ensure'],
        dependency_ids: ['runtime.policy_gate'],
        output_key: 'surface_policy_decision',
        notes:
          'Keeps the existing scope-level policy action for discussion surface creation.',
      },
      {
        phase_id: 'prepare_surface_digests',
        phase_kind: 'prepare_digests',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [],
        output_key: 'prepared_discussion_packets',
        notes:
          'Prepares unsigned digest candidates for missing discussion surfaces.',
      },
      {
        phase_id: 'refresh_discussion_projection',
        phase_kind: 'runtime_return_extension',
        operation_kinds: ['projection.refresh'],
        policy_action_ids: [],
        dependency_ids: ['generic.operation.projection'],
        output_key: 'discussion_projection_refresh',
        notes:
          'Records discussion feed refresh as a derived runtime extension after persistence.',
      },
    ],
    availability: 'runtime_ready',
    notes:
      'Reusable default-packet-set ensure adapter for idempotent fixture-like packet creation.',
  },
  {
    adapter_id: 'composite.assembly_element.create.v0',
    adapter_kind: 'composite.entity_create.with_followups',
    mutation_intents: ['assembly.element.create'],
    source_module: 'runtime/nexus/server/fortress-prepare-handler-implementation.ts',
    workflow_plan_ids: [],
    operation_kinds: [
      'workflow.compose',
      'single_packet.create',
      'relation.set',
    ],
    policy_action_ids: [
      'assembly.element.create',
      'discussion.surfaces.ensure',
      'relation.association.add',
    ],
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.policy_gate',
      'generic.operation.relation',
      'generic.operation.discussion',
      'generic.resolver.actor_ref',
      'generic.resolver.packet_ref',
      'runtime.planner.scoped_relation',
    ],
    phase_order: [
      'resolve_parent_scope',
      'plan_entity_packet',
      'plan_optional_default_surfaces',
      'plan_optional_association_followup',
      'resolve_entity_policy',
      'prepare_entity_bundle_digests',
    ],
    phases: [
      {
        phase_id: 'resolve_parent_scope',
        phase_kind: 'resolve_inputs',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: ['runtime.packet_store.read', 'generic.resolver.packet_ref'],
        output_key: 'parent_scope',
        notes:
          'Resolves the parent assembly scope and applicable scope refs for the new entity.',
      },
      {
        phase_id: 'plan_entity_packet',
        phase_kind: 'plan_packets',
        operation_kinds: ['single_packet.create'],
        policy_action_ids: ['assembly.element.create'],
        dependency_ids: ['runtime.packet_store.read'],
        output_key: 'assembly_element_packet',
        notes:
          'Plans the new assembly Element packet as the primary entity create operation.',
      },
      {
        phase_id: 'plan_optional_default_surfaces',
        phase_kind: 'plan_operation_batch',
        operation_kinds: ['single_packet.create'],
        policy_action_ids: ['discussion.surfaces.ensure'],
        dependency_ids: ['generic.operation.discussion'],
        output_key: 'optional_discussion_surfaces',
        notes:
          'Uses the same default-packet-set ensure shape when seed_discussions is enabled.',
      },
      {
        phase_id: 'plan_optional_association_followup',
        phase_kind: 'plan_operation_batch',
        operation_kinds: ['relation.set'],
        policy_action_ids: ['relation.association.add'],
        dependency_ids: [
          'runtime.planner.scoped_relation',
          'generic.operation.relation',
        ],
        output_key: 'optional_association_packets',
        notes:
          'Uses a relation operation follow-up when add_association is enabled.',
      },
      {
        phase_id: 'resolve_entity_policy',
        phase_kind: 'resolve_policy',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [
          'assembly.element.create',
          'discussion.surfaces.ensure',
          'relation.association.add',
        ],
        dependency_ids: ['runtime.policy_gate'],
        output_key: 'entity_policy_decision',
        notes:
          'Resolves the combined policy actions for the entity create and enabled follow-up phases.',
      },
      {
        phase_id: 'prepare_entity_bundle_digests',
        phase_kind: 'prepare_digests',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [],
        output_key: 'prepared_entity_bundle',
        notes:
          'Prepares unsigned digest candidates for the primary packet and enabled follow-ups.',
      },
    ],
    availability: 'runtime_ready',
    notes:
      'Reusable entity-create adapter for a primary packet plus optional default surfaces and association follow-ups.',
  },
  {
    adapter_id: 'composite.locality_path.create.v0',
    adapter_kind: 'composite.path_create.with_directory_projection',
    mutation_intents: ['locality.path.create'],
    source_module: 'runtime/nexus/server/locality-directory-service.ts',
    workflow_plan_ids: [],
    operation_kinds: [
      'workflow.compose',
      'single_packet.create',
      'projection.refresh',
    ],
    policy_action_ids: ['locality.element.create'],
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.policy_gate',
      'generic.operation.projection',
      'generic.resolver.actor_ref',
      'generic.resolver.input_value',
      'generic.resolver.packet_ref',
    ],
    phase_order: [
      'resolve_path_inputs',
      'plan_path_packets',
      'resolve_path_policy',
      'prepare_path_digests',
      'carry_directory_projection',
    ],
    phases: [
      {
        phase_id: 'resolve_path_inputs',
        phase_kind: 'resolve_inputs',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [
          'runtime.packet_store.read',
          'generic.resolver.actor_ref',
          'generic.resolver.input_value',
        ],
        output_key: 'resolved_locality_path',
        notes:
          'Normalizes path entries and parent/child locality context before Element/Location packet planning.',
      },
      {
        phase_id: 'plan_path_packets',
        phase_kind: 'plan_packets',
        operation_kinds: ['single_packet.create'],
        policy_action_ids: ['locality.element.create'],
        dependency_ids: ['runtime.packet_store.read', 'generic.resolver.packet_ref'],
        output_key: 'locality_path_packets',
        notes:
          'Delegates to the existing canonical locality path planner for reusable entity/path creation.',
      },
      {
        phase_id: 'resolve_path_policy',
        phase_kind: 'resolve_policy',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: ['locality.element.create'],
        dependency_ids: ['runtime.policy_gate'],
        output_key: 'path_policy_decision',
        notes:
          'Preserves the current locality creation policy action while the planner stays local and trusted.',
      },
      {
        phase_id: 'prepare_path_digests',
        phase_kind: 'prepare_digests',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [],
        output_key: 'prepared_locality_path_packets',
        notes:
          'Prepares unsigned digest candidates for all path packet candidates.',
      },
      {
        phase_id: 'carry_directory_projection',
        phase_kind: 'runtime_return_extension',
        operation_kinds: ['projection.refresh'],
        policy_action_ids: [],
        dependency_ids: ['generic.operation.projection'],
        output_key: 'locality_directory_refresh',
        notes:
          'Carries directory/projection refresh metadata without granting packet write authority outside fortress finalization.',
      },
    ],
    availability: 'runtime_ready',
    notes:
      'Reusable entity/path creation adapter for canonical locality path creation and later initiative-scoped locality policy defaults.',
  },
  {
    adapter_id: 'composite.discussion_thread_post.create.v0',
    adapter_kind: 'composite.discussion_message.create',
    mutation_intents: ['discussion.thread_post.create'],
    source_module: 'runtime/nexus/server/fortress-prepare-handler-implementation.ts',
    workflow_plan_ids: [],
    operation_kinds: [
      'workflow.compose',
      'single_packet.create',
      'projection.refresh',
    ],
    policy_action_ids: ['discussion.thread.create', 'discussion.post.create'],
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.policy_gate',
      'runtime.discussion_service.read',
      'generic.operation.discussion',
      'generic.operation.projection',
      'generic.resolver.packet_ref',
      'generic.resolver.input_value',
      'generic.compatibility_projection',
    ],
    phase_order: [
      'resolve_discussion_surface',
      'plan_canonical_message_thread',
      'resolve_thread_post_policy',
      'prepare_thread_post_digests',
      'project_legacy_thread_post',
    ],
    phases: [
      {
        phase_id: 'resolve_discussion_surface',
        phase_kind: 'resolve_inputs',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [
          'runtime.packet_store.read',
          'runtime.discussion_service.read',
          'generic.resolver.packet_ref',
        ],
        output_key: 'discussion_surface_context',
        notes:
          'Resolves the current discussion surface/scope context used by thread-post creation.',
      },
      {
        phase_id: 'plan_canonical_message_thread',
        phase_kind: 'plan_packets',
        operation_kinds: ['single_packet.create'],
        policy_action_ids: ['discussion.thread.create', 'discussion.post.create'],
        dependency_ids: [
          'generic.operation.discussion',
          'generic.resolver.input_value',
        ],
        output_key: 'canonical_discussion_message_packets',
        notes:
          'Classifies new thread/post writes as future canonical Discussion(kind: message) creation while legacy projections remain compatible until reseed.',
      },
      {
        phase_id: 'resolve_thread_post_policy',
        phase_kind: 'resolve_policy',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: ['discussion.thread.create', 'discussion.post.create'],
        dependency_ids: ['runtime.policy_gate'],
        output_key: 'thread_post_policy_decision',
        notes:
          'Preserves the current discussion thread and post policy actions.',
      },
      {
        phase_id: 'prepare_thread_post_digests',
        phase_kind: 'prepare_digests',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [],
        output_key: 'prepared_thread_post_packets',
        notes:
          'Prepares unsigned digest candidates for canonical/legacy-compatible discussion packets.',
      },
      {
        phase_id: 'project_legacy_thread_post',
        phase_kind: 'runtime_return_extension',
        operation_kinds: ['projection.refresh'],
        policy_action_ids: [],
        dependency_ids: [
          'generic.operation.projection',
          'generic.compatibility_projection',
        ],
        output_key: 'legacy_discussion_projection',
        notes:
          'Keeps DiscussionThread/Post compatibility projection explicit until canonical Discussion message reseed work lands.',
      },
    ],
    availability: 'runtime_ready',
    notes:
      'Reusable canonical discussion-message creation adapter for thread-starting posts with legacy thread/post projections.',
  },
  {
    adapter_id: 'composite.discussion_reply.create.v0',
    adapter_kind: 'composite.discussion_message.create',
    mutation_intents: ['discussion.reply.create'],
    source_module: 'runtime/nexus/server/fortress-prepare-handler-implementation.ts',
    workflow_plan_ids: ['discussion.reply.create.workflow.v0'],
    operation_kinds: [
      'workflow.compose',
      'single_packet.create',
      'projection.refresh',
    ],
    policy_action_ids: ['discussion.reply.create'],
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.policy_gate',
      'runtime.discussion_service.read',
      'runtime.planner.discussion_reply',
      'generic.operation.discussion',
      'generic.operation.projection',
      'generic.resolver.discussion_thread',
      'generic.resolver.input_value',
      'generic.compatibility_projection',
    ],
    phase_order: [
      'resolve_reply_parent',
      'plan_canonical_reply_message',
      'resolve_reply_policy',
      'prepare_reply_digests',
      'project_legacy_reply',
    ],
    phases: [
      {
        phase_id: 'resolve_reply_parent',
        phase_kind: 'resolve_inputs',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [
          'runtime.packet_store.read',
          'runtime.discussion_service.read',
          'generic.resolver.discussion_thread',
        ],
        output_key: 'reply_parent_context',
        notes:
          'Resolves parent message/thread/scope context through the existing local discussion reply planner.',
      },
      {
        phase_id: 'plan_canonical_reply_message',
        phase_kind: 'plan_packets',
        operation_kinds: ['single_packet.create'],
        policy_action_ids: ['discussion.reply.create'],
        dependency_ids: [
          'runtime.planner.discussion_reply',
          'generic.operation.discussion',
          'generic.resolver.input_value',
        ],
        output_key: 'canonical_reply_message_packet',
        notes:
          'Uses the canonical Discussion message shape as the target while retaining legacy reply projection compatibility.',
      },
      {
        phase_id: 'resolve_reply_policy',
        phase_kind: 'resolve_policy',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: ['discussion.reply.create'],
        dependency_ids: ['runtime.policy_gate'],
        output_key: 'reply_policy_decision',
        notes:
          'Keeps the current discussion reply policy action scoped to the resolved parent discussion context.',
      },
      {
        phase_id: 'prepare_reply_digests',
        phase_kind: 'prepare_digests',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [],
        output_key: 'prepared_reply_packet',
        notes:
          'Prepares unsigned digest candidates without signing or persistence.',
      },
      {
        phase_id: 'project_legacy_reply',
        phase_kind: 'runtime_return_extension',
        operation_kinds: ['projection.refresh'],
        policy_action_ids: [],
        dependency_ids: [
          'generic.operation.projection',
          'generic.compatibility_projection',
        ],
        output_key: 'legacy_reply_projection',
        notes:
          'Preserves legacy DiscussionReply projection behavior until reseed collapses thread/post/reply packets into Discussion messages.',
      },
    ],
    availability: 'runtime_ready',
    notes:
      'Reusable canonical discussion-message creation adapter for replies with legacy reply projection compatibility.',
  },
  {
    adapter_id: 'composite.reaction_attestation.set.v0',
    adapter_kind: 'composite.reaction_attestation',
    mutation_intents: ['reaction.attestation.set'],
    source_module: 'runtime/nexus/server/fortress-prepare-handler-implementation.ts',
    workflow_plan_ids: [],
    operation_kinds: [
      'workflow.compose',
      'reaction.set',
      'reaction.clear',
    ],
    policy_action_ids: [
      'reaction.attestation.set',
      'reaction.attestation.clear',
    ],
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.policy_gate',
      'generic.operation.reaction',
      'generic.resolver.packet_ref',
      'generic.resolver.input_value',
      'generic.resolver.role_scope',
    ],
    phase_order: [
      'resolve_role_participation_relation',
      'plan_mutual_exclusion_reactions',
      'resolve_reaction_attestation_policy',
      'prepare_reaction_attestation_digests',
    ],
    phases: [
      {
        phase_id: 'resolve_role_participation_relation',
        phase_kind: 'resolve_inputs',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [
          'runtime.packet_store.read',
          'generic.resolver.packet_ref',
          'generic.resolver.role_scope',
        ],
        output_key: 'role_participation_relation_context',
        notes:
          'Resolves the role participation relation and governing scope before reaction planning.',
      },
      {
        phase_id: 'plan_mutual_exclusion_reactions',
        phase_kind: 'plan_operation_batch',
        operation_kinds: ['reaction.set', 'reaction.clear'],
        policy_action_ids: [
          'reaction.attestation.set',
          'reaction.attestation.clear',
        ],
        dependency_ids: [
          'generic.operation.reaction',
          'generic.resolver.input_value',
        ],
        output_key: 'reaction_attestation_packets',
        notes:
          'Models support/dispute/clear as a reusable mutual-exclusion reaction composition over the same participation relation target.',
      },
      {
        phase_id: 'resolve_reaction_attestation_policy',
        phase_kind: 'resolve_policy',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [
          'reaction.attestation.set',
          'reaction.attestation.clear',
        ],
        dependency_ids: ['runtime.policy_gate'],
        output_key: 'reaction_attestation_policy_decision',
        notes:
          'Keeps current role reaction policy action selection inside the fortress authority path.',
      },
      {
        phase_id: 'prepare_reaction_attestation_digests',
        phase_kind: 'prepare_digests',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [],
        output_key: 'prepared_reaction_attestation_packets',
        notes:
          'Prepares unsigned digest candidates for the selected reaction operation batch.',
      },
    ],
    availability: 'runtime_ready',
    notes:
      'Reusable mutual-exclusion reaction adapter for support/dispute/clear workflows over a packet-addressable participation relation.',
  },
  {
    adapter_id: 'composite.actor_write_policy.update.v0',
    adapter_kind: 'composite.policy_self_update',
    mutation_intents: ['actor.write_policy.update'],
    source_module: 'runtime/nexus/server/write-security-mode.ts',
    workflow_plan_ids: [],
    operation_kinds: [
      'workflow.compose',
      'single_packet.revise',
      'projection.refresh',
    ],
    policy_action_ids: ['actor.write_policy.update'],
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.policy_gate',
      'generic.operation.projection',
      'generic.resolver.actor_ref',
      'generic.resolver.projection',
    ],
    phase_order: [
      'resolve_current_write_policy',
      'plan_policy_revision',
      'plan_actor_policy_ref_revision',
      'resolve_self_update_policy',
      'prepare_policy_update_digests',
      'refresh_actor_projection',
    ],
    phases: [
      {
        phase_id: 'resolve_current_write_policy',
        phase_kind: 'resolve_inputs',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [
          'runtime.packet_store.read',
          'generic.resolver.actor_ref',
          'generic.resolver.projection',
        ],
        output_key: 'current_write_policy_context',
        notes:
          'Resolves the actor-scoped write policy packet and current policy refs.',
      },
      {
        phase_id: 'plan_policy_revision',
        phase_kind: 'plan_packets',
        operation_kinds: ['single_packet.revise'],
        policy_action_ids: ['actor.write_policy.update'],
        dependency_ids: ['runtime.packet_store.read'],
        output_key: 'write_policy_packet_revision',
        notes:
          'Plans the Policy packet revision that updates actor write-lock semantics.',
      },
      {
        phase_id: 'plan_actor_policy_ref_revision',
        phase_kind: 'plan_operation_batch',
        operation_kinds: ['single_packet.revise'],
        policy_action_ids: ['actor.write_policy.update'],
        dependency_ids: ['generic.operation.projection'],
        output_key: 'actor_policy_ref_revision',
        notes:
          'Plans the companion actor Element policy-ref revision only when the reference set changes.',
      },
      {
        phase_id: 'resolve_self_update_policy',
        phase_kind: 'resolve_policy',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: ['actor.write_policy.update'],
        dependency_ids: ['runtime.policy_gate'],
        output_key: 'actor_write_policy_decision',
        notes:
          'Leaves self-update authorization with MutationPolicyGate and the signed fortress corridor.',
      },
      {
        phase_id: 'prepare_policy_update_digests',
        phase_kind: 'prepare_digests',
        operation_kinds: ['workflow.compose'],
        policy_action_ids: [],
        dependency_ids: [],
        output_key: 'prepared_policy_update_packets',
        notes:
          'Prepares unsigned digest candidates for the policy update packet set.',
      },
      {
        phase_id: 'refresh_actor_projection',
        phase_kind: 'runtime_return_extension',
        operation_kinds: ['projection.refresh'],
        policy_action_ids: [],
        dependency_ids: ['generic.operation.projection'],
        output_key: 'actor_policy_projection_refresh',
        notes:
          'Captures actor projection refresh as a runtime return extension after fortress finalization.',
      },
    ],
    availability: 'runtime_ready',
    notes:
      'Reusable policy self-update adapter for actor-owned write policy changes without making runtime policy semantics free-floating.',
  },
] as const satisfies readonly TrustedCompositeWorkflowAdapterDescriptor[];

function uniqueSorted<TValue extends string>(values: readonly TValue[]): TValue[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right)
  );
}

function allKnownPolicyActionIds(): Set<string> {
  const definitions = trustedDefinitionCoordinator.listPacketDefinitions().value ?? [];
  return new Set(
    listPacketPolicyRequirementDescriptorsFromDefinitions({ definitions }).map(
      (descriptor) => descriptor.policy_action_id
    )
  );
}

function allKnownDependencyIds(): Set<string> {
  const definitions = trustedDefinitionCoordinator.listPacketDefinitions().value ?? [];
  return new Set(
    listPacketDependencyRequirementDescriptorsFromDefinitions({ definitions }).map(
      (descriptor) => descriptor.dependency_id
    )
  );
}

function validateAdapter(
  adapter: TrustedCompositeWorkflowAdapterDescriptor
): TrustedCompositeWorkflowAdapterAuditFinding[] {
  const findings: TrustedCompositeWorkflowAdapterAuditFinding[] = [];
  const phaseIds = new Set(adapter.phases.map((phase) => phase.phase_id));
  const policyActionIds = allKnownPolicyActionIds();
  const dependencyIds = allKnownDependencyIds();

  for (const phaseId of adapter.phase_order) {
    if (!phaseIds.has(phaseId)) {
      findings.push({
        severity: 'error',
        code: 'unknown_phase_reference',
        adapter_id: adapter.adapter_id,
        message: `${adapter.adapter_id} phase order references unknown phase ${phaseId}.`,
      });
    }
  }

  for (const operationKind of uniqueSorted([
    ...adapter.operation_kinds,
    ...adapter.phases.flatMap((phase) => phase.operation_kinds),
  ])) {
    if (getPacketOperationDefinition(operationKind)) {
      continue;
    }

    findings.push({
      severity: 'error',
      code: 'unknown_operation_kind',
      adapter_id: adapter.adapter_id,
      message: `${adapter.adapter_id} references unknown operation kind ${operationKind}.`,
    });
  }

  for (const policyActionId of uniqueSorted([
    ...adapter.policy_action_ids,
    ...adapter.phases.flatMap((phase) => phase.policy_action_ids),
  ])) {
    if (policyActionIds.has(policyActionId)) {
      continue;
    }

    findings.push({
      severity: 'error',
      code: 'unknown_policy_action',
      adapter_id: adapter.adapter_id,
      message: `${adapter.adapter_id} references unanchored policy action ${policyActionId}.`,
    });
  }

  for (const dependencyId of uniqueSorted([
    ...adapter.dependency_ids,
    ...adapter.phases.flatMap((phase) => phase.dependency_ids),
  ])) {
    if (dependencyIds.has(dependencyId)) {
      continue;
    }

    findings.push({
      severity: 'error',
      code: 'unknown_dependency',
      adapter_id: adapter.adapter_id,
      message: `${adapter.adapter_id} references unanchored dependency ${dependencyId}.`,
    });
  }

  if (adapter.phase_order.length !== adapter.phases.length) {
    findings.push({
      severity: 'error',
      code: 'phase_order_incomplete',
      adapter_id: adapter.adapter_id,
      message: `${adapter.adapter_id} must order every declared phase exactly once.`,
    });
  }

  return findings;
}

export function listTrustedCompositeWorkflowAdapters(): TrustedCompositeWorkflowAdapterDescriptor[] {
  return TRUSTED_COMPOSITE_WORKFLOW_ADAPTERS.map((adapter) => ({
    ...adapter,
    mutation_intents: [...adapter.mutation_intents],
    workflow_plan_ids: [...adapter.workflow_plan_ids],
    operation_kinds: [...adapter.operation_kinds],
    policy_action_ids: [...adapter.policy_action_ids],
    dependency_ids: [...adapter.dependency_ids],
    phase_order: [...adapter.phase_order],
    phases: adapter.phases.map((phase) => ({
      ...phase,
      operation_kinds: [...phase.operation_kinds],
      policy_action_ids: [...phase.policy_action_ids],
      dependency_ids: [...phase.dependency_ids],
    })),
  }));
}

export function getTrustedCompositeWorkflowAdapter(
  adapterId: string
): TrustedCompositeWorkflowAdapterDescriptor | null {
  return (
    listTrustedCompositeWorkflowAdapters().find(
      (adapter) => adapter.adapter_id === adapterId
    ) ?? null
  );
}

export function resolveCompositeWorkflowDryRun(input: {
  adapterId: string;
}): CompositeWorkflowDryRunPlan {
  const adapter = getTrustedCompositeWorkflowAdapter(input.adapterId);

  if (!adapter) {
    return {
      dry_run_kind: 'trusted_composite_workflow.runtime_dry_run',
      adapter_id: input.adapterId,
      adapter_kind: 'composite.batch.packet_operations',
      mutation_intents: [],
      operation_kinds: [],
      policy_action_ids: [],
      dependency_ids: [],
      phase_order: [],
      phases: [],
      ready_for_interpretation: false,
      findings: [
        {
          severity: 'error',
          code: 'unknown_adapter',
          adapter_id: input.adapterId,
          message: `Unknown trusted composite workflow adapter ${input.adapterId}.`,
        },
      ],
    };
  }

  const findings = validateAdapter(adapter);

  return {
    dry_run_kind: 'trusted_composite_workflow.runtime_dry_run',
    adapter_id: adapter.adapter_id,
    adapter_kind: adapter.adapter_kind,
    mutation_intents: [...adapter.mutation_intents],
    operation_kinds: uniqueSorted([
      ...adapter.operation_kinds,
      ...adapter.phases.flatMap((phase) => phase.operation_kinds),
    ]),
    policy_action_ids: uniqueSorted([
      ...adapter.policy_action_ids,
      ...adapter.phases.flatMap((phase) => phase.policy_action_ids),
    ]),
    dependency_ids: uniqueSorted([
      ...adapter.dependency_ids,
      ...adapter.phases.flatMap((phase) => phase.dependency_ids),
    ]),
    phase_order: [...adapter.phase_order],
    phases: [...adapter.phases].sort(
      (left, right) =>
        adapter.phase_order.indexOf(left.phase_id) -
        adapter.phase_order.indexOf(right.phase_id)
    ),
    ready_for_interpretation: findings.length === 0,
    findings,
  };
}

export function auditTrustedCompositeWorkflowAdapters(): TrustedCompositeWorkflowAdapterAuditReport {
  const adapters = listTrustedCompositeWorkflowAdapters();
  const findings = adapters.flatMap(validateAdapter);

  return {
    status: findings.length > 0 ? 'fail' : 'pass',
    checked_adapter_ids: adapters.map((adapter) => adapter.adapter_id),
    findings,
  };
}
