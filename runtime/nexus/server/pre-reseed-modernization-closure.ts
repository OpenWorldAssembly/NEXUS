/**
 * File: pre-reseed-modernization-closure.ts
 * Description: No-deferral closure ledger for runtime modernization before reseed design.
 */

import { PACKET_FAMILIES, type PacketFamily } from '@core/schema/packet-schema';
import {
  auditPacketPolicyDependencyCoverage,
  auditPacketDependencySemanticAuthority,
  listPacketDependencyRequirementDescriptors,
  listPacketPolicyRequirementDescriptors,
  listPacketWorkflowPlanDescriptors,
} from '@core/packets/packet-definition-manifest';
import {
  listFortressHandlerGenericizationEntries,
  type FortressHandlerGenericizationEntry,
} from '@runtime/nexus/server/fortress-handler-genericization-audit';
import { auditPacketClientIntentEnrollments } from '@runtime/nexus/server/packet-client-intent-enrollment';
import {
  listPacketRuntimeFortressHandoffCoverage,
} from '@runtime/nexus/server/packet-runtime-fortress-handoff';
import {
  auditLiveGenericWorkflowEnrollments,
  listLiveGenericWorkflowEnrollments,
} from '@runtime/nexus/server/trusted-packet-workflow-runtime';
import {
  auditTrustedCompositeWorkflowAdapters,
  listTrustedCompositeWorkflowAdapters,
} from '@runtime/nexus/server/trusted-composite-workflow-adapters';
import {
  auditLiveCompositeWorkflowEnrollments,
  listLiveCompositeWorkflowEnrollments,
} from '@runtime/nexus/server/trusted-composite-workflow-runtime';

export type PreReseedClosureStatus =
  | 'closed'
  | 'closing_now'
  | 'queued_pre_reseed'
  | 'blocked'
  | 'out_of_chapter_scope';

export type PreReseedClosureLedgerEntry = {
  subject_kind:
    | 'mutation_intent'
    | 'runtime_connector_path'
    | 'workflow_plan'
    | 'policy_requirement'
    | 'dependency_requirement'
    | 'client_ingress_enrollment'
    | 'fortress_handoff'
    | 'composite_workflow_adapter'
    | 'packet_family';
  subject_id: string;
  status: PreReseedClosureStatus;
  queue:
    | 'first_generic_promotion'
    | 'relation_claim_attestation_generic_enrollment'
    | 'discussion_locality_workflow_decomposition'
    | 'policy_dependency_semantic_authority'
    | 'legacy_bridge_retirement'
    | 'final_reseed_readiness_audit'
    | 'out_of_chapter_scope';
  reason: string;
  next_step: string;
};

export type PreReseedModernizationClosureReport = {
  report_kind: 'packet.pre_reseed_modernization_closure';
  status: 'pass' | 'fail';
  live_mutation_intents: PreReseedClosureLedgerEntry[];
  runtime_connector_paths: PreReseedClosureLedgerEntry[];
  workflow_plans: PreReseedClosureLedgerEntry[];
  policy_requirements: PreReseedClosureLedgerEntry[];
  dependency_requirements: PreReseedClosureLedgerEntry[];
  client_ingress_enrollments: PreReseedClosureLedgerEntry[];
  fortress_handoffs: PreReseedClosureLedgerEntry[];
  composite_workflow_adapters: PreReseedClosureLedgerEntry[];
  packet_families: PreReseedClosureLedgerEntry[];
  follow_on_pass_queue: PreReseedClosureLedgerEntry[];
  findings: string[];
};

const LIVE_GENERIC_MUTATION_INTENTS = new Set<string>(
  listLiveGenericWorkflowEnrollments().map(
    (enrollment) => enrollment.mutation_intent
  )
);
const LIVE_COMPOSITE_MUTATION_INTENTS = new Set<string>(
  listLiveCompositeWorkflowEnrollments().map(
    (enrollment) => enrollment.mutation_intent
  )
);
const CLOSED_RUNTIME_MUTATION_INTENTS = new Set<string>([
  ...LIVE_GENERIC_MUTATION_INTENTS,
  ...LIVE_COMPOSITE_MUTATION_INTENTS,
]);

