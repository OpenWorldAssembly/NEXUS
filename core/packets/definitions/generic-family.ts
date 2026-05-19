/**
 * File: generic-family.ts
 * Description: Factory-backed shadow definitions for generic builder-supported packet families.
 */

import {
  ATTESTATION_SUBTYPES,
  CLAIM_SUBTYPES,
  DISCUSSION_KINDS,
  ELEMENT_KINDS,
  LOCATION_SUBTYPES,
  PACKET_BODY_SCHEMAS,
  PACKET_COMPATIBILITY_REGISTRY,
  RELATION_SUBTYPES,
  type PacketFamily,
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

type GenericBuilderFamily =
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
  | 'Cause'
  | 'Action'
  | 'Discussion'
  | 'Policy';

type GenericFamilyDefinitionConfig<TFamily extends GenericBuilderFamily> = {
  family: TFamily;
  canonical_body_type: string;
  declared_subtypes: readonly string[];
  default_subtype: string;
  storage_class?: PacketTypeDefinition['storage_class'];
  projections?: readonly PacketProjectionDescriptor[];
  index_fields?: readonly string[];
  notes?: readonly string[];
};

const GENERIC_FAMILY_CONFIGS = [
  {
    family: 'Element',
    canonical_body_type: 'element',
    declared_subtypes: ELEMENT_KINDS,
    default_subtype: 'assembly',
    index_fields: ['body.kind', 'body.subtype', 'body.name'],
  },
  {
    family: 'Location',
    canonical_body_type: 'location',
    declared_subtypes: LOCATION_SUBTYPES,
    default_subtype: 'point',
    index_fields: ['body.subtype', 'body.title', 'body.status'],
  },
  {
    family: 'Role',
    canonical_body_type: 'role',
    declared_subtypes: ['role'],
    default_subtype: 'role',
    index_fields: ['body.role_kind', 'body.title', 'body.status'],
  },
  {
    family: 'Claim',
    canonical_body_type: 'claim',
    declared_subtypes: CLAIM_SUBTYPES,
    default_subtype: 'relation_assertion',
    index_fields: ['body.subtype', 'body.target_ref.packet_id', 'body.status'],
  },
  {
    family: 'Relation',
    canonical_body_type: 'relation',
    declared_subtypes: RELATION_SUBTYPES,
    default_subtype: 'assembly_association',
    index_fields: [
      'body.subtype',
      'body.subject_ref.packet_id',
      'body.target_ref.packet_id',
    ],
  },
  {
    family: 'Report',
    canonical_body_type: 'report',
    declared_subtypes: ['verification_report', 'import_report'],
    default_subtype: 'verification_report',
    index_fields: ['body.subtype', 'body.target_ref.packet_id', 'body.status'],
  },
  {
    family: 'Proposal',
    canonical_body_type: 'proposal',
    declared_subtypes: ['proposal'],
    default_subtype: 'proposal',
    index_fields: ['body.proposal_kind', 'body.title', 'body.status'],
  },
  {
    family: 'Vote',
    canonical_body_type: 'vote',
    declared_subtypes: ['vote'],
    default_subtype: 'vote',
    index_fields: ['body.proposal_ref.packet_id', 'body.vote_method', 'body.status'],
  },
  {
    family: 'Attestation',
    canonical_body_type: 'attestation',
    declared_subtypes: ATTESTATION_SUBTYPES,
    default_subtype: 'packet_signal',
    index_fields: ['body.subtype', 'body.target_ref.packet_id', 'body.status'],
  },
  {
    family: 'Decision',
    canonical_body_type: 'decision',
    declared_subtypes: ['decision'],
    default_subtype: 'decision',
    index_fields: ['body.outcome', 'body.title'],
  },
  {
    family: 'Cause',
    canonical_body_type: 'cause',
    declared_subtypes: ['cause'],
    default_subtype: 'cause',
    index_fields: ['body.subtype', 'body.title', 'body.status'],
  },
  {
    family: 'Action',
    canonical_body_type: 'action',
    declared_subtypes: ['action'],
    default_subtype: 'action',
    index_fields: ['body.subtype', 'body.title', 'body.status'],
  },
  {
    family: 'Discussion',
    canonical_body_type: 'discussion',
    declared_subtypes: DISCUSSION_KINDS,
    default_subtype: 'space',
    index_fields: ['body.kind', 'body.role', 'body.title'],
  },
  {
    family: 'Policy',
    canonical_body_type: 'policy',
    declared_subtypes: ['policy'],
    default_subtype: 'policy',
    index_fields: ['body.policy_kind', 'body.title', 'body.status'],
  },
] as const satisfies readonly GenericFamilyDefinitionConfig<GenericBuilderFamily>[];

function lowerFirst(value: string): string {
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function toKebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function toRevisionBehavior(family: PacketFamily): PacketRevisionBehavior {
  const revisionMode = PACKET_COMPATIBILITY_REGISTRY[family].revision_mode;

  if (revisionMode === 'append_only') {
    return 'append_only';
  }

  if (revisionMode === 'mergeable') {
    return 'mergeable';
  }

  return 'replaceable';
}

function createDefinitionParts(input: {
  family: GenericBuilderFamily;
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
  const baseId = lowerFirst(input.family);

  return [
    {
      part_id: `${baseId}.packet_definition.v0`,
      part_subtype: 'packet_definition',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      references: [
        `${baseId}.packet_schema.v0`,
        `${baseId}.packet_action_registry.v0`,
        `${baseId}.packet_builder_descriptor.v0`,
        `${baseId}.packet_planner_descriptor.v0`,
        `${baseId}.packet_projection_descriptor.v0`,
        `${baseId}.packet_compatibility.v0`,
        `${baseId}.packet_dependency.v0`,
      ],
      notes: `Root shadow definition record for ${input.family}.`,
    },
    {
      part_id: `${baseId}.packet_schema.v0`,
      part_subtype: 'packet_schema',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      covers_subtypes: input.declaredSubtypes,
      notes: `Schema part backed by the canonical ${input.family} body schema.`,
    },
    {
      part_id: `${baseId}.packet_action_registry.v0`,
      part_subtype: 'packet_action_registry',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      references: input.actionIds,
      notes: `Action registry part for generic ${input.family} packet operations.`,
    },
    {
      part_id: `${baseId}.packet_builder_descriptor.v0`,
      part_subtype: 'packet_builder_descriptor',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      references: [input.builderId],
      notes: `Builder descriptor part for the generic ${input.family} body builder.`,
    },
    {
      part_id: `${baseId}.packet_planner_descriptor.v0`,
      part_subtype: 'packet_planner_descriptor',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      references: input.plannerIds,
      notes: `Planner descriptor part for generic ${input.family} writes and projections.`,
    },
    {
      part_id: `${baseId}.packet_projection_descriptor.v0`,
      part_subtype: 'packet_projection_descriptor',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      references: [input.projectionKey],
      notes: `Projection descriptor part for generic ${input.family} read models.`,
    },
    {
      part_id: `${baseId}.packet_compatibility.v0`,
      part_subtype: 'packet_compatibility',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      references: input.compatibilityAdapterIds,
      notes: `Compatibility part summarizing the canonical ${input.family} compatibility registry entry.`,
    },
    {
      part_id: `${baseId}.packet_dependency.v0`,
      part_subtype: 'packet_dependency',
      defines_packet_type: input.family,
      defines_packet_subtype: input.defaultSubtype,
      schema_version: input.schemaVersion,
      availability: 'shadow_only',
      required: true,
      references: [
        'generic.packet.builder_pipeline',
        'generic.packet.definition_action_bridge',
      ],
      notes:
        'Dependency definition part for the generic builder pipeline and shadow action-plan resolver.',
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
  packet_type: GenericBuilderFamily;
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
  family: GenericBuilderFamily;
  writePlannerId: string;
}): PacketWorkflowPlanDescriptor[] {
  if (input.family === 'Relation') {
    return [
      {
        workflow_plan_id: 'relation.follows.set.workflow.v0',
        packet_type: 'Relation',
        packet_subtype: 'follows',
        planner_id: input.writePlannerId,
        mutation_intents: ['follows.relation.set'],
        operation_kinds: ['relation.set'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup'],
        policy_action_ids: ['follows.relation.set'],
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
            step_id: 'write_follows_relation',
            operation_kind: 'relation.set',
            packet_type: 'Relation',
            packet_subtype: 'follows',
            resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup'],
            policy_action_ids: ['follows.relation.set'],
            dependency_ids: [
              'runtime.packet_store.read',
              'runtime.policy_gate',
              'generic.operation.relation',
            ],
            input_bindings: {
              subject_ref: actorRef(),
              target_ref: inputPath('target_ref'),
              subtype: staticValue('follows'),
              status: staticValue('active'),
            },
            output_key: 'relation_write',
            notes: 'Shadow relation.set workflow for follow writes.',
          }),
        ],
        availability: 'shadow_only',
        notes:
          'Describes the generic-ready follows.relation.set fortress intent without enrolling live execution.',
      },
      {
        workflow_plan_id: 'relation.follows.clear.workflow.v0',
        packet_type: 'Relation',
        packet_subtype: 'follows',
        planner_id: input.writePlannerId,
        mutation_intents: ['follows.relation.clear'],
        operation_kinds: ['relation.clear'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup'],
        policy_action_ids: ['follows.relation.clear'],
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
            step_id: 'clear_follows_relation',
            operation_kind: 'relation.clear',
            packet_type: 'Relation',
            packet_subtype: 'follows',
            resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup'],
            policy_action_ids: ['follows.relation.clear'],
            dependency_ids: [
              'runtime.packet_store.read',
              'runtime.policy_gate',
              'generic.operation.relation',
            ],
            input_bindings: {
              subject_ref: actorRef(),
              target_ref: inputPath('target_ref'),
              subtype: staticValue('follows'),
              status: staticValue('withdrawn'),
            },
            output_key: 'relation_write',
            notes: 'Shadow relation.clear workflow for follow clears.',
          }),
        ],
        availability: 'shadow_only',
        notes:
          'Describes the generic-ready follows.relation.clear fortress intent without enrolling live execution.',
      },
      {
        workflow_plan_id: 'relation.assembly_association.set.workflow.v0',
        packet_type: 'Relation',
        packet_subtype: 'assembly_association',
        planner_id: input.writePlannerId,
        mutation_intents: ['assembly_association.relation.set'],
        operation_kinds: ['relation.set'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
        policy_action_ids: ['assembly_association.relation.set'],
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
            step_id: 'write_assembly_association_relation',
            operation_kind: 'relation.set',
            packet_type: 'Relation',
            packet_subtype: 'assembly_association',
            resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
            policy_action_ids: ['assembly_association.relation.set'],
            dependency_ids: [
              'runtime.packet_store.read',
              'runtime.policy_gate',
              'generic.operation.relation',
              'generic.compatibility_projection',
              'runtime.planner.scoped_relation',
            ],
            input_bindings: {
              subject_ref: actorRef(),
              target_ref: inputPath('assembly_packet_id'),
              scope_ref: inputPath('scope_id'),
              subtype: staticValue('assembly_association'),
              status: staticValue('active'),
              note: inputPath('note'),
            },
            output_key: 'relation_write',
            notes:
              'Shadow relation.set workflow for canonical assembly association writes, including compatibility projection dependency.',
          }),
        ],
        availability: 'shadow_only',
        notes:
          'Describes the planner-extraction assembly_association.relation.set intent without enrolling live execution.',
      },
      {
        workflow_plan_id: 'relation.assembly_association.clear.workflow.v0',
        packet_type: 'Relation',
        packet_subtype: 'assembly_association',
        planner_id: input.writePlannerId,
        mutation_intents: ['assembly_association.relation.clear'],
        operation_kinds: ['relation.clear'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
        policy_action_ids: ['assembly_association.relation.clear'],
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
            step_id: 'clear_assembly_association_relation',
            operation_kind: 'relation.clear',
            packet_type: 'Relation',
            packet_subtype: 'assembly_association',
            resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
            policy_action_ids: ['assembly_association.relation.clear'],
            dependency_ids: [
              'runtime.packet_store.read',
              'runtime.policy_gate',
              'generic.operation.relation',
              'generic.compatibility_projection',
              'runtime.planner.scoped_relation',
            ],
            input_bindings: {
              subject_ref: actorRef(),
              target_ref: inputPath('assembly_packet_id'),
              scope_ref: inputPath('scope_id'),
              subtype: staticValue('assembly_association'),
              status: staticValue('withdrawn'),
            },
            output_key: 'relation_write',
            notes:
              'Shadow relation.clear workflow for canonical assembly association clears, including compatibility projection dependency.',
          }),
        ],
        availability: 'shadow_only',
        notes:
          'Describes the planner-extraction assembly_association.relation.clear intent without enrolling live execution.',
      },
      {
        workflow_plan_id: 'relation.home_locality.set.workflow.v0',
        packet_type: 'Relation',
        packet_subtype: 'home_locality',
        planner_id: input.writePlannerId,
        mutation_intents: ['home_locality.relation.set'],
        operation_kinds: ['relation.set', 'relation.clear'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
        policy_action_ids: ['home_locality.relation.set', 'home_locality.relation.clear'],
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
            step_id: 'choose_home_locality_mode',
            step_kind: 'condition',
            condition: {
              condition_kind: 'present',
              left: inputPath('home_scope_packet_id'),
            },
            then_steps: [
              operationStep({
                step_id: 'write_home_locality_relation',
                operation_kind: 'relation.set',
                packet_type: 'Relation',
                packet_subtype: 'home_locality',
                resolver_ids: ['actor.ref', 'input.packet_ref', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
                policy_action_ids: ['home_locality.relation.set'],
                dependency_ids: [
                  'runtime.packet_store.read',
                  'runtime.policy_gate',
                  'generic.operation.relation',
                  'generic.compatibility_projection',
                  'runtime.planner.scoped_relation',
                ],
                input_bindings: {
                  subject_ref: actorRef(),
                  target_ref: inputPath('home_scope_packet_id'),
                  subtype: staticValue('home_locality'),
                  status: staticValue('active'),
                },
                output_key: 'relation_write',
                notes:
                  'Shadow relation.set workflow for home locality selection.',
              }),
            ],
            else_steps: [
              operationStep({
                step_id: 'clear_home_locality_relation',
                operation_kind: 'relation.clear',
                packet_type: 'Relation',
                packet_subtype: 'home_locality',
                resolver_ids: ['actor.ref', 'static.value', 'relation.active_lookup', 'compatibility.projection'],
                policy_action_ids: ['home_locality.relation.clear'],
                dependency_ids: [
                  'runtime.packet_store.read',
                  'runtime.policy_gate',
                  'generic.operation.relation',
                  'generic.compatibility_projection',
                  'runtime.planner.scoped_relation',
                ],
                input_bindings: {
                  subject_ref: actorRef(),
                  subtype: staticValue('home_locality'),
                  status: staticValue('withdrawn'),
                },
                output_key: 'relation_write',
                notes:
                  'Shadow relation.clear workflow for clearing home locality when no home scope is supplied.',
              }),
            ],
            on_failure: 'abort_workflow',
            notes:
              'Branches home locality set/clear behavior from the presence of home_scope_packet_id.',
          },
        ],
        availability: 'shadow_only',
        notes:
          'Describes the planner-extraction home_locality.relation.set intent without enrolling live execution.',
      },
    ];
  }

  if (input.family === 'Claim') {
    return [
      {
        workflow_plan_id: 'claim.role_association.set.workflow.v0',
        packet_type: 'Claim',
        packet_subtype: 'relation_assertion',
        planner_id: input.writePlannerId,
        mutation_intents: ['role_association.claim.set'],
        operation_kinds: ['claim.assert', 'claim.withdraw'],
        resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value', 'static.value', 'role.scope'],
        policy_action_ids: [
          'role_association.claim.set',
          'role_association.claim.withdraw',
        ],
        dependency_ids: [
          'runtime.policy_gate',
          'generic.operation.claim',
          'generic.resolver.actor_ref',
          'generic.resolver.packet_ref',
          'generic.resolver.input_value',
          'generic.resolver.static_value',
          'generic.resolver.role_scope',
        ],
        steps: [
          {
            step_id: 'choose_role_claim_mode',
            step_kind: 'condition',
            condition: {
              condition_kind: 'equals',
              left: inputPath('enabled'),
              right: staticValue(true),
            },
            then_steps: [
              operationStep({
                step_id: 'assert_role_association_claim',
                operation_kind: 'claim.assert',
                packet_type: 'Claim',
                packet_subtype: 'relation_assertion',
                resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value', 'static.value', 'role.scope'],
                policy_action_ids: ['role_association.claim.set'],
                dependency_ids: ['runtime.policy_gate', 'generic.operation.claim', 'generic.resolver.role_scope'],
                input_bindings: {
                  actor_ref: actorRef(),
                  role_ref: inputPath('role_ref'),
                  subject_ref: inputPath('subject_ref'),
                  claim_kind: staticValue('role_association'),
                  status: staticValue('active'),
                },
                output_key: 'claim_write',
                notes: 'Shadow claim.assert workflow for role association claims.',
              }),
            ],
            else_steps: [
              operationStep({
                step_id: 'withdraw_role_association_claim',
                operation_kind: 'claim.withdraw',
                packet_type: 'Claim',
                packet_subtype: 'relation_assertion',
                resolver_ids: ['actor.ref', 'input.packet_ref', 'input.value', 'static.value', 'role.scope'],
                policy_action_ids: ['role_association.claim.withdraw'],
                dependency_ids: ['runtime.policy_gate', 'generic.operation.claim', 'generic.resolver.role_scope'],
                input_bindings: {
                  actor_ref: actorRef(),
                  role_ref: inputPath('role_ref'),
                  subject_ref: inputPath('subject_ref'),
                  claim_kind: staticValue('role_association'),
                  status: staticValue('withdrawn'),
                },
                output_key: 'claim_write',
                notes: 'Shadow claim.withdraw workflow for role association claims.',
              }),
            ],
            on_failure: 'abort_workflow',
            notes:
              'Branches role association claim set/withdraw behavior from the typed enabled input.',
          },
        ],
        availability: 'shadow_only',
        notes:
          'Describes the generic-ready role_association.claim.set fortress intent without enrolling live execution.',
      },
    ];
  }

  if (input.family === 'Attestation') {
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
                  attestation_kind: staticValue('packet_signal'),
                },
                output_key: 'attestation_write',
                notes: 'Shadow attestation.set workflow for packet signals.',
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
                  attestation_kind: staticValue('packet_signal'),
                },
                output_key: 'attestation_write',
                notes: 'Shadow attestation.clear workflow for packet signals.',
              }),
            ],
            on_failure: 'abort_workflow',
            notes:
              'Branches packet signal set/clear behavior from the presence of a signal value.',
          },
        ],
        availability: 'shadow_only',
        notes:
          'Describes the generic-ready attestation.packet_signal.set fortress intent without enrolling live execution.',
      },
    ];
  }

  if (input.family === 'Discussion') {
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
              kind: staticValue('message'),
            },
            output_key: 'discussion_reply_write',
            notes:
              'Shadow single_packet.create workflow for discussion replies after parent/thread/forum resolution.',
          }),
        ],
        availability: 'shadow_only',
        notes:
          'Describes the planner-extraction discussion.reply.create intent without enrolling live execution.',
      },
    ];
  }

  return [];
}

