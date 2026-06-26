/**
 * File: pre-reseed-modernization-closure.ts
 * Description: No-deferral closure ledger for runtime modernization before reseed design.
 */

import { PACKET_TYPES, type PacketType } from '@core/schema/packet-schema';
import { listPacketWorkflowPlanDescriptorsFromDefinitions } from '@core/packets/packet-workflow-planner.ts';
import { listDefinedPacketTypeDefinitions } from '@core/packets/packet-definition-manifest.ts';
import {
  listTrustedWriteMigrationEntries,
  type TrustedWriteMigrationEntry,
} from '@runtime/nexus/server/trusted-write-migration-audit';
import { auditPacketClientIntentEnrollments } from '@runtime/nexus/server/packet-client-intent-enrollment';
import {
  listPacketRuntimeDispatchHandoffCoverage,
} from '@runtime/nexus/server/packet-runtime-dispatch-handoff';
import {
  listMutationIntentDescriptors,
  type MutationIntentDescriptor,
} from '@runtime/nexus/server/mutation-intent-registry';

export type PreReseedClosureStatus =
  | 'closed'
  | 'closing_now'
  | 'queued_pre_reseed'
  | 'blocked'
  | 'removed_from_active_scope';

export type PreReseedClosureLedgerEntry = {
  subject_kind:
    | 'mutation_intent'
    | 'runtime_connector_path'
    | 'workflow_plan'
    | 'policy_requirement'
    | 'dependency_requirement'
    | 'client_ingress_enrollment'
    | 'dispatch_handoff'
    | 'composite_workflow_adapter'
    | 'packet_type';
  subject_id: string;
  status: PreReseedClosureStatus;
  queue:
    | 'first_generic_promotion'
    | 'relation_claim_reaction_generic_enrollment'
    | 'discussion_locality_workflow_decomposition'
    | 'policy_dependency_semantic_authority'
    | 'final_reseed_readiness_audit'
    | 'removed_from_active_scope';
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
  dispatch_handoffs: PreReseedClosureLedgerEntry[];
  composite_workflow_adapters: PreReseedClosureLedgerEntry[];
  packet_types: PreReseedClosureLedgerEntry[];
  follow_on_pass_queue: PreReseedClosureLedgerEntry[];
  findings: string[];
};

const LIVE_GENERIC_PREPARE_HANDLERS = new Set<MutationIntentDescriptor['prepare']>([
  'prepareAssociationRelation',
  'prepareHomeLocalityRelation',
  'prepareFollowRelation',
  'prepareRoleParticipationRelation',
  'preparePacketVoteReaction',
]);
const LIVE_COMPOSITE_PREPARE_HANDLERS = new Set<MutationIntentDescriptor['prepare']>([
  'prepareLocalityPathCreate',
  'prepareLocalityGraphApply',
  'prepareDiscussionSurfacesEnsure',
  'prepareAssemblyElementCreate',
  'prepareDiscussionThreadPost',
  'prepareDiscussionReply',
  'prepareReactionAttestation',
  'prepareActorWritePolicyUpdate',
]);
const LIVE_GENERIC_MUTATION_INTENTS = new Set<string>(
  listMutationIntentDescriptors()
    .filter((descriptor) => LIVE_GENERIC_PREPARE_HANDLERS.has(descriptor.prepare))
    .map((descriptor) => descriptor.kind)
);
const LIVE_COMPOSITE_MUTATION_INTENTS = new Set<string>(
  listMutationIntentDescriptors()
    .filter((descriptor) => LIVE_COMPOSITE_PREPARE_HANDLERS.has(descriptor.prepare))
    .map((descriptor) => descriptor.kind)
);
const CLOSED_RUNTIME_MUTATION_INTENTS = new Set<string>([
  ...LIVE_GENERIC_MUTATION_INTENTS,
  ...LIVE_COMPOSITE_MUTATION_INTENTS,
  'preference.element.set',
]);

const LIVE_RUNTIME_PACKET_TYPES = new Set<PacketType>(PACKET_TYPES);

const TRUSTED_COMPOSITE_WORKFLOW_ADAPTER_IDS = [
  'composite.locality_graph.apply.v0',
  'composite.discussion_surfaces.ensure.v0',
  'composite.assembly_element.create.v0',
  'composite.locality_path.create.v0',
  'composite.discussion_thread_post.create.v0',
  'composite.discussion_reply.create.v0',
  'composite.role_attestation.set.v0',
  'composite.actor_write_policy.update.v0',
] as const;


function listTrustedWorkflowPlans() {
  return listPacketWorkflowPlanDescriptorsFromDefinitions({
    definitions: listDefinedPacketTypeDefinitions(),
  });
}

