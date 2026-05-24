/**
 * File: generic-type.ts
 * Description: Factory-backed Canonical definitions for generic builder-supported packet types.
 */

import {
  ATTESTATION_SUBTYPES,
  CLAIM_SUBTYPES,
  DISCUSSION_SUBTYPES,
  ELEMENT_SUBTYPES,
  LOCATION_SUBTYPES,
  PACKET_BODY_SCHEMAS,
  PACKET_COMPATIBILITY_REGISTRY,
  RELATION_SUBTYPES,
  type PacketCompatibilityEntry,
  type PacketType,
} from '@core/schema/packet-schema';

import type {
  PacketDefinitionPartDescriptor,
  PacketProjectionDescriptor,
  PacketRevisionBehavior,
  PacketTypeDefinition,
} from './packet-definition-types.ts';
import type { PacketOperationKind } from '@core/packets/packet-operation-ontology.ts';
import type {
  PacketWorkflowPlanDescriptor,
  PacketWorkflowStepDescriptor,
} from '@core/packets/packet-workflow-planner.ts';
import {
  createRegistryCompatibilityAdapterDescriptors,
  derivePacketCompatibilityPosture,
} from './compatibility-standard.ts';

type GenericBuilderType =
  | 'Element'
  | 'Location'
  | 'Role'
  | 'Claim'
  | 'Relation'
  | 'Report'
  | 'Proposal'
  | 'Vote'
  | 'Attestation'
  | 'Decision'
  | 'Action'
  | 'Discussion'
  | 'Policy';

type GenericTypeDefinitionConfig<TType extends GenericBuilderType> = {
  type: TType;
  canonical_body_type: string;
  declared_subtypes: readonly string[];
  default_subtype: string;
  storage_class?: PacketTypeDefinition['storage_class'];
  projections?: readonly PacketProjectionDescriptor[];
  index_fields?: readonly string[];
  notes?: readonly string[];
};

const GENERIC_TYPE_CONFIGS = [
  {
    type: 'Element',
    canonical_body_type: 'element',
    declared_subtypes: ELEMENT_SUBTYPES,
    default_subtype: 'assembly',
    index_fields: ['body.subtype', 'body.name'],
  },
  {
    type: 'Location',
    canonical_body_type: 'location',
    declared_subtypes: LOCATION_SUBTYPES,
    default_subtype: 'point',
    index_fields: ['body.subtype', 'body.title', 'body.status'],
  },
  {
    type: 'Role',
    canonical_body_type: 'role',
    declared_subtypes: ['role'],
    default_subtype: 'role',
    index_fields: ['body.subtype', 'body.title', 'body.status'],
  },
  {
    type: 'Claim',
    canonical_body_type: 'claim',
    declared_subtypes: CLAIM_SUBTYPES,
    default_subtype: 'relation_assertion',
    index_fields: ['body.subtype', 'body.target_ref.packet_id', 'body.status'],
  },
  {
    type: 'Relation',
    canonical_body_type: 'relation',
    declared_subtypes: RELATION_SUBTYPES,
    default_subtype: 'association',
    index_fields: [
      'body.subtype',
      'body.subject_ref.packet_id',
      'body.target_ref.packet_id',
    ],
  },
  {
    type: 'Report',
    canonical_body_type: 'report',
    declared_subtypes: ['verification_report', 'import_report', 'decision_report'],
    default_subtype: 'verification_report',
    index_fields: ['body.subtype', 'body.target_ref.packet_id', 'body.status'],
  },
  {
    type: 'Proposal',
    canonical_body_type: 'proposal',
    declared_subtypes: ['proposal'],
    default_subtype: 'proposal',
    index_fields: ['body.subtype', 'body.title', 'body.status'],
  },
  {
    type: 'Vote',
    canonical_body_type: 'vote',
    declared_subtypes: ['vote'],
    default_subtype: 'vote',
    index_fields: ['body.proposal_ref.packet_id', 'body.vote_method', 'body.status'],
  },
  {
    type: 'Attestation',
    canonical_body_type: 'attestation',
    declared_subtypes: ATTESTATION_SUBTYPES,
    default_subtype: 'packet_signal',
    index_fields: ['body.subtype', 'body.target_ref.packet_id', 'body.status'],
  },
  {
    type: 'Decision',
    canonical_body_type: 'decision',
    declared_subtypes: ['decision'],
    default_subtype: 'decision',
    index_fields: ['body.outcome', 'body.title'],
  },
  {
    type: 'Action',
    canonical_body_type: 'action',
    declared_subtypes: ['initiative', 'campaign', 'program', 'mission', 'task'],
    default_subtype: 'initiative',
    index_fields: ['body.subtype', 'body.title', 'body.status'],
  },
  {
    type: 'Discussion',
    canonical_body_type: 'discussion',
    declared_subtypes: DISCUSSION_SUBTYPES,
    default_subtype: 'space',
    index_fields: ['body.subtype', 'body.role', 'body.title'],
  },
  {
    type: 'Policy',
    canonical_body_type: 'policy',
    declared_subtypes: ['policy'],
    default_subtype: 'policy',
    index_fields: ['body.subtype', 'body.title', 'body.status'],
  },
] as const satisfies readonly GenericTypeDefinitionConfig<GenericBuilderType>[];

