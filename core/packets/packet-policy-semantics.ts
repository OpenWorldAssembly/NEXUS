/**
 * File: packet-policy-semantics.ts
 * Description: Packet-backed policy and dependency semantic authority helpers for pre-reseed audits.
 */

import { MUTATION_ACTION_IDS } from '@core/auth/write-policy.ts';
import type { PacketTypeDefinition } from '@core/packets/definitions/packet-definition-types.ts';
import {
  PACKET_WORKFLOW_DEPENDENCY_IDS,
  PACKET_WORKFLOW_POLICY_ACTION_IDS,
  TRUSTED_PACKET_PLANNER_CAPABILITIES,
} from '@core/packets/packet-workflow-planner.ts';
import type { PacketEnvelopeByType, PacketRef } from '@core/schema/packet-schema';

export type PacketPolicySemanticKind =
  | 'write_lock'
  | 'trust_baseline'
  | 'relation_requirements'
  | 'dependency_policy'
  | 'alignment_policy'
  | 'default_inheritance'
  | 'governance';

export type PacketPolicySemanticDescriptor = {
  semantic_kind: PacketPolicySemanticKind;
  policy_subtype: string;
  packet_type: 'Policy';
  section_key:
    | 'write_policy'
    | 'trust_policy'
    | 'relation_requirements'
    | 'dependency_policy'
    | 'alignment_policy'
    | 'default_policy'
    | 'governance_policy';
  live_enforcement: 'active' | 'definition_audit';
  notes: string;
};

export type ResolvedPolicyPacketSemantics = {
  policy_packet_id: string;
  policy_subtype: string;
  semantic_kinds: PacketPolicySemanticKind[];
  write_policy_action_ids: string[];
  trust_gate_ids: string[];
  relation_requirement_subtypes: string[];
  dependency_ref_ids: string[];
  alignment_action_ref_ids: string[];
  default_ref_ids: string[];
  governance_hooks: string[];
};

export type PacketDependencySemanticAnchorKind =
  | 'definition_dependency_part'
  | 'policy_packet_semantics'
  | 'operation_ontology'
  | 'workflow_resolver'
  | 'trusted_runtime_capability';

export type PacketDependencySemanticDescriptor = {
  dependency_id: string;
  anchor_kind: PacketDependencySemanticAnchorKind;
  packet_type: string | null;
  trusted_capability_ids: string[];
  definition_part_ids: string[];
  runtime_metadata_only: boolean;
  notes: string;
};

export type PacketSemanticAuthorityAuditFinding = {
  severity: 'error';
  code: string;
  subject_id: string;
  message: string;
};

export type PacketPolicyAuthorityAuditReport = {
  status: 'pass' | 'fail';
  checked_policy_packet_ids: string[];
  checked_semantic_kinds: PacketPolicySemanticKind[];
  findings: PacketSemanticAuthorityAuditFinding[];
};

export type PacketDependencyAuthorityAuditReport = {
  status: 'pass' | 'fail';
  checked_dependency_ids: string[];
  findings: PacketSemanticAuthorityAuditFinding[];
};

