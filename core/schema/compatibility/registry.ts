/**
 * File: compatibility/registry.ts
 * Description: Declares type compatibility registries, legacy body schemas, and schema-version metadata helpers.
 */

import { z } from 'zod';

import { WRITE_PROOF_LEVELS } from '@core/auth/proof-types';
import type {
  PacketAdaptationChange,
  PacketAdaptationLoss,
  PacketCompatibilityAuditSummary,
  PacketCompatibilityEntry,
  PacketSchemaVersionDefinition,
} from '@core/schema/compatibility/types';
import { PacketCompatibilityError } from '@core/schema/compatibility/types';
import type {
  PacketAdaptationChangeKind,
  PacketAdaptationLossKind,
  PacketType,
  PacketRevisionMode,
} from '@core/schema/packet-ontology';
import {
  PACKET_ADAPTATION_CHANGE_KINDS as CHANGE_KINDS,
  DEFAULT_SCHEMA_VERSION,
  PACKET_TYPES,
  PACKET_TYPE_REVISION_MODES,
  TrustStageSchema,
} from '@core/schema/packet-ontology';
import {
  ActionBodySchema,
  ReactionBodySchema,
  BundleBodySchema,
  ClaimBodySchema,
  DefinitionBodySchema,
  DiscussionBodySchema,
  ElementBodySchema,
  getPacketBodySchema,
  PacketRefSchema,
  PolicyBodySchema,
  PreferenceBodySchema,
  ReportBodySchema,
} from '@core/schema/packet-body-schemas';
import type { PacketEnvelopeByType } from '@core/schema/packet-body-schemas';

const RESERVED_BODY_KEYS = new Set([
  'packet_id',
  'revision_id',
  'type',
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

const ElementBodySchemaV1_0 = ElementBodySchema.omit({
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
  dependencies_policy: true,
  alignment_policy: true,
  relation_requirements: true,
  default_policy: true,
  governance_policy: true,
});

const PolicyBodySchemaV1_1 = PolicyBodySchema.omit({
  relation_requirements: true,
  default_policy: true,
  governance_policy: true,
});

const PolicyBodySchemaV1_2 = PolicyBodySchema.omit({
  default_policy: true,
  governance_policy: true,
});

const LegacyPolicyBodySchema = PolicyBodySchemaV1_0.omit({
  trust_policy: true,
  write_policy: true,
}).extend({
  trust_policy: z
    .object({
      association_support_threshold: z.number().int().nonnegative().default(1),
      required_support_count: z.number().int().nonnegative().default(2),
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
      action_overrides: z
        .record(z.string().min(1), z.enum(WRITE_PROOF_LEVELS))
        .default({}),
    })
    .strict()
    .nullable()
    .optional(),
  dependencies_policy: z
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
  subtype: true,
  claim_markdown: true,
  supporting_refs: true,
  relation_assertion: true,
  note: true,
}).extend({
  note: z.string().min(1).nullable().optional(),
});

const ClaimBodySchemaV1_0 = ClaimBodySchema.omit({
  subtype: true,
  claim_markdown: true,
  supporting_refs: true,
  relation_assertion: true,
});

const ActionBodySchemaV1_0 = ActionBodySchema.omit({
  parent_action_ref: true,
  child_action_refs: true,
  policy_refs: true,
  template_refs: true,
  default_packet_set_refs: true,
});

const ReportBodySchemaV1_0 = ReportBodySchema.extend({
  subtype: z.enum(['verification_report', 'import_report']),
});

const DiscussionBodySchemaV1_0 = DiscussionBodySchema.refine(
  (body) => body.subtype !== 'post',
  {
    message:
      'Discussion schema 1.0.0 does not support canonical post nodes.',
  }
);

function createDefaultCompatibilityEntry<TType extends PacketType>(
  type: TType
): PacketCompatibilityEntry<TType> {
  return {
    current_schema_version: DEFAULT_SCHEMA_VERSION,
    revision_mode: PACKET_TYPE_REVISION_MODES[type],
    support_level: 'current_only',
    write_target_policy: 'current_only',
    versions: {
      [DEFAULT_SCHEMA_VERSION]: {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, type);
          return getPacketBodySchema(type).parse(body);
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
  let nextBody = body;
  let changed = false;

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'type') &&
    nextBody.type === 'claim'
  ) {
    const { type: _type, ...withoutType } = nextBody;
    nextBody = withoutType;
    changed = true;
  }

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'subtype') &&
    nextBody.subtype === 'relation_assertion'
  ) {
    const { subtype: _subtype, ...withoutSubtype } = nextBody;
    nextBody = withoutSubtype;
    changed = true;
  }

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'claim_markdown') &&
    nextBody.claim_markdown === null
  ) {
    const { claim_markdown: _claimMarkdown, ...withoutClaimMarkdown } = nextBody;
    nextBody = withoutClaimMarkdown;
    changed = true;
  }

  if (
    Array.isArray(nextBody.supporting_refs) &&
    nextBody.supporting_refs.length === 0
  ) {
    const { supporting_refs: _supportingRefs, ...withoutSupportingRefs } = nextBody;
    nextBody = withoutSupportingRefs;
    changed = true;
  }

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'relation_assertion') &&
    nextBody.relation_assertion === null
  ) {
    const { relation_assertion: _relationAssertion, ...withoutRelationAssertion } =
      nextBody;
    nextBody = withoutRelationAssertion;
    changed = true;
  }

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'subtype') &&
    nextBody.subtype === null
  ) {
    const { subtype: _claimKind, ...withoutClaimKind } = nextBody;
    nextBody = withoutClaimKind;
    changed = true;
  }

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'note') &&
    nextBody.note === null
  ) {
    const { note: _note, ...withoutNote } = nextBody;
    nextBody = withoutNote;
    changed = true;
  }

  return changed ? nextBody : null;
}


