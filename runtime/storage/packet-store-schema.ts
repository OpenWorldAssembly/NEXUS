/**
 * File: packet-store-schema.ts
 * Description: Defines the canonical SQLite schema used by the OWA packet store.
 */

export const PACKET_STORE_SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS packets (
  packet_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  preferred_revision_id TEXT,
  head_revision_ids_json TEXT NOT NULL,
  revision_state TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  authority_scope_packet_id TEXT,
  preferred_revision_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_packets_type_updated
  ON packets(type, updated_at DESC);

CREATE TABLE IF NOT EXISTS packet_revisions (
  revision_id TEXT PRIMARY KEY,
  packet_id TEXT NOT NULL,
  type TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_packet_revisions_type_created
  ON packet_revisions(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_packet_revisions_authority_scope
  ON packet_revisions(authority_scope_packet_id)
  WHERE authority_scope_packet_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS packet_edges (
  source_revision_id TEXT NOT NULL,
  source_packet_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
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
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT,
  authority_scope_packet_id TEXT,
  applicable_scope_ids_json TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_packet_search_type_title
  ON packet_search_index(type, title);

CREATE INDEX IF NOT EXISTS idx_packet_search_authority_scope
  ON packet_search_index(authority_scope_packet_id)
  WHERE authority_scope_packet_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS runtime_validator_identity (
  node_key TEXT PRIMARY KEY,
  validator_packet_id TEXT NOT NULL,
  kid TEXT NOT NULL,
  public_jwk_json TEXT NOT NULL,
  private_jwk_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS actor_scope_display_preferences (
  actor_packet_id TEXT PRIMARY KEY,
  main_visible_scope_packet_ids_json TEXT NOT NULL DEFAULT '[]',
  show_associated_parent_chains INTEGER NOT NULL DEFAULT 1,
  show_followed_parent_chains INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS packet_verification_index (
  packet_id TEXT PRIMARY KEY,
  target_revision_id TEXT,
  target_digest TEXT,
  latest_report_packet_id TEXT,
  latest_report_revision_id TEXT,
  latest_report_source TEXT NOT NULL,
  status TEXT NOT NULL,
  structural_valid INTEGER NOT NULL,
  compatibility_status TEXT NOT NULL,
  signature_status TEXT NOT NULL,
  signer_status TEXT NOT NULL,
  provenance_status TEXT NOT NULL,
  local_trust_status TEXT NOT NULL,
  warnings_count INTEGER NOT NULL,
  validated_at TEXT,
  validator_packet_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_packet_verification_status
  ON packet_verification_index(status, validated_at DESC);

CREATE TABLE IF NOT EXISTS reaction_index (
  reaction_packet_id TEXT PRIMARY KEY,
  target_packet_id TEXT NOT NULL,
  actor_key TEXT NOT NULL,
  vote_value TEXT,
  attestation_value TEXT,
  emoji_keys_json TEXT NOT NULL,
  status TEXT NOT NULL,
  context_packet_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reaction_target_actor
  ON reaction_index(target_packet_id, actor_key);

CREATE INDEX IF NOT EXISTS idx_reaction_target_vote
  ON reaction_index(target_packet_id, vote_value);

CREATE INDEX IF NOT EXISTS idx_reaction_target_attestation
  ON reaction_index(target_packet_id, attestation_value);

CREATE TABLE IF NOT EXISTS reaction_tally_index (
  target_packet_id TEXT PRIMARY KEY,
  upvote_count INTEGER NOT NULL,
  downvote_count INTEGER NOT NULL,
  net_score INTEGER NOT NULL,
  total_votes INTEGER NOT NULL,
  negative_ratio REAL NOT NULL,
  auto_hidden INTEGER NOT NULL,
  deprioritized INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reaction_tally_net_score
  ON reaction_tally_index(net_score DESC, total_votes DESC);

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

CREATE TABLE IF NOT EXISTS auth_sign_in_challenges (
  challenge_id TEXT PRIMARY KEY,
  actor_packet_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_sign_in_challenges_actor
  ON auth_sign_in_challenges(actor_packet_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id TEXT PRIMARY KEY,
  actor_packet_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  persistent_login INTEGER NOT NULL,
  device_label TEXT NOT NULL DEFAULT 'Current device',
  auth_method TEXT NOT NULL DEFAULT 'bundle',
  csrf_token TEXT NOT NULL DEFAULT '',
  requires_passkey_upgrade INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_actor
  ON auth_sessions(actor_packet_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  refresh_token_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  actor_packet_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_actor
  ON auth_refresh_tokens(actor_packet_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS auth_passkeys (
  credential_id TEXT PRIMARY KEY,
  actor_packet_id TEXT NOT NULL,
  public_key_spki TEXT NOT NULL,
  sign_count INTEGER NOT NULL,
  transports_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_passkeys_actor
  ON auth_passkeys(actor_packet_id, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_identity_security (
  actor_packet_id TEXT PRIMARY KEY,
  security_mode TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_webauthn_challenges (
  challenge_id TEXT PRIMARY KEY,
  actor_packet_id TEXT,
  session_id TEXT,
  purpose TEXT NOT NULL,
  challenge TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_webauthn_challenges_actor
  ON auth_webauthn_challenges(actor_packet_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS auth_reauth_tokens (
  reauth_token_id TEXT PRIMARY KEY,
  actor_packet_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  proof_method TEXT NOT NULL DEFAULT 'signed_reauth',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_reauth_tokens_actor
  ON auth_reauth_tokens(actor_packet_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS auth_rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  hit_count INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_event_log (
  event_id TEXT PRIMARY KEY,
  actor_packet_id TEXT,
  session_id TEXT,
  credential_id TEXT,
  event_type TEXT NOT NULL,
  event_metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;
