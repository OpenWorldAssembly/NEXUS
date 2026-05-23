/**
 * File: packet-ontology.ts
 * Description: Declares canonical packet types, subtype registries, ontology helpers, and shared packet-level enums/types.
 */

import { z } from 'zod';

export const PACKET_TYPES = [
  'Definition',
  'Element',
  'Location',
  'Role',
  'Claim',
  'Relation',
  'Report',
  'Proposal',
  'Vote',
  'Attestation',
  'Decision',
  'Action',
  'Policy',
  'Preference',
  'Discussion',
  'Bundle',
] as const;

export const ELEMENT_SUBTYPES = [
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

export const RELATION_SUBTYPES = [
  'home_locality',
  'assembly_association',
  'role_association',
  'follows',
  'subscribes_to',
  'adopts_policy',
  'depends_on',
  'aligned_with_cause',
  'defined_by_location',
  'contains',
  'overlaps',
  'equivalent_to',
  'default_ancestry_parent',
  'participates_in',
] as const;

export const LOCATION_SUBTYPES = [
  'point',
  'address',
  'boundary',
  'region',
  'route',
  'service_area',
  'provider_ref_bundle',
] as const;

export const CLAIM_SUBTYPES = [
  'relation_assertion',
  'analysis',
  'objection',
  'challenge',
  'correction',
  'annotation',
  'duplicate_notice',
] as const;

export const ATTESTATION_SUBTYPES = [
  'verification',
  'vouch',
  'flag',
  'support',
  'dispute',
  'packet_signal',
  'identity_attest',
  'attendance_vouch',
  'claim_support',
  'claim_dispute',
] as const;

export const RELATION_CLAIM_TARGET_MODES = [
  'relation_packet',
  'relation_target',
  'any',
] as const;

export const RELATION_SUBJECT_MATCH_MODES = [
  'relation_subject',
  'any',
] as const;

export const PERSON_CLAIM_STATUSES = [
  'ephemeral_guest',
  'persistent_guest',
  'claimed',
] as const;

export const PERSON_KEY_STATUSES = ['active', 'revoked'] as const;


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

export const DISCUSSION_SUBTYPES = [
  'space',
  'forum',
  'topic',
  'post',
  'message',
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

export const PacketTypeSchema = z.enum(PACKET_TYPES);
export const ElementSubtypeSchema = z.enum(ELEMENT_SUBTYPES);
export const CanonicalRelationSubtypeSchema = z.enum(RELATION_SUBTYPES);
export const CanonicalLocationSubtypeSchema = z.enum(LOCATION_SUBTYPES);
export const CanonicalClaimSubtypeSchema = z.enum(CLAIM_SUBTYPES);
export const CanonicalAttestationSubtypeSchema = z.enum(ATTESTATION_SUBTYPES);
export const PersonClaimStatusSchema = z.enum(PERSON_CLAIM_STATUSES);
export const PersonKeyStatusSchema = z.enum(PERSON_KEY_STATUSES);
export const DiscussionActorClassSchema = z.enum(DISCUSSION_ACTOR_CLASSES);
export const DiscussionSortSchema = z.enum(DISCUSSION_SORTS);
export const DiscussionReplySortSchema = z.enum(DISCUSSION_REPLY_SORTS);
export const DiscussionSubtypeSchema = z.enum(DISCUSSION_SUBTYPES);
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
export const RelationClaimTargetModeSchema = z.enum(
  RELATION_CLAIM_TARGET_MODES
);
export const RelationSubjectMatchModeSchema = z.enum(
  RELATION_SUBJECT_MATCH_MODES
);

export type PacketType = z.infer<typeof PacketTypeSchema>;
export type ElementSubtype = z.infer<typeof ElementSubtypeSchema>;
export type CanonicalRelationSubtype = z.infer<
  typeof CanonicalRelationSubtypeSchema
>;
export type CanonicalLocationSubtype = z.infer<
  typeof CanonicalLocationSubtypeSchema
>;
export type CanonicalClaimSubtype = z.infer<typeof CanonicalClaimSubtypeSchema>;
export type CanonicalAttestationSubtype = z.infer<
  typeof CanonicalAttestationSubtypeSchema
>;
export type PersonClaimStatus = z.infer<typeof PersonClaimStatusSchema>;
export type PersonKeyStatus = z.infer<typeof PersonKeyStatusSchema>;
export type PacketRevisionState = z.infer<typeof PacketRevisionStateSchema>;
export type PacketMergeStrategy = z.infer<typeof PacketMergeStrategySchema>;
export type DiscussionActorClass = z.infer<typeof DiscussionActorClassSchema>;
export type DiscussionSort = z.infer<typeof DiscussionSortSchema>;
export type DiscussionReplySort = z.infer<typeof DiscussionReplySortSchema>;
export type DiscussionSubtype = z.infer<typeof DiscussionSubtypeSchema>;
export type AttestationValue = z.infer<typeof AttestationValueSchema>;
export type AttestationStatus = z.infer<typeof AttestationStatusSchema>;
export type AttestationKind = z.infer<typeof AttestationKindSchema>;
export type TrustStage = z.infer<typeof TrustStageSchema>;
export type PacketRevisionMode = z.infer<typeof PacketRevisionModeSchema>;
export type ClaimKind = z.infer<typeof ClaimKindSchema>;
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;
export type RelationStatus = z.infer<typeof RelationStatusSchema>;
export type RelationClaimTargetMode = z.infer<
  typeof RelationClaimTargetModeSchema
>;
export type RelationSubjectMatchMode = z.infer<
  typeof RelationSubjectMatchModeSchema
>;
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

function isElementSubtypeValue(value: string): value is ElementSubtype {
  return (ELEMENT_SUBTYPES as readonly string[]).includes(value);
}

function normalizeSubtypeText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

export function getCanonicalElementSubtype(input: {
  subtype?: string | null;
}): string | null {
  const normalizedSubtype = normalizeSubtypeText(input.subtype);

  if (!normalizedSubtype) {
    return null;
  }

  if (normalizedSubtype.includes('.')) {
    return normalizedSubtype;
  }

  return normalizedSubtype;
}

export function getElementSubtypeLeaf(
  subtype: string | null | undefined
): string | null {
  const normalizedSubtype = normalizeSubtypeText(subtype);

  if (!normalizedSubtype) {
    return null;
  }

  const segments = normalizedSubtype.split('.').filter(Boolean);
  return segments.at(-1) ?? normalizedSubtype;
}

export function getElementSubtypeRoot(input: {
  subtype?: string | null;
  fallbackSubtype?: ElementSubtype | null;
}): ElementSubtype | null {
  const normalizedSubtype = normalizeSubtypeText(input.subtype);

  if (!normalizedSubtype) {
    return input.fallbackSubtype ?? null;
  }

  const firstSegment =
    normalizedSubtype.split('.').filter(Boolean)[0] ?? normalizedSubtype;

  if (isElementSubtypeValue(firstSegment)) {
    return firstSegment;
  }

  return input.fallbackSubtype ?? null;
}

function isCanonicalSubtypeValue<TSubtype extends string>(
  value: string | null | undefined,
  registry: readonly TSubtype[]
): value is TSubtype {
  return (
    value !== null && value !== undefined && registry.includes(value as TSubtype)
  );
}

export function isCanonicalRelationSubtype(
  value: string | null | undefined
): value is CanonicalRelationSubtype {
  return isCanonicalSubtypeValue(value, RELATION_SUBTYPES);
}

export function isCanonicalLocationSubtype(
  value: string | null | undefined
): value is CanonicalLocationSubtype {
  return isCanonicalSubtypeValue(value, LOCATION_SUBTYPES);
}

export function isCanonicalClaimSubtype(
  value: string | null | undefined
): value is CanonicalClaimSubtype {
  return isCanonicalSubtypeValue(value, CLAIM_SUBTYPES);
}

export function isCanonicalAttestationSubtype(
  value: string | null | undefined
): value is CanonicalAttestationSubtype {
  return isCanonicalSubtypeValue(value, ATTESTATION_SUBTYPES);
}

export const PacketVoteValueSchema = AttestationValueSchema;
export const PacketVoteStatusSchema = AttestationStatusSchema;
export const PacketVoteKindSchema = AttestationKindSchema;

export const LOCALITY_LEVELS = ['nation', 'region', 'city', 'district'] as const;
export const LocalityLevelSchema = z.enum(LOCALITY_LEVELS);
export type LocalityLevel = z.infer<typeof LocalityLevelSchema>;

export const PACKET_TYPE_REVISION_MODES = {
  Definition: 'replaceable',
  Element: 'replaceable',
  Location: 'replaceable',
  Role: 'replaceable',
  Claim: 'replaceable',
  Relation: 'replaceable',
  Report: 'replaceable',
  Proposal: 'replaceable',
  Vote: 'append_only',
  Attestation: 'append_only',
  Decision: 'append_only',
  Action: 'replaceable',
  Policy: 'replaceable',
  Preference: 'replaceable',
  Discussion: 'replaceable',
  Bundle: 'replaceable',
} satisfies Record<PacketType, PacketRevisionMode>;
