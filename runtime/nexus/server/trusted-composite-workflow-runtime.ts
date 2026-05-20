/**
 * File: trusted-composite-workflow-runtime.ts
 * Description: Trusted local execution seam for live generic-composite workflow promotion.
 */

import { randomUUID } from 'node:crypto';

import type {
  MutationIntent,
  MutationTicket,
  PreparedMutation,
} from '@core/auth/mutation-corridor';
import {
  createDiscussionReplyCandidate,
  createDiscussionThreadPostCandidate,
  type MutationDecision,
} from '@core/auth/mutation-verifier';
import { getPacketUnsignedDigestCandidates } from '@core/auth/mutation-digests';
import type { MutationActionId } from '@core/auth/write-policy';
import {
  createClaimPacketId,
  createRelationAssertionClaimPacket,
} from '@core/packets/claims';
import { createElementPolicyRefsRevision } from '@core/packets/identity';
import {
  createAssemblyPacket,
  createAttestationPacket,
  createPacketEdge,
  createPacketRef,
  createPolicyPacket,
} from '@core/packets/builders';
import {
  createCanonicalDiscussionPacketId,
  isDiscussionMessagePacket,
  projectDiscussionPacketToLegacy,
} from '@core/packets/discussion-compat';
import {
  planPacketTargetMigration,
  resolvePacketTarget,
} from '@core/packets/packet-target-resolver';
import {
  createRelationPacketId,
  createScopedRelationPacket,
} from '@core/packets/relations';
import type {
  AttestationKind,
  AttestationValue,
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import {
  filterClaimPackets,
  listClaimPackets,
} from '@runtime/nexus/server/claim-utils';
import { planDefaultDiscussionSurfaces } from '@runtime/nexus/server/default-discussion-surfaces';
import { toRouteScopeId } from '@runtime/nexus/server/discussion-service.scope';
import { getLegacyParentScopePacketIdCompatibility } from '@runtime/nexus/server/scope-graph-compatibility';
import { resolveScopeParentResolutions } from '@runtime/nexus/server/scope-parent-resolution';
import { listRelationPackets } from '@runtime/nexus/server/relation-utils';
import {
  planCanonicalLocalityPath,
  type LocalityCreatePathEntry,
} from '@runtime/nexus/server/locality-directory-service';
import { planLocalityGraphApplyPackets } from '@runtime/nexus/server/locality-graph-apply-planner';
import type { MutationPolicyGate } from '@runtime/nexus/server/mutation-policy-gate';
import type { MutationTicketService } from '@runtime/nexus/server/mutation-ticket-service';
import {
  getTrustedCompositeWorkflowAdapter,
  listTrustedCompositeWorkflowAdapters,
  type TrustedCompositeWorkflowAdapterDescriptor,
} from '@runtime/nexus/server/trusted-composite-workflow-adapters';
import {
  buildWritePolicyBodyMarkdown,
  createActorWritePolicyPacketId,
  createWritePolicyForSecurityMode,
} from '@runtime/nexus/server/write-security-mode';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export type LiveCompositeWorkflowMutationIntent = Extract<
  MutationIntent['kind'],
  | 'locality.path.create'
  | 'locality.graph.apply'
  | 'discussion.surfaces.ensure'
  | 'assembly.element.create'
  | 'discussion.thread_post.create'
  | 'discussion.reply.create'
  | 'role_association.attestation.set'
  | 'actor.write_policy.update'
>;

export type LiveCompositeWorkflowEnrollment = {
  enrollment_id: string;
  mutation_intent: LiveCompositeWorkflowMutationIntent;
  adapter_id: string;
  adapter_kind: TrustedCompositeWorkflowAdapterDescriptor['adapter_kind'];
  operation_kinds: string[];
  policy_action_ids: MutationActionId[];
  dependency_ids: string[];
  fortress_prepare_handler:
    | 'prepareLocalityPathCreate'
    | 'prepareLocalityGraphApply'
    | 'prepareDiscussionSurfacesEnsure'
    | 'prepareAssemblyElementCreate'
    | 'prepareDiscussionThreadPost'
    | 'prepareDiscussionReply'
    | 'prepareRoleAssociationAttestation'
    | 'prepareActorWritePolicyUpdate';
  live_mode: 'trusted_generic_composite_workflow';
  notes: string;
};

export type TrustedCompositeWorkflowPlan = {
  plan_kind: 'trusted_composite_workflow_plan';
  mutation_intent: LiveCompositeWorkflowMutationIntent;
  adapter_id: string;
  prepared_mutation: PreparedMutation;
  prepared_result?: unknown;
};

export type PreparedCompositeMutationResult = {
  ticket: MutationTicket;
  prepared_mutation: PreparedMutation;
  prepared_result: unknown;
};

export type TrustedCompositeWorkflowMutationInput = {
  packetStore: NodeSQLitePacketStore;
  policyGate: MutationPolicyGate;
  ticketService: MutationTicketService;
  actorPacket: PacketEnvelopeByType['Element'];
  intent: Extract<MutationIntent, { kind: LiveCompositeWorkflowMutationIntent }>;
};

export type LiveCompositeWorkflowEnrollmentAuditFinding = {
  severity: 'error';
  code: string;
  enrollment_id: string;
  message: string;
};

export type LiveCompositeWorkflowEnrollmentAuditReport = {
  status: 'pass' | 'fail';
  checked_enrollment_ids: string[];
  findings: LiveCompositeWorkflowEnrollmentAuditFinding[];
};

type AssemblyScopeNode = {
  packet: PacketEnvelopeByType['Element'];
  packetId: string;
  routeId: string;
  name: string;
  parentPacketId: string | null;
};

const LIVE_COMPOSITE_ADAPTER_IDS_BY_INTENT = {
  'locality.path.create': 'composite.locality_path.create.v0',
  'locality.graph.apply': 'composite.locality_graph.apply.v0',
  'discussion.surfaces.ensure': 'composite.discussion_surfaces.ensure.v0',
  'assembly.element.create': 'composite.assembly_element.create.v0',
  'discussion.thread_post.create': 'composite.discussion_thread_post.create.v0',
  'discussion.reply.create': 'composite.discussion_reply.create.v0',
  'role_association.attestation.set': 'composite.role_attestation.set.v0',
  'actor.write_policy.update': 'composite.actor_write_policy.update.v0',
} as const satisfies Record<LiveCompositeWorkflowMutationIntent, string>;

const PREPARE_HANDLER_BY_INTENT = {
  'locality.path.create': 'prepareLocalityPathCreate',
  'locality.graph.apply': 'prepareLocalityGraphApply',
  'discussion.surfaces.ensure': 'prepareDiscussionSurfacesEnsure',
  'assembly.element.create': 'prepareAssemblyElementCreate',
  'discussion.thread_post.create': 'prepareDiscussionThreadPost',
  'discussion.reply.create': 'prepareDiscussionReply',
  'role_association.attestation.set': 'prepareRoleAssociationAttestation',
  'actor.write_policy.update': 'prepareActorWritePolicyUpdate',
} as const satisfies Record<
  LiveCompositeWorkflowMutationIntent,
  LiveCompositeWorkflowEnrollment['fortress_prepare_handler']
>;

function normalizePreparedMutation(input: {
  kind: MutationIntent['kind'];
  decision: MutationDecision;
  digests: string[];
}): PreparedMutation {
  return {
    kind: input.kind,
    action_ids: input.decision.action_ids,
    required_proof_level: input.decision.required_proof_level,
    accepted_proof_methods: input.decision.accepted_proof_methods,
    source_policy_packet_ids: input.decision.source_policy_packet_ids,
    governing_scope_packet_id: input.decision.governing_scope_packet_id,
    prepared_packets: input.decision.packets.map((packet, index) => ({
      packet,
      unsigned_digest: input.digests[index] ?? '',
    })),
  };
}

function createSlug(value: string, maxLength = 36): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= maxLength) {
    return slug;
  }

  return slug.slice(0, maxLength).replace(/-+$/g, '');
}

