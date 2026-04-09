/**
 * File: builders.ts
 * Description: Provides typed helpers for constructing canonical packet envelopes for seeds, fixtures, and adapters.
 */

import type { z } from 'zod';

import {
  PACKET_BODY_SCHEMAS,
  createPacketEnvelope,
  type ElementKind,
  type PacketEdge,
  type PacketEnvelopeByType,
  type PacketFamily,
  type PacketHeader,
  type PacketMergeStrategy,
  type PacketRef,
  type PacketRevisionRef,
} from '@/domain/schema/packet-schema';

type PacketVisibility = PacketHeader['moderation']['visibility'];
type PacketModerationState = PacketHeader['moderation']['moderation_state'];
type PacketLanguage = PacketHeader['metadata']['language'];
type PacketExternalRef = PacketHeader['external_refs'][number];

export interface PacketBuilderBaseInput {
  packet_id: string;
  revision_id?: string;
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
}

export interface PacketBuilderInput<TFamily extends PacketFamily>
  extends PacketBuilderBaseInput {
  family: TFamily;
  body: z.input<(typeof PACKET_BODY_SCHEMAS)[TFamily]>;
}

export interface ElementPacketInput extends PacketBuilderBaseInput {
  kind: ElementKind;
  name: string;
  subtype?: string | null;
  summary?: string | null;
  locality_label?: string | null;
  tags?: string[];
}

export interface DiscussionThreadPacketInput extends PacketBuilderBaseInput {
  title: string;
  summary?: string | null;
  thread_kind: string;
  status?: string;
  related_refs?: PacketRef[];
}

export interface DiscussionPostPacketInput extends PacketBuilderBaseInput {
  title: string;
  thread_ref: PacketRef;
  post_kind: string;
  content_markdown: string;
  reply_to_ref?: PacketRef | null;
  reference_refs?: PacketRef[];
}

export interface ProposalPacketInput extends PacketBuilderBaseInput {
  title: string;
  summary?: string | null;
  proposal_kind: string;
  status: string;
  decision_scope_refs?: PacketRef[];
  related_policy_refs?: PacketRef[];
}

export interface PolicyPacketInput extends PacketBuilderBaseInput {
  title: string;
  summary?: string | null;
  policy_kind: string;
  body_markdown: string;
  status: string;
}

export interface VotePacketInput extends PacketBuilderBaseInput {
  title: string;
  proposal_ref: PacketRef;
  vote_method: string;
  status: string;
  opened_at?: string | null;
  closes_at?: string | null;
}

const DEFAULT_CREATED_AT = '2026-04-08T00:00:00.000Z';
const DEFAULT_ADAPTER = 'seed';

/**
 * Inputs: a packet id string.
 * Output: a packet ref object suitable for scope refs, links, and graph edges.
 */
export function createPacketRef(packetId: string): PacketRef {
  return { packet_id: packetId };
}

/**
 * Inputs: a packet id and revision id string.
 * Output: an immutable revision ref object.
 */
export function createPacketRevisionRef(
  packetId: string,
  revisionId: string
): PacketRevisionRef {
  return {
    packet_id: packetId,
    revision_id: revisionId,
  };
}

/**
 * Inputs: a packet id and optional revision number.
 * Output: a readable deterministic revision id for seed and fixture data.
 */
export function createInitialRevisionId(
  packetId: string,
  revisionNumber = 1
): string {
  return `${packetId}@r${revisionNumber}`;
}

/**
 * Inputs: an edge type, a target packet ref or id, and optional metadata.
 * Output: a normalized packet edge object.
 */
export function createPacketEdge(
  edgeType: string,
  target: PacketRef | string,
  metadata: Record<string, unknown> = {}
): PacketEdge {
  return {
    edge_type: edgeType,
    target: typeof target === 'string' ? createPacketRef(target) : target,
    metadata,
  };
}

/**
 * Inputs: a markdown or plain-text string and an optional max length.
 * Output: a compact excerpt suitable for header metadata summaries.
 */
export function createTextExcerpt(content: string, maxLength = 140): string {
  const normalizedContent = content.replace(/\s+/g, ' ').trim();

  if (normalizedContent.length <= maxLength) {
    return normalizedContent;
  }

  return `${normalizedContent.slice(0, maxLength - 3).trimEnd()}...`;
}

/**
 * Inputs: a list of edges that may contain duplicates.
 * Output: the same edge list with duplicate edge/type/metadata tuples removed.
 */
