/**
 * File: reaction-service.ts
 * Description: Projects and mutates canonical reaction packets across discussions and association flows.
 */

import { DatabaseSync } from 'node:sqlite';

import { createReactionPacket } from '@core/packets/builders';
import {
  isDiscussionMessagePacket,
  type DiscussionLegacyType,
} from '@core/packets/discussion-compat';
import { interpretPacket } from '@core/packets/packet-interpreter';
import { resolvePacketTarget } from '@core/packets/packet-target-resolver';
import type {
  AssociationClaimProjection,
  AssociationRelationProjection,
  ReactionEdgeProjection,
  ReactionService,
  ReactionVoteSummary,
} from '@core/contracts';
import type {
  ReactionAttestationValue,
  ReactionEmotionId,
  ReactionVoteValue,
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
  filterRelationPackets,
  listRelationPackets,
} from '@runtime/nexus/server/relation-utils';
import {
  createReactionPacketId,
  resolveDiscussionScopePacketId,
} from '@runtime/nexus/discussion-packets';
import type {
  ReactionIndexRecord,
  ReactionTallyIndexRecord,
} from '@runtime/storage/sqlite-records';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

type ReactionAggregate = Omit<ReactionVoteSummary, 'viewer_value'>;

type ReactionState = {
  packetMap: Map<string, PacketEnvelope>;
  reactionPackets: PacketEnvelopeByType['Reaction'][];
  summaryByTarget: Map<string, ReactionAggregate>;
  viewerValuesByActor: Map<string, Map<string, ReactionVoteValue>>;
  indexRows: ReactionIndexRecord[];
  tallyRows: ReactionTallyIndexRecord[];
};

function getActorKeyFromPacket(packet: PacketEnvelope): string | null {
  const createdByPacketId = packet.header.provenance.created_by?.packet_id ?? null;

  if (!createdByPacketId) {
    return null;
  }

  return `element:${createdByPacketId}`;
}

function createNextRevisionId(
  packetId: string,
  currentRevisionId?: string | null
): string {
  const currentRevisionNumber =
    currentRevisionId?.match(/@r(\d+)$/)?.[1] ?? null;
  const nextRevisionNumber =
    currentRevisionNumber === null ? 1 : Number(currentRevisionNumber) + 1;

  return `${packetId}@r${nextRevisionNumber}`;
}

function applyModerationThresholds(
  summary: ReactionAggregate
): ReactionAggregate {
  return {
    ...summary,
    auto_hidden: false,
    deprioritized: false,
  };
}

function createEmptySummary(viewerValue: ReactionVoteValue | 0): ReactionVoteSummary {
  return {
    upvote_count: 0,
    downvote_count: 0,
    net_score: 0,
    total_votes: 0,
    negative_ratio: 0,
    viewer_value: viewerValue,
    auto_hidden: false,
    deprioritized: false,
  };
}

function toReactionEdgeProjection(
  reactionPacket: PacketEnvelopeByType['Reaction'],
  packetMap: Map<string, PacketEnvelope>
): ReactionEdgeProjection {
  const sourceActorPacketId =
    reactionPacket.header.provenance.created_by?.packet_id ?? null;
  const sourceActorPacket =
    sourceActorPacketId !== null ? packetMap.get(sourceActorPacketId) : null;

  return {
    packet: {
      packet_id: reactionPacket.header.packet_id,
    },
    revision: {
      packet_id: reactionPacket.header.packet_id,
      revision_id: reactionPacket.header.revision_id,
    },
    source_actor_key: getActorKeyFromPacket(reactionPacket) ?? '',
    source_actor_packet_id: sourceActorPacketId,
    source_actor_label:
      sourceActorPacket?.header.type === 'Element'
        ? (sourceActorPacket as PacketEnvelopeByType['Element']).body.name
        : null,
    authority_scope_packet_id:
      reactionPacket.header.authority_scope_ref?.packet_id ?? null,
    target_ref: reactionPacket.body.target_ref,
    vote_value: reactionPacket.body.vote_value,
    attestation_value: reactionPacket.body.attestation_value,
    emotion_ids: reactionPacket.body.emotion_ids,
    status: reactionPacket.body.status,
    context_ref: reactionPacket.body.context_ref,
    supporting_refs: reactionPacket.body.supporting_refs,
    note: reactionPacket.body.note,
    supersedes_ref: reactionPacket.body.supersedes_ref,
    created_at: reactionPacket.header.created_at,
  };
}

