/**
 * File: packet-schema.ts
 * Description: Defines the canonical OWA packet envelope, packet-family registry, and parser entrypoints.
 */

import { z } from 'zod';

import { WRITE_PROOF_LEVELS } from '@core/auth/proof-types';

export const PACKET_FAMILIES = [
  'Element',
  'Location',
  'Role',
  'Claim',
  'Relation',
  'Signal',
  'Proposal',
  'Vote',
  'Attestation',
  'Decision',
  'Cause',
  'Action',
  'Initiative',
  'Program',
  'Campaign',
  'MissionTemplate',
  'MissionPlan',
  'MissionReport',
  'Module',
  'Policy',
  'Discussion',
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
  'locality',
  'organization',
  'service',
  'working_group',
  'digital_space',
  'building',
  'container',
  'operator',
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
export const DISCUSSION_KINDS = ['space', 'forum', 'topic', 'message'] as const;

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
export const RELATION_STATUSES = ['active', 'inactive', 'withdrawn'] as const;

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

export const PACKET_READ_MODES = ['raw', 'adapted', 'raw_plus_adaptation'] as const;
export const PACKET_ADAPTATION_DIRECTIONS = [
  'same_version',
  'upcast',
  'downcast',
] as const;

export const PACKET_ADAPTATION_CHANGE_KINDS = [
  'added_default_field',
  'normalized_null_default',
  'schema_version_bump',
  'renamed_field',
  'moved_field',
  'dropped_deprecated_field',
] as const;
export const PACKET_ADAPTATION_LOSS_KINDS = [
  'dropped_deprecated_field',
  'value_coercion',
  'enum_narrowing',
  'precision_detail_loss',
  'unsupported_target_feature_omission',
] as const;
export const PACKET_WRITE_TARGET_SUPPORTS = [
  'exact',
  'lossy_allowed',
  'blocked',
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
export const DiscussionKindSchema = z.enum(DISCUSSION_KINDS);
export const AttestationStatusSchema = z.enum(ATTESTATION_STATUSES);
export const AttestationKindSchema = z.enum(ATTESTATION_KINDS);
export const PacketRevisionStateSchema = z.enum(REVISION_STATES);
export const PacketMergeStrategySchema = z.enum(MERGE_STRATEGIES);
export const AttestationValueSchema = z.union([z.literal(1), z.literal(-1)]);
export const TrustStageSchema = z.enum(TRUST_STAGES);
export const PacketRevisionModeSchema = z.enum(PACKET_REVISION_MODES);
export const ClaimKindSchema = z.enum(CLAIM_KINDS);
export const ClaimStatusSchema = z.enum(CLAIM_STATUSES);
export const RelationStatusSchema = z.enum(RELATION_STATUSES);

export type PacketFamily = z.infer<typeof PacketFamilySchema>;
export type ElementKind = z.infer<typeof ElementKindSchema>;
export type PersonClaimStatus = z.infer<typeof PersonClaimStatusSchema>;
export type PersonKeyStatus = z.infer<typeof PersonKeyStatusSchema>;
export type PacketRevisionState = z.infer<typeof PacketRevisionStateSchema>;
export type PacketMergeStrategy = z.infer<typeof PacketMergeStrategySchema>;
export type DiscussionActorClass = z.infer<typeof DiscussionActorClassSchema>;
export type DiscussionSort = z.infer<typeof DiscussionSortSchema>;
export type DiscussionReplySort = z.infer<typeof DiscussionReplySortSchema>;
export type DiscussionKind = z.infer<typeof DiscussionKindSchema>;
export type AttestationValue = z.infer<typeof AttestationValueSchema>;
export type AttestationStatus = z.infer<typeof AttestationStatusSchema>;
export type AttestationKind = z.infer<typeof AttestationKindSchema>;
export type TrustStage = z.infer<typeof TrustStageSchema>;
export type PacketRevisionMode = z.infer<typeof PacketRevisionModeSchema>;
export type ClaimKind = z.infer<typeof ClaimKindSchema>;
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;
export type RelationStatus = z.infer<typeof RelationStatusSchema>;
export type PacketReadMode = (typeof PACKET_READ_MODES)[number];
export type PacketAdaptationDirection =
  (typeof PACKET_ADAPTATION_DIRECTIONS)[number];
export type PacketAdaptationChangeKind =
  (typeof PACKET_ADAPTATION_CHANGE_KINDS)[number];
export type PacketAdaptationLossKind =
  (typeof PACKET_ADAPTATION_LOSS_KINDS)[number];
export type PacketCompatibilitySupportLevel =
  | 'current_only'
  | 'legacy_supported';
export type PacketWriteTargetSupport =
  (typeof PACKET_WRITE_TARGET_SUPPORTS)[number];
export type PacketWriteTargetPolicy =
  | 'current_only'
  | 'supported_versions';
export type PacketVoteValue = AttestationValue;
export type PacketVoteStatus = AttestationStatus;
export type PacketVoteKind = AttestationKind;
export const PacketVoteValueSchema = AttestationValueSchema;
export const PacketVoteStatusSchema = AttestationStatusSchema;
export const PacketVoteKindSchema = AttestationKindSchema;

export interface PacketAdaptationChange {
  kind: PacketAdaptationChangeKind;
  path: string;
  from_schema_version: string;
  to_schema_version: string;
  message: string;
}

export interface PacketAdaptationLoss {
  kind: PacketAdaptationLossKind;
  path: string;
  from_schema_version: string;
  to_schema_version: string;
  message: string;
}

export interface PacketCompatibilityStatus {
  family: PacketFamily;
  declared_schema_version: string;
  effective_source_schema_version: string;
  interpreted_as_legacy_profile: boolean;
  source_schema_version: string;
  target_schema_version: string;
  direction: PacketAdaptationDirection;
  changes: PacketAdaptationChange[];
  losses: PacketAdaptationLoss[];
  is_lossy: boolean;
  is_exact: boolean;
  writable_as_is: boolean;
  requires_guarded_upgrade: boolean;
  requires_loss_acknowledgement: boolean;
  supported_write_target: PacketWriteTargetSupport;
}

export interface PacketCompatibilityReadResult {
  raw_packet: unknown;
  adapted_packet: PacketEnvelope;
  status: PacketCompatibilityStatus;
}

export interface PacketVersionedWritePreparation {
  raw_packet: unknown;
  adapted_packet: PacketEnvelope;
  prepared_packet: PacketEnvelope | null;
  declared_schema_version: string;
  effective_source_schema_version: string;
  interpreted_as_legacy_profile: boolean;
  source_schema_version: string;
  target_schema_version: string;
  direction: PacketAdaptationDirection;
  changes: PacketAdaptationChange[];
  losses: PacketAdaptationLoss[];
  is_lossy: boolean;
  is_exact: boolean;
  writable_as_is: boolean;
  requires_guarded_upgrade: boolean;
  requires_loss_acknowledgement: boolean;
  supported_write_target: PacketWriteTargetSupport;
}
export type PacketAdaptedWritePreparation = PacketVersionedWritePreparation;

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
    custody_hints: z
      .record(z.string(), z.unknown())
      .nullable()
      .default(null),
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
    claim_kind: ClaimKindSchema,
    subject_ref: PacketRefSchema,
    target_ref: PacketRefSchema,
    scope_ref: PacketRefSchema,
    status: ClaimStatusSchema.default('active'),
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
  Location: LocationBodySchema,
  Role: RoleBodySchema,
  Claim: ClaimBodySchema,
  Relation: RelationBodySchema,
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

export interface RawPacketHeaderInput {
  packet_id: string;
  revision_id: string;
  family: PacketFamily;
  schema_version?: string;
  protocol_version?: string;
  [key: string]: unknown;
}

export interface RawPacketEnvelopeInput {
  header: RawPacketHeaderInput;
  body: unknown;
}

export const PACKET_FAMILY_REVISION_MODES = {
  Element: 'replaceable',
  Location: 'replaceable',
  Role: 'replaceable',
  Claim: 'replaceable',
  Relation: 'replaceable',
  Signal: 'append_only',
  Proposal: 'replaceable',
  Vote: 'append_only',
  Attestation: 'append_only',
  Decision: 'append_only',
  Cause: 'replaceable',
  Action: 'replaceable',
  Initiative: 'replaceable',
  Program: 'replaceable',
  Campaign: 'replaceable',
  MissionTemplate: 'replaceable',
  MissionPlan: 'replaceable',
  MissionReport: 'replaceable',
  Module: 'replaceable',
  Policy: 'replaceable',
  Discussion: 'replaceable',
  DiscussionSpace: 'replaceable',
  DiscussionForum: 'replaceable',
  DiscussionThread: 'replaceable',
  DiscussionPost: 'append_only',
  DiscussionReply: 'append_only',
  Minutes: 'append_only',
  Artifact: 'append_only',
} satisfies Record<PacketFamily, PacketRevisionMode>;

type PacketCompatibilityAdapterOutput = {
  body: unknown;
  changes: PacketAdaptationChange[];
  losses?: PacketAdaptationLoss[];
};

type PacketSchemaVersionDefinition<TFamily extends PacketFamily> = {
  parseBody: (body: unknown) => unknown;
  next_schema_version?: string;
  adaptToNext?: (body: unknown) => PacketCompatibilityAdapterOutput;
  previous_schema_version?: string;
  adaptToPrevious?: (body: unknown) => PacketCompatibilityAdapterOutput;
  matchesDeclaredCurrentBodyShape?: (body: unknown) => boolean;
  createUnsignedPacketCandidate?: (
    packet: PacketEnvelopeByType[TFamily]
  ) => PacketEnvelopeByType[TFamily] | null;
};

type PacketCompatibilityEntry<TFamily extends PacketFamily> = {
  current_schema_version: string;
  revision_mode: PacketRevisionMode;
  support_level: PacketCompatibilitySupportLevel;
  write_target_policy: PacketWriteTargetPolicy;
  versions: Record<string, PacketSchemaVersionDefinition<TFamily>>;
};

export interface PacketCompatibilityAuditSummary {
  family: PacketFamily;
  current_schema_version: string;
  revision_mode: PacketRevisionMode;
  support_level: PacketCompatibilitySupportLevel;
  write_target_policy: PacketWriteTargetPolicy;
  supported_schema_versions: string[];
  has_legacy_versions: boolean;
  has_write_preparation: boolean;
}

export type PacketSignatureCandidateSource =
  | 'exact'
  | 'header_compatibility'
  | 'family_compatibility'
  | 'combined_compatibility';

export interface PacketSignatureCanonicalCandidate<TPacket> {
  packet: TPacket;
  source: PacketSignatureCandidateSource;
}

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

const RawPacketHeaderInputSchema = z
  .object({
    packet_id: z.string().min(1),
    revision_id: z.string().min(1),
    family: PacketFamilySchema,
    schema_version: z.string().min(1).optional(),
    protocol_version: z.string().min(1).optional(),
  })
  .passthrough();

const RawPacketEnvelopeInputSchema = z
  .object({
    header: RawPacketHeaderInputSchema,
    body: z.unknown(),
  })
  .strict();

const ElementBodySchemaV1_0 = ElementBodySchema.omit({
  type: true,
  scope_kind: true,
  scope_system: true,
  status: true,
  aliases: true,
  display_aliases: true,
  custody_hints: true,
});

const LegacyElementBodySchema = ElementBodySchemaV1_0.omit({
  claimed_role_refs: true,
  locality: true,
}).extend({
  claimed_role_refs: z.array(PacketRefSchema).optional(),
});

const PolicyBodySchemaV1_0 = PolicyBodySchema.omit({
  dependency_policy: true,
  alignment_policy: true,
});

const LegacyPolicyBodySchema = PolicyBodySchemaV1_0.omit({
  trust_policy: true,
  write_policy: true,
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
  write_policy: z
    .object({
      default_proof_level: z.enum(WRITE_PROOF_LEVELS).default('session'),
      action_overrides: z.record(z.string().min(1), z.enum(WRITE_PROOF_LEVELS)).default({}),
    })
    .strict()
    .nullable()
    .optional(),
  dependency_policy: z
    .object({
      required_refs: z.array(PacketRefSchema).default([]),
      optional_refs: z.array(PacketRefSchema).default([]),
      required_relation_subtypes: z.array(z.string().min(1)).default([]),
    })
    .strict()
    .nullable()
    .optional(),
  alignment_policy: z
    .object({
      required_cause_refs: z.array(PacketRefSchema).default([]),
      accepted_relation_subtypes: z.array(z.string().min(1)).default([]),
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
    support_level: 'current_only',
    write_target_policy: 'current_only',
    versions: {
      [DEFAULT_SCHEMA_VERSION]: {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, family);

          return getPacketBodySchema(family).parse(body);
        },
      },
    },
  };
}

function createAdaptationChange(input: {
  kind: PacketAdaptationChangeKind;
  path: string;
  fromSchemaVersion: string;
  toSchemaVersion: string;
  message: string;
}): PacketAdaptationChange {
  return {
    kind: input.kind,
    path: input.path,
    from_schema_version: input.fromSchemaVersion,
    to_schema_version: input.toSchemaVersion,
    message: input.message,
  };
}

function createAdaptationLoss(input: {
  kind: PacketAdaptationLossKind;
  path: string;
  fromSchemaVersion: string;
  toSchemaVersion: string;
  message: string;
}): PacketAdaptationLoss {
  return {
    kind: input.kind,
    path: input.path,
    from_schema_version: input.fromSchemaVersion,
    to_schema_version: input.toSchemaVersion,
    message: input.message,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bodyHasOwnProperty(body: unknown, key: string): boolean {
  return isRecord(body) && Object.prototype.hasOwnProperty.call(body, key);
}

function stripElementV1_1CompatibilityFields(
  body: Record<string, unknown>
): Record<string, unknown> | null {
  let nextBody = body;
  let changed = false;

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'type') &&
    nextBody.type === 'element'
  ) {
    const { type: _type, ...withoutType } = nextBody;
    nextBody = withoutType;
    changed = true;
  }

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'scope_kind') &&
    nextBody.scope_kind === null
  ) {
    const { scope_kind: _scopeKind, ...withoutScopeKind } = nextBody;
    nextBody = withoutScopeKind;
    changed = true;
  }

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'scope_system') &&
    nextBody.scope_system === null
  ) {
    const { scope_system: _scopeSystem, ...withoutScopeSystem } = nextBody;
    nextBody = withoutScopeSystem;
    changed = true;
  }

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'status') &&
    nextBody.status === null
  ) {
    const { status: _status, ...withoutStatus } = nextBody;
    nextBody = withoutStatus;
    changed = true;
  }

  if (Array.isArray(nextBody.aliases) && nextBody.aliases.length === 0) {
    const { aliases: _aliases, ...withoutAliases } = nextBody;
    nextBody = withoutAliases;
    changed = true;
  }

  if (
    Array.isArray(nextBody.display_aliases) &&
    nextBody.display_aliases.length === 0
  ) {
    const { display_aliases: _displayAliases, ...withoutDisplayAliases } =
      nextBody;
    nextBody = withoutDisplayAliases;
    changed = true;
  }

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'custody_hints') &&
    nextBody.custody_hints === null
  ) {
    const { custody_hints: _custodyHints, ...withoutCustodyHints } = nextBody;
    nextBody = withoutCustodyHints;
    changed = true;
  }

  return changed ? nextBody : null;
}