export function createGenericFamilyPacketDefinition<
  TFamily extends GenericBuilderFamily,
>(
  config: GenericFamilyDefinitionConfig<TFamily>
): PacketTypeDefinition<(typeof PACKET_BODY_SCHEMAS)[TFamily]> {
  const family = config.family;
  const schemaVersion = PACKET_COMPATIBILITY_REGISTRY[family].current_schema_version;
  const baseId = lowerFirst(family);
  const label = toKebab(family);
  const createActionId = `${baseId}.generic.create`;
  const reviseActionId = `${baseId}.generic.revise`;
  const projectActionId = `${baseId}.generic.project`;
  const indexActionId = `${baseId}.generic.index`;
  const builderId = `${baseId}.generic.body.v0`;
  const writePlannerId = `${baseId}.generic.write.v0`;
  const projectionPlannerId = `${baseId}.generic.projection.v0`;
  const workflowPlans = createGenericReadyWorkflowPlans({
    family,
    writePlannerId,
  });
  const workflowPlanIds = workflowPlans.map((plan) => plan.workflow_plan_id);
  const projectionKey = `${baseId}.generic_projection`;
  const indexKey = `${baseId}.generic_index`;
  const compatibilityAdapters = createRegistryCompatibilityAdapterDescriptors({
    packetType: family,
    family,
    baseId,
    currentSchemaVersion: schemaVersion,
    entry: PACKET_COMPATIBILITY_REGISTRY[family],
  });

  return {
    packet_type: family,
    canonical_body_type: config.canonical_body_type,
    definition_status: 'experimental_shadow',
    current_schema_version: schemaVersion,
    storage_class: config.storage_class ?? 'public_record',
    revision_behavior: toRevisionBehavior(family),
    body_schema: PACKET_BODY_SCHEMAS[family] as (typeof PACKET_BODY_SCHEMAS)[TFamily],
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
        'Generic shadow definitions preserve packet and revision identities; family-specific deterministic IDs remain owned by builders/planners.',
    },
    actions: [
      {
        action_id: createActionId,
        action_kind: 'create',
        packet_subtype: null,
        label: `Create ${label} packet`,
        policy_action_id: `${baseId}.generic.write`,
        availability: 'shadow_only',
        notes: `Shadow action for creating ${family} packets through the generic builder pipeline.`,
      },
      {
        action_id: reviseActionId,
        action_kind: 'revise',
        packet_subtype: null,
        label: `Revise ${label} packet`,
        policy_action_id: `${baseId}.generic.write`,
        availability: 'shadow_only',
        notes: `Shadow action for revising ${family} packets through the generic builder pipeline.`,
      },
      {
        action_id: projectActionId,
        action_kind: 'project',
        packet_subtype: null,
        label: `Project ${label} packet`,
        policy_action_id: null,
        availability: 'shadow_only',
        notes: `Shadow action for projecting ${family} packets into read models.`,
      },
      {
        action_id: indexActionId,
        action_kind: 'index',
        packet_subtype: null,
        label: `Index ${label} packet`,
        policy_action_id: null,
        availability: 'shadow_only',
        notes: `Shadow action for indexing ${family} packets.`,
      },
    ],
    builders: [
      {
        builder_id: builderId,
        packet_subtype: null,
        builder_kind: 'single_packet_body',
        action_ids: [createActionId, reviseActionId],
        input_schema_key: `${family}PacketInput`,
        output_schema_key: `${family}BodySchema`,
        availability: 'shadow_only',
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
        availability: 'shadow_only',
        notes: `Shadow write planner descriptor for generic ${family} packet revisions.`,
      },
      {
        planner_id: projectionPlannerId,
        planner_kind: 'projection_only',
        action_ids: [projectActionId, indexActionId],
        builder_ids: [],
        policy_action_ids: [],
        availability: 'shadow_only',
        notes: `Shadow projection planner descriptor for generic ${family} read models.`,
      },
    ],
    mutations: [
      {
        mutation_intent: `${baseId}.generic.write`,
        action_ids: [createActionId, reviseActionId],
        planner_id: writePlannerId,
        workflow_plan_ids: workflowPlanIds.length > 0 ? workflowPlanIds : undefined,
        result_family: 'packet_write',
        availability: 'shadow_only',
        notes:
          'Future manifest-driven generic write intent; live runtime routes are not enrolled in this pass.',
      },
    ],
    workflow_plans: workflowPlans,
    compatibility_adapters: compatibilityAdapters,
    projections: config.projections ?? [
      {
        projection_key: projectionKey,
        target_surface: 'generic_packet_runtime',
        mode: 'derived',
        notes: `Generic projection descriptor for ${family} packet read surfaces.`,
      },
    ],
    indexes: [
      {
        index_key: indexKey,
        fields: config.index_fields ?? ['header.packet_id', 'header.created_at'],
        notes: `Generic index descriptor for ${family} packet lookup and filtering.`,
      },
    ],
    packet_definition_parts: createDefinitionParts({
      family,
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
      'Shadow definition only; this pass does not change packet schemas, runtime routes, or connector enrollment.',
      'Generic family definitions describe existing builder and compatibility support without becoming canonical execution policy.',
    ],
  };
}

