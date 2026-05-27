/**
 * File: final-pre-reseed-readiness.ts
 * Description: Final handoff audit before reseed design begins.
 */

import {
  auditPacketDefinitionManifest,
  auditPacketPolicySemanticAuthority,
  auditSeededPacketDefinitionProfile,
  PACKET_DEFINITION_MANIFEST,
  resolveSeededPacketDefinitionProfile,
} from '@core/packets/packet-definition-manifest';
import {
  CANONICAL_SEED_PACKETS,
  DEFINITION_PROFILE_SEED_PACKETS,
  PERSONAL_TREE_PACKET_IDS,
  PERSONAL_TREE_REFS,
  PERSONAL_SEED_PACKETS,
} from '@core/packets/seeds';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import {
  createPreReseedModernizationClosureReport,
  type PreReseedClosureLedgerEntry,
} from '@runtime/nexus/server/pre-reseed-modernization-closure';
import { auditPacketClientIntentEnrollments } from '@runtime/nexus/server/packet-client-intent-enrollment';
import { auditPacketRuntimeFortressHandoffs } from '@runtime/nexus/server/packet-runtime-fortress-handoff';
import { auditPacketWorkflowAlignmentCoverage } from '@runtime/nexus/server/packet-workflow-alignment-audit';
import { auditLiveGenericWorkflowEnrollments } from '@runtime/trusted_coordinators/trusted_packet_workflow_coordinator';
import { auditLiveCompositeWorkflowEnrollments } from '@runtime/trusted_coordinators/trusted_composite_workflow_coordinator';
import { listMutationIntentDescriptors } from '@runtime/nexus/server/mutation-intent-registry';
import { trustedDefinitionCoordinator } from '@runtime/trusted_coordinators/trusted_definition_coordinator';
import { trustedRegulationCoordinator } from '@runtime/trusted_coordinators/trusted_regulation_coordinator';
import { trustedPlanningCoordinator } from '@runtime/trusted_coordinators/trusted_planning_coordinator';

export type FinalPreReseedReadinessStatus = 'pass' | 'fail';

export type FinalPreReseedReadinessReport = {
  report_kind: 'packet.final_pre_reseed_readiness';
  status: FinalPreReseedReadinessStatus;
  canonical_write_intents: string[];
  compatibility_only_legacy_surfaces: string[];
  seed_default_anchor_packet_ids: string[];
  required_default_policy_packet_ids: string[];
  discussion_default_packet_ids: string[];
  canonical_definition_packet_types: string[];
  seeded_definition_profile_id: string;
  seeded_definition_packet_count: number;
  seeded_definition_bundle_packet_id: string;
  canonical_definition_seed_packet_ids: string[];
  pruned_packet_types: string[];
  findings: string[];
};

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function isOpenInScopeEntry(entry: PreReseedClosureLedgerEntry): boolean {
  return entry.status === 'queued_pre_reseed' || entry.status === 'blocked';
}

function listDiscussionSeedPacketIds(): string[] {
  return uniqueSorted(
    PERSONAL_SEED_PACKETS.filter((packet) =>
      packet.header.type === 'Discussion'
    ).map((packet) => packet.header.packet_id)
  );
}

const PRUNED_PACKET_TYPES = [
  'Cause',
  'Signal',
  'Initiative',
  'Program',
  'Campaign',
  'MissionTemplate',
  'MissionPlan',
  'MissionReport',
  'Module',
  'DiscussionSpace',
  'DiscussionForum',
  'DiscussionThread',
  'DiscussionPost',
  'DiscussionReply',
  'Minutes',
  'Artifact',
] as const;