function stripElementV1_0CompatibilityFields(
  body: Record<string, unknown>
): Record<string, unknown> | null {
  const v11StrippedBody = stripElementV1_1CompatibilityFields(body) ?? body;
  let nextBody = v11StrippedBody;
  let changed = nextBody !== body;

  if (
    Array.isArray(nextBody.claimed_role_refs) &&
    nextBody.claimed_role_refs.length === 0
  ) {
    const { claimed_role_refs: _claimedRoleRefs, ...withoutClaimedRoleRefs } =
      nextBody;
    nextBody = withoutClaimedRoleRefs;
    changed = true;
  }

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'locality') &&
    nextBody.locality === null
  ) {
    const { locality: _locality, ...withoutLocality } = nextBody;
    nextBody = withoutLocality;
    changed = true;
  }

  return changed ? nextBody : null;
}

function stripCurrentClaimCompatibilityFields(
  body: Record<string, unknown>
): Record<string, unknown> | null {
  if (
    Object.prototype.hasOwnProperty.call(body, 'note') &&
    body.note === null
  ) {
    const { note: _note, ...withoutNote } = body;
    return withoutNote;
  }

  return null;
}

function stripPolicyV1_1CompatibilityFields(
  body: Record<string, unknown>
): Record<string, unknown> | null {
  let nextBody = body;
  let changed = false;

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'dependency_policy') &&
    nextBody.dependency_policy === null
  ) {
    const { dependency_policy: _dependencyPolicy, ...withoutDependencyPolicy } =
      nextBody;
    nextBody = withoutDependencyPolicy;
    changed = true;
  }

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'alignment_policy') &&
    nextBody.alignment_policy === null
  ) {
    const { alignment_policy: _alignmentPolicy, ...withoutAlignmentPolicy } =
      nextBody;
    nextBody = withoutAlignmentPolicy;
    changed = true;
  }

  return changed ? nextBody : null;
}