function queueForEntry(
  entry: TrustedWriteMigrationEntry
): PreReseedClosureLedgerEntry['queue'] {
  if (CLOSED_RUNTIME_MUTATION_INTENTS.has(entry.mutation_intent)) {
    return 'first_generic_promotion';
  }

  if (entry.domain === 'discussion' || entry.domain === 'locality') {
    return 'discussion_locality_workflow_decomposition';
  }

  if (entry.domain === 'actor_policy') {
    return 'policy_dependency_semantic_authority';
  }

  return 'relation_claim_reaction_generic_enrollment';
}

function mutationStatus(
  entry: TrustedWriteMigrationEntry
): PreReseedClosureStatus {
  return CLOSED_RUNTIME_MUTATION_INTENTS.has(entry.mutation_intent)
    ? 'closed'
    : 'queued_pre_reseed';
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function createMutationEntries(): PreReseedClosureLedgerEntry[] {
  return listTrustedWriteMigrationEntries().map((entry) => {
    const isClosed = CLOSED_RUNTIME_MUTATION_INTENTS.has(entry.mutation_intent);

    return {
      subject_kind: 'mutation_intent',
      subject_id: entry.mutation_intent,
      status: mutationStatus(entry),
      queue: queueForEntry(entry),
      reason: isClosed
        ? 'In-scope runtime intent now prepares through a trusted generic operation, composite workflow, or trusted Preference workflow under Dispatch-owned route authority.'
        : 'In-scope runtime work is tracked for explicit pre-reseed closure.',
      next_step: isClosed
        ? 'Keep parity tests green while closing policy/dependency semantics and remaining bridge retirement.'
        : entry.next_step,
    };
  });
}

function createWorkflowPlanEntries(): PreReseedClosureLedgerEntry[] {
  return listTrustedWorkflowPlans().map((plan) => {
    const closesLiveIntent = plan.mutation_intents.some((intent) =>
      CLOSED_RUNTIME_MUTATION_INTENTS.has(intent)
    );

    return {
      subject_kind: 'workflow_plan',
      subject_id: plan.workflow_plan_id,
      status: closesLiveIntent ? 'closed' : 'queued_pre_reseed',
      queue: closesLiveIntent
        ? 'first_generic_promotion'
        : 'relation_claim_reaction_generic_enrollment',
      reason: closesLiveIntent
        ? 'This workflow plan is exercised by a trusted generic prepare path.'
        : 'Workflow plan remains definition/alignment coverage until its owning runtime intent is explicitly enrolled.',
      next_step: closesLiveIntent
        ? 'Keep parity tests green while promoting the next workflow.'
        : 'Promote the owning mutation intent in a pre-reseed enrollment pass.',
    };
  });
}

function createPolicyRequirementEntries(): PreReseedClosureLedgerEntry[] {
  const policyActionIds = uniqueSorted(
    listTrustedWorkflowPlans().flatMap((plan) => plan.policy_action_ids)
  );

  return policyActionIds.map((policyActionId) => ({
    subject_kind: 'policy_requirement',
    subject_id: policyActionId,
    status: 'closed',
    queue: CLOSED_RUNTIME_MUTATION_INTENTS.has(policyActionId)
      ? 'first_generic_promotion'
      : 'policy_dependency_semantic_authority',
    reason: CLOSED_RUNTIME_MUTATION_INTENTS.has(policyActionId)
      ? 'Live Dispatch write-policy action is anchored to Policy packet semantics through MutationPolicyGate.'
      : 'Definition policy action is now anchored to packet-based policy semantics for reseed readiness.',
    next_step: CLOSED_RUNTIME_MUTATION_INTENTS.has(policyActionId)
      ? 'Preserve current Policy packet enforcement while generic workflows are promoted.'
      : 'Keep definition policy action descriptors synchronized with Policy packets and Definition action registries.',
  }));
}

function createDependencyRequirementEntries(): PreReseedClosureLedgerEntry[] {
  const dependencyIds = uniqueSorted(
    listTrustedWorkflowPlans().flatMap((plan) => plan.dependency_ids)
  );

  return dependencyIds.map((dependencyId) => ({
    subject_kind: 'dependency_requirement',
    subject_id: dependencyId,
    status: 'closed',
    queue: 'policy_dependency_semantic_authority',
    reason:
      'Dependency is declared by active Definition workflow material and remains visible in the pre-reseed closure ledger.',
    next_step:
      'Keep Definition dependency parts synchronized with workflow plans, candidate materialization, inspection gates, and certification ticket handoff.',
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

function createDispatchHandoffEntries(): PreReseedClosureLedgerEntry[] {
  return listPacketRuntimeDispatchHandoffCoverage().map((handoff) => {
    const isLiveGeneric = CLOSED_RUNTIME_MUTATION_INTENTS.has(handoff.mutation_intent);

    return {
      subject_kind: 'dispatch_handoff',
      subject_id: handoff.mutation_intent,
      status: isLiveGeneric ? 'closed' : 'queued_pre_reseed',
      queue: isLiveGeneric ? 'first_generic_promotion' : 'final_reseed_readiness_audit',
      reason: isLiveGeneric
        ? 'Handoff metadata resolves and the existing Dispatch corridor now calls a trusted generic operation or composite planner.'
        : 'Handoff metadata remains definition coverage until the owning workflow is promoted.',
      next_step: isLiveGeneric
        ? 'Preserve Dispatch route authority while expanding generic execution.'
        : 'Close the owning pre-reseed workflow enrollment before final reseed readiness audit.',
    };
  });
}

function createPacketTypeEntries(): PreReseedClosureLedgerEntry[] {
  return PACKET_TYPES.map((type) => {
    const inScope = LIVE_RUNTIME_PACKET_TYPES.has(type);

    return {
      subject_kind: 'packet_type',
      subject_id: type,
      status: inScope ? 'closed' : 'removed_from_active_scope',
      queue: inScope ? 'final_reseed_readiness_audit' : 'removed_from_active_scope',
      reason: inScope
        ? 'Live runtime type is covered by manifest, runtime, policy/dependency, and seed-readiness closure for reseed planning.'
        : 'Never-live or unused type is explicitly outside the current pre-reseed blocker set.',
      next_step: inScope
        ? 'Carry this type into the final reseed readiness handoff inventory.'
        : 'Keep removed types out of active canon until they are deliberately reintroduced through the packet-definition process.',
    };
  });
}

function createCompositeWorkflowAdapterEntries(): PreReseedClosureLedgerEntry[] {
  return TRUSTED_COMPOSITE_WORKFLOW_ADAPTER_IDS.map((adapterId) => ({
    subject_kind: 'composite_workflow_adapter',
    subject_id: adapterId,
    status: 'closed',
    queue: 'discussion_locality_workflow_decomposition',
    reason:
      'Reusable trusted composite workflow adapter has definition dry-run coverage and anchored policy/dependency metadata.',
    next_step:
      'Use this adapter shape for parity tests before live promotion.',
  }));
}

export function createPreReseedModernizationClosureReport(): PreReseedModernizationClosureReport {
  const clientIngressAudit = auditPacketClientIntentEnrollments();
  const live_mutation_intents = createMutationEntries();
  const workflow_plans = createWorkflowPlanEntries();
  const policy_requirements = createPolicyRequirementEntries();
  const dependency_requirements = createDependencyRequirementEntries();
  const client_ingress_enrollments = createClientIngressEntries();
  const dispatch_handoffs = createDispatchHandoffEntries();
  const composite_workflow_adapters = createCompositeWorkflowAdapterEntries();
  const packet_types = createPacketTypeEntries();
  const runtime_connector_paths: PreReseedClosureLedgerEntry[] = [
    {
      subject_kind: 'runtime_connector_path',
      subject_id: 'preference.element.interface.set',
      status: 'closed',
      queue: 'first_generic_promotion',
      reason:
        'Preference.element keeps a definition comparison connector only; authenticated writes are tracked for the trusted write chain.',
      next_step:
        'Keep guest compatibility writes outside canonical packet enrollment until reseed policy is designed.',
    },
    ...listMutationIntentDescriptors()
      .filter((descriptor) => LIVE_GENERIC_MUTATION_INTENTS.has(descriptor.kind))
      .map((descriptor) => ({
      subject_kind: 'runtime_connector_path' as const,
      subject_id: `generic.${descriptor.kind}.v0`,
      status: 'closed' as const,
      queue: 'first_generic_promotion' as const,
      reason:
        'Trusted generic workflow execution is enrolled behind Dispatch-owned direct relation, claim, and reaction operations.',
      next_step:
        'Use this path while decomposing composed locality, discussion, role-reaction, and actor-policy workflows.',
    })),
    ...listMutationIntentDescriptors()
      .filter((descriptor) => LIVE_COMPOSITE_MUTATION_INTENTS.has(descriptor.kind))
      .map((descriptor) => ({
      subject_kind: 'runtime_connector_path' as const,
      subject_id: `composite.${descriptor.kind}.v0`,
      status: 'closed' as const,
      queue: 'first_generic_promotion' as const,
      reason:
        'Trusted composite workflow execution is enrolled behind Dispatch-owned composed runtime workflows.',
      next_step:
        descriptor.kind === 'actor.write_policy.update'
          ? 'Keep policy/dependency semantic authority audits green through reseed design.'
          : 'Keep composite parity tests green through reseed readiness review.',
    })),
  ];
  const findings = [
    ...clientIngressAudit.findings.map((finding) => finding.message),
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
    dispatch_handoffs,
    composite_workflow_adapters,
    packet_types,
    follow_on_pass_queue,
    findings,
  };
}