function stripPolicyV1_1CompatibilityFields(
  body: Record<string, unknown>
): Record<string, unknown> | null {
  let nextBody = body;
  let changed = false;

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'dependencies_policy') &&
    nextBody.dependencies_policy === null
  ) {
    const { dependencies_policy: _dependencyPolicy, ...withoutDependencyPolicy } =
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

  if (
    Object.prototype.hasOwnProperty.call(nextBody, 'relation_requirements') &&
    nextBody.relation_requirements === null
  ) {
    const {
      relation_requirements: _relationRequirements,
      ...withoutRelationRequirements
    } = nextBody;
    nextBody = withoutRelationRequirements;
    changed = true;
  }

  return changed ? nextBody : null;
}

function stripPolicyV1_2CompatibilityFields(
  body: Record<string, unknown>
): {
  body: Record<string, unknown>;
  losses: PacketAdaptationLoss[];
  changed: boolean;
} {
  let nextBody = body;
  let changed = false;
  const losses: PacketAdaptationLoss[] = [];

  for (const field of ['default_policy', 'governance_policy'] as const) {
    if (!Object.prototype.hasOwnProperty.call(nextBody, field)) {
      continue;
    }

    const value = nextBody[field];
    const { [field]: _removed, ...withoutField } = nextBody;
    nextBody = withoutField;
    changed = true;

    if (value !== null) {
      losses.push(
        createAdaptationLoss({
          kind: 'unsupported_target_feature_omission',
          path: `body.${field}`,
          fromSchemaVersion: '1.3.0',
          toSchemaVersion: '1.2.0',
          message: `Dropped non-null ${field} because Policy schema version 1.2.0 does not support reseed-grade semantic policy sections.`,
        })
      );
    }
  }

  return {
    body: nextBody,
    losses,
    changed,
  };
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

function stripActionV1_1CompatibilityFields(
  body: Record<string, unknown>
): {
  body: Record<string, unknown>;
  losses: PacketAdaptationLoss[];
  changed: boolean;
} {
  let nextBody = body;
  let changed = false;
  const losses: PacketAdaptationLoss[] = [];
  const fields = [
    'parent_action_ref',
    'child_action_refs',
    'policy_refs',
    'template_refs',
    'default_packet_set_refs',
  ] as const;

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(nextBody, field)) {
      continue;
    }

    const value = nextBody[field];
    const isEmptyDefault =
      value === null || (Array.isArray(value) && value.length === 0);
    const { [field]: _removed, ...withoutField } = nextBody;
    nextBody = withoutField;
    changed = true;

    if (!isEmptyDefault) {
      losses.push(
        createAdaptationLoss({
          kind: 'unsupported_target_feature_omission',
          path: `body.${field}`,
          fromSchemaVersion: '1.1.0',
          toSchemaVersion: '1.0.0',
          message: `Dropped Action ${field} because schema version 1.0.0 does not support initiative hierarchy/default refs.`,
        })
      );
    }
  }

  return {
    body: nextBody,
    losses,
    changed,
  };
}