function stripPolicyV1_0CompatibilityFields(
  body: Record<string, unknown>
): Record<string, unknown> | null {
  const v11StrippedBody = stripPolicyV1_1CompatibilityFields(body) ?? body;
  let nextBody = v11StrippedBody;
  let changed = nextBody !== body;

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'trust_policy') &&
    nextBody.trust_policy === null
  ) {
    const { trust_policy: _trustPolicy, ...withoutTrustPolicy } = nextBody;
    nextBody = withoutTrustPolicy;
    changed = true;
  }

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'write_policy') &&
    nextBody.write_policy === null
  ) {
    const { write_policy: _writePolicy, ...withoutWritePolicy } = nextBody;
    nextBody = withoutWritePolicy;
    changed = true;
  }

  return changed ? nextBody : null;
}

export const PACKET_COMPATIBILITY_REGISTRY = {
  Element: {
    current_schema_version: '1.1.0',
    revision_mode: PACKET_FAMILY_REVISION_MODES.Element,
    support_level: 'legacy_supported',
    write_target_policy: 'supported_versions',
    versions: {
      '0.9.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Element');
          return LegacyElementBodySchema.parse(body);
        },
        matchesDeclaredCurrentBodyShape: (body) =>
          !bodyHasOwnProperty(body, 'claimed_role_refs') ||
          !bodyHasOwnProperty(body, 'locality'),
        next_schema_version: '1.0.0',
        adaptToNext: (body) => {
          const legacyBody = body as z.infer<typeof LegacyElementBodySchema>;
          const changes: PacketAdaptationChange[] = [];

          if (!Array.isArray(legacyBody.claimed_role_refs)) {
            changes.push(
              createAdaptationChange({
                kind: 'added_default_field',
                path: 'body.claimed_role_refs',
                fromSchemaVersion: '0.9.0',
                toSchemaVersion: DEFAULT_SCHEMA_VERSION,
                message:
                  'Added empty claimed_role_refs array for canonical Element compatibility.',
              })
            );
          }

          changes.push(
            createAdaptationChange({
              kind: 'added_default_field',
              path: 'body.locality',
              fromSchemaVersion: '0.9.0',
              toSchemaVersion: DEFAULT_SCHEMA_VERSION,
              message:
                  'Added locality field with null default for canonical Element compatibility.',
            })
          );

          return {
            body: {
              ...legacyBody,
              claimed_role_refs: legacyBody.claimed_role_refs ?? [],
              locality: null,
            },
            changes,
          };
        },
      },
      '1.0.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Element');
          return ElementBodySchemaV1_0.parse(body);
        },
        matchesDeclaredCurrentBodyShape: (body) =>
          bodyHasOwnProperty(body, 'claimed_role_refs') &&
          bodyHasOwnProperty(body, 'locality') &&
          (!bodyHasOwnProperty(body, 'type') ||
            !bodyHasOwnProperty(body, 'scope_kind') ||
            !bodyHasOwnProperty(body, 'scope_system') ||
            !bodyHasOwnProperty(body, 'status') ||
            !bodyHasOwnProperty(body, 'aliases') ||
            !bodyHasOwnProperty(body, 'display_aliases') ||
            !bodyHasOwnProperty(body, 'custody_hints')),
        previous_schema_version: '0.9.0',
        adaptToPrevious: (body) => {
          const currentBody = ElementBodySchemaV1_0.parse(body);
          const nextBody = stripElementV1_0CompatibilityFields(
            currentBody as Record<string, unknown>
          );
          const losses: PacketAdaptationLoss[] = [];

          if (
            Object.prototype.hasOwnProperty.call(nextBody ?? currentBody, 'locality') &&
            (nextBody ?? currentBody as Record<string, unknown>).locality !== null
          ) {
            const bodyRecord = (nextBody ?? currentBody) as Record<string, unknown>;
            const { locality: _locality, ...withoutLocality } = bodyRecord;
            losses.push(
              createAdaptationLoss({
                kind: 'unsupported_target_feature_omission',
                path: 'body.locality',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '0.9.0',
                message:
                  'Dropped non-null locality metadata because schema version 0.9.0 does not support Element locality.',
              })
            );

            return {
              body: withoutLocality,
              changes: [],
              losses,
            };
          }

          return {
            body: nextBody ?? currentBody,
            changes: [],
            losses,
          };
        },
        next_schema_version: '1.1.0',
        adaptToNext: (body) => {
          const currentBody = ElementBodySchemaV1_0.parse(body);

          return {
            body: {
              type: 'element',
              ...currentBody,
              scope_kind: null,
              scope_system: null,
              status: null,
              aliases: [],
              display_aliases: [],
              custody_hints: null,
            },
            changes: [
              createAdaptationChange({
                kind: 'added_default_field',
                path: 'body.type',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added canonical element type field for forward ontology compatibility.',
              }),
              createAdaptationChange({
                kind: 'normalized_null_default',
                path: 'body.scope_kind',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added scope_kind field with null default for forward scope compatibility.',
              }),
              createAdaptationChange({
                kind: 'normalized_null_default',
                path: 'body.scope_system',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added scope_system field with null default for forward scope compatibility.',
              }),
              createAdaptationChange({
                kind: 'normalized_null_default',
                path: 'body.status',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added status field with null default for forward entity compatibility.',
              }),
              createAdaptationChange({
                kind: 'added_default_field',
                path: 'body.aliases',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added empty aliases array for forward element compatibility.',
              }),
              createAdaptationChange({
                kind: 'added_default_field',
                path: 'body.display_aliases',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added empty display_aliases array for forward element compatibility.',
              }),
              createAdaptationChange({
                kind: 'normalized_null_default',
                path: 'body.custody_hints',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added custody_hints field with null default for forward element compatibility.',
              }),
            ],
          };
        },
        createUnsignedPacketCandidate: (packet) => {
          const nextBody = stripElementV1_0CompatibilityFields(
            packet.body as Record<string, unknown>
          );

          if (!nextBody) {
            return null;
          }

          return {
            ...packet,
            body: nextBody,
          } as PacketEnvelopeByType['Element'];
        },
      },
      '1.1.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Element');
          return ElementBodySchema.parse(body);
        },
        previous_schema_version: '1.0.0',
        adaptToPrevious: (body) => {
          const currentBody = ElementBodySchema.parse(body);
          const nextBody = stripElementV1_0CompatibilityFields(
            currentBody as Record<string, unknown>
          );
          return {
            body: nextBody ?? currentBody,
            changes: [],
            losses: [],
          };
        },
        createUnsignedPacketCandidate: (packet) => {
          const nextBody = stripElementV1_0CompatibilityFields(
            packet.body as Record<string, unknown>
          );

          if (!nextBody) {
            return null;
          }

          return {
            ...packet,
            body: nextBody,
          } as PacketEnvelopeByType['Element'];
        },
      },
    },
  },
  Role: createDefaultCompatibilityEntry('Role'),
  Location: createDefaultCompatibilityEntry('Location'),
  Claim: {
    current_schema_version: DEFAULT_SCHEMA_VERSION,
    revision_mode: PACKET_FAMILY_REVISION_MODES.Claim,
    support_level: 'legacy_supported',
    write_target_policy: 'supported_versions',
    versions: {
      '0.9.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Claim');
          return LegacyClaimBodySchema.parse(body);
        },
        matchesDeclaredCurrentBodyShape: (body) => !bodyHasOwnProperty(body, 'note'),
        next_schema_version: DEFAULT_SCHEMA_VERSION,
        adaptToNext: (body) => {
          const legacyBody = body as z.infer<typeof LegacyClaimBodySchema>;

          return {
            body: {
              ...legacyBody,
              note: legacyBody.note ?? null,
            },
            changes:
              legacyBody.note === undefined
                ? [
                    createAdaptationChange({
                      kind: 'normalized_null_default',
                      path: 'body.note',
                      fromSchemaVersion: '0.9.0',
                      toSchemaVersion: DEFAULT_SCHEMA_VERSION,
                      message:
                        'Normalized missing Claim note field to explicit null.',
                    }),
                  ]
                : [],
          };
        },
      },
      [DEFAULT_SCHEMA_VERSION]: {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Claim');
          return ClaimBodySchema.parse(body);
        },
        previous_schema_version: '0.9.0',
        adaptToPrevious: (body) => {
          const currentBody = ClaimBodySchema.parse(body);
          const nextBody = stripCurrentClaimCompatibilityFields(
            currentBody as Record<string, unknown>
          );

          return {
            body: nextBody ?? currentBody,
            changes: [],
            losses: [],
          };
        },
        createUnsignedPacketCandidate: (packet) => {
          const nextBody = stripCurrentClaimCompatibilityFields(
            packet.body as Record<string, unknown>
          );

          if (!nextBody) {
            return null;
          }

          return {
            ...packet,
            body: nextBody,
          } as PacketEnvelopeByType['Claim'];
        },
      },
    },
  },
  Relation: createDefaultCompatibilityEntry('Relation'),
  Signal: createDefaultCompatibilityEntry('Signal'),
  Proposal: createDefaultCompatibilityEntry('Proposal'),
  Vote: createDefaultCompatibilityEntry('Vote'),
  Attestation: createDefaultCompatibilityEntry('Attestation'),
  Decision: createDefaultCompatibilityEntry('Decision'),
  Cause: createDefaultCompatibilityEntry('Cause'),
  Action: createDefaultCompatibilityEntry('Action'),
  Initiative: createDefaultCompatibilityEntry('Initiative'),
  Program: createDefaultCompatibilityEntry('Program'),
  Campaign: createDefaultCompatibilityEntry('Campaign'),
  MissionTemplate: createDefaultCompatibilityEntry('MissionTemplate'),
  MissionPlan: createDefaultCompatibilityEntry('MissionPlan'),
  MissionReport: createDefaultCompatibilityEntry('MissionReport'),
  Module: createDefaultCompatibilityEntry('Module'),
  Policy: {
    current_schema_version: '1.1.0',
    revision_mode: PACKET_FAMILY_REVISION_MODES.Policy,
    support_level: 'legacy_supported',
    write_target_policy: 'supported_versions',
    versions: {
      '0.9.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Policy');
          return LegacyPolicyBodySchema.parse(body);
        },
        matchesDeclaredCurrentBodyShape: (body) =>
          !bodyHasOwnProperty(body, 'trust_policy') ||
          !bodyHasOwnProperty(body, 'write_policy'),
        next_schema_version: '1.0.0',
        adaptToNext: (body) => {
          const legacyBody = body as z.infer<typeof LegacyPolicyBodySchema>;

          return {
            body: {
              ...legacyBody,
              trust_policy: legacyBody.trust_policy ?? null,
              write_policy: legacyBody.write_policy ?? null,
            },
            changes:
              [
                ...(legacyBody.trust_policy === undefined
                  ? [
                      createAdaptationChange({
                        kind: 'normalized_null_default',
                        path: 'body.trust_policy',
                        fromSchemaVersion: '0.9.0',
                        toSchemaVersion: DEFAULT_SCHEMA_VERSION,
                        message:
                          'Normalized missing trust_policy field to explicit null.',
                      }),
                    ]
                  : []),
                ...(legacyBody.write_policy === undefined
                  ? [
                      createAdaptationChange({
                        kind: 'normalized_null_default',
                        path: 'body.write_policy',
                        fromSchemaVersion: '0.9.0',
                        toSchemaVersion: DEFAULT_SCHEMA_VERSION,
                        message:
                          'Normalized missing write_policy field to explicit null.',
                      }),
                    ]
                  : []),
              ],
          };
        },
      },
      '1.0.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Policy');
          return PolicyBodySchemaV1_0.parse(body);
        },
        matchesDeclaredCurrentBodyShape: (body) =>
          bodyHasOwnProperty(body, 'trust_policy') &&
          bodyHasOwnProperty(body, 'write_policy') &&
          (!bodyHasOwnProperty(body, 'dependency_policy') ||
            !bodyHasOwnProperty(body, 'alignment_policy')),
        previous_schema_version: '0.9.0',
        adaptToPrevious: (body) => {
          const currentBody = PolicyBodySchemaV1_0.parse(body);
          const nextBody = stripPolicyV1_0CompatibilityFields(
            currentBody as Record<string, unknown>
          );

          return {
            body: nextBody ?? currentBody,
            changes: [],
            losses: [],
          };
        },
        next_schema_version: '1.1.0',
        adaptToNext: (body) => {
          const currentBody = PolicyBodySchemaV1_0.parse(body);

          return {
            body: {
              ...currentBody,
              dependency_policy: null,
              alignment_policy: null,
            },
            changes: [
              createAdaptationChange({
                kind: 'normalized_null_default',
                path: 'body.dependency_policy',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Normalized missing dependency_policy field to explicit null.',
              }),
              createAdaptationChange({
                kind: 'normalized_null_default',
                path: 'body.alignment_policy',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Normalized missing alignment_policy field to explicit null.',
              }),
            ],
          };
        },
        createUnsignedPacketCandidate: (packet) => {
          const nextBody = stripPolicyV1_0CompatibilityFields(
            packet.body as Record<string, unknown>
          );

          if (!nextBody) {
            return null;
          }

          return {
            ...packet,
            body: nextBody,
          } as PacketEnvelopeByType['Policy'];
        },
      },
      '1.1.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Policy');
          return PolicyBodySchema.parse(body);
        },
        previous_schema_version: '1.0.0',
        adaptToPrevious: (body) => {
          const currentBody = PolicyBodySchema.parse(body);
          const nextBody = stripPolicyV1_0CompatibilityFields(
            currentBody as Record<string, unknown>
          );

          return {
            body: nextBody ?? currentBody,
            changes: [],
            losses: [],
          };
        },
        createUnsignedPacketCandidate: (packet) => {
          const nextBody = stripPolicyV1_0CompatibilityFields(
            packet.body as Record<string, unknown>
          );

          if (!nextBody) {
            return null;
          }

          return {
            ...packet,
            body: nextBody,
          } as PacketEnvelopeByType['Policy'];
        },
      },
    },
  },
  Discussion: {
    ...createDefaultCompatibilityEntry('Discussion'),
    support_level: 'legacy_supported',
    write_target_policy: 'supported_versions',
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

function getPacketVersionDefinition<TFamily extends PacketFamily>(
  family: TFamily,
  schemaVersion: string
): PacketSchemaVersionDefinition<TFamily> {
  const versions = PACKET_COMPATIBILITY_REGISTRY[family]
    .versions as Record<string, PacketSchemaVersionDefinition<TFamily>>;
  const versionDefinition = versions[schemaVersion];

  if (!versionDefinition) {
    throw new PacketCompatibilityError({
      code: 'unsupported_schema_version',
      family,
      sourceSchemaVersion: schemaVersion,
      targetSchemaVersion: schemaVersion,
      message: `Unsupported schema version ${schemaVersion} for packet family ${family}.`,
    });
  }

  return versionDefinition;
}

export class PacketCompatibilityError extends Error {
  readonly family: PacketFamily;
  readonly source_schema_version: string;
  readonly target_schema_version: string;
  readonly code:
    | 'unsupported_schema_version'
    | 'missing_adapter_path'
    | 'blocked_write_target';

  constructor(input: {
    code: PacketCompatibilityError['code'];
    family: PacketFamily;
    sourceSchemaVersion: string;
    targetSchemaVersion: string;
    message: string;
  }) {
    super(input.message);
    this.name = 'PacketCompatibilityError';
    this.family = input.family;
    this.source_schema_version = input.sourceSchemaVersion;
    this.target_schema_version = input.targetSchemaVersion;
    this.code = input.code;
  }
}

function resolveEffectiveSourceSchemaVersion<TFamily extends PacketFamily>(input: {
  family: TFamily;
  declaredSchemaVersion: string;
  body: unknown;
}): string {
  const familyEntry = PACKET_COMPATIBILITY_REGISTRY[input.family];

  if (
    !Object.prototype.hasOwnProperty.call(
      familyEntry.versions,
      input.declaredSchemaVersion
    )
  ) {
    return input.declaredSchemaVersion;
  }

  const candidateVersions = Object.keys(familyEntry.versions)
    .filter(
      (schemaVersion) =>
        schemaVersion !== input.declaredSchemaVersion &&
        schemaVersion.localeCompare(input.declaredSchemaVersion) < 0
    )
    .sort((left, right) => right.localeCompare(left));

  for (const schemaVersion of candidateVersions) {
    const versionDefinition = familyEntry.versions[schemaVersion];

    if (versionDefinition?.matchesDeclaredCurrentBodyShape?.(input.body)) {
      return schemaVersion;
    }
  }

  return input.declaredSchemaVersion;
}

type PacketAdaptationPathStep = {
  from_schema_version: string;
  to_schema_version: string;
  direction: Exclude<PacketAdaptationDirection, 'same_version'>;
  apply: (body: unknown) => PacketCompatibilityAdapterOutput;
  parseTargetBody: (body: unknown) => unknown;
};

function resolvePacketAdaptationPath<TFamily extends PacketFamily>(input: {
  family: TFamily;
  sourceSchemaVersion: string;
  targetSchemaVersion: string;
}): PacketAdaptationPathStep[] {
  if (input.sourceSchemaVersion === input.targetSchemaVersion) {
    return [];
  }

  const queue: {
    schemaVersion: string;
    path: PacketAdaptationPathStep[];
  }[] = [
    {
      schemaVersion: input.sourceSchemaVersion,
      path: [],
    },
  ];
  const visited = new Set([input.sourceSchemaVersion]);

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      break;
    }

    const versionDefinition = getPacketVersionDefinition(
      input.family,
      current.schemaVersion
    );
    const nextSteps: PacketAdaptationPathStep[] = [];

    if (versionDefinition.next_schema_version && versionDefinition.adaptToNext) {
      nextSteps.push({
        from_schema_version: current.schemaVersion,
        to_schema_version: versionDefinition.next_schema_version,
        direction: 'upcast',
        apply: versionDefinition.adaptToNext,
        parseTargetBody: (body: unknown) =>
          getPacketVersionDefinition(
            input.family,
            versionDefinition.next_schema_version as string
          ).parseBody(body),
      });
    }

    if (
      versionDefinition.previous_schema_version &&
      versionDefinition.adaptToPrevious
    ) {
      nextSteps.push({
        from_schema_version: current.schemaVersion,
        to_schema_version: versionDefinition.previous_schema_version,
        direction: 'downcast',
        apply: versionDefinition.adaptToPrevious,
        parseTargetBody: (body: unknown) =>
          getPacketVersionDefinition(
            input.family,
            versionDefinition.previous_schema_version as string
          ).parseBody(body),
      });
    }

    for (const step of nextSteps.sort((left, right) =>
      left.to_schema_version.localeCompare(right.to_schema_version)
    )) {
      if (visited.has(step.to_schema_version)) {
        continue;
      }

      const nextPath = [...current.path, step];

      if (step.to_schema_version === input.targetSchemaVersion) {
        return nextPath;
      }

      visited.add(step.to_schema_version);
      queue.push({
        schemaVersion: step.to_schema_version,
        path: nextPath,
      });
    }
  }

  throw new PacketCompatibilityError({
    code: 'missing_adapter_path',
    family: input.family,
    sourceSchemaVersion: input.sourceSchemaVersion,
    targetSchemaVersion: input.targetSchemaVersion,
    message: `Missing adapter path from schema version ${input.sourceSchemaVersion} to ${input.targetSchemaVersion} for packet family ${input.family}.`,
  });
}