function projectDiscussionLegacyView<TType extends DiscussionLegacyType>(
  packet: PacketEnvelope,
  targetType: TType
): PacketEnvelopeByType[TType] | null {
  void targetType;
  return packet.header.type === 'Discussion'
    ? (packet as unknown as PacketEnvelopeByType[TType])
    : null;
}

async function getDiscussionForumById(
  packetStore: NodeSQLitePacketStore,
  forumPacketId: string
): Promise<PacketEnvelopeByType['Discussion'] | null> {
  const resolution = await resolvePacketTarget({
    packet_id: forumPacketId,
    fetchPacket: async (packetId) =>
      packetStore.fetchByPacket({ packet_id: packetId }),
    fetchRevisionHeads: async (packetId) =>
      packetStore.fetchRevisionHeads({ packet_id: packetId }),
  });
  const packet = resolution.resolved_packet ?? resolution.source_packet;

  if (!packet) {
    return null;
  }

  if (packet.header.type !== 'Discussion') {
    return projectDiscussionLegacyView(packet, 'Discussion');
  }

  return packet as PacketEnvelopeByType['Discussion'];
}

async function getDiscussionThreadById(
  packetStore: NodeSQLitePacketStore,
  threadPacketId: string
): Promise<PacketEnvelopeByType['Discussion'] | null> {
  const resolution = await resolvePacketTarget({
    packet_id: threadPacketId,
    fetchPacket: async (packetId) =>
      packetStore.fetchByPacket({ packet_id: packetId }),
    fetchRevisionHeads: async (packetId) =>
      packetStore.fetchRevisionHeads({ packet_id: packetId }),
  });
  const packet = resolution.resolved_packet ?? resolution.source_packet;

  if (!packet) {
    return null;
  }

  if (packet.header.type !== 'Discussion') {
    return projectDiscussionLegacyView(packet, 'Discussion');
  }

  return packet as PacketEnvelopeByType['Discussion'];
}

function getEntryThreadPacketId(
  entryPacket:
    | PacketEnvelopeByType['Discussion']
    | PacketEnvelopeByType['Discussion']
): string {
  const body = entryPacket.body as {
    topic_ref?: { packet_id: string };
    parent_ref?: { packet_id: string };
  };

  return body.topic_ref?.packet_id ?? body.parent_ref?.packet_id ?? entryPacket.header.packet_id;
}

function toLegacyDiscussionEntry(
  packet: PacketEnvelope
):
  | PacketEnvelopeByType['Discussion']
  | PacketEnvelopeByType['Discussion']
  | null {
  if (isDiscussionMessagePacket(packet)) {
    return (
      (projectDiscussionLegacyView(packet, 'Discussion') as
        | PacketEnvelopeByType['Discussion']
        | null) ??
      (projectDiscussionLegacyView(packet, 'Discussion') as
        | PacketEnvelopeByType['Discussion']
        | null)
    );
  }

  if (packet.header.type === 'Discussion') {
    return packet as PacketEnvelopeByType['Discussion'];
  }

  return null;
}

export class SQLiteReactionService implements ReactionService {
  private state: ReactionState | null = null;
  private readonly packetStore: NodeSQLitePacketStore;

  constructor(packetStore: NodeSQLitePacketStore) {
    this.packetStore = packetStore;
  }

