/**
 * File: relations.ts
 * Description: Portable relation-packet helpers for deterministic relation ids, revisions, and semantic projections.
 */

import type {
  PacketEnvelopeByType,
  PacketRevisionRef,
  PacketRef,
  RelationStatus,
  RelationSubscriptionOptionsInput,
} from '../schema/packet-schema.ts';
import { createRelationPacket } from './builders.ts';

export type RelationSemanticProfile = {
  relationSubtype: string;
  effectiveFollow: boolean;
  effectiveSubscribe: boolean;
  effectiveParticipate: boolean;
  standingKind: 'none' | 'association' | 'residency' | 'location' | 'containment';
  notes: string[];
};

export type SubscriptionAlignmentState = 'aligned' | 'partially_aligned' | 'needs_review';

export type SubscriptionAlignmentProjection = {
  relationSubtype: string;
  effectiveFollow: boolean;
  effectiveSubscribe: boolean;
  effectiveParticipate: boolean;
  alignmentState: SubscriptionAlignmentState;
  inheritedRefs: {
    policy_refs: PacketRef[];
    defaults_definition_refs: PacketRef[];
    dependencies_definition_refs: PacketRef[];
    module_refs: PacketRef[];
    template_refs: PacketRef[];
    default_packet_set_refs: PacketRef[];
  };
  excludedRefs: {
    policy_refs: PacketRef[];
    defaults_definition_refs: PacketRef[];
    dependencies_definition_refs: PacketRef[];
    module_refs: PacketRef[];
    template_refs: PacketRef[];
    default_packet_set_refs: PacketRef[];
  };
  warnings: string[];
};

type SubscriptionAlignmentInput = {
  relationSubtype: string;
  subscriptionOptions?: RelationSubscriptionOptionsInput | null;
  requiredPolicyRefs?: PacketRef[];
  requiredDefaultsDefinitionRefs?: PacketRef[];
  requiredDependenciesDefinitionRefs?: PacketRef[];
  defaultPolicyRefs?: PacketRef[];
  defaultDefaultsDefinitionRefs?: PacketRef[];
  defaultDependenciesDefinitionRefs?: PacketRef[];
  defaultModuleRefs?: PacketRef[];
  defaultTemplateRefs?: PacketRef[];
  defaultPacketSetRefs?: PacketRef[];
};

function encodePacketId(packetId: string): string {
  return encodeURIComponent(packetId);
}

function dedupeScopeRefs(scopeRefs: PacketRef[]): PacketRef[] {
  const seenPacketIds = new Set<string>();

  return scopeRefs.filter((scopeRef) => {
    if (seenPacketIds.has(scopeRef.packet_id)) {
      return false;
    }

    seenPacketIds.add(scopeRef.packet_id);
    return true;
  });
}

function dedupeRefs(refs: PacketRef[]): PacketRef[] {
  const seenPacketIds = new Set<string>();

  return refs.filter((ref) => {
    if (seenPacketIds.has(ref.packet_id)) {
      return false;
    }

    seenPacketIds.add(ref.packet_id);
    return true;
  });
}

function filterExcludedRefs(refs: PacketRef[], excludedRefs: PacketRef[]): PacketRef[] {
  const excludedPacketIds = new Set(excludedRefs.map((ref) => ref.packet_id));
  return refs.filter((ref) => !excludedPacketIds.has(ref.packet_id));
}

function findMissingRefs(requiredRefs: PacketRef[], effectiveRefs: PacketRef[]): PacketRef[] {
  const effectivePacketIds = new Set(effectiveRefs.map((ref) => ref.packet_id));
  return requiredRefs.filter((requiredRef) => !effectivePacketIds.has(requiredRef.packet_id));
}