function adaptPacketBodyToTarget<TFamily extends PacketFamily>(input: {
  family: TFamily;
  schemaVersion: string;
  targetSchemaVersion: string;
  body: unknown;
}): {
  body: PacketBodyByType[TFamily];
  changes: PacketAdaptationChange[];
  losses: PacketAdaptationLoss[];
  effectiveSourceSchemaVersion: string;
  direction: PacketAdaptationDirection;
} {
  const effectiveSourceSchemaVersion = resolveEffectiveSourceSchemaVersion({
    family: input.family,
    declaredSchemaVersion: input.schemaVersion,
    body: input.body,
  });
  let currentSchemaVersion = effectiveSourceSchemaVersion;
  let currentBody = getPacketVersionDefinition(
    input.family,
    currentSchemaVersion
  ).parseBody(input.body);
  const changes: PacketAdaptationChange[] = [];
  const losses: PacketAdaptationLoss[] = [];
  const path = resolvePacketAdaptationPath({
    family: input.family,
    sourceSchemaVersion: effectiveSourceSchemaVersion,
    targetSchemaVersion: input.targetSchemaVersion,
  });

  for (const step of path) {
    const adapted = step.apply(currentBody);
    changes.push(...adapted.changes);
    losses.push(...(adapted.losses ?? []));
    currentSchemaVersion = step.to_schema_version;
    currentBody = step.parseTargetBody(adapted.body);
  }

  return {
    body: currentBody as PacketBodyByType[TFamily],
    changes,
    losses,
    effectiveSourceSchemaVersion,
    direction:
      effectiveSourceSchemaVersion === input.targetSchemaVersion
        ? 'same_version'
        : path[0]?.direction ?? 'same_version',
  };
}