const POLICY_SEMANTIC_DESCRIPTORS: PacketPolicySemanticDescriptor[] = [
  {
    semantic_kind: 'write_lock',
    policy_subtype: 'write_lock',
    packet_type: 'Policy',
    section_key: 'write_policy',
    live_enforcement: 'active',
    notes:
      'Live write-lock enforcement is resolved by MutationPolicyGate and core write-policy helpers.',
  },
  {
    semantic_kind: 'trust_baseline',
    policy_subtype: 'trust_baseline',
    packet_type: 'Policy',
    section_key: 'trust_policy',
    live_enforcement: 'definition_audit',
    notes:
      'Trust baseline thresholds drive current read projections and future governance gates.',
  },
  {
    semantic_kind: 'relation_requirements',
    policy_subtype: 'relation_requirements',
    packet_type: 'Policy',
    section_key: 'relation_requirements',
    live_enforcement: 'active',
    notes:
      'Relation legitimacy requirements are evaluated by trusted relation policy helpers.',
  },
  {
    semantic_kind: 'dependency_policy',
    policy_subtype: 'dependency_policy',
    packet_type: 'Policy',
    section_key: 'dependency_policy',
    live_enforcement: 'definition_audit',
    notes:
      'Dependency policies describe required packet refs and relation subtypes for reseed readiness.',
  },
  {
    semantic_kind: 'alignment_policy',
    policy_subtype: 'alignment_policy',
    packet_type: 'Policy',
    section_key: 'alignment_policy',
    live_enforcement: 'definition_audit',
    notes:
      'Alignment policies describe accepted action/initiative lineage requirements.',
  },
  {
    semantic_kind: 'default_inheritance',
    policy_subtype: 'default_inheritance',
    packet_type: 'Policy',
    section_key: 'default_policy',
    live_enforcement: 'definition_audit',
    notes:
      'Default inheritance policies carry packet refs for policies, templates, bundles, and preference defaults.',
  },
  {
    semantic_kind: 'governance',
    policy_subtype: 'governance',
    packet_type: 'Policy',
    section_key: 'governance_policy',
    live_enforcement: 'definition_audit',
    notes:
      'Governance policies reserve quorum, eligibility, threshold, vote method, and decision-report hooks.',
  },
];

const OPERATION_DEPENDENCY_PACKET_TYPES: Record<string, string> = {
  'generic.operation.relation': 'Relation',
  'generic.operation.claim': 'Claim',
  'generic.operation.attestation': 'Attestation',
  'generic.operation.discussion': 'Discussion',
  'generic.operation.projection': 'Definition',
  'generic.operation.bundle': 'Bundle',
  'generic.operation.policy': 'Policy',
  'generic.operation.action': 'Action',
  'generic.operation.report': 'Report',
  'generic.compatibility_projection': 'Definition',
};

const DEFINITION_PART_DEPENDENCY_PACKET_TYPES: Record<string, string> = {
  'generic.packet.builder_pipeline': 'Definition',
  'generic.packet.definition_action_bridge': 'Definition',
  'generic.packet_type.body_builder_registry': 'Definition',
  'core.definition_bootstrap.v0': 'Definition',
  'generic.bundle.builder': 'Bundle',
  'generic.preference.builder': 'Preference',
  'generic.preference.latest_active_planner': 'Preference',
  'runtime.scope_display_projection': 'Preference',
  'runtime.shell_chrome_projection': 'Preference',
};

const WORKFLOW_RESOLVER_DEPENDENCY_IDS = new Set([
  'generic.resolver.actor_ref',
  'generic.resolver.packet_ref',
  'generic.resolver.input_value',
  'generic.resolver.static_value',
  'generic.resolver.relation_lookup',
  'generic.resolver.target_summary',
  'generic.resolver.discussion_thread',
  'generic.resolver.role_scope',
  'generic.resolver.projection',
]);

const POLICY_SEMANTIC_DEPENDENCY_IDS = new Set<string>(['runtime.policy_gate']);

const TRUSTED_RUNTIME_DEPENDENCY_IDS = new Set([
  'runtime.packet_store.read',
  'runtime.discussion_service.read',
  'runtime.planner.scoped_relation',
  'runtime.planner.discussion_reply',
]);

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function refIds(refs: readonly PacketRef[] | null | undefined): string[] {
  return refs?.map((ref) => ref.packet_id) ?? [];
}

export function listPacketPolicySemanticDescriptors(): PacketPolicySemanticDescriptor[] {
  return [...POLICY_SEMANTIC_DESCRIPTORS];
}