export function createFinalPreReseedReadinessReport(): FinalPreReseedReadinessReport {
  const closureReport = createPreReseedModernizationClosureReport();
  const definitionsResult = trustedDefinitionCoordinator.listPacketDefinitions();
  const definitions = definitionsResult.value ?? [];
  const seededDefinitionProfile = resolveSeededPacketDefinitionProfile({ definitions });
  const seededDefinitionAudit = auditSeededPacketDefinitionProfile({
    definitions,
    profile: seededDefinitionProfile,
  });
  const manifestAudit = auditPacketDefinitionManifest({
    manifest: PACKET_DEFINITION_MANIFEST,
    definitions,
    requireDefinitionRuntimeReady: false,
  });
  const regulationReadiness = trustedRegulationCoordinator.auditReadiness({
    context_mode: 'reseed',
    operation_kind: 'debug_audit',
  }).value;
  const planningReadiness = trustedPlanningCoordinator.auditReadiness({
    context_mode: 'reseed',
    operation_kind: 'debug_audit',
  }).value;
  const policySemanticAudit = auditPacketPolicySemanticAuthority({
    policyPackets: PERSONAL_SEED_PACKETS.filter(
      (packet): packet is PacketEnvelopeByType['Policy'] =>
        packet.header.type === 'Policy'
    ),
  });
  const clientIngressAudit = auditPacketClientIntentEnrollments();
  const fortressHandoffAudit = auditPacketRuntimeFortressHandoffs();
  const workflowAlignmentAudit = auditPacketWorkflowAlignmentCoverage();
  const liveGenericAudit = auditLiveGenericWorkflowEnrollments();
  const liveCompositeAudit = auditLiveCompositeWorkflowEnrollments();
  const closureEntries = [
    ...closureReport.live_mutation_intents,
    ...closureReport.runtime_connector_paths,
    ...closureReport.workflow_plans,
    ...closureReport.policy_requirements,
    ...closureReport.dependency_requirements,
    ...closureReport.client_ingress_enrollments,
    ...closureReport.fortress_handoffs,
    ...closureReport.composite_workflow_adapters,
    ...closureReport.packet_types,
  ];
  const openEntries = closureEntries.filter(isOpenInScopeEntry);
  const canonicalWriteIntents = listMutationIntentDescriptors().map(
    (descriptor) => descriptor.kind
  );
  const seedDefaultAnchorPacketIds = [
    PERSONAL_TREE_PACKET_IDS.owa_action,
  ];
  const requiredDefaultPolicyPacketIds = [
    PERSONAL_TREE_PACKET_IDS.owa_residence_policy,
    PERSONAL_TREE_PACKET_IDS.owa_default_inheritance_policy,
    PERSONAL_TREE_PACKET_IDS.owa_governance_baseline_policy,
    PERSONAL_TREE_PACKET_IDS.trust_baseline_policy,
    PERSONAL_TREE_PACKET_IDS.visitor_lobby_policy,
  ];
  const seedPacketIds = new Set(
    CANONICAL_SEED_PACKETS.map((packet) => packet.header.packet_id)
  );
  const definitionSeedPacketIds = DEFINITION_PROFILE_SEED_PACKETS.map(
    (packet) => packet.header.packet_id
  );
  const findings = [
    ...closureReport.findings,
    ...definitionsResult.issues.map((issue) => issue.message),
    ...manifestAudit.findings
      .filter((finding) => finding.severity === 'error')
      .map((finding) => finding.message),
    ...seededDefinitionAudit.findings,
    ...(regulationReadiness?.contexts ?? []).flatMap((context) => context.issues.map((issue) => issue.message)),
    ...(planningReadiness?.plans ?? []).flatMap((plan) => [
      ...plan.issues.map((issue) => issue.message),
      ...plan.blockers,
    ]),
    ...policySemanticAudit.findings.map((finding) => finding.message),
    ...clientIngressAudit.findings.map((finding) => finding.message),
    ...fortressHandoffAudit.findings.map((finding) => finding.message),
    ...workflowAlignmentAudit.findings.map((finding) => finding.message),
    ...liveGenericAudit.findings.map((finding) => finding.message),
    ...liveCompositeAudit.findings.map((finding) => finding.message),
    ...openEntries.map(
      (entry) =>
        `${entry.subject_kind}:${entry.subject_id} remains ${entry.status} before reseed design.`
    ),
    ...requiredDefaultPolicyPacketIds
      .filter((packetId) => !seedPacketIds.has(packetId))
      .map((packetId) => `Required default policy seed is missing: ${packetId}.`),
    ...seededDefinitionProfile.definition_packets
      .filter((candidate) => !seedPacketIds.has(candidate.packet.header.packet_id))
      .map(
        (candidate) =>
          `Canonical Definition seed packet is missing: ${candidate.packet.header.packet_id}.`
      ),
  ];

  if (!seedPacketIds.has(PERSONAL_TREE_REFS.owa_action.packet_id)) {
    findings.push('Forward OWA Action initiative anchor is missing from seeds.');
  }

  if (!seedPacketIds.has(seededDefinitionProfile.bundle_packet.packet.header.packet_id)) {
    findings.push('Canonical Definition profile Bundle seed packet is missing.');
  }

  return {
    report_kind: 'packet.final_pre_reseed_readiness',
    status: findings.length > 0 ? 'fail' : 'pass',
    canonical_write_intents: uniqueSorted(canonicalWriteIntents),
    compatibility_only_legacy_surfaces: [
      'association.claim.set',
      'residence.claim.set',
      'archived alpha packet types only',
      'legacy parent_scope ancestry archive records',
    ],
    seed_default_anchor_packet_ids: seedDefaultAnchorPacketIds,
    required_default_policy_packet_ids: requiredDefaultPolicyPacketIds,
    discussion_default_packet_ids: listDiscussionSeedPacketIds(),
    canonical_definition_packet_types: uniqueSorted(
      definitions.map(
        (definition) => definition.packet_type
      )
    ),
    seeded_definition_profile_id: seededDefinitionProfile.profile_id,
    seeded_definition_packet_count:
      seededDefinitionProfile.definition_packets.length,
    seeded_definition_bundle_packet_id:
      seededDefinitionProfile.bundle_packet.packet_ref.packet_id,
    canonical_definition_seed_packet_ids: uniqueSorted(definitionSeedPacketIds),
    pruned_packet_types: [...PRUNED_PACKET_TYPES],
    findings,
  };
}
