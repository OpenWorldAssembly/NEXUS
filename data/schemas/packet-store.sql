-- File: packet-store.sql
-- Description: Defines the first OWA SQLite packet store using stable packets, immutable revisions, and normalized edges.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS packets (
  packet_id TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  preferred_revision_id TEXT,
  head_revision_ids_json TEXT NOT NULL,
  revision_state TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  authority_scope_packet_id TEXT,
  preferred_revision_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_packets_family_updated
  ON packets(family, updated_at DESC);

CREATE TABLE IF NOT EXISTS packet_revisions (
  revision_id TEXT PRIMARY KEY,
  packet_id TEXT NOT NULL,
  family TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  protocol_version TEXT NOT NULL,
  parent_revision_refs_json TEXT NOT NULL,
  merge_strategy TEXT,
  created_at TEXT NOT NULL,
  authority_scope_packet_id TEXT,
  applicable_scope_refs_json TEXT NOT NULL,
  edges_json TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  integrity_json TEXT NOT NULL,
  moderation_json TEXT NOT NULL,
  external_refs_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  producer_json TEXT NOT NULL,
  header_json TEXT NOT NULL,
  body_json TEXT NOT NULL,
  revision_json TEXT NOT NULL,
  FOREIGN KEY (packet_id) REFERENCES packets(packet_id)
);

CREATE INDEX IF NOT EXISTS idx_packet_revisions_packet_created
  ON packet_revisions(packet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_packet_revisions_family_created
  ON packet_revisions(family, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_packet_revisions_authority_scope
  ON packet_revisions(authority_scope_packet_id)
  WHERE authority_scope_packet_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS packet_edges (
  source_revision_id TEXT NOT NULL,
  source_packet_id TEXT NOT NULL,
  source_family TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  target_packet_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (source_revision_id, edge_type, target_packet_id)
);

CREATE INDEX IF NOT EXISTS idx_packet_edges_target_type
  ON packet_edges(target_packet_id, edge_type);

CREATE INDEX IF NOT EXISTS idx_packet_edges_source_type
  ON packet_edges(source_packet_id, edge_type);

CREATE TABLE IF NOT EXISTS packet_search_index (
  packet_id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL,
  family TEXT NOT NULL,
  label TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT,
  authority_scope_packet_id TEXT,
  applicable_scope_ids_json TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_packet_search_family_title
  ON packet_search_index(family, title);

CREATE INDEX IF NOT EXISTS idx_packet_search_authority_scope
  ON packet_search_index(authority_scope_packet_id)
  WHERE authority_scope_packet_id IS NOT NULL;
