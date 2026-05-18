/**
 * File: packet-body-schemas.ts
 * Description: Declares canonical packet header/body schemas and envelope/body type maps.
 */

import { z } from 'zod';

import { WRITE_PROOF_LEVELS } from '@core/auth/proof-types';
import type { PacketFamily } from '@core/schema/packet-ontology';
import {
  AttestationStatusSchema,
  AttestationValueSchema,
  ClaimKindSchema,
  ClaimStatusSchema,
  DEFAULT_PROTOCOL_VERSION,
  DEFAULT_SCHEMA_VERSION,
  DiscussionActorClassSchema,
  DiscussionKindSchema,
  DiscussionSortSchema,
  ElementKindSchema,
  LocalityLevelSchema,
  MissionParticipationModeSchema,
  PacketFamilySchema,
  PacketMergeStrategySchema,
  RelationClaimTargetModeSchema,
  RelationStatusSchema,
  RelationSubjectMatchModeSchema,
  TrustStageSchema,
} from '@core/schema/packet-ontology';

export const PacketRefSchema = z
  .object({
    packet_id: z.string().min(1),
  })
  .strict();

export const PacketRevisionRefSchema = PacketRefSchema.extend({
  revision_id: z.string().min(1),
}).strict();

export const PacketEdgeSchema = z
  .object({
    edge_type: z.string().min(1),
    target: PacketRefSchema,
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const ExternalRefSchema = z
  .object({
    adapter: z.string().min(1),
    ref_type: z.string().min(1),
    ref_id: z.string().min(1),
    url: z.string().min(1).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const PacketProducerSchema = z
  .object({
    adapter: z.string().min(1),
    app_version: z.string().min(1).nullable().default(null),
  })
  .strict();

export const PacketProvenanceSchema = z
  .object({
    created_by: PacketRefSchema.nullable().default(null),
    submitted_by: PacketRefSchema.nullable().default(null),
    adapter: z.string().min(1),
    recorded_at: z.string().min(1).nullable().default(null),
    imported_from_revision: PacketRevisionRefSchema.nullable().default(null),
  })
  .strict();

export const PacketEmbeddedSignatureSchema = z
  .object({
    kid: z.string().min(1),
    signer_packet_ref: PacketRefSchema,
    alg: z.string().min(1),
    signature: z.string().min(1),
    signed_at: z.string().min(1),
  })
  .strict();

export const PacketIntegritySchema = z
  .object({
    canonicalization: z.string().min(1).default('RFC8785'),
    hash_alg: z.string().min(1).default('sha-256'),
    digest: z.string().min(1).nullable().default(null),
    embedded_signatures: z.array(PacketEmbeddedSignatureSchema).default([]),
    signature_refs: z.array(PacketRevisionRefSchema).default([]),
  })
  .strict();

export const PacketModerationSchema = z
  .object({
    visibility: z.enum(['public', 'unlisted', 'private', 'sealed']).default('public'),
    moderation_state: z
      .enum(['open', 'flagged', 'restricted', 'removed'])
      .default('open'),
    policy_refs: z.array(PacketRefSchema).default([]),
    content_warning_ids: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const PacketMetadataSchema = z
  .object({
    tags: z.array(z.string().min(1)).default([]),
    language: z.string().min(1).nullable().default(null),
    summary: z.string().min(1).nullable().default(null),
    compatibility: z
      .object({
        family_history: z
          .array(
            z
              .object({
                family: z.string().min(1),
                schema_version: z.string().min(1),
                adapter_profile: z.string().min(1),
              })
              .strict()
          )
          .default([]),
        compatible_targets: z
          .array(
            z
              .object({
                family: z.string().min(1),
                schema_version: z.string().min(1),
                mode: z.enum(['exact', 'lossy', 'blocked']),
                required_features: z.array(z.string().min(1)).default([]),
                omitted_features: z.array(z.string().min(1)).default([]),
              })
              .strict()
          )
          .default([]),
        migration_policy: z
          .object({
            allow_virtual_downcast: z.boolean().default(true),
            allow_guarded_shadow_write: z.boolean().default(false),
            requires_loss_acknowledgement: z.boolean().default(false),
          })
          .strict()
          .default({
            allow_virtual_downcast: true,
            allow_guarded_shadow_write: false,
            requires_loss_acknowledgement: false,
          }),
      })
      .strict()
      .nullable()
      .default(null),
  })
  .strict();

export const PacketHeaderSchema = z
  .object({
    packet_id: z.string().min(1),
    revision_id: z.string().min(1),
    family: PacketFamilySchema,
    schema_version: z.string().min(1).default(DEFAULT_SCHEMA_VERSION),
    protocol_version: z.string().min(1).default(DEFAULT_PROTOCOL_VERSION),
    created_at: z.string().min(1),
    parent_revision_refs: z.array(PacketRevisionRefSchema).default([]),
    merge_strategy: PacketMergeStrategySchema.nullable().default(null),
    authority_scope_ref: PacketRefSchema.nullable().default(null),
    applicable_scope_refs: z.array(PacketRefSchema).default([]),
    edges: z.array(PacketEdgeSchema).default([]),
    provenance: PacketProvenanceSchema,
    integrity: PacketIntegritySchema.default({
      canonicalization: 'RFC8785',
      hash_alg: 'sha-256',
      digest: null,
      embedded_signatures: [],
      signature_refs: [],
    }),
    moderation: PacketModerationSchema.default({
      visibility: 'public',
      moderation_state: 'open',
      policy_refs: [],
      content_warning_ids: [],
    }),
    external_refs: z.array(ExternalRefSchema).default([]),
    metadata: PacketMetadataSchema.default({
      tags: [],
      language: null,
      summary: null,
      compatibility: null,
    }),
    producer: PacketProducerSchema,
  })
  .strict();

export const TemplateFieldSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    field_type: z.enum([
      'string',
      'markdown',
      'date',
      'datetime',
      'boolean',
      'number',
      'string_list',
      'select',
    ]),
    required: z.boolean().default(false),
    help_text: z.string().min(1).nullable().optional(),
    options: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const ElementBodySchema = z
  .object({
    type: z.literal('element').default('element'),
    kind: ElementKindSchema,
    name: z.string().min(1),
    subtype: z.string().min(1).nullable().optional(),
    summary: z.string().min(1).nullable().optional(),
    scope_kind: z.string().min(1).nullable().default(null),
    scope_system: z.string().min(1).nullable().default(null),
    status: z.string().min(1).nullable().default(null),
    aliases: z.array(z.string().min(1)).default([]),
    display_aliases: z.array(z.string().min(1)).default([]),
    locality_label: z.string().min(1).nullable().optional(),
    locality: z
      .object({
        level: LocalityLevelSchema,
        canonical_name_key: z.string().min(1),
        alias_keys: z.array(z.string().min(1)).default([]),
        display_aliases: z.array(z.string().min(1)).default([]),
      })
      .strict()
      .nullable()
      .default(null),
    identity: z
      .object({
        alias: z.string().min(1),
        claim_status: z.enum(['ephemeral_guest', 'persistent_guest', 'claimed']).default(
          'ephemeral_guest'
        ),
        location_disclosure: z
          .object({
            scope: z.string().min(1),
            value: z.string().min(1),
          })
          .strict()
          .nullable()
          .default(null),
        public_key_bindings: z
          .array(
            z
              .object({
                kid: z.string().min(1),
                alg: z.string().min(1),
                kty: z.string().min(1),
                crv: z.string().min(1).nullable().default(null),
                public_jwk: z.record(z.string(), z.unknown()),
                status: z.enum(['active', 'revoked']).default('active'),
                added_at: z.string().min(1),
                revoked_at: z.string().min(1).nullable().default(null),
              })
              .strict()
          )
          .default([]),
      })
      .strict()
      .nullable()
      .default(null),
    custody_hints: z.record(z.string(), z.unknown()).nullable().default(null),
    tags: z.array(z.string().min(1)).default([]),
    claimed_role_refs: z.array(PacketRefSchema).default([]),
  })
  .strict();

export const LocationBodySchema = z
  .object({
    type: z.literal('location').default('location'),
    subtype: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    status: z.string().min(1).default('active'),
    location_label: z.string().min(1).nullable().default(null),
    descriptor_markdown: z.string().min(1).nullable().default(null),
    spatial_payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const RoleBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    role_kind: z.string().min(1),
    status: z.string().min(1),
    responsibility_markdown: z.string().min(1).nullable().default(null),
  })
  .strict();

export const ClaimBodySchema = z
  .object({
    type: z.literal('claim').default('claim'),
    subtype: z.string().min(1).default('relation_assertion'),
    target_ref: PacketRefSchema,
    subject_ref: PacketRefSchema.nullable().default(null),
    scope_ref: PacketRefSchema.nullable().default(null),
    status: ClaimStatusSchema.default('active'),
    claim_markdown: z.string().min(1).nullable().default(null),
    supporting_refs: z.array(PacketRefSchema).default([]),
    relation_assertion: z
      .object({
        subtype: z.string().min(1),
        subject_ref: PacketRefSchema,
        target_ref: PacketRefSchema,
        scope_ref: PacketRefSchema.nullable().default(null),
      })
      .strict()
      .nullable()
      .default(null),
    claim_kind: ClaimKindSchema.nullable().optional(),
    note: z.string().min(1).nullable().default(null),
  })
  .strict();

export const RelationBodySchema = z
  .object({
    type: z.literal('relation').default('relation'),
    subtype: z.string().min(1),
    subject_ref: PacketRefSchema,
    target_ref: PacketRefSchema,
    scope_ref: PacketRefSchema.nullable().default(null),
    status: RelationStatusSchema.default('active'),
    policy_ref: PacketRefSchema.nullable().default(null),
    terms_ref: PacketRefSchema.nullable().default(null),
    supporting_refs: z.array(PacketRefSchema).default([]),
    note: z.string().min(1).nullable().default(null),
    effective_from: z.string().min(1).nullable().default(null),
    effective_until: z.string().min(1).nullable().default(null),
  })
  .strict();

export const SignalBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    signal_kind: z.string().min(1),
    status: z.string().min(1),
    problem_statement: z.string().min(1).nullable().optional(),
  })
  .strict();

export const ProposalBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    proposal_kind: z.string().min(1),
    status: z.string().min(1),
    decision_scope_refs: z.array(PacketRefSchema).default([]),
    related_policy_refs: z.array(PacketRefSchema).default([]),
  })
  .strict();

export const VoteBodySchema = z
  .object({
    title: z.string().min(1),
    proposal_ref: PacketRefSchema,
    vote_method: z.string().min(1),
    status: z.string().min(1),
    opened_at: z.string().min(1).nullable().optional(),
    closes_at: z.string().min(1).nullable().optional(),
  })
  .strict();

export const AttestationBodySchema = z
  .object({
    type: z.literal('attestation').default('attestation'),
    subtype: z.string().min(1).default('packet_signal'),
    target_ref: PacketRefSchema,
    value: AttestationValueSchema,
    status: AttestationStatusSchema.default('active'),
    attestation_kind: z
      .enum([
        'packet_signal',
        'proposal_support',
        'proposal_oppose',
        'attendance_vouch',
        'identity_attest',
        'assembly_association_claim',
        'role_support',
        'role_dispute',
        'claim_support',
        'claim_dispute',
        'packet_confirm',
        'packet_dispute',
      ])
      .default('packet_signal'),
    context_ref: PacketRefSchema.nullable().default(null),
    supporting_refs: z.array(PacketRefSchema).default([]),
    note: z.string().min(1).nullable().default(null),
    supersedes_ref: PacketRefSchema.nullable().default(null),
  })
  .strict();

export const DecisionBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    outcome: z.string().min(1),
    proposal_ref: PacketRefSchema.nullable().optional(),
    vote_ref: PacketRefSchema.nullable().optional(),
  })
  .strict();

