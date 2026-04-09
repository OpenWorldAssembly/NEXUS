/**
 * File: contracts.ts
 * Description: Declares the core packet-store and query-service interfaces for OWA.
 */

import type {
  PacketEdge,
  PacketEnvelope,
  PacketFamily,
  PacketMergeStrategy,
  PacketRevisionState,
  PacketRef,
  PacketRevisionRef,
} from '@/domain/schema/packet-schema';

export interface PacketEdgeQuery {
  direction?: 'incoming' | 'outgoing' | 'both';
  edge_types?: string[];
}

export interface RevisionComparison {
  base: PacketRevisionRef;
  head: PacketRevisionRef;
  changed_header_fields: string[];
  changed_body_fields: string[];
}

export interface BundleExportResult {
  bytes: Uint8Array;
  packet_count: number;
  revision_count: number;
}

export interface BundleImportResult {
  packet_count: number;
  revision_count: number;
  edge_count: number;
}

export interface PacketHeadStatus {
  preferred_revision: PacketRevisionRef | null;
  head_revisions: PacketRevisionRef[];
  revision_state: PacketRevisionState;
}

export interface PacketStore {
  validate(input: unknown): PacketEnvelope;
  writeRevision(packet: PacketEnvelope): Promise<PacketRevisionRef>;
  publishRevision(revision: PacketRevisionRef): Promise<void>;
  fetchByPacket(packet: PacketRef): Promise<PacketEnvelope | null>;
  fetchByRevision(revision: PacketRevisionRef): Promise<PacketEnvelope | null>;
  fetchPreferredRevision(packet: PacketRef): Promise<PacketRevisionRef | null>;
  fetchRevisionHeads(packet: PacketRef): Promise<PacketHeadStatus>;
  queryEdges(packet: PacketRef, query?: PacketEdgeQuery): Promise<PacketEdge[]>;
  mergeRevisions(input: {
    packet: PacketRef;
    parent_revisions: PacketRevisionRef[];
    strategy: PacketMergeStrategy;
    merged_packet: PacketEnvelope;
  }): Promise<PacketRevisionRef>;
  importBundle(bundle: Uint8Array | ArrayBuffer | string): Promise<BundleImportResult>;
  exportBundle(packet_refs: PacketRef[]): Promise<BundleExportResult>;
}

export interface BrowserPacketProjection {
  packet: PacketRef;
  revision: PacketRevisionRef;
  family: PacketFamily;
  label: string;
  title: string;
  summary: string | null;
}

export interface BrowserQueryService {
  getPacket(packet: PacketRef): Promise<BrowserPacketProjection | null>;
  getRevisionHeads(packet: PacketRef): Promise<PacketHeadStatus>;
  listIncomingLinks(packet: PacketRef): Promise<PacketEdge[]>;
  listOutgoingLinks(packet: PacketRef): Promise<PacketEdge[]>;
  compareRevisions(
    base: PacketRevisionRef,
    head: PacketRevisionRef
  ): Promise<RevisionComparison>;
}

export interface NexusScopeLens {
  authority_scope_ref: PacketRef | null;
  applicable_scope_refs: PacketRef[];
}

export interface NexusPacketCardProjection {
  packet: PacketRef;
  revision: PacketRevisionRef;
  family: PacketFamily;
  label: string;
  title: string;
  summary: string | null;
  status: string | null;
}

export interface NexusQueryService {
  getDashboardQueue(lens: NexusScopeLens): Promise<NexusPacketCardProjection[]>;
  listVotes(lens: NexusScopeLens): Promise<NexusPacketCardProjection[]>;
  listDiscussions(lens: NexusScopeLens): Promise<NexusPacketCardProjection[]>;
  listLibraryPackets(
    lens: NexusScopeLens,
    family?: PacketFamily
  ): Promise<NexusPacketCardProjection[]>;
}