export function getRelationSemanticProfile(subtype: string): RelationSemanticProfile {
  if (subtype === 'follow') {
    return {
      relationSubtype: subtype,
      effectiveFollow: true,
      effectiveSubscribe: false,
      effectiveParticipate: false,
      standingKind: 'none',
      notes: ['Lightweight visibility/read relation.'],
    };
  }

  if (subtype === 'subscription') {
    return {
      relationSubtype: subtype,
      effectiveFollow: true,
      effectiveSubscribe: true,
      effectiveParticipate: false,
      standingKind: 'none',
      notes: ['Sync/adoption relation; may inherit selected upstream defaults.'],
    };
  }

  if (subtype === 'participation') {
    return {
      relationSubtype: subtype,
      effectiveFollow: true,
      effectiveSubscribe: true,
      effectiveParticipate: true,
      standingKind: 'none',
      notes: ['Contribution relation; policies decide exact write rights.'],
    };
  }

  if (subtype === 'association') {
    return {
      relationSubtype: subtype,
      effectiveFollow: true,
      effectiveSubscribe: false,
      effectiveParticipate: false,
      standingKind: 'association',
      notes: ['Contextual standing relation; policies decide access.'],
    };
  }

  if (subtype === 'residence') {
    return {
      relationSubtype: subtype,
      effectiveFollow: true,
      effectiveSubscribe: true,
      effectiveParticipate: true,
      standingKind: 'residency',
      notes: ['Residency/locality standing relation; policies decide exact access and voting rights.'],
    };
  }

  if (subtype === 'defined_by_location') {
    return {
      relationSubtype: subtype,
      effectiveFollow: false,
      effectiveSubscribe: false,
      effectiveParticipate: false,
      standingKind: 'location',
      notes: ['Location-definition relation used by locality projection.'],
    };
  }

  if (
    subtype === 'contains' ||
    subtype === 'overlaps' ||
    subtype === 'equivalent_to' ||
    subtype === 'default_ancestry_parent'
  ) {
    return {
      relationSubtype: subtype,
      effectiveFollow: false,
      effectiveSubscribe: false,
      effectiveParticipate: false,
      standingKind: 'containment',
      notes: ['Graph/ancestry relation; policies decide any access behavior.'],
    };
  }

  return {
    relationSubtype: subtype,
    effectiveFollow: false,
    effectiveSubscribe: false,
    effectiveParticipate: false,
    standingKind: 'none',
    notes: ['Unknown relation subtype; no effective capabilities are inferred.'],
  };
}