function createAssemblyPacketId(name: string): string {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);

  return `nexus:element/${createSlug(name, 28)}-${suffix}`;
}

function getParentPacketId(packet: PacketEnvelopeByType['Element']): string | null {
  return (
    packet.header.edges.find((edge) => edge.edge_type === 'parent_scope')?.target
      .packet_id ?? null
  );
}

function createApplicableScopeRefs(input: {
  scopePacketId: string;
  parentPacketId: string | null;
  parentByPacketId: Map<string, string | null>;
}) {
  const refs = [{ packet_id: input.scopePacketId }];
  let currentParentId = input.parentPacketId;

  while (currentParentId) {
    refs.push({ packet_id: currentParentId });
    currentParentId = input.parentByPacketId.get(currentParentId) ?? null;
  }

  return refs;
}

function createNextRevisionId(
  packetId: string,
  currentRevisionId?: string | null
): string {
  const currentRevisionNumber = currentRevisionId?.match(/@r(\d+)$/)?.[1] ?? null;
  const nextRevisionNumber =
    currentRevisionNumber === null ? 1 : Number(currentRevisionNumber) + 1;

  return `${packetId}@r${nextRevisionNumber}`;
}

function createAttestationPacketId(input: {
  targetPacketId: string;
  actorPacketId: string;
  attestationKind: AttestationKind;
  contextPacketId?: string | null;
}) {
  return [
    'nexus:attestation',
    input.attestationKind,
    input.targetPacketId,
    input.actorPacketId,
    input.contextPacketId ?? 'none',
  ].join('/');
}

async function requirePacket<TFamily extends PacketEnvelope['header']['family']>(
  input: {
    packetStore: NodeSQLitePacketStore;
    packetId: string;
    family: TFamily;
  }
): Promise<Extract<PacketEnvelope, { header: { family: TFamily } }>> {
  const packet = await input.packetStore.fetchByPacket({
    packet_id: input.packetId,
  });

  if (!packet || packet.header.family !== input.family) {
    throw new Error(`Unknown ${input.family} packet: ${input.packetId}`);
  }

  return packet as Extract<PacketEnvelope, { header: { family: TFamily } }>;
}

async function listAssemblyScopeNodes(
  packetStore: NodeSQLitePacketStore
): Promise<AssemblyScopeNode[]> {
  const [elementPackets, relationPackets] = await Promise.all([
    packetStore.listPreferredPacketsByFamily('Element'),
    listRelationPackets(packetStore),
  ]);
  const typedElementPackets = elementPackets as PacketEnvelopeByType['Element'][];
  const scopePackets = typedElementPackets.filter(
    (packet) => packet.body.kind === 'assembly'
  );
  const parentResolutionsByPacketId = resolveScopeParentResolutions({
    scopePackets,
    relationPackets,
    getCompatibilityParentPacketId: getLegacyParentScopePacketIdCompatibility,
  });

  return typedElementPackets
    .filter((packet) => packet.body.kind === 'assembly')
    .map((packet) => ({
      packet,
      packetId: packet.header.packet_id,
      routeId: toRouteScopeId(packet.header.packet_id),
      name: packet.body.name,
      parentPacketId:
        parentResolutionsByPacketId.get(packet.header.packet_id)?.parentPacketId ??
        null,
    }));
}

function buildApplicableScopeRefsFromNodes(input: {
  scopePacketId: string;
  scopeNodes: AssemblyScopeNode[];
}) {
  const parentByPacketId = new Map(
    input.scopeNodes.map((scopeNode) => [
      scopeNode.packetId,
      scopeNode.parentPacketId,
    ])
  );

  return createApplicableScopeRefs({
    scopePacketId: input.scopePacketId,
    parentPacketId: parentByPacketId.get(input.scopePacketId) ?? null,
    parentByPacketId,
  });
}