export function parseRawPacketEnvelopeInput(
  input: unknown
): RawPacketEnvelopeInput {
  return RawPacketEnvelopeInputSchema.parse(input) as RawPacketEnvelopeInput;
}

export function inspectPacketEnvelope(input: unknown): PacketCompatibilityReadResult {
  return inspectPacketEnvelopeForTarget(input);
}

export function inspectPacketEnvelopeForTarget(
  input: unknown,
  options: {
    target_schema_version?: string;
  } = {}
): PacketCompatibilityReadResult {
  const rawEnvelope = parseRawPacketEnvelopeInput(input);
  const declaredSchemaVersion =
    rawEnvelope.header.schema_version ?? DEFAULT_SCHEMA_VERSION;
  const familyEntry = PACKET_COMPATIBILITY_REGISTRY[rawEnvelope.header.family];
  const targetSchemaVersion =
    options.target_schema_version ?? familyEntry.current_schema_version;

  if (
    !Object.prototype.hasOwnProperty.call(
      familyEntry.versions,
      targetSchemaVersion
    )
  ) {
    throw new PacketCompatibilityError({
      code: 'unsupported_schema_version',
      family: rawEnvelope.header.family,
      sourceSchemaVersion: declaredSchemaVersion,
      targetSchemaVersion,
      message: `Unsupported target schema version ${targetSchemaVersion} for packet family ${rawEnvelope.header.family}.`,
    });
  }

  const adaptedHeader = PacketHeaderSchema.parse({
    ...rawEnvelope.header,
    schema_version: targetSchemaVersion,
  });
  const adaptedBody = adaptPacketBodyToTarget({
    family: rawEnvelope.header.family,
    schemaVersion: declaredSchemaVersion,
    targetSchemaVersion,
    body: rawEnvelope.body,
  });
  const interpretedAsLegacyProfile =
    adaptedBody.effectiveSourceSchemaVersion !== declaredSchemaVersion;
  const isExact =
    !interpretedAsLegacyProfile &&
    adaptedBody.losses.length === 0 &&
    adaptedBody.changes.length === 0;
  const writableAsIs =
    isExact && adaptedBody.effectiveSourceSchemaVersion === targetSchemaVersion;
  const supportedWriteTarget: PacketWriteTargetSupport =
    targetSchemaVersion !== familyEntry.current_schema_version &&
    familyEntry.write_target_policy !== 'supported_versions'
      ? 'blocked'
      : adaptedBody.losses.length > 0
        ? 'lossy_allowed'
        : 'exact';

  return {
    raw_packet: input,
    adapted_packet: {
      header: adaptedHeader,
      body: adaptedBody.body,
    } as PacketEnvelope,
    status: {
      family: rawEnvelope.header.family,
      declared_schema_version: declaredSchemaVersion,
      effective_source_schema_version: adaptedBody.effectiveSourceSchemaVersion,
      interpreted_as_legacy_profile: interpretedAsLegacyProfile,
      source_schema_version: adaptedBody.effectiveSourceSchemaVersion,
      target_schema_version: targetSchemaVersion,
      direction: adaptedBody.direction,
      changes: adaptedBody.changes,
      losses: adaptedBody.losses,
      is_lossy: adaptedBody.losses.length > 0,
      is_exact: isExact,
      writable_as_is: writableAsIs,
      requires_guarded_upgrade:
        supportedWriteTarget !== 'blocked' &&
        targetSchemaVersion === familyEntry.current_schema_version &&
        !writableAsIs,
      requires_loss_acknowledgement:
        supportedWriteTarget === 'lossy_allowed',
      supported_write_target: supportedWriteTarget,
    },
  };
}