export function resolveSubscriptionAlignment(
  input: SubscriptionAlignmentInput
): SubscriptionAlignmentProjection {
  const profile = getRelationSemanticProfile(input.relationSubtype);
  const options = input.subscriptionOptions ?? {};

  if (input.relationSubtype !== 'subscription') {
    return {
      relationSubtype: input.relationSubtype,
      effectiveFollow: profile.effectiveFollow,
      effectiveSubscribe: profile.effectiveSubscribe,
      effectiveParticipate: profile.effectiveParticipate,
      alignmentState: 'needs_review',
      inheritedRefs: {
        policy_refs: [],
        defaults_definition_refs: [],
        dependencies_definition_refs: [],
        module_refs: [],
        template_refs: [],
        default_packet_set_refs: [],
      },
      excludedRefs: {
        policy_refs: [],
        defaults_definition_refs: [],
        dependencies_definition_refs: [],
        module_refs: [],
        template_refs: [],
        default_packet_set_refs: [],
      },
      warnings: ['Subscription alignment projection only resolves subscription relations.'],
    };
  }

  const excludedPolicyRefs = options.excluded_policy_refs ?? [];
  const excludedDefaultsDefinitionRefs = options.excluded_defaults_definition_refs ?? [];
  const excludedDependenciesDefinitionRefs = options.excluded_dependencies_definition_refs ?? [];
  const excludedModuleRefs = options.excluded_module_refs ?? [];
  const excludedTemplateRefs = options.excluded_template_refs ?? [];
  const excludedPacketSetRefs = options.excluded_default_packet_set_refs ?? [];

  const inheritPolicies = options.inherit_default_policies ?? true;
  const inheritDependencies = options.inherit_default_dependencies ?? true;
  const inheritDefaults = options.inherit_default_defaults ?? true;
  const inheritModules = options.inherit_default_modules ?? true;
  const inheritTemplates = options.inherit_default_templates ?? true;
  const inheritPacketSets = options.inherit_default_packet_sets ?? true;

  const effectivePolicyRefs = filterExcludedRefs(
    dedupeRefs([
      ...(inheritPolicies ? input.defaultPolicyRefs ?? [] : []),
      ...(inheritPolicies ? input.requiredPolicyRefs ?? [] : []),
      ...(options.included_policy_refs ?? []),
    ]),
    excludedPolicyRefs
  );
  const effectiveDefaultsDefinitionRefs = filterExcludedRefs(
    dedupeRefs([
      ...(inheritDefaults ? input.defaultDefaultsDefinitionRefs ?? [] : []),
      ...(inheritDefaults ? input.requiredDefaultsDefinitionRefs ?? [] : []),
      ...(options.included_defaults_definition_refs ?? []),
    ]),
    excludedDefaultsDefinitionRefs
  );
  const effectiveDependenciesDefinitionRefs = filterExcludedRefs(
    dedupeRefs([
      ...(inheritDependencies ? input.defaultDependenciesDefinitionRefs ?? [] : []),
      ...(inheritDependencies ? input.requiredDependenciesDefinitionRefs ?? [] : []),
      ...(options.included_dependencies_definition_refs ?? []),
    ]),
    excludedDependenciesDefinitionRefs
  );
  const effectiveModuleRefs = filterExcludedRefs(
    dedupeRefs([
      ...(inheritModules ? input.defaultModuleRefs ?? [] : []),
      ...(options.included_module_refs ?? []),
    ]),
    excludedModuleRefs
  );
  const effectiveTemplateRefs = filterExcludedRefs(
    dedupeRefs([
      ...(inheritTemplates ? input.defaultTemplateRefs ?? [] : []),
      ...(options.included_template_refs ?? []),
    ]),
    excludedTemplateRefs
  );
  const effectivePacketSetRefs = filterExcludedRefs(
    dedupeRefs([
      ...(inheritPacketSets ? input.defaultPacketSetRefs ?? [] : []),
      ...(options.included_default_packet_set_refs ?? []),
    ]),
    excludedPacketSetRefs
  );

  const missingRequiredPolicyRefs = findMissingRefs(
    input.requiredPolicyRefs ?? [],
    effectivePolicyRefs
  );
  const missingRequiredDefaultsDefinitionRefs = findMissingRefs(
    input.requiredDefaultsDefinitionRefs ?? [],
    effectiveDefaultsDefinitionRefs
  );
  const missingRequiredDependenciesDefinitionRefs = findMissingRefs(
    input.requiredDependenciesDefinitionRefs ?? [],
    effectiveDependenciesDefinitionRefs
  );
  const warnings = [
    ...missingRequiredPolicyRefs.map(
      (ref) => `Required policy is not included in subscription alignment: ${ref.packet_id}`
    ),
    ...missingRequiredDefaultsDefinitionRefs.map(
      (ref) => `Required defaults definition is not included in subscription alignment: ${ref.packet_id}`
    ),
    ...missingRequiredDependenciesDefinitionRefs.map(
      (ref) => `Required dependency is not included in subscription alignment: ${ref.packet_id}`
    ),
  ];

  return {
    relationSubtype: input.relationSubtype,
    effectiveFollow: profile.effectiveFollow,
    effectiveSubscribe: profile.effectiveSubscribe,
    effectiveParticipate: profile.effectiveParticipate,
    alignmentState: warnings.length > 0 ? 'partially_aligned' : 'aligned',
    inheritedRefs: {
      policy_refs: effectivePolicyRefs,
      defaults_definition_refs: effectiveDefaultsDefinitionRefs,
      dependencies_definition_refs: effectiveDependenciesDefinitionRefs,
      module_refs: effectiveModuleRefs,
      template_refs: effectiveTemplateRefs,
      default_packet_set_refs: effectivePacketSetRefs,
    },
    excludedRefs: {
      policy_refs: excludedPolicyRefs,
      defaults_definition_refs: excludedDefaultsDefinitionRefs,
      dependencies_definition_refs: excludedDependenciesDefinitionRefs,
      module_refs: excludedModuleRefs,
      template_refs: excludedTemplateRefs,
      default_packet_set_refs: excludedPacketSetRefs,
    },
    warnings,
  };
}