async function planCanonicalDiscussionMirrors(input: {
  packetStore: NodeSQLitePacketStore;
  packet: PacketEnvelope;
}): Promise<{
  canonical_packet_id: string;
  packets: PacketEnvelopeByType['Discussion'][];
}> {
  const resolution = await resolvePacketTarget({
    packet_id: input.packet.header.packet_id,
    fetchPacket: async (packetId) =>
      input.packetStore.fetchByPacket({ packet_id: packetId }),
    fetchRevisionHeads: async (packetId) =>
      input.packetStore.fetchRevisionHeads({ packet_id: packetId }),
  });
  const migrationPlan = await planPacketTargetMigration({
    packet_id: input.packet.header.packet_id,
    resolution,
    fetchPacket: async (packetId) =>
      input.packetStore.fetchByPacket({ packet_id: packetId }),
    fetchRevisionHeads: async (packetId) =>
      input.packetStore.fetchRevisionHeads({ packet_id: packetId }),
  });

  if (migrationPlan.blocked_reason) {
    throw new Error(migrationPlan.blocked_reason);
  }

  return {
    canonical_packet_id:
      resolution.canonical_packet_id ?? input.packet.header.packet_id,
    packets: migrationPlan.packets as PacketEnvelopeByType['Discussion'][],
  };
}

async function withPreparedDigests(packets: PacketEnvelope[]) {
  return Promise.all(
    packets.map(async (packet) => {
      const digests = await getPacketUnsignedDigestCandidates(packet);

      return {
        packet,
        unsigned_digest: digests[0]?.digest ?? '',
      };
    })
  );
}

function requireLiveCompositeAdapter(
  mutationIntent: LiveCompositeWorkflowMutationIntent
): TrustedCompositeWorkflowAdapterDescriptor {
  const adapterId = LIVE_COMPOSITE_ADAPTER_IDS_BY_INTENT[mutationIntent];
  const adapter = getTrustedCompositeWorkflowAdapter(adapterId);

  if (!adapter) {
    throw new Error(`Missing live composite workflow adapter: ${adapterId}`);
  }

  return adapter;
}

export function listLiveCompositeWorkflowEnrollments(): LiveCompositeWorkflowEnrollment[] {
  return (Object.keys(LIVE_COMPOSITE_ADAPTER_IDS_BY_INTENT) as LiveCompositeWorkflowMutationIntent[])
    .map((mutationIntent) => {
      const adapter = requireLiveCompositeAdapter(mutationIntent);

      return {
        enrollment_id: `live.composite.workflow.${mutationIntent}`,
        mutation_intent: mutationIntent,
        adapter_id: adapter.adapter_id,
        adapter_kind: adapter.adapter_kind,
        operation_kinds: [...adapter.operation_kinds],
        policy_action_ids: [...adapter.policy_action_ids],
        dependency_ids: [...adapter.dependency_ids],
        fortress_prepare_handler: PREPARE_HANDLER_BY_INTENT[mutationIntent],
        live_mode: 'trusted_generic_composite_workflow',
        notes:
          'Trusted generic-composite workflow: local runtime code executes adapter-aligned planning inside the existing fortress prepare/finalize corridor.',
      };
    });
}

export function auditLiveCompositeWorkflowEnrollments(): LiveCompositeWorkflowEnrollmentAuditReport {
  const findings: LiveCompositeWorkflowEnrollmentAuditFinding[] = [];
  const enrollments = listLiveCompositeWorkflowEnrollments();
  const adapterIds = new Set(
    listTrustedCompositeWorkflowAdapters().map((adapter) => adapter.adapter_id)
  );

  for (const enrollment of enrollments) {
    if (!adapterIds.has(enrollment.adapter_id)) {
      findings.push({
        severity: 'error',
        code: 'unknown_live_composite_adapter',
        enrollment_id: enrollment.enrollment_id,
        message: `${enrollment.enrollment_id} references unknown adapter ${enrollment.adapter_id}.`,
      });
    }

    if (
      enrollment.operation_kinds.length === 0 ||
      enrollment.policy_action_ids.length === 0 ||
      enrollment.dependency_ids.length === 0
    ) {
      findings.push({
        severity: 'error',
        code: 'incomplete_live_composite_metadata',
        enrollment_id: enrollment.enrollment_id,
        message: `${enrollment.enrollment_id} is missing operation, policy, or dependency metadata.`,
      });
    }
  }

  return {
    status: findings.length > 0 ? 'fail' : 'pass',
    checked_enrollment_ids: enrollments.map(
      (enrollment) => enrollment.enrollment_id
    ),
    findings,
  };
}

