/**
 * File: packet-body-schemas.ts
 * Description: Declares canonical packet header/body schemas and envelope/body type maps.
 */

import { z } from 'zod';

import { WRITE_PROOF_LEVELS } from '@core/auth/proof-types';
import type { PacketType } from '@core/schema/packet-ontology';
import { DefinitionBodySchema } from '@core/packets/definitions/definition.ts';
import {
  AttestationStatusSchema,
  AttestationValueSchema,
  ClaimStatusSchema,
  DEFAULT_PROTOCOL_VERSION,
  DEFAULT_SCHEMA_VERSION,
  DiscussionActorClassSchema,
  DiscussionSubtypeSchema,
  DiscussionSortSchema,
  ElementSubtypeSchema,
  LocalityLevelSchema,
  PacketTypeSchema,
  PacketMergeStrategySchema,
  RelationClaimTargetModeSchema,
  RelationStatusSchema,
  RelationSubjectMatchModeSchema,
  TrustStageSchema,
} from '@core/schema/packet-ontology';

export { DefinitionBodySchema } from '@core/packets/definitions/definition.ts';

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
        type_history: z
          .array(
            z
              .object({
                type: z.string().min(1),
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
                type: z.string().min(1),
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
            allow_guarded_definition_write: z.boolean().default(false),
            requires_loss_acknowledgement: z.boolean().default(false),
          })
          .strict()
          .default({
            allow_virtual_downcast: true,
            allow_guarded_definition_write: false,
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
    type: PacketTypeSchema,
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

export const ElementBodySchema = z
  .object({
    subtype: ElementSubtypeSchema,
    name: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
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
    subtype: z.string().min(1).default('role'),
    status: z.string().min(1),
    responsibility_markdown: z.string().min(1).nullable().default(null),
  })
  .strict();

export const ClaimBodySchema = z
  .object({
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
    note: z.string().min(1).nullable().default(null),
  })
  .strict();

export const RelationBodySchema = z
  .object({
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

export const ProposalBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    subtype: z.string().min(1).default('proposal'),
    status: z.string().min(1),
    decision_scope_refs: z.array(PacketRefSchema).default([]),
    related_policy_refs: z.array(PacketRefSchema).default([]),
  })
  .strict();

export const VoteBodySchema = z
  .object({
    subtype: z.string().min(1).default('vote'),
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
    subtype: z.string().min(1).default('packet_signal'),
    target_ref: PacketRefSchema,
    value: AttestationValueSchema,
    status: AttestationStatusSchema.default('active'),
    context_ref: PacketRefSchema.nullable().default(null),
    supporting_refs: z.array(PacketRefSchema).default([]),
    note: z.string().min(1).nullable().default(null),
    supersedes_ref: PacketRefSchema.nullable().default(null),
  })
  .strict();

export const DecisionBodySchema = z
  .object({
    subtype: z.string().min(1).default('decision'),
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    outcome: z.string().min(1),
    proposal_ref: PacketRefSchema.nullable().optional(),
    vote_ref: PacketRefSchema.nullable().optional(),
  })
  .strict();

export const ActionBodySchema = z
  .object({
    subtype: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    status: z.string().min(1),
    objective_markdown: z.string().min(1).nullable().default(null),
    location_refs: z.array(PacketRefSchema).default([]),
    action_refs: z.array(PacketRefSchema).default([]),
    parent_action_ref: PacketRefSchema.nullable().default(null),
    child_action_refs: z.array(PacketRefSchema).default([]),
    policy_refs: z.array(PacketRefSchema).default([]),
    template_refs: z.array(PacketRefSchema).default([]),
    default_packet_set_refs: z.array(PacketRefSchema).default([]),
  })
  .strict();

export const ReportBodySchema = z
  .object({
    subtype: z.enum(['verification_report', 'import_report', 'decision_report']),
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

export const PolicyBodySchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    subtype: z.string().min(1),
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
        required_action_refs: z.array(PacketRefSchema).default([]),
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
    default_policy: z
      .object({
        policy_refs: z.array(PacketRefSchema).default([]),
        template_refs: z.array(PacketRefSchema).default([]),
        default_packet_set_refs: z.array(PacketRefSchema).default([]),
        preference_refs: z.array(PacketRefSchema).default([]),
      })
      .strict()
      .nullable()
      .default(null),
    governance_policy: z
      .object({
        minimum_trust_stage: TrustStageSchema.default('recognized'),
        voter_eligibility: z
          .object({
            eligible_scope_refs: z.array(PacketRefSchema).default([]),
            eligible_role_refs: z.array(PacketRefSchema).default([]),
          })
          .strict()
          .default({
            eligible_scope_refs: [],
            eligible_role_refs: [],
          }),
        quorum_rule: z
          .object({
            quorum_kind: z
              .enum(['none', 'fixed_count', 'eligible_actor_percent'])
              .default('none'),
            minimum_count: z.number().int().nonnegative().nullable().default(null),
            percentage: z.number().min(0).max(1).nullable().default(null),
          })
          .strict()
          .default({
            quorum_kind: 'none',
            minimum_count: null,
            percentage: null,
          }),
        approval_threshold: z
          .object({
            threshold_kind: z
              .enum(['simple_majority', 'supermajority_percent', 'unanimity'])
              .default('simple_majority'),
            percentage: z.number().min(0).max(1).nullable().default(null),
          })
          .strict()
          .default({
            threshold_kind: 'simple_majority',
            percentage: null,
          }),
        vote_method: z.string().min(1).default('simple_majority'),
        decision_report_required: z.boolean().default(true),
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

export const ElementPreferenceBodySchema = PreferenceBaseBodySchema.extend({
  subtype: z.literal('element'),
  value: ElementPreferenceValueSchema,
}).strict();

export const PreferenceBodySchema = ElementPreferenceBodySchema;

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
    subtype: DiscussionSubtypeSchema,
    role: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1).nullable().optional(),
    status: z.string().min(1).default('open'),
  })
  .strict();

export const DiscussionBodySchema = z.discriminatedUnion('subtype', [
  DiscussionBaseBodySchema.extend({
    subtype: z.literal('space'),
    scope_ref: PacketRefSchema,
  }).strict(),
  DiscussionBaseBodySchema.extend({
    subtype: z.literal('forum'),
    parent_ref: PacketRefSchema,
    participation_rules: DiscussionParticipationRulesSchema,
    default_sort: DiscussionSortSchema.default('new'),
  }).strict(),
  DiscussionBaseBodySchema.extend({
    subtype: z.literal('topic'),
    parent_ref: PacketRefSchema,
    related_refs: z.array(PacketRefSchema).default([]),
    participation_rules: DiscussionParticipationRulesSchema,
    default_sort: DiscussionSortSchema.default('new'),
  }).strict(),
  DiscussionBaseBodySchema.extend({
    subtype: z.literal('post'),
    parent_ref: PacketRefSchema,
    related_refs: z.array(PacketRefSchema).default([]),
    participation_rules: DiscussionParticipationRulesSchema,
    default_sort: DiscussionSortSchema.default('new'),
    content_markdown: z.string().min(1).nullable().default(null),
    attachment_refs: z.array(PacketRefSchema).default([]),
  }).strict(),
  DiscussionBaseBodySchema.extend({
    subtype: z.literal('message'),
    parent_ref: PacketRefSchema,
    topic_ref: PacketRefSchema,
    root_message_ref: PacketRefSchema.nullable().default(null),
    content_markdown: z.string().min(1),
  }).strict(),
]);

export const BUNDLE_PACKET_SUBTYPES = ['packet_set', 'export', 'sync', 'archive'] as const;

export const BundleItemSchema = z
  .object({
    item_role: z.enum(['root', 'dependency', 'reference', 'definition_part', 'fixture']),
    packet_ref: PacketRefSchema.nullable().default(null),
    revision_ref: PacketRevisionRefSchema.nullable().default(null),
    packet_type: z.string().min(1).nullable().default(null),
    packet_subtype: z.string().min(1).nullable().default(null),
    schema_version: z.string().min(1).nullable().default(null),
    digest: z.string().min(1).nullable().default(null),
    required: z.boolean().default(true),
    notes: z.string().min(1).nullable().default(null),
  })
  .strict();

export const BundleBodySchema = z
  .object({
    subtype: z.enum(BUNDLE_PACKET_SUBTYPES),
    title: z.string().min(1),
    summary: z.string().min(1).nullable().default(null),
    status: z.enum(['active', 'superseded', 'withdrawn']).default('active'),
    bundle_version: z.string().min(1).default('0.1.0'),
    purpose: z.string().min(1),
    root_refs: z.array(PacketRefSchema).default([]),
    items: z.array(BundleItemSchema).default([]),
    manifest_digest: z.string().min(1).nullable().default(null),
    bundle_data: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const PACKET_BODY_SCHEMAS = {
  Definition: DefinitionBodySchema,
  Element: ElementBodySchema,
  Location: LocationBodySchema,
  Role: RoleBodySchema,
  Claim: ClaimBodySchema,
  Relation: RelationBodySchema,
  Report: ReportBodySchema,
  Proposal: ProposalBodySchema,
  Vote: VoteBodySchema,
  Attestation: AttestationBodySchema,
  Decision: DecisionBodySchema,
  Action: ActionBodySchema,
  Policy: PolicyBodySchema,
  Preference: PreferenceBodySchema,
  Discussion: DiscussionBodySchema,
  Bundle: BundleBodySchema,
} satisfies Record<PacketType, z.ZodTypeAny>;

export type PacketRef = z.infer<typeof PacketRefSchema>;
export type PacketRevisionRef = z.infer<typeof PacketRevisionRefSchema>;
export type PacketEdge = z.infer<typeof PacketEdgeSchema>;
export type PacketHeader = z.infer<typeof PacketHeaderSchema>;
export type PacketBodyByType = {
  [TType in PacketType]: z.infer<(typeof PACKET_BODY_SCHEMAS)[TType]>;
};

export type PacketEnvelopeByType = {
  [TType in PacketType]: {
    header: PacketHeader & { type: TType };
    body: PacketBodyByType[TType];
  };
};

export type PacketEnvelope = PacketEnvelopeByType[PacketType];

export function getPacketBodySchema<TType extends PacketType>(
  type: TType
): (typeof PACKET_BODY_SCHEMAS)[TType] {
  return PACKET_BODY_SCHEMAS[type];
}
