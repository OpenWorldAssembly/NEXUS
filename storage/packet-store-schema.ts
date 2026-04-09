/**
 * File: packet-store-schema.ts
 * Description: Defines the canonical SQLite schema used by the OWA packet store.
 */

export const PACKET_STORE_SCHEMA_SQL = `
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

CREATE TABLE IF NOT EXISTS packet_vote_index (
  vote_packet_id TEXT PRIMARY KEY,
  target_packet_id TEXT NOT NULL,
  actor_key TEXT NOT NULL,
  vote_kind TEXT NOT NULL,
  value INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_packet_vote_target_actor
  ON packet_vote_index(target_packet_id, actor_key);

CREATE TABLE IF NOT EXISTS packet_vote_tally_index (
  target_packet_id TEXT PRIMARY KEY,
  upvote_count INTEGER NOT NULL,
  downvote_count INTEGER NOT NULL,
  net_score INTEGER NOT NULL,
  total_votes INTEGER NOT NULL,
  negative_ratio REAL NOT NULL,
  auto_hidden INTEGER NOT NULL,
  deprioritized INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_packet_vote_tally_net_score
  ON packet_vote_tally_index(net_score DESC, total_votes DESC);

CREATE TABLE IF NOT EXISTS discussion_post_index (
  post_packet_id TEXT PRIMARY KEY,
  thread_packet_id TEXT NOT NULL,
  root_post_packet_id TEXT NOT NULL,
  reply_to_packet_id TEXT,
  depth INTEGER NOT NULL,
  author_key TEXT,
  created_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  direct_reply_count INTEGER NOT NULL,
  descendant_count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_discussion_post_thread_created
  ON discussion_post_index(thread_packet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_discussion_post_root_activity
  ON discussion_post_index(root_post_packet_id, last_activity_at DESC);

CREATE TABLE IF NOT EXISTS discussion_actor_ledger (
  actor_key TEXT PRIMARY KEY,
  earned_reply_points INTEGER NOT NULL,
  spent_top_level_points INTEGER NOT NULL,
  available_points INTEGER NOT NULL,
  negative_content_count INTEGER NOT NULL,
  trust_signal_score INTEGER NOT NULL,
  last_activity_at TEXT
);
`;
