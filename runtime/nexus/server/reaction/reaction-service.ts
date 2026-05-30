/**
 * File: reaction-service.ts
 * Description: Projects canonical reaction packets across discussions and association flows.
 */

import { interpretPacket } from '@core/packets/packet-interpreter';
import type {
  AssociationClaimProjection,
  AssociationRelationProjection,
  ReactionEdgeProjection,
  ReactionService,
  ReactionVoteSummary,
} from '@core/contracts';
import type {
  ReactionAttestationValue,
  ReactionVoteValue,
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import {
  filterClaimPackets,
  listClaimPackets,
} from '@runtime/nexus/server/claim-utils';
import {
  filterRelationPackets,
  listRelationPackets,
} from '@runtime/nexus/server/relation-utils';
import type {
  ReactionIndexRecord,
  ReactionTallyIndexRecord,
} from '@runtime/storage/sqlite-records';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';
import { NodeSQLiteDerivedReactionStore } from '@runtime/storage/node-sqlite-derived-reaction-store';

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

function applyModerationThresholds(
  summary: ReactionAggregate
): ReactionAggregate {
  return {
    ...summary,
    auto_hidden: false,
    deprioritized: false,
  };
}

function createEmptySummary(viewerValue: ReactionVoteValue | null): ReactionVoteSummary {
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
    emoji_keys: reactionPacket.body.emoji_keys,
    status: reactionPacket.body.status,
    context_ref: reactionPacket.body.context_ref,
    supporting_refs: reactionPacket.body.supporting_refs,
    note: reactionPacket.body.note,
    supersedes_ref: reactionPacket.body.supersedes_ref,
    created_at: reactionPacket.header.created_at,
  };
}

export class SQLiteReactionService implements ReactionService {
  private state: ReactionState | null = null;
  private readonly packetStore: NodeSQLitePacketStore;
  private readonly derivedReactionStore: NodeSQLiteDerivedReactionStore;

  constructor(packetStore: NodeSQLitePacketStore) {
    this.packetStore = packetStore;
    this.derivedReactionStore = new NodeSQLiteDerivedReactionStore({
      databasePath: packetStore.databasePath,
    });
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
        emoji_keys_json: JSON.stringify(reactionPacket.body.emoji_keys),
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

      if (reactionPacket.body.vote_value === 'up') {
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
    const viewerValue = viewerValues?.get(input.target_packet_id) ?? null;
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
    attestation_value?: ReactionAttestationValue | null;
  }): Promise<ReactionEdgeProjection[]> {
    if (!this.state) {
      await this.syncDerivedState();
    }

    return (this.state?.reactionPackets ?? [])
      .filter(
        (reactionPacket) => getActorKeyFromPacket(reactionPacket) === input.actor_key
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
    this.derivedReactionStore.replaceReactionProjection(input);
  }

}