export const CauseBodySchema = z
  .object({
    type: z.literal('cause').default('cause'),
    subtype: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    status: z.string().min(1),
    purpose_markdown: z.string().min(1).nullable().default(null),
    policy_refs: z.array(PacketRefSchema).default([]),
    template_refs: z.array(PacketRefSchema).default([]),
    module_refs: z.array(PacketRefSchema).default([]),
  })
  .strict();

export const ActionBodySchema = z
  .object({
    type: z.literal('action').default('action'),
    subtype: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    status: z.string().min(1),
    objective_markdown: z.string().min(1).nullable().default(null),
    cause_refs: z.array(PacketRefSchema).default([]),
    location_refs: z.array(PacketRefSchema).default([]),
    action_refs: z.array(PacketRefSchema).default([]),
  })
  .strict();

export const InitiativeBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    status: z.string().min(1),
  })
  .strict();

export const ProgramBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    initiative_ref: PacketRefSchema.nullable().optional(),
    status: z.string().min(1),
  })
  .strict();

export const CampaignBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    initiative_ref: PacketRefSchema.nullable().optional(),
    program_ref: PacketRefSchema.nullable().optional(),
    status: z.string().min(1),
  })
  .strict();

export const MissionTemplateBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    initiative_ref: PacketRefSchema.nullable().optional(),
    field_schema: z.array(TemplateFieldSchema).default([]),
    default_values: z.record(z.string(), z.unknown()).default({}),
    render_hints: z.record(z.string(), z.unknown()).default({}),
    module_refs: z.array(PacketRefSchema).default([]),
    policy_refs: z.array(PacketRefSchema).default([]),
  })
  .strict();