function lowerFirst(value: string): string {
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function toKebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function toRevisionBehavior(type: PacketType): PacketRevisionBehavior {
  const revisionMode = PACKET_COMPATIBILITY_REGISTRY[type].revision_mode;

  if (revisionMode === 'append_only') {
    return 'append_only';
  }

  if (revisionMode === 'mergeable') {
    return 'mergeable';
  }

  return 'replaceable';
}

function createDependencyReferences(type: GenericBuilderType): string[] {
  const references = new Set([
    'generic.packet.builder_pipeline',
    'generic.packet.definition_action_bridge',
  ]);

  if (type === 'Action') references.add('generic.operation.action');
  if (type === 'Policy') references.add('generic.operation.policy');
  if (type === 'Relation') references.add('generic.operation.relation');
  if (type === 'Claim') references.add('generic.operation.claim');
  if (type === 'Attestation') references.add('generic.operation.attestation');
  if (type === 'Discussion') references.add('generic.operation.discussion');
  if (type === 'Report') references.add('generic.operation.report');

  return Array.from(references).sort((left, right) => left.localeCompare(right));
}

function createDefaultAppliesTo(input: {
  type: GenericBuilderType;
  subtype: string;
}) {
  return {
    packet_type: input.type,
    packet_subtype: input.subtype,
    ...(input.type === 'Relation' ? { relation_subtype: input.subtype } : {}),
    ...(input.type === 'Policy' ? { policy_subtype: input.subtype } : {}),
    ...(input.type === 'Action' ? { action_subtype: input.subtype } : {}),
  };
}

function createDefaultValues(input: {
  type: GenericBuilderType;
  subtype: string;
}): Record<string, unknown> {
  if (input.type === 'Relation' && input.subtype === 'subscription') {
    return {
      subtype: input.subtype,
      status: 'active',
      subscription_options: {
        update_mode: 'manual_review',
        inherit_default_policies: true,
        inherit_default_dependencies: true,
        inherit_default_defaults: true,
        inherit_default_modules: true,
        inherit_default_templates: true,
        inherit_default_packet_sets: true,
        tracks: {
          changelogs: true,
          compatibility: true,
          upstream_decisions: true,
          aar_lessons: false,
        },
        local_behavior: {
          require_local_ratification: false,
          fork_on_breaking_change: false,
          alert_on_alignment_break: true,
        },
      },
    };
  }

  if (input.type === 'Relation') {
    return {
      subtype: input.subtype,
      status: 'active',
    };
  }

  return {
    subtype: input.subtype,
  };
}

function createDefaultDefinitionParts(input: {
  type: GenericBuilderType;
  schemaVersion: string;
  declaredSubtypes: readonly string[];
}): PacketDefinitionPartDescriptor[] {
  const baseId = lowerFirst(input.type);

  return input.declaredSubtypes.map((subtype) => ({
    part_id: `${baseId}.defaults_definition.${toKebab(subtype)}.v0`,
    part_subtype: 'defaults_definition',
    defines_packet_type: input.type,
    defines_packet_subtype: subtype,
    schema_version: input.schemaVersion,
    availability: 'runtime_ready',
    required: true,
    applies_to: createDefaultAppliesTo({ type: input.type, subtype }),
    default_values: createDefaultValues({ type: input.type, subtype }),
    merge_strategy: 'deep_overlay',
    notes: `Default-definition part for ${input.type}.${subtype}; concrete OWA preferences can layer policy overrides later.`,
  }));
}

function createDefinitionParts(input: {
  type: GenericBuilderType;
  defaultSubtype: string;
  schemaVersion: string;
  actionIds: readonly string[];
  builderId: string;
  plannerIds: readonly string[];
  projectionKey: string;
  indexKey: string;
  compatibilityAdapterIds: readonly string[];
  declaredSubtypes: readonly string[];
}): PacketDefinitionPartDescriptor[] {
  const baseId = lowerFirst(input.type);

  return [
    {
      part_id: `${baseId}.packet_definition.v0`,
      part_subtype: 'packet_definition',
      defines_packet_type: input.type,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'runtime_ready',
      required: true,
      references: [
        `${baseId}.packet_schema.v0`,
        `${baseId}.packet_action_registry.v0`,
        `${baseId}.packet_builder_descriptor.v0`,
        `${baseId}.packet_planner_descriptor.v0`,
        `${baseId}.packet_projection_descriptor.v0`,
        `${baseId}.packet_compatibility.v0`,
        `${baseId}.defaults_definition.${toKebab(input.defaultSubtype)}.v0`,
        `${baseId}.dependencies_definition.v0`,
      ],
      notes: `Root Canonical definition record for ${input.type}.`,
    },
    {
      part_id: `${baseId}.packet_schema.v0`,
      part_subtype: 'packet_schema',
      defines_packet_type: input.type,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'runtime_ready',
      required: true,
      covers_subtypes: input.declaredSubtypes,
      notes: `Schema part backed by the canonical ${input.type} body schema.`,
    },
    {
      part_id: `${baseId}.packet_action_registry.v0`,
      part_subtype: 'packet_action_registry',
      defines_packet_type: input.type,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'runtime_ready',
      required: true,
      references: input.actionIds,
      notes: `Action registry part for generic ${input.type} packet operations.`,
    },
    {
      part_id: `${baseId}.packet_builder_descriptor.v0`,
      part_subtype: 'packet_builder_descriptor',
      defines_packet_type: input.type,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'runtime_ready',
      required: true,
      references: [input.builderId],
      notes: `Builder descriptor part for the generic ${input.type} body builder.`,
    },
    {
      part_id: `${baseId}.packet_planner_descriptor.v0`,
      part_subtype: 'packet_planner_descriptor',
      defines_packet_type: input.type,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'runtime_ready',
      required: true,
      references: input.plannerIds,
      notes: `Planner descriptor part for generic ${input.type} writes and projections.`,
    },
    {
      part_id: `${baseId}.packet_projection_descriptor.v0`,
      part_subtype: 'packet_projection_descriptor',
      defines_packet_type: input.type,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'runtime_ready',
      required: true,
      references: [input.projectionKey],
      notes: `Projection descriptor part for generic ${input.type} read models.`,
    },
    {
      part_id: `${baseId}.packet_compatibility.v0`,
      part_subtype: 'packet_compatibility',
      defines_packet_type: input.type,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'runtime_ready',
      required: true,
      references: input.compatibilityAdapterIds,
      notes: `Compatibility part summarizing the canonical ${input.type} compatibility registry entry.`,
    },
    ...createDefaultDefinitionParts({
      type: input.type,
      schemaVersion: input.schemaVersion,
      declaredSubtypes: input.declaredSubtypes,
    }),
    {
      part_id: `${baseId}.dependencies_definition.v0`,
      part_subtype: 'dependencies_definition',
      defines_packet_type: input.type,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'runtime_ready',
      required: true,
      references: createDependencyReferences(input.type),
      notes:
        'Dependency definition part for the generic builder pipeline, Canonical action-plan resolver, and packet-specific semantic operation anchors.',
    },
  ];
}

function inputPath(path: string) {
  return {
    binding_kind: 'input_path',
    path,
    required: true,
  } as const;
}

function actorRef() {
  return {
    binding_kind: 'actor_ref',
    required: true,
  } as const;
}

function staticValue(value: unknown) {
  return {
    binding_kind: 'static_value',
    value,
  } as const;
}

function operationStep(input: {
  step_id: string;
  operation_kind: PacketOperationKind;
  packet_type: GenericBuilderType;
  packet_subtype: string;
  resolver_ids: readonly string[];
  policy_action_ids: readonly string[];
  dependency_ids: readonly string[];
  input_bindings: Readonly<
    Record<
      string,
      ReturnType<typeof inputPath> | ReturnType<typeof actorRef> | ReturnType<typeof staticValue>
    >
  >;
  output_key: string;
  notes: string;
}): PacketWorkflowStepDescriptor {
  return {
    step_kind: 'operation',
    on_failure: 'abort_workflow',
    ...input,
  };
}

function createGenericReadyWorkflowPlans(input: {
  type: GenericBuilderType;
  writePlannerId: string;
}): PacketWorkflowPlanDescriptor[] {
  if (input.type === 'Relation') {
    return [
      {
        workflow_plan_id: 'relation.follow.add.workflow.v0',
        packet_type: 'Relation',
        packet_subtype: 'follow',
        planner_id: input.writePlannerId,
        mutation_intents: ['relation.follow.add'],
        operation_kinds: ['relation.set'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup'],
        policy_action_ids: ['relation.follow.add'],
        dependency_ids: [
          'runtime.packet_store.read',
          'runtime.policy_gate',
          'generic.operation.relation',
          'generic.resolver.actor_ref',
          'generic.resolver.packet_ref',
          'generic.resolver.static_value',
          'generic.resolver.relation_lookup',
        ],
        steps: [
          operationStep({
            step_id: 'write_follow_relation',
            operation_kind: 'relation.set',
            packet_type: 'Relation',
            packet_subtype: 'follow',
            resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup'],
            policy_action_ids: ['relation.follow.add'],
            dependency_ids: [
              'runtime.packet_store.read',
              'runtime.policy_gate',
              'generic.operation.relation',
            ],
            input_bindings: {
              subject_ref: actorRef(),
              target_ref: inputPath('target_ref'),
              subtype: staticValue('follow'),
              status: staticValue('active'),
            },
            output_key: 'relation_write',
            notes: 'Canonical relation.set workflow for follow writes.',
          }),
        ],
        availability: 'runtime_ready',
        notes:
          'Describes the generic-ready relation.follow.add fortress intent without enrolling live execution.',
      },
      {
        workflow_plan_id: 'relation.follow.clear.workflow.v0',
        packet_type: 'Relation',
        packet_subtype: 'follow',
        planner_id: input.writePlannerId,
        mutation_intents: ['relation.follow.clear'],
        operation_kinds: ['relation.clear'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup'],
        policy_action_ids: ['relation.follow.clear'],
        dependency_ids: [
          'runtime.packet_store.read',
          'runtime.policy_gate',
          'generic.operation.relation',
          'generic.resolver.actor_ref',
          'generic.resolver.packet_ref',
          'generic.resolver.static_value',
          'generic.resolver.relation_lookup',
        ],
        steps: [
          operationStep({
            step_id: 'clear_follow_relation',
            operation_kind: 'relation.clear',
            packet_type: 'Relation',
            packet_subtype: 'follow',
            resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup'],
            policy_action_ids: ['relation.follow.clear'],
            dependency_ids: [
              'runtime.packet_store.read',
              'runtime.policy_gate',
              'generic.operation.relation',
            ],
            input_bindings: {
              subject_ref: actorRef(),
              target_ref: inputPath('target_ref'),
              subtype: staticValue('follow'),
              status: staticValue('withdrawn'),
            },
            output_key: 'relation_write',
            notes: 'Canonical relation.clear workflow for follow clears.',
          }),
        ],
        availability: 'runtime_ready',
        notes:
          'Describes the generic-ready relation.follow.clear fortress intent without enrolling live execution.',
      },
      {
        workflow_plan_id: 'relation.association.add.workflow.v0',
        packet_type: 'Relation',
        packet_subtype: 'association',
        planner_id: input.writePlannerId,
        mutation_intents: ['relation.association.add'],
        operation_kinds: ['relation.set'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
        policy_action_ids: ['relation.association.add'],
        dependency_ids: [
          'runtime.packet_store.read',
          'runtime.policy_gate',
          'generic.operation.relation',
          'generic.resolver.actor_ref',
          'generic.resolver.packet_ref',
          'generic.resolver.input_value',
          'generic.resolver.static_value',
          'generic.resolver.relation_lookup',
          'generic.compatibility_projection',
          'runtime.planner.scoped_relation',
        ],
        steps: [
          operationStep({
            step_id: 'write_association_relation',
            operation_kind: 'relation.set',
            packet_type: 'Relation',
            packet_subtype: 'association',
            resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
            policy_action_ids: ['relation.association.add'],
            dependency_ids: [
              'runtime.packet_store.read',
              'runtime.policy_gate',
              'generic.operation.relation',
              'generic.compatibility_projection',
              'runtime.planner.scoped_relation',
            ],
            input_bindings: {
              subject_ref: actorRef(),
              target_ref: inputPath('target_packet_id'),
              scope_ref: inputPath('scope_id'),
              subtype: staticValue('association'),
              status: staticValue('active'),
              note: inputPath('note'),
            },
            output_key: 'relation_write',
            notes:
              'Canonical relation.set workflow for canonical association writes; fresh writes do not auto-mint relation assertion claims.',
          }),
        ],
        availability: 'runtime_ready',
        notes:
          'Describes the planner-extraction relation.association.add intent without enrolling live execution.',
      },
      {
        workflow_plan_id: 'relation.association.clear.workflow.v0',
        packet_type: 'Relation',
        packet_subtype: 'association',
        planner_id: input.writePlannerId,
        mutation_intents: ['relation.association.clear'],
        operation_kinds: ['relation.clear'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
        policy_action_ids: ['relation.association.clear'],
        dependency_ids: [
          'runtime.packet_store.read',
          'runtime.policy_gate',
          'generic.operation.relation',
          'generic.resolver.actor_ref',
          'generic.resolver.packet_ref',
          'generic.resolver.static_value',
          'generic.resolver.relation_lookup',
          'generic.compatibility_projection',
          'runtime.planner.scoped_relation',
        ],
        steps: [
          operationStep({
            step_id: 'clear_association_relation',
            operation_kind: 'relation.clear',
            packet_type: 'Relation',
            packet_subtype: 'association',
            resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
            policy_action_ids: ['relation.association.clear'],
            dependency_ids: [
              'runtime.packet_store.read',
              'runtime.policy_gate',
              'generic.operation.relation',
              'generic.compatibility_projection',
              'runtime.planner.scoped_relation',
            ],
            input_bindings: {
              subject_ref: actorRef(),
              target_ref: inputPath('target_packet_id'),
              scope_ref: inputPath('scope_id'),
              subtype: staticValue('association'),
              status: staticValue('withdrawn'),
            },
            output_key: 'relation_write',
            notes:
              'Canonical relation.clear workflow for canonical association clears.',
          }),
        ],
        availability: 'runtime_ready',
        notes:
          'Describes the planner-extraction relation.association.clear intent without enrolling live execution.',
      },
      {
        workflow_plan_id: 'relation.residence.add.workflow.v0',
        packet_type: 'Relation',
        packet_subtype: 'residence',
        planner_id: input.writePlannerId,
        mutation_intents: ['relation.residence.add'],
        operation_kinds: ['relation.set', 'relation.clear'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
        policy_action_ids: ['relation.residence.add', 'relation.residence.clear'],
        dependency_ids: [
          'runtime.packet_store.read',
          'runtime.policy_gate',
          'generic.operation.relation',
          'generic.resolver.actor_ref',
          'generic.resolver.packet_ref',
          'generic.resolver.static_value',
          'generic.resolver.relation_lookup',
          'generic.compatibility_projection',
          'runtime.planner.scoped_relation',
        ],
        steps: [
          {
            step_id: 'choose_residence_mode',
            step_kind: 'condition',
            condition: {
              condition_kind: 'present',
              left: inputPath('residence_scope_packet_id'),
            },
            then_steps: [
              operationStep({
                step_id: 'write_residence_relation',
                operation_kind: 'relation.set',
                packet_type: 'Relation',
                packet_subtype: 'residence',
                resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
                policy_action_ids: ['relation.residence.add'],
                dependency_ids: [
                  'runtime.packet_store.read',
                  'runtime.policy_gate',
                  'generic.operation.relation',
                  'generic.compatibility_projection',
                  'runtime.planner.scoped_relation',
                ],
                input_bindings: {
                  subject_ref: actorRef(),
                  target_ref: inputPath('residence_scope_packet_id'),
                  subtype: staticValue('residence'),
                  status: staticValue('active'),
                },
                output_key: 'relation_write',
                notes:
                  'Canonical relation.set workflow for residence selection; fresh writes do not auto-mint relation assertion claims.',
              }),
            ],
            else_steps: [
              operationStep({
                step_id: 'clear_residence_relation',
                operation_kind: 'relation.clear',
                packet_type: 'Relation',
                packet_subtype: 'residence',
                resolver_ids: ['actor.ref', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
                policy_action_ids: ['relation.residence.clear'],
                dependency_ids: [
                  'runtime.packet_store.read',
                  'runtime.policy_gate',
                  'generic.operation.relation',
                  'generic.compatibility_projection',
                  'runtime.planner.scoped_relation',
                ],
                input_bindings: {
                  subject_ref: actorRef(),
                  subtype: staticValue('residence'),
                  status: staticValue('withdrawn'),
                },
                output_key: 'relation_write',
                notes:
                  'Canonical relation.clear workflow for clearing residence when no residence scope is supplied.',
              }),
            ],
            on_failure: 'abort_workflow',
            notes:
              'Branches residence set/clear behavior from the presence of residence_scope_packet_id.',
          },
        ],
        availability: 'runtime_ready',
        notes:
          'Describes the planner-extraction relation.residence.add intent without enrolling live execution.',
      },
      {
        workflow_plan_id: 'relation.participation.add.workflow.v0',
        packet_type: 'Relation',
        packet_subtype: 'participation',
        planner_id: input.writePlannerId,
        mutation_intents: ['relation.participation.add'],
        operation_kinds: ['relation.set'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
        policy_action_ids: ['relation.participation.add'],
        dependency_ids: [
          'runtime.packet_store.read',
          'runtime.policy_gate',
          'generic.operation.relation',
          'generic.resolver.actor_ref',
          'generic.resolver.packet_ref',
          'generic.resolver.input_value',
          'generic.resolver.static_value',
          'generic.resolver.relation_lookup',
          'generic.compatibility_projection',
          'runtime.planner.scoped_relation',
        ],
        steps: [
          operationStep({
            step_id: 'write_participation_relation',
            operation_kind: 'relation.set',
            packet_type: 'Relation',
            packet_subtype: 'participation',
            resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
            policy_action_ids: ['relation.participation.add'],
            dependency_ids: [
              'runtime.packet_store.read',
              'runtime.policy_gate',
              'generic.operation.relation',
              'generic.compatibility_projection',
              'runtime.planner.scoped_relation',
            ],
            input_bindings: {
              subject_ref: actorRef(),
              target_ref: inputPath('role_packet_id'),
              scope_ref: inputPath('scope_id'),
              subtype: staticValue('participation'),
              status: staticValue('active'),
              note: inputPath('note'),
            },
            output_key: 'relation_write',
            notes:
              'Canonical relation.set workflow for role participation; fresh writes do not auto-mint relation assertion claims.',
          }),
        ],
        availability: 'runtime_ready',
        notes:
          'Describes the planner-extraction relation.participation.add intent without enrolling live execution.',
      },
      {
        workflow_plan_id: 'relation.participation.clear.workflow.v0',
        packet_type: 'Relation',
        packet_subtype: 'participation',
        planner_id: input.writePlannerId,
        mutation_intents: ['relation.participation.clear'],
        operation_kinds: ['relation.clear'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
        policy_action_ids: ['relation.participation.clear'],
        dependency_ids: [
          'runtime.packet_store.read',
          'runtime.policy_gate',
          'generic.operation.relation',
          'generic.resolver.actor_ref',
          'generic.resolver.packet_ref',
          'generic.resolver.static_value',
          'generic.resolver.relation_lookup',
          'generic.compatibility_projection',
          'runtime.planner.scoped_relation',
        ],
        steps: [
          operationStep({
            step_id: 'clear_participation_relation',
            operation_kind: 'relation.clear',
            packet_type: 'Relation',
            packet_subtype: 'participation',
            resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
            policy_action_ids: ['relation.participation.clear'],
            dependency_ids: [
              'runtime.packet_store.read',
              'runtime.policy_gate',
              'generic.operation.relation',
              'generic.compatibility_projection',
              'runtime.planner.scoped_relation',
            ],
            input_bindings: {
              subject_ref: actorRef(),
              target_ref: inputPath('role_packet_id'),
              scope_ref: inputPath('scope_id'),
              subtype: staticValue('participation'),
              status: staticValue('withdrawn'),
            },
            output_key: 'relation_write',
            notes:
              'Canonical relation.clear workflow for role participation.',
          }),
        ],
        availability: 'runtime_ready',
        notes:
          'Describes the planner-extraction relation.participation.clear intent without enrolling live execution.',
      },
    ];
  }

  if (input.type === 'Claim') {
    return [];
  }

  if (input.type === 'Attestation') {
    return [
      {
        workflow_plan_id: 'attestation.packet_signal.set.workflow.v0',
        packet_type: 'Attestation',
        packet_subtype: 'packet_signal',
        planner_id: input.writePlannerId,
        mutation_intents: ['attestation.packet_signal.set'],
        operation_kinds: ['attestation.set', 'attestation.clear'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value', 'attestation.target_summary'],
        policy_action_ids: [
          'attestation.packet_signal.set',
          'attestation.packet_signal.clear',
        ],
        dependency_ids: [
          'runtime.packet_store.read',
          'runtime.policy_gate',
          'generic.operation.attestation',
          'generic.resolver.actor_ref',
          'generic.resolver.packet_ref',
          'generic.resolver.input_value',
          'generic.resolver.target_summary',
        ],
        steps: [
          {
            step_id: 'choose_packet_signal_mode',
            step_kind: 'condition',
            condition: {
              condition_kind: 'present',
              left: inputPath('signal'),
            },
            then_steps: [
              operationStep({
                step_id: 'set_packet_signal_attestation',
                operation_kind: 'attestation.set',
                packet_type: 'Attestation',
                packet_subtype: 'packet_signal',
                resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value', 'attestation.target_summary'],
                policy_action_ids: ['attestation.packet_signal.set'],
                dependency_ids: [
                  'runtime.packet_store.read',
                  'runtime.policy_gate',
                  'generic.operation.attestation',
                ],
                input_bindings: {
                  actor_ref: actorRef(),
                  target_ref: inputPath('target_ref'),
                  signal: inputPath('signal'),
                  subtype: staticValue('packet_signal'),
                },
                output_key: 'attestation_write',
                notes: 'Canonical attestation.set workflow for packet signals.',
              }),
            ],
            else_steps: [
              operationStep({
                step_id: 'clear_packet_signal_attestation',
                operation_kind: 'attestation.clear',
                packet_type: 'Attestation',
                packet_subtype: 'packet_signal',
                resolver_ids: ['actor.ref', 'input.packet_ref', 'attestation.target_summary'],
                policy_action_ids: ['attestation.packet_signal.clear'],
                dependency_ids: [
                  'runtime.packet_store.read',
                  'runtime.policy_gate',
                  'generic.operation.attestation',
                ],
                input_bindings: {
                  actor_ref: actorRef(),
                  target_ref: inputPath('target_ref'),
                  subtype: staticValue('packet_signal'),
                },
                output_key: 'attestation_write',
                notes: 'Canonical attestation.clear workflow for packet signals.',
              }),
            ],
            on_failure: 'abort_workflow',
            notes:
              'Branches packet signal set/clear behavior from the presence of a signal value.',
          },
        ],
        availability: 'runtime_ready',
        notes:
          'Describes the generic-ready attestation.packet_signal.set fortress intent without enrolling live execution.',
      },
      {
        workflow_plan_id: 'attestation.relation_participation.set.workflow.v0',
        packet_type: 'Attestation',
        packet_subtype: 'support',
        planner_id: input.writePlannerId,
        mutation_intents: ['relation.participation.attestation.set'],
        operation_kinds: ['attestation.set', 'attestation.clear'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value'],
        policy_action_ids: [
          'relation.participation.attestation.support',
          'relation.participation.attestation.dispute',
          'relation.participation.attestation.clear',
        ],
        dependency_ids: [
          'runtime.packet_store.read',
          'runtime.policy_gate',
          'generic.operation.attestation',
          'generic.resolver.actor_ref',
          'generic.resolver.packet_ref',
          'generic.resolver.input_value',
        ],
        steps: [
          operationStep({
            step_id: 'set_relation_participation_attestation',
            operation_kind: 'attestation.set',
            packet_type: 'Attestation',
            packet_subtype: 'support',
            resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value'],
            policy_action_ids: [
              'relation.participation.attestation.support',
              'relation.participation.attestation.dispute',
              'relation.participation.attestation.clear',
            ],
            dependency_ids: [
              'runtime.packet_store.read',
              'runtime.policy_gate',
              'generic.operation.attestation',
            ],
            input_bindings: {
              actor_ref: actorRef(),
              target_ref: inputPath('relation_packet_id'),
              subtype: inputPath('mode'),
            },
            output_key: 'attestation_write',
            notes:
              'Canonical support/dispute/clear attestation workflow for participation relations.',
          }),
        ],
        availability: 'runtime_ready',
        notes:
          'Describes the generic-ready relation.participation.attestation.set fortress intent without enrolling live execution.',
      },
    ];
  }

  if (input.type === 'Discussion') {
    return [
      {
        workflow_plan_id: 'discussion.reply.create.workflow.v0',
        packet_type: 'Discussion',
        packet_subtype: 'message',
        planner_id: input.writePlannerId,
        mutation_intents: ['discussion.reply.create'],
        operation_kinds: ['single_packet.create'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value', 'discussion.parent_thread'],
        policy_action_ids: ['discussion.reply.create'],
        dependency_ids: [
          'runtime.packet_store.read',
          'runtime.policy_gate',
          'runtime.discussion_service.read',
          'generic.operation.discussion',
          'generic.resolver.actor_ref',
          'generic.resolver.packet_ref',
          'generic.resolver.input_value',
          'generic.resolver.discussion_thread',
          'runtime.planner.discussion_reply',
        ],
        steps: [
          operationStep({
            step_id: 'create_discussion_reply_message',
            operation_kind: 'single_packet.create',
            packet_type: 'Discussion',
            packet_subtype: 'message',
            resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value', 'discussion.parent_thread'],
            policy_action_ids: ['discussion.reply.create'],
            dependency_ids: [
              'runtime.packet_store.read',
              'runtime.policy_gate',
              'runtime.discussion_service.read',
              'generic.operation.discussion',
              'runtime.planner.discussion_reply',
            ],
            input_bindings: {
              actor_ref: actorRef(),
              scope_ref: inputPath('scope_id'),
              parent_post_ref: inputPath('parent_post_packet_id'),
              markdown: inputPath('reply_markdown'),
              subtype: staticValue('message'),
            },
            output_key: 'discussion_reply_write',
            notes:
              'Canonical single_packet.create workflow for discussion replies after parent/thread/forum resolution.',
          }),
        ],
        availability: 'runtime_ready',
        notes:
          'Describes the planner-extraction discussion.reply.create intent without enrolling live execution.',
      },
    ];
  }

  return [];
}

export function createGenericTypePacketDefinition<
  TType extends GenericBuilderType,
>(
  config: GenericTypeDefinitionConfig<TType>
): PacketTypeDefinition<(typeof PACKET_BODY_SCHEMAS)[TType]> {
  const type = config.type;
  const schemaVersion = PACKET_COMPATIBILITY_REGISTRY[type].current_schema_version;
  const baseId = lowerFirst(type);
  const label = toKebab(type);
  const createActionId = `${baseId}.generic.create`;
  const reviseActionId = `${baseId}.generic.revise`;
  const projectActionId = `${baseId}.generic.project`;
  const indexActionId = `${baseId}.generic.index`;
  const builderId = `${baseId}.generic.body.v0`;
  const writePlannerId = `${baseId}.generic.write.v0`;
  const projectionPlannerId = `${baseId}.generic.projection.v0`;
  const workflowPlans = createGenericReadyWorkflowPlans({
    type,
    writePlannerId,
  });
  const workflowPlanIds = workflowPlans.map((plan) => plan.workflow_plan_id);
  const projectionKey = `${baseId}.generic_projection`;
  const indexKey = `${baseId}.generic_index`;
  const compatibilityAdapters = createRegistryCompatibilityAdapterDescriptors({
    packetType: type,
    type,
    baseId,
    currentSchemaVersion: schemaVersion,
    entry: PACKET_COMPATIBILITY_REGISTRY[type] as PacketCompatibilityEntry<TType>,
  });

  return {
    packet_type: type,
    canonical_body_type: config.canonical_body_type,
    definition_status: 'canonical',
    current_schema_version: schemaVersion,
    storage_class: config.storage_class ?? 'public_record',
    revision_behavior: toRevisionBehavior(type),
    body_schema: PACKET_BODY_SCHEMAS[type] as (typeof PACKET_BODY_SCHEMAS)[TType],
    declared_subtypes: config.declared_subtypes,
    default_subtype: config.default_subtype,
    compatibility: derivePacketCompatibilityPosture({
      currentSchemaVersion: schemaVersion,
      adapters: compatibilityAdapters,
      notes:
        'Compatibility posture is summarized from the existing canonical compatibility registry; manifest descriptors do not implement new adapters.',
    }),
    id_strategy: {
      strategy_id: `${baseId}.generic.import_preserved`,
      packet_id_mode: 'import_preserved',
      revision_id_mode: 'import_preserved',
      uniqueness_fields: ['header.packet_id'],
      notes:
        'Generic Canonical definitions preserve packet and revision identities; type-specific deterministic IDs remain owned by builders/planners.',
    },
    actions: [
      {
        action_id: createActionId,
        action_kind: 'create',
        packet_subtype: null,
        label: `Create ${label} packet`,
        policy_action_id: `${baseId}.generic.write`,
        availability: 'runtime_ready',
        notes: `Canonical action for creating ${type} packets through the generic builder pipeline.`,
      },
      {
        action_id: reviseActionId,
        action_kind: 'revise',
        packet_subtype: null,
        label: `Revise ${label} packet`,
        policy_action_id: `${baseId}.generic.write`,
        availability: 'runtime_ready',
        notes: `Canonical action for revising ${type} packets through the generic builder pipeline.`,
      },
      {
        action_id: projectActionId,
        action_kind: 'project',
        packet_subtype: null,
        label: `Project ${label} packet`,
        policy_action_id: null,
        availability: 'runtime_ready',
        notes: `Canonical action for projecting ${type} packets into read models.`,
      },
      {
        action_id: indexActionId,
        action_kind: 'index',
        packet_subtype: null,
        label: `Index ${label} packet`,
        policy_action_id: null,
        availability: 'runtime_ready',
        notes: `Canonical action for indexing ${type} packets.`,
      },
    ],
    builders: [
      {
        builder_id: builderId,
        packet_subtype: null,
        builder_kind: 'single_packet_body',
        action_ids: [createActionId, reviseActionId],
        input_schema_key: `${type}PacketInput`,
        output_schema_key: `${type}BodySchema`,
        availability: 'runtime_ready',
        notes:
          'Descriptor for the existing generic packet builder pipeline; the manifest does not execute it yet.',
      },
    ],
    planners: [
      {
        planner_id: writePlannerId,
        planner_kind: 'single_packet_revision',
        action_ids: [createActionId, reviseActionId],
        builder_ids: [builderId],
        policy_action_ids: [`${baseId}.generic.write`],
        workflow_plan_ids: workflowPlanIds.length > 0 ? workflowPlanIds : undefined,
        availability: 'runtime_ready',
        notes: `Canonical write planner descriptor for generic ${type} packet revisions.`,
      },
      {
        planner_id: projectionPlannerId,
        planner_kind: 'projection_only',
        action_ids: [projectActionId, indexActionId],
        builder_ids: [],
        policy_action_ids: [],
        availability: 'runtime_ready',
        notes: `Canonical projection planner descriptor for generic ${type} read models.`,
      },
    ],
    mutations: [
      {
        mutation_intent: `${baseId}.generic.write`,
        action_ids: [createActionId, reviseActionId],
        planner_id: writePlannerId,
        workflow_plan_ids: workflowPlanIds.length > 0 ? workflowPlanIds : undefined,
        result_type: 'packet_write',
        availability: 'runtime_ready',
        notes:
          'Manifest-driven generic write intent; execution is limited to trusted local runtime routes that explicitly enroll the intent.',
      },
    ],
    workflow_plans: workflowPlans,
    compatibility_adapters: compatibilityAdapters,
    projections: config.projections ?? [
      {
        projection_key: projectionKey,
        target_surface: 'generic_packet_runtime',
        mode: 'derived',
        notes: `Generic projection descriptor for ${type} packet read surfaces.`,
      },
    ],
    indexes: [
      {
        index_key: indexKey,
        fields: config.index_fields ?? ['header.packet_id', 'header.created_at'],
        notes: `Generic index descriptor for ${type} packet lookup and filtering.`,
      },
    ],
    packet_definition_parts: createDefinitionParts({
      type,
      defaultSubtype: config.default_subtype,
      schemaVersion,
      actionIds: [createActionId, reviseActionId, projectActionId, indexActionId],
      builderId,
      plannerIds: [writePlannerId, projectionPlannerId],
      projectionKey,
      indexKey,
      compatibilityAdapterIds: compatibilityAdapters.map((adapter) => adapter.adapter_id),
      declaredSubtypes: config.declared_subtypes,
    }),
    fixtures: [],
    notes: [
      ...(config.notes ?? []),
      'Canonical runtime ready; this pass does not change packet schemas, runtime routes, or connector enrollment.',
      'Generic type definitions describe active builder and compatibility support; executable behavior remains owned by trusted local runtime code.',
    ],
  };
}

export const genericTypePacketDefinitions = Object.fromEntries(
  GENERIC_TYPE_CONFIGS.map((config) => [
    config.type,
    createGenericTypePacketDefinition(config),
  ])
) as {
  [TType in GenericBuilderType]: PacketTypeDefinition<
    (typeof PACKET_BODY_SCHEMAS)[TType]
  >;
};

export const elementPacketDefinition = genericTypePacketDefinitions.Element;
export const locationPacketDefinition = genericTypePacketDefinitions.Location;
export const rolePacketDefinition = genericTypePacketDefinitions.Role;
export const claimPacketDefinition = genericTypePacketDefinitions.Claim;
export const relationPacketDefinition = genericTypePacketDefinitions.Relation;
export const reportPacketDefinition = genericTypePacketDefinitions.Report;
export const proposalPacketDefinition = genericTypePacketDefinitions.Proposal;
export const votePacketDefinition = genericTypePacketDefinitions.Vote;
export const attestationPacketDefinition = genericTypePacketDefinitions.Attestation;
export const decisionPacketDefinition = genericTypePacketDefinitions.Decision;
export const actionPacketDefinition = genericTypePacketDefinitions.Action;
export const discussionPacketDefinition = genericTypePacketDefinitions.Discussion;
export const policyPacketDefinition = genericTypePacketDefinitions.Policy;
