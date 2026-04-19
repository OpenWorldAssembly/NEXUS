/**
 * File: packet-schema.ts
 * Description: Defines the canonical OWA packet envelope, packet-family registry, and parser entrypoints.
 */

import { z } from 'zod';

export const PACKET_FAMILIES = [
  'Element',
  'Role',
  'Claim',
  'Signal',
  'Proposal',
  'Vote',
  'Attestation',
  'Decision',
  'Initiative',
  'Program',
  'Campaign',
  'MissionTemplate',
  'MissionPlan',
  'MissionReport',
  'Module',
  'Policy',
  'DiscussionSpace',
  'DiscussionForum',
  'DiscussionThread',
  'DiscussionPost',
  'DiscussionReply',
  'Minutes',
  'Artifact',
] as const;

export const ELEMENT_KINDS = [
  'assembly',
  'team',
  'node',
  'person',
  'organization',
  'service',
] as const;

export const PERSON_CLAIM_STATUSES = [
  'ephemeral_guest',
  'persistent_guest',
  'claimed',
] as const;

export const PERSON_KEY_STATUSES = ['active', 'revoked'] as const;

export const MISSION_PARTICIPATION_MODES = [
  'integrated',
  'independent',
  'hybrid',
] as const;

export const DISCUSSION_ACTOR_CLASSES = [
  'anonymous_guest',
  'scope_member',
  'trusted_member',
  'steward',
] as const;

export const DISCUSSION_SORTS = [
  'hot',
  'new',
  'top',
  'controversial',
  'active',
  'old',
  'most_downvoted',
] as const;

export const DISCUSSION_REPLY_SORTS = [
  'new',
  'top',
  'controversial',
  'old',
] as const;

export const ATTESTATION_VALUES = [1, -1] as const;
export const ATTESTATION_STATUSES = ['active', 'cleared'] as const;
export const ATTESTATION_KINDS = [
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
] as const;

export const CLAIM_KINDS = [
  'role_association',
  'assembly_association',
  'home_locality',
] as const;

export const CLAIM_STATUSES = ['active', 'withdrawn'] as const;

export const TRUST_STAGES = [
  'self_claimed',
  'emerging',
  'recognized',
  'role_eligible',
] as const;

export const PACKET_REVISION_MODES = [
  'append_only',
  'replaceable',
  'mergeable',
] as const;

export const CORE_EDGE_TYPES = [
  'authority_scope',
  'applicable_scope',
  'parent_scope',
  'member_of',
  'subscribed_to',
  'depends_on',
  'fork_of',
  'derived_from',
  'reports_on',
  'references',
  'implements',
  'governed_by',
  'scoped_to',
  'reply_to',
  'belongs_to',
  'supports',
  'decides',
  'votes_on',
  'uses_template',
  'uses_module',
  'uses_policy',
] as const;

export const REVISION_STATES = ['linear', 'diverged', 'merged'] as const;

export const MERGE_STRATEGIES = [
  'manual',
  'three_way',
  'set_union',
  'append_only',
  'last_write_wins',
] as const;

export const DEFAULT_PROTOCOL_VERSION = '0.1.0';
export const DEFAULT_SCHEMA_VERSION = '1.0.0';

export const PacketFamilySchema = z.enum(PACKET_FAMILIES);
export const ElementKindSchema = z.enum(ELEMENT_KINDS);
export const PersonClaimStatusSchema = z.enum(PERSON_CLAIM_STATUSES);
export const PersonKeyStatusSchema = z.enum(PERSON_KEY_STATUSES);
export const MissionParticipationModeSchema = z.enum(
  MISSION_PARTICIPATION_MODES
);
export const DiscussionActorClassSchema = z.enum(DISCUSSION_ACTOR_CLASSES);
export const DiscussionSortSchema = z.enum(DISCUSSION_SORTS);
export const DiscussionReplySortSchema = z.enum(DISCUSSION_REPLY_SORTS);
export const AttestationStatusSchema = z.enum(ATTESTATION_STATUSES);
export const AttestationKindSchema = z.enum(ATTESTATION_KINDS);
export const PacketRevisionStateSchema = z.enum(REVISION_STATES);
export const PacketMergeStrategySchema = z.enum(MERGE_STRATEGIES);
export const AttestationValueSchema = z.union([z.literal(1), z.literal(-1)]);
export const TrustStageSchema = z.enum(TRUST_STAGES);
export const PacketRevisionModeSchema = z.enum(PACKET_REVISION_MODES);
export const ClaimKindSchema = z.enum(CLAIM_KINDS);
export const ClaimStatusSchema = z.enum(CLAIM_STATUSES);