function dedupeEdges(edges: PacketEdge[]): PacketEdge[] {
  const seen = new Set<string>();

  return edges.filter((edge) => {
    const key = JSON.stringify([
      edge.edge_type,
      edge.target.packet_id,
      edge.metadata,
    ]);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/**
 * Inputs: generic builder input for any supported packet family.
 * Output: a validated canonical packet envelope with shared header defaults applied.
 */
export function createPacket<TFamily extends PacketFamily>(
  input: PacketBuilderInput<TFamily>
): PacketEnvelopeByType[TFamily] {
  const createdAt = input.created_at ?? DEFAULT_CREATED_AT;
  const adapter = input.adapter ?? DEFAULT_ADAPTER;

  return createPacketEnvelope({
    header: {
      packet_id: input.packet_id,
      revision_id:
        input.revision_id ?? createInitialRevisionId(input.packet_id),
      family: input.family,
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
  return createPacket({
    ...input,
    family: 'Element',
    metadata_tags: input.metadata_tags ?? input.tags ?? [],
    metadata_summary: input.metadata_summary ?? input.summary ?? null,
    body: {
      kind: input.kind,
      name: input.name,
      subtype: input.subtype ?? null,
      summary: input.summary ?? null,
      locality_label: input.locality_label ?? null,
      tags: input.tags ?? [],
    },
  });
}

/**
 * Inputs: shared element fields for a geographic assembly element.
 * Output: an element packet whose kind is locked to assembly.
 */
export function createAssemblyPacket(
  input: Omit<ElementPacketInput, 'kind'>
): PacketEnvelopeByType['Element'] {
  return createElementPacket({
    ...input,
    kind: 'assembly',
  });
}

/**
 * Inputs: shared element fields for a person element.
 * Output: an element packet whose kind is locked to person.
 */
export function createPersonPacket(
  input: Omit<ElementPacketInput, 'kind'>
): PacketEnvelopeByType['Element'] {
  return createElementPacket({
    ...input,
    kind: 'person',
  });
}

/**
 * Inputs: common packet header fields plus the discussion thread body data.
 * Output: a discussion thread packet with reference edges mirrored from related refs.
 */
export function createDiscussionThreadPacket(
  input: DiscussionThreadPacketInput
): PacketEnvelopeByType['DiscussionThread'] {
  const relatedRefs = input.related_refs ?? [];
  const relatedEdges = relatedRefs.map((relatedRef) =>
    createPacketEdge('references', relatedRef, {
      source_field: 'related_refs',
    })
  );

  return createPacket({
    ...input,
    family: 'DiscussionThread',
    edges: [...(input.edges ?? []), ...relatedEdges],
    metadata_summary: input.metadata_summary ?? input.summary ?? null,
    body: {
      title: input.title,
      summary: input.summary ?? null,
      thread_kind: input.thread_kind,
      status: input.status ?? 'open',
      related_refs: relatedRefs,
    },
  });
}

/**
 * Inputs: common packet header fields plus the discussion post body data.
 * Output: a discussion post packet with explicit thread and reply edges.
 */
export function createDiscussionPostPacket(
  input: DiscussionPostPacketInput
): PacketEnvelopeByType['DiscussionPost'] {
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

  return createPacket({
    ...input,
    family: 'DiscussionPost',
    edges: [...(input.edges ?? []), ...replyEdges, ...referenceEdges],
    metadata_summary:
      input.metadata_summary ?? createTextExcerpt(input.content_markdown),
    body: {
      title: input.title,
      thread_ref: input.thread_ref,
      post_kind: input.post_kind,
      content_markdown: input.content_markdown,
      reply_to_ref: input.reply_to_ref ?? null,
    },
  });
}

/**
 * Inputs: common packet header fields plus the proposal body data.
 * Output: a proposal packet with policy references mirrored into graph edges.
 */
export function createProposalPacket(
  input: ProposalPacketInput
): PacketEnvelopeByType['Proposal'] {
  const relatedPolicyRefs = input.related_policy_refs ?? [];
  const policyEdges = relatedPolicyRefs.map((policyRef) =>
    createPacketEdge('governed_by', policyRef, {
      source_field: 'related_policy_refs',
    })
  );

  return createPacket({
    ...input,
    family: 'Proposal',
    edges: [...(input.edges ?? []), ...policyEdges],
    metadata_summary: input.metadata_summary ?? input.summary ?? null,
    body: {
      title: input.title,
      summary: input.summary ?? null,
      proposal_kind: input.proposal_kind,
      status: input.status,
      decision_scope_refs: input.decision_scope_refs ?? [],
      related_policy_refs: relatedPolicyRefs,
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
  return createPacket({
    ...input,
    family: 'Policy',
    metadata_summary:
      input.metadata_summary ??
      input.summary ??
      createTextExcerpt(input.body_markdown),
    body: {
      title: input.title,
      summary: input.summary ?? null,
      policy_kind: input.policy_kind,
      body_markdown: input.body_markdown,
      status: input.status,
    },
  });
}

/**
 * Inputs: common packet header fields plus the vote body data.
 * Output: a vote packet with an explicit edge back to the proposal it evaluates.
 */
export function createVotePacket(
  input: VotePacketInput
): PacketEnvelopeByType['Vote'] {
  return createPacket({
    ...input,
    family: 'Vote',
    edges: [
      ...(input.edges ?? []),
      createPacketEdge('votes_on', input.proposal_ref, {
        source_field: 'proposal_ref',
      }),
    ],
    body: {
      title: input.title,
      proposal_ref: input.proposal_ref,
      vote_method: input.vote_method,
      status: input.status,
      opened_at: input.opened_at ?? null,
      closes_at: input.closes_at ?? null,
    },
  });
}
