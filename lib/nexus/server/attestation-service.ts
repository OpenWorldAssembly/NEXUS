/**
 * File: attestation-service.ts
 * Description: Projects and mutates canonical attestation packets across discussions and assembly-association flows.
 */

import { DatabaseSync } from 'node:sqlite';

import { createAttestationPacket } from '@/domain/packets/builders';
import type {
  AssemblyAssociationClaimProjection,
  AttestationEdgeProjection,
  AttestationService,
  AttestationSummary,
} from '@/domain/core/contracts';
import type {
  AttestationKind,
  AttestationValue,
  DiscussionActorClass,
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@/domain/schema/packet-schema';
import { verifyPacketSignature } from '@/lib/nexus/identity-crypto';
import {
  createAttestationPacketId,
  resolveDiscussionScopePacketId,
} from '@/lib/nexus/discussion-packets';
import type {
  AttestationIndexRecord,
  AttestationTallyIndexRecord,
} from '@/storage/sqlite-records';
import { NodeSQLitePacketStore } from '@/storage/node-sqlite-packet-store';

type AttestationAggregate = Omit<AttestationSummary, 'viewer_value'>;

type AttestationState = {
  packetMap: Map<string, PacketEnvelope>;
  attestationPackets: PacketEnvelopeByType['Attestation'][];
  summaryByTarget: Map<string, AttestationAggregate>;
  viewerValuesByActor: Map<string, Map<string, AttestationValue>>;
  indexRows: AttestationIndexRecord[];
  tallyRows: AttestationTallyIndexRecord[];
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
  summary: AttestationAggregate
): AttestationAggregate {
  return {
    ...summary,
    auto_hidden: false,
    deprioritized: false,
  };
}

function createEmptySummary(viewerValue: AttestationValue | 0): AttestationSummary {
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

function toAttestationEdgeProjection(
  attestationPacket: PacketEnvelopeByType['Attestation']
): AttestationEdgeProjection {
  return {
    packet: {
      packet_id: attestationPacket.header.packet_id,
    },
    revision: {
      packet_id: attestationPacket.header.packet_id,
      revision_id: attestationPacket.header.revision_id,
    },
    source_actor_key: getActorKeyFromPacket(attestationPacket) ?? '',
    source_actor_packet_id:
      attestationPacket.header.provenance.created_by?.packet_id ?? null,
    target_ref: attestationPacket.body.target_ref,
    attestation_kind: attestationPacket.body.attestation_kind,
    value: attestationPacket.body.value,
    status: attestationPacket.body.status,
    context_ref: attestationPacket.body.context_ref,
    supporting_refs: attestationPacket.body.supporting_refs,
    note: attestationPacket.body.note,
    supersedes_ref: attestationPacket.body.supersedes_ref,
    created_at: attestationPacket.header.created_at,
  };
}

async function getDiscussionForumById(
  packetStore: NodeSQLitePacketStore,
  forumPacketId: string
): Promise<PacketEnvelopeByType['DiscussionForum'] | null> {
  const packet = await packetStore.fetchByPacket({ packet_id: forumPacketId });

  if (!packet || packet.header.family !== 'DiscussionForum') {
    return null;
  }

  return packet as PacketEnvelopeByType['DiscussionForum'];
}

async function getDiscussionThreadById(
  packetStore: NodeSQLitePacketStore,
  threadPacketId: string
): Promise<PacketEnvelopeByType['DiscussionThread'] | null> {
  const packet = await packetStore.fetchByPacket({ packet_id: threadPacketId });

  if (!packet || packet.header.family !== 'DiscussionThread') {
    return null;
  }

  return packet as PacketEnvelopeByType['DiscussionThread'];
}

function getEntryThreadPacketId(
  entryPacket:
    | PacketEnvelopeByType['DiscussionPost']
    | PacketEnvelopeByType['DiscussionReply']
): string {
  return entryPacket.body.thread_ref.packet_id;
}

export class SQLiteAttestationService implements AttestationService {
  private state: AttestationState | null = null;

  constructor(private readonly packetStore: NodeSQLitePacketStore) {}

  async syncDerivedState(): Promise<void> {
    const [attestationPackets, allPackets] = await Promise.all([
      this.packetStore.listPreferredPacketsByFamily('Attestation'),
      this.packetStore.listPreferredPackets(),
    ]);

    const packetMap = new Map(
      allPackets.map((packet) => [packet.header.packet_id, packet])
    );
    const viewerValuesByActor = new Map<string, Map<string, AttestationValue>>();
    const rawSummaryByTarget = new Map<string, AttestationAggregate>();
    const indexRows: AttestationIndexRecord[] = [];

    for (const attestationPacket of attestationPackets) {
      const actorKey = getActorKeyFromPacket(attestationPacket);

      if (!actorKey) {
        continue;
      }

      indexRows.push({
        attestation_packet_id: attestationPacket.header.packet_id,
        target_packet_id: attestationPacket.body.target_ref.packet_id,
        actor_key: actorKey,
        attestation_kind: attestationPacket.body.attestation_kind,
        value: attestationPacket.body.value,
        status: attestationPacket.body.status,
        context_packet_id: attestationPacket.body.context_ref?.packet_id ?? null,
        note: attestationPacket.body.note,
        created_at: attestationPacket.header.created_at,
        updated_at: attestationPacket.header.created_at,
      });

      if (
        attestationPacket.body.status !== 'active' ||
        attestationPacket.body.attestation_kind !== 'packet_signal'
      ) {
        continue;
      }

      const currentSummary =
        rawSummaryByTarget.get(attestationPacket.body.target_ref.packet_id) ?? {
          upvote_count: 0,
          downvote_count: 0,
          net_score: 0,
          total_votes: 0,
          negative_ratio: 0,
          auto_hidden: false,
          deprioritized: false,
        };

      if (attestationPacket.body.value === 1) {
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
        attestationPacket.body.target_ref.packet_id,
        currentSummary
      );

      const actorValues =
        viewerValuesByActor.get(actorKey) ?? new Map<string, AttestationValue>();
      actorValues.set(
        attestationPacket.body.target_ref.packet_id,
        attestationPacket.body.value
      );
      viewerValuesByActor.set(actorKey, actorValues);
    }

    const summaryByTarget = new Map<string, AttestationAggregate>();
    const tallyRows: AttestationTallyIndexRecord[] = [];

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
      attestationPackets,
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

  async setAttestation(input: {
    target_packet_id: string;
    actor_key: string;
    actor_class: DiscussionActorClass;
    authority_scope_id: string | null;
    value: AttestationValue | 0;
    attestation_kind?: string;
    context_packet_id?: string | null;
    supporting_packet_ids?: string[];
    note?: string | null;
  }): Promise<AttestationSummary> {
    await this.syncDerivedState();

    if (!this.state) {
      throw new Error('Attestation state is unavailable.');
    }

    const targetPacket = await this.packetStore.fetchByPacket({
      packet_id: input.target_packet_id,
    });

    if (!targetPacket) {
      throw new Error(`Unknown attestation target: ${input.target_packet_id}`);
    }

    if (
      targetPacket.header.family === 'DiscussionPost' ||
      targetPacket.header.family === 'DiscussionReply'
    ) {
      const entryPacket = targetPacket as
        | PacketEnvelopeByType['DiscussionPost']
        | PacketEnvelopeByType['DiscussionReply'];
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
        threadPacket.body.forum_ref.packet_id
      );

      if (!forumPacket) {
        throw new Error(
          `Missing discussion forum for thread ${threadPacket.header.packet_id}.`
        );
      }

      if (forumPacket.body.forum_kind !== 'visitor_lobby') {
        const actorPacketId = input.actor_key.startsWith('element:')
          ? input.actor_key.slice('element:'.length)
          : null;
        const assemblyPacketId = forumPacket.header.authority_scope_ref?.packet_id ?? null;

        if (!actorPacketId || !assemblyPacketId) {
          throw new Error('Attestations are not open to your current actor class here.');
        }

        const hasMembership = await this.hasActiveAssemblyAssociationClaim({
          actor_packet_id: actorPacketId,
          assembly_packet_id: assemblyPacketId,
        });

        if (!hasMembership) {
          throw new Error('Attestations are not open to your current actor class here.');
        }
      }
    }

    const attestationKind = (input.attestation_kind ??
      'packet_signal') as AttestationKind;
    const attestationPacketId = createAttestationPacketId({
      targetPacketId: input.target_packet_id,
      actorPacketId: input.actor_key.replace(/^element:/, ''),
      attestationKind,
      contextPacketId: input.context_packet_id ?? null,
    });
    const existingPreferredRevision = await this.packetStore.fetchPreferredRevision({
      packet_id: attestationPacketId,
    });
    const existingPacket =
      existingPreferredRevision === null
        ? null
        : await this.packetStore.fetchByRevision(existingPreferredRevision);
    const currentAttestationPacket =
      existingPacket?.header.family === 'Attestation'
        ? (existingPacket as PacketEnvelopeByType['Attestation'])
        : null;
    const nextValue =
      input.value === 0 ? currentAttestationPacket?.body.value ?? 1 : input.value;

    if (input.value === 0 && !currentAttestationPacket) {
      await this.syncDerivedState();
      return this.getTargetSummary({
        target_packet_id: input.target_packet_id,
        viewer_actor_key: input.actor_key,
      });
    }

    const nextPacket = createAttestationPacket({
      packet_id: attestationPacketId,
      revision_id: createNextRevisionId(
        attestationPacketId,
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
      metadata_tags: ['attestation', attestationKind.replace(/_/g, '-')],
      target_ref: { packet_id: input.target_packet_id },
      value: nextValue,
      status: input.value === 0 ? 'cleared' : 'active',
      attestation_kind: attestationKind,
      context_ref: input.context_packet_id
        ? {
            packet_id: input.context_packet_id,
          }
        : null,
      supporting_refs: (input.supporting_packet_ids ?? []).map((packetId) => ({
        packet_id: packetId,
      })),
      note: input.note ?? null,
      supersedes_ref: currentAttestationPacket
        ? {
            packet_id: currentAttestationPacket.header.packet_id,
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

  async persistSignedAttestation(input: {
    attestation_packet: PacketEnvelopeByType['Attestation'];
    actor_packet: PacketEnvelopeByType['Element'];
    actor_key: string;
    actor_class: DiscussionActorClass;
  }): Promise<AttestationSummary> {
    await this.syncDerivedState();

    if (!this.state) {
      throw new Error('Attestation state is unavailable.');
    }

    const { attestation_packet: attestationPacket, actor_packet: actorPacket } = input;
    const expectedPacketId = createAttestationPacketId({
      targetPacketId: attestationPacket.body.target_ref.packet_id,
      actorPacketId: actorPacket.header.packet_id,
      attestationKind: attestationPacket.body.attestation_kind,
      contextPacketId: attestationPacket.body.context_ref?.packet_id ?? null,
    });

    if (attestationPacket.header.packet_id !== expectedPacketId) {
      throw new Error('Attestation packet id does not match the attestation target.');
    }

    if (
      attestationPacket.header.provenance.created_by?.packet_id !==
      actorPacket.header.packet_id
    ) {
      throw new Error('Attestation packet provenance does not match the actor packet.');
    }

    if (
      attestationPacket.header.integrity.embedded_signatures[0]?.signer_packet_ref
        ?.packet_id !== actorPacket.header.packet_id
    ) {
      throw new Error('Attestation packet signature does not match the actor packet.');
    }

    const signatureIsValid = await verifyPacketSignature({
      packet: attestationPacket,
      signerPacket: actorPacket,
    });

    if (!signatureIsValid) {
      throw new Error('Attestation packet signature verification failed.');
    }

    const targetPacket = await this.packetStore.fetchByPacket({
      packet_id: attestationPacket.body.target_ref.packet_id,
    });

    if (!targetPacket) {
      throw new Error(
        `Unknown attestation target: ${attestationPacket.body.target_ref.packet_id}`
      );
    }

    if (
      targetPacket.header.family === 'DiscussionPost' ||
      targetPacket.header.family === 'DiscussionReply'
    ) {
      const entryPacket = targetPacket as
        | PacketEnvelopeByType['DiscussionPost']
        | PacketEnvelopeByType['DiscussionReply'];
      const threadPacket = await getDiscussionThreadById(
        this.packetStore,
        getEntryThreadPacketId(entryPacket)
      );

      if (!threadPacket) {
        throw new Error(
          `Missing discussion thread for packet ${attestationPacket.body.target_ref.packet_id}.`
        );
      }

      const forumPacket = await getDiscussionForumById(
        this.packetStore,
        threadPacket.body.forum_ref.packet_id
      );

      if (!forumPacket) {
        throw new Error(
          `Missing discussion forum for thread ${threadPacket.header.packet_id}.`
        );
      }

      if (forumPacket.body.forum_kind !== 'visitor_lobby') {
        const assemblyPacketId = forumPacket.header.authority_scope_ref?.packet_id ?? null;

        if (!assemblyPacketId) {
          throw new Error('Attestations are not open to your current actor class here.');
        }

        const hasMembership = await this.hasActiveAssemblyAssociationClaim({
          actor_packet_id: actorPacket.header.packet_id,
          assembly_packet_id: assemblyPacketId,
        });

        if (!hasMembership) {
          throw new Error('Attestations are not open to your current actor class here.');
        }
      }
    }

    const existingPreferredRevision = await this.packetStore.fetchPreferredRevision({
      packet_id: attestationPacket.header.packet_id,
    });

    if (!existingPreferredRevision && attestationPacket.body.status === 'cleared') {
      await this.syncDerivedState();

      return this.getTargetSummary({
        target_packet_id: attestationPacket.body.target_ref.packet_id,
        viewer_actor_key: input.actor_key,
      });
    }

    await this.packetStore.writeRevision(attestationPacket);
    await this.packetStore.publishRevision({
      packet_id: attestationPacket.header.packet_id,
      revision_id: attestationPacket.header.revision_id,
    });
    await this.syncDerivedState();

    return this.getTargetSummary({
      target_packet_id: attestationPacket.body.target_ref.packet_id,
      viewer_actor_key: input.actor_key,
    });
  }

  async getTargetSummary(input: {
    target_packet_id: string;
    viewer_actor_key: string | null;
  }): Promise<AttestationSummary> {
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

  async listTargetAttestations(input: {
    target_packet_id: string;
    attestation_kind?: string | null;
    context_packet_id?: string | null;
    active_only?: boolean;
  }): Promise<AttestationEdgeProjection[]> {
    if (!this.state) {
      await this.syncDerivedState();
    }

    return (this.state?.attestationPackets ?? [])
      .filter(
        (attestationPacket) =>
          attestationPacket.body.target_ref.packet_id === input.target_packet_id
      )
      .filter((attestationPacket) =>
        input.attestation_kind
          ? attestationPacket.body.attestation_kind === input.attestation_kind
          : true
      )
      .filter((attestationPacket) =>
        input.context_packet_id
          ? attestationPacket.body.context_ref?.packet_id === input.context_packet_id
          : true
      )
      .filter((attestationPacket) =>
        input.active_only === false
          ? true
          : attestationPacket.body.status === 'active'
      )
      .sort((leftPacket, rightPacket) =>
        rightPacket.header.created_at.localeCompare(leftPacket.header.created_at)
      )
      .map(toAttestationEdgeProjection);
  }

  async listActorAttestations(input: {
    actor_key: string;
    attestation_kind?: string | null;
    active_only?: boolean;
  }): Promise<AttestationEdgeProjection[]> {
    if (!this.state) {
      await this.syncDerivedState();
    }

    return (this.state?.attestationPackets ?? [])
      .filter(
        (attestationPacket) => getActorKeyFromPacket(attestationPacket) === input.actor_key
      )
      .filter((attestationPacket) =>
        input.attestation_kind
          ? attestationPacket.body.attestation_kind === input.attestation_kind
          : true
      )
      .filter((attestationPacket) =>
        input.active_only === false
          ? true
          : attestationPacket.body.status === 'active'
      )
      .sort((leftPacket, rightPacket) =>
        rightPacket.header.created_at.localeCompare(leftPacket.header.created_at)
      )
      .map(toAttestationEdgeProjection);
  }

  async listAssemblyAssociationClaimsForActor(
    actor_packet_id: string
  ): Promise<AssemblyAssociationClaimProjection[]> {
    if (!this.state) {
      await this.syncDerivedState();
    }

    const actorKey = `element:${actor_packet_id}`;
    const actorClaims = await this.listActorAttestations({
      actor_key: actorKey,
      attestation_kind: 'assembly_association_claim',
      active_only: false,
    });

    return actorClaims
      .map((claim) => {
        const assemblyPacket = this.state?.packetMap.get(claim.target_ref.packet_id);
        const supportingByOthers = (this.state?.attestationPackets ?? []).filter(
          (attestationPacket) =>
            attestationPacket.body.attestation_kind === 'identity_attest' &&
            attestationPacket.body.target_ref.packet_id === actor_packet_id &&
            attestationPacket.body.context_ref?.packet_id === claim.target_ref.packet_id &&
            getActorKeyFromPacket(attestationPacket) !== actorKey &&
            attestationPacket.body.status === 'active'
        ).length;

        return {
          assembly_packet_id: claim.target_ref.packet_id,
          assembly_name:
            assemblyPacket?.header.family === 'Element'
              ? (assemblyPacket as PacketEnvelopeByType['Element']).body.name
              : claim.target_ref.packet_id,
          claim_packet_id: claim.packet.packet_id,
          status: claim.status,
          note: claim.note,
          created_at: claim.created_at,
          supported_by_other_count: supportingByOthers,
          is_self_issued_only: supportingByOthers === 0,
          is_current: claim.status === 'active',
        } satisfies AssemblyAssociationClaimProjection;
      })
      .sort((leftClaim, rightClaim) =>
        rightClaim.created_at.localeCompare(leftClaim.created_at)
      );
  }

  async hasActiveAssemblyAssociationClaim(input: {
    actor_packet_id: string;
    assembly_packet_id: string;
  }): Promise<boolean> {
    if (!this.state) {
      await this.syncDerivedState();
    }

    return (this.state?.attestationPackets ?? []).some(
      (attestationPacket) =>
        attestationPacket.body.attestation_kind === 'assembly_association_claim' &&
        attestationPacket.body.target_ref.packet_id === input.assembly_packet_id &&
        attestationPacket.body.status === 'active' &&
        getActorKeyFromPacket(attestationPacket) ===
          `element:${input.actor_packet_id}`
    );
  }

  private persistDerivedState(input: {
    indexRows: AttestationIndexRecord[];
    tallyRows: AttestationTallyIndexRecord[];
  }): void {
    const database = new DatabaseSync(this.packetStore.databasePath);

    try {
      database.exec('BEGIN IMMEDIATE');
      database.exec('DELETE FROM attestation_index');
      database.exec('DELETE FROM attestation_tally_index');

      const insertIndexStatement = database.prepare(`
        INSERT INTO attestation_index (
          attestation_packet_id,
          target_packet_id,
          actor_key,
          attestation_kind,
          value,
          status,
          context_packet_id,
          note,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertTallyStatement = database.prepare(`
        INSERT INTO attestation_tally_index (
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
          row.attestation_packet_id,
          row.target_packet_id,
          row.actor_key,
          row.attestation_kind,
          row.value,
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