export type PacketFamily = z.infer<typeof PacketFamilySchema>;
export type ElementKind = z.infer<typeof ElementKindSchema>;
export type PersonClaimStatus = z.infer<typeof PersonClaimStatusSchema>;
export type PersonKeyStatus = z.infer<typeof PersonKeyStatusSchema>;
export type PacketRevisionState = z.infer<typeof PacketRevisionStateSchema>;
export type PacketMergeStrategy = z.infer<typeof PacketMergeStrategySchema>;
export type DiscussionActorClass = z.infer<typeof DiscussionActorClassSchema>;
export type DiscussionSort = z.infer<typeof DiscussionSortSchema>;
export type DiscussionReplySort = z.infer<typeof DiscussionReplySortSchema>;
export type AttestationValue = z.infer<typeof AttestationValueSchema>;
export type AttestationStatus = z.infer<typeof AttestationStatusSchema>;
export type AttestationKind = z.infer<typeof AttestationKindSchema>;
export type TrustStage = z.infer<typeof TrustStageSchema>;
export type PacketRevisionMode = z.infer<typeof PacketRevisionModeSchema>;
export type ClaimKind = z.infer<typeof ClaimKindSchema>;
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;
export type PacketVoteValue = AttestationValue;
export type PacketVoteStatus = AttestationStatus;
export type PacketVoteKind = AttestationKind;
export const PacketVoteValueSchema = AttestationValueSchema;
export const PacketVoteStatusSchema = AttestationStatusSchema;
export const PacketVoteKindSchema = AttestationKindSchema;

export const LOCALITY_LEVELS = ['nation', 'region', 'city', 'district'] as const;
export const LocalityLevelSchema = z.enum(LOCALITY_LEVELS);
export type LocalityLevel = z.infer<typeof LocalityLevelSchema>;

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
    kind: ElementKindSchema,
    name: z.string().min(1),
    subtype: z.string().min(1).nullable().optional(),
    summary: z.string().min(1).nullable().optional(),
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
        claim_status: PersonClaimStatusSchema.default('ephemeral_guest'),
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
                status: PersonKeyStatusSchema.default('active'),
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
    tags: z.array(z.string().min(1)).default([]),
    claimed_role_refs: z.array(PacketRefSchema).default([]),
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
    claim_kind: ClaimKindSchema,
    subject_ref: PacketRefSchema,
    target_ref: PacketRefSchema,
    scope_ref: PacketRefSchema,
    status: ClaimStatusSchema.default('active'),
    note: z.string().min(1).nullable().default(null),
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
    target_ref: PacketRefSchema,
    value: AttestationValueSchema,
    status: AttestationStatusSchema.default('active'),
    attestation_kind: AttestationKindSchema.default('packet_signal'),
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
  })
  .strict();

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
        top_level_actor_classes: z
          .array(DiscussionActorClassSchema)
          .default([]),
        reply_actor_classes: z
          .array(DiscussionActorClassSchema)
          .default([]),
        reaction_actor_classes: z
          .array(DiscussionActorClassSchema)
          .default([]),
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
        top_level_actor_classes: z
          .array(DiscussionActorClassSchema)
          .default([]),
        reply_actor_classes: z
          .array(DiscussionActorClassSchema)
          .default([]),
        reaction_actor_classes: z
          .array(DiscussionActorClassSchema)
          .default([]),
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
  Role: RoleBodySchema,
  Claim: ClaimBodySchema,
  Signal: SignalBodySchema,
  Proposal: ProposalBodySchema,
  Vote: VoteBodySchema,
  Attestation: AttestationBodySchema,
  Decision: DecisionBodySchema,
  Initiative: InitiativeBodySchema,
  Program: ProgramBodySchema,
  Campaign: CampaignBodySchema,
  MissionTemplate: MissionTemplateBodySchema,
  MissionPlan: MissionPlanBodySchema,
  MissionReport: MissionReportBodySchema,
  Module: ModuleBodySchema,
  Policy: PolicyBodySchema,
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