export function createRelationPacketId(input: {
  subtype: string;
  subjectPacketId: string;
  targetPacketId: string;
  scopePacketId?: string | null;
}): string {
  return `nexus:relation/${input.subtype}/${encodePacketId(
    input.subjectPacketId
  )}--${encodePacketId(input.targetPacketId)}--${encodePacketId(
    input.scopePacketId ?? 'none'
  )}`;
}

export function createRelationRevisionId(
  packetId: string,
  currentRevisionId?: string | null
): string {
  const match = currentRevisionId?.match(/@r(\d+)$/);
  const revisionNumber = match ? Number.parseInt(match[1], 10) + 1 : 1;

  return `${packetId}@r${revisionNumber}`;
}

export function createScopedRelationPacket(input: {
  subtype: string;
  subjectPacketId: string;
  targetPacketId: string;
  scopePacketId?: string | null;
  applicableScopeRefs?: PacketRef[];
  createdByPacketId: string;
  createdAt?: string;
  note?: string | null;
  status?: RelationStatus;
  packetId?: string;
  parentRevisionRefs?: PacketRevisionRef[];
  supportingRefs?: PacketRef[];
  policyRef?: PacketRef | null;
  termsRef?: PacketRef | null;
  subscriptionOptions?: RelationSubscriptionOptionsInput | null;
}): PacketEnvelopeByType['Relation'] {
  const packetId =
    input.packetId ??
    createRelationPacketId({
      subtype: input.subtype,
      subjectPacketId: input.subjectPacketId,
      targetPacketId: input.targetPacketId,
      scopePacketId: input.scopePacketId ?? null,
    });
  const createdAt = input.createdAt ?? new Date().toISOString();
  const scopeRefs = input.scopePacketId
    ? dedupeScopeRefs([
        {
          packet_id: input.scopePacketId,
        },
        ...(input.applicableScopeRefs ?? []),
      ])
    : dedupeScopeRefs(input.applicableScopeRefs ?? []);

  return createRelationPacket({
    packet_id: packetId,
    revision_id: createRelationRevisionId(
      packetId,
      input.parentRevisionRefs?.[0]?.revision_id ?? null
    ),
    created_at: createdAt,
    parent_revision_refs: input.parentRevisionRefs ?? [],
    authority_scope_ref: input.scopePacketId
      ? {
          packet_id: input.scopePacketId,
        }
      : null,
    applicable_scope_refs: scopeRefs,
    created_by: {
      packet_id: input.createdByPacketId,
    },
    metadata_tags: ['relation', input.subtype.replace(/_/g, '-')],
    subtype: input.subtype,
    subject_ref: {
      packet_id: input.subjectPacketId,
    },
    target_ref: {
      packet_id: input.targetPacketId,
    },
    scope_ref: input.scopePacketId
      ? {
          packet_id: input.scopePacketId,
        }
      : null,
    status: input.status ?? 'active',
    supporting_refs: input.supportingRefs ?? [],
    policy_ref: input.policyRef ?? null,
    terms_ref: input.termsRef ?? null,
    note: input.note ?? null,
    subscription_options: input.subscriptionOptions ?? null,
  });
}
