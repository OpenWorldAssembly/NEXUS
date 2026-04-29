/**
 * File: packet-build-pipeline.ts
 * Description: Generic packet builder pipeline for family-owned body rules and shared envelope construction.
 */

import type {
  AttestationPacketInput,
  ClaimPacketInput,
  DecisionPacketInput,
  DiscussionPacketInput,
  ElementPacketInput,
  PacketBuilderBaseInput,
  PolicyPacketInput,
  ProposalPacketInput,
  RolePacketInput,
  VotePacketInput,
} from '@core/packets/builders';
import { attestationBuildDefinition } from '@core/packets/families/attestation';
import { claimBuildDefinition } from '@core/packets/families/claim';
import { decisionBuildDefinition } from '@core/packets/families/decision';
import { discussionBuildDefinition } from '@core/packets/families/discussion';
import { elementBuildDefinition } from '@core/packets/families/element';
import { policyBuildDefinition } from '@core/packets/families/policy';
import { proposalBuildDefinition } from '@core/packets/families/proposal';
import { roleBuildDefinition } from '@core/packets/families/role';
import { voteBuildDefinition } from '@core/packets/families/vote';
import { createInitialRevisionId } from '@core/packets/packet-build-helpers';
import {
  createPacketEnvelope,
  type PacketRef,
  type PacketEdge,
  type PacketEnvelopeByType,
  type PacketFamily,
  type PacketHeader,
} from '@core/schema/packet-schema';

const DEFAULT_CREATED_AT = '2026-04-08T00:00:00.000Z';
const DEFAULT_ADAPTER = 'seed';

type PacketVisibility = PacketHeader['moderation']['visibility'];
type PacketModerationState = PacketHeader['moderation']['moderation_state'];
type PacketLanguage = PacketHeader['metadata']['language'];
type PacketCompatibilityMetadata = PacketHeader['metadata']['compatibility'];
type PacketExternalRef = PacketHeader['external_refs'][number];

export interface PacketBuildRequest<
  TFamily extends PacketFamily,
  TBodyInput,
  TContext = undefined,
> {
  family: TFamily;
  body: TBodyInput;
  header: PacketBuilderBaseInput;
  context?: TContext;
}

export interface PacketFamilyBuildDefinition<
  TFamily extends PacketFamily,
  TBodyInput,
  TContext = undefined,
  TNormalizedBody = TBodyInput,
> {
  normalizeBody?: (
    body: TBodyInput,
    context: TContext | undefined
  ) => TNormalizedBody;
  validateBody?: (
    body: TNormalizedBody,
    context: TContext | undefined
  ) => void;
  extractRelationships?: (
    body: TNormalizedBody,
    context: TContext | undefined
  ) => {
    dependencies?: PacketRef[];
    references?: PacketRef[];
  };
  finalizeBody: (
    body: TNormalizedBody,
    context: TContext | undefined
  ) => PacketEnvelopeByType[TFamily]['body'];
  prepareEdges?: (
    body: TNormalizedBody,
    relationships:
      | {
          dependencies?: PacketRef[];
          references?: PacketRef[];
        }
      | undefined,
    context: TContext | undefined
  ) => PacketEdge[];
  prepareMetadataSummary?: (
    body: TNormalizedBody,
    context: TContext | undefined
  ) => string | null | undefined;
  prepareMetadataCompatibility?: (
    body: TNormalizedBody,
    context: TContext | undefined
  ) => PacketCompatibilityMetadata | null | undefined;
}