export function resolvePolicyPacketSemantics(
  policyPacket: PacketEnvelopeByType['Policy']
): ResolvedPolicyPacketSemantics {
  const body = policyPacket.body;
  const semanticKinds: PacketPolicySemanticKind[] = [];

  if (body.write_policy) semanticKinds.push('write_lock');
  if (body.trust_policy) semanticKinds.push('trust_baseline');
  if (body.relation_requirements) semanticKinds.push('relation_requirements');
  if (body.dependency_policy) semanticKinds.push('dependency_policy');
  if (body.alignment_policy) semanticKinds.push('alignment_policy');
  if (body.default_policy) semanticKinds.push('default_inheritance');
  if (body.governance_policy) semanticKinds.push('governance');

  return {
    policy_packet_id: policyPacket.header.packet_id,
    policy_subtype: body.subtype,
    semantic_kinds: uniqueSorted(semanticKinds) as PacketPolicySemanticKind[],
    write_policy_action_ids: body.write_policy
      ? uniqueSorted([
          ...Object.keys(body.write_policy.action_overrides),
          ...MUTATION_ACTION_IDS,
        ])
      : [],
    trust_gate_ids: body.trust_policy
      ? [
          body.trust_policy.posting_gate,
          body.trust_policy.voting_gate,
          body.trust_policy.review_gate,
        ]
      : [],
    relation_requirement_subtypes:
      body.relation_requirements?.rules.map((rule) => rule.relation_subtype) ?? [],
    dependency_ref_ids: body.dependency_policy
      ? uniqueSorted([
          ...refIds(body.dependency_policy.required_refs),
          ...refIds(body.dependency_policy.optional_refs),
          ...body.dependency_policy.required_relation_subtypes,
        ])
      : [],
    alignment_action_ref_ids: body.alignment_policy
      ? uniqueSorted([
          ...refIds(body.alignment_policy.required_action_refs),
          ...body.alignment_policy.accepted_relation_subtypes,
        ])
      : [],
    default_ref_ids: body.default_policy
      ? uniqueSorted([
          ...refIds(body.default_policy.policy_refs),
          ...refIds(body.default_policy.template_refs),
          ...refIds(body.default_policy.default_packet_set_refs),
          ...refIds(body.default_policy.preference_refs),
        ])
      : [],
    governance_hooks: body.governance_policy
      ? uniqueSorted([
          body.governance_policy.minimum_trust_stage,
          body.governance_policy.quorum_rule.quorum_kind,
          body.governance_policy.approval_threshold.threshold_kind,
          body.governance_policy.vote_method,
          body.governance_policy.decision_report_required
            ? 'decision_report_required'
            : 'decision_report_optional',
        ])
      : [],
  };
}

export function auditPacketPolicySemanticAuthority(input?: {
  policyPackets?: readonly PacketEnvelopeByType['Policy'][];
}): PacketPolicyAuthorityAuditReport {
  const findings: PacketSemanticAuthorityAuditFinding[] = [];
  const descriptorsByKind = new Map(
    POLICY_SEMANTIC_DESCRIPTORS.map((descriptor) => [
      descriptor.semantic_kind,
      descriptor,
    ])
  );
  const checkedPolicyPacketIds: string[] = [];

  for (const policyPacket of input?.policyPackets ?? []) {
    checkedPolicyPacketIds.push(policyPacket.header.packet_id);
    const semantics = resolvePolicyPacketSemantics(policyPacket);

    for (const semanticKind of semantics.semantic_kinds) {
      if (!descriptorsByKind.has(semanticKind)) {
        findings.push({
          severity: 'error',
          code: 'unknown_policy_semantic_kind',
          subject_id: policyPacket.header.packet_id,
          message: `${policyPacket.header.packet_id} resolved unknown policy semantic ${semanticKind}.`,
        });
      }
    }

    if (policyPacket.body.default_policy && semantics.default_ref_ids.length === 0) {
      findings.push({
        severity: 'error',
        code: 'default_policy_without_packet_refs',
        subject_id: policyPacket.header.packet_id,
        message:
          'default_policy must carry packet-backed refs and cannot stand as a runtime-only default label.',
      });
    }

    if (
      policyPacket.body.governance_policy?.decision_report_required &&
      policyPacket.body.governance_policy.vote_method.trim().length === 0
    ) {
      findings.push({
        severity: 'error',
        code: 'governance_policy_missing_vote_method',
        subject_id: policyPacket.header.packet_id,
        message: 'governance_policy requires a concrete vote_method hook.',
      });
    }
  }

  return {
    status: findings.length > 0 ? 'fail' : 'pass',
    checked_policy_packet_ids: checkedPolicyPacketIds,
    checked_semantic_kinds: POLICY_SEMANTIC_DESCRIPTORS.map(
      (descriptor) => descriptor.semantic_kind
    ),
    findings,
  };
}

