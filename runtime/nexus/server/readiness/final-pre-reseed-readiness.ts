/**
 * File: final-pre-reseed-readiness.ts
 * Description: Final handoff audit before reseed design begins.
 */

import {
  auditPacketDefinitionManifest,
  auditPacketPolicySemanticAuthority,
  auditSeededPacketDefinitionProfile,
  listDefinedPacketTypeDefinitions,
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
import { auditPacketRuntimeDispatchHandoffs } from '@runtime/nexus/server/packet-runtime-dispatch-handoff';
import { auditPacketWorkflowAlignmentCoverage } from '@runtime/nexus/server/packet-workflow-alignment-audit';
import { createDirectStorageTouchAuditReport } from '@runtime/nexus/server/readiness/direct-storage-touch-audit.ts';
import { createLegacySeedSourceInventoryReport } from '@runtime/nexus/server/readiness/legacy-seed-source-inventory.ts';
import { createPacketDefinitionReadinessAuditReport } from '@runtime/nexus/server/readiness/packet-definition-readiness-audit.ts';
import { trustedDispatchCoordinator } from '@runtime/trusted_coordinators/trusted_dispatch_coordinator/index.ts';
import { listMutationIntentDescriptors } from '@runtime/nexus/server/mutation-intent-registry';
import { trustedRegulationCoordinator } from '@runtime/trusted_coordinators/trusted_regulation_coordinator/index.ts';
import { trustedPlanningCoordinator } from '@runtime/trusted_coordinators/trusted_planning_coordinator/index.ts';
import { trustedBuildingCoordinator } from '@runtime/trusted_coordinators/trusted_building_coordinator/index.ts';
import { trustedInspectionCoordinator } from '@runtime/trusted_coordinators/trusted_inspection_coordinator/index.ts';
import { trustedCertificationCoordinator } from '@runtime/trusted_coordinators/trusted_certification_coordinator/index.ts';
import { trustedCompatibilityCoordinator } from '@runtime/trusted_coordinators/trusted_compatibility_coordinator/index.ts';
import { trustedVerificationCoordinator } from '@runtime/trusted_coordinators/trusted_verification_coordinator/index.ts';
import { LEGACY_IDENTITY_MIGRATION_POLICY } from '@runtime/nexus/identity-migration-policy';

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
  trusted_runtime_readiness: {
    dispatch_ready: boolean;
    definition_ready: boolean;
    regulation_ready: boolean;
    planning_ready: boolean;
    building_ready: boolean;
    inspection_ready: boolean;
    certification_ready: boolean;
    compatibility_ready: boolean;
    verification_ready: boolean;
    projection_ready: boolean;
    archive_ready: 'async_not_run';
    exchange_ready: 'async_not_run';
  };
  temporary_identity_migration_bridge: {
    enabled: boolean;
    migration_version: number;
    legacy_window_label: string;
    sunset_after: string | null;
  };
  blockers: string[];
  accepted_transition_notes: string[];
  cleanup_candidates: string[];
  findings: string[];
};

type FinalReadinessFindingSource =
  | 'closure'
  | 'dispatch'
  | 'definition'
  | 'manifest'
  | 'seeded_definition'
  | 'regulation'
  | 'planning'
  | 'building'
  | 'inspection'
  | 'certification'
  | 'compatibility'
  | 'verification'
  | 'projection'
  | 'policy_semantic'
  | 'client_ingress'
  | 'dispatch_handoff'
  | 'workflow_alignment'
  | 'live_generic'
  | 'live_composite'
  | 'direct_storage'
  | 'open_entry'
  | 'seed_presence'
  | 'legacy_seed_inventory';

type FinalReadinessRawFinding = {
  source: FinalReadinessFindingSource;
  message: string;
};

