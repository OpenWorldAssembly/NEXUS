/**
 * File: mutation-service.ts
 * Description: Hosts the shared fortress prepare/finalize mutation corridor over adapted packet state and runtime proofs.
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
import { createAssociationClaimPacket, createClaimPacketId } from '@core/packets/claims';
import { createElementPolicyRefsRevision } from '@core/packets/identity';
import {
  createAssemblyPacket,
  createAttestationPacket,
  createPacketEdge,
  createPacketRef,
  createPolicyPacket,
} from '@core/packets/builders';
import { buildPacketSignalAttestationPacket } from '@core/packets/discussion';
import {
  describeWriteProofLevel,
  doesProofBundleSatisfyRequirement,
} from '@core/auth/proof-types';
import type {
  MutationProofBundle,
} from '@core/auth/proof-types';
import {
  resolveWritePolicyForActions,
  mergeWritePolicyDecisions,
  type MutationActionId,
} from '@core/auth/write-policy';
import type {
  AttestationKind,
  AttestationValue,
  DiscussionActorClass,
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import { verifyPacketSignature } from '@runtime/nexus/identity-crypto';
import {
  filterClaimPackets,
  listClaimPackets,
} from '@runtime/nexus/server/claim-utils';
import {
  planDefaultDiscussionSurfaces,
} from '@runtime/nexus/server/default-discussion-surfaces';
import { toRouteScopeId } from '@runtime/nexus/server/discussion-service.scope';
import {
  planCanonicalLocalityPath,
  type LocalityCreatePathEntry,
} from '@runtime/nexus/server/locality-directory-service';
import type { NexusAuthService } from '@runtime/nexus/server/auth-service';
import { SQLiteAttestationService } from '@runtime/nexus/server/attestation-service';
import { SQLiteDiscussionService } from '@runtime/nexus/server/discussion-service';
import { MutationTicketStore } from '@runtime/nexus/server/mutation-ticket-store';
import {
  buildWritePolicyBodyMarkdown,
  createActorWritePolicyPacketId,
  createWritePolicyForSecurityMode,
  resolveSecurityModePolicyDecision,
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

function toPersistEffects(packets: PacketEnvelope[]): MutationPersistEffect[] {
  return packets.map((packet) => ({
    packet: {
      packet_id: packet.header.packet_id,
      revision_id: packet.header.revision_id,
    },
  }));
}

async function assertSignedPacketsMatchPreparedDigests(input: {
  preparedMutation: PreparedMutation;
  signedPackets: PacketEnvelope[];
}): Promise<void> {
  if (input.preparedMutation.prepared_packets.length !== input.signedPackets.length) {
    throw new Error('Signed mutation packet bundle does not match the prepared candidate size.');
  }

  for (let index = 0; index < input.preparedMutation.prepared_packets.length; index += 1) {
    const preparedPacket = input.preparedMutation.prepared_packets[index];
    const signedPacket = input.signedPackets[index];

    if (!signedPacket || signedPacket.header.family !== preparedPacket.packet.header.family) {
      throw new Error('Signed mutation packet bundle does not match the prepared packet families.');
    }

    const digestCandidates = await getPacketUnsignedDigestCandidates(signedPacket);
    const matchesPreparedDigest = digestCandidates.some(
      (candidate) => candidate.digest === preparedPacket.unsigned_digest
    );

    if (!matchesPreparedDigest) {
      throw new Error('Signed mutation packet bundle does not match the prepared packet digest.');
    }
  }
}

async function getPolicyPacketsByRefs(
  packetStore: NodeSQLitePacketStore,
  policyRefs: PacketEnvelopeByType['Element']['header']['moderation']['policy_refs']
): Promise<PacketEnvelopeByType['Policy'][]> {
  const packets = await Promise.all(
    policyRefs.map((policyRef) =>
      packetStore.fetchByPacket({ packet_id: policyRef.packet_id })
    )
  );

  return packets.filter(
    (packet): packet is PacketEnvelopeByType['Policy'] =>
      packet?.header.family === 'Policy'
  );
}

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

function buildBootstrapWritePolicyDecision(input: {
  actionIds: MutationActionId[];
}): ReturnType<typeof resolveSecurityModePolicyDecision> {
  return resolveSecurityModePolicyDecision({
    securityMode: 'standard',
    actionIds: input.actionIds,
    sourcePolicyPacketIds: [],
  });
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

export class NexusMutationService {
  constructor(
    private readonly packetStore: NodeSQLitePacketStore,
    private readonly authService: NexusAuthService,
    private readonly discussionService: SQLiteDiscussionService,
    private readonly attestationService: SQLiteAttestationService,
    private readonly ticketStore: MutationTicketStore
  ) {}

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
    const elementPackets =
      (await this.packetStore.listPreferredPacketsByFamily(
        'Element'
      )) as PacketEnvelopeByType['Element'][];

    return elementPackets
      .filter((packet) => packet.body.kind === 'assembly')
      .map((packet) => ({
        packet,
        packetId: packet.header.packet_id,
        routeId: toRouteScopeId(packet.header.packet_id),
        name: packet.body.name,
        parentPacketId: getParentPacketId(packet),
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

  private async resolveScopePolicyDecision(input: {
    governingScopePacket: PacketEnvelopeByType['Element'] | null;
    actorPacket: PacketEnvelopeByType['Element'];
    actionIds: MutationActionId[];
  }) {
    const policyPackets = input.governingScopePacket
      ? await getPolicyPacketsByRefs(
          this.packetStore,
          input.governingScopePacket.header.moderation.policy_refs
        )
      : [];
    const currentSecurityMode = await this.authService.resolveEffectiveSecurityMode(
      input.actorPacket.header.packet_id
    );
    const scopePolicyDecision = resolveWritePolicyForActions({
      governingScopePacket: input.governingScopePacket,
      policyPackets,
      actionIds: input.actionIds,
    });
    const actorPolicyDecision = resolveSecurityModePolicyDecision({
      securityMode: currentSecurityMode,
      actionIds: input.actionIds,
    });

    return mergeWritePolicyDecisions({
      actionIds: input.actionIds,
      decisions: [scopePolicyDecision, actorPolicyDecision],
    });
  }

  private async persistSignedPacketsForActor(input: {
    actorPacket: PacketEnvelopeByType['Element'];
    signedPackets: PacketEnvelope[];
  }) {
    for (const signedPacket of input.signedPackets) {
      const signatureIsValid = await verifyPacketSignature({
        packet: signedPacket,
        signerPacket: input.actorPacket,
      });

      if (!signatureIsValid) {
        throw new Error(`Signed ${signedPacket.header.family} packet verification failed.`);
      }

      await this.packetStore.writeRevision(signedPacket);
      await this.packetStore.publishRevision({
        packet_id: signedPacket.header.packet_id,
        revision_id: signedPacket.header.revision_id,
      });
    }
  }

  private async prepareDiscussionThreadPost(input: {
    intent: Extract<MutationIntent, { kind: 'discussion.thread_post.create' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    const forumPacket = await this.requirePacket({
      packetId: input.intent.forum_packet_id,
      family: 'DiscussionForum',
    });
    const governingScopePacket = forumPacket.header.authority_scope_ref
      ? await this.requirePacket({
          packetId: forumPacket.header.authority_scope_ref.packet_id,
          family: 'Element',
        })
      : null;
    const policyPackets = governingScopePacket
      ? await getPolicyPacketsByRefs(
          this.packetStore,
          governingScopePacket.header.moderation.policy_refs
        )
      : [];
    const currentSecurityMode = await this.authService.resolveEffectiveSecurityMode(
      input.actorPacket.header.packet_id
    );
    const scopePolicyDecision = resolveWritePolicyForActions({
      governingScopePacket,
      policyPackets,
      actionIds: ['discussion.thread.create', 'discussion.post.create'],
    });
    const actorPolicyDecision = resolveSecurityModePolicyDecision({
      securityMode: currentSecurityMode,
      actionIds: ['discussion.thread.create', 'discussion.post.create'],
    });
    const mergedPolicyDecision = mergeWritePolicyDecisions({
      actionIds: ['discussion.thread.create', 'discussion.post.create'],
      decisions: [scopePolicyDecision, actorPolicyDecision],
    });
    const decision = {
      ...createDiscussionThreadPostCandidate({
        intent: {
          kind: 'discussion.thread_post.create',
          scope_id: input.intent.scope_id,
          mutation_nonce:
            input.intent.mutation_nonce?.trim() || randomUUID().slice(0, 8),
          created_at: input.intent.created_at ?? new Date().toISOString(),
          forum_packet_id: forumPacket.header.packet_id,
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
        },
        actorPacket: input.actorPacket,
      }),
      ...mergedPolicyDecision,
    } satisfies MutationDecision;
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

    if (
      !parentPacket ||
      (parentPacket.header.family !== 'DiscussionPost' &&
        parentPacket.header.family !== 'DiscussionReply')
    ) {
      throw new Error(`Unknown discussion post: ${input.intent.parent_post_packet_id}`);
    }
    const discussionParentPacket = parentPacket as
      | PacketEnvelopeByType['DiscussionPost']
      | PacketEnvelopeByType['DiscussionReply'];

    const threadPacket = (await this.requirePacket({
      packetId: discussionParentPacket.body.thread_ref.packet_id,
      family: 'DiscussionThread',
    })) as PacketEnvelopeByType['DiscussionThread'];
    const forumPacket = await this.requirePacket({
      packetId: threadPacket.body.forum_ref.packet_id,
      family: 'DiscussionForum',
    });
    const governingScopePacket = forumPacket.header.authority_scope_ref
      ? await this.requirePacket({
          packetId: forumPacket.header.authority_scope_ref.packet_id,
          family: 'Element',
        })
      : null;
    const policyPackets = governingScopePacket
      ? await getPolicyPacketsByRefs(
          this.packetStore,
          governingScopePacket.header.moderation.policy_refs
        )
      : [];
    const currentSecurityMode = await this.authService.resolveEffectiveSecurityMode(
      input.actorPacket.header.packet_id
    );
    const scopePolicyDecision = resolveWritePolicyForActions({
      governingScopePacket,
      policyPackets,
      actionIds: ['discussion.reply.create'],
    });
    const actorPolicyDecision = resolveSecurityModePolicyDecision({
      securityMode: currentSecurityMode,
      actionIds: ['discussion.reply.create'],
    });
    const mergedPolicyDecision = mergeWritePolicyDecisions({
      actionIds: ['discussion.reply.create'],
      decisions: [scopePolicyDecision, actorPolicyDecision],
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
          thread_packet_id: threadPacket.header.packet_id,
          root_post_packet_id:
            discussionParentPacket.header.family === 'DiscussionPost'
              ? discussionParentPacket.header.packet_id
              : (
                  discussionParentPacket as PacketEnvelopeByType['DiscussionReply']
                ).body.root_post_ref.packet_id,
          parent_post_packet_id: discussionParentPacket.header.packet_id,
          reply_markdown: input.intent.reply_markdown,
        },
        actorPacket: input.actorPacket,
      }),
      ...mergedPolicyDecision,
    } satisfies MutationDecision;
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
        targetPacket.header.family !== 'DiscussionReply')
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
    const policyPackets = governingScopePacket
      ? await getPolicyPacketsByRefs(
          this.packetStore,
          governingScopePacket.header.moderation.policy_refs
        )
      : [];
    const actionId: MutationActionId =
      input.intent.value === 0
        ? 'attestation.packet_signal.clear'
        : 'attestation.packet_signal.set';
    const currentSecurityMode = await this.authService.resolveEffectiveSecurityMode(
      input.actorPacket.header.packet_id
    );
    const scopePolicyDecision = resolveWritePolicyForActions({
      governingScopePacket,
      policyPackets,
      actionIds: [actionId],
    });
    const actorPolicyDecision = resolveSecurityModePolicyDecision({
      securityMode: currentSecurityMode,
      actionIds: [actionId],
    });
    const mergedPolicyDecision = mergeWritePolicyDecisions({
      actionIds: [actionId],
      decisions: [scopePolicyDecision, actorPolicyDecision],
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
    const currentSecurityMode = await this.authService.resolveEffectiveSecurityMode(
      input.actorPacket.header.packet_id
    );
    const existingPolicyPackets = await getPolicyPacketsByRefs(
      this.packetStore,
      input.actorPacket.header.moderation.policy_refs
    );
    const existingWritePolicyPacket =
      existingPolicyPackets.find(
        (policyPacket) => policyPacket.body.policy_kind === 'write_lock'
      ) ?? null;
    const currentPolicyDecision = existingWritePolicyPacket
      ? resolveSecurityModePolicyDecision({
          securityMode: currentSecurityMode,
          actionIds: ['actor.write_policy.update'],
          sourcePolicyPacketIds: [existingWritePolicyPacket.header.packet_id],
        })
      : buildBootstrapWritePolicyDecision({
          actionIds: ['actor.write_policy.update'],
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
      const claimPacket = createAssociationClaimPacket({
        claimKind: 'assembly_association',
        subjectPacketId: input.actorPacket.header.packet_id,
        targetPacketId: assemblyPacket.header.packet_id,
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
      packets.push(claimPacket);
      actionIds.push('assembly_association.claim.set');
    }

    const mergedPolicyDecision = await this.resolveScopePolicyDecision({
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

  private async prepareAssemblyAssociationClaim(input: {
    intent: Extract<MutationIntent, { kind: 'assembly_association.claim.set' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    const assemblyPacket = await this.requirePacket({
      packetId: input.intent.assembly_packet_id,
      family: 'Element',
    });
    const claimPacketId = createClaimPacketId({
      claimKind: 'assembly_association',
      subjectPacketId: input.actorPacket.header.packet_id,
      targetPacketId: assemblyPacket.header.packet_id,
      scopePacketId: assemblyPacket.header.packet_id,
    });
    const existingPreferredRevision = await this.packetStore.fetchPreferredRevision({
      packet_id: claimPacketId,
    });
    const claimPacket = createAssociationClaimPacket({
      claimKind: 'assembly_association',
      subjectPacketId: input.actorPacket.header.packet_id,
      targetPacketId: assemblyPacket.header.packet_id,
      scopePacketId: assemblyPacket.header.packet_id,
      applicableScopeRefs:
        assemblyPacket.header.applicable_scope_refs.length > 0
          ? assemblyPacket.header.applicable_scope_refs
          : [{ packet_id: assemblyPacket.header.packet_id }],
      createdByPacketId: input.actorPacket.header.packet_id,
      note: input.intent.value === 1 ? input.intent.note ?? null : null,
      status: input.intent.value === 1 ? 'active' : 'withdrawn',
      packetId: claimPacketId,
      parentRevisionRefs: existingPreferredRevision ? [existingPreferredRevision] : [],
    });
    const mergedPolicyDecision = await this.resolveScopePolicyDecision({
      governingScopePacket: assemblyPacket,
      actorPacket: input.actorPacket,
      actionIds: [
        input.intent.value === 1
          ? 'assembly_association.claim.set'
          : 'assembly_association.claim.withdraw',
      ],
    });
    const digests = await getPacketUnsignedDigestCandidates(claimPacket);

    return {
      kind: input.intent.kind,
      ...mergedPolicyDecision,
      governing_scope_packet_id: assemblyPacket.header.packet_id,
      prepared_packets: [
        {
          packet: claimPacket,
          unsigned_digest: digests[0]?.digest ?? '',
        },
      ],
    };
  }

  private async prepareHomeLocalityClaim(input: {
    intent: Extract<MutationIntent, { kind: 'home_locality.claim.set' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    const claimPackets = await listClaimPackets(this.packetStore);
    const activeHomeClaims = filterClaimPackets({
      claims: claimPackets,
      claimKind: 'home_locality',
      subjectPacketId: input.actorPacket.header.packet_id,
      activeOnly: true,
    });
    const packets: PacketEnvelope[] = [];

    for (const activeHomeClaim of activeHomeClaims) {
      if (
        input.intent.home_scope_packet_id &&
        activeHomeClaim.body.target_ref.packet_id === input.intent.home_scope_packet_id
      ) {
        continue;
      }

      packets.push(
        createAssociationClaimPacket({
          claimKind: 'home_locality',
          subjectPacketId: input.actorPacket.header.packet_id,
          targetPacketId: activeHomeClaim.body.target_ref.packet_id,
          scopePacketId: activeHomeClaim.body.scope_ref.packet_id,
          applicableScopeRefs: activeHomeClaim.header.applicable_scope_refs,
          createdByPacketId: input.actorPacket.header.packet_id,
          status: 'withdrawn',
          packetId: activeHomeClaim.header.packet_id,
          parentRevisionRefs: [
            {
              packet_id: activeHomeClaim.header.packet_id,
              revision_id: activeHomeClaim.header.revision_id,
            },
          ],
        })
      );
    }

    let governingScopePacket: PacketEnvelopeByType['Element'] | null = null;

    if (input.intent.home_scope_packet_id) {
      governingScopePacket = await this.requirePacket({
        packetId: input.intent.home_scope_packet_id,
        family: 'Element',
      });
      const homeClaimPacketId = createClaimPacketId({
        claimKind: 'home_locality',
        subjectPacketId: input.actorPacket.header.packet_id,
        targetPacketId: governingScopePacket.header.packet_id,
        scopePacketId: governingScopePacket.header.packet_id,
      });
      const existingPreferredRevision = await this.packetStore.fetchPreferredRevision({
        packet_id: homeClaimPacketId,
      });
      packets.push(
        createAssociationClaimPacket({
          claimKind: 'home_locality',
          subjectPacketId: input.actorPacket.header.packet_id,
          targetPacketId: governingScopePacket.header.packet_id,
          scopePacketId: governingScopePacket.header.packet_id,
          applicableScopeRefs:
            governingScopePacket.header.applicable_scope_refs.length > 0
              ? governingScopePacket.header.applicable_scope_refs
              : [{ packet_id: governingScopePacket.header.packet_id }],
          createdByPacketId: input.actorPacket.header.packet_id,
          status: 'active',
          packetId: homeClaimPacketId,
          parentRevisionRefs: existingPreferredRevision ? [existingPreferredRevision] : [],
        })
      );
    } else if (activeHomeClaims[0]) {
      const targetScopePacketId = activeHomeClaims[0].body.target_ref.packet_id;
      const packet = await this.packetStore.fetchByPacket({ packet_id: targetScopePacketId });
      governingScopePacket =
        packet?.header.family === 'Element' ? (packet as PacketEnvelopeByType['Element']) : null;
    }

    const actionIds: MutationActionId[] = [
      input.intent.home_scope_packet_id ? 'home_locality.claim.set' : 'home_locality.claim.clear',
    ];
    const mergedPolicyDecision = await this.resolveScopePolicyDecision({
      governingScopePacket,
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
      governing_scope_packet_id:
        governingScopePacket?.header.packet_id ?? input.actorPacket.header.packet_id,
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
    const mergedPolicyDecision = await this.resolveScopePolicyDecision({
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

    if (claimPacket.body.subject_ref.packet_id === input.actorPacket.header.packet_id) {
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
    const mergedPolicyDecision = await this.resolveScopePolicyDecision({
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
    const governingScopePacket =
      createdPackets.length > 0
        ? await this.requirePacket({
            packetId: getParentPacketId(createdPackets[0]) ?? createdPackets[0].header.packet_id,
            family: 'Element',
          })
        : null;
    const mergedPolicyDecision = await this.resolveScopePolicyDecision({
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
    const storedTicket = this.ticketStore.create({
      actor_packet_id: input.actorPacket.header.packet_id,
      prepared_mutation: preparedMutation,
      intent: input.intent,
      prepared_result: plannedResult,
    });

    return {
      ticket: {
        ticket_id: storedTicket.ticket_id,
        actor_packet_id: storedTicket.actor_packet_id,
        kind: storedTicket.intent.kind,
        expires_at: storedTicket.expires_at,
      },
      prepared_mutation: preparedMutation,
      prepared_result: plannedResult,
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
    const mergedPolicyDecision = await this.resolveScopePolicyDecision({
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
    return this.ticketStore.read(ticketId);
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
                ? await this.prepareAssemblyAssociationClaim({
                    intent: input.intent,
                    actorPacket: input.actorPacket,
                  })
                : input.intent.kind === 'home_locality.claim.set'
                  ? await this.prepareHomeLocalityClaim({
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

    const storedTicket = this.ticketStore.create({
      actor_packet_id: input.actorPacket.header.packet_id,
      prepared_mutation: preparedMutation,
      intent: input.intent,
    });

    return {
      ticket: {
        ticket_id: storedTicket.ticket_id,
        actor_packet_id: storedTicket.actor_packet_id,
        kind: storedTicket.intent.kind,
        expires_at: storedTicket.expires_at,
      },
      prepared_mutation: preparedMutation,
    };
  }

  private async finalizeDiscussionThreadPost(input: {
    storedTicket: ReturnType<MutationTicketStore['consume']>;
    actorContext: ActorContext;
    signedPackets: [PacketEnvelopeByType['DiscussionThread'], PacketEnvelopeByType['DiscussionPost']];
  }) {
    const [threadPacket, postPacket] = input.signedPackets;
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
        created_at: threadPacket.header.created_at,
        forum_packet_id: threadPacket.body.forum_ref.packet_id,
        forum_kind:
          typeof threadPacket.header.metadata.tags[1] === 'string'
            ? threadPacket.header.metadata.tags[1]
            : threadPacket.body.thread_kind,
        authority_scope_packet_id:
          threadPacket.header.authority_scope_ref?.packet_id ?? null,
        applicable_scope_packet_ids: threadPacket.header.applicable_scope_refs.map(
          (scopeRef) => scopeRef.packet_id
        ),
        default_sort: threadPacket.body.default_sort,
        thread_title: threadPacket.body.title,
        post_markdown: postPacket.body.content_markdown,
        thread_kind: threadPacket.body.thread_kind,
        related_packet_ids: threadPacket.body.related_refs.map(
          (relatedRef) => relatedRef.packet_id
        ),
      },
      signed_thread_packet: threadPacket,
      signed_post_packet: postPacket,
    });

    return {
      persist_effects: toPersistEffects([threadPacket, postPacket]),
      result,
    };
  }

  private async finalizeDiscussionReply(input: {
    storedTicket: ReturnType<MutationTicketStore['consume']>;
    actorContext: ActorContext;
    signedPackets: [PacketEnvelopeByType['DiscussionReply']];
  }) {
    const [replyPacket] = input.signedPackets;
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
        created_at: replyPacket.header.created_at,
        forum_kind:
          typeof replyPacket.header.metadata.tags[1] === 'string'
            ? replyPacket.header.metadata.tags[1]
            : 'general',
        authority_scope_packet_id:
          replyPacket.header.authority_scope_ref?.packet_id ?? null,
        applicable_scope_packet_ids: replyPacket.header.applicable_scope_refs.map(
          (scopeRef) => scopeRef.packet_id
        ),
        thread_packet_id: replyPacket.body.thread_ref.packet_id,
        root_post_packet_id: replyPacket.body.root_post_ref.packet_id,
        parent_post_packet_id: replyPacket.body.reply_to_ref.packet_id,
        reply_markdown: replyPacket.body.content_markdown,
      },
      signed_reply_packet: replyPacket,
    });

    return {
      persist_effects: toPersistEffects([replyPacket]),
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
      persist_effects: toPersistEffects([attestationPacket]),
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
    for (const signedPacket of input.signedPackets) {
      await verifyPacketSignature({
        packet: signedPacket,
        signerPacket: input.actorContext.actorPacket,
      }).then((signatureIsValid) => {
        if (!signatureIsValid) {
          throw new Error('Signed write-policy packet verification failed.');
        }
      });
      await this.packetStore.writeRevision(signedPacket);
      await this.packetStore.publishRevision({
        packet_id: signedPacket.header.packet_id,
        revision_id: signedPacket.header.revision_id,
      });
    }

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
      persist_effects: toPersistEffects(input.signedPackets),
      result: {
        security_mode: securityMode,
      },
    };
  }

  private async finalizeAssemblyElementCreate(input: {
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
  }) {
    await this.persistSignedPacketsForActor({
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
      persist_effects: toPersistEffects(input.signedPackets),
      result: {
        assembly_packet: assemblyPacket ?? null,
        claims: await this.attestationService.listAssemblyAssociationClaimsForActor(
          input.actorContext.actorPacket.header.packet_id
        ),
      },
    };
  }

  private async finalizeAssociationClaimUpdate(input: {
    actorContext: ActorContext;
    signedPackets: [PacketEnvelope];
  }) {
    await this.persistSignedPacketsForActor({
      actorPacket: input.actorContext.actorPacket,
      signedPackets: input.signedPackets,
    });
    await this.attestationService.syncDerivedState();
    const [claimPacket] = input.signedPackets;
    const claimStatus =
      claimPacket.header.family === 'Claim'
        ? (claimPacket as PacketEnvelopeByType['Claim']).body.status
        : null;

    return {
      persist_effects: toPersistEffects(input.signedPackets),
      result: {
        claim_packet_id: claimPacket.header.packet_id,
        claim_status: claimStatus,
      },
    };
  }

  private async finalizeHomeLocalityClaim(input: {
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
    storedTicket: ReturnType<MutationTicketStore['consume']>;
  }) {
    await this.persistSignedPacketsForActor({
      actorPacket: input.actorContext.actorPacket,
      signedPackets: input.signedPackets,
    });
    const activePacket = [...input.signedPackets].reverse().find(
      (packet): packet is PacketEnvelopeByType['Claim'] =>
        packet.header.family === 'Claim' &&
        (packet as PacketEnvelopeByType['Claim']).body.status === 'active'
    );

    return {
      persist_effects: toPersistEffects(input.signedPackets),
      result: {
        claim_packet_id: activePacket?.header.packet_id ?? null,
        claim_status:
          activePacket?.body.status ??
          (input.storedTicket.intent.kind === 'home_locality.claim.set' &&
          input.storedTicket.intent.home_scope_packet_id === null
            ? 'withdrawn'
            : null),
        home_scope_packet_id:
          activePacket?.body.target_ref.packet_id ??
          (input.storedTicket.intent.kind === 'home_locality.claim.set'
            ? input.storedTicket.intent.home_scope_packet_id
            : null),
      },
    };
  }

  private async finalizeRoleAssociationAttestation(input: {
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
    storedTicket: ReturnType<MutationTicketStore['consume']>;
  }) {
    await this.persistSignedPacketsForActor({
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
      persist_effects: toPersistEffects(input.signedPackets),
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
    storedTicket: ReturnType<MutationTicketStore['consume']>;
  }) {
    await this.persistSignedPacketsForActor({
      actorPacket: input.actorContext.actorPacket,
      signedPackets: input.signedPackets,
    });

    const preparedResult = input.storedTicket.prepared_result as
      | {
          created_packets: PacketEnvelopeByType['Element'][];
          final_result: unknown;
          duplicate_warnings: unknown[];
        }
      | undefined;

    return {
      persist_effects: toPersistEffects(input.signedPackets),
      result: {
        created_packets: input.signedPackets,
        final_result: preparedResult?.final_result ?? null,
        duplicate_warnings: preparedResult?.duplicate_warnings ?? [],
      },
    };
  }

  private async finalizeDiscussionSurfacesEnsure(input: {
    actorContext: ActorContext;
    signedPackets: PacketEnvelope[];
    storedTicket: ReturnType<MutationTicketStore['consume']>;
  }) {
    await this.persistSignedPacketsForActor({
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
      persist_effects: toPersistEffects(input.signedPackets),
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
    const storedTicket = this.ticketStore.consume(input.request.ticket_id);

    if (storedTicket.actor_packet_id !== input.actorContext.actorPacket.header.packet_id) {
      throw new Error('Mutation ticket actor does not match the current actor.');
    }

    await assertSignedPacketsMatchPreparedDigests({
      preparedMutation: storedTicket.prepared_mutation,
      signedPackets: input.request.signed_packets,
    });

    if (
      !doesProofBundleSatisfyRequirement({
        proofs: input.actorContext.proofBundle,
        requiredLevel: storedTicket.prepared_mutation.required_proof_level,
        acceptedMethods:
          storedTicket.prepared_mutation.accepted_proof_methods,
      })
    ) {
      throw new Error(
        `This mutation requires ${describeWriteProofLevel(
          storedTicket.prepared_mutation.required_proof_level
        )} before it can be finalized.`
      );
    }

    const kind = storedTicket.intent.kind;
    let finalized:
      | Awaited<ReturnType<typeof this.finalizeDiscussionThreadPost>>
      | Awaited<ReturnType<typeof this.finalizeDiscussionReply>>
      | Awaited<ReturnType<typeof this.finalizePacketSignal>>
      | Awaited<ReturnType<typeof this.finalizeAssemblyElementCreate>>
      | Awaited<ReturnType<typeof this.finalizeAssociationClaimUpdate>>
      | Awaited<ReturnType<typeof this.finalizeHomeLocalityClaim>>
      | Awaited<ReturnType<typeof this.finalizeRoleAssociationAttestation>>
      | Awaited<ReturnType<typeof this.finalizeLocalityPathCreate>>
      | Awaited<ReturnType<typeof this.finalizeDiscussionSurfacesEnsure>>
      | Awaited<ReturnType<typeof this.finalizeActorWritePolicyUpdate>>;

    switch (kind) {
      case 'discussion.thread_post.create':
        finalized = await this.finalizeDiscussionThreadPost({
          storedTicket,
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets as [
            PacketEnvelopeByType['DiscussionThread'],
            PacketEnvelopeByType['DiscussionPost'],
          ],
        });
        break;
      case 'discussion.reply.create':
        finalized = await this.finalizeDiscussionReply({
          storedTicket,
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets as [
            PacketEnvelopeByType['DiscussionReply'],
          ],
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
      case 'assembly_association.claim.set':
      case 'role_association.claim.set':
        finalized = await this.finalizeAssociationClaimUpdate({
          actorContext: input.actorContext,
          signedPackets: input.request.signed_packets as [PacketEnvelope],
        });
        break;
      case 'home_locality.claim.set':
        finalized = await this.finalizeHomeLocalityClaim({
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
