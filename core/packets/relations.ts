/**
 * File: relations.ts
 * Description: Portable relation-packet helpers for deterministic relation ids and revisions.
 */

import type {
  PacketEnvelopeByType,
  PacketRevisionRef,
  PacketRef,
  RelationStatus,
} from '../schema/packet-schema.ts';
import { createRelationPacket } from './builders.ts';

function encodePacketId(packetId: string): string {
  return encodeURIComponent(packetId);
}

function dedupeScopeRefs(scopeRefs: PacketRef[]): PacketRef[] {
  const seenPacketIds = new Set<string>();

  return scopeRefs.filter((scopeRef) => {
    if (seenPacketIds.has(scopeRef.packet_id)) {
      return false;
    }

    seenPacketIds.add(scopeRef.packet_id);
    return true;
  });
}

export function createRelationPacketId(input: {
  subtype: string;
  subjectPacketId: string;
  targetPacketId: string;
  scopePacketId?: string | null;
}): string {
  return `nexus:relation/${input.subtype}/${encodePacketId(
    input.subjectPacketId
  )}--${encodePacketId(input.targetPacketId)}--${encodePacketId(
    input.scopePacketId ?? 'none'
  )}`;
}

export function createRelationRevisionId(
  packetId: string,
  currentRevisionId?: string | null
): string {
  const match = currentRevisionId?.match(/@r(\d+)$/);
  const revisionNumber = match ? Number.parseInt(match[1], 10) + 1 : 1;

  return `${packetId}@r${revisionNumber}`;
}

export function createScopedRelationPacket(input: {
  subtype: string;
  subjectPacketId: string;
  targetPacketId: string;
  scopePacketId?: string | null;
  applicableScopeRefs?: PacketRef[];
  createdByPacketId: string;
  createdAt?: string;
  note?: string | null;
  status?: RelationStatus;
  packetId?: string;
  parentRevisionRefs?: PacketRevisionRef[];
  supportingRefs?: PacketRef[];
  policyRef?: PacketRef | null;
  termsRef?: PacketRef | null;
}): PacketEnvelopeByType['Relation'] {
  const packetId =
    input.packetId ??
    createRelationPacketId({
      subtype: input.subtype,
      subjectPacketId: input.subjectPacketId,
      targetPacketId: input.targetPacketId,
      scopePacketId: input.scopePacketId ?? null,
    });
  const createdAt = input.createdAt ?? new Date().toISOString();
  const scopeRefs = input.scopePacketId
    ? dedupeScopeRefs([
        {
          packet_id: input.scopePacketId,
        },
        ...(input.applicableScopeRefs ?? []),
      ])
    : dedupeScopeRefs(input.applicableScopeRefs ?? []);

  return createRelationPacket({
    packet_id: packetId,
    revision_id: createRelationRevisionId(
      packetId,
      input.parentRevisionRefs?.[0]?.revision_id ?? null
    ),
    created_at: createdAt,
    parent_revision_refs: input.parentRevisionRefs ?? [],
    authority_scope_ref: input.scopePacketId
      ? {
          packet_id: input.scopePacketId,
        }
      : null,
    applicable_scope_refs: scopeRefs,
    created_by: {
      packet_id: input.createdByPacketId,
    },
    metadata_tags: ['relation', input.subtype.replace(/_/g, '-')],
    subtype: input.subtype,
    subject_ref: {
      packet_id: input.subjectPacketId,
    },
    target_ref: {
      packet_id: input.targetPacketId,
    },
    scope_ref: input.scopePacketId
      ? {
          packet_id: input.scopePacketId,
        }
      : null,
    status: input.status ?? 'active',
    supporting_refs: input.supportingRefs ?? [],
    policy_ref: input.policyRef ?? null,
    terms_ref: input.termsRef ?? null,
    note: input.note ?? null,
  });
}
