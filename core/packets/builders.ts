/**
 * File: builders.ts
 * Description: Provides typed helpers for constructing canonical packet envelopes for seeds, fixtures, and adapters.
 */

import type { z } from 'zod';

import {
  createInitialRevisionId,
  createPacketEdge,
  createTextExcerpt,
} from '@core/packets/packet-build-helpers';
import { buildPacket } from '@core/packets/packet-build-pipeline';
import {
  PACKET_BODY_SCHEMAS,
  createPacketEnvelope,
  type CanonicalReactionSubtype,
  type CanonicalClaimSubtype,
  type CanonicalRelationSubtype,
  getPacketCurrentSchemaVersion,
  type PacketBodyByType,
  type ClaimKind,
  type DiscussionActorClass,
  type DiscussionSubtype,
  type DiscussionSort,
  type ElementSubtype,
  type RelationStatus,
  type RelationSubscriptionOptionsInput,
  type PersonClaimStatus,
    type PacketEdge,
  type PacketEnvelopeByType,
  type PacketType,
  type PacketHeader,
  type PacketMergeStrategy,
  type TrustStage,
  type PacketRef,
  type PacketRevisionRef,
  type ReactionAttestationValue,
  type ReactionEmojiKey,
  type ReactionVoteValue,
  type LocalityLevel,
} from '@core/schema/packet-schema';

export {
  createInitialRevisionId,
  createPacketEdge,
  createPacketRef,
  createPacketRevisionRef,
  createTextExcerpt,
} from '@core/packets/packet-build-helpers';

type PacketVisibility = PacketHeader['moderation']['visibility'];
type PacketModerationState = PacketHeader['moderation']['moderation_state'];
type PacketLanguage = PacketHeader['metadata']['language'];
type PacketCompatibilityMetadata = PacketHeader['metadata']['compatibility'];
type PacketExternalRef = PacketHeader['external_refs'][number];

export interface PacketBuilderBaseInput {
  packet_id: string;
  revision_id?: string;
  schema_version?: string;
  protocol_version?: string;
  created_at?: string;
  parent_revision_refs?: PacketRevisionRef[];
  merge_strategy?: PacketMergeStrategy | null;
  authority_scope_ref?: PacketRef | null;
  applicable_scope_refs?: PacketRef[];
  edges?: PacketEdge[];
  created_by?: PacketRef | null;
  submitted_by?: PacketRef | null;
  recorded_at?: string | null;
  adapter?: string;
  app_version?: string | null;
  visibility?: PacketVisibility;
  moderation_state?: PacketModerationState;
  policy_refs?: PacketRef[];
  content_warning_ids?: string[];
  external_refs?: PacketExternalRef[];
  metadata_tags?: string[];
  metadata_language?: PacketLanguage;
  metadata_summary?: string | null;
  metadata_compatibility?: PacketCompatibilityMetadata;
}

export interface PacketBuilderInput<TType extends PacketType>
  extends PacketBuilderBaseInput {
  type: TType;
  body: z.input<(typeof PACKET_BODY_SCHEMAS)[TType]>;
}

export interface ElementPacketInput extends PacketBuilderBaseInput {
  subtype: ElementSubtype | string;
  name: string;
  summary?: string | null;
  scope_system?: string | null;
  status?: string | null;
  aliases?: string[];
  display_aliases?: string[];
  locality_label?: string | null;
  locality?: {
    level: LocalityLevel;
    canonical_name_key: string;
    alias_keys?: string[];
    display_aliases?: string[];
  } | null;
  identity?: {
    alias: string;
    claim_status: PersonClaimStatus;
    location_disclosure?: {
      scope: string;
      value: string;
    } | null;
    public_key_bindings?: {
      kid: string;
      alg: string;
      kty: string;
      crv?: string | null;
      public_jwk: Record<string, unknown>;
      status?: 'active' | 'revoked';
      added_at: string;
      revoked_at?: string | null;
    }[];
  } | null;
  custody_hints?: Record<string, unknown> | null;
  tags?: string[];
  claimed_role_refs?: PacketRef[];
}

export interface DefinitionPacketInput extends PacketBuilderBaseInput {
  body: z.input<(typeof PACKET_BODY_SCHEMAS)['Definition']>;
}