export const genericFamilyPacketDefinitions = Object.fromEntries(
  GENERIC_FAMILY_CONFIGS.map((config) => [
    config.family,
    createGenericFamilyPacketDefinition(config),
  ])
) as {
  [TFamily in GenericBuilderFamily]: PacketTypeDefinition<
    (typeof PACKET_BODY_SCHEMAS)[TFamily]
  >;
};

export const elementPacketDefinition = genericFamilyPacketDefinitions.Element;
export const locationPacketDefinition = genericFamilyPacketDefinitions.Location;
export const rolePacketDefinition = genericFamilyPacketDefinitions.Role;
export const claimPacketDefinition = genericFamilyPacketDefinitions.Claim;
export const relationPacketDefinition = genericFamilyPacketDefinitions.Relation;
export const reportPacketDefinition = genericFamilyPacketDefinitions.Report;
export const proposalPacketDefinition = genericFamilyPacketDefinitions.Proposal;
export const votePacketDefinition = genericFamilyPacketDefinitions.Vote;
export const attestationPacketDefinition = genericFamilyPacketDefinitions.Attestation;
export const decisionPacketDefinition = genericFamilyPacketDefinitions.Decision;
export const causePacketDefinition = genericFamilyPacketDefinitions.Cause;
export const actionPacketDefinition = genericFamilyPacketDefinitions.Action;
export const discussionPacketDefinition = genericFamilyPacketDefinitions.Discussion;
export const policyPacketDefinition = genericFamilyPacketDefinitions.Policy;
