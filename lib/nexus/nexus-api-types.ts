/**
 * File: nexus-api-types.ts
 * Description: Shares Nexus API response types between server routes and client surfaces.
 */

import type {
  AssemblyAssociationClaimProjection,
  AttestationEdgeProjection,
  DiscussionFeedProjection,
  DiscussionForumProjection,
  DiscussionPostProjection,
  DiscussionReplyChildrenProjection,
  DiscussionReplyProjection,
  DiscussionThreadDetailProjection,
  DiscussionViewerContext,
  NexusPacketCardProjection,
  NexusScopeLens,
} from '@/domain/core/contracts';
import type {
  AttestationValue,
  PacketEnvelopeByType,
  PacketFamily,
} from '@/domain/schema/packet-schema';
import type {
  ActorAssertion,
  EncryptedIdentityBundle,
} from '@/lib/nexus/identity-crypto';
import type {
  NexusLocationDisclosureOption,
  NexusLocationSearchResult,
} from '@/lib/nexus/location-search';
import type {
  NexusGuestChecklistItem,
  NexusGuestProfile,
} from '@/lib/nexus/nexus-content';
import type {
  NexusGuestCapability,
  NexusScopeSummary,
} from '@/lib/nexus/nexus-shell';

export interface NexusShellPayload {
  scope_summaries: NexusScopeSummary[];
  default_scope_id: string;
  default_expanded_scope_ids: string[];
  followed_scope_ids: string[];
  guest_profile: NexusGuestProfile;
  guest_capabilities: NexusGuestCapability[];
  guest_checklist: NexusGuestChecklistItem[];
  coming_soon_surfaces: string[];
}

export interface NexusDashboardMetric {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: 'sky' | 'mint' | 'gold' | 'rose';
}

export interface NexusDashboardQueueItem {
  id: string;
  title: string;
  detail: string;
  stat: string;
  tone: 'sky' | 'mint' | 'gold' | 'rose';
}

export interface NexusDashboardPayload {
  lens: NexusScopeLens;
  metrics: NexusDashboardMetric[];
  queue: NexusDashboardQueueItem[];
  recommended_packets: NexusPacketCardProjection[];
}

export type NexusDiscussionForum = DiscussionForumProjection;
export type NexusDiscussionPost = DiscussionPostProjection;
export type NexusDiscussionReply = DiscussionReplyProjection;

export interface NexusDiscussionsPayload extends DiscussionFeedProjection {}

export interface NexusDiscussionThreadPayload
  extends DiscussionThreadDetailProjection {}

export interface NexusDiscussionReplyChildrenPayload
  extends DiscussionReplyChildrenProjection {}

export interface NexusVoteMutationPayload {
  target_packet_id: string;
  value: AttestationValue | 0;
  summary: {
    upvote_count: number;
    downvote_count: number;
    net_score: number;
    total_votes: number;
    negative_ratio: number;
    viewer_value: AttestationValue | 0;
    auto_hidden: boolean;
    deprioritized: boolean;
  };
}

export interface NexusAttestationSummaryPayload {
  target_packet_id: string;
  summary: NexusVoteMutationPayload['summary'];
}

export interface NexusAttestationEdgesPayload {
  target_packet_id: string;
  attestations: AttestationEdgeProjection[];
}

export interface NexusActorAttestationsPayload {
  actor_key: string;
  attestations: AttestationEdgeProjection[];
}

export interface NexusAssemblyClaimsPayload {
  actor_packet_id: string;
  claims: AssemblyAssociationClaimProjection[];
}

export interface NexusAssemblyClaimMutationPayload {
  assembly_packet_id: string;
  summary: NexusVoteMutationPayload['summary'];
  claims: AssemblyAssociationClaimProjection[];
}

export interface NexusCreateAssemblyPayload {
  assembly_packet: PacketEnvelopeByType['Element'];
  claims: AssemblyAssociationClaimProjection[];
}

export interface NexusDiscussionPostMutationPayload {
  viewer: DiscussionViewerContext;
  post: DiscussionPostProjection;
}

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
    pubKeyCredParams: Array<{
      type: 'public-key';
      alg: number;
    }>;
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

export interface NexusVotesStage {
  id: string;
  title: string;
  count: number;
  detail: string;
  tone: 'sky' | 'mint' | 'gold' | 'rose';
}

export interface NexusVotesPayload {
  lens: NexusScopeLens;
  stage_cards: NexusVotesStage[];
  vote_cards: NexusPacketCardProjection[];
  mechanics: string[];
}

export interface NexusLibraryPayload {
  lens: NexusScopeLens;
  family_filter: PacketFamily | null;
  packets: NexusPacketCardProjection[];
}