type PacketBuildHeaderInput = {
  packet_id: string;
  revision_id?: string;
  schema_version?: string;
  protocol_version?: string;
  created_at?: string;
  parent_revision_refs?: PacketBuilderBaseInput['parent_revision_refs'];
  merge_strategy?: PacketBuilderBaseInput['merge_strategy'];
  authority_scope_ref?: PacketBuilderBaseInput['authority_scope_ref'];
  applicable_scope_refs?: PacketBuilderBaseInput['applicable_scope_refs'];
  edges?: PacketEdge[];
  created_by?: PacketBuilderBaseInput['created_by'];
  submitted_by?: PacketBuilderBaseInput['submitted_by'];
  recorded_at?: string | null;
  adapter?: string;
  app_version?: string | null;
  visibility?: PacketVisibility;
  moderation_state?: PacketModerationState;
  policy_refs?: PacketBuilderBaseInput['policy_refs'];
  content_warning_ids?: PacketBuilderBaseInput['content_warning_ids'];
  external_refs?: PacketExternalRef[];
  metadata_tags?: string[];
  metadata_language?: PacketLanguage;
  metadata_summary?: string | null;
  metadata_compatibility?: PacketCompatibilityMetadata | null;
};

export const GENERIC_PACKET_BUILD_FAMILIES = [
  'Element',
  'Role',
  'Claim',
  'Proposal',
  'Vote',
  'Attestation',
  'Decision',
  'Discussion',
  'Policy',
] as const;

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

function finalizeBuiltPacket<TFamily extends PacketFamily>(input: {
  family: TFamily;
  header: PacketBuildHeaderInput;
  body: PacketEnvelopeByType[TFamily]['body'];
}): PacketEnvelopeByType[TFamily] {
  const createdAt = input.header.created_at ?? DEFAULT_CREATED_AT;
  const adapter = input.header.adapter ?? DEFAULT_ADAPTER;

  return createPacketEnvelope({
    header: {
      packet_id: input.header.packet_id,
      revision_id:
        input.header.revision_id ?? createInitialRevisionId(input.header.packet_id),
      family: input.family,
      schema_version: input.header.schema_version,
      protocol_version: input.header.protocol_version,
      created_at: createdAt,
      parent_revision_refs: input.header.parent_revision_refs ?? [],
      merge_strategy: input.header.merge_strategy ?? null,
      authority_scope_ref: input.header.authority_scope_ref ?? null,
      applicable_scope_refs: input.header.applicable_scope_refs ?? [],
      edges: dedupeEdges(input.header.edges ?? []),
      provenance: {
        created_by: input.header.created_by ?? null,
        submitted_by: input.header.submitted_by ?? null,
        adapter,
        recorded_at: input.header.recorded_at ?? createdAt,
        imported_from_revision: null,
      },
      moderation: {
        visibility: input.header.visibility ?? 'public',
        moderation_state: input.header.moderation_state ?? 'open',
        policy_refs: input.header.policy_refs ?? [],
        content_warning_ids: input.header.content_warning_ids ?? [],
      },
      external_refs: input.header.external_refs ?? [],
      metadata: {
        tags: input.header.metadata_tags ?? [],
        language: input.header.metadata_language ?? null,
        summary: input.header.metadata_summary ?? null,
        compatibility: input.header.metadata_compatibility ?? null,
      },
      producer: {
        adapter,
        app_version: input.header.app_version ?? null,
      },
    },
    body: input.body as never,
  });
}

function buildPacketWithDefinition<
  TFamily extends PacketFamily,
  TBodyInput,
  TContext = undefined,
  TNormalizedBody = TBodyInput,
>(
  request: PacketBuildRequest<TFamily, TBodyInput, TContext>,
  definition: PacketFamilyBuildDefinition<
    TFamily,
    TBodyInput,
    TContext,
    TNormalizedBody
  >
): PacketEnvelopeByType[TFamily] {
  const normalizedBody = definition.normalizeBody
    ? definition.normalizeBody(request.body, request.context)
    : (request.body as unknown as TNormalizedBody);

  definition.validateBody?.(normalizedBody, request.context);

  const relationships = definition.extractRelationships?.(
    normalizedBody,
    request.context
  );
  const preparedEdges =
    definition.prepareEdges?.(normalizedBody, relationships, request.context) ?? [];
  const preparedMetadataCompatibility =
    definition.prepareMetadataCompatibility?.(normalizedBody, request.context) ?? null;
  const preparedMetadataSummary =
    definition.prepareMetadataSummary?.(normalizedBody, request.context) ?? null;

  return finalizeBuiltPacket({
    family: request.family,
    header: {
      ...request.header,
      edges: [...(request.header.edges ?? []), ...preparedEdges],
      metadata_summary:
        request.header.metadata_summary ?? preparedMetadataSummary ?? null,
      metadata_compatibility:
        request.header.metadata_compatibility ?? preparedMetadataCompatibility,
    },
    body: definition.finalizeBody(normalizedBody, request.context),
  });
}