export const PACKET_FAMILY_REVISION_MODES = {
  Element: 'replaceable',
  Role: 'replaceable',
  Claim: 'replaceable',
  Signal: 'append_only',
  Proposal: 'replaceable',
  Vote: 'append_only',
  Attestation: 'append_only',
  Decision: 'append_only',
  Initiative: 'replaceable',
  Program: 'replaceable',
  Campaign: 'replaceable',
  MissionTemplate: 'replaceable',
  MissionPlan: 'replaceable',
  MissionReport: 'replaceable',
  Module: 'replaceable',
  Policy: 'replaceable',
  DiscussionSpace: 'replaceable',
  DiscussionForum: 'replaceable',
  DiscussionThread: 'replaceable',
  DiscussionPost: 'append_only',
  DiscussionReply: 'append_only',
  Minutes: 'append_only',
  Artifact: 'append_only',
} satisfies Record<PacketFamily, PacketRevisionMode>;

type PacketCompatibilityEntry<TFamily extends PacketFamily> = {
  current_schema_version: string;
  revision_mode: PacketRevisionMode;
  parseBody: (
    schemaVersion: string,
    body: unknown
  ) => PacketBodyByType[TFamily];
};

const RESERVED_BODY_KEYS = new Set([
  'packet_id',
  'revision_id',
  'family',
  'schema_version',
  'protocol_version',
  'created_at',
  'parent_revision_refs',
  'merge_strategy',
  'authority_scope_ref',
  'applicable_scope_refs',
  'edges',
  'provenance',
  'integrity',
  'moderation',
  'external_refs',
  'metadata',
  'producer',
]);

const EnvelopeInputSchema = z
  .object({
    header: PacketHeaderSchema,
    body: z.unknown(),
  })
  .strict();

const LegacyElementBodySchema = ElementBodySchema.omit({
  claimed_role_refs: true,
}).extend({
  claimed_role_refs: z.array(PacketRefSchema).optional(),
});

const LegacyPolicyBodySchema = PolicyBodySchema.omit({
  trust_policy: true,
}).extend({
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
    .optional(),
});

const LegacyClaimBodySchema = ClaimBodySchema.omit({
  note: true,
}).extend({
  note: z.string().min(1).nullable().optional(),
});

function createDefaultCompatibilityEntry<TFamily extends PacketFamily>(
  family: TFamily
): PacketCompatibilityEntry<TFamily> {
  return {
    current_schema_version: DEFAULT_SCHEMA_VERSION,
    revision_mode: PACKET_FAMILY_REVISION_MODES[family],
    parseBody: (schemaVersion, body) => {
      if (schemaVersion !== DEFAULT_SCHEMA_VERSION) {
        throw new Error(
          `Unsupported schema version ${schemaVersion} for packet family ${family}.`
        );
      }

      rejectHeaderBodyCollisions(body, family);

      return getPacketBodySchema(family).parse(body) as PacketBodyByType[TFamily];
    },
  };
}