export function getPacketSignatureCanonicalCandidates(
  packet: PacketEnvelope
): PacketEnvelope[] {
  return getPacketSignatureCanonicalCandidateDetails(packet).map(
    (candidate) => candidate.packet
  );
}

export function getPacketSignatureCanonicalCandidateDetails(
  packet: PacketEnvelope
): PacketSignatureCanonicalCandidate<PacketEnvelope>[] {
  const sourceSchemaVersion = packet.header.schema_version ?? DEFAULT_SCHEMA_VERSION;
  const versionDefinition = getPacketVersionDefinition(
    packet.header.family,
    sourceSchemaVersion
  );
  const candidates: PacketSignatureCanonicalCandidate<PacketEnvelope>[] = [
    {
      packet,
      source: 'exact',
    },
  ];
  const compatibilityCandidate = versionDefinition.createUnsignedPacketCandidate?.(
    packet as PacketEnvelopeByType[PacketFamily]
  );

  if (compatibilityCandidate) {
    const currentCanonicalPacket = JSON.stringify(packet);
    const compatibilityCanonicalPacket = JSON.stringify(compatibilityCandidate);

    if (compatibilityCanonicalPacket !== currentCanonicalPacket) {
      candidates.push({
        packet: compatibilityCandidate as PacketEnvelope,
        source: 'family_compatibility',
      });
    }
  }

  return candidates;
}