  async syncDerivedState(): Promise<void> {
    const [reactionPackets, allPackets] = await Promise.all([
      this.packetStore.listPreferredPacketsByType('Reaction'),
      this.packetStore.listPreferredPackets(),
    ]);

    const packetMap = new Map(
      allPackets.map((packet) => [packet.header.packet_id, packet])
    );
    const viewerValuesByActor = new Map<string, Map<string, ReactionVoteValue>>();
    const rawSummaryByTarget = new Map<string, ReactionAggregate>();
    const indexRows: ReactionIndexRecord[] = [];

    for (const reactionPacket of reactionPackets) {
      const actorKey = getActorKeyFromPacket(reactionPacket);

      if (!actorKey) {
        continue;
      }

      indexRows.push({
        reaction_packet_id: reactionPacket.header.packet_id,
        target_packet_id: reactionPacket.body.target_ref.packet_id,
        actor_key: actorKey,
        vote_value: reactionPacket.body.vote_value,
        attestation_value: reactionPacket.body.attestation_value,
        emotion_ids_json: JSON.stringify(reactionPacket.body.emotion_ids),
        status: reactionPacket.body.status,
        context_packet_id: reactionPacket.body.context_ref?.packet_id ?? null,
        note: reactionPacket.body.note,
        created_at: reactionPacket.header.created_at,
        updated_at: reactionPacket.header.created_at,
      });

      if (
        reactionPacket.body.status !== 'active' ||
        reactionPacket.body.vote_value === null
      ) {
        continue;
      }

      const currentSummary =
        rawSummaryByTarget.get(reactionPacket.body.target_ref.packet_id) ?? {
          upvote_count: 0,
          downvote_count: 0,
          net_score: 0,
          total_votes: 0,
          negative_ratio: 0,
          auto_hidden: false,
          deprioritized: false,
        };

      if (reactionPacket.body.vote_value === 1) {
        currentSummary.upvote_count += 1;
      } else {
        currentSummary.downvote_count += 1;
      }

      currentSummary.net_score =
        currentSummary.upvote_count - currentSummary.downvote_count;
      currentSummary.total_votes =
        currentSummary.upvote_count + currentSummary.downvote_count;
      currentSummary.negative_ratio =
        currentSummary.total_votes === 0
          ? 0
          : currentSummary.downvote_count / currentSummary.total_votes;
      rawSummaryByTarget.set(
        reactionPacket.body.target_ref.packet_id,
        currentSummary
      );

      const actorValues =
        viewerValuesByActor.get(actorKey) ?? new Map<string, ReactionVoteValue>();
      actorValues.set(
        reactionPacket.body.target_ref.packet_id,
        reactionPacket.body.vote_value
      );
      viewerValuesByActor.set(actorKey, actorValues);
    }

    const summaryByTarget = new Map<string, ReactionAggregate>();
    const tallyRows: ReactionTallyIndexRecord[] = [];

    for (const [targetPacketId, rawSummary] of rawSummaryByTarget.entries()) {
      const moderatedSummary = applyModerationThresholds(rawSummary);

      summaryByTarget.set(targetPacketId, moderatedSummary);
      tallyRows.push({
        target_packet_id: targetPacketId,
        upvote_count: moderatedSummary.upvote_count,
        downvote_count: moderatedSummary.downvote_count,
        net_score: moderatedSummary.net_score,
        total_votes: moderatedSummary.total_votes,
        negative_ratio: moderatedSummary.negative_ratio,
        auto_hidden: Number(moderatedSummary.auto_hidden),
        deprioritized: Number(moderatedSummary.deprioritized),
      });
    }

    this.state = {
      packetMap,
      reactionPackets,
      summaryByTarget,
      viewerValuesByActor,
      indexRows,
      tallyRows,
    };

    this.persistDerivedState({
      indexRows,
      tallyRows,
    });
  }

