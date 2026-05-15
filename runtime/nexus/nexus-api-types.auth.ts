/**
 * File: nexus-api-types.auth.ts
 * Description: Identity, auth, passkey, security, and local-search payloads shared across Nexus routes and clients.
 */

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type {
  ActorAssertion,
  EncryptedIdentityBundle,
} from '@runtime/nexus/identity-crypto';
import type {
  LocalityScopeDescriptor,
  NexusLocationDisclosureOption,
  NexusLocationCreateCandidate,
  NexusLocationSearchResult,
} from '@runtime/nexus/location-search';
export type {
  NexusAuthGatePayload,
  NexusAuthGateReason,
} from '@runtime/nexus/nexus-auth-gate-error';

export type NexusSecurityMode =
  | 'standard'
  | 'guarded'
  | 'every_write';

export interface NexusAuthSessionPayload {
  is_authenticated: boolean;
  session_id: string | null;
  actor_packet_id: string | null;
  actor_packet: PacketEnvelopeByType['Element'] | null;
  session_expires_at: string | null;
  refresh_expires_at: string | null;
  csrf_token: string | null;
  auth_method: 'bundle' | 'passkey' | 'refresh' | null;
  security_mode: NexusSecurityMode | null;
  has_passkey: boolean;
  requires_passkey_upgrade: boolean;
  reauth_expires_at: string | null;
}

export interface NexusCreateIdentityPayload {
  actor_packet: PacketEnvelopeByType['Element'];
}

export interface NexusClaimIdentityPayload {
  actor_packet: PacketEnvelopeByType['Element'];
}

export interface NexusRestoreIdentityPayload {
  actor_packet: PacketEnvelopeByType['Element'];
}

export interface NexusSignInChallengePayload {
  challenge_id: string;
  nonce: string;
  expires_at: string;
}

export interface NexusSignInVerifyPayload {
  session: NexusAuthSessionPayload;
}

export interface NexusPasskeyDescriptorPayload {
  id: string;
  type: 'public-key';
}

export interface NexusPasskeyRegistrationOptionsPayload {
  challenge_id: string;
  public_key: {
    challenge: string;
    rp: {
      id: string;
      name: string;
    };
    user: {
      id: string;
      name: string;
      displayName: string;
    };
    pubKeyCredParams: {
      type: 'public-key';
      alg: number;
    }[];
    timeout: number;
    attestation: 'none';
    authenticatorSelection: {
      residentKey: 'preferred';
      userVerification: 'required';
    };
    excludeCredentials: NexusPasskeyDescriptorPayload[];
  };
}

export interface NexusPasskeyRequestOptionsPayload {
  challenge_id: string;
  public_key: {
    challenge: string;
    timeout: number;
    rpId: string;
    userVerification: 'required';
    allowCredentials: NexusPasskeyDescriptorPayload[];
  };
}

export interface NexusPasskeyRegistrationCredentialPayload {
  challenge_id: string;
  credential: {
    credential_id: string;
    raw_id: string;
    client_data_json: string;
    authenticator_data: string;
    public_key_spki: string;
    algorithm: number;
    transports: string[];
  };
}

export interface NexusPasskeyAssertionCredentialPayload {
  challenge_id: string;
  credential: {
    credential_id: string;
    raw_id: string;
    client_data_json: string;
    authenticator_data: string;
    signature: string;
    user_handle: string | null;
  };
}

export interface NexusPasskeySummaryPayload {
  credential_id: string;
  created_at: string;
  last_used_at: string | null;
  transports: string[];
  revoked_at: string | null;
}

export interface NexusPasskeyListPayload {
  passkeys: NexusPasskeySummaryPayload[];
}

export interface NexusPasskeyVerifyPayload {
  session: NexusAuthSessionPayload;
  passkey: NexusPasskeySummaryPayload;
}

export interface NexusSessionSummaryPayload {
  session_id: string;
  actor_packet_id: string;
  device_label: string;
  auth_method: 'bundle' | 'passkey' | 'refresh';
  created_at: string;
  expires_at: string;
  last_seen_at: string;
  persistent_login: boolean;
  revoked_at: string | null;
  is_current: boolean;
}

export interface NexusSessionListPayload {
  sessions: NexusSessionSummaryPayload[];
}

export interface NexusSecurityPreferencesPayload {
  security_mode: NexusSecurityMode;
}

export interface NexusLocationSearchPayload {
  query: string;
  results: NexusLocationSearchResult[];
  create_candidate: NexusLocationCreateCandidate | null;
}

export interface NexusLocalityPathEntryPayload {
  level: 'nation' | 'region' | 'city' | 'district';
  name: string;
  existing_scope_id?: string | null;
  alias_keys?: string[];
  display_aliases?: string[];
  scope_descriptor?: LocalityScopeDescriptor | null;
}

export interface NexusLocalityPathPreviewRequest {
  actor_packet_id?: string | null;
  path: NexusLocalityPathEntryPayload[];
  create_anyway?: boolean;
}

