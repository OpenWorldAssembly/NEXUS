/**
 * File: definition-packet-revisions.ts
 * Description: Generic runtime helpers for reading and writing definition-backed single-packet revisions.
 */

import { createHash } from 'node:crypto';

import type { PacketStore } from '@core/contracts';
import {
  createPacket,
  createPacketRef,
  createPacketRevisionRef,
} from '@core/packets/builders';
import type {
  PacketBodyByType,
  PacketEnvelope,
  PacketEnvelopeByType,
  PacketHeader,
  PacketMergeStrategy,
  PacketRef,
  PacketRevisionRef,
  PacketType,
} from '@core/schema/packet-schema';

export type DefinitionPacketRevisionReadInput = {
  packetStore: PacketStore;
  packetId: string;
  packetType: PacketType;
  packetSubtype?: string | null;
};

export type DefinitionPacketRevisionWriteInput<TType extends PacketType> = {
  packetStore: PacketStore;
  packetType: TType;
  packetId: string;
  schemaVersion?: string | null;
  body: PacketBodyByType[TType];
  actorPacketId?: string | null;
  createdAt: string;
  parentRevisionRef?: PacketRevisionRef | null;
  authorityScopeRef?: PacketRef | null;
  applicableScopeRefs?: PacketRef[];
  mergeStrategy?: PacketMergeStrategy | null;
  visibility?: PacketHeader['moderation']['visibility'];
  moderationState?: PacketHeader['moderation']['moderation_state'];
  metadataTags?: string[];
  metadataSummary?: string | null;
  adapter?: string;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function getPacketSubtype(packet: PacketEnvelope): string | null {
  const body = packet.body as Record<string, unknown>;
  return typeof body.subtype === 'string' ? body.subtype : null;
}

function isPacketType<TType extends PacketType>(
  packet: PacketEnvelope | null,
  packetType: TType,
  packetSubtype?: string | null
): packet is PacketEnvelopeByType[TType] {
  if (!packet || packet.header.type !== packetType) {
    return false;
  }

  if (packetSubtype === undefined || packetSubtype === null) {
    return true;
  }

  return getPacketSubtype(packet) === packetSubtype;
}

export function createDefinitionPacketRevisionId<TType extends PacketType>(
  input: Omit<DefinitionPacketRevisionWriteInput<TType>, 'packetStore'>
): string {
  const digest = createHash('sha256')
    .update(
      stableJson({
        packet_id: input.packetId,
        type: input.packetType,
        schema_version: input.schemaVersion ?? null,
        created_at: input.createdAt,
        parent_revision_ref: input.parentRevisionRef ?? null,
        body: input.body,
      })
    )
    .digest('hex')
    .slice(0, 24);

  return `${input.packetId}@r-${digest}`;
}

export async function readLatestDefinitionPacketRevision<TType extends PacketType>(
  input: DefinitionPacketRevisionReadInput & { packetType: TType }
): Promise<PacketEnvelopeByType[TType] | null> {
  const packet = await input.packetStore.fetchByPacket(
    createPacketRef(input.packetId)
  );

  return isPacketType(packet, input.packetType, input.packetSubtype)
    ? packet
    : null;
}

export async function writeDefinitionPacketRevision<TType extends PacketType>(
  input: DefinitionPacketRevisionWriteInput<TType>
): Promise<PacketRevisionRef> {
  const actorRef = input.actorPacketId
    ? createPacketRef(input.actorPacketId)
    : null;
  const revisionId = createDefinitionPacketRevisionId(input);
  const packet = createPacket({
    type: input.packetType,
    packet_id: input.packetId,
    revision_id: revisionId,
    schema_version: input.schemaVersion ?? undefined,
    created_at: input.createdAt,
    parent_revision_refs: input.parentRevisionRef
      ? [input.parentRevisionRef]
      : [],
    merge_strategy: input.mergeStrategy ?? 'supersedes',
    authority_scope_ref: input.authorityScopeRef ?? null,
    applicable_scope_refs: input.applicableScopeRefs ?? [],
    created_by: actorRef,
    submitted_by: actorRef,
    adapter: input.adapter ?? 'runtime.definition_packet_revision',
    visibility: input.visibility ?? 'private',
    moderation_state: input.moderationState ?? 'open',
    metadata_tags: input.metadataTags ?? [],
    metadata_summary: input.metadataSummary ?? null,
    body: input.body,
  });

  const revisionRef = await input.packetStore.writeRevision(packet);
  await input.packetStore.publishRevision(revisionRef);

  return createPacketRevisionRef(
    revisionRef.packet_id,
    revisionRef.revision_id
  );
}