const LIVE_RUNTIME_PACKET_FAMILIES = new Set<PacketFamily>([
  'Element',
  'Location',
  'Role',
  'Claim',
  'Relation',
  'Attestation',
  'Policy',
  'Preference',
  'Discussion',
]);

function queueForEntry(
  entry: FortressHandlerGenericizationEntry
): PreReseedClosureLedgerEntry['queue'] {
  if (CLOSED_RUNTIME_MUTATION_INTENTS.has(entry.mutation_intent)) {
    return 'first_generic_promotion';
  }

  if (entry.genericization_status === 'legacy_bridge') {
    return 'legacy_bridge_retirement';
  }

  if (entry.domain === 'discussion' || entry.domain === 'locality') {
    return 'discussion_locality_workflow_decomposition';
  }

  if (entry.domain === 'actor_policy') {
    return 'policy_dependency_semantic_authority';
  }

  return 'relation_claim_attestation_generic_enrollment';
}

function mutationStatus(
  entry: FortressHandlerGenericizationEntry
): PreReseedClosureStatus {
  return CLOSED_RUNTIME_MUTATION_INTENTS.has(entry.mutation_intent)
    ? 'closed'
    : 'queued_pre_reseed';
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function createMutationEntries(): PreReseedClosureLedgerEntry[] {
  return listFortressHandlerGenericizationEntries().map((entry) => {
    const isClosed = CLOSED_RUNTIME_MUTATION_INTENTS.has(entry.mutation_intent);

    return {
      subject_kind: 'mutation_intent',
      subject_id: entry.mutation_intent,
      status: mutationStatus(entry),
      queue: queueForEntry(entry),
      reason: isClosed
        ? 'In-scope runtime intent now prepares through a trusted generic operation or composite workflow while the fortress remains the live authority.'
        : 'In-scope live runtime work is sequenced into the pre-reseed queue.',
      next_step: isClosed
        ? 'Keep parity tests green while closing policy/dependency semantics and legacy bridge retirement.'
        : entry.next_step,
    };
  });
}

function createWorkflowPlanEntries(): PreReseedClosureLedgerEntry[] {
  return listPacketWorkflowPlanDescriptors().map((plan) => {
    const closesLiveIntent = plan.mutation_intents.some((intent) =>
      LIVE_GENERIC_MUTATION_INTENTS.has(intent)
    );

    return {
      subject_kind: 'workflow_plan',
      subject_id: plan.workflow_plan_id,
      status: closesLiveIntent ? 'closed' : 'queued_pre_reseed',
      queue: closesLiveIntent
        ? 'first_generic_promotion'
        : 'relation_claim_attestation_generic_enrollment',
      reason: closesLiveIntent
        ? 'This workflow plan is now exercised by a live trusted generic prepare path.'
        : 'Workflow plan remains shadow/alignment coverage until its live runtime intent is enrolled.',
      next_step: closesLiveIntent
        ? 'Keep parity tests green while promoting the next workflow.'
        : 'Promote the owning mutation intent in a pre-reseed enrollment pass.',
    };
  });
}

function createPolicyRequirementEntries(): PreReseedClosureLedgerEntry[] {
  return listPacketPolicyRequirementDescriptors().map((descriptor) => ({
    subject_kind: 'policy_requirement',
    subject_id: descriptor.policy_requirement_id,
    status: 'closed',
    queue: descriptor.live_write_policy_action
      ? 'first_generic_promotion'
      : 'policy_dependency_semantic_authority',
    reason: descriptor.live_write_policy_action
      ? 'Live fortress write-policy action is anchored to Policy packet semantics through MutationPolicyGate.'
      : 'Shadow policy action is now anchored to packet-based policy semantics for reseed readiness.',
    next_step: descriptor.live_write_policy_action
      ? 'Preserve current Policy packet enforcement while generic workflows are promoted.'
      : 'Keep shadow policy action descriptors synchronized with Policy packets and Definition action registries.',
  }));
}

function createDependencyRequirementEntries(): PreReseedClosureLedgerEntry[] {
  const dependencySemanticAudit = auditPacketDependencySemanticAuthority();

  return listPacketDependencyRequirementDescriptors().map((descriptor) => ({
    subject_kind: 'dependency_requirement',
    subject_id: descriptor.dependency_id,
    status: dependencySemanticAudit.status === 'pass' ? 'closed' : 'blocked',
    queue: 'policy_dependency_semantic_authority',
    reason:
      dependencySemanticAudit.status === 'pass'
        ? 'Dependency resolves through packet Definition dependency parts, Policy semantics, operation ontology, workflow resolver allowlists, or trusted local engine contracts.'
        : 'Packet dependency semantic authority audit has blockers.',
    next_step:
      dependencySemanticAudit.status === 'pass'
        ? 'Keep Definition dependency parts synchronized with workflow plans and trusted local capability descriptors.'
        : 'Resolve dependency semantic authority findings before reseed closure.',
  }));
}

function createClientIngressEntries(): PreReseedClosureLedgerEntry[] {
  const audit = auditPacketClientIntentEnrollments();

  return audit.checked_enrollment_ids.map((enrollmentId) => ({
    subject_kind: 'client_ingress_enrollment',
    subject_id: enrollmentId,
    status: audit.status === 'pass' ? 'closed' : 'blocked',
    queue: 'first_generic_promotion',
    reason:
      audit.status === 'pass'
        ? 'Interface-neutral client/API ingress enrollment is registered and preflighted.'
        : 'Client/API ingress enrollment audit has blockers.',
    next_step:
      audit.status === 'pass'
        ? 'Keep adapter facts outside the runtime semantic layer.'
        : 'Resolve client ingress audit findings before reseed closure.',
  }));
}

function createFortressHandoffEntries(): PreReseedClosureLedgerEntry[] {
  return listPacketRuntimeFortressHandoffCoverage().map((handoff) => {
    const isLiveGeneric = CLOSED_RUNTIME_MUTATION_INTENTS.has(handoff.mutation_intent);

    return {
      subject_kind: 'fortress_handoff',
      subject_id: handoff.mutation_intent,
      status: isLiveGeneric ? 'closed' : 'queued_pre_reseed',
      queue: isLiveGeneric ? 'first_generic_promotion' : 'final_reseed_readiness_audit',
      reason: isLiveGeneric
        ? 'Handoff metadata resolves and the existing fortress corridor now calls a trusted generic operation or composite planner.'
        : 'Handoff metadata remains shadow coverage until the owning workflow is promoted.',
      next_step: isLiveGeneric
        ? 'Preserve signed fortress authority while expanding generic execution.'
        : 'Close the owning pre-reseed workflow enrollment before final reseed readiness audit.',
    };
  });
}

function createPacketFamilyEntries(): PreReseedClosureLedgerEntry[] {
  return PACKET_FAMILIES.map((family) => {
    const inScope = LIVE_RUNTIME_PACKET_FAMILIES.has(family);

    return {
      subject_kind: 'packet_family',
      subject_id: family,
      status: inScope ? 'queued_pre_reseed' : 'out_of_chapter_scope',
      queue: inScope ? 'final_reseed_readiness_audit' : 'out_of_chapter_scope',
      reason: inScope
        ? 'Live runtime family participates in the current reseed blocker set.'
        : 'Never-live or unused family is explicitly outside the current pre-reseed blocker set.',
      next_step: inScope
        ? 'Verify the family is covered by live workflow, policy, dependency, and seed readiness closure.'
        : 'Add the family in a later chapter when the product flow needs it.',
    };
  });
}

function createCompositeWorkflowAdapterEntries(): PreReseedClosureLedgerEntry[] {
  const audit = auditTrustedCompositeWorkflowAdapters();

  return listTrustedCompositeWorkflowAdapters().map((adapter) => ({
    subject_kind: 'composite_workflow_adapter',
    subject_id: adapter.adapter_id,
    status: audit.status === 'pass' ? 'closed' : 'blocked',
    queue: 'discussion_locality_workflow_decomposition',
    reason:
      audit.status === 'pass'
        ? 'Reusable trusted composite workflow adapter has shadow dry-run coverage and anchored policy/dependency metadata.'
        : 'Composite workflow adapter audit has blockers.',
    next_step:
      audit.status === 'pass'
        ? 'Use this adapter shape for parity tests before live promotion.'
        : 'Resolve composite adapter audit findings before live workflow enrollment.',
  }));
}

export function createPreReseedModernizationClosureReport(): PreReseedModernizationClosureReport {
  const liveGenericAudit = auditLiveGenericWorkflowEnrollments();
  const liveCompositeAudit = auditLiveCompositeWorkflowEnrollments();
  const policyDependencyAudit = auditPacketPolicyDependencyCoverage();
  const dependencySemanticAudit = auditPacketDependencySemanticAuthority();
  const clientIngressAudit = auditPacketClientIntentEnrollments();
  const compositeAdapterAudit = auditTrustedCompositeWorkflowAdapters();
  const live_mutation_intents = createMutationEntries();
  const workflow_plans = createWorkflowPlanEntries();
  const policy_requirements = createPolicyRequirementEntries();
  const dependency_requirements = createDependencyRequirementEntries();
  const client_ingress_enrollments = createClientIngressEntries();
  const fortress_handoffs = createFortressHandoffEntries();
  const composite_workflow_adapters = createCompositeWorkflowAdapterEntries();
  const packet_families = createPacketFamilyEntries();
  const runtime_connector_paths: PreReseedClosureLedgerEntry[] = [
    {
      subject_kind: 'runtime_connector_path',
      subject_id: 'preference.element.interface.set',
      status: 'closed',
      queue: 'first_generic_promotion',
      reason:
        'Preference.element remains the only live packet runtime connector and is already enrolled through the master handler.',
      next_step:
        'Keep guest compatibility writes outside connector enrollment until reseed policy is designed.',
    },
    ...listLiveGenericWorkflowEnrollments().map((enrollment) => ({
      subject_kind: 'runtime_connector_path' as const,
      subject_id: enrollment.enrollment_id,
      status: 'closed' as const,
      queue: 'first_generic_promotion' as const,
      reason:
        'Trusted generic workflow execution is enrolled behind NexusMutationService for direct relation, claim, and attestation operations.',
      next_step:
        'Use this path while decomposing composed locality, discussion, role-attestation, and actor-policy workflows.',
    })),
    ...listLiveCompositeWorkflowEnrollments().map((enrollment) => ({
      subject_kind: 'runtime_connector_path' as const,
      subject_id: enrollment.enrollment_id,
      status: 'closed' as const,
      queue: 'first_generic_promotion' as const,
      reason:
        'Trusted composite workflow execution is enrolled behind NexusMutationService for composed runtime workflows.',
      next_step:
        enrollment.mutation_intent === 'actor.write_policy.update'
          ? 'Close packet-based policy/dependency semantic authority before reseed.'
          : 'Keep composite parity tests green through reseed readiness review.',
    })),
  ];
  const findings = [
    ...liveGenericAudit.findings.map((finding) => finding.message),
    ...liveCompositeAudit.findings.map((finding) => finding.message),
    ...policyDependencyAudit.findings.map((finding) => finding.message),
    ...dependencySemanticAudit.findings.map((finding) => finding.message),
    ...clientIngressAudit.findings.map((finding) => finding.message),
    ...compositeAdapterAudit.findings.map((finding) => finding.message),
  ];
  const follow_on_pass_queue = uniqueSorted(
    live_mutation_intents
      .filter((entry) => entry.status === 'queued_pre_reseed' || entry.status === 'blocked')
      .map((entry) => entry.queue)
  ).map((queue) => ({
    subject_kind: 'mutation_intent' as const,
    subject_id: queue,
    status: 'queued_pre_reseed' as const,
    queue: queue as PreReseedClosureLedgerEntry['queue'],
    reason: 'Sequenced pre-reseed closure lane.',
    next_step: 'Close this lane before starting reseed design.',
  }));

  return {
    report_kind: 'packet.pre_reseed_modernization_closure',
    status: findings.length > 0 ? 'fail' : 'pass',
    live_mutation_intents,
    runtime_connector_paths,
    workflow_plans,
    policy_requirements,
    dependency_requirements,
    client_ingress_enrollments,
    fortress_handoffs,
    composite_workflow_adapters,
    packet_families,
    follow_on_pass_queue,
    findings,
  };
}