export interface NexusLocalityDuplicateWarningPayload {
  level: 'nation' | 'region' | 'city' | 'district';
  name: string;
  parent_packet_id: string;
  existing_scope_id: string;
  existing_name: string;
  message: string;
  existing_result: NexusLocationSearchResult;
}

export interface NexusLocalityReviewEntryPayload {
  level: 'nation' | 'region' | 'city' | 'district';
  name: string;
  disposition: 'reuse_existing' | 'create_new';
  existing_result: NexusLocationSearchResult | null;
  planned_scope_packet_id: string | null;
  scope_descriptor?: LocalityScopeDescriptor | null;
}

export interface NexusSuggestedHomeScopeEntryPayload {
  scope_id: string;
  name: string;
  level: 'nation' | 'region' | 'city' | 'district';
  path_label: string;
  checked_by_default: true;
}

export interface NexusLocalityPathPreviewPayload {
  review_entries: NexusLocalityReviewEntryPayload[];
  final_result: NexusLocationSearchResult;
  duplicate_warnings: NexusLocalityDuplicateWarningPayload[];
  planned_scope_packet_ids: string[];
  planned_relation_packet_ids: string[];
  planned_location_packet_ids: string[];
  suggested_home_scope_entries: NexusSuggestedHomeScopeEntryPayload[];
}

export interface NexusCreateLocalityPayload {
  created_packets: PacketEnvelopeByType[keyof PacketEnvelopeByType][];
  created_relation_packet_ids: string[];
  created_location_packet_ids: string[];
  final_result: NexusLocationSearchResult;
  duplicate_warnings: NexusLocalityDuplicateWarningPayload[];
}

export interface NexusLocalityGraphApplyRequest {
  paths: NexusLocalityPathEntryPayload[][];
  create_anyway?: boolean;
  home_scope_packet_id?: string | null;
  associated_scope_packet_ids?: string[];
  followed_scope_packet_ids?: string[];
  main_visible_scope_packet_ids?: string[];
  show_associated_parent_chains?: boolean;
  show_followed_parent_chains?: boolean;
}

export interface NexusLocalityGraphApplyPathResultPayload {
  created_packets: PacketEnvelopeByType[keyof PacketEnvelopeByType][];
  created_relation_packet_ids: string[];
  created_location_packet_ids: string[];
  final_result: NexusLocationSearchResult;
  duplicate_warnings: NexusLocalityDuplicateWarningPayload[];
}

export interface NexusLocalityGraphApplyPhaseOutcome {
  status: 'success' | 'partial' | 'failed' | 'skipped';
  message: string | null;
  error_messages: string[];
}

export interface NexusScopeDisplayPreferencesPayload {
  main_visible_scope_packet_ids: string[];
  show_associated_parent_chains: boolean;
  show_followed_parent_chains: boolean;
}

export interface NexusLocalityGraphApplyPayload {
  structural_phase: NexusLocalityGraphApplyPhaseOutcome;
  relations_phase: NexusLocalityGraphApplyPhaseOutcome;
  preferences_phase: NexusLocalityGraphApplyPhaseOutcome;
  path_results: NexusLocalityGraphApplyPathResultPayload[];
  final_result: NexusLocationSearchResult | null;
  home_scope_packet_id: string | null;
  associated_scope_packet_ids: string[];
  followed_scope_packet_ids: string[];
  preferences: NexusScopeDisplayPreferencesPayload;
  shell_payload: import('@runtime/nexus/nexus-api-types.shell').NexusShellPayload | null;
}

export interface NexusIdentitySearchResultPayload {
  actor_packet_id: string;
  display_alias: string;
  claim_status: 'ephemeral_guest' | 'persistent_guest' | 'claimed';
  saved_on_device: boolean;
  match_source: 'alias' | 'packet_id' | 'public_key';
}

export interface NexusIdentitySearchPayload {
  query: string;
  results: NexusIdentitySearchResultPayload[];
}

export type NexusLocationDisclosureOptionPayload = NexusLocationDisclosureOption;

export interface NexusReauthVerifyPayload {
  reauth_token: string;
  expires_at: string;
  proof_method:
    | 'signed_reauth'
    | 'bundle_passphrase_unlock'
    | 'passkey_confirmation';
}

export interface NexusLocalIdentityPreview {
  actor_packet_id: string;
  alias: string;
  claim_status: 'ephemeral_guest' | 'persistent_guest' | 'claimed';
  stored_kind: 'persistent_guest' | 'claimed';
  updated_at: string;
}

export interface NexusIdentityMutationEnvelope {
  actor_packet: PacketEnvelopeByType['Element'];
  actor_assertion: ActorAssertion;
}

export interface NexusIdentityExportPayload {
  actor_packet: PacketEnvelopeByType['Element'];
  encrypted_bundle: EncryptedIdentityBundle;
}
