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

async function requirePacket<TType extends PacketEnvelope['header']['type']>(
  input: {
    packetStore: NodeSQLitePacketStore;
    packetId: string;
    type: TType;
  }
): Promise<Extract<PacketEnvelope, { header: { type: TType } }>> {
  const packet = await input.packetStore.fetchByPacket({
    packet_id: input.packetId,
  });

  if (!packet || packet.header.type !== input.type) {
    throw new Error(`Unknown ${input.type} packet: ${input.packetId}`);
  }

  return packet as Extract<PacketEnvelope, { header: { type: TType } }>;
}

async function listAssemblyScopeNodes(
  packetStore: NodeSQLitePacketStore
): Promise<AssemblyScopeNode[]> {
  const [elementPackets, relationPackets] = await Promise.all([
    packetStore.listPreferredPacketsByType('Element'),
    listRelationPackets(packetStore),
  ]);
  const typedElementPackets = elementPackets as PacketEnvelopeByType['Element'][];
  const scopePackets = typedElementPackets.filter(
    (packet) => packet.body.subtype === 'assembly'
  );
  const parentResolutionsByPacketId = resolveScopeParentResolutions({
    scopePackets,
    relationPackets,
    getCompatibilityParentPacketId: getLegacyParentScopePacketIdCompatibility,
  });

  return typedElementPackets
    .filter((packet) => packet.body.subtype === 'assembly')
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

function requireCanonicalDiscussionPacket(input: {
  packet: PacketEnvelope | null;
  packetId: string;
  expectedSubtype?: PacketEnvelopeByType['Discussion']['body']['subtype'];
  label: string;
}): PacketEnvelopeByType['Discussion'] {
  if (input.packet?.header.type !== 'Discussion') {
    throw new Error(`Unknown discussion ${input.label}: ${input.packetId}`);
  }

  const packet = input.packet as PacketEnvelopeByType['Discussion'];

  if (
    input.expectedSubtype &&
    packet.body.subtype !== input.expectedSubtype
  ) {
    throw new Error(
      `Discussion ${input.label} ${input.packetId} is not a ${input.expectedSubtype}.`
    );
  }

  return packet;
}

type DiscussionPacketWithSubtype<
  TSubtype extends PacketEnvelopeByType['Discussion']['body']['subtype'],
> = PacketEnvelopeByType['Discussion'] & {
  body: Extract<PacketEnvelopeByType['Discussion']['body'], { subtype: TSubtype }>;
};

function requireDiscussionSubtype<
  TSubtype extends PacketEnvelopeByType['Discussion']['body']['subtype'],
>(
  packet: PacketEnvelopeByType['Discussion'],
  subtype: TSubtype,
  label: string
): DiscussionPacketWithSubtype<TSubtype> {
  if (packet.body.subtype !== subtype) {
    throw new Error(
      `Discussion ${label} ${packet.header.packet_id} is not a ${subtype}.`
    );
  }

  return packet as DiscussionPacketWithSubtype<TSubtype>;
}

function requireDiscussionPostOrMessage(
  packet: PacketEnvelopeByType['Discussion']
): DiscussionPacketWithSubtype<'post'> | DiscussionPacketWithSubtype<'message'> {
  if (packet.body.subtype !== 'post' && packet.body.subtype !== 'message') {
    throw new Error(`Unknown discussion post: ${packet.header.packet_id}`);
  }

  return packet as
    | DiscussionPacketWithSubtype<'post'>
    | DiscussionPacketWithSubtype<'message'>;
}

function getDiscussionTopicPacketId(
  packet: PacketEnvelopeByType['Discussion']
): string {
  if (packet.body.subtype === 'message') {
    return packet.body.topic_ref.packet_id;
  }

  if (packet.body.subtype === 'post') {
    return packet.body.parent_ref.packet_id;
  }

  return packet.header.packet_id;
}

function getDiscussionRootMessagePacketId(
  packet: PacketEnvelopeByType['Discussion']
): string {
  if (packet.body.subtype === 'message' && packet.body.root_message_ref) {
    return packet.body.root_message_ref.packet_id;
  }

  return packet.header.packet_id;
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
    const forumPacket = requireCanonicalDiscussionPacket({
      packet: rawForumPacket,
      packetId: input.intent.forum_packet_id,
      expectedSubtype: 'forum',
      label: 'forum',
    });
    const forumDiscussionPacket = requireDiscussionSubtype(
      forumPacket,
      'forum',
      'forum'
    );
    const governingScopePacket = forumPacket.header.authority_scope_ref
      ? await requirePacket({
          packetStore: input.packetStore,
          packetId: forumPacket.header.authority_scope_ref.packet_id,
          type: 'Element',
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
          forum_packet_id: forumDiscussionPacket.header.packet_id,
          forum_kind: forumDiscussionPacket.body.role,
          authority_scope_packet_id:
            forumDiscussionPacket.header.authority_scope_ref?.packet_id ?? null,
          applicable_scope_packet_ids: forumDiscussionPacket.header.applicable_scope_refs.map(
            (scopeRef) => scopeRef.packet_id
          ),
          default_sort: forumDiscussionPacket.body.default_sort,
          thread_title: input.intent.thread_title,
          post_markdown: input.intent.post_markdown,
          thread_kind: forumDiscussionPacket.body.role,
          related_packet_ids: input.intent.related_packet_ids ?? [],
          legacy_context_packet_ids: [],
        },
        actorPacket: input.actorPacket,
      }),
      ...mergedPolicyDecision,
    } satisfies MutationDecision;

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

  const discussionParentPacket = requireDiscussionPostOrMessage(requireCanonicalDiscussionPacket({
    packet: parentPacket,
    packetId: input.intent.parent_post_packet_id,
    label: 'post',
  }));

  const rawThreadPacket = await input.packetStore.fetchByPacket({
    packet_id: getDiscussionTopicPacketId(discussionParentPacket),
  });
  const threadPacket = requireDiscussionSubtype(requireCanonicalDiscussionPacket({
    packet: rawThreadPacket,
    packetId: getDiscussionTopicPacketId(discussionParentPacket),
    expectedSubtype: 'topic',
    label: 'thread',
  }), 'topic', 'thread');

  const rawForumPacket = await input.packetStore.fetchByPacket({
    packet_id: threadPacket.body.parent_ref.packet_id,
  });
  const forumPacket = requireDiscussionSubtype(requireCanonicalDiscussionPacket({
    packet: rawForumPacket,
    packetId: threadPacket.body.parent_ref.packet_id,
    expectedSubtype: 'forum',
    label: 'forum',
  }), 'forum', 'forum');

  const governingScopePacket = forumPacket.header.authority_scope_ref
    ? await requirePacket({
        packetStore: input.packetStore,
        packetId: forumPacket.header.authority_scope_ref.packet_id,
        type: 'Element',
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
        forum_kind: forumPacket.body.role,
        authority_scope_packet_id:
          discussionParentPacket.header.authority_scope_ref?.packet_id ?? null,
        applicable_scope_packet_ids: discussionParentPacket.header.applicable_scope_refs.map(
          (scopeRef) => scopeRef.packet_id
        ),
        thread_packet_id: threadPacket.header.packet_id,
        root_post_packet_id: getDiscussionRootMessagePacketId(
          discussionParentPacket
        ),
        parent_post_packet_id: discussionParentPacket.header.packet_id,
        reply_markdown: input.intent.reply_markdown,
        legacy_context_packet_ids: [],
      },
      actorPacket: input.actorPacket,
    }),
    ...mergedPolicyDecision,
  } satisfies MutationDecision;

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
    subtype: 'write_lock',
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
            existingPolicyPacket.body.subtype === 'write_lock'
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
    type: 'Element',
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
  const intent = input.intent as Extract<
    MutationIntent,
    { kind: 'role_association.attestation.set' }
  >;

  const claimPackets = await listClaimPackets(input.packetStore);
  const claimPacket = filterClaimPackets({
    claims: claimPackets,
    claimKind: 'role_association',
  }).find((candidate) => candidate.header.packet_id === intent.claim_packet_id);

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

  const trimmedNote = intent.note?.trim() ?? null;

  if (intent.mode === 'dispute' && !trimmedNote) {
    throw new Error('A dispute attestation requires a comment.');
  }

  const claimScopePacketId = claimPacket.body.scope_ref?.packet_id;
  if (!claimScopePacketId) {
    throw new Error('Role claim packet is missing a governing scope.');
  }

  const governingScopePacket = await requirePacket({
    packetStore: input.packetStore,
    packetId: claimScopePacketId,
    type: 'Element',
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
      existingPacket?.header.type === 'Attestation'
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
      created_at: intent.created_at ?? new Date().toISOString(),
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
      subtype: attestationKind,
      context_ref: null,
      supporting_refs: [],
      note,
      supersedes_ref: currentAttestationPacket
        ? { packet_id: currentAttestationPacket.header.packet_id }
        : null,
    });
  };

  if (intent.mode === 'clear') {
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
      intent.mode === 'support' ? 'claim_support' : 'claim_dispute';
    const oppositeKind =
      intent.mode === 'support' ? 'claim_dispute' : 'claim_support';
    const nextValue = intent.mode === 'support' ? 1 : -1;
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
    intent.mode === 'support'
      ? 'role_association.attestation.support'
      : intent.mode === 'dispute'
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
      packet.header.type === 'Element'
  );
  const governingScopePacket = firstCreatedScopePacket
    ? await requirePacket({
        packetStore: input.packetStore,
        packetId:
          getParentPacketId(firstCreatedScopePacket) ??
          firstCreatedScopePacket.header.packet_id,
        type: 'Element',
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
  const intent = input.intent as Extract<
    MutationIntent,
    { kind: 'discussion.surfaces.ensure' }
  >;

  const scopeNodes = await listAssemblyScopeNodes(input.packetStore);
  const scopeNode =
    scopeNodes.find((candidate) => candidate.routeId === intent.scope_id) ??
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
