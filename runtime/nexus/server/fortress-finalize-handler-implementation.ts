/**
 * File: fortress-finalize-handler-implementation.ts
 * Description: Typed finalization handlers for fortress mutation intents after signed packet validation and persistence checks.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import { projectDiscussionPacketToLegacy } from '@core/packets/discussion-compat';
import type { MutationProofBundle } from '@core/auth/proof-types';
import type {
  DiscussionActorClass,
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import type { NexusAuthService } from '@runtime/nexus/server/auth-service';
import type { SQLiteAttestationService } from '@runtime/nexus/server/attestation-service';
import type { SQLiteDiscussionService } from '@runtime/nexus/server/discussion-service';
import type { StoredMutationTicket } from '@runtime/nexus/server/mutation-ticket-store';
import {
  toMutationPersistEffects,
} from '@runtime/nexus/server/signed-packet-finalizer';
import type { SignedPacketFinalizer } from '@runtime/nexus/server/signed-packet-finalizer';
import {
  collectEligibleMainScopePacketIds,
  type LocalityGraphApplyPreparedResult,
} from '@runtime/nexus/server/locality-graph-apply-planner';
import {
  reconcileScopeDisplayPreferences,
  writeClaimedScopeDisplayPreferences,
} from '@runtime/nexus/server/scope-display-preferences';
import {
  toPreferenceElementFortressResult,
  type PreparedPreferenceElementFortressResult,
} from '@runtime/nexus/server/preference-fortress-workflow';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export type MutationFinalizeActorContext = {
  actorPacket: PacketEnvelopeByType['Element'];
  actorKey: string;
  actorClass: DiscussionActorClass;
  proofBundle: MutationProofBundle;
};

function isHomeLocalityMutationKind(
  kind: MutationIntent['kind']
): kind is 'home_locality.relation.set' {
  return kind === 'home_locality.relation.set';
}

export class MutationFinalizeHandlers {
  constructor(
    private readonly packetStore: NodeSQLitePacketStore,
    private readonly authService: NexusAuthService,
    private readonly discussionService: SQLiteDiscussionService,
    private readonly attestationService: SQLiteAttestationService,
    private readonly signedPacketFinalizer: SignedPacketFinalizer
  ) {}

  async finalizeDiscussionThreadPost(input: {
    storedTicket: StoredMutationTicket;
    actorContext: MutationFinalizeActorContext;
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

  async finalizeDiscussionReply(input: {
    storedTicket: StoredMutationTicket;
    actorContext: MutationFinalizeActorContext;
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

  async finalizePacketSignal(input: {
    actorContext: MutationFinalizeActorContext;
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

  async finalizeActorWritePolicyUpdate(input: {
    actorContext: MutationFinalizeActorContext;
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

  async finalizeAssemblyElementCreate(input: {
    actorContext: MutationFinalizeActorContext;
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

  async finalizeAssociationRelationUpdate(input: {
    actorContext: MutationFinalizeActorContext;
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
      input.storedTicket.intent.kind === 'assembly_association.relation.clear';

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
          input.storedTicket.intent.kind === 'assembly_association.relation.clear'
            ? input.storedTicket.intent.assembly_packet_id
            : null,
      },
    };
  }

  async finalizeFollowRelationUpdate(input: {
    actorContext: MutationFinalizeActorContext;
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

  async finalizeClaimUpdate(input: {
    actorContext: MutationFinalizeActorContext;
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

  async finalizeHomeLocalityRelation(input: {
    actorContext: MutationFinalizeActorContext;
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

  async finalizeRoleAssociationAttestation(input: {
    actorContext: MutationFinalizeActorContext;
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

  async finalizeLocalityPathCreate(input: {
    actorContext: MutationFinalizeActorContext;
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

  async finalizeLocalityGraphApply(input: {
    actorContext: MutationFinalizeActorContext;
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

  async finalizeDiscussionSurfacesEnsure(input: {
    actorContext: MutationFinalizeActorContext;
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

  async finalizePreferenceElementSet(input: {
    storedTicket: StoredMutationTicket;
    actorContext?: MutationFinalizeActorContext;
    signedPackets?: PacketEnvelope[];
  }) {
    if (input.storedTicket.intent.kind !== 'preference.element.set') {
      throw new Error('Unexpected preference mutation ticket.');
    }

    const preparedResult =
      input.storedTicket.prepared_result as
        | PreparedPreferenceElementFortressResult
        | undefined;

    if (!preparedResult) {
      throw new Error('Preference mutation ticket is missing prepared result metadata.');
    }

    let finalized;
    const signedPackets = input.signedPackets ?? [];

    if (preparedResult.wrote_revision === false) {
      if (signedPackets.length > 0) {
        throw new Error('Preference no-op finalize does not accept signed packets.');
      }
      finalized = toPreferenceElementFortressResult(preparedResult, []);
    } else {
      if (!input.actorContext) {
        throw new Error('Preference signed finalize requires actor context.');
      }
      if (signedPackets.length === 0) {
        throw new Error('Preference finalize requires signed packet candidates.');
      }

      await this.signedPacketFinalizer.persistSignedPacketsForActor({
        actorPacket: input.actorContext.actorPacket,
        signedPackets,
      });
      finalized = {
        persist_effects: toMutationPersistEffects(signedPackets),
        result: {
          packet_id: preparedResult.packet_id,
          revision_id: preparedResult.revision_id,
          wrote_revision: preparedResult.wrote_revision,
          preferences: preparedResult.preferences,
          shell_chrome: preparedResult.shell_chrome,
        },
      };
    }

    if (input.storedTicket.intent.scope_display) {
      await this.packetStore.writeActorScopeDisplayPreferences({
        actor_packet_id: input.storedTicket.actor_packet_id,
        main_visible_scope_packet_ids:
          finalized.result.preferences.main_visible_scope_packet_ids,
        show_associated_parent_chains:
          finalized.result.preferences.show_associated_parent_chains,
        show_followed_parent_chains:
          finalized.result.preferences.show_followed_parent_chains,
        updated_at:
          input.storedTicket.intent.created_at ?? new Date().toISOString(),
      });
    }

    return finalized;
  }


}
