/**
 * File: nexus-api-types.roles.ts
 * Description: Roles workspace payloads and role-attestation mutation contracts shared across Nexus routes and clients.
 */

import type { AttestationEdgeProjection, NexusScopeLens } from '@core/contracts';
import type { NexusScopeSummary } from '@runtime/nexus/nexus-shell';
import type {
  NexusTrustPolicySnapshot,
  NexusTrustStageId,
} from '@runtime/nexus/server/trust-logic';

export interface NexusRoleClaimantProjection {
  claim_packet_id: string;
  claim_status: 'active' | 'withdrawn';
  actor_packet_id: string;
  actor_label: string;
  actor_kind: string;
  is_current_actor: boolean;
  trust_stage: NexusTrustStageId;
  scope_trust_stage: NexusTrustStageId;
  has_scope_association: boolean;
  scope_association_support_count: number;
  support_count: number;
  dispute_count: number;
  viewer_attestation: 'support' | 'dispute' | 'none';
  support_edges: AttestationEdgeProjection[];
  dispute_edges: AttestationEdgeProjection[];
}

export interface NexusRoleCardProjection {
  role_packet_id: string;
  title: string;
  role_kind: string;
  summary: string | null;
  responsibility_markdown: string | null;
  is_claimed_by_current_actor: boolean;
  claimants: NexusRoleClaimantProjection[];
}

export interface NexusRolesPayload {
  lens: NexusScopeLens;
  scope: NexusScopeSummary;
  actor_packet_id: string | null;
  actor_label: string;
  policy_snapshot: NexusTrustPolicySnapshot;
  role_cards: NexusRoleCardProjection[];
}

export interface NexusRoleAttestationMutationPayload {
  claim_packet_id: string;
  mode: 'support' | 'dispute' | 'clear';
  support_count: number;
  dispute_count: number;
  viewer_attestation: 'support' | 'dispute' | 'none';
}

export interface NexusRoleClaimMutationPayload {
  claim_packet_id: string;
  claim_status: 'active' | 'withdrawn';
}