export const PACKET_COMPATIBILITY_REGISTRY = {
  Element: {
    current_schema_version: DEFAULT_SCHEMA_VERSION,
    revision_mode: PACKET_FAMILY_REVISION_MODES.Element,
    parseBody: (schemaVersion, body) => {
      rejectHeaderBodyCollisions(body, 'Element');

      if (schemaVersion === DEFAULT_SCHEMA_VERSION) {
        return ElementBodySchema.parse(body);
      }

      if (schemaVersion === '0.9.0') {
        const legacyBody = LegacyElementBodySchema.parse(body);

        return ElementBodySchema.parse({
          ...legacyBody,
          claimed_role_refs: legacyBody.claimed_role_refs ?? [],
        });
      }

      throw new Error(
        `Unsupported schema version ${schemaVersion} for packet family Element.`
      );
    },
  },
  Role: createDefaultCompatibilityEntry('Role'),
  Claim: {
    current_schema_version: DEFAULT_SCHEMA_VERSION,
    revision_mode: PACKET_FAMILY_REVISION_MODES.Claim,
    parseBody: (schemaVersion, body) => {
      rejectHeaderBodyCollisions(body, 'Claim');

      if (schemaVersion === DEFAULT_SCHEMA_VERSION) {
        return ClaimBodySchema.parse(body);
      }

      if (schemaVersion === '0.9.0') {
        const legacyBody = LegacyClaimBodySchema.parse(body);

        return ClaimBodySchema.parse({
          ...legacyBody,
          note: legacyBody.note ?? null,
        });
      }

      throw new Error(
        `Unsupported schema version ${schemaVersion} for packet family Claim.`
      );
    },
  },
  Signal: createDefaultCompatibilityEntry('Signal'),
  Proposal: createDefaultCompatibilityEntry('Proposal'),
  Vote: createDefaultCompatibilityEntry('Vote'),
  Attestation: createDefaultCompatibilityEntry('Attestation'),
  Decision: createDefaultCompatibilityEntry('Decision'),
  Initiative: createDefaultCompatibilityEntry('Initiative'),
  Program: createDefaultCompatibilityEntry('Program'),
  Campaign: createDefaultCompatibilityEntry('Campaign'),
  MissionTemplate: createDefaultCompatibilityEntry('MissionTemplate'),
  MissionPlan: createDefaultCompatibilityEntry('MissionPlan'),
  MissionReport: createDefaultCompatibilityEntry('MissionReport'),
  Module: createDefaultCompatibilityEntry('Module'),
  Policy: {
    current_schema_version: DEFAULT_SCHEMA_VERSION,
    revision_mode: PACKET_FAMILY_REVISION_MODES.Policy,
    parseBody: (schemaVersion, body) => {
      rejectHeaderBodyCollisions(body, 'Policy');

      if (schemaVersion === DEFAULT_SCHEMA_VERSION) {
        return PolicyBodySchema.parse(body);
      }

      if (schemaVersion === '0.9.0') {
        const legacyBody = LegacyPolicyBodySchema.parse(body);

        return PolicyBodySchema.parse({
          ...legacyBody,
          trust_policy: legacyBody.trust_policy ?? null,
        });
      }

      throw new Error(
        `Unsupported schema version ${schemaVersion} for packet family Policy.`
      );
    },
  },
  DiscussionSpace: createDefaultCompatibilityEntry('DiscussionSpace'),
  DiscussionForum: createDefaultCompatibilityEntry('DiscussionForum'),
  DiscussionThread: createDefaultCompatibilityEntry('DiscussionThread'),
  DiscussionPost: createDefaultCompatibilityEntry('DiscussionPost'),
  DiscussionReply: createDefaultCompatibilityEntry('DiscussionReply'),
  Minutes: createDefaultCompatibilityEntry('Minutes'),
  Artifact: createDefaultCompatibilityEntry('Artifact'),
} satisfies {
  [TFamily in PacketFamily]: PacketCompatibilityEntry<TFamily>;
};

function rejectHeaderBodyCollisions(
  body: unknown,
  family: PacketFamily
): void {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return;
  }

  Object.keys(body).forEach((key) => {
    if (RESERVED_BODY_KEYS.has(key)) {
      throw new z.ZodError([
        {
          code: 'custom',
          path: ['body', key],
          message: `Body field collides with reserved header field for ${family}.`,
        },
      ]);
    }
  });
}

export function getPacketBodySchema<TFamily extends PacketFamily>(
  family: TFamily
): (typeof PACKET_BODY_SCHEMAS)[TFamily] {
  return PACKET_BODY_SCHEMAS[family];
}

export function getPacketFamilyRevisionMode(
  family: PacketFamily
): PacketRevisionMode {
  return PACKET_COMPATIBILITY_REGISTRY[family].revision_mode;
}

export function getPacketCurrentSchemaVersion(
  family: PacketFamily
): string {
  return PACKET_COMPATIBILITY_REGISTRY[family].current_schema_version;
}

export function parsePacketBody<TFamily extends PacketFamily>(
  family: TFamily,
  body: unknown,
  schemaVersion = DEFAULT_SCHEMA_VERSION
): PacketBodyByType[TFamily] {
  return PACKET_COMPATIBILITY_REGISTRY[family].parseBody(
    schemaVersion,
    body
  ) as PacketBodyByType[TFamily];
}

export function parsePacketEnvelope(input: unknown): PacketEnvelope {
  const envelope = EnvelopeInputSchema.parse(input);
  const parsedBody = parsePacketBody(
    envelope.header.family,
    envelope.body,
    envelope.header.schema_version
  );

  return {
    header: envelope.header,
    body: parsedBody,
  } as PacketEnvelope;
}

export function createPacketEnvelope<TFamily extends PacketFamily>(input: {
  header: z.input<typeof PacketHeaderSchema> & { family: TFamily };
  body: z.input<(typeof PACKET_BODY_SCHEMAS)[TFamily]>;
}): PacketEnvelopeByType[TFamily] {
  const header = PacketHeaderSchema.parse(input.header);
  const body = parsePacketBody(
    input.header.family,
    input.body,
    header.schema_version
  );

  return {
    header: header as PacketHeader & { family: TFamily },
    body,
  } as PacketEnvelopeByType[TFamily];
}