export function buildPacket(
  request: PacketBuildRequest<'Element', ElementPacketInput>
): PacketEnvelopeByType['Element'];
export function buildPacket(
  request: PacketBuildRequest<'Role', RolePacketInput>
): PacketEnvelopeByType['Role'];
export function buildPacket(
  request: PacketBuildRequest<'Claim', ClaimPacketInput>
): PacketEnvelopeByType['Claim'];
export function buildPacket(
  request: PacketBuildRequest<'Proposal', ProposalPacketInput>
): PacketEnvelopeByType['Proposal'];
export function buildPacket(
  request: PacketBuildRequest<'Vote', VotePacketInput>
): PacketEnvelopeByType['Vote'];
export function buildPacket(
  request: PacketBuildRequest<'Attestation', AttestationPacketInput>
): PacketEnvelopeByType['Attestation'];
export function buildPacket(
  request: PacketBuildRequest<'Decision', DecisionPacketInput>
): PacketEnvelopeByType['Decision'];
export function buildPacket(
  request: PacketBuildRequest<'Discussion', DiscussionPacketInput>
): PacketEnvelopeByType['Discussion'];
export function buildPacket(
  request: PacketBuildRequest<'Policy', PolicyPacketInput>
): PacketEnvelopeByType['Policy'];
export function buildPacket(
  request: PacketBuildRequest<PacketFamily, unknown>
): PacketEnvelopeByType[PacketFamily] {
  switch (request.family) {
    case 'Element':
      return buildPacketWithDefinition(
        request as PacketBuildRequest<'Element', ElementPacketInput>,
        elementBuildDefinition
      );
    case 'Role':
      return buildPacketWithDefinition(
        request as PacketBuildRequest<'Role', RolePacketInput>,
        roleBuildDefinition
      );
    case 'Claim':
      return buildPacketWithDefinition(
        request as PacketBuildRequest<'Claim', ClaimPacketInput>,
        claimBuildDefinition
      );
    case 'Proposal':
      return buildPacketWithDefinition(
        request as PacketBuildRequest<'Proposal', ProposalPacketInput>,
        proposalBuildDefinition
      );
    case 'Vote':
      return buildPacketWithDefinition(
        request as PacketBuildRequest<'Vote', VotePacketInput>,
        voteBuildDefinition
      );
    case 'Attestation':
      return buildPacketWithDefinition(
        request as PacketBuildRequest<'Attestation', AttestationPacketInput>,
        attestationBuildDefinition
      );
    case 'Decision':
      return buildPacketWithDefinition(
        request as PacketBuildRequest<'Decision', DecisionPacketInput>,
        decisionBuildDefinition
      );
    case 'Discussion':
      return buildPacketWithDefinition(
        request as PacketBuildRequest<'Discussion', DiscussionPacketInput>,
        discussionBuildDefinition
      );
    case 'Policy':
      return buildPacketWithDefinition(
        request as PacketBuildRequest<'Policy', PolicyPacketInput>,
        policyBuildDefinition
      );
    default:
      throw new Error(
        `Generic packet builder pipeline is not yet enabled for family ${request.family}.`
      );
  }
}

export function hasGenericPacketBuilderPipeline(
  family: PacketFamily
): family is (typeof GENERIC_PACKET_BUILD_FAMILIES)[number] {
  return GENERIC_PACKET_BUILD_FAMILIES.includes(
    family as (typeof GENERIC_PACKET_BUILD_FAMILIES)[number]
  );
}
