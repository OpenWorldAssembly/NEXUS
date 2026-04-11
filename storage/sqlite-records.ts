/**
 * File: sqlite-records.ts
 * Description: Projects packet envelopes into SQLite rows for packets, revisions, edges, and query indices.
 */

import {
  getPacketDisplayLabel,
  getPacketStatus,
  getPacketSummary,
  getPacketTitle,
} from '@/domain/projections/labels';
import type {
  PacketEnvelope,
  PacketRevisionState,
} from '@/domain/schema/packet-schema';

export interface PacketRecord {
  packet_id: string;
  family: string;
  preferred_revision_id: string | null;
  head_revision_ids_json: string;
  revision_state: PacketRevisionState;
  schema_version: string;
  created_at: string;
  updated_at: string;
  authority_scope_packet_id: string | null;
  preferred_revision_json: string | null;
}

export interface PacketRevisionRecord {
  revision_id: string;
  packet_id: string;
  family: string;
  schema_version: string;
  protocol_version: string;
  parent_revision_refs_json: string;
  merge_strategy: string | null;
  created_at: string;
  authority_scope_packet_id: string | null;
  applicable_scope_refs_json: string;
  edges_json: string;
  provenance_json: string;
  integrity_json: string;
  moderation_json: string;
  external_refs_json: string;
  metadata_json: string;
  producer_json: string;
  header_json: string;
  body_json: string;
  revision_json: string;
}

export interface PacketEdgeRecord {
  source_revision_id: string;
  source_packet_id: string;
  source_family: string;
  edge_type: string;
  target_packet_id: string;
  created_at: string;
  metadata_json: string;
}

export interface PacketSearchIndexRecord {
  packet_id: string;
  revision_id: string;
  family: string;
  label: string;
  title: string;
  summary: string | null;
  status: string | null;
  authority_scope_packet_id: string | null;
  applicable_scope_ids_json: string;
  tags_json: string;
  created_at: string;
}

export interface AttestationIndexRecord {
  attestation_packet_id: string;
  target_packet_id: string;
  actor_key: string;
  attestation_kind: string;
  value: number;
  status: string;
  context_packet_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttestationTallyIndexRecord {
  target_packet_id: string;
  upvote_count: number;
  downvote_count: number;
  net_score: number;
  total_votes: number;
  negative_ratio: number;
  auto_hidden: number;
  deprioritized: number;
}

export interface DiscussionPostIndexRecord {
  post_packet_id: string;
  thread_packet_id: string;
  root_post_packet_id: string;
  reply_to_packet_id: string | null;
  depth: number;
  author_key: string | null;
  created_at: string;
  last_activity_at: string;
  direct_reply_count: number;
  descendant_count: number;
}

export interface DiscussionActorLedgerRecord {
  actor_key: string;
  earned_reply_points: number;
  spent_top_level_points: number;
  available_points: number;
  negative_content_count: number;
  trust_signal_score: number;
  last_activity_at: string | null;
}

export interface PacketRecordOptions {
  first_seen_at?: string;
  preferred_revision_id?: string | null;
  head_revision_ids?: string[];
  revision_state?: PacketRevisionState;
  preferred_revision_json?: string | null;
}

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Inputs: a packet envelope plus optional packet-head overrides.
 * Output: a normalized row for the mutable `packets` head table.
 */
export function projectPacketRecord(
  packet: PacketEnvelope,
  options?: PacketRecordOptions
): PacketRecord {
  return {
    packet_id: packet.header.packet_id,
    family: packet.header.family,
    preferred_revision_id:
      options?.preferred_revision_id ?? packet.header.revision_id,
    head_revision_ids_json: stringify(
      options?.head_revision_ids ?? [packet.header.revision_id]
    ),
    revision_state: options?.revision_state ?? 'linear',
    schema_version: packet.header.schema_version,
    created_at: options?.first_seen_at ?? packet.header.created_at,
    updated_at: packet.header.created_at,
    authority_scope_packet_id: packet.header.authority_scope_ref?.packet_id ?? null,
    preferred_revision_json:
      options?.preferred_revision_json ?? stringify(packet),
  };
}

/**
 * Inputs: a canonical packet envelope.
 * Output: a normalized row for the immutable `packet_revisions` table.
 */
export function projectPacketRevisionRecord(
  packet: PacketEnvelope
): PacketRevisionRecord {
  return {
    revision_id: packet.header.revision_id,
    packet_id: packet.header.packet_id,
    family: packet.header.family,
    schema_version: packet.header.schema_version,
    protocol_version: packet.header.protocol_version,
    parent_revision_refs_json: stringify(packet.header.parent_revision_refs),
    merge_strategy: packet.header.merge_strategy,
    created_at: packet.header.created_at,
    authority_scope_packet_id: packet.header.authority_scope_ref?.packet_id ?? null,
    applicable_scope_refs_json: stringify(packet.header.applicable_scope_refs),
    edges_json: stringify(packet.header.edges),
    provenance_json: stringify(packet.header.provenance),
    integrity_json: stringify(packet.header.integrity),
    moderation_json: stringify(packet.header.moderation),
    external_refs_json: stringify(packet.header.external_refs),
    metadata_json: stringify(packet.header.metadata),
    producer_json: stringify(packet.header.producer),
    header_json: stringify(packet.header),
    body_json: stringify(packet.body),
    revision_json: stringify(packet),
  };
}

/**
 * Inputs: a canonical packet envelope.
 * Output: one normalized edge row per header edge.
 */
export function projectPacketEdgeRecords(
  packet: PacketEnvelope
): PacketEdgeRecord[] {
  return packet.header.edges.map((edge) => ({
    source_revision_id: packet.header.revision_id,
    source_packet_id: packet.header.packet_id,
    source_family: packet.header.family,
    edge_type: edge.edge_type,
    target_packet_id: edge.target.packet_id,
    created_at: packet.header.created_at,
    metadata_json: stringify(edge.metadata),
  }));
}

/**
 * Inputs: a canonical packet envelope.
 * Output: a flattened search/index row for scope and family queries.
 */
export function projectPacketSearchIndexRecord(
  packet: PacketEnvelope
): PacketSearchIndexRecord {
  return {
    packet_id: packet.header.packet_id,
    revision_id: packet.header.revision_id,
    family: packet.header.family,
    label: getPacketDisplayLabel(packet),
    title: getPacketTitle(packet),
    summary: getPacketSummary(packet),
    status: getPacketStatus(packet),
    authority_scope_packet_id: packet.header.authority_scope_ref?.packet_id ?? null,
    applicable_scope_ids_json: stringify(
      packet.header.applicable_scope_refs.map((scopeRef) => scopeRef.packet_id)
    ),
    tags_json: stringify(packet.header.metadata.tags),
    created_at: packet.header.created_at,
  };
}