  async setReaction(input: {
    target_packet_id: string;
    actor_key: string;
    actor_class: DiscussionActorClass;
    authority_scope_id: string | null;
    vote_value?: ReactionVoteValue | 0 | null;
    attestation_value?: ReactionAttestationValue | null;
    emotion_ids?: ReactionEmotionId[];
    context_packet_id?: string | null;
    supporting_packet_ids?: string[];
    note?: string | null;
  }): Promise<ReactionVoteSummary> {
    await this.syncDerivedState();

    if (!this.state) {
      throw new Error('Reaction state is unavailable.');
    }

    const targetPacket = await this.packetStore.fetchByPacket({
      packet_id: input.target_packet_id,
    });

    if (!targetPacket) {
      throw new Error(`Unknown reaction target: ${input.target_packet_id}`);
    }

    const entryPacket = toLegacyDiscussionEntry(targetPacket);

    if (entryPacket) {
      const threadPacket = await getDiscussionThreadById(
        this.packetStore,
        getEntryThreadPacketId(entryPacket)
      );

      if (!threadPacket) {
        throw new Error(
          `Missing discussion thread for packet ${input.target_packet_id}.`
        );
      }

      const forumPacket = await getDiscussionForumById(
        this.packetStore,
        (threadPacket.body as { parent_ref: { packet_id: string } }).parent_ref.packet_id
      );

      if (!forumPacket) {
        throw new Error(
          `Missing discussion forum for thread ${threadPacket.header.packet_id}.`
        );
      }

      if (forumPacket.body.role !== 'visitor_lobby') {
        const actorPacketId = input.actor_key.startsWith('element:')
          ? input.actor_key.slice('element:'.length)
          : null;
        const assemblyPacketId = forumPacket.header.authority_scope_ref?.packet_id ?? null;

        if (!actorPacketId || !assemblyPacketId) {
          throw new Error('Reactions are not open to your current actor class here.');
        }

        const hasMembership = await this.hasActiveAssociationRelation({
          actor_packet_id: actorPacketId,
          target_packet_id: assemblyPacketId,
        });

        if (!hasMembership) {
          throw new Error('Reactions are not open to your current actor class here.');
        }
      }
    }

    const actorPacketId = input.actor_key.replace(/^element:/, '');
    const reactionPacketId = createReactionPacketId({
      targetPacketId: input.target_packet_id,
      actorPacketId,
      contextPacketId: input.context_packet_id ?? null,
    });
    const existingPreferredRevision = await this.packetStore.fetchPreferredRevision({
      packet_id: reactionPacketId,
    });
    const existingPacket =
      existingPreferredRevision === null
        ? null
        : await this.packetStore.fetchByRevision(existingPreferredRevision);
    const currentReactionPacket =
      existingPacket?.header.type === 'Reaction'
        ? (existingPacket as PacketEnvelopeByType['Reaction'])
        : null;

    const requestedVoteValue = input.vote_value;
    const nextVoteValue =
      requestedVoteValue === undefined
        ? currentReactionPacket?.body.vote_value ?? null
        : requestedVoteValue === 0
          ? null
          : requestedVoteValue;
    const nextAttestationValue =
      input.attestation_value === undefined
        ? currentReactionPacket?.body.attestation_value ?? null
        : input.attestation_value;
    const nextEmotionIds =
      input.emotion_ids === undefined
        ? currentReactionPacket?.body.emotion_ids ?? []
        : input.emotion_ids;
    const nextStatus =
      nextVoteValue === null && nextAttestationValue === null && nextEmotionIds.length === 0
        ? 'cleared'
        : 'active';

    if (nextStatus === 'cleared' && !currentReactionPacket) {
      await this.syncDerivedState();
      return this.getTargetSummary({
        target_packet_id: input.target_packet_id,
        viewer_actor_key: input.actor_key,
      });
    }

    const nextPacket = createReactionPacket({
      packet_id: reactionPacketId,
      revision_id: createNextRevisionId(
        reactionPacketId,
        existingPreferredRevision?.revision_id ?? null
      ),
      created_at: new Date().toISOString(),
      parent_revision_refs: existingPreferredRevision
        ? [existingPreferredRevision]
        : [],
      authority_scope_ref: input.authority_scope_id
        ? {
            packet_id: resolveDiscussionScopePacketId(input.authority_scope_id),
          }
        : null,
      applicable_scope_refs:
        targetPacket.header.applicable_scope_refs.length > 0
          ? targetPacket.header.applicable_scope_refs
          : targetPacket.header.authority_scope_ref
            ? [targetPacket.header.authority_scope_ref]
            : [],
      created_by: input.actor_key.startsWith('element:')
        ? {
            packet_id: input.actor_key.slice('element:'.length),
          }
        : null,
      adapter: 'nexus-web',
      metadata_tags: ['reaction'],
      target_ref: { packet_id: input.target_packet_id },
      status: nextStatus,
      subtype: 'reaction',
      vote_value: nextVoteValue,
      attestation_value: nextAttestationValue,
      emotion_ids: nextEmotionIds,
      context_ref: input.context_packet_id
        ? {
            packet_id: input.context_packet_id,
          }
        : null,
      supporting_refs: (input.supporting_packet_ids ?? []).map((packetId) => ({
        packet_id: packetId,
      })),
      note: input.note ?? currentReactionPacket?.body.note ?? null,
      supersedes_ref: currentReactionPacket
        ? {
            packet_id: currentReactionPacket.header.packet_id,
          }
        : null,
    });

    await this.packetStore.writeRevision(nextPacket);
    await this.packetStore.publishRevision({
      packet_id: nextPacket.header.packet_id,
      revision_id: nextPacket.header.revision_id,
    });
    await this.syncDerivedState();

    return this.getTargetSummary({
      target_packet_id: input.target_packet_id,
      viewer_actor_key: input.actor_key,
    });
  }

