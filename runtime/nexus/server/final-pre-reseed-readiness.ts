/**
 * File: final-pre-reseed-readiness.ts
 * Description: Final handoff audit before reseed design begins.
 */

import {
  auditPacketDefinitionManifest,
  auditPacketDependencySemanticAuthority,
  auditPacketPolicyDependencyCoverage,
  auditPacketPolicySemanticAuthority,
  listExperimentalPacketTypeDefinitions,
  PACKET_DEFINITION_MANIFEST,
} from '@core/packets/packet-definition-manifest';
import {
  PERSONAL_TREE_PACKET_IDS,
  PERSONAL_TREE_REFS,
  PERSONAL_SEED_PACKETS,
} from '@core/packets/seeds';
import type { PacketEnvelopeByType, PacketFamily } from '@core/schema/packet-schema';
import {
  createPreReseedModernizationClosureReport,
  type PreReseedClosureLedgerEntry,
} from '@runtime/nexus/server/pre-reseed-modernization-closure';
import { auditPacketClientIntentEnrollments } from '@runtime/nexus/server/packet-client-intent-enrollment';
import { auditPacketRuntimeFortressHandoffs } from '@runtime/nexus/server/packet-runtime-fortress-handoff';
import { auditPacketWorkflowAlignmentCoverage } from '@runtime/nexus/server/packet-workflow-alignment-audit';
import { auditLiveGenericWorkflowEnrollments } from '@runtime/nexus/server/trusted-packet-workflow-runtime';
import { auditLiveCompositeWorkflowEnrollments } from '@runtime/nexus/server/trusted-composite-workflow-runtime';
import { listMutationIntentDescriptors } from '@runtime/nexus/server/mutation-intent-registry';

export type FinalPreReseedReadinessStatus = 'pass' | 'fail';

export type FinalPreReseedReadinessReport = {
  report_kind: 'packet.final_pre_reseed_readiness';
  status: FinalPreReseedReadinessStatus;
  canonical_write_intents: string[];
  compatibility_only_legacy_surfaces: string[];
  seed_default_anchor_packet_ids: string[];
  required_default_policy_packet_ids: string[];
  discussion_default_packet_ids: string[];
  manifest_native_packet_types: string[];
  out_of_scope_packet_families: PacketFamily[];
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
      packet.header.family === 'Discussion' ||
      packet.header.family === 'DiscussionSpace' ||
      packet.header.family === 'DiscussionForum' ||
      packet.header.family === 'DiscussionThread' ||
      packet.header.family === 'DiscussionPost' ||
      packet.header.family === 'DiscussionReply'
    ).map((packet) => packet.header.packet_id)
  );
}

function listOutOfScopePacketFamilies(
  entries: readonly PreReseedClosureLedgerEntry[]
): PacketFamily[] {
  return entries
    .filter(
      (entry): entry is PreReseedClosureLedgerEntry & { subject_id: PacketFamily } =>
        entry.subject_kind === 'packet_family' &&
        entry.status === 'out_of_chapter_scope'
    )
    .map((entry) => entry.subject_id);
}

export function createFinalPreReseedReadinessReport(): FinalPreReseedReadinessReport {
  const closureReport = createPreReseedModernizationClosureReport();
  const definitions = listExperimentalPacketTypeDefinitions();
  const manifestAudit = auditPacketDefinitionManifest({
    manifest: PACKET_DEFINITION_MANIFEST,
    definitions,
    requireShadowRuntimeReady: false,
  });
  const policyDependencyAudit = auditPacketPolicyDependencyCoverage();
  const dependencySemanticAudit = auditPacketDependencySemanticAuthority();
  const policySemanticAudit = auditPacketPolicySemanticAuthority({
    policyPackets: PERSONAL_SEED_PACKETS.filter(
      (packet): packet is PacketEnvelopeByType['Policy'] =>
        packet.header.family === 'Policy'
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
    ...closureReport.packet_families,
  ];
  const openEntries = closureEntries.filter(isOpenInScopeEntry);
  const canonicalWriteIntents = listMutationIntentDescriptors().map(
    (descriptor) => descriptor.kind
  );
  const seedDefaultAnchorPacketIds = [
    PERSONAL_TREE_PACKET_IDS.owa_action,
    PERSONAL_TREE_PACKET_IDS.owa_cause,
  ];
  const requiredDefaultPolicyPacketIds = [
    PERSONAL_TREE_PACKET_IDS.owa_home_locality_policy,
    PERSONAL_TREE_PACKET_IDS.owa_default_inheritance_policy,
    PERSONAL_TREE_PACKET_IDS.owa_governance_baseline_policy,
    PERSONAL_TREE_PACKET_IDS.trust_baseline_policy,
    PERSONAL_TREE_PACKET_IDS.visitor_lobby_policy,
  ];
  const seedPacketIds = new Set(
    PERSONAL_SEED_PACKETS.map((packet) => packet.header.packet_id)
  );
  const findings = [
    ...closureReport.findings,
    ...manifestAudit.findings
      .filter((finding) => finding.severity === 'error')
      .map((finding) => finding.message),
    ...policyDependencyAudit.findings.map((finding) => finding.message),
    ...dependencySemanticAudit.findings.map((finding) => finding.message),
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
  ];

  if (!seedPacketIds.has(PERSONAL_TREE_REFS.owa_action.packet_id)) {
    findings.push('Forward OWA Action initiative anchor is missing from seeds.');
  }

  return {
    report_kind: 'packet.final_pre_reseed_readiness',
    status: findings.length > 0 ? 'fail' : 'pass',
    canonical_write_intents: uniqueSorted(canonicalWriteIntents),
    compatibility_only_legacy_surfaces: [
      'assembly_association.claim.set',
      'home_locality.claim.set',
      'Claim(home_locality)',
      'legacy parent_scope ancestry',
      'DiscussionThread/DiscussionPost/DiscussionReply projections',
      'Cause(subtype: initiative)',
    ],
    seed_default_anchor_packet_ids: seedDefaultAnchorPacketIds,
    required_default_policy_packet_ids: requiredDefaultPolicyPacketIds,
    discussion_default_packet_ids: listDiscussionSeedPacketIds(),
    manifest_native_packet_types: uniqueSorted(
      definitions.map(
        (definition) => definition.packet_type
      )
    ),
    out_of_scope_packet_families: listOutOfScopePacketFamilies(
      closureReport.packet_families
    ),
    findings,
  };
}