export async function resolveTrustedDiscussionCompositePlan(
  input: TrustedCompositeWorkflowMutationInput
): Promise<TrustedCompositeWorkflowPlan> {
  if (input.intent.kind === 'discussion.thread_post.create') {
    const rawForumPacket = await input.packetStore.fetchByPacket({
      packet_id: input.intent.forum_packet_id,
    });

    if (!rawForumPacket) {
      throw new Error(`Unknown discussion forum: ${input.intent.forum_packet_id}`);
    }

    const forumPacket =
      rawForumPacket.header.family === 'Discussion'
        ? (projectDiscussionPacketToLegacy(
            rawForumPacket as PacketEnvelopeByType['Discussion'],
            'DiscussionForum'
          ) as PacketEnvelopeByType['DiscussionForum'] | null)
        : rawForumPacket.header.family === 'DiscussionForum'
          ? (rawForumPacket as PacketEnvelopeByType['DiscussionForum'])
          : null;

    if (!forumPacket) {
      throw new Error(`Unknown discussion forum: ${input.intent.forum_packet_id}`);
    }

    const mirrorPlan =
      rawForumPacket.header.family === 'Discussion'
        ? { canonical_packet_id: rawForumPacket.header.packet_id, packets: [] }
        : await planCanonicalDiscussionMirrors({
            packetStore: input.packetStore,
            packet: rawForumPacket,
          });
    const governingScopePacket = forumPacket.header.authority_scope_ref
      ? await requirePacket({
          packetStore: input.packetStore,
          packetId: forumPacket.header.authority_scope_ref.packet_id,
          family: 'Element',
        })
      : null;
    const mergedPolicyDecision =
      await input.policyGate.resolveScopePolicyDecision({
        governingScopePacket,
        actorPacket: input.actorPacket,
        actionIds: ['discussion.thread.create', 'discussion.post.create'],
      });
    const decision = {
      ...createDiscussionThreadPostCandidate({
        intent: {
          kind: 'discussion.thread_post.create',
          scope_id: input.intent.scope_id,
          mutation_nonce:
            input.intent.mutation_nonce?.trim() || randomUUID().slice(0, 8),
          created_at: input.intent.created_at ?? new Date().toISOString(),
          forum_packet_id: mirrorPlan.canonical_packet_id,
          forum_kind: forumPacket.body.forum_kind,
          authority_scope_packet_id:
            forumPacket.header.authority_scope_ref?.packet_id ?? null,
          applicable_scope_packet_ids: forumPacket.header.applicable_scope_refs.map(
            (scopeRef) => scopeRef.packet_id
          ),
          default_sort: forumPacket.body.default_sort,
          thread_title: input.intent.thread_title,
          post_markdown: input.intent.post_markdown,
          thread_kind: forumPacket.body.forum_kind,
          related_packet_ids: input.intent.related_packet_ids ?? [],
          legacy_context_packet_ids:
            rawForumPacket.header.family === 'Discussion'
              ? []
              : [rawForumPacket.header.packet_id],
        },
        actorPacket: input.actorPacket,
      }),
      ...mergedPolicyDecision,
    } satisfies MutationDecision;
    decision.packets.unshift(...mirrorPlan.packets);

    return {
      plan_kind: 'trusted_composite_workflow_plan',
      mutation_intent: input.intent.kind,
      adapter_id: LIVE_COMPOSITE_ADAPTER_IDS_BY_INTENT[input.intent.kind],
      prepared_mutation: normalizePreparedMutation({
        kind: input.intent.kind,
        decision,
        digests: await Promise.all(
          decision.packets.map(async (packet) => {
            const candidates = await getPacketUnsignedDigestCandidates(packet);
            return candidates[0]?.digest ?? '';
          })
        ),
      }),
    };
  }

  if (input.intent.kind !== 'discussion.reply.create') {
    throw new Error(
      `Unsupported discussion composite workflow intent: ${input.intent.kind}`
    );
  }

  const parentPacket = await input.packetStore.fetchByPacket({
    packet_id: input.intent.parent_post_packet_id,
  });

  if (!parentPacket) {
    throw new Error(`Unknown discussion post: ${input.intent.parent_post_packet_id}`);
  }

  const discussionParentPacket =
    isDiscussionMessagePacket(parentPacket)
      ? (() => {
          const discussionPacket = parentPacket as PacketEnvelopeByType['Discussion'];

          return projectDiscussionPacketToLegacy(
            discussionPacket,
            discussionPacket.body.kind === 'message' &&
              discussionPacket.body.root_message_ref
              ? 'DiscussionReply'
              : 'DiscussionPost'
          ) as
            | PacketEnvelopeByType['DiscussionPost']
            | PacketEnvelopeByType['DiscussionReply']
            | null;
        })()
      : parentPacket.header.family === 'DiscussionPost' ||
          parentPacket.header.family === 'DiscussionReply'
        ? (parentPacket as
            | PacketEnvelopeByType['DiscussionPost']
            | PacketEnvelopeByType['DiscussionReply'])
        : null;

  if (!discussionParentPacket) {
    throw new Error(`Unknown discussion post: ${input.intent.parent_post_packet_id}`);
  }

  const mirrorPlan =
    parentPacket.header.family === 'Discussion'
      ? { canonical_packet_id: parentPacket.header.packet_id, packets: [] }
      : await planCanonicalDiscussionMirrors({
          packetStore: input.packetStore,
          packet: parentPacket,
        });
  const rawThreadPacket = await input.packetStore.fetchByPacket({
    packet_id: discussionParentPacket.body.thread_ref.packet_id,
  });
  const threadPacket =
    rawThreadPacket?.header.family === 'Discussion'
      ? (projectDiscussionPacketToLegacy(
          rawThreadPacket as PacketEnvelopeByType['Discussion'],
          'DiscussionThread'
        ) as PacketEnvelopeByType['DiscussionThread'] | null)
      : rawThreadPacket?.header.family === 'DiscussionThread'
        ? (rawThreadPacket as PacketEnvelopeByType['DiscussionThread'])
        : null;

  if (!threadPacket) {
    throw new Error(
      `Missing discussion thread for post ${input.intent.parent_post_packet_id}.`
    );
  }

  const rawForumPacket = await input.packetStore.fetchByPacket({
    packet_id: threadPacket.body.forum_ref.packet_id,
  });
  const forumPacket =
    rawForumPacket?.header.family === 'Discussion'
      ? (projectDiscussionPacketToLegacy(
          rawForumPacket as PacketEnvelopeByType['Discussion'],
          'DiscussionForum'
        ) as PacketEnvelopeByType['DiscussionForum'] | null)
      : rawForumPacket?.header.family === 'DiscussionForum'
        ? (rawForumPacket as PacketEnvelopeByType['DiscussionForum'])
        : null;

  if (!forumPacket) {
    throw new Error(
      `Missing discussion forum for thread ${threadPacket.header.packet_id}.`
    );
  }

  const governingScopePacket = forumPacket.header.authority_scope_ref
    ? await requirePacket({
        packetStore: input.packetStore,
        packetId: forumPacket.header.authority_scope_ref.packet_id,
        family: 'Element',
      })
    : null;
  const mergedPolicyDecision = await input.policyGate.resolveScopePolicyDecision({
    governingScopePacket,
    actorPacket: input.actorPacket,
    actionIds: ['discussion.reply.create'],
  });
  const decision = {
    ...createDiscussionReplyCandidate({
      intent: {
        kind: 'discussion.reply.create',
        scope_id: input.intent.scope_id,
        mutation_nonce:
          input.intent.mutation_nonce?.trim() || randomUUID().slice(0, 8),
        created_at: input.intent.created_at ?? new Date().toISOString(),
        forum_kind: forumPacket.body.forum_kind,
        authority_scope_packet_id:
          parentPacket.header.authority_scope_ref?.packet_id ?? null,
        applicable_scope_packet_ids: parentPacket.header.applicable_scope_refs.map(
          (scopeRef) => scopeRef.packet_id
        ),
        thread_packet_id:
          rawThreadPacket?.header.family === 'Discussion'
            ? rawThreadPacket.header.packet_id
            : createCanonicalDiscussionPacketId(threadPacket.header.packet_id),
        root_post_packet_id:
          discussionParentPacket.header.family === 'DiscussionPost'
            ? createCanonicalDiscussionPacketId(discussionParentPacket.header.packet_id)
            : createCanonicalDiscussionPacketId(
                (discussionParentPacket as PacketEnvelopeByType['DiscussionReply'])
                  .body.root_post_ref.packet_id
              ),
        parent_post_packet_id: mirrorPlan.canonical_packet_id,
        reply_markdown: input.intent.reply_markdown,
        legacy_context_packet_ids:
          parentPacket.header.family === 'Discussion'
            ? []
            : [parentPacket.header.packet_id],
      },
      actorPacket: input.actorPacket,
    }),
    ...mergedPolicyDecision,
  } satisfies MutationDecision;
  decision.packets.unshift(...mirrorPlan.packets);

  return {
    plan_kind: 'trusted_composite_workflow_plan',
    mutation_intent: input.intent.kind,
    adapter_id: LIVE_COMPOSITE_ADAPTER_IDS_BY_INTENT[input.intent.kind],
    prepared_mutation: normalizePreparedMutation({
      kind: input.intent.kind,
      decision,
      digests: await Promise.all(
        decision.packets.map(async (packet) => {
          const candidates = await getPacketUnsignedDigestCandidates(packet);
          return candidates[0]?.digest ?? '';
        })
      ),
    }),
  };
}

