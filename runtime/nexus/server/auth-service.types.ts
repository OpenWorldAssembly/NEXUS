/**
 * File: auth-service.types.ts
 * Description: Shared auth runtime constants, record types, and security-mode normalization for Nexus auth services.
 */

import type { NexusSecurityMode } from '@runtime/nexus/nexus-api-types';

export const AUTH_SESSION_COOKIE = 'owa_nexus_session';
export const AUTH_REFRESH_COOKIE = 'owa_nexus_refresh';
export const SIGN_IN_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const REAUTH_TOKEN_TTL_MS = 5 * 60 * 1000;
export const AUTH_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const AUTH_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ACTOR_ASSERTION_TTL_MS = 5 * 60 * 1000;
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX_HITS = 20;
export const AUTH_RECORD_RETENTION_MS = 45 * 24 * 60 * 60 * 1000;
export const DEFAULT_SECURITY_MODE: NexusSecurityMode = 'guarded';

const LEGACY_SECURITY_MODE_MAP: Record<string, NexusSecurityMode> = {
  remembered: 'standard',
  high_security: 'guarded',
  interaction_lock: 'every_write',
};

export type AuthMethod = 'bundle' | 'passkey' | 'refresh';
export type WebAuthnChallengePurpose = 'register' | 'signin' | 'reauth';
export type ReauthPurpose = 'sensitive' | 'interaction';
export type ReauthProofMethod =
  | 'signed_reauth'
  | 'bundle_passphrase_unlock'
  | 'passkey_confirmation';

export type AuthSessionRecord = {
  session_id: string;
  actor_packet_id: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  persistent_login: number;
  device_label: string;
  auth_method: AuthMethod;
  csrf_token: string;
  requires_passkey_upgrade: number;
};

export type RefreshTokenRecord = {
  refresh_token_id: string;
  session_id: string;
  actor_packet_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
};

export type PasskeyRecord = {
  credential_id: string;
  actor_packet_id: string;
  public_key_spki: string;
  sign_count: number;
  transports_json: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type SecurityPreferenceRecord = {
  actor_packet_id: string;
  security_mode: string;
  updated_at: string;
};

export type WebAuthnChallengeRecord = {
  challenge_id: string;
  actor_packet_id: string | null;
  session_id: string | null;
  purpose: WebAuthnChallengePurpose;
  challenge: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

export type ReauthTokenRecord = {
  reauth_token_id: string;
  actor_packet_id: string;
  session_id: string;
  purpose: ReauthPurpose;
  proof_method: ReauthProofMethod;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
};

/**
 * Inputs: the stored security-mode value.
 * Output: the normalized current Nexus security mode.
 */
export function normalizeSecurityMode(
  value: string | null | undefined
): NexusSecurityMode {
  if (value === 'standard' || value === 'guarded' || value === 'every_write') {
    return value;
  }

  if (value && value in LEGACY_SECURITY_MODE_MAP) {
    return LEGACY_SECURITY_MODE_MAP[value];
  }

  return DEFAULT_SECURITY_MODE;
}