export interface LocationPacketInput extends PacketBuilderBaseInput {
  subtype: string;
  title: string;
  summary?: string | null;
  status?: string;
  location_label?: string | null;
  descriptor_markdown?: string | null;
  spatial_payload?: Record<string, unknown>;
}

export interface RolePacketInput extends PacketBuilderBaseInput {
  title: string;
  summary?: string | null;
  subtype: string;
  status: string;
  responsibility_markdown?: string | null;
}

export interface ClaimPacketInput extends PacketBuilderBaseInput {
  subtype?: CanonicalClaimSubtype | string | null;
  target_ref: PacketRef;
  subject_ref?: PacketRef | null;
  scope_ref?: PacketRef | null;
  status?: 'active' | 'withdrawn';
  claim_markdown?: string | null;
  supporting_refs?: PacketRef[];
  relation_assertion?: {
    subtype: CanonicalRelationSubtype | ClaimKind | string;
    subject_ref: PacketRef;
    target_ref: PacketRef;
    scope_ref?: PacketRef | null;
  } | null;
  note?: string | null;
}

export interface RelationPacketInput extends PacketBuilderBaseInput {
  subtype: string;
  subject_ref: PacketRef;
  target_ref: PacketRef;
  scope_ref?: PacketRef | null;
  status?: RelationStatus;
  policy_ref?: PacketRef | null;
  terms_ref?: PacketRef | null;
  supporting_refs?: PacketRef[];
  note?: string | null;
  effective_from?: string | null;
  effective_until?: string | null;
  subscription_options?: RelationSubscriptionOptionsInput | null;
}

export interface ReportPacketInput extends PacketBuilderBaseInput {
  subtype: 'verification_report' | 'import_report' | 'decision_report';
  status?: 'active' | 'superseded';
  target_ref?: PacketRef | null;
  scope_ref?: PacketRef | null;
  summary_markdown?: string | null;
  report_markdown: string;
  supporting_refs?: PacketRef[];
  supersedes_ref?: PacketRef | null;
  report_data?: Record<string, unknown>;
}

export interface DiscussionThreadPacketInput extends PacketBuilderBaseInput {
  title: string;
  summary?: string | null;
  forum_ref: PacketRef;
  thread_kind: string;
  status?: string;
  related_refs?: PacketRef[];
  participation_rules?: {
    top_level_actor_classes?: DiscussionActorClass[];
    reply_actor_classes?: DiscussionActorClass[];
    reaction_actor_classes?: DiscussionActorClass[];
    top_level_post_cost?: number;
  };
  default_sort?: DiscussionSort;
}

export interface DiscussionSpacePacketInput extends PacketBuilderBaseInput {
  title: string;
  summary?: string | null;
  scope_ref: PacketRef;
  status?: string;
}

export interface DiscussionForumPacketInput extends PacketBuilderBaseInput {
  title: string;
  summary?: string | null;
  discussion_space_ref: PacketRef;
  forum_kind: string;
  status?: string;
  participation_rules?: {
    top_level_actor_classes?: DiscussionActorClass[];
    reply_actor_classes?: DiscussionActorClass[];
    reaction_actor_classes?: DiscussionActorClass[];
    top_level_post_cost?: number;
  };
  default_sort?: DiscussionSort;
}

export interface DiscussionPostPacketInput extends PacketBuilderBaseInput {
  title: string;
  thread_ref: PacketRef;
  post_kind?: string;
  content_markdown: string;
  reply_to_ref?: PacketRef | null;
  reference_refs?: PacketRef[];
}

export interface DiscussionReplyPacketInput extends PacketBuilderBaseInput {
  title: string;
  thread_ref: PacketRef;
  root_post_ref: PacketRef;
  reply_to_ref: PacketRef;
  content_markdown: string;
}

export interface DiscussionPacketInput extends PacketBuilderBaseInput {
  subtype: DiscussionSubtype;
  role: string;
  title: string;
  summary?: string | null;
  status?: string;
  scope_ref?: PacketRef;
  parent_ref?: PacketRef;
  topic_ref?: PacketRef;
  root_message_ref?: PacketRef | null;
  related_refs?: PacketRef[];
  participation_rules?: {
    top_level_actor_classes?: DiscussionActorClass[];
    reply_actor_classes?: DiscussionActorClass[];
    reaction_actor_classes?: DiscussionActorClass[];
    top_level_post_cost?: number;
  };
  default_sort?: DiscussionSort;
  content_markdown?: string | null;
  attachment_refs?: PacketRef[];
}