function createRawHeaderCompatibilityCandidate(
  packet: RawPacketEnvelopeInput
): RawPacketEnvelopeInput | null {
  const metadata = packet.header.metadata;

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const metadataRecord = metadata as Record<string, unknown>;

  if (
    !Object.prototype.hasOwnProperty.call(metadataRecord, 'compatibility') ||
    metadataRecord.compatibility !== null
  ) {
    return null;
  }

  const { compatibility: _compatibility, ...nextMetadata } = metadataRecord;
  const nextHeader = {
    ...packet.header,
  } as RawPacketHeaderInput & Record<string, unknown>;

  if (Object.keys(nextMetadata).length > 0) {
    nextHeader.metadata = nextMetadata;
  } else {
    delete nextHeader.metadata;
  }

  return {
    ...packet,
    header: nextHeader,
  };
}

function createRawFamilyCompatibilityBodyCandidate(
  packet: RawPacketEnvelopeInput
): unknown | null {
  try {
    const adaptedPacket = inspectPacketEnvelope(packet).adapted_packet;
    const sourceSchemaVersion =
      packet.header.schema_version ?? DEFAULT_SCHEMA_VERSION;
    const versionDefinition = getPacketVersionDefinition(
      packet.header.family,
      sourceSchemaVersion
    );
    const compatibilityCandidate = versionDefinition.createUnsignedPacketCandidate?.(
      adaptedPacket as PacketEnvelopeByType[PacketFamily]
    );

    return compatibilityCandidate?.body ?? null;
  } catch {
    return null;
  }
}

export function getRawPacketSignatureCanonicalCandidates(
  packetInput: unknown
): RawPacketEnvelopeInput[] {
  return getRawPacketSignatureCanonicalCandidateDetails(packetInput).map(
    (candidate) => candidate.packet
  );
}

export function getRawPacketSignatureCanonicalCandidateDetails(
  packetInput: unknown
): PacketSignatureCanonicalCandidate<RawPacketEnvelopeInput>[] {
  // Signature verification must start from the stored/request raw envelope.
  // Adapted packets are runtime read views, while raw packets are the
  // historical signed fact that may omit later additive defaults.
  const packet = parseRawPacketEnvelopeInput(packetInput);
  const candidates: PacketSignatureCanonicalCandidate<RawPacketEnvelopeInput>[] = [];
  const seenPackets = new Set<string>();
  const pushCandidate = (
    candidatePacket: RawPacketEnvelopeInput,
    source: PacketSignatureCandidateSource
  ) => {
    const serializedCandidate = JSON.stringify(candidatePacket);

    if (seenPackets.has(serializedCandidate)) {
      return;
    }

    seenPackets.add(serializedCandidate);
    candidates.push({
      packet: candidatePacket,
      source,
    });
  };

  pushCandidate(packet, 'exact');

  const headerCompatibilityCandidate =
    createRawHeaderCompatibilityCandidate(packet);

  if (headerCompatibilityCandidate) {
    pushCandidate(headerCompatibilityCandidate, 'header_compatibility');
  }

  const familyCompatibilityBody =
    createRawFamilyCompatibilityBodyCandidate(packet);

  if (familyCompatibilityBody) {
    pushCandidate(
      {
        ...packet,
        body: familyCompatibilityBody,
      },
      'family_compatibility'
    );

    if (headerCompatibilityCandidate) {
      pushCandidate(
        {
          ...headerCompatibilityCandidate,
          body: familyCompatibilityBody,
        },
        'combined_compatibility'
      );
    }
  }

  return candidates;
}