export async function resolveTrustedActorPolicyCompositePlan(
  input: TrustedCompositeWorkflowMutationInput
): Promise<TrustedCompositeWorkflowPlan> {
  if (input.intent.kind !== 'actor.write_policy.update') {
    throw new Error(
      `Unsupported actor policy composite workflow intent: ${input.intent.kind}`
    );
  }

  const {
    currentPolicyDecision,
    existingPolicyPackets,
    existingWritePolicyPacket,
  } = await input.policyGate.resolveActorWritePolicyUpdate({
    actorPacket: input.actorPacket,
  });
  const writePolicyPacketId =
    existingWritePolicyPacket?.header.packet_id ??
    createActorWritePolicyPacketId(input.actorPacket.header.packet_id);
  const nextCreatedAt = input.intent.created_at ?? new Date().toISOString();
  const nextWritePolicy = createWritePolicyForSecurityMode(
    input.intent.security_mode
  );
  const policyPacket = createPolicyPacket({
    packet_id: writePolicyPacketId,
    revision_id: existingWritePolicyPacket
      ? `${writePolicyPacketId}@r${
          Number.parseInt(
            existingWritePolicyPacket.header.revision_id.match(/@r(\d+)$/)?.[1] ??
              '0',
            10
          ) + 1
        }`
      : undefined,
    created_at: nextCreatedAt,
    parent_revision_refs: existingWritePolicyPacket
      ? [
          {
            packet_id: existingWritePolicyPacket.header.packet_id,
            revision_id: existingWritePolicyPacket.header.revision_id,
          },
        ]
      : [],
    authority_scope_ref:
      input.actorPacket.header.authority_scope_ref ?? {
        packet_id: input.actorPacket.header.packet_id,
      },
    applicable_scope_refs:
      input.actorPacket.header.applicable_scope_refs.length > 0
        ? input.actorPacket.header.applicable_scope_refs
        : [{ packet_id: input.actorPacket.header.packet_id }],
    created_by: {
      packet_id: input.actorPacket.header.packet_id,
    },
    adapter: 'nexus-web',
    metadata_tags: ['policy', 'write-lock', 'actor-security'],
    title: 'Write approval policy',
    summary: 'Actor-scoped write approval policy.',
    policy_kind: 'write_lock',
    body_markdown: buildWritePolicyBodyMarkdown(input.intent.security_mode),
    status: 'active',
    write_policy: nextWritePolicy,
  });
  const nextPolicyRefs = [
    ...input.actorPacket.header.moderation.policy_refs.filter(
      (policyRef) =>
        !existingPolicyPackets.some(
          (existingPolicyPacket) =>
            existingPolicyPacket.header.packet_id === policyRef.packet_id &&
            existingPolicyPacket.body.policy_kind === 'write_lock'
        )
    ),
    { packet_id: writePolicyPacketId },
  ];
  const packets: PacketEnvelope[] = [policyPacket];

  if (
    JSON.stringify(nextPolicyRefs) !==
    JSON.stringify(input.actorPacket.header.moderation.policy_refs)
  ) {
    packets.push(
      createElementPolicyRefsRevision({
        actorPacket: input.actorPacket,
        policyRefs: nextPolicyRefs,
      })
    );
  }

  return {
    plan_kind: 'trusted_composite_workflow_plan',
    mutation_intent: input.intent.kind,
    adapter_id: LIVE_COMPOSITE_ADAPTER_IDS_BY_INTENT[input.intent.kind],
    prepared_mutation: {
      kind: input.intent.kind,
      ...currentPolicyDecision,
      governing_scope_packet_id: input.actorPacket.header.packet_id,
      prepared_packets: await withPreparedDigests(packets),
    },
  };
}