export const PACKET_COMPATIBILITY_REGISTRY = {
  Definition: {
    current_schema_version: '0.1.0',
    revision_mode: PACKET_TYPE_REVISION_MODES.Definition,
    support_level: 'current_only',
    write_target_policy: 'current_only',
    versions: {
      '0.1.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Definition');
          return DefinitionBodySchema.parse(body);
        },
      },
    },
  },
  Element: {
    current_schema_version: '1.1.0',
    revision_mode: PACKET_TYPE_REVISION_MODES.Element,
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
          (!bodyHasOwnProperty(body, 'scope_system') ||
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
            ((nextBody ?? currentBody) as Record<string, unknown>).locality !== null
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
              ...currentBody,
              scope_system: null,
              status: null,
              aliases: [],
              display_aliases: [],
              custody_hints: null,
            },
            changes: [
              createAdaptationChange({
                kind: 'added_default_field',
                path: 'body.subtype',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Confirmed canonical element subtype field for forward ontology compatibility.',
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
    current_schema_version: '1.1.0',
    revision_mode: PACKET_TYPE_REVISION_MODES.Claim,
    support_level: 'legacy_supported',
    write_target_policy: 'supported_versions',
    versions: {
      '0.9.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Claim');
          return LegacyClaimBodySchema.parse(body);
        },
        matchesDeclaredCurrentBodyShape: (body) => !bodyHasOwnProperty(body, 'note'),
        next_schema_version: '1.0.0',
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
                      toSchemaVersion: '1.0.0',
                      message:
                        'Normalized missing Claim note field to explicit null.',
                    }),
                  ]
                : [],
          };
        },
      },
      '1.0.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Claim');
          return ClaimBodySchemaV1_0.parse(body);
        },
        previous_schema_version: '0.9.0',
        adaptToPrevious: (body) => {
          const currentBody = ClaimBodySchemaV1_0.parse(body);
          const nextBody = stripCurrentClaimCompatibilityFields(
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
          const currentBody = ClaimBodySchemaV1_0.parse(body);

          return {
            body: {
              subtype: 'relation_assertion',
              target_ref: currentBody.target_ref,
              subject_ref: currentBody.subject_ref,
              scope_ref: currentBody.scope_ref,
              status: currentBody.status,
              claim_markdown: currentBody.note ?? null,
              supporting_refs: [],
              relation_assertion: {
                subtype: 'relation_assertion',
                subject_ref: currentBody.subject_ref,
                target_ref: currentBody.target_ref,
                scope_ref: currentBody.scope_ref,
              },
              note: currentBody.note ?? null,
            },
            changes: [
              createAdaptationChange({
                kind: 'added_default_field',
                path: 'body.subtype',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Confirmed canonical claim subtype field for forward ontology compatibility.',
              }),
              createAdaptationChange({
                kind: 'added_default_field',
                path: 'body.subtype',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added canonical claim subtype field with relation_assertion default.',
              }),
              createAdaptationChange({
                kind: 'added_default_field',
                path: 'body.claim_markdown',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added claim_markdown field using the legacy Claim note value when present.',
              }),
              createAdaptationChange({
                kind: 'added_default_field',
                path: 'body.supporting_refs',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added empty supporting_refs array for forward Claim compatibility.',
              }),
              createAdaptationChange({
                kind: 'added_default_field',
                path: 'body.relation_assertion',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added relation_assertion metadata mirroring the legacy relational Claim body.',
              }),
            ],
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
      '1.1.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Claim');
          return ClaimBodySchema.parse(body);
        },
        previous_schema_version: '1.0.0',
        adaptToPrevious: (body) => {
          const currentBody = ClaimBodySchema.parse(body);
          const losses: PacketAdaptationLoss[] = [];

          if (
            currentBody.subtype !== 'relation_assertion' &&
            currentBody.subtype === null
          ) {
            losses.push(
              createAdaptationLoss({
                kind: 'unsupported_target_feature_omission',
                path: 'body.subtype',
                fromSchemaVersion: '1.1.0',
                toSchemaVersion: '1.0.0',
                message:
                  'Dropping non-relational Claim subtype detail when downcasting to schema version 1.0.0.',
              })
            );
          }

          const relationAssertion =
            currentBody.relation_assertion ??
            (currentBody.subtype && currentBody.subject_ref && currentBody.scope_ref
              ? {
                  subtype: currentBody.subtype,
                  subject_ref: currentBody.subject_ref,
                  target_ref: currentBody.target_ref,
                  scope_ref: currentBody.scope_ref,
                }
              : null);

          const previousBody = {
            subtype:
              currentBody.subtype ?? relationAssertion?.subtype ?? 'relation_assertion',
            subject_ref: currentBody.subject_ref ??
              relationAssertion?.subject_ref ?? {
                packet_id: currentBody.target_ref.packet_id,
              },
            target_ref: currentBody.target_ref,
            scope_ref:
              currentBody.scope_ref ??
              relationAssertion?.scope_ref ??
              currentBody.target_ref,
            status: currentBody.status,
            note: currentBody.note ?? currentBody.claim_markdown ?? null,
          };

          return {
            body:
              stripCurrentClaimCompatibilityFields(
                previousBody as Record<string, unknown>
              ) ?? previousBody,
            changes: [],
            losses,
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
  Report: {
    current_schema_version: '1.1.0',
    revision_mode: PACKET_TYPE_REVISION_MODES.Report,
    support_level: 'legacy_supported',
    write_target_policy: 'supported_versions',
    versions: {
      '1.0.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Report');
          return ReportBodySchemaV1_0.parse(body);
        },
        next_schema_version: '1.1.0',
        adaptToNext: (body) => ({
          body: ReportBodySchemaV1_0.parse(body),
          changes: [
            createAdaptationChange({
              kind: 'schema_version_bump',
              path: 'body.subtype',
              fromSchemaVersion: '1.0.0',
              toSchemaVersion: '1.1.0',
              message:
                'Report schema now reserves decision_report as a governance closure report subtype.',
            }),
          ],
        }),
      },
      '1.1.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Report');
          return ReportBodySchema.parse(body);
        },
        previous_schema_version: '1.0.0',
        adaptToPrevious: (body) => {
          const currentBody = ReportBodySchema.parse(body);

          if (currentBody.subtype !== 'decision_report') {
            return {
              body: currentBody,
              changes: [],
              losses: [],
            };
          }

          return {
            body: {
              ...currentBody,
              subtype: 'import_report',
              report_data: {
                ...currentBody.report_data,
                original_report_subtype: 'decision_report',
              },
            },
            changes: [
              createAdaptationChange({
                kind: 'renamed_field',
                path: 'body.subtype',
                fromSchemaVersion: '1.1.0',
                toSchemaVersion: '1.0.0',
                message:
                  'Projected decision_report to import_report for schema 1.0.0 compatibility.',
              }),
            ],
            losses: [
              createAdaptationLoss({
                kind: 'unsupported_target_feature_omission',
                path: 'body.subtype',
                fromSchemaVersion: '1.1.0',
                toSchemaVersion: '1.0.0',
                message:
                  'Schema version 1.0.0 cannot preserve decision_report subtype semantics.',
              }),
            ],
          };
        },
      },
    },
  },
  Proposal: createDefaultCompatibilityEntry('Proposal'),
  Reaction: createDefaultCompatibilityEntry('Reaction'),
  Decision: createDefaultCompatibilityEntry('Decision'),
  Action: {
    current_schema_version: '1.1.0',
    revision_mode: PACKET_TYPE_REVISION_MODES.Action,
    support_level: 'legacy_supported',
    write_target_policy: 'supported_versions',
    versions: {
      '1.0.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Action');
          return ActionBodySchemaV1_0.parse(body);
        },
        next_schema_version: '1.1.0',
        adaptToNext: (body) => {
          const currentBody = ActionBodySchemaV1_0.parse(body);

          return {
            body: {
              ...currentBody,
              parent_action_ref: null,
              child_action_refs: [],
              policy_refs: [],
              template_refs: [],
              default_packet_set_refs: [],
            },
            changes: [
              createAdaptationChange({
                kind: 'normalized_null_default',
                path: 'body.parent_action_ref',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added parent_action_ref for the forward Action initiative hierarchy.',
              }),
              createAdaptationChange({
                kind: 'added_default_field',
                path: 'body.child_action_refs',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added empty child_action_refs for the forward Action initiative hierarchy.',
              }),
              createAdaptationChange({
                kind: 'added_default_field',
                path: 'body.policy_refs',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added empty policy_refs so initiative Actions can carry packet-backed policy overrides.',
              }),
              createAdaptationChange({
                kind: 'added_default_field',
                path: 'body.template_refs',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added empty template_refs so initiative Actions can carry packet-backed defaults.',
              }),
              createAdaptationChange({
                kind: 'added_default_field',
                path: 'body.default_packet_set_refs',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Added empty default_packet_set_refs for bundle-backed initiative defaults.',
              }),
            ],
          };
        },
      },
      '1.1.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Action');
          return ActionBodySchema.parse(body);
        },
        previous_schema_version: '1.0.0',
        adaptToPrevious: (body) => {
          const currentBody = ActionBodySchema.parse(body);
          const stripped = stripActionV1_1CompatibilityFields(
            currentBody as Record<string, unknown>
          );

          return {
            body: stripped.changed ? stripped.body : currentBody,
            changes: [],
            losses: stripped.losses,
          };
        },
        createUnsignedPacketCandidate: (packet) => {
          const stripped = stripActionV1_1CompatibilityFields(
            packet.body as Record<string, unknown>
          );

          if (!stripped.changed || stripped.losses.length > 0) {
            return null;
          }

          return {
            ...packet,
            body: stripped.body,
          } as PacketEnvelopeByType['Action'];
        },
      },
    },
  },
  Preference: {
    current_schema_version: '0.1.0',
    revision_mode: PACKET_TYPE_REVISION_MODES.Preference,
    support_level: 'current_only',
    write_target_policy: 'current_only',
    versions: {
      '0.1.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Preference');
          return PreferenceBodySchema.parse(body);
        },
      },
    },
  },
  Policy: {
    current_schema_version: '1.3.0',
    revision_mode: PACKET_TYPE_REVISION_MODES.Policy,
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
            changes: [
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
          (!bodyHasOwnProperty(body, 'dependencies_policy') ||
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
              dependencies_policy: null,
              alignment_policy: null,
            },
            changes: [
              createAdaptationChange({
                kind: 'normalized_null_default',
                path: 'body.dependencies_policy',
                fromSchemaVersion: '1.0.0',
                toSchemaVersion: '1.1.0',
                message:
                  'Normalized missing dependencies_policy field to explicit null.',
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
          return PolicyBodySchemaV1_1.parse(body);
        },
        previous_schema_version: '1.0.0',
        adaptToPrevious: (body) => {
          const currentBody = PolicyBodySchemaV1_1.parse(body);
          const nextBody = stripPolicyV1_0CompatibilityFields(
            currentBody as Record<string, unknown>
          );

          return {
            body: nextBody ?? currentBody,
            changes: [],
            losses: [],
          };
        },
        next_schema_version: '1.2.0',
        adaptToNext: (body) => {
          const currentBody = PolicyBodySchemaV1_1.parse(body);

          return {
            body: {
              ...currentBody,
              relation_requirements: null,
            },
            changes: [
              createAdaptationChange({
                kind: 'normalized_null_default',
                path: 'body.relation_requirements',
                fromSchemaVersion: '1.1.0',
                toSchemaVersion: '1.2.0',
                message:
                  'Normalized missing relation_requirements field to explicit null.',
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
      '1.2.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Policy');
          return PolicyBodySchemaV1_2.parse(body);
        },
        previous_schema_version: '1.1.0',
        adaptToPrevious: (body) => {
          const currentBody = PolicyBodySchemaV1_2.parse(body);
          const nextBody = stripPolicyV1_1CompatibilityFields(
            currentBody as Record<string, unknown>
          );

          return {
            body: nextBody ?? currentBody,
            changes: [],
            losses: [],
          };
        },
        next_schema_version: '1.3.0',
        adaptToNext: (body) => {
          const currentBody = PolicyBodySchemaV1_2.parse(body);

          return {
            body: {
              ...currentBody,
              default_policy: null,
              governance_policy: null,
            },
            changes: [
              createAdaptationChange({
                kind: 'normalized_null_default',
                path: 'body.default_policy',
                fromSchemaVersion: '1.2.0',
                toSchemaVersion: '1.3.0',
                message:
                  'Normalized missing default_policy field to explicit null for packet-backed default inheritance semantics.',
              }),
              createAdaptationChange({
                kind: 'normalized_null_default',
                path: 'body.governance_policy',
                fromSchemaVersion: '1.2.0',
                toSchemaVersion: '1.3.0',
                message:
                  'Normalized missing governance_policy field to explicit null for governance hook semantics.',
              }),
            ],
          };
        },
        createUnsignedPacketCandidate: (packet) => {
          const nextBody = stripPolicyV1_1CompatibilityFields(
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
      '1.3.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Policy');
          return PolicyBodySchema.parse(body);
        },
        previous_schema_version: '1.2.0',
        adaptToPrevious: (body) => {
          const currentBody = PolicyBodySchema.parse(body);
          const stripped = stripPolicyV1_2CompatibilityFields(
            currentBody as Record<string, unknown>
          );

          return {
            body: stripped.changed ? stripped.body : currentBody,
            changes: [],
            losses: stripped.losses,
          };
        },
        createUnsignedPacketCandidate: (packet) => {
          const stripped = stripPolicyV1_2CompatibilityFields(
            packet.body as Record<string, unknown>
          );

          if (!stripped.changed || stripped.losses.length > 0) {
            return null;
          }

          return {
            ...packet,
            body: stripped.body,
          } as PacketEnvelopeByType['Policy'];
        },
      },
    },
  },
  Discussion: {
    current_schema_version: '1.1.0',
    revision_mode: PACKET_TYPE_REVISION_MODES.Discussion,
    support_level: 'legacy_supported',
    write_target_policy: 'supported_versions',
    versions: {
      '1.0.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Discussion');
          return DiscussionBodySchemaV1_0.parse(body);
        },
        next_schema_version: '1.1.0',
        adaptToNext: (body) => ({
          body: DiscussionBodySchemaV1_0.parse(body),
          changes: [
            createAdaptationChange({
              kind: 'schema_version_bump',
              path: 'body.subtype',
              fromSchemaVersion: '1.0.0',
              toSchemaVersion: '1.1.0',
              message:
                'Discussion schema now supports canonical post nodes for top-level multimedia forum artifacts.',
            }),
          ],
        }),
      },
      '1.1.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Discussion');
          return DiscussionBodySchema.parse(body);
        },
        previous_schema_version: '1.0.0',
        adaptToPrevious: (body) => {
          const currentBody = DiscussionBodySchema.parse(body);

          if (currentBody.subtype !== 'post') {
            return {
              body: currentBody,
              changes: [],
              losses: [],
            };
          }

          return {
            body: {
              kind: 'message',
              role: currentBody.role,
              title: currentBody.title,
              summary: currentBody.summary ?? null,
              status: currentBody.status,
              parent_ref: currentBody.parent_ref,
              topic_ref: currentBody.parent_ref,
              root_message_ref: null,
              content_markdown:
                currentBody.content_markdown ??
                currentBody.summary ??
                currentBody.title,
            },
            changes: [
              createAdaptationChange({
                kind: 'renamed_field',
                path: 'body.subtype',
                fromSchemaVersion: '1.1.0',
                toSchemaVersion: '1.0.0',
                message:
                  'Projected canonical Discussion post to root message shape for schema 1.0.0 compatibility.',
              }),
            ],
            losses: [
              createAdaptationLoss({
                kind: 'unsupported_target_feature_omission',
                path: 'body.subtype',
                fromSchemaVersion: '1.1.0',
                toSchemaVersion: '1.0.0',
                message:
                  'Schema version 1.0.0 cannot preserve first-class Discussion post semantics.',
              }),
              ...(currentBody.attachment_refs.length > 0
                ? [
                    createAdaptationLoss({
                      kind: 'unsupported_target_feature_omission',
                      path: 'body.attachment_refs',
                      fromSchemaVersion: '1.1.0',
                      toSchemaVersion: '1.0.0',
                      message:
                        'Schema version 1.0.0 cannot preserve post attachment refs.',
                    }),
                  ]
                : []),
            ],
          };
        },
      },
    },
  },
  Bundle: {
    current_schema_version: '0.1.0',
    revision_mode: PACKET_TYPE_REVISION_MODES.Bundle,
    support_level: 'current_only',
    write_target_policy: 'current_only',
    versions: {
      '0.1.0': {
        parseBody: (body) => {
          rejectHeaderBodyCollisions(body, 'Bundle');
          return BundleBodySchema.parse(body);
        },
      },
    },
  },
} satisfies {
  [TType in PacketType]: PacketCompatibilityEntry<TType>;
};

