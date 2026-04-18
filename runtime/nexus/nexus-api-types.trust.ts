/**
 * File: nexus-api-types.trust.ts
 * Description: Trust workspace payloads and role-claim mutation contracts shared across Nexus routes and clients.
 */

import type {
  AssemblyAssociationClaimProjection,
  AttestationEdgeProjection,
  NexusScopeLens,
} from '@core/contracts';
import type { NexusScopeSummary } from '@runtime/nexus/nexus-shell';
import type { NexusTrustPolicySnapshot, NexusTrustStageId } from '@runtime/nexus/server/trust-logic';

export interface NexusTrustRoleProjection {
  claim_packet_id: string | null;
  claim_status: 'active' | 'withdrawn' | null;
  claimed_scope_packet_id: string | null;
  role_packet_id: string;
  title: string;
  role_kind: string;
  summary: string | null;
  responsibility_markdown: string | null;
  is_claimed: boolean;
  support_count: number;
  dispute_count: number;
  stage: NexusTrustStageId;
  support_edges: AttestationEdgeProjection[];
  dispute_edges: AttestationEdgeProjection[];
}

export interface NexusTrustPayload {
  lens: NexusScopeLens;
  scope: NexusScopeSummary;
  actor_packet_id: string | null;
  actor_label: string;
  trust_stage: NexusTrustStageId;
  trust_score: number | null;
  policy_snapshot: NexusTrustPolicySnapshot;
  can_post: boolean;
  can_vote: boolean;
  can_review: boolean;
  assembly_claims: AssemblyAssociationClaimProjection[];
  role_cards: NexusTrustRoleProjection[];
}