export async function resolveTrustedAssemblyElementCompositePlan(
  input: TrustedCompositeWorkflowMutationInput
): Promise<TrustedCompositeWorkflowPlan> {
  if (input.intent.kind !== 'assembly.element.create') {
    throw new Error(
      `Unsupported assembly composite workflow intent: ${input.intent.kind}`
    );
  }

  const parentScopePacket = await requirePacket({
    packetStore: input.packetStore,
    packetId: input.intent.parent_scope_packet_id,
    family: 'Element',
  });
  const scopeNodes = await listAssemblyScopeNodes(input.packetStore);
  const parentByPacketId = new Map(
    scopeNodes.map((scopeNode) => [scopeNode.packetId, scopeNode.parentPacketId])
  );
  const createdAt = input.intent.created_at ?? new Date().toISOString();
  const assemblyPacketId = createAssemblyPacketId(input.intent.name);
  const applicableScopeRefs = createApplicableScopeRefs({
    scopePacketId: assemblyPacketId,
    parentPacketId: parentScopePacket.header.packet_id,
    parentByPacketId,
  });
  const assemblyPacket = createAssemblyPacket({
    packet_id: assemblyPacketId,
    created_at: createdAt,
    authority_scope_ref: { packet_id: assemblyPacketId },
    applicable_scope_refs: applicableScopeRefs,
    created_by: { packet_id: input.actorPacket.header.packet_id },
    edges: [
      createPacketEdge('parent_scope', {
        packet_id: parentScopePacket.header.packet_id,
      }),
    ],
    name: input.intent.name.trim(),
    subtype: input.intent.subtype?.trim() ?? 'local',
    summary: input.intent.summary?.trim() ?? null,
    locality_label: input.intent.locality_label?.trim() ?? input.intent.name.trim(),
    tags: ['assembly', 'local'],
    metadata_tags: ['assembly', 'local'],
  });
  const packets: PacketEnvelope[] = [assemblyPacket];
  const actionIds: MutationActionId[] = ['assembly.element.create'];

  if (input.intent.seed_discussions !== false) {
    const discussionPackets = await planDefaultDiscussionSurfaces({
      packetStore: input.packetStore,
      scopePacketId: assemblyPacket.header.packet_id,
      scopeName: assemblyPacket.body.name,
      applicableScopeRefs,
    });
    packets.push(...discussionPackets);
    actionIds.push('discussion.surfaces.ensure');
  }

  if (input.intent.claim_association !== false) {
    const relationPacketId = createRelationPacketId({
      subtype: 'assembly_association',
      subjectPacketId: input.actorPacket.header.packet_id,
      targetPacketId: assemblyPacket.header.packet_id,
      scopePacketId: assemblyPacket.header.packet_id,
    });
    const relationPacket = createScopedRelationPacket({
      subtype: 'assembly_association',
      subjectPacketId: input.actorPacket.header.packet_id,
      targetPacketId: assemblyPacket.header.packet_id,
      scopePacketId: assemblyPacket.header.packet_id,
      applicableScopeRefs,
      createdByPacketId: input.actorPacket.header.packet_id,
      status: 'active',
      packetId: relationPacketId,
    });
    const claimPacket = createRelationAssertionClaimPacket({
      claimKind: 'assembly_association',
      subjectPacketId: input.actorPacket.header.packet_id,
      relationPacketId,
      assertedTargetPacketId: assemblyPacket.header.packet_id,
      scopePacketId: assemblyPacket.header.packet_id,
      applicableScopeRefs,
      createdByPacketId: input.actorPacket.header.packet_id,
      note: input.intent.claim_note ?? null,
      status: 'active',
      packetId: createClaimPacketId({
        claimKind: 'assembly_association',
        subjectPacketId: input.actorPacket.header.packet_id,
        targetPacketId: assemblyPacket.header.packet_id,
        scopePacketId: assemblyPacket.header.packet_id,
      }),
    });
    packets.push(relationPacket, claimPacket);
    actionIds.push('assembly_association.relation.set');
  }

  const mergedPolicyDecision = await input.policyGate.resolveScopePolicyDecision({
    governingScopePacket: parentScopePacket,
    actorPacket: input.actorPacket,
    actionIds,
  });

  return {
    plan_kind: 'trusted_composite_workflow_plan',
    mutation_intent: input.intent.kind,
    adapter_id: LIVE_COMPOSITE_ADAPTER_IDS_BY_INTENT[input.intent.kind],
    prepared_mutation: {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id: parentScopePacket.header.packet_id,
      prepared_packets: await withPreparedDigests(packets),
    },
  };
}