  async persistSignedReaction(input: {
    reaction_packet: PacketEnvelopeByType['Reaction'];
    actor_packet: PacketEnvelopeByType['Element'];
    actor_key: string;
    actor_class: DiscussionActorClass;
  }): Promise<ReactionVoteSummary> {
    await this.syncDerivedState();

    if (!this.state) {
      throw new Error('Reaction state is unavailable.');
    }

    const { reaction_packet: reactionPacket, actor_packet: actorPacket } = input;
    const expectedPacketId = createReactionPacketId({
      targetPacketId: reactionPacket.body.target_ref.packet_id,
      actorPacketId: actorPacket.header.packet_id,
      contextPacketId: reactionPacket.body.context_ref?.packet_id ?? null,
    });

    if (reactionPacket.header.packet_id !== expectedPacketId) {
      throw new Error('Reaction packet id does not match the reaction target.');
    }

    if (
      reactionPacket.header.provenance.created_by?.packet_id !==
      actorPacket.header.packet_id
    ) {
      throw new Error('Reaction packet provenance does not match the actor packet.');
    }

    if (
      reactionPacket.header.integrity.embedded_signatures[0]?.signer_packet_ref
        ?.packet_id !== actorPacket.header.packet_id
    ) {
      throw new Error('Reaction packet signature does not match the actor packet.');
    }

    const signatureIsValid = await verifyPacketSignature({
      packet: reactionPacket,
      signerPacket: actorPacket,
    });

    if (!signatureIsValid) {
      throw new Error('Reaction packet signature verification failed.');
    }

    const targetPacket = await this.packetStore.fetchByPacket({
      packet_id: reactionPacket.body.target_ref.packet_id,
    });

    if (!targetPacket) {
      throw new Error(
        `Unknown reaction target: ${reactionPacket.body.target_ref.packet_id}`
      );
    }

    const entryPacket = toLegacyDiscussionEntry(targetPacket);

    if (entryPacket) {
      const threadPacket = await getDiscussionThreadById(
        this.packetStore,
        getEntryThreadPacketId(entryPacket)
      );

      if (!threadPacket) {
        throw new Error(
          `Missing discussion thread for packet ${reactionPacket.body.target_ref.packet_id}.`
        );
      }

      const forumPacket = await getDiscussionForumById(
        this.packetStore,
        (threadPacket.body as { parent_ref: { packet_id: string } }).parent_ref.packet_id
      );

      if (!forumPacket) {
        throw new Error(
          `Missing discussion forum for thread ${threadPacket.header.packet_id}.`
        );
      }

      if (forumPacket.body.role !== 'visitor_lobby') {
        const assemblyPacketId = forumPacket.header.authority_scope_ref?.packet_id ?? null;

        if (!assemblyPacketId) {
          throw new Error('Reactions are not open to your current actor class here.');
        }

        const hasMembership = await this.hasActiveAssociationRelation({
          actor_packet_id: actorPacket.header.packet_id,
          target_packet_id: assemblyPacketId,
        });

        if (!hasMembership) {
          throw new Error('Reactions are not open to your current actor class here.');
        }
      }
    }

    const existingPreferredRevision = await this.packetStore.fetchPreferredRevision({
      packet_id: reactionPacket.header.packet_id,
    });

    if (!existingPreferredRevision && reactionPacket.body.status === 'cleared') {
      await this.syncDerivedState();

      return this.getTargetSummary({
        target_packet_id: reactionPacket.body.target_ref.packet_id,
        viewer_actor_key: input.actor_key,
      });
    }

    await this.packetStore.writeRevision(reactionPacket);
    await this.packetStore.publishRevision({
      packet_id: reactionPacket.header.packet_id,
      revision_id: reactionPacket.header.revision_id,
    });
    await this.syncDerivedState();

    return this.getTargetSummary({
      target_packet_id: reactionPacket.body.target_ref.packet_id,
      viewer_actor_key: input.actor_key,
    });
  }