export const MissionPlanBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    initiative_ref: PacketRefSchema.nullable().optional(),
    template_ref: PacketRefSchema.nullable().optional(),
    status: z.string().min(1),
    alignment_mode: z.string().min(1),
    participation_mode: MissionParticipationModeSchema,
    objectives: z.array(z.string().min(1)).default([]),
    coordinator_refs: z.array(PacketRefSchema).default([]),
    schedule: z
      .object({
        location_name: z.string().min(1),
        start_local: z.string().min(1),
        timezone: z.string().min(1).nullable().optional(),
        duration_minutes: z.number().int().nonnegative().nullable().optional(),
      })
      .strict(),
    modules: z
      .object({
        module_refs: z.array(PacketRefSchema).default([]),
        safety_items: z.array(z.string().min(1)).default([]),
        comms_channel: z.string().min(1).nullable().optional(),
        supply_items: z.array(z.string().min(1)).default([]),
      })
      .strict(),
  })
  .strict();

export const MissionReportBodySchema = z
  .object({
    title: z.string().min(1),
    mission_plan_ref: PacketRefSchema,
    template_ref: PacketRefSchema.nullable().optional(),
    report_type: z.enum([
      'coordinator_aar',
      'participant_report',
      'external_element_report',
    ]),
    completion_checklist: z
      .array(
        z
          .object({
            objective: z.string().min(1),
            status: z.enum([
              'complete',
              'incomplete',
              'partial',
              'not_applicable',
            ]),
            notes: z.string().min(1).nullable().optional(),
          })
          .strict()
      )
      .default([]),
    notes: z.string().min(1),
    improvements: z.array(z.string().min(1)).default([]),
    artifact_refs: z.array(PacketRefSchema).default([]),
  })
  .strict();

