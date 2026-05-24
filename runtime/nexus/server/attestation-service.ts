/**
 * File: attestation-service.ts
 * Description: Projects and mutates canonical attestation packets across discussions and association flows.
 */

import { DatabaseSync } from 'node:sqlite';

import { createAttestationPacket } from '@core/packets/builders';
import {
  isDiscussionMessagePacket,
  type DiscussionLegacyType,
} from '@core/packets/discussion-compat';
import { interpretPacket } from '@core/packets/packet-interpreter';
import { resolvePacketTarget } from '@core/packets/packet-target-resolver';
import type {
  AssociationClaimProjection,
  AssociationRelationProjection,
  AttestationEdgeProjection,
  AttestationService,
  AttestationSummary,
} from '@core/contracts';
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
  filterRelationPackets,
  listRelationPackets,
} from '@runtime/nexus/server/relation-utils';
import {
  createAttestationPacketId,
  resolveDiscussionScopePacketId,
} from '@runtime/nexus/discussion-packets';
import type {
  AttestationIndexRecord,
  AttestationTallyIndexRecord,
} from '@runtime/storage/sqlite-records';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

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
  attestationPacket: PacketEnvelopeByType['Attestation'],
  packetMap: Map<string, PacketEnvelope>
): AttestationEdgeProjection {
  const sourceActorPacketId =
    attestationPacket.header.provenance.created_by?.packet_id ?? null;
  const sourceActorPacket =
    sourceActorPacketId !== null ? packetMap.get(sourceActorPacketId) : null;

  return {
    packet: {
      packet_id: attestationPacket.header.packet_id,
    },
    revision: {
      packet_id: attestationPacket.header.packet_id,
      revision_id: attestationPacket.header.revision_id,
    },
    source_actor_key: getActorKeyFromPacket(attestationPacket) ?? '',
    source_actor_packet_id: sourceActorPacketId,
    source_actor_label:
      sourceActorPacket?.header.type === 'Element'
        ? (sourceActorPacket as PacketEnvelopeByType['Element']).body.name
        : null,
    authority_scope_packet_id:
      attestationPacket.header.authority_scope_ref?.packet_id ?? null,
    target_ref: attestationPacket.body.target_ref,
    attestation_kind: attestationPacket.body.subtype,
    value: attestationPacket.body.value,
    status: attestationPacket.body.status,
    context_ref: attestationPacket.body.context_ref,
    supporting_refs: attestationPacket.body.supporting_refs,
    note: attestationPacket.body.note,
    supersedes_ref: attestationPacket.body.supersedes_ref,
    created_at: attestationPacket.header.created_at,
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

  if (
    packet.header.type === 'Discussion' ||
    packet.header.type === 'Discussion'
  ) {
    return packet as
      | PacketEnvelopeByType['Discussion']
      | PacketEnvelopeByType['Discussion'];
  }

  return null;
}

export class SQLiteAttestationService implements AttestationService {
  private state: AttestationState | null = null;
  private readonly packetStore: NodeSQLitePacketStore;

  constructor(packetStore: NodeSQLitePacketStore) {
    this.packetStore = packetStore;
  }

  async syncDerivedState(): Promise<void> {
    const [attestationPackets, allPackets] = await Promise.all([
      this.packetStore.listPreferredPacketsByType('Attestation'),
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
        attestation_kind: attestationPacket.body.subtype,
        value: attestationPacket.body.value,
        status: attestationPacket.body.status,
        context_packet_id: attestationPacket.body.context_ref?.packet_id ?? null,
        note: attestationPacket.body.note,
        created_at: attestationPacket.header.created_at,
        updated_at: attestationPacket.header.created_at,
      });

      if (
        attestationPacket.body.status !== 'active' ||
        attestationPacket.body.subtype !== 'packet_signal'
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
          throw new Error('Attestations are not open to your current actor class here.');
        }

        const hasMembership = await this.hasActiveAssociationRelation({
          actor_packet_id: actorPacketId,
          target_packet_id: assemblyPacketId,
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
      existingPacket?.header.type === 'Attestation'
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
      subtype: attestationKind,
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
      attestationKind: attestationPacket.body.subtype,
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

    const entryPacket = toLegacyDiscussionEntry(targetPacket);

    if (entryPacket) {
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
          throw new Error('Attestations are not open to your current actor class here.');
        }

        const hasMembership = await this.hasActiveAssociationRelation({
          actor_packet_id: actorPacket.header.packet_id,
          target_packet_id: assemblyPacketId,
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
          ? attestationPacket.body.subtype === input.attestation_kind
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
      .map((attestationPacket) =>
        toAttestationEdgeProjection(attestationPacket, this.state?.packetMap ?? new Map())
      );
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
          ? attestationPacket.body.subtype === input.attestation_kind
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
      .map((attestationPacket) =>
        toAttestationEdgeProjection(attestationPacket, this.state?.packetMap ?? new Map())
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
          await this.listTargetAttestations({
            target_packet_id: relationPacket.header.packet_id,
            attestation_kind: 'claim_support',
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
          await this.listTargetAttestations({
            target_packet_id: claimPacket.header.packet_id,
            attestation_kind: 'claim_support',
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