  async getTargetSummary(input: {
    target_packet_id: string;
    viewer_actor_key: string | null;
  }): Promise<ReactionVoteSummary> {
    if (!this.state) {
      await this.syncDerivedState();
    }

    const viewerValues = input.viewer_actor_key
      ? this.state?.viewerValuesByActor.get(input.viewer_actor_key)
      : null;
    const viewerValue = viewerValues?.get(input.target_packet_id) ?? 0;
    const summary = this.state?.summaryByTarget.get(input.target_packet_id);

    if (!summary) {
      return createEmptySummary(viewerValue);
    }

    return {
      ...summary,
      viewer_value: viewerValue,
    };
  }

  async listTargetReactions(input: {
    target_packet_id: string;
    context_packet_id?: string | null;
    vote_only?: boolean;
    attestation_value?: ReactionAttestationValue | null;
    active_only?: boolean;
  }): Promise<ReactionEdgeProjection[]> {
    if (!this.state) {
      await this.syncDerivedState();
    }

    return (this.state?.reactionPackets ?? [])
      .filter(
        (reactionPacket) =>
          reactionPacket.body.target_ref.packet_id === input.target_packet_id
      )
      .filter((reactionPacket) =>
        input.context_packet_id
          ? reactionPacket.body.context_ref?.packet_id === input.context_packet_id
          : true
      )
      .filter((reactionPacket) =>
        input.vote_only ? reactionPacket.body.vote_value !== null : true
      )
      .filter((reactionPacket) =>
        input.attestation_value
          ? reactionPacket.body.attestation_value === input.attestation_value
          : true
      )
      .filter((reactionPacket) =>
        input.active_only === false
          ? true
          : reactionPacket.body.status === 'active'
      )
      .sort((leftPacket, rightPacket) =>
        rightPacket.header.created_at.localeCompare(leftPacket.header.created_at)
      )
      .map((reactionPacket) =>
        toReactionEdgeProjection(reactionPacket, this.state?.packetMap ?? new Map())
      );
  }

  async listActorReactions(input: {
    actor_key: string;
    active_only?: boolean;
  }): Promise<ReactionEdgeProjection[]> {
    if (!this.state) {
      await this.syncDerivedState();
    }

    return (this.state?.reactionPackets ?? [])
      .filter(
        (reactionPacket) => getActorKeyFromPacket(reactionPacket) === input.actor_key
      )
      .filter((reactionPacket) =>
        input.active_only === false
          ? true
          : reactionPacket.body.status === 'active'
      )
      .sort((leftPacket, rightPacket) =>
        rightPacket.header.created_at.localeCompare(leftPacket.header.created_at)
      )
      .map((reactionPacket) =>
        toReactionEdgeProjection(reactionPacket, this.state?.packetMap ?? new Map())
      );
  }

  private async hasActiveAssociationRelation(input: {
    actor_packet_id: string;
    target_packet_id: string;
  }): Promise<boolean> {
    const relations = await listRelationPackets(this.packetStore);

    return filterRelationPackets({
      relations,
      relationSubtype: 'association',
      subjectPacketId: input.actor_packet_id,
      targetPacketId: input.target_packet_id,
      scopePacketId: input.target_packet_id,
      activeOnly: true,
    }).length > 0;
  }

  async listAssociationRelationsForActor(
    actor_packet_id: string
  ): Promise<AssociationRelationProjection[]> {
    if (!this.state) {
      await this.syncDerivedState();
    }

    const actorKey = `element:${actor_packet_id}`;
    const associationRelations = filterRelationPackets({
      relations: await listRelationPackets(this.packetStore),
      relationSubtype: 'association',
      subjectPacketId: actor_packet_id,
    });

    return Promise.all(
      associationRelations.map(async (relationPacket) => {
        const targetPacket = this.state?.packetMap.get(
          relationPacket.body.target_ref.packet_id
        );
        const supportingByOthers = (
          await this.listTargetReactions({
            target_packet_id: relationPacket.header.packet_id,
            attestation_value: 'support',
            active_only: true,
          })
        ).filter((edge) => edge.source_actor_key !== actorKey).length;

        return {
          target_packet_id: relationPacket.body.target_ref.packet_id,
          target_name:
            targetPacket?.header.type === 'Element'
              ? (targetPacket as PacketEnvelopeByType['Element']).body.name
              : relationPacket.body.target_ref.packet_id,
          relation_packet_id: relationPacket.header.packet_id,
          status: relationPacket.body.status,
          note: relationPacket.body.note,
          created_at: relationPacket.header.created_at,
          supported_by_other_count: supportingByOthers,
          is_self_issued_only: supportingByOthers === 0,
          is_current: relationPacket.body.status === 'active',
        } satisfies AssociationRelationProjection;
      })
    ).then((relations) =>
      relations.sort((leftRelation, rightRelation) =>
        rightRelation.created_at.localeCompare(leftRelation.created_at)
      )
    );
  }