export const ReportBodySchema = z
  .object({
    type: z.literal('report').default('report'),
    subtype: z.enum(['verification_report', 'import_report']),
    status: z.enum(['active', 'superseded']).default('active'),
    target_ref: PacketRefSchema.nullable().default(null),
    scope_ref: PacketRefSchema.nullable().default(null),
    summary_markdown: z.string().min(1).nullable().default(null),
    report_markdown: z.string().min(1),
    supporting_refs: z.array(PacketRefSchema).default([]),
    supersedes_ref: PacketRefSchema.nullable().default(null),
    report_data: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const ModuleBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    module_kind: z.string().min(1),
    status: z.string().min(1),
  })
  .strict();

export const PolicyBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    policy_kind: z.string().min(1),
    body_markdown: z.string().min(1),
    status: z.string().min(1),
    trust_policy: z
      .object({
        association_support_threshold: z.number().int().nonnegative().default(1),
        role_support_threshold: z.number().int().nonnegative().default(2),
        posting_gate: TrustStageSchema.default('emerging'),
        voting_gate: TrustStageSchema.default('recognized'),
        review_gate: TrustStageSchema.default('role_eligible'),
      })
      .strict()
      .nullable()
      .default(null),
    write_policy: z
      .object({
        default_proof_level: z.enum(WRITE_PROOF_LEVELS).default('session'),
        action_overrides: z.record(z.string().min(1), z.enum(WRITE_PROOF_LEVELS)).default({}),
      })
      .strict()
      .nullable()
      .default(null),
    dependency_policy: z
      .object({
        required_refs: z.array(PacketRefSchema).default([]),
        optional_refs: z.array(PacketRefSchema).default([]),
        required_relation_subtypes: z.array(z.string().min(1)).default([]),
      })
      .strict()
      .nullable()
      .default(null),
    alignment_policy: z
      .object({
        required_cause_refs: z.array(PacketRefSchema).default([]),
        accepted_relation_subtypes: z.array(z.string().min(1)).default([]),
      })
      .strict()
      .nullable()
      .default(null),
    relation_requirements: z
      .object({
        rules: z
          .array(
            z
              .object({
                relation_subtype: z.string().min(1),
                required_claim_subtypes: z.array(z.string().min(1)).default([]),
                required_attestation_subtypes: z.array(z.string().min(1)).default([]),
                claim_target_mode: RelationClaimTargetModeSchema.default('relation_packet'),
                subject_match_mode: RelationSubjectMatchModeSchema.default(
                  'relation_subject'
                ),
              })
              .strict()
          )
          .default([]),
      })
      .strict()
      .nullable()
      .default(null),
  })
  .strict();


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