export function rejectHeaderBodyCollisions(
  body: unknown,
  type: PacketType
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
          message: `Body field collides with reserved header field for ${type}.`,
        },
      ]);
    }
  });
}

export function getPacketVersionDefinition<TType extends PacketType>(
  type: TType,
  schemaVersion: string
): PacketSchemaVersionDefinition<TType> {
  const versions = PACKET_COMPATIBILITY_REGISTRY[type]
    .versions as Record<string, PacketSchemaVersionDefinition<TType>>;
  const versionDefinition = versions[schemaVersion];

  if (!versionDefinition) {
    throw new PacketCompatibilityError({
      code: 'unsupported_schema_version',
      type,
      sourceSchemaVersion: schemaVersion,
      targetSchemaVersion: schemaVersion,
      message: `Unsupported schema version ${schemaVersion} for packet type ${type}.`,
    });
  }

  return versionDefinition;
}

export function getPacketTypeRevisionMode(
  type: PacketType
): PacketRevisionMode {
  return PACKET_COMPATIBILITY_REGISTRY[type].revision_mode;
}

export function getPacketCompatibilityAuditSummary(
  type: PacketType
): PacketCompatibilityAuditSummary {
  const typeEntry = PACKET_COMPATIBILITY_REGISTRY[type];
  const supportedSchemaVersions = Object.keys(typeEntry.versions).sort();

  return {
    type,
    current_schema_version: typeEntry.current_schema_version,
    revision_mode: typeEntry.revision_mode,
    support_level: typeEntry.support_level,
    write_target_policy: typeEntry.write_target_policy,
    supported_schema_versions: supportedSchemaVersions,
    has_legacy_versions: supportedSchemaVersions.some(
      (schemaVersion) => schemaVersion !== typeEntry.current_schema_version
    ),
    has_write_preparation: Object.values(typeEntry.versions).some(
      (versionDefinition) =>
        typeof versionDefinition.createUnsignedPacketCandidate === 'function'
    ),
  };
}

export function listPacketCompatibilityAuditSummaries(): PacketCompatibilityAuditSummary[] {
  return PACKET_TYPES.map((type) => getPacketCompatibilityAuditSummary(type));
}

export function getPacketCurrentSchemaVersion(type: PacketType): string {
  return PACKET_COMPATIBILITY_REGISTRY[type].current_schema_version;
}