export async function resolveTrustedRoleAttestationCompositePlan(
  input: TrustedCompositeWorkflowMutationInput
): Promise<TrustedCompositeWorkflowPlan> {
  if (input.intent.kind !== 'role_association.attestation.set') {
    throw new Error(
      `Unsupported role attestation composite workflow intent: ${input.intent.kind}`
    );
  }

  const claimPackets = await listClaimPackets(input.packetStore);
  const claimPacket = filterClaimPackets({
    claims: claimPackets,
    claimKind: 'role_association',
  }).find((candidate) => candidate.header.packet_id === input.intent.claim_packet_id);

  if (!claimPacket) {
    throw new Error('Unknown role claim packet.');
  }

  if (
    (claimPacket.body.subject_ref?.packet_id ??
      claimPacket.body.relation_assertion?.subject_ref.packet_id) ===
    input.actorPacket.header.packet_id
  ) {
    throw new Error('Use claim or unclaim for your own role associations.');
  }

  const trimmedNote = input.intent.note?.trim() ?? null;

  if (input.intent.mode === 'dispute' && !trimmedNote) {
    throw new Error('A dispute attestation requires a comment.');
  }

  const governingScopePacket = await requirePacket({
    packetStore: input.packetStore,
    packetId: claimPacket.body.scope_ref.packet_id,
    family: 'Element',
  });
  const packets: PacketEnvelope[] = [];
  const actorPacketId = input.actorPacket.header.packet_id;
  const authorityScopeRef =
    governingScopePacket.header.authority_scope_ref ?? {
      packet_id: governingScopePacket.header.packet_id,
    };
  const applicableScopeRefs =
    governingScopePacket.header.applicable_scope_refs.length > 0
      ? governingScopePacket.header.applicable_scope_refs
      : [{ packet_id: governingScopePacket.header.packet_id }];
  const createRoleAttestationRevision = async (
    attestationKind: 'claim_support' | 'claim_dispute',
    desiredValue: AttestationValue | 0,
    note: string | null
  ) => {
    const packetId = createAttestationPacketId({
      targetPacketId: claimPacket.header.packet_id,
      actorPacketId,
      attestationKind,
    });
    const existingPreferredRevision = await input.packetStore.fetchPreferredRevision({
      packet_id: packetId,
    });
    const existingPacket =
      existingPreferredRevision === null
        ? null
        : await input.packetStore.fetchByRevision(existingPreferredRevision);
    const currentAttestationPacket =
      existingPacket?.header.family === 'Attestation'
        ? (existingPacket as PacketEnvelopeByType['Attestation'])
        : null;

    if (desiredValue === 0 && !currentAttestationPacket) {
      return null;
    }

    const nextValue =
      desiredValue === 0
        ? currentAttestationPacket?.body.value ?? 1
        : desiredValue;

    return createAttestationPacket({
      packet_id: packetId,
      revision_id: createNextRevisionId(
        packetId,
        existingPreferredRevision?.revision_id ?? null
      ),
      created_at: input.intent.created_at ?? new Date().toISOString(),
      parent_revision_refs: existingPreferredRevision
        ? [existingPreferredRevision]
        : [],
      authority_scope_ref: authorityScopeRef,
      applicable_scope_refs: applicableScopeRefs,
      created_by: createPacketRef(actorPacketId),
      adapter: 'nexus-web',
      metadata_tags: ['attestation', attestationKind.replace(/_/g, '-')],
      target_ref: { packet_id: claimPacket.header.packet_id },
      value: nextValue,
      status: desiredValue === 0 ? 'cleared' : 'active',
      attestation_kind: attestationKind,
      context_ref: null,
      supporting_refs: [],
      note,
      supersedes_ref: currentAttestationPacket
        ? { packet_id: currentAttestationPacket.header.packet_id }
        : null,
    });
  };

  if (input.intent.mode === 'clear') {
    const supportClear = await createRoleAttestationRevision(
      'claim_support',
      0,
      null
    );
    const disputeClear = await createRoleAttestationRevision(
      'claim_dispute',
      0,
      null
    );

    if (supportClear) {
      packets.push(supportClear);
    }

    if (disputeClear) {
      packets.push(disputeClear);
    }
  } else {
    const nextKind =
      input.intent.mode === 'support' ? 'claim_support' : 'claim_dispute';
    const oppositeKind =
      input.intent.mode === 'support' ? 'claim_dispute' : 'claim_support';
    const nextValue = input.intent.mode === 'support' ? 1 : -1;
    const oppositeClear = await createRoleAttestationRevision(
      oppositeKind,
      0,
      null
    );

    if (oppositeClear) {
      packets.push(oppositeClear);
    }

    const desiredPacket = await createRoleAttestationRevision(
      nextKind,
      nextValue,
      trimmedNote
    );

    if (desiredPacket) {
      packets.push(desiredPacket);
    }
  }

  const actionId: MutationActionId =
    input.intent.mode === 'support'
      ? 'role_association.attestation.support'
      : input.intent.mode === 'dispute'
        ? 'role_association.attestation.dispute'
        : 'role_association.attestation.clear';
  const mergedPolicyDecision = await input.policyGate.resolveScopePolicyDecision({
    governingScopePacket,
    actorPacket: input.actorPacket,
    actionIds: [actionId],
  });

  return {
    plan_kind: 'trusted_composite_workflow_plan',
    mutation_intent: input.intent.kind,
    adapter_id: LIVE_COMPOSITE_ADAPTER_IDS_BY_INTENT[input.intent.kind],
    prepared_mutation: {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id: governingScopePacket.header.packet_id,
      prepared_packets: await withPreparedDigests(packets),
    },
  };
}

export async function resolveTrustedLocalityPathCompositePlan(
  input: TrustedCompositeWorkflowMutationInput
): Promise<TrustedCompositeWorkflowPlan> {
  if (input.intent.kind !== 'locality.path.create') {
    throw new Error(
      `Unsupported locality path composite workflow intent: ${input.intent.kind}`
    );
  }

  const plannedResult = await planCanonicalLocalityPath({
    actorPacketId: input.actorPacket.header.packet_id,
    path: input.intent.path as LocalityCreatePathEntry[],
    createAnyway: input.intent.create_anyway,
  });
  const createdPackets = plannedResult.created_packets;
  const firstCreatedScopePacket = createdPackets.find(
    (packet): packet is PacketEnvelopeByType['Element'] =>
      packet.header.family === 'Element'
  );
  const governingScopePacket = firstCreatedScopePacket
    ? await requirePacket({
        packetStore: input.packetStore,
        packetId:
          getParentPacketId(firstCreatedScopePacket) ??
          firstCreatedScopePacket.header.packet_id,
        family: 'Element',
      })
    : null;
  const mergedPolicyDecision = await input.policyGate.resolveScopePolicyDecision({
    governingScopePacket,
    actorPacket: input.actorPacket,
    actionIds: ['locality.element.create'],
  });

  return {
    plan_kind: 'trusted_composite_workflow_plan',
    mutation_intent: input.intent.kind,
    adapter_id: LIVE_COMPOSITE_ADAPTER_IDS_BY_INTENT[input.intent.kind],
    prepared_mutation: {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id:
        governingScopePacket?.header.packet_id ?? input.actorPacket.header.packet_id,
      prepared_packets: await withPreparedDigests(createdPackets),
    },
    prepared_result: plannedResult,
  };
}