export interface ProposalPacketInput extends PacketBuilderBaseInput {
  title: string;
  summary?: string | null;
  subtype: string;
  status: string;
  decision_scope_refs?: PacketRef[];
  related_policy_refs?: PacketRef[];
}

export interface PolicyPacketInput extends PacketBuilderBaseInput {
  title: string;
  summary?: string | null;
  subtype: string;
  body_markdown: string;
  status: string;
  trust_policy?: {
    association_support_threshold?: number;
    role_participation_support_threshold?: number;
    posting_gate?: TrustStage;
    voting_gate?: TrustStage;
    review_gate?: TrustStage;
  } | null;
  write_policy?: PacketBodyByType['Policy']['write_policy'];
  dependencies_policy?: PacketBodyByType['Policy']['dependencies_policy'];
  alignment_policy?: PacketBodyByType['Policy']['alignment_policy'];
  relation_requirements?: PacketBodyByType['Policy']['relation_requirements'];
  default_policy?: {
    policy_refs?: PacketRef[];
    template_refs?: PacketRef[];
    defaults_definition_refs?: PacketRef[];
    default_packet_set_refs?: PacketRef[];
    preference_refs?: PacketRef[];
    overrides?: {
      path: string;
      value: unknown;
      reason?: string | null;
    }[];
  } | null;
  governance_policy?: PacketBodyByType['Policy']['governance_policy'];
}

export interface PreferencePacketInput extends PacketBuilderBaseInput {
  body: z.input<(typeof PACKET_BODY_SCHEMAS)['Preference']>;
}

export interface DecisionPacketInput extends PacketBuilderBaseInput {
  title: string;
  summary?: string | null;
  outcome: string;
  proposal_ref?: PacketRef | null;
  vote_ref?: PacketRef | null;
}

export interface ActionPacketInput extends PacketBuilderBaseInput {
  subtype: string;
  title: string;
  summary?: string | null;
  status: string;
  objective_markdown?: string | null;
  location_refs?: PacketRef[];
  action_refs?: PacketRef[];
  parent_action_ref?: PacketRef | null;
  child_action_refs?: PacketRef[];
  policy_refs?: PacketRef[];
  template_refs?: PacketRef[];
  default_packet_set_refs?: PacketRef[];
}

export interface ReactionPacketInput extends PacketBuilderBaseInput {
  subtype?: CanonicalReactionSubtype | string | null;
  target_ref: PacketRef;
  status?: 'active' | 'cleared';
  vote_value?: ReactionVoteValue | null;
  attestation_value?: ReactionAttestationValue | null;
  emoji_keys?: ReactionEmojiKey[];
  context_ref?: PacketRef | null;
  supporting_refs?: PacketRef[];
  note?: string | null;
  supersedes_ref?: PacketRef | null;
}

export interface BundlePacketInput extends PacketBuilderBaseInput {
  body: z.input<(typeof PACKET_BODY_SCHEMAS)['Bundle']>;
}

const DEFAULT_CREATED_AT = '2026-04-08T00:00:00.000Z';
const DEFAULT_ADAPTER = 'seed';

/**
 * Inputs: a list of edges that may contain duplicates.
 * Output: the same edge list with duplicate semantic edge tuples removed.
 */
