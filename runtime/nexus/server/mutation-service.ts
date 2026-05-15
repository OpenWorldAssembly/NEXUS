/**
 * File: mutation-service.ts
 * Description: Orchestrates the shared fortress prepare/finalize mutation corridor over adapted packet state and runtime proofs.
 *
 * Explicit per-intent planning remains intentionally contained here for now so packet-type-
 * specific mutation law does not leak back into routes, screens, or unrelated runtime services.
 */

import { randomUUID } from 'node:crypto';

import type {
  MutationFinalizeRequest,
  MutationIntent,
  MutationPersistEffect,
  MutationTicket,
  PreparedMutation,
} from '@core/auth/mutation-corridor';
import {
  createDiscussionReplyCandidate,
  createDiscussionThreadPostCandidate,
  type MutationDecision,
} from '@core/auth/mutation-verifier';
import { getPacketUnsignedDigestCandidates } from '@core/auth/mutation-digests';
import {
  createAssociationClaimPacket,
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
import { buildPacketSignalAttestationPacket } from '@core/packets/discussion';
import {
  createCanonicalDiscussionPacketId,
  isDiscussionMessagePacket,
  projectDiscussionPacketToLegacy,
} from '@core/packets/discussion-compat';
import {
  planPacketTargetMigration,
  resolvePacketTarget,
} from '@core/packets/packet-target-resolver';
import type {
  MutationProofBundle,
} from '@core/auth/proof-types';
import type {
  MutationActionId,
} from '@core/auth/write-policy';
import type {
  AttestationKind,
  AttestationValue,
  DiscussionActorClass,
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import {
  filterClaimPackets,
  listClaimPackets,
} from '@runtime/nexus/server/claim-utils';
import {
  listRelationPackets,
} from '@runtime/nexus/server/relation-utils';
import { getLegacyParentScopePacketIdCompatibility } from '@runtime/nexus/server/scope-graph-compatibility';
import { resolveScopeParentResolutions } from '@runtime/nexus/server/scope-parent-resolution';
import {
  planDefaultDiscussionSurfaces,
} from '@runtime/nexus/server/default-discussion-surfaces';
import { toRouteScopeId } from '@runtime/nexus/server/discussion-service.scope';
import {
  planCanonicalLocalityPath,
  type LocalityCreatePathEntry,
} from '@runtime/nexus/server/locality-directory-service';
import {
  collectEligibleMainScopePacketIds,
  planLocalityGraphApplyPackets,
  type LocalityGraphApplyPreparedResult,
} from '@runtime/nexus/server/locality-graph-apply-planner';
import {
  planAssemblyAssociationRelationPackets,
  planFollowRelationPackets,
  planHomeLocalityRelationPackets,
} from '@runtime/nexus/server/elemental-scope-relation-planner';
import type { NexusAuthService } from '@runtime/nexus/server/auth-service';
import { SQLiteAttestationService } from '@runtime/nexus/server/attestation-service';
import { SQLiteDiscussionService } from '@runtime/nexus/server/discussion-service';
import { MutationTicketStore, type StoredMutationTicket } from '@runtime/nexus/server/mutation-ticket-store';
import { MutationTicketService } from '@runtime/nexus/server/mutation-ticket-service';
import { MutationPolicyGate } from '@runtime/nexus/server/mutation-policy-gate';
import {
  SignedPacketFinalizer,
  toMutationPersistEffects,
} from '@runtime/nexus/server/signed-packet-finalizer';
import {
  reconcileScopeDisplayPreferences,
  writeClaimedScopeDisplayPreferences,
} from '@runtime/nexus/server/scope-display-preferences';
import {
  buildWritePolicyBodyMarkdown,
  createActorWritePolicyPacketId,
  createWritePolicyForSecurityMode,
} from '@runtime/nexus/server/write-security-mode';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

type ActorContext = {
  actorPacket: PacketEnvelopeByType['Element'];
  actorKey: string;
  actorClass: DiscussionActorClass;
  proofBundle: MutationProofBundle;
};

type PreparedMutationResult = {
  ticket: MutationTicket;
  prepared_mutation: PreparedMutation;
};

type FinalizedMutationResult = {
  kind: MutationIntent['kind'];
  persist_effects: MutationPersistEffect[];
  result: unknown;
};

type AssemblyScopeNode = {
  packet: PacketEnvelopeByType['Element'];
  packetId: string;
  routeId: string;
  name: string;
  parentPacketId: string | null;
};

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

function createNextRevisionId(packetId: string, currentRevisionId?: string | null): string {
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

function assertNeverMutationKind(kind: never): never {
  throw new Error(`Unsupported mutation kind: ${kind}`);
}

function isClaimedActorPacket(actorPacket: PacketEnvelopeByType['Element']): boolean {
  return actorPacket.body.identity?.claim_status === 'claimed';
}

function isHomeLocalityMutationKind(
  kind: MutationIntent['kind']
): kind is 'home_locality.relation.set' | 'home_locality.claim.set' {
  return kind === 'home_locality.relation.set' || kind === 'home_locality.claim.set';
}



export class NexusMutationService {
  private readonly ticketService: MutationTicketService;
  private readonly signedPacketFinalizer: SignedPacketFinalizer;
  private readonly policyGate: MutationPolicyGate;

  constructor(
    private readonly packetStore: NodeSQLitePacketStore,
    private readonly authService: NexusAuthService,
    private readonly discussionService: SQLiteDiscussionService,
    private readonly attestationService: SQLiteAttestationService,
    ticketStore: MutationTicketStore
  ) {
    this.ticketService = new MutationTicketService(ticketStore);
    this.signedPacketFinalizer = new SignedPacketFinalizer(packetStore);
    this.policyGate = new MutationPolicyGate(packetStore, authService);
  }

  private async requirePacket<TFamily extends PacketEnvelope['header']['family']>(input: {
    packetId: string;
    family: TFamily;
  }): Promise<Extract<PacketEnvelope, { header: { family: TFamily } }>> {
    const packet = await this.packetStore.fetchByPacket({ packet_id: input.packetId });

    if (!packet || packet.header.family !== input.family) {
      throw new Error(`Unknown ${input.family} packet: ${input.packetId}`);
    }

    return packet as Extract<PacketEnvelope, { header: { family: TFamily } }>;
  }

  private async listAssemblyScopeNodes(): Promise<AssemblyScopeNode[]> {
    const [elementPackets, relationPackets] = await Promise.all([
      this.packetStore.listPreferredPacketsByFamily('Element'),
      listRelationPackets(this.packetStore),
    ]);
    const typedElementPackets = elementPackets as PacketEnvelopeByType['Element'][];
    const scopePackets = typedElementPackets.filter((packet) => packet.body.kind === 'assembly');
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
          parentResolutionsByPacketId.get(packet.header.packet_id)?.parentPacketId ?? null,
      }));
  }

  private buildApplicableScopeRefsFromNodes(input: {
    scopePacketId: string;
    scopeNodes: AssemblyScopeNode[];
  }) {
    const parentByPacketId = new Map(
      input.scopeNodes.map((scopeNode) => [scopeNode.packetId, scopeNode.parentPacketId])
    );

    return createApplicableScopeRefs({
      scopePacketId: input.scopePacketId,
      parentPacketId: parentByPacketId.get(input.scopePacketId) ?? null,
      parentByPacketId,
    });
  }

  private async planCanonicalDiscussionMirrors(input: {
    packet: PacketEnvelope;
  }): Promise<{
    canonical_packet_id: string;
    packets: PacketEnvelopeByType['Discussion'][];
  }> {
    const resolution = await resolvePacketTarget({
      packet_id: input.packet.header.packet_id,
      fetchPacket: async (packetId) =>
        this.packetStore.fetchByPacket({ packet_id: packetId }),
      fetchRevisionHeads: async (packetId) =>
        this.packetStore.fetchRevisionHeads({ packet_id: packetId }),
    });
    const migrationPlan = await planPacketTargetMigration({
      packet_id: input.packet.header.packet_id,
      resolution,
      fetchPacket: async (packetId) =>
        this.packetStore.fetchByPacket({ packet_id: packetId }),
      fetchRevisionHeads: async (packetId) =>
        this.packetStore.fetchRevisionHeads({ packet_id: packetId }),
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

  private async prepareDiscussionThreadPost(input: {
    intent: Extract<MutationIntent, { kind: 'discussion.thread_post.create' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    const rawForumPacket = await this.packetStore.fetchByPacket({
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
        : await this.planCanonicalDiscussionMirrors({ packet: rawForumPacket });

    const governingScopePacket = forumPacket.header.authority_scope_ref
      ? await this.requirePacket({
          packetId: forumPacket.header.authority_scope_ref.packet_id,
          family: 'Element',
        })
      : null;
    const mergedPolicyDecision = await this.policyGate.resolveScopePolicyDecision({
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
    const digests = await Promise.all(
      decision.packets.map(async (packet) => {
        const candidates = await getPacketUnsignedDigestCandidates(packet);
        return candidates[0]?.digest ?? '';
      })
    );

    return normalizePreparedMutation({
      kind: input.intent.kind,
      decision,
      digests,
    });
  }

  private async prepareDiscussionReply(input: {
    intent: Extract<MutationIntent, { kind: 'discussion.reply.create' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    const parentPacket = await this.packetStore.fetchByPacket({
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
        : await this.planCanonicalDiscussionMirrors({ packet: parentPacket });

    const rawThreadPacket = await this.packetStore.fetchByPacket({
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

    const rawForumPacket = await this.packetStore.fetchByPacket({
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
      ? await this.requirePacket({
          packetId: forumPacket.header.authority_scope_ref.packet_id,
          family: 'Element',
        })
      : null;
    const mergedPolicyDecision = await this.policyGate.resolveScopePolicyDecision({
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
    const digests = await Promise.all(
      decision.packets.map(async (packet) => {
        const candidates = await getPacketUnsignedDigestCandidates(packet);
        return candidates[0]?.digest ?? '';
      })
    );

    return normalizePreparedMutation({
      kind: input.intent.kind,
      decision,
      digests,
    });
  }

  private async preparePacketSignal(input: {
    intent: Extract<MutationIntent, { kind: 'attestation.packet_signal.set' }>;
    actorPacket: PacketEnvelopeByType['Element'];
    actorKey: string;
  }): Promise<PreparedMutation> {
    const targetPacket = await this.packetStore.fetchByPacket({
      packet_id: input.intent.target_packet_id,
    });

    if (
      !targetPacket ||
      (targetPacket.header.family !== 'DiscussionPost' &&
        targetPacket.header.family !== 'DiscussionReply' &&
        !isDiscussionMessagePacket(targetPacket))
    ) {
      throw new Error(`Unknown packet vote target: ${input.intent.target_packet_id}`);
    }

    const summary = await this.attestationService.getTargetSummary({
      target_packet_id: input.intent.target_packet_id,
      viewer_actor_key: input.actorKey,
    });
    const attestationPacket = buildPacketSignalAttestationPacket({
      scopeId: input.intent.scope_id,
      actorPacket: input.actorPacket,
      targetPost: {
        packet: { packet_id: targetPacket.header.packet_id },
        authority_scope_packet_id:
          targetPacket.header.authority_scope_ref?.packet_id ?? null,
        applicable_scope_packet_ids: targetPacket.header.applicable_scope_refs.map(
          (scopeRef) => scopeRef.packet_id
        ),
        vote_summary: summary,
      },
      value: input.intent.value,
      createdAt: input.intent.created_at ?? new Date().toISOString(),
    });

    if (!attestationPacket) {
      throw new Error('The packet vote is already cleared.');
    }

    const digests = await getPacketUnsignedDigestCandidates(attestationPacket);

    const governingScopePacket = targetPacket.header.authority_scope_ref
      ? await this.requirePacket({
          packetId: targetPacket.header.authority_scope_ref.packet_id,
          family: 'Element',
        })
      : null;
    const actionId: MutationActionId =
      input.intent.value === 0
        ? 'attestation.packet_signal.clear'
        : 'attestation.packet_signal.set';
    const mergedPolicyDecision = await this.policyGate.resolveScopePolicyDecision({
      governingScopePacket,
      actorPacket: input.actorPacket,
      actionIds: [actionId],
    });

    return {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id:
        attestationPacket.header.authority_scope_ref?.packet_id ??
        governingScopePacket?.header.packet_id ??
        null,
      prepared_packets: [
        {
          packet: attestationPacket,
          unsigned_digest: digests[0]?.digest ?? '',
        },
      ],
    };
  }

  private async prepareActorWritePolicyUpdate(input: {
    intent: Extract<MutationIntent, { kind: 'actor.write_policy.update' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    const {
      currentPolicyDecision,
      existingPolicyPackets,
      existingWritePolicyPacket,
    } = await this.policyGate.resolveActorWritePolicyUpdate({
      actorPacket: input.actorPacket,
    });
    const writePolicyPacketId =
      existingWritePolicyPacket?.header.packet_id ??
      createActorWritePolicyPacketId(input.actorPacket.header.packet_id);
    const nextCreatedAt = input.intent.created_at ?? new Date().toISOString();
    const nextWritePolicy = createWritePolicyForSecurityMode(input.intent.security_mode);
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
            (policyPacket) =>
              policyPacket.header.packet_id === policyRef.packet_id &&
              policyPacket.body.policy_kind === 'write_lock'
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

    const preparedPackets = await Promise.all(
      packets.map(async (packet) => {
        const digests = await getPacketUnsignedDigestCandidates(packet);

        return {
          packet,
          unsigned_digest: digests[0]?.digest ?? '',
        };
      })
    );

    return {
      kind: input.intent.kind,
      ...currentPolicyDecision,
      governing_scope_packet_id: input.actorPacket.header.packet_id,
      prepared_packets: preparedPackets,
    };
  }

  private async prepareAssemblyElementCreate(input: {
    intent: Extract<MutationIntent, { kind: 'assembly.element.create' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    const parentScopePacket = await this.requirePacket({
      packetId: input.intent.parent_scope_packet_id,
      family: 'Element',
    });
    const scopeNodes = await this.listAssemblyScopeNodes();
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
        packetStore: this.packetStore,
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

    const mergedPolicyDecision = await this.policyGate.resolveScopePolicyDecision({
      governingScopePacket: parentScopePacket,
      actorPacket: input.actorPacket,
      actionIds,
    });
    const preparedPackets = await Promise.all(
      packets.map(async (packet) => {
        const digests = await getPacketUnsignedDigestCandidates(packet);

        return {
          packet,
          unsigned_digest: digests[0]?.digest ?? '',
        };
      })
    );

    return {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id: parentScopePacket.header.packet_id,
      prepared_packets: preparedPackets,
    };
  }

  private async prepareAssemblyAssociationRelation(input: {
    intent:
      | Extract<MutationIntent, { kind: 'assembly_association.relation.set' }>
      | Extract<MutationIntent, { kind: 'assembly_association.relation.clear' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    const assemblyPacket = await this.requirePacket({
      packetId: input.intent.assembly_packet_id,
      family: 'Element',
    });
    const isSetIntent = input.intent.kind === 'assembly_association.relation.set';
    const relationPlan = await planAssemblyAssociationRelationPackets({
      packetStore: this.packetStore,
      actorPacket: input.actorPacket,
      targetScopePacket: assemblyPacket,
      mode: isSetIntent ? 'set' : 'clear',
      note: isSetIntent ? input.intent.note ?? null : null,
    });
    const mergedPolicyDecision = await this.policyGate.resolveScopePolicyDecision({
      governingScopePacket: assemblyPacket,
      actorPacket: input.actorPacket,
      actionIds: [
        isSetIntent
          ? 'assembly_association.relation.set'
          : 'assembly_association.relation.clear',
      ],
    });
    const preparedPackets = await Promise.all(
      relationPlan.packets.map(async (packet) => {
        const digests = await getPacketUnsignedDigestCandidates(packet);

        return {
          packet,
          unsigned_digest: digests[0]?.digest ?? '',
        };
      })
    );

    return {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id: assemblyPacket.header.packet_id,
      prepared_packets: preparedPackets,
    };
  }

  private async prepareAssemblyAssociationClaimCompatibilityAlias(input: {
    intent: Extract<MutationIntent, { kind: 'assembly_association.claim.set' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    const preparedMutation = await this.prepareAssemblyAssociationRelation({
      intent:
        input.intent.value === 1
          ? {
              kind: 'assembly_association.relation.set',
              assembly_packet_id: input.intent.assembly_packet_id,
              scope_id: input.intent.scope_id,
              note: input.intent.note ?? null,
              created_at: input.intent.created_at,
              mutation_nonce: input.intent.mutation_nonce,
            }
          : {
              kind: 'assembly_association.relation.clear',
              assembly_packet_id: input.intent.assembly_packet_id,
              scope_id: input.intent.scope_id,
              created_at: input.intent.created_at,
              mutation_nonce: input.intent.mutation_nonce,
            },
      actorPacket: input.actorPacket,
    });

    return {
      ...preparedMutation,
      kind: input.intent.kind,
    };
  }

  private async prepareHomeLocalityRelation(input: {
    intent: Extract<MutationIntent, { kind: 'home_locality.relation.set' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    const homeScopePacket = input.intent.home_scope_packet_id
      ? await this.requirePacket({
          packetId: input.intent.home_scope_packet_id,
          family: 'Element',
        })
      : null;
    const relationPlan = await planHomeLocalityRelationPackets({
      packetStore: this.packetStore,
      actorPacket: input.actorPacket,
      homeScopePacket,
      forceSelectedRevision: true,
    });
    const actionIds: MutationActionId[] = [
      input.intent.home_scope_packet_id
        ? 'home_locality.relation.set'
        : 'home_locality.relation.clear',
    ];
    const mergedPolicyDecision = await this.policyGate.resolveScopePolicyDecision({
      governingScopePacket: relationPlan.governingScopePacket,
      actorPacket: input.actorPacket,
      actionIds,
    });
    const preparedPackets = await Promise.all(
      relationPlan.packets.map(async (packet) => {
        const digests = await getPacketUnsignedDigestCandidates(packet);

        return {
          packet,
          unsigned_digest: digests[0]?.digest ?? '',
        };
      })
    );

    return {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id:
        relationPlan.governingScopePacket?.header.packet_id ?? input.actorPacket.header.packet_id,
      prepared_packets: preparedPackets,
    };
  }

  private async prepareHomeLocalityClaimCompatibilityAlias(input: {
    intent: Extract<MutationIntent, { kind: 'home_locality.claim.set' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    const preparedMutation = await this.prepareHomeLocalityRelation({
      intent: {
        kind: 'home_locality.relation.set',
        home_scope_packet_id: input.intent.home_scope_packet_id,
        created_at: input.intent.created_at,
        mutation_nonce: input.intent.mutation_nonce,
      },
      actorPacket: input.actorPacket,
    });

    return {
      ...preparedMutation,
      kind: input.intent.kind,
    };
  }

  private async prepareFollowRelation(input: {
    intent:
      | Extract<MutationIntent, { kind: 'follows.relation.set' }>
      | Extract<MutationIntent, { kind: 'follows.relation.clear' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    if (!isClaimedActorPacket(input.actorPacket)) {
      throw new Error('Follow relations require a claimed identity.');
    }

    const targetScopePacket = await this.requirePacket({
      packetId: input.intent.target_scope_packet_id,
      family: 'Element',
    });
    const isSetIntent = input.intent.kind === 'follows.relation.set';
    const relationPlan = await planFollowRelationPackets({
      packetStore: this.packetStore,
      actorPacket: input.actorPacket,
      targetScopePacket,
      mode: isSetIntent ? 'set' : 'clear',
    });
    const mergedPolicyDecision = await this.policyGate.resolveScopePolicyDecision({
      governingScopePacket: targetScopePacket,
      actorPacket: input.actorPacket,
      actionIds: [isSetIntent ? 'follows.relation.set' : 'follows.relation.clear'],
    });
    const preparedPackets = await Promise.all(
      relationPlan.packets.map(async (packet) => {
        const digests = await getPacketUnsignedDigestCandidates(packet);

        return {
          packet,
          unsigned_digest: digests[0]?.digest ?? '',
        };
      })
    );

    return {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id: targetScopePacket.header.packet_id,
      prepared_packets: preparedPackets,
    };
  }

  private async prepareRoleAssociationClaim(input: {
    intent: Extract<MutationIntent, { kind: 'role_association.claim.set' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    const rolePacket = await this.requirePacket({
      packetId: input.intent.role_packet_id,
      family: 'Role',
    });
    const governingScopePacket = rolePacket.header.authority_scope_ref
      ? await this.requirePacket({
          packetId: rolePacket.header.authority_scope_ref.packet_id,
          family: 'Element',
        })
      : null;
    const scopePacketId =
      governingScopePacket?.header.packet_id ??
      rolePacket.header.authority_scope_ref?.packet_id ??
      input.actorPacket.header.packet_id;
    const claimPacketId = createClaimPacketId({
      claimKind: 'role_association',
      subjectPacketId: input.actorPacket.header.packet_id,
      targetPacketId: rolePacket.header.packet_id,
      scopePacketId,
    });
    const existingPreferredRevision = await this.packetStore.fetchPreferredRevision({
      packet_id: claimPacketId,
    });
    const claimPacket = createAssociationClaimPacket({
      claimKind: 'role_association',
      subjectPacketId: input.actorPacket.header.packet_id,
      targetPacketId: rolePacket.header.packet_id,
      scopePacketId,
      applicableScopeRefs:
        governingScopePacket?.header.applicable_scope_refs.length
          ? governingScopePacket.header.applicable_scope_refs
          : rolePacket.header.applicable_scope_refs.length > 0
            ? rolePacket.header.applicable_scope_refs
            : [{ packet_id: scopePacketId }],
      createdByPacketId: input.actorPacket.header.packet_id,
      status: input.intent.claimed ? 'active' : 'withdrawn',
      packetId: claimPacketId,
      parentRevisionRefs: existingPreferredRevision ? [existingPreferredRevision] : [],
    });
    const mergedPolicyDecision = await this.policyGate.resolveScopePolicyDecision({
      governingScopePacket,
      actorPacket: input.actorPacket,
      actionIds: [
        input.intent.claimed
          ? 'role_association.claim.set'
          : 'role_association.claim.withdraw',
      ],
    });
    const digests = await getPacketUnsignedDigestCandidates(claimPacket);

    return {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id: scopePacketId,
      prepared_packets: [
        {
          packet: claimPacket,
          unsigned_digest: digests[0]?.digest ?? '',
        },
      ],
    };
  }

  private async prepareRoleAssociationAttestation(input: {
    intent: Extract<MutationIntent, { kind: 'role_association.attestation.set' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    const claimPackets = await listClaimPackets(this.packetStore);
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

    const governingScopePacket = await this.requirePacket({
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
      const existingPreferredRevision = await this.packetStore.fetchPreferredRevision({
        packet_id: packetId,
      });
      const existingPacket =
        existingPreferredRevision === null
          ? null
          : await this.packetStore.fetchByRevision(existingPreferredRevision);
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
        parent_revision_refs: existingPreferredRevision ? [existingPreferredRevision] : [],
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
    const mergedPolicyDecision = await this.policyGate.resolveScopePolicyDecision({
      governingScopePacket,
      actorPacket: input.actorPacket,
      actionIds: [actionId],
    });
    const preparedPackets = await Promise.all(
      packets.map(async (packet) => {
        const digests = await getPacketUnsignedDigestCandidates(packet);

        return {
          packet,
          unsigned_digest: digests[0]?.digest ?? '',
        };
      })
    );

    return {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id: governingScopePacket.header.packet_id,
      prepared_packets: preparedPackets,
    };
  }


  private async prepareLocalityPathCreate(input: {
    intent: Extract<MutationIntent, { kind: 'locality.path.create' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutationResult & { prepared_result: unknown }> {
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
    const governingScopePacket =
      firstCreatedScopePacket
        ? await this.requirePacket({
            packetId:
              getParentPacketId(firstCreatedScopePacket) ??
              firstCreatedScopePacket.header.packet_id,
            family: 'Element',
          })
        : null;
    const mergedPolicyDecision = await this.policyGate.resolveScopePolicyDecision({
      governingScopePacket,
      actorPacket: input.actorPacket,
      actionIds: ['locality.element.create'],
    });
    const preparedPackets = await Promise.all(
      createdPackets.map(async (packet) => {
        const digests = await getPacketUnsignedDigestCandidates(packet);

        return {
          packet,
          unsigned_digest: digests[0]?.digest ?? '',
        };
      })
    );
    const preparedMutation: PreparedMutation = {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id:
        governingScopePacket?.header.packet_id ?? input.actorPacket.header.packet_id,
      prepared_packets: preparedPackets,
    };
    return {
      ...this.ticketService.createPreparedMutationTicket({
        actorPacketId: input.actorPacket.header.packet_id,
        preparedMutation,
        intent: input.intent,
        preparedResult: plannedResult,
      }),
      prepared_result: plannedResult,
    };
  }

  private async prepareLocalityGraphApply(input: {
    intent: Extract<MutationIntent, { kind: 'locality.graph.apply' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutationResult & { prepared_result: unknown }> {
    const graphPlan = await planLocalityGraphApplyPackets({
      packetStore: this.packetStore,
      actorPacket: input.actorPacket,
      intent: input.intent,
    });
    const mergedPolicyDecision = await this.policyGate.resolveMultiScopePolicyDecision({
      actorPacket: input.actorPacket,
      actionIds: graphPlan.actionIds,
      governingScopes: graphPlan.governingScopes,
    });
    const preparedPackets = await Promise.all(
      graphPlan.createdPackets.map(async (packet) => {
        const digests = await getPacketUnsignedDigestCandidates(packet);

        return {
          packet,
          unsigned_digest: digests[0]?.digest ?? '',
        };
      })
    );
    const preparedMutation: PreparedMutation = {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id:
        graphPlan.preferredGoverningScopePacket?.header.packet_id ??
        input.actorPacket.header.packet_id,
      prepared_packets: preparedPackets,
    };
    return {
      ...this.ticketService.createPreparedMutationTicket({
        actorPacketId: input.actorPacket.header.packet_id,
        preparedMutation,
        intent: input.intent,
        preparedResult: graphPlan.plannedResult,
      }),
      prepared_result: graphPlan.plannedResult,
    };
  }

  private async prepareDiscussionSurfacesEnsure(input: {
    intent: Extract<MutationIntent, { kind: 'discussion.surfaces.ensure' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    const scopeNodes = await this.listAssemblyScopeNodes();
    const scopeNode =
      scopeNodes.find((candidate) => candidate.routeId === input.intent.scope_id) ?? null;

    if (!scopeNode) {
      throw new Error('Discussion surfaces can only be added to known assembly scopes.');
    }

    const packets = await planDefaultDiscussionSurfaces({
      packetStore: this.packetStore,
      scopePacketId: scopeNode.packetId,
      scopeName: scopeNode.name,
      applicableScopeRefs: this.buildApplicableScopeRefsFromNodes({
        scopePacketId: scopeNode.packetId,
        scopeNodes,
      }),
    });
    const mergedPolicyDecision = await this.policyGate.resolveScopePolicyDecision({
      governingScopePacket: scopeNode.packet,
      actorPacket: input.actorPacket,
      actionIds: ['discussion.surfaces.ensure'],
    });
    const preparedPackets = await Promise.all(
      packets.map(async (packet) => {
        const digests = await getPacketUnsignedDigestCandidates(packet);

        return {
          packet,
          unsigned_digest: digests[0]?.digest ?? '',
        };
      })
    );

    return {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id: scopeNode.packetId,
      prepared_packets: preparedPackets,
    };
  }

  readTicket(ticketId: string) {
    return this.ticketService.read(ticketId);
  }

  async prepareMutation(input: {
    intent: MutationIntent;
    actorPacket: PacketEnvelopeByType['Element'];
    actorKey: string;
  }): Promise<PreparedMutationResult> {
    if (input.intent.kind === 'locality.path.create') {
      const preparedLocalityMutation = await this.prepareLocalityPathCreate({
        intent: input.intent,
        actorPacket: input.actorPacket,
      });

      return preparedLocalityMutation;
    }

    if (input.intent.kind === 'locality.graph.apply') {
      const preparedLocalityGraphMutation = await this.prepareLocalityGraphApply({
        intent: input.intent,
        actorPacket: input.actorPacket,
      });

      return preparedLocalityGraphMutation;
    }

    const preparedMutation =
      input.intent.kind === 'discussion.thread_post.create'
        ? await this.prepareDiscussionThreadPost({
            intent: input.intent,
            actorPacket: input.actorPacket,
          })
        : input.intent.kind === 'discussion.reply.create'
          ? await this.prepareDiscussionReply({
              intent: input.intent,
              actorPacket: input.actorPacket,
            })
          : input.intent.kind === 'attestation.packet_signal.set'
            ? await this.preparePacketSignal({
                intent: input.intent,
                actorPacket: input.actorPacket,
                actorKey: input.actorKey,
              })
            : input.intent.kind === 'assembly.element.create'
              ? await this.prepareAssemblyElementCreate({
                  intent: input.intent,
                  actorPacket: input.actorPacket,
                })
              : input.intent.kind === 'assembly_association.claim.set'
                ? await this.prepareAssemblyAssociationClaimCompatibilityAlias({
                    intent: input.intent,
                    actorPacket: input.actorPacket,
                  })
                : input.intent.kind === 'assembly_association.relation.set' ||
                    input.intent.kind === 'assembly_association.relation.clear'
                  ? await this.prepareAssemblyAssociationRelation({
                      intent: input.intent,
                      actorPacket: input.actorPacket,
                    })
                : input.intent.kind === 'home_locality.relation.set'
                  ? await this.prepareHomeLocalityRelation({
                      intent: input.intent,
                      actorPacket: input.actorPacket,
                    })
                  : input.intent.kind === 'home_locality.claim.set'
                    ? await this.prepareHomeLocalityClaimCompatibilityAlias({
                        intent: input.intent,
                        actorPacket: input.actorPacket,
                      })
                    : input.intent.kind === 'follows.relation.set' ||
                        input.intent.kind === 'follows.relation.clear'
                      ? await this.prepareFollowRelation({
                          intent: input.intent,
                          actorPacket: input.actorPacket,
                        })
                    : input.intent.kind === 'role_association.claim.set'
                      ? await this.prepareRoleAssociationClaim({
                          intent: input.intent,
                          actorPacket: input.actorPacket,
                        })
                      : input.intent.kind === 'role_association.attestation.set'
                        ? await this.prepareRoleAssociationAttestation({
                            intent: input.intent,
                            actorPacket: input.actorPacket,
                          })
                        : input.intent.kind === 'discussion.surfaces.ensure'
                          ? await this.prepareDiscussionSurfacesEnsure({
                              intent: input.intent,
                              actorPacket: input.actorPacket,
                            })
                          : await this.prepareActorWritePolicyUpdate({
                              intent: input.intent,
                              actorPacket: input.actorPacket,
                            });

    return this.ticketService.createPreparedMutationTicket({
      actorPacketId: input.actorPacket.header.packet_id,
      preparedMutation,
      intent: input.intent,
    });
  }

  private async finalizeDiscussionThreadPost(input: {
    storedTicket: StoredMutationTicket;
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
  }) {
    const mirrorPackets = input.signedPackets.slice(0, -2);
    const [threadPacket, postPacket] = input.signedPackets.slice(-2);

    if (!threadPacket || !postPacket) {
      throw new Error('Signed discussion thread/post packet bundle is incomplete.');
    }
    const threadProjection =
      threadPacket.header.family === 'Discussion'
        ? (projectDiscussionPacketToLegacy(
            threadPacket as PacketEnvelopeByType['Discussion'],
            'DiscussionThread'
          ) as PacketEnvelopeByType['DiscussionThread'] | null)
        : threadPacket.header.family === 'DiscussionThread'
          ? (threadPacket as PacketEnvelopeByType['DiscussionThread'])
          : null;
    const postProjection =
      postPacket.header.family === 'Discussion'
        ? (projectDiscussionPacketToLegacy(
            postPacket as PacketEnvelopeByType['Discussion'],
            'DiscussionPost'
          ) as PacketEnvelopeByType['DiscussionPost'] | null)
        : postPacket.header.family === 'DiscussionPost'
          ? (postPacket as PacketEnvelopeByType['DiscussionPost'])
          : null;

    if (!threadProjection || !postProjection) {
      throw new Error('Signed discussion thread/post packets are not projectable.');
    }

    if (mirrorPackets.length > 0) {
      await this.signedPacketFinalizer.persistSignedPacketsForActor({
        actorPacket: input.actorContext.actorPacket,
        signedPackets: mirrorPackets,
      });
    }

    const result = await this.discussionService.createPost({
      scope_id:
        input.storedTicket.intent.kind === 'discussion.thread_post.create'
          ? input.storedTicket.intent.scope_id
          : input.actorContext.actorPacket.header.packet_id,
      actor_key: input.actorContext.actorKey,
      actor_class: input.actorContext.actorClass,
      actor_packet: input.actorContext.actorPacket,
      proof_bundle: input.actorContext.proofBundle,
      intent: {
        kind: 'discussion.thread_post.create',
        scope_id:
          input.storedTicket.intent.kind === 'discussion.thread_post.create'
            ? input.storedTicket.intent.scope_id
            : input.actorContext.actorPacket.header.packet_id,
        mutation_nonce:
          input.storedTicket.intent.kind === 'discussion.thread_post.create'
            ? input.storedTicket.intent.mutation_nonce?.trim() || 'prepared00'
            : 'prepared00',
        created_at: threadProjection.header.created_at,
        forum_packet_id: threadProjection.body.forum_ref.packet_id,
        forum_kind:
          typeof threadProjection.header.metadata.tags[2] === 'string'
            ? threadProjection.header.metadata.tags[2]
            : threadProjection.body.thread_kind,
        authority_scope_packet_id:
          threadProjection.header.authority_scope_ref?.packet_id ?? null,
        applicable_scope_packet_ids: threadProjection.header.applicable_scope_refs.map(
          (scopeRef) => scopeRef.packet_id
        ),
        default_sort: threadProjection.body.default_sort,
        thread_title: threadProjection.body.title,
        post_markdown: postProjection.body.content_markdown,
        thread_kind: threadProjection.body.thread_kind,
        related_packet_ids: threadProjection.body.related_refs.map(
          (relatedRef) => relatedRef.packet_id
        ),
      },
      signed_thread_packet: threadPacket,
      signed_post_packet: postPacket,
    });

    return {
      persist_effects: toMutationPersistEffects([threadPacket, postPacket]),
      result,
    };
  }

  private async finalizeDiscussionReply(input: {
    storedTicket: StoredMutationTicket;
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
  }) {
    const mirrorPackets = input.signedPackets.slice(0, -1);
    const [replyPacket] = input.signedPackets.slice(-1);

    if (!replyPacket) {
      throw new Error('Signed discussion reply packet bundle is incomplete.');
    }
    const replyProjection =
      replyPacket.header.family === 'Discussion'
        ? (projectDiscussionPacketToLegacy(
            replyPacket as PacketEnvelopeByType['Discussion'],
            'DiscussionReply'
          ) as PacketEnvelopeByType['DiscussionReply'] | null)
        : replyPacket.header.family === 'DiscussionReply'
          ? (replyPacket as PacketEnvelopeByType['DiscussionReply'])
          : null;

    if (!replyProjection) {
      throw new Error('Signed discussion reply packet is not projectable.');
    }

    if (mirrorPackets.length > 0) {
      await this.signedPacketFinalizer.persistSignedPacketsForActor({
        actorPacket: input.actorContext.actorPacket,
        signedPackets: mirrorPackets,
      });
    }

    const result = await this.discussionService.createReply({
      scope_id:
        input.storedTicket.intent.kind === 'discussion.reply.create'
          ? input.storedTicket.intent.scope_id
          : input.actorContext.actorPacket.header.packet_id,
      actor_key: input.actorContext.actorKey,
      actor_class: input.actorContext.actorClass,
      actor_packet: input.actorContext.actorPacket,
      proof_bundle: input.actorContext.proofBundle,
      intent: {
        kind: 'discussion.reply.create',
        scope_id:
          input.storedTicket.intent.kind === 'discussion.reply.create'
            ? input.storedTicket.intent.scope_id
            : input.actorContext.actorPacket.header.packet_id,
        mutation_nonce:
          input.storedTicket.intent.kind === 'discussion.reply.create'
            ? input.storedTicket.intent.mutation_nonce?.trim() || 'prepared00'
            : 'prepared00',
        created_at: replyProjection.header.created_at,
        forum_kind:
          typeof replyProjection.header.metadata.tags[3] === 'string'
            ? replyProjection.header.metadata.tags[3]
            : 'general',
        authority_scope_packet_id:
          replyProjection.header.authority_scope_ref?.packet_id ?? null,
        applicable_scope_packet_ids: replyProjection.header.applicable_scope_refs.map(
          (scopeRef) => scopeRef.packet_id
        ),
        thread_packet_id: replyProjection.body.thread_ref.packet_id,
        root_post_packet_id: replyProjection.body.root_post_ref.packet_id,
        parent_post_packet_id: replyProjection.body.reply_to_ref.packet_id,
        reply_markdown: replyProjection.body.content_markdown,
      },
      signed_reply_packet: replyPacket,
    });

    return {
      persist_effects: toMutationPersistEffects([replyPacket]),
      result,
    };
  }

  private async finalizePacketSignal(input: {
    actorContext: ActorContext;
    signedPackets: [PacketEnvelopeByType['Attestation']];
  }) {
    const [attestationPacket] = input.signedPackets;
    const summary = await this.attestationService.persistSignedAttestation({
      attestation_packet: attestationPacket,
      actor_packet: input.actorContext.actorPacket,
      actor_key: input.actorContext.actorKey,
      actor_class: input.actorContext.actorClass,
    });

    return {
      persist_effects: toMutationPersistEffects([attestationPacket]),
      result: {
        target_packet_id: attestationPacket.body.target_ref.packet_id,
        value: (attestationPacket.body.status === 'cleared'
          ? 0
          : attestationPacket.body.value) as -1 | 0 | 1,
        summary,
      },
    };
  }

  private async finalizeActorWritePolicyUpdate(input: {
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
  }) {
    await this.signedPacketFinalizer.persistSignedPacketsForActor({
      actorPacket: input.actorContext.actorPacket,
      signedPackets: input.signedPackets,
      signatureFailureMessage: 'Signed write-policy packet verification failed.',
    });

    const latestActorElementPacket = [...input.signedPackets]
      .reverse()
      .find(
        (
          packet
        ): packet is PacketEnvelopeByType['Element'] =>
          packet.header.family === 'Element' &&
          packet.header.packet_id === input.actorContext.actorPacket.header.packet_id
      );

    if (latestActorElementPacket) {
      await this.packetStore.publishRevision({
        packet_id: latestActorElementPacket.header.packet_id,
        revision_id: latestActorElementPacket.header.revision_id,
      });
    }

    const securityMode = await this.authService.resolveEffectiveSecurityMode(
      input.actorContext.actorPacket.header.packet_id
    );

    return {
      persist_effects: toMutationPersistEffects(input.signedPackets),
      result: {
        security_mode: securityMode,
      },
    };
  }

  private async finalizeAssemblyElementCreate(input: {
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
  }) {
    await this.signedPacketFinalizer.persistSignedPacketsForActor({
      actorPacket: input.actorContext.actorPacket,
      signedPackets: input.signedPackets,
    });
    await this.discussionService.syncDerivedState();
    await this.attestationService.syncDerivedState();
    const assemblyPacket = input.signedPackets.find(
      (packet): packet is PacketEnvelopeByType['Element'] =>
        packet.header.family === 'Element'
    );

    return {
      persist_effects: toMutationPersistEffects(input.signedPackets),
      result: {
        assembly_packet: assemblyPacket ?? null,
        claims: await this.attestationService.listAssemblyAssociationClaimsForActor(
          input.actorContext.actorPacket.header.packet_id
        ),
      },
    };
  }

  private async finalizeAssociationRelationUpdate(input: {
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
    storedTicket: StoredMutationTicket;
  }) {
    await this.signedPacketFinalizer.persistSignedPacketsForActor({
      actorPacket: input.actorContext.actorPacket,
      signedPackets: input.signedPackets,
    });
    await this.attestationService.syncDerivedState();
    const activeRelationPacket = [...input.signedPackets].reverse().find(
      (packet): packet is PacketEnvelopeByType['Relation'] =>
        packet.header.family === 'Relation' &&
        (packet as PacketEnvelopeByType['Relation']).body.status === 'active'
    );
    const activeClaimPacket = [...input.signedPackets].reverse().find(
      (packet): packet is PacketEnvelopeByType['Claim'] =>
        packet.header.family === 'Claim' &&
        (packet as PacketEnvelopeByType['Claim']).body.status === 'active'
    );
    const wasClearIntent =
      input.storedTicket.intent.kind === 'assembly_association.relation.clear' ||
      (input.storedTicket.intent.kind === 'assembly_association.claim.set' &&
        input.storedTicket.intent.value !== 1);

    return {
      persist_effects: toMutationPersistEffects(input.signedPackets),
      result: {
        relation_packet_id: activeRelationPacket?.header.packet_id ?? null,
        relation_status:
          activeRelationPacket?.body.status ?? (wasClearIntent ? 'withdrawn' : null),
        claim_packet_id: activeClaimPacket?.header.packet_id ?? null,
        claim_status:
          activeClaimPacket?.body.status ?? (wasClearIntent ? 'withdrawn' : null),
        assembly_packet_id:
          input.storedTicket.intent.kind === 'assembly_association.relation.set' ||
          input.storedTicket.intent.kind === 'assembly_association.relation.clear' ||
          input.storedTicket.intent.kind === 'assembly_association.claim.set'
            ? input.storedTicket.intent.assembly_packet_id
            : null,
      },
    };
  }

  private async finalizeFollowRelationUpdate(input: {
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
    storedTicket: StoredMutationTicket;
  }) {
    await this.signedPacketFinalizer.persistSignedPacketsForActor({
      actorPacket: input.actorContext.actorPacket,
      signedPackets: input.signedPackets,
    });
    const activeRelationPacket = [...input.signedPackets].reverse().find(
      (packet): packet is PacketEnvelopeByType['Relation'] =>
        packet.header.family === 'Relation' &&
        (packet as PacketEnvelopeByType['Relation']).body.status === 'active'
    );

    return {
      persist_effects: toMutationPersistEffects(input.signedPackets),
      result: {
        relation_packet_id: activeRelationPacket?.header.packet_id ?? null,
        relation_status:
          activeRelationPacket?.body.status ??
          (input.storedTicket.intent.kind === 'follows.relation.clear'
            ? 'withdrawn'
            : null),
        target_scope_packet_id:
          activeRelationPacket?.body.target_ref.packet_id ??
          (input.storedTicket.intent.kind === 'follows.relation.set' ||
          input.storedTicket.intent.kind === 'follows.relation.clear'
            ? input.storedTicket.intent.target_scope_packet_id
            : null),
      },
    };
  }

  private async finalizeClaimUpdate(input: {
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
    storedTicket: StoredMutationTicket;
  }) {
    await this.signedPacketFinalizer.persistSignedPacketsForActor({
      actorPacket: input.actorContext.actorPacket,
      signedPackets: input.signedPackets,
    });
    await this.attestationService.syncDerivedState();
    const claimPacket = [...input.signedPackets].reverse().find(
      (packet): packet is PacketEnvelopeByType['Claim'] =>
        packet.header.family === 'Claim'
    );

    return {
      persist_effects: toMutationPersistEffects(input.signedPackets),
      result: {
        claim_packet_id: claimPacket?.header.packet_id ?? null,
        claim_status:
          claimPacket?.body.status ??
          (input.storedTicket.intent.kind === 'role_association.claim.set' &&
          !input.storedTicket.intent.claimed
            ? 'withdrawn'
            : null),
      },
    };
  }

  private async finalizeHomeLocalityRelation(input: {
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
    storedTicket: StoredMutationTicket;
  }) {
    await this.signedPacketFinalizer.persistSignedPacketsForActor({
      actorPacket: input.actorContext.actorPacket,
      signedPackets: input.signedPackets,
    });
    const activeRelationPacket = [...input.signedPackets].reverse().find(
      (packet): packet is PacketEnvelopeByType['Relation'] =>
        packet.header.family === 'Relation' &&
        (packet as PacketEnvelopeByType['Relation']).body.status === 'active'
    );
    const activeClaimPacket = [...input.signedPackets].reverse().find(
      (packet): packet is PacketEnvelopeByType['Claim'] =>
        packet.header.family === 'Claim' &&
        (packet as PacketEnvelopeByType['Claim']).body.status === 'active'
    );
    const clearedHomeScopePacketId = isHomeLocalityMutationKind(input.storedTicket.intent.kind)
      ? input.storedTicket.intent.home_scope_packet_id
      : null;

    return {
      persist_effects: toMutationPersistEffects(input.signedPackets),
      result: {
        relation_packet_id: activeRelationPacket?.header.packet_id ?? null,
        claim_packet_id: activeClaimPacket?.header.packet_id ?? null,
        claim_status:
          activeClaimPacket?.body.status ??
          (isHomeLocalityMutationKind(input.storedTicket.intent.kind) &&
          clearedHomeScopePacketId === null
            ? 'withdrawn'
            : null),
        home_scope_packet_id:
          activeRelationPacket?.body.target_ref.packet_id ??
          activeClaimPacket?.body.relation_assertion?.target_ref.packet_id ??
          activeClaimPacket?.body.target_ref.packet_id ??
          (isHomeLocalityMutationKind(input.storedTicket.intent.kind)
            ? clearedHomeScopePacketId
            : null),
      },
    };
  }

  private async finalizeRoleAssociationAttestation(input: {
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
    storedTicket: StoredMutationTicket;
  }) {
    await this.signedPacketFinalizer.persistSignedPacketsForActor({
      actorPacket: input.actorContext.actorPacket,
      signedPackets: input.signedPackets,
    });
    await this.attestationService.syncDerivedState();

    if (input.storedTicket.intent.kind !== 'role_association.attestation.set') {
      throw new Error('Unexpected role attestation mutation ticket.');
    }
    const roleAttestationIntent = input.storedTicket.intent;

    const supportCount = (
      await this.attestationService.listTargetAttestations({
        target_packet_id: roleAttestationIntent.claim_packet_id,
        attestation_kind: 'claim_support',
        active_only: true,
      })
    ).length;
    const disputeCount = (
      await this.attestationService.listTargetAttestations({
        target_packet_id: roleAttestationIntent.claim_packet_id,
        attestation_kind: 'claim_dispute',
        active_only: true,
      })
    ).length;
    const actorKey = input.actorContext.actorKey;
    const viewerSupport = (
      await this.attestationService.listActorAttestations({
        actor_key: actorKey,
        attestation_kind: 'claim_support',
        active_only: true,
      })
    ).some((edge) => edge.target_ref.packet_id === roleAttestationIntent.claim_packet_id);
    const viewerDispute = (
      await this.attestationService.listActorAttestations({
        actor_key: actorKey,
        attestation_kind: 'claim_dispute',
        active_only: true,
      })
    ).some((edge) => edge.target_ref.packet_id === roleAttestationIntent.claim_packet_id);

    return {
      persist_effects: toMutationPersistEffects(input.signedPackets),
      result: {
        claim_packet_id: roleAttestationIntent.claim_packet_id,
        mode: roleAttestationIntent.mode,
        support_count: supportCount,
        dispute_count: disputeCount,
        viewer_attestation: viewerSupport
          ? 'support'
          : viewerDispute
            ? 'dispute'
            : 'none',
      },
    };
  }

  private async finalizeLocalityPathCreate(input: {
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
    storedTicket: StoredMutationTicket;
  }) {
    await this.signedPacketFinalizer.persistSignedPacketsForActor({
      actorPacket: input.actorContext.actorPacket,
      signedPackets: input.signedPackets,
    });

    const preparedResult = input.storedTicket.prepared_result as
      | {
          created_packets: PacketEnvelope[];
          created_relation_packet_ids: string[];
          created_location_packet_ids: string[];
          final_result: unknown;
          duplicate_warnings: unknown[];
        }
      | undefined;

    return {
      persist_effects: toMutationPersistEffects(input.signedPackets),
      result: {
        created_packets: input.signedPackets,
        created_relation_packet_ids:
          preparedResult?.created_relation_packet_ids ?? [],
        created_location_packet_ids:
          preparedResult?.created_location_packet_ids ?? [],
        final_result: preparedResult?.final_result ?? null,
        duplicate_warnings: preparedResult?.duplicate_warnings ?? [],
      },
    };
  }

  private async finalizeLocalityGraphApply(input: {
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
    storedTicket: StoredMutationTicket;
  }) {
    await this.signedPacketFinalizer.persistSignedPacketsForActor({
      actorPacket: input.actorContext.actorPacket,
      signedPackets: input.signedPackets,
    });

    if (input.storedTicket.intent.kind !== 'locality.graph.apply') {
      throw new Error('Unexpected locality graph mutation ticket.');
    }

    const preparedResult = input.storedTicket.prepared_result as
      | LocalityGraphApplyPreparedResult
      | undefined;
    let preferencesPhase: {
      status: 'success' | 'partial' | 'failed' | 'skipped';
      message: string | null;
      error_messages: string[];
    } = {
      status: 'success',
      message: 'Temporary main and section display preferences were updated.',
      error_messages: [],
    };
    const eligibleMainScopePacketIds = collectEligibleMainScopePacketIds({
      intent: input.storedTicket.intent,
      preparedResult,
    });
    let preferences = reconcileScopeDisplayPreferences({
      preferences: {
        main_visible_scope_packet_ids:
          input.storedTicket.intent.main_visible_scope_packet_ids ?? [],
        show_associated_parent_chains:
          input.storedTicket.intent.show_associated_parent_chains ?? true,
        show_followed_parent_chains:
          input.storedTicket.intent.show_followed_parent_chains ?? true,
      },
      eligibleMainScopePacketIds,
    });

    try {
      preferences = await writeClaimedScopeDisplayPreferences({
        packetStore: this.packetStore,
        actorPacketId: input.actorContext.actorPacket.header.packet_id,
        preferences,
        eligibleMainScopePacketIds,
      });
    } catch (error) {
      preferencesPhase = {
        status: 'failed',
        message: 'Packet writes succeeded, but temporary scope display preferences were not saved.',
        error_messages: [
          error instanceof Error ? error.message : 'Unable to save scope display preferences.',
        ],
      };
    }

    let shellPayload: unknown = null;

    try {
      const { getNexusShellPayload } = await import('@runtime/nexus/server/nexus-query-data');
      shellPayload = await getNexusShellPayload(
        input.actorContext.actorPacket.header.packet_id
      );
    } catch {
      shellPayload = null;
    }

    const relationPacketCount = input.signedPackets.filter(
      (packet) => packet.header.family === 'Relation' || packet.header.family === 'Claim'
    ).length;

    return {
      persist_effects: toMutationPersistEffects(input.signedPackets),
      result: {
        structural_phase: {
          status: 'success',
          message: 'Locality graph packet phase completed successfully.',
          error_messages: [],
        },
        relations_phase: {
          status: relationPacketCount > 0 ? 'success' : 'skipped',
          message:
            relationPacketCount > 0
              ? 'Selected home, association, and follow relation packets were included in the signed packet write.'
              : 'No additional scope relations were selected.',
          error_messages: [],
        },
        preferences_phase: preferencesPhase,
        path_results:
          preparedResult?.path_results?.map((pathResult) => ({
            ...pathResult,
            created_packets: input.signedPackets.filter((packet) =>
              pathResult.created_packets.some(
                (createdPacket) => createdPacket.header.packet_id === packet.header.packet_id
              )
            ),
          })) ?? [],
        final_result: preparedResult?.final_result ?? null,
        home_scope_packet_id: input.storedTicket.intent.home_scope_packet_id ?? null,
        associated_scope_packet_ids:
          input.storedTicket.intent.associated_scope_packet_ids ?? [],
        followed_scope_packet_ids:
          input.storedTicket.intent.followed_scope_packet_ids ?? [],
        preferences,
        shell_payload: shellPayload,
      },
    };
  }

  private async finalizeDiscussionSurfacesEnsure(input: {
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
    storedTicket: StoredMutationTicket;
  }) {
    await this.signedPacketFinalizer.persistSignedPacketsForActor({
      actorPacket: input.actorContext.actorPacket,
      signedPackets: input.signedPackets,
    });
    await this.discussionService.syncDerivedState();

    if (input.storedTicket.intent.kind !== 'discussion.surfaces.ensure') {
      throw new Error('Unexpected discussion-surface mutation ticket.');
    }

    const discussions = await this.discussionService.getForumFeed({
      scope_id: input.storedTicket.intent.scope_id,
      forum_id: null,
      sort: null,
      show_hidden: false,
      viewer_actor_key: input.actorContext.actorKey,
    });

    return {
      persist_effects: toMutationPersistEffects(input.signedPackets),
      result: {
        created_packet_refs: input.signedPackets.map((packet) => ({
          packet_id: packet.header.packet_id,
          revision_id: packet.header.revision_id,
        })),
        discussions,
      },
    };
  }

  async finalizeMutation(input: {
    request: MutationFinalizeRequest;
    actorContext: ActorContext;
  }): Promise<FinalizedMutationResult> {
    const storedTicket = this.ticketService.consumeForActor({
      ticketId: input.request.ticket_id,
      actorPacketId: input.actorContext.actorPacket.header.packet_id,
    });

    await this.signedPacketFinalizer.validateSignedMutationBundle({
      storedTicket,
      signedPackets: input.request.signed_packets,
      proofBundle: input.actorContext.proofBundle,
    });

    const kind = storedTicket.intent.kind;
    let finalized:
      | Awaited<ReturnType<typeof this.finalizeDiscussionThreadPost>>
      | Awaited<ReturnType<typeof this.finalizeDiscussionReply>>
      | Awaited<ReturnType<typeof this.finalizePacketSignal>>
      | Awaited<ReturnType<typeof this.finalizeAssemblyElementCreate>>
      | Awaited<ReturnType<typeof this.finalizeAssociationRelationUpdate>>
      | Awaited<ReturnType<typeof this.finalizeFollowRelationUpdate>>
      | Awaited<ReturnType<typeof this.finalizeClaimUpdate>>
      | Awaited<ReturnType<typeof this.finalizeHomeLocalityRelation>>
      | Awaited<ReturnType<typeof this.finalizeRoleAssociationAttestation>>
      | Awaited<ReturnType<typeof this.finalizeLocalityPathCreate>>
      | Awaited<ReturnType<typeof this.finalizeLocalityGraphApply>>
      | Awaited<ReturnType<typeof this.finalizeDiscussionSurfacesEnsure>>
      | Awaited<ReturnType<typeof this.finalizeActorWritePolicyUpdate>>;

    switch (kind) {
      case 'discussion.thread_post.create':
        finalized = await this.finalizeDiscussionThreadPost({
          storedTicket,
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets,
        });
        break;
      case 'discussion.reply.create':
        finalized = await this.finalizeDiscussionReply({
          storedTicket,
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets,
        });
        break;
      case 'attestation.packet_signal.set':
        finalized = await this.finalizePacketSignal({
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets as [
            PacketEnvelopeByType['Attestation'],
          ],
        });
        break;
      case 'assembly.element.create':
        finalized = await this.finalizeAssemblyElementCreate({
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets,
        });
        break;
      case 'assembly_association.relation.set':
      case 'assembly_association.relation.clear':
      case 'assembly_association.claim.set':
        finalized = await this.finalizeAssociationRelationUpdate({
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets,
          storedTicket,
        });
        break;
      case 'follows.relation.set':
      case 'follows.relation.clear':
        finalized = await this.finalizeFollowRelationUpdate({
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets,
          storedTicket,
        });
        break;
      case 'role_association.claim.set':
        finalized = await this.finalizeClaimUpdate({
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets,
          storedTicket,
        });
        break;
      case 'home_locality.relation.set':
      case 'home_locality.claim.set':
        finalized = await this.finalizeHomeLocalityRelation({
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets,
          storedTicket,
        });
        break;
      case 'role_association.attestation.set':
        finalized = await this.finalizeRoleAssociationAttestation({
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets,
          storedTicket,
        });
        break;
      case 'locality.path.create':
        finalized = await this.finalizeLocalityPathCreate({
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets,
          storedTicket,
        });
        break;
      case 'locality.graph.apply':
        finalized = await this.finalizeLocalityGraphApply({
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets,
          storedTicket,
        });
        break;
      case 'discussion.surfaces.ensure':
        finalized = await this.finalizeDiscussionSurfacesEnsure({
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets,
          storedTicket,
        });
        break;
      case 'actor.write_policy.update':
        finalized = await this.finalizeActorWritePolicyUpdate({
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets,
        });
        break;
      default:
        assertNeverMutationKind(kind);
    }

    return {
      kind,
      persist_effects: finalized.persist_effects,
      result: finalized.result,
    };
  }
}