// Migration checklist for additive/defaulted fields on signed packet families:
// add the compatibility adapter, add a raw signature candidate rule when old
// signed packets may omit the field, prove old packets still verify, prove
// semantic tampering still fails, and keep next revisions unsigned until the
// final signing step.

export function preparePacketEnvelopeForAdaptedWrite(
  input: unknown
): PacketAdaptedWritePreparation {
  return preparePacketEnvelopeForVersionedWrite(input);
}

export function preparePacketEnvelopeForVersionedWrite(
  input: unknown,
  options: {
    target_schema_version?: string;
  } = {}
): PacketVersionedWritePreparation {
  const inspected = inspectPacketEnvelopeForTarget(input, options);
  const sourceSchemaVersion = inspected.status.source_schema_version;
  const declaredSchemaVersion = inspected.status.declared_schema_version;
  const needsSchemaVersionBump =
    declaredSchemaVersion !== inspected.status.target_schema_version;

  if (inspected.status.supported_write_target === 'blocked') {
    return {
      raw_packet: inspected.raw_packet,
      adapted_packet: inspected.adapted_packet,
      prepared_packet: null,
      declared_schema_version: declaredSchemaVersion,
      effective_source_schema_version:
        inspected.status.effective_source_schema_version,
      interpreted_as_legacy_profile:
        inspected.status.interpreted_as_legacy_profile,
      source_schema_version: sourceSchemaVersion,
      target_schema_version: inspected.status.target_schema_version,
      direction: inspected.status.direction,
      changes: inspected.status.changes,
      losses: inspected.status.losses,
      is_lossy: inspected.status.is_lossy,
      is_exact: inspected.status.is_exact,
      writable_as_is: inspected.status.writable_as_is,
      requires_guarded_upgrade: false,
      requires_loss_acknowledgement: false,
      supported_write_target: inspected.status.supported_write_target,
    };
  }

  const preparedPacket =
    inspected.status.writable_as_is &&
    inspected.adapted_packet.header.schema_version ===
      inspected.status.target_schema_version
      ? inspected.adapted_packet
      : ({
          ...inspected.adapted_packet,
          header: {
            ...inspected.adapted_packet.header,
            schema_version: inspected.status.target_schema_version,
          },
        } as PacketEnvelope);
  const changes = inspected.status.writable_as_is
    ? inspected.status.changes
    : [
        ...inspected.status.changes,
        ...(needsSchemaVersionBump
          ? [
              createAdaptationChange({
                kind: 'schema_version_bump',
                path: 'header.schema_version',
                fromSchemaVersion: declaredSchemaVersion,
                toSchemaVersion: inspected.status.target_schema_version,
                message: `Prepared packet for write against schema version ${inspected.status.target_schema_version}.`,
              }),
            ]
          : []),
      ];

  return {
    raw_packet: inspected.raw_packet,
    adapted_packet: inspected.adapted_packet,
    prepared_packet: preparedPacket,
    declared_schema_version: inspected.status.declared_schema_version,
    effective_source_schema_version:
      inspected.status.effective_source_schema_version,
    interpreted_as_legacy_profile:
      inspected.status.interpreted_as_legacy_profile,
    source_schema_version: inspected.status.source_schema_version,
    target_schema_version: inspected.status.target_schema_version,
    direction: inspected.status.direction,
    changes,
    losses: inspected.status.losses,
    is_lossy: inspected.status.is_lossy,
    is_exact: inspected.status.is_exact,
    writable_as_is: inspected.status.writable_as_is,
    requires_guarded_upgrade: inspected.status.requires_guarded_upgrade,
    requires_loss_acknowledgement:
      inspected.status.requires_loss_acknowledgement,
    supported_write_target: inspected.status.supported_write_target,
  };
}

export function describePacketCompatibility(
  family: PacketFamily,
  schemaVersion: string
): {
  family: PacketFamily;
  schema_version: string;
  current_schema_version: string;
  revision_mode: PacketRevisionMode;
  write_target_policy: PacketWriteTargetPolicy;
  is_supported: boolean;
  is_current: boolean;
} {
  const familyEntry = PACKET_COMPATIBILITY_REGISTRY[family];

  return {
    family,
    schema_version: schemaVersion,
    current_schema_version: familyEntry.current_schema_version,
    revision_mode: familyEntry.revision_mode,
    write_target_policy: familyEntry.write_target_policy,
    is_supported:
      Object.prototype.hasOwnProperty.call(familyEntry.versions, schemaVersion),
    is_current: schemaVersion === familyEntry.current_schema_version,
  };
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

export function getPacketCompatibilityAuditSummary(
  family: PacketFamily
): PacketCompatibilityAuditSummary {
  const familyEntry = PACKET_COMPATIBILITY_REGISTRY[family];
  const supportedSchemaVersions = Object.keys(familyEntry.versions).sort();

  return {
    family,
    current_schema_version: familyEntry.current_schema_version,
    revision_mode: familyEntry.revision_mode,
    support_level: familyEntry.support_level,
    write_target_policy: familyEntry.write_target_policy,
    supported_schema_versions: supportedSchemaVersions,
    has_legacy_versions: supportedSchemaVersions.some(
      (schemaVersion) => schemaVersion !== familyEntry.current_schema_version
    ),
    has_write_preparation: Object.values(familyEntry.versions).some(
      (versionDefinition) =>
        typeof versionDefinition.createUnsignedPacketCandidate === 'function'
    ),
  };
}

export function listPacketCompatibilityAuditSummaries(): PacketCompatibilityAuditSummary[] {
  return PACKET_FAMILIES.map((family) => getPacketCompatibilityAuditSummary(family));
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
  return parsePacketBodyForTarget(family, body, {
    schema_version: schemaVersion,
  });
}

export function parsePacketBodyForTarget<TFamily extends PacketFamily>(
  family: TFamily,
  body: unknown,
  options: {
    schema_version?: string;
    target_schema_version?: string;
  } = {}
): PacketBodyByType[TFamily] {
  return adaptPacketBodyToTarget({
    family,
    schemaVersion: options.schema_version ?? DEFAULT_SCHEMA_VERSION,
    targetSchemaVersion:
      options.target_schema_version ?? getPacketCurrentSchemaVersion(family),
    body,
  }).body;
}

export function parsePacketEnvelope(input: unknown): PacketEnvelope {
  return inspectPacketEnvelope(input).adapted_packet;
}

export function parsePacketEnvelopeForTarget(
  input: unknown,
  options: {
    target_schema_version?: string;
  } = {}
): PacketEnvelope {
  return inspectPacketEnvelopeForTarget(input, options).adapted_packet;
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