type FinalReadinessClassifiedFindings = {
  blockers: string[];
  accepted_transition_notes: string[];
  cleanup_candidates: string[];
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

function createFindings(
  source: FinalReadinessFindingSource,
  messages: readonly string[]
): FinalReadinessRawFinding[] {
  return messages.map((message) => ({ source, message }));
}

function isAcceptedTransitionFinding(finding: FinalReadinessRawFinding): boolean {
  const message = finding.message;

  return (
    message.startsWith('Multiple active definition candidates resolve for ') ||
    message === 'TypeScript bootstrap definitions and generated Definition seed packets are both active pre-reseed sources; digest-relevant parity is enforced by the definition readiness audit.' ||
    message === 'Duplicate packet type definition registered for Definition.' ||
    message === 'Duplicate packet type definition registered for Preference.' ||
    message === 'Candidate body failed packet body schema validation.' ||
    / body failed schema validation with \d+ issue\(s\)\.$/.test(message) ||
    message === 'Inspection reported invalid packet candidates.' ||
    message === 'bundle.packet_set.body.v0 is canonical metadata but not runtime-ready.' ||
    message === 'definition.part.body.v0 is canonical metadata but not runtime-ready.' ||
    message.startsWith('Workflow plan references unknown resolver node.ref') ||
    message.startsWith('Workflow step revise_node_preference references unknown resolver node.ref') ||
    message.startsWith('Workflow plan references unknown dependency trusted.') ||
    message.startsWith('Workflow plan references unknown policy action preference.node.write') ||
    message.startsWith('Workflow step revise_node_preference references undeclared or unknown policy action preference.node.write') ||
    message === 'Duplicate compatibility adapter edge 0.1.0->0.1.0.'
  );
}

function isCleanupCandidateFinding(finding: FinalReadinessRawFinding): boolean {
  return (
    finding.source === 'open_entry' ||
    finding.source === 'legacy_seed_inventory'
  );
}

function classifyFinalReadinessFindings(
  findings: readonly FinalReadinessRawFinding[]
): FinalReadinessClassifiedFindings {
  const blockers: string[] = [];
  const acceptedTransitionNotes: string[] = [];
  const cleanupCandidates: string[] = [];

  for (const finding of findings) {
    if (isAcceptedTransitionFinding(finding)) {
      acceptedTransitionNotes.push(finding.message);
      continue;
    }

    if (isCleanupCandidateFinding(finding)) {
      cleanupCandidates.push(finding.message);
      continue;
    }

    blockers.push(finding.message);
  }

  return {
    blockers: uniqueSorted(blockers),
    accepted_transition_notes: uniqueSorted(acceptedTransitionNotes),
    cleanup_candidates: uniqueSorted(cleanupCandidates),
  };
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
  const definitions = listDefinedPacketTypeDefinitions();
  const dispatchReadiness = trustedDispatchCoordinator.auditReadiness({
    mode: 'debug_audit',
  }).value;
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
  const buildingReadiness = trustedBuildingCoordinator.auditReadiness({
    context_mode: 'reseed',
  }).value;
  const inspectionReadiness = trustedInspectionCoordinator.auditReadiness({
    context_mode: 'reseed',
  }).value;
  const certificationReadiness = trustedCertificationCoordinator.auditReadiness({
    context_mode: 'reseed',
  }).value;
  const compatibilityReadiness = trustedCompatibilityCoordinator.auditReadiness({
    context_mode: 'reseed',
  }).value;
  const verificationReadiness = trustedVerificationCoordinator.auditReadiness({
    context_mode: 'reseed',
  }).value;
  const packetDefinitionReadiness = createPacketDefinitionReadinessAuditReport();
  const policySemanticAudit = auditPacketPolicySemanticAuthority({
    policyPackets: PERSONAL_SEED_PACKETS.filter(
      (packet): packet is PacketEnvelopeByType['Policy'] =>
        packet.header.type === 'Policy'
    ),
  });
  const clientIngressAudit = auditPacketClientIntentEnrollments();
  const dispatchHandoffAudit = auditPacketRuntimeDispatchHandoffs();
  const workflowAlignmentAudit = auditPacketWorkflowAlignmentCoverage();
  const directStorageTouchAudit = createDirectStorageTouchAuditReport();
  const legacySeedInventory = createLegacySeedSourceInventoryReport();
  const closureEntries = [
    ...closureReport.live_mutation_intents,
    ...closureReport.runtime_connector_paths,
    ...closureReport.workflow_plans,
    ...closureReport.policy_requirements,
    ...closureReport.dependency_requirements,
    ...closureReport.client_ingress_enrollments,
    ...closureReport.dispatch_handoffs,
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
  const rawFindings = [
    ...createFindings('closure', closureReport.findings),
    ...createFindings('dispatch', (dispatchReadiness?.findings ?? []).map((finding) => finding.message)),
    ...createFindings('definition', [
      'TypeScript bootstrap definitions and generated Definition seed packets are both active pre-reseed sources; digest-relevant parity is enforced by the definition readiness audit.',
    ]),
    ...createFindings('manifest', manifestAudit.findings
      .filter((finding) => finding.severity === 'error')
      .map((finding) => finding.message)),
    ...createFindings('seeded_definition', seededDefinitionAudit.findings),
    ...createFindings('regulation', (regulationReadiness?.contexts ?? []).flatMap((context) => context.issues.map((issue) => issue.message))),
    ...createFindings('planning', (planningReadiness?.plans ?? []).flatMap((plan) => [
      ...plan.issues.map((issue) => issue.message),
      ...plan.blockers,
    ])),
    ...createFindings('building', (buildingReadiness?.build_results ?? []).flatMap((result) => [
      ...result.blockers,
      ...result.warnings,
    ])),
    ...createFindings('inspection', (inspectionReadiness?.reports ?? []).flatMap((report) => [
      ...report.blockers,
      ...report.warnings,
      ...report.issues.map((issue) => issue.message),
    ])),
    ...createFindings('certification', (certificationReadiness?.packages ?? []).flatMap((certificationPackage) => [
      ...certificationPackage.blockers,
      ...certificationPackage.warnings,
    ])),
    ...createFindings('compatibility', compatibilityReadiness?.ready === false
      ? ['Trusted Compatibility Coordinator readiness audit has blockers.']
      : []),
    ...createFindings('verification', verificationReadiness?.ready === false
      ? ['Trusted Verification Coordinator readiness audit has blockers.']
      : []),
    ...createFindings('projection', packetDefinitionReadiness.status === 'fail'
      ? ['Packet Definition projection/default readiness audit has blockers.']
      : []),
    ...createFindings('policy_semantic', policySemanticAudit.findings.map((finding) => finding.message)),
    ...createFindings('client_ingress', clientIngressAudit.findings.map((finding) => finding.message)),
    ...createFindings('dispatch_handoff', dispatchHandoffAudit.findings.map((finding) => finding.message)),
    ...createFindings('workflow_alignment', workflowAlignmentAudit.findings.map((finding) => finding.message)),
    ...createFindings('direct_storage', directStorageTouchAudit.findings.map((finding) => finding.message)),
    ...createFindings('legacy_seed_inventory', legacySeedInventory.blockers),
    ...createFindings('legacy_seed_inventory', legacySeedInventory.cleanup_candidates),
    ...createFindings('open_entry', openEntries.map(
      (entry) =>
        `${entry.subject_kind}:${entry.subject_id} remains ${entry.status} before reseed design.`
    )),
    ...createFindings('seed_presence', requiredDefaultPolicyPacketIds
      .filter((packetId) => !seedPacketIds.has(packetId))
      .map((packetId) => `Required default policy seed is missing: ${packetId}.`)),
    ...createFindings('seed_presence', seededDefinitionProfile.definition_packets
      .filter((candidate) => !seedPacketIds.has(candidate.packet.header.packet_id))
      .map(
        (candidate) =>
          `Canonical Definition seed packet is missing: ${candidate.packet.header.packet_id}.`
      )),
  ];

  if (!seedPacketIds.has(PERSONAL_TREE_REFS.owa_action.packet_id)) {
    rawFindings.push({
      source: 'seed_presence',
      message: 'Forward OWA Action initiative anchor is missing from seeds.',
    });
  }

  if (!seedPacketIds.has(seededDefinitionProfile.bundle_packet.packet.header.packet_id)) {
    rawFindings.push({
      source: 'seed_presence',
      message: 'Canonical Definition profile Bundle seed packet is missing.',
    });
  }

  const classifiedFindings = classifyFinalReadinessFindings(rawFindings);

  return {
    report_kind: 'packet.final_pre_reseed_readiness',
    status: classifiedFindings.blockers.length > 0 ? 'fail' : 'pass',
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
    trusted_runtime_readiness: {
      dispatch_ready: dispatchReadiness?.status !== 'fail',
      definition_ready: true,
      regulation_ready: regulationReadiness?.ready ?? false,
      planning_ready: planningReadiness?.ready ?? false,
      building_ready: buildingReadiness?.ready ?? false,
      inspection_ready: inspectionReadiness?.ready ?? false,
      certification_ready: certificationReadiness?.ready ?? false,
      compatibility_ready: compatibilityReadiness?.ready ?? false,
      verification_ready: verificationReadiness?.ready ?? false,
      projection_ready: packetDefinitionReadiness.status !== 'fail',
      archive_ready: 'async_not_run',
      exchange_ready: 'async_not_run',
    },
    temporary_identity_migration_bridge: {
      enabled: LEGACY_IDENTITY_MIGRATION_POLICY.enabled,
      migration_version: LEGACY_IDENTITY_MIGRATION_POLICY.migration_version,
      legacy_window_label: LEGACY_IDENTITY_MIGRATION_POLICY.legacy_window_label,
      sunset_after: LEGACY_IDENTITY_MIGRATION_POLICY.sunset_after,
    },
    blockers: classifiedFindings.blockers,
    accepted_transition_notes: classifiedFindings.accepted_transition_notes,
    cleanup_candidates: classifiedFindings.cleanup_candidates,
    findings: classifiedFindings.blockers,
  };
}