function getPacketDependencyPartIds(
  definitions: readonly PacketTypeDefinition[],
  packetType: string | null
): string[] {
  if (!packetType) return [];

  const definition = definitions.find(
    (candidate) => candidate.packet_type === packetType
  );

  return (
    definition?.packet_definition_parts
      ?.filter((part) => part.part_subtype === 'packet_dependency')
      .map((part) => part.part_id) ?? []
  );
}

export function listPacketDependencySemanticDescriptors(input?: {
  definitions?: readonly PacketTypeDefinition[];
}): PacketDependencySemanticDescriptor[] {
  const definitions = input?.definitions ?? [];
  const dependencyIds = uniqueSorted([
    ...PACKET_WORKFLOW_DEPENDENCY_IDS,
    ...Object.keys(DEFINITION_PART_DEPENDENCY_PACKET_TYPES),
    ...Object.keys(OPERATION_DEPENDENCY_PACKET_TYPES),
  ]);

  return dependencyIds.map((dependencyId) => {
    const packetType = OPERATION_DEPENDENCY_PACKET_TYPES[dependencyId] ?? null;
    const definitionPartPacketType =
      DEFINITION_PART_DEPENDENCY_PACKET_TYPES[dependencyId] ?? null;
    const trustedCapabilityIds = TRUSTED_PACKET_PLANNER_CAPABILITIES.filter(
      (capability) =>
        capability.capability_id === dependencyId ||
        (capability.dependency_ids as readonly string[]).includes(dependencyId)
    ).map((capability) => capability.capability_id);

    if (POLICY_SEMANTIC_DEPENDENCY_IDS.has(dependencyId)) {
      return {
        dependency_id: dependencyId,
        anchor_kind: 'policy_packet_semantics',
        packet_type: 'Policy',
        trusted_capability_ids: trustedCapabilityIds,
        definition_part_ids: getPacketDependencyPartIds(definitions, 'Policy'),
        runtime_metadata_only: false,
        notes: 'Anchored to Policy packet semantics and interpreted by MutationPolicyGate.',
      };
    }

    if (packetType) {
      return {
        dependency_id: dependencyId,
        anchor_kind:
          dependencyId === 'generic.compatibility_projection'
            ? 'trusted_runtime_capability'
            : 'operation_ontology',
        packet_type: packetType,
        trusted_capability_ids: trustedCapabilityIds,
        definition_part_ids: getPacketDependencyPartIds(definitions, packetType),
        runtime_metadata_only: false,
        notes:
          'Anchored to packet operation semantics plus the target packet Definition dependency part.',
      };
    }

    if (definitionPartPacketType) {
      return {
        dependency_id: dependencyId,
        anchor_kind: 'definition_dependency_part',
        packet_type: definitionPartPacketType,
        trusted_capability_ids: trustedCapabilityIds,
        definition_part_ids: getPacketDependencyPartIds(
          definitions,
          definitionPartPacketType
        ),
        runtime_metadata_only: false,
        notes:
          'Anchored to a Definition packet_dependency part; trusted runtime code may implement the local engine, but packet meaning remains definition-backed.',
      };
    }

    if (WORKFLOW_RESOLVER_DEPENDENCY_IDS.has(dependencyId)) {
      return {
        dependency_id: dependencyId,
        anchor_kind: 'workflow_resolver',
        packet_type: null,
        trusted_capability_ids: trustedCapabilityIds,
        definition_part_ids: [],
        runtime_metadata_only: true,
        notes: 'Anchored to the workflow resolver allowlist and local trusted resolver contracts.',
      };
    }

    return {
      dependency_id: dependencyId,
      anchor_kind: 'trusted_runtime_capability',
      packet_type: null,
      trusted_capability_ids: trustedCapabilityIds,
      definition_part_ids: [],
      runtime_metadata_only: TRUSTED_RUNTIME_DEPENDENCY_IDS.has(dependencyId),
      notes:
        'Anchored to a trusted local runtime capability descriptor that interprets packet-backed workflow or policy semantics.',
    };
  });
}

