/**
 * File: mutation-service.ts
 * Description: Hosts the shared fortress prepare/finalize mutation corridor over adapted packet state and runtime proofs.
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
import { createElementPolicyRefsRevision } from '@core/packets/identity';
import { createPolicyPacket } from '@core/packets/builders';
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
  DiscussionActorClass,
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import type { NexusSecurityMode } from '@runtime/nexus/nexus-api-types';
import { verifyPacketSignature } from '@runtime/nexus/identity-crypto';
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
  result:
    | {
        viewer: unknown;
        post: unknown;
      }
    | {
        target_packet_id: string;
        value: -1 | 0 | 1;
        summary: unknown;
      }
    | {
        security_mode: NexusSecurityMode;
      };
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

  readTicket(ticketId: string) {
    return this.ticketStore.read(ticketId);
  }

  async prepareMutation(input: {
    intent: MutationIntent;
    actorPacket: PacketEnvelopeByType['Element'];
    actorKey: string;
  }): Promise<PreparedMutationResult> {
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
    const finalized =
      kind === 'discussion.thread_post.create'
        ? await this.finalizeDiscussionThreadPost({
            storedTicket,
            actorContext: input.actorContext,
            signedPackets: input.request.signed_packets as [
              PacketEnvelopeByType['DiscussionThread'],
              PacketEnvelopeByType['DiscussionPost'],
            ],
          })
        : kind === 'discussion.reply.create'
          ? await this.finalizeDiscussionReply({
              storedTicket,
              actorContext: input.actorContext,
              signedPackets: input.request.signed_packets as [
                PacketEnvelopeByType['DiscussionReply'],
              ],
            })
          : kind === 'attestation.packet_signal.set'
            ? await this.finalizePacketSignal({
                actorContext: input.actorContext,
                signedPackets: input.request.signed_packets as [
                  PacketEnvelopeByType['Attestation'],
                ],
              })
            : await this.finalizeActorWritePolicyUpdate({
                actorContext: input.actorContext,
                signedPackets: input.request.signed_packets,
              });

    return {
      kind,
      persist_effects: finalized.persist_effects,
      result: finalized.result,
    };
  }
}