export const ElementInterfacePreferenceValueSchema = z
  .object({
    scope_display: ScopeDisplayPreferenceValueSchema.default({}),
  })
  .strict();

export const ElementPreferenceValueSchema = z
  .object({
    interface: ElementInterfacePreferenceValueSchema.default({}),
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

export const ElementPreferenceBodySchema = PreferenceBaseBodySchema.extend({
  subtype: z.literal('element'),
  value: ElementPreferenceValueSchema,
}).strict();

export const PreferenceBodySchema = ElementPreferenceBodySchema;

export const DiscussionThreadBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    forum_ref: PacketRefSchema,
    thread_kind: z.string().min(1),
    status: z.string().min(1),
    related_refs: z.array(PacketRefSchema).default([]),
    participation_rules: z
      .object({
        top_level_actor_classes: z.array(DiscussionActorClassSchema).default([]),
        reply_actor_classes: z.array(DiscussionActorClassSchema).default([]),
        reaction_actor_classes: z.array(DiscussionActorClassSchema).default([]),
        top_level_post_cost: z.number().int().nonnegative().default(0),
      })
      .default({
        top_level_actor_classes: [],
        reply_actor_classes: [],
        reaction_actor_classes: [],
        top_level_post_cost: 0,
      }),
    default_sort: DiscussionSortSchema.default('new'),
  })
  .strict();

const DiscussionParticipationRulesSchema = z
  .object({
    top_level_actor_classes: z.array(DiscussionActorClassSchema).default([]),
    reply_actor_classes: z.array(DiscussionActorClassSchema).default([]),
    reaction_actor_classes: z.array(DiscussionActorClassSchema).default([]),
    top_level_post_cost: z.number().int().nonnegative().default(0),
  })
  .default({
    top_level_actor_classes: [],
    reply_actor_classes: [],
    reaction_actor_classes: [],
    top_level_post_cost: 0,
  });

const DiscussionBaseBodySchema = z
  .object({
    kind: DiscussionKindSchema,
    role: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    status: z.string().min(1).default('open'),
  })
  .strict();

export const DiscussionBodySchema = z.discriminatedUnion('kind', [
  DiscussionBaseBodySchema.extend({
    kind: z.literal('space'),
    scope_ref: PacketRefSchema,
  }).strict(),
  DiscussionBaseBodySchema.extend({
    kind: z.literal('forum'),
    parent_ref: PacketRefSchema,
    participation_rules: DiscussionParticipationRulesSchema,
    default_sort: DiscussionSortSchema.default('new'),
  }).strict(),
  DiscussionBaseBodySchema.extend({
    kind: z.literal('topic'),
    parent_ref: PacketRefSchema,
    related_refs: z.array(PacketRefSchema).default([]),
    participation_rules: DiscussionParticipationRulesSchema,
    default_sort: DiscussionSortSchema.default('new'),
  }).strict(),
  DiscussionBaseBodySchema.extend({
    kind: z.literal('message'),
    parent_ref: PacketRefSchema,
    topic_ref: PacketRefSchema,
    root_message_ref: PacketRefSchema.nullable().default(null),
    content_markdown: z.string().min(1),
  }).strict(),
]);