export function resolvePacketDependencySemanticDescriptor(
  dependencyId: string,
  input?: { definitions?: readonly PacketTypeDefinition[] }
): PacketDependencySemanticDescriptor | null {
  return (
    listPacketDependencySemanticDescriptors(input).find(
      (descriptor) => descriptor.dependency_id === dependencyId
    ) ?? null
  );
}

export function auditPacketDependencySemanticAuthority(input?: {
  definitions?: readonly PacketTypeDefinition[];
}): PacketDependencyAuthorityAuditReport {
  const descriptors = listPacketDependencySemanticDescriptors(input);
  const descriptorIds = new Set(
    descriptors.map((descriptor) => descriptor.dependency_id)
  );
  const findings: PacketSemanticAuthorityAuditFinding[] = [];

  for (const descriptor of descriptors) {
    if (
      (descriptor.anchor_kind === 'operation_ontology' ||
        descriptor.anchor_kind === 'policy_packet_semantics') &&
      descriptor.definition_part_ids.length === 0
    ) {
      findings.push({
        severity: 'error',
        code: 'dependency_missing_definition_part',
        subject_id: descriptor.dependency_id,
        message: `${descriptor.dependency_id} is packet-backed but has no Definition packet_dependency part anchor.`,
      });
    }

    if (
      descriptor.anchor_kind === 'trusted_runtime_capability' &&
      !descriptor.runtime_metadata_only &&
      descriptor.trusted_capability_ids.length === 0
    ) {
      findings.push({
        severity: 'error',
        code: 'dependency_missing_trusted_capability',
        subject_id: descriptor.dependency_id,
        message: `${descriptor.dependency_id} must be backed by a trusted local capability descriptor.`,
      });
    }
  }

  for (const definition of input?.definitions ?? []) {
    for (const dependencyPart of definition.packet_definition_parts?.filter(
      (part) => part.part_subtype === 'packet_dependency'
    ) ?? []) {
      for (const reference of dependencyPart.references ?? []) {
        if (!descriptorIds.has(reference)) {
          findings.push({
            severity: 'error',
            code: 'definition_dependency_unanchored_reference',
            subject_id: dependencyPart.part_id,
            message: `${dependencyPart.part_id} references unanchored dependency semantic ${reference}.`,
          });
        }
      }
    }
  }

  return {
    status: findings.length > 0 ? 'fail' : 'pass',
    checked_dependency_ids: descriptors.map((descriptor) => descriptor.dependency_id),
    findings,
  };
}

export function resolvePacketDefaultPolicyRefs(input: {
  actionPacket?: PacketEnvelopeByType['Action'] | null;
  policyPackets?: readonly PacketEnvelopeByType['Policy'][];
}): PacketRef[] {
  const actionPolicyRefs = input.actionPacket?.body.policy_refs ?? [];
  const defaultPolicyRefs =
    input.policyPackets?.flatMap((policyPacket) =>
      policyPacket.body.default_policy?.policy_refs ?? []
    ) ?? [];

  return [...actionPolicyRefs, ...defaultPolicyRefs];
}

export function resolveInitiativePolicyAnchorRefs(input: {
  actionPacket?: PacketEnvelopeByType['Action'] | null;
}): PacketRef[] {
  if (
    input.actionPacket?.body.subtype === 'initiative' &&
    input.actionPacket.body.policy_refs.length > 0
  ) {
    return input.actionPacket.body.policy_refs;
  }

  return [];
}
