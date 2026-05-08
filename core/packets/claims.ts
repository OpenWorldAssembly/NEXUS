/**
 * File: claims.ts
 * Description: Portable claim-packet helpers for scoped role and assembly associations.
 */

import type {
  ClaimKind,
  PacketEnvelopeByType,
  PacketRevisionRef,
  PacketRef,
} from '../schema/packet-schema.ts';
import {
  createPacketEnvelope,
  getPacketCurrentSchemaVersion,
} from '../schema/packet-schema.ts';
import { createClaimPacket } from './builders.ts';

function encodePacketId(packetId: string): string {
  return encodeURIComponent(packetId);
}

export function createClaimPacketId(input: {
  claimKind: ClaimKind;
  subjectPacketId: string;
  targetPacketId: string;
  scopePacketId: string;
}): string {
  return `nexus:claim/${input.claimKind}/${encodePacketId(
    input.subjectPacketId
  )}--${encodePacketId(input.targetPacketId)}--${encodePacketId(input.scopePacketId)}`;
}

function createGenericRelationAssertionClaimPacketId(input: {
  claimKind: string;
  subjectPacketId: string;
  targetPacketId: string;
  scopePacketId: string;
}): string {
  return `nexus:claim/${input.claimKind}/${encodePacketId(
    input.subjectPacketId
  )}--${encodePacketId(input.targetPacketId)}--${encodePacketId(input.scopePacketId)}`;
}

export function createClaimRevisionId(
  packetId: string,
  currentRevisionId?: string | null
): string {
  const match = currentRevisionId?.match(/@r(\d+)$/);
  const revisionNumber = match ? Number.parseInt(match[1], 10) + 1 : 1;

  return `${packetId}@r${revisionNumber}`;
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

export function createAssociationClaimPacket(input: {
  claimKind: ClaimKind;
  subjectPacketId: string;
  targetPacketId: string;
  scopePacketId: string;
  applicableScopeRefs: PacketRef[];
  createdByPacketId: string;
  createdAt?: string;
  note?: string | null;
  status?: 'active' | 'withdrawn';
  packetId?: string;
  parentRevisionRefs?: PacketRevisionRef[];
}): PacketEnvelopeByType['Claim'] {
  const packetId =
    input.packetId ??
    createClaimPacketId({
      claimKind: input.claimKind,
      subjectPacketId: input.subjectPacketId,
      targetPacketId: input.targetPacketId,
      scopePacketId: input.scopePacketId,
    });
  const createdAt = input.createdAt ?? new Date().toISOString();

  const header = {
    packet_id: packetId,
    revision_id: createClaimRevisionId(
      packetId,
      input.parentRevisionRefs?.[0]?.revision_id ?? null
    ),
    family: 'Claim' as const,
    schema_version: getPacketCurrentSchemaVersion('Claim'),
    protocol_version: '1.0.0',
    created_at: createdAt,
    parent_revision_refs: input.parentRevisionRefs ?? [],
    merge_strategy: null,
    authority_scope_ref: {
      packet_id: input.scopePacketId,
    },
    applicable_scope_refs: dedupeScopeRefs([
      {
        packet_id: input.scopePacketId,
      },
      ...input.applicableScopeRefs,
    ]),
    edges: [],
    provenance: {
      created_by: {
        packet_id: input.createdByPacketId,
      },
      submitted_by: null,
      recorded_at: createdAt,
      adapter: 'nexus-web',
      imported_from_revision: null,
    },
    moderation: {
      visibility: 'public' as const,
      moderation_state: 'open' as const,
      policy_refs: [],
      content_warning_ids: [],
    },
    external_refs: [],
    metadata: {
      tags: ['claim', input.claimKind.replace(/_/g, '-')],
      language: null,
      summary: null,
    },
    producer: {
      adapter: 'nexus-web',
      app_version: null,
    },
  };

  return createPacketEnvelope<'Claim'>({
    header,
    body: {
      type: 'claim',
      subtype: 'relation_assertion',
      target_ref: {
        packet_id: input.targetPacketId,
      },
      subject_ref: {
        packet_id: input.subjectPacketId,
      },
      scope_ref: {
        packet_id: input.scopePacketId,
      },
      claim_markdown: input.note ?? null,
      supporting_refs: [],
      relation_assertion: {
        subtype: input.claimKind,
        subject_ref: {
          packet_id: input.subjectPacketId,
        },
        target_ref: {
          packet_id: input.targetPacketId,
        },
        scope_ref: {
          packet_id: input.scopePacketId,
        },
      },
      claim_kind: input.claimKind,
      status: input.status ?? 'active',
      note: input.note ?? null,
    },
  });
}

export function createRelationAssertionClaimPacket(input: {
  claimKind: ClaimKind | string;
  subjectPacketId: string;
  relationPacketId: string;
  assertedTargetPacketId: string;
  scopePacketId: string;
  applicableScopeRefs: PacketRef[];
  createdByPacketId: string;
  createdAt?: string;
  note?: string | null;
  status?: 'active' | 'withdrawn';
  packetId?: string;
  parentRevisionRefs?: PacketRevisionRef[];
}): PacketEnvelopeByType['Claim'] {
  const packetId =
    input.packetId ??
    createGenericRelationAssertionClaimPacketId({
      claimKind: input.claimKind,
      subjectPacketId: input.subjectPacketId,
      targetPacketId: input.assertedTargetPacketId,
      scopePacketId: input.scopePacketId,
    });
  const createdAt = input.createdAt ?? new Date().toISOString();

  return createClaimPacket({
    packet_id: packetId,
    revision_id: createClaimRevisionId(
      packetId,
      input.parentRevisionRefs?.[0]?.revision_id ?? null
    ),
    created_at: createdAt,
    parent_revision_refs: input.parentRevisionRefs ?? [],
    authority_scope_ref: {
      packet_id: input.scopePacketId,
    },
    applicable_scope_refs: dedupeScopeRefs([
      {
        packet_id: input.scopePacketId,
      },
      ...input.applicableScopeRefs,
    ]),
    created_by: {
      packet_id: input.createdByPacketId,
    },
    metadata_tags: ['claim', String(input.claimKind).replace(/_/g, '-')],
    subtype: 'relation_assertion',
    target_ref: {
      packet_id: input.relationPacketId,
    },
    subject_ref: {
      packet_id: input.subjectPacketId,
    },
    scope_ref: {
      packet_id: input.scopePacketId,
    },
    claim_markdown: input.note ?? null,
    supporting_refs: [],
    relation_assertion: {
      subtype: input.claimKind,
      subject_ref: {
        packet_id: input.subjectPacketId,
      },
      target_ref: {
        packet_id: input.assertedTargetPacketId,
      },
      scope_ref: {
        packet_id: input.scopePacketId,
      },
    },
    claim_kind:
      input.claimKind === 'assembly_association' ||
      input.claimKind === 'home_locality' ||
      input.claimKind === 'role_association'
        ? input.claimKind
        : null,
    status: input.status ?? 'active',
    note: input.note ?? null,
  });
}