export async function resolveTrustedLocalityGraphCompositePlan(
  input: TrustedCompositeWorkflowMutationInput
): Promise<TrustedCompositeWorkflowPlan> {
  if (input.intent.kind !== 'locality.graph.apply') {
    throw new Error(
      `Unsupported locality graph composite workflow intent: ${input.intent.kind}`
    );
  }

  const graphPlan = await planLocalityGraphApplyPackets({
    packetStore: input.packetStore,
    actorPacket: input.actorPacket,
    intent: input.intent,
  });
  const mergedPolicyDecision =
    await input.policyGate.resolveMultiScopePolicyDecision({
      actorPacket: input.actorPacket,
      actionIds: graphPlan.actionIds,
      governingScopes: graphPlan.governingScopes,
    });

  return {
    plan_kind: 'trusted_composite_workflow_plan',
    mutation_intent: input.intent.kind,
    adapter_id: LIVE_COMPOSITE_ADAPTER_IDS_BY_INTENT[input.intent.kind],
    prepared_mutation: {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id:
        graphPlan.preferredGoverningScopePacket?.header.packet_id ??
        input.actorPacket.header.packet_id,
      prepared_packets: await withPreparedDigests(graphPlan.createdPackets),
    },
    prepared_result: graphPlan.plannedResult,
  };
}

export async function resolveTrustedDiscussionSurfacesCompositePlan(
  input: TrustedCompositeWorkflowMutationInput
): Promise<TrustedCompositeWorkflowPlan> {
  if (input.intent.kind !== 'discussion.surfaces.ensure') {
    throw new Error(
      `Unsupported discussion surfaces composite workflow intent: ${input.intent.kind}`
    );
  }

  const scopeNodes = await listAssemblyScopeNodes(input.packetStore);
  const scopeNode =
    scopeNodes.find((candidate) => candidate.routeId === input.intent.scope_id) ??
    null;

  if (!scopeNode) {
    throw new Error('Discussion surfaces can only be added to known assembly scopes.');
  }

  const packets = await planDefaultDiscussionSurfaces({
    packetStore: input.packetStore,
    scopePacketId: scopeNode.packetId,
    scopeName: scopeNode.name,
    applicableScopeRefs: buildApplicableScopeRefsFromNodes({
      scopePacketId: scopeNode.packetId,
      scopeNodes,
    }),
  });
  const mergedPolicyDecision = await input.policyGate.resolveScopePolicyDecision({
    governingScopePacket: scopeNode.packet,
    actorPacket: input.actorPacket,
    actionIds: ['discussion.surfaces.ensure'],
  });

  return {
    plan_kind: 'trusted_composite_workflow_plan',
    mutation_intent: input.intent.kind,
    adapter_id: LIVE_COMPOSITE_ADAPTER_IDS_BY_INTENT[input.intent.kind],
    prepared_mutation: {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id: scopeNode.packetId,
      prepared_packets: await withPreparedDigests(packets),
    },
  };
}

function createPreparedCompositeTicket(input: {
  ticketService: MutationTicketService;
  actorPacket: PacketEnvelopeByType['Element'];
  intent: MutationIntent;
  plan: TrustedCompositeWorkflowPlan;
}): PreparedCompositeMutationResult {
  return {
    ...input.ticketService.createPreparedMutationTicket({
      actorPacketId: input.actorPacket.header.packet_id,
      preparedMutation: input.plan.prepared_mutation,
      intent: input.intent,
      preparedResult: input.plan.prepared_result,
    }),
    prepared_result: input.plan.prepared_result,
  };
}

export async function runTrustedCompositeWorkflowMutation(
  input: TrustedCompositeWorkflowMutationInput
): Promise<PreparedMutation | PreparedCompositeMutationResult> {
  requireLiveCompositeAdapter(input.intent.kind);

  if (
    input.intent.kind === 'discussion.thread_post.create' ||
    input.intent.kind === 'discussion.reply.create'
  ) {
    return (await resolveTrustedDiscussionCompositePlan(input)).prepared_mutation;
  }

  if (input.intent.kind === 'actor.write_policy.update') {
    return (await resolveTrustedActorPolicyCompositePlan(input)).prepared_mutation;
  }

  if (input.intent.kind === 'assembly.element.create') {
    return (await resolveTrustedAssemblyElementCompositePlan(input))
      .prepared_mutation;
  }

  if (input.intent.kind === 'role_association.attestation.set') {
    return (await resolveTrustedRoleAttestationCompositePlan(input))
      .prepared_mutation;
  }

  if (input.intent.kind === 'discussion.surfaces.ensure') {
    return (await resolveTrustedDiscussionSurfacesCompositePlan(input))
      .prepared_mutation;
  }

  if (input.intent.kind === 'locality.path.create') {
    const plan = await resolveTrustedLocalityPathCompositePlan(input);

    return createPreparedCompositeTicket({
      ticketService: input.ticketService,
      actorPacket: input.actorPacket,
      intent: input.intent,
      plan,
    });
  }

  if (input.intent.kind === 'locality.graph.apply') {
    const plan = await resolveTrustedLocalityGraphCompositePlan(input);

    return createPreparedCompositeTicket({
      ticketService: input.ticketService,
      actorPacket: input.actorPacket,
      intent: input.intent,
      plan,
    });
  }

  throw new Error(
    `Unsupported live composite workflow mutation intent: ${
      (input.intent as MutationIntent).kind
    }`
  );
}