export const DiscussionSpaceBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    scope_ref: PacketRefSchema,
    status: z.string().min(1),
  })
  .strict();

export const DiscussionForumBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    discussion_space_ref: PacketRefSchema,
    forum_kind: z.string().min(1),
    status: z.string().min(1),
    participation_rules: z
      .object({
        top_level_actor_classes: z.array(DiscussionActorClassSchema).default([]),
        reply_actor_classes: z.array(DiscussionActorClassSchema).default([]),
        reaction_actor_classes: z.array(DiscussionActorClassSchema).default([]),
        top_level_post_cost: z.number().int().nonnegative().default(0),
      })
      .default({
        top_level_actor_classes: [],
        reply_actor_classes: [],
        reaction_actor_classes: [],
        top_level_post_cost: 0,
      }),
    default_sort: DiscussionSortSchema.default('new'),
  })
  .strict();

export const DiscussionPostBodySchema = z
  .object({
    title: z.string().min(1),
    thread_ref: PacketRefSchema,
    post_kind: z.string().min(1),
    content_markdown: z.string().min(1),
    reply_to_ref: PacketRefSchema.nullable().optional(),
  })
  .strict();

export const DiscussionReplyBodySchema = z
  .object({
    title: z.string().min(1),
    thread_ref: PacketRefSchema,
    root_post_ref: PacketRefSchema,
    reply_to_ref: PacketRefSchema,
    content_markdown: z.string().min(1),
  })
  .strict();

export const MinutesBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1),
    meeting_at: z.string().min(1).nullable().optional(),
    decision_refs: z.array(PacketRefSchema).default([]),
    artifact_refs: z.array(PacketRefSchema).default([]),
  })
  .strict();

export const ArtifactBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    artifact_kind: z.string().min(1),
    media_type: z.string().min(1).nullable().optional(),
    sha256: z.string().min(1).nullable().optional(),
    byte_length: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();

export const PACKET_BODY_SCHEMAS = {
  Element: ElementBodySchema,
  Location: LocationBodySchema,
  Role: RoleBodySchema,
  Claim: ClaimBodySchema,
  Relation: RelationBodySchema,
  Report: ReportBodySchema,
  Signal: SignalBodySchema,
  Proposal: ProposalBodySchema,
  Vote: VoteBodySchema,
  Attestation: AttestationBodySchema,
  Decision: DecisionBodySchema,
  Cause: CauseBodySchema,
  Action: ActionBodySchema,
  Initiative: InitiativeBodySchema,
  Program: ProgramBodySchema,
  Campaign: CampaignBodySchema,
  MissionTemplate: MissionTemplateBodySchema,
  MissionPlan: MissionPlanBodySchema,
  MissionReport: MissionReportBodySchema,
  Module: ModuleBodySchema,
  Policy: PolicyBodySchema,
  Preference: PreferenceBodySchema,
  Discussion: DiscussionBodySchema,
  DiscussionSpace: DiscussionSpaceBodySchema,
  DiscussionForum: DiscussionForumBodySchema,
  DiscussionThread: DiscussionThreadBodySchema,
  DiscussionPost: DiscussionPostBodySchema,
  DiscussionReply: DiscussionReplyBodySchema,
  Minutes: MinutesBodySchema,
  Artifact: ArtifactBodySchema,
} satisfies Record<PacketFamily, z.ZodTypeAny>;

export type PacketRef = z.infer<typeof PacketRefSchema>;
export type PacketRevisionRef = z.infer<typeof PacketRevisionRefSchema>;
export type PacketEdge = z.infer<typeof PacketEdgeSchema>;
export type PacketHeader = z.infer<typeof PacketHeaderSchema>;
export type PacketBodyByType = {
  [TFamily in PacketFamily]: z.infer<(typeof PACKET_BODY_SCHEMAS)[TFamily]>;
};

export type PacketEnvelopeByType = {
  [TFamily in PacketFamily]: {
    header: PacketHeader & { family: TFamily };
    body: PacketBodyByType[TFamily];
  };
};

export type PacketEnvelope = PacketEnvelopeByType[PacketFamily];

export function getPacketBodySchema<TFamily extends PacketFamily>(
  family: TFamily
): (typeof PACKET_BODY_SCHEMAS)[TFamily] {
  return PACKET_BODY_SCHEMAS[family];
}