function dedupeEdges(edges: PacketEdge[]): PacketEdge[] {
  const seen = new Set<string>();

  return edges.filter((edge) => {
    const key = JSON.stringify([edge.edge_type, edge.target.packet_id]);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/**
 * Inputs: generic builder input for any supported packet type.
 * Output: a validated canonical packet envelope with shared header defaults applied.
 */
export function createPacket<TType extends PacketType>(
  input: PacketBuilderInput<TType>
): PacketEnvelopeByType[TType] {
  const createdAt = input.created_at ?? DEFAULT_CREATED_AT;
  const adapter = input.adapter ?? DEFAULT_ADAPTER;

  return createPacketEnvelope({
    header: {
      packet_id: input.packet_id,
      revision_id:
        input.revision_id ?? createInitialRevisionId(input.packet_id),
      type: input.type,
      schema_version:
        input.schema_version ?? getPacketCurrentSchemaVersion(input.type),
      protocol_version: input.protocol_version,
      created_at: createdAt,
      parent_revision_refs: input.parent_revision_refs ?? [],
      merge_strategy: input.merge_strategy ?? null,
      authority_scope_ref: input.authority_scope_ref ?? null,
      applicable_scope_refs: input.applicable_scope_refs ?? [],
      edges: dedupeEdges(input.edges ?? []),
      provenance: {
        created_by: input.created_by ?? null,
        submitted_by: input.submitted_by ?? null,
        adapter,
        recorded_at: input.recorded_at ?? createdAt,
        imported_from_revision: null,
      },
      moderation: {
        visibility: input.visibility ?? 'public',
        moderation_state: input.moderation_state ?? 'open',
        policy_refs: input.policy_refs ?? [],
        content_warning_ids: input.content_warning_ids ?? [],
      },
      external_refs: input.external_refs ?? [],
      metadata: {
        tags: input.metadata_tags ?? [],
        language: input.metadata_language ?? null,
        summary: input.metadata_summary ?? null,
        compatibility: input.metadata_compatibility ?? null,
      },
      producer: {
        adapter,
        app_version: input.app_version ?? null,
      },
    },
    body: input.body,
  });
}

/**
 * Inputs: common packet header fields plus the element-specific body data.
 * Output: a validated element packet.
 */
export function createElementPacket(
  input: ElementPacketInput
): PacketEnvelopeByType['Element'] {
  return buildPacket({
    type: 'Element',
    body: input,
    header: {
      ...input,
      metadata_tags: input.metadata_tags ?? input.tags ?? [],
      metadata_summary: input.metadata_summary ?? input.summary ?? null,
    },
  });
}

export function createDefinitionPacket(
  input: DefinitionPacketInput
): PacketEnvelopeByType['Definition'] {
  return buildPacket({
    type: 'Definition',
    body: input.body as PacketBodyByType['Definition'],
    header: {
      ...input,
      metadata_summary: input.metadata_summary ?? input.body.summary,
    },
  });
}

/**
 * Inputs: common packet header fields plus the location-specific body data.
 * Output: a validated location packet.
 */
export function createLocationPacket(
  input: LocationPacketInput
): PacketEnvelopeByType['Location'] {
  return buildPacket({
    type: 'Location',
    body: input,
    header: {
      ...input,
      metadata_summary: input.metadata_summary ?? input.summary ?? null,
    },
  });
}

/**
 * Inputs: common packet header fields plus the role body data.
 * Output: a validated role packet.
 */
export function createRolePacket(
  input: RolePacketInput
): PacketEnvelopeByType['Role'] {
  return buildPacket({
    type: 'Role',
    body: input,
    header: {
      ...input,
      metadata_summary: input.metadata_summary ?? input.summary ?? null,
    },
  });
}

/**
 * Inputs: common packet header fields plus one scoped claim body.
 * Output: a validated claim packet with explicit subject, target, and scope edges.
 */
export function createClaimPacket(
  input: ClaimPacketInput
): PacketEnvelopeByType['Claim'] {
  return buildPacket({
    type: 'Claim',
    body: input,
    header: {
      ...input,
      metadata_summary:
        input.metadata_summary ?? input.claim_markdown ?? input.note ?? null,
    },
  });
}

/**
 * Inputs: common packet header fields plus one forward semantic relation body.
 * Output: a validated relation packet.
 */
export function createRelationPacket(
  input: RelationPacketInput
): PacketEnvelopeByType['Relation'] {
  return buildPacket({
    type: 'Relation',
    body: input,
    header: {
      ...input,
      metadata_summary: input.metadata_summary ?? input.note ?? null,
    },
  });
}

/**
 * Inputs: common packet header fields plus one verification/import report body.
 * Output: a validated report packet with target/supporting graph edges mirrored from refs.
 */
export function createReportPacket(
  input: ReportPacketInput
): PacketEnvelopeByType['Report'] {
  return buildPacket({
    type: 'Report',
    body: input,
    header: {
      ...input,
      metadata_summary:
        input.metadata_summary ?? input.summary_markdown ?? input.report_markdown,
    },
  });
}

/**
 * Inputs: shared element fields for a geographic assembly element.
 * Output: an element packet whose kind is locked to assembly.
 */
export function createAssemblyPacket(
  input: Omit<ElementPacketInput, 'subtype'> & { subtype?: ElementSubtype | string }
): PacketEnvelopeByType['Element'] {
  return createElementPacket({
    ...input,
    subtype: 'assembly',
  });
}

/**
 * Inputs: shared element fields for a person element.
 * Output: an element packet whose kind is locked to person.
 */
export function createPersonPacket(
  input: Omit<ElementPacketInput, 'subtype'> & { subtype?: ElementSubtype | string }
): PacketEnvelopeByType['Element'] {
  return createElementPacket({
    ...input,
    subtype: 'person',
  });
}

/**
 * Inputs: common packet header fields plus a canonical discussion node body.
 * Output: a single-type Discussion packet with relationship edges mirrored from node refs.
 */
export function createDiscussionPacket(
  input: DiscussionPacketInput
): PacketEnvelopeByType['Discussion'] {
  return buildPacket({
    type: 'Discussion',
    body: input,
    header: input,
  });
}

/**
 * Inputs: common packet header fields plus the discussion thread body data.
 * Output: a discussion thread packet with reference edges mirrored from related refs.
 */
export function createDiscussionThreadPacket(
  input: DiscussionThreadPacketInput
): PacketEnvelopeByType['Discussion'] {
  const relatedRefs = input.related_refs ?? [];
  const relatedEdges = relatedRefs.map((relatedRef) =>
    createPacketEdge('references', relatedRef, {
      source_field: 'related_refs',
    })
  );

  return createDiscussionPacket({
    ...input,
    subtype: 'topic',
    role: input.thread_kind,
    edges: [
      ...(input.edges ?? []),
      createPacketEdge('belongs_to', input.forum_ref, {
        source_field: 'forum_ref',
      }),
      ...relatedEdges,
    ],
    metadata_summary: input.metadata_summary ?? input.summary ?? null,
    parent_ref: input.forum_ref,
    related_refs: relatedRefs,
  });
}

/**
 * Inputs: common packet header fields plus the discussion-space body data.
 * Output: a discussion-space packet attached directly to one scope element.
 */
export function createDiscussionSpacePacket(
  input: DiscussionSpacePacketInput
): PacketEnvelopeByType['Discussion'] {
  return createDiscussionPacket({
    ...input,
    subtype: 'space',
    role: 'space',
    edges: [
      ...(input.edges ?? []),
      createPacketEdge('belongs_to', input.scope_ref, {
        source_field: 'scope_ref',
      }),
    ],
    metadata_summary: input.metadata_summary ?? input.summary ?? null,
  });
}

/**
 * Inputs: common packet header fields plus the forum-tab body data.
 * Output: a discussion forum packet nested beneath one discussion space.
 */
export function createDiscussionForumPacket(
  input: DiscussionForumPacketInput
): PacketEnvelopeByType['Discussion'] {
  return createDiscussionPacket({
    ...input,
    subtype: 'forum',
    role: input.forum_kind,
    edges: [
      ...(input.edges ?? []),
      createPacketEdge('belongs_to', input.discussion_space_ref, {
        source_field: 'discussion_space_ref',
      }),
    ],
    metadata_summary: input.metadata_summary ?? input.summary ?? null,
    parent_ref: input.discussion_space_ref,
    participation_rules: input.participation_rules,
    default_sort: input.default_sort,
  });
}

/**
 * Inputs: common packet header fields plus the discussion post body data.
 * Output: a discussion post packet with explicit thread and reply edges.
 */
export function createDiscussionPostPacket(
  input: DiscussionPostPacketInput
): PacketEnvelopeByType['Discussion'] {
  const referenceRefs = input.reference_refs ?? [];
  const replyEdges =
    input.reply_to_ref === undefined || input.reply_to_ref === null
      ? []
      : [
          createPacketEdge('reply_to', input.reply_to_ref, {
            source_field: 'reply_to_ref',
          }),
        ];
  const referenceEdges = [
    createPacketEdge('references', input.thread_ref, {
      source_field: 'thread_ref',
    }),
    ...referenceRefs.map((referenceRef) =>
      createPacketEdge('references', referenceRef, {
        source_field: 'reference_refs',
      })
    ),
  ];

  return createDiscussionPacket({
    ...input,
    subtype: input.reply_to_ref ? 'message' : 'post',
    role: input.post_kind ?? 'forum_post',
    edges: [...(input.edges ?? []), ...replyEdges, ...referenceEdges],
    metadata_summary:
      input.metadata_summary ?? createTextExcerpt(input.content_markdown),
    parent_ref: input.reply_to_ref ?? input.thread_ref,
    topic_ref: input.thread_ref,
    content_markdown: input.content_markdown,
  });
}

/**
 * Inputs: common packet header fields plus the discussion reply body data.
 * Output: a discussion reply packet with explicit thread, root-post, and parent edges.
 */
export function createDiscussionReplyPacket(
  input: DiscussionReplyPacketInput
): PacketEnvelopeByType['Discussion'] {
  return createDiscussionPacket({
    ...input,
    subtype: 'message',
    role: 'reply',
    edges: [
      ...(input.edges ?? []),
      createPacketEdge('references', input.thread_ref, {
        source_field: 'thread_ref',
      }),
      createPacketEdge('belongs_to', input.root_post_ref, {
        source_field: 'root_post_ref',
      }),
      createPacketEdge('reply_to', input.reply_to_ref, {
        source_field: 'reply_to_ref',
      }),
    ],
    metadata_summary:
      input.metadata_summary ?? createTextExcerpt(input.content_markdown),
    parent_ref: input.reply_to_ref,
    topic_ref: input.thread_ref,
    root_message_ref: input.root_post_ref,
    content_markdown: input.content_markdown,
  });
}

/**
 * Inputs: common packet header fields plus the proposal body data.
 * Output: a proposal packet with policy references mirrored into graph edges.
 */
export function createProposalPacket(
  input: ProposalPacketInput
): PacketEnvelopeByType['Proposal'] {
  return buildPacket({
    type: 'Proposal',
    body: input,
    header: {
      ...input,
      metadata_summary: input.metadata_summary ?? input.summary ?? null,
    },
  });
}

/**
 * Inputs: common packet header fields plus the policy body data.
 * Output: a validated policy packet.
 */
export function createPolicyPacket(
  input: PolicyPacketInput
): PacketEnvelopeByType['Policy'] {
  return buildPacket({
    type: 'Policy',
    body: input,
    header: input,
  });
}

export function createPreferencePacket(
  input: PreferencePacketInput
): PacketEnvelopeByType['Preference'] {
  return buildPacket({
    type: 'Preference',
    body: input.body as PacketBodyByType['Preference'],
    header: {
      ...input,
      metadata_summary:
        input.metadata_summary ??
        `Preference ${input.body.subtype} for ${input.body.owner_ref.packet_id}`,
    },
  });
}

/**
 * Inputs: common packet header fields plus the decision body data.
 * Output: a decision packet with optional references to supporting proposal and vote packets.
 */
export function createDecisionPacket(
  input: DecisionPacketInput
): PacketEnvelopeByType['Decision'] {
  return buildPacket({
    type: 'Decision',
    body: input,
    header: {
      ...input,
      metadata_summary: input.metadata_summary ?? input.summary ?? null,
    },
  });
}

/**
 * Inputs: common packet header fields plus the action body data.
 * Output: a validated action packet.
 */
export function createActionPacket(
  input: ActionPacketInput
): PacketEnvelopeByType['Action'] {
  return buildPacket({
    type: 'Action',
    body: input,
    header: {
      ...input,
      metadata_summary:
        input.metadata_summary ?? input.summary ?? input.objective_markdown ?? null,
    },
  });
}

/**
 * Inputs: common packet header fields plus the universal reaction body data.
 * Output: a reaction tied to any packet target, with vote, support/dispute, and emotion channels kept type-agnostic.
 */
export function createReactionPacket(
  input: ReactionPacketInput
): PacketEnvelopeByType['Reaction'] {
  return buildPacket({
    type: 'Reaction',
    body: input,
    header: {
      ...input,
      metadata_summary: input.metadata_summary ?? input.note ?? null,
    },
  });
}

export function createBundlePacket(
  input: BundlePacketInput
): PacketEnvelopeByType['Bundle'] {
  return buildPacket({
    type: 'Bundle',
    body: input.body as PacketBodyByType['Bundle'],
    header: {
      ...input,
      metadata_summary:
        input.metadata_summary ?? input.body.summary ?? input.body.purpose,
    },
  });
}