  async listAssociationClaimsForActor(
    actor_packet_id: string
  ): Promise<AssociationClaimProjection[]> {
    if (!this.state) {
      await this.syncDerivedState();
    }

    const actorKey = `element:${actor_packet_id}`;
    const associationClaims = filterClaimPackets({
      claims: await listClaimPackets(this.packetStore),
      claimKind: 'association',
      subjectPacketId: actor_packet_id,
    });

    return Promise.all(
      associationClaims.map(async (claimPacket) => {
        const targetPacket = this.state?.packetMap.get(
          claimPacket.body.target_ref.packet_id
        );
        const supportingByOthers = (
          await this.listTargetReactions({
            target_packet_id: claimPacket.header.packet_id,
            attestation_value: 'support',
            active_only: true,
          })
        ).filter((edge) => edge.source_actor_key !== actorKey).length;

        return {
          target_packet_id: claimPacket.body.target_ref.packet_id,
          target_name:
            targetPacket?.header.type === 'Element'
              ? (targetPacket as PacketEnvelopeByType['Element']).body.name
              : claimPacket.body.target_ref.packet_id,
          claim_packet_id: claimPacket.header.packet_id,
          status: claimPacket.body.status,
          note: claimPacket.body.note,
          created_at: claimPacket.header.created_at,
          supported_by_other_count: supportingByOthers,
          is_self_issued_only: supportingByOthers === 0,
          is_current: claimPacket.body.status === 'active',
        } satisfies AssociationClaimProjection;
      })
    ).then((claims) =>
      claims.sort((leftClaim, rightClaim) =>
        rightClaim.created_at.localeCompare(leftClaim.created_at)
      )
    );
  }

  async hasActiveAssociationClaim(input: {
    actor_packet_id: string;
    target_packet_id: string;
  }): Promise<boolean> {
    if (!this.state) {
      await this.syncDerivedState();
    }

    return filterClaimPackets({
      claims: await listClaimPackets(this.packetStore),
      claimKind: 'association',
      subjectPacketId: input.actor_packet_id,
      targetPacketId: input.target_packet_id,
      scopePacketId: input.target_packet_id,
      activeOnly: true,
    }).length > 0;
  }

  private persistDerivedState(input: {
    indexRows: ReactionIndexRecord[];
    tallyRows: ReactionTallyIndexRecord[];
  }): void {
    const database = new DatabaseSync(this.packetStore.databasePath);

    try {
      database.exec('BEGIN IMMEDIATE');
      database.exec('DELETE FROM reaction_index');
      database.exec('DELETE FROM reaction_tally_index');

      const insertIndexStatement = database.prepare(`
        INSERT INTO reaction_index (
          reaction_packet_id,
          target_packet_id,
          actor_key,
          vote_value,
          attestation_value,
          emotion_ids_json,
          status,
          context_packet_id,
          note,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertTallyStatement = database.prepare(`
        INSERT INTO reaction_tally_index (
          target_packet_id,
          upvote_count,
          downvote_count,
          net_score,
          total_votes,
          negative_ratio,
          auto_hidden,
          deprioritized
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const row of input.indexRows) {
        insertIndexStatement.run(
          row.reaction_packet_id,
          row.target_packet_id,
          row.actor_key,
          row.vote_value,
          row.attestation_value,
          row.emotion_ids_json,
          row.status,
          row.context_packet_id,
          row.note,
          row.created_at,
          row.updated_at
        );
      }

      for (const row of input.tallyRows) {
        insertTallyStatement.run(
          row.target_packet_id,
          row.upvote_count,
          row.downvote_count,
          row.net_score,
          row.total_votes,
          row.negative_ratio,
          row.auto_hidden,
          row.deprioritized
        );
      }

      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    } finally {
      database.close();
    }
  }
}
