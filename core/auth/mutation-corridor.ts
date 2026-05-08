/**
 * File: mutation-corridor.ts
 * Description: Shared prepare/finalize mutation types for the fortress write corridor.
 */

import type {
  MutationProofMethod,
  WriteProofLevel,
} from '@core/auth/proof-types';
import type { MutationActionId } from '@core/auth/write-policy';
import type { PacketEnvelope } from '@core/schema/packet-schema';

export type DiscussionThreadPostMutationIntent = {
  kind: 'discussion.thread_post.create';
  scope_id: string;
  forum_packet_id: string;
  thread_title: string;
  post_markdown: string;
  related_packet_ids?: string[];
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type DiscussionReplyMutationIntent = {
  kind: 'discussion.reply.create';
  scope_id: string;
  parent_post_packet_id: string;
  reply_markdown: string;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type PacketSignalMutationIntent = {
  kind: 'attestation.packet_signal.set';
  scope_id: string;
  target_packet_id: string;
  value: -1 | 0 | 1;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type AssemblyElementCreateMutationIntent = {
  kind: 'assembly.element.create';
  name: string;
  parent_scope_packet_id: string;
  subtype?: string | null;
  summary?: string | null;
  locality_label?: string | null;
  seed_discussions?: boolean;
  claim_association?: boolean;
  claim_note?: string | null;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type AssemblyAssociationClaimMutationIntent = {
  kind: 'assembly_association.claim.set';
  assembly_packet_id: string;
  scope_id: string;
  note?: string | null;
  value: -1 | 0 | 1;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type HomeLocalityRelationMutationIntent = {
  kind: 'home_locality.relation.set';
  home_scope_packet_id: string | null;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type HomeLocalityClaimCompatibilityMutationIntent = {
  kind: 'home_locality.claim.set';
  home_scope_packet_id: string | null;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type RoleAssociationClaimMutationIntent = {
  kind: 'role_association.claim.set';
  scope_id: string;
  role_packet_id: string;
  claimed: boolean;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type RoleAssociationAttestationMutationIntent = {
  kind: 'role_association.attestation.set';
  scope_id: string;
  claim_packet_id: string;
  mode: 'support' | 'dispute' | 'clear';
  note?: string | null;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type LocalityPathEntryIntent = {
  level: 'nation' | 'region' | 'city' | 'district';
  name: string;
  existing_scope_id?: string | null;
  alias_keys?: string[];
  display_aliases?: string[];
};

export type LocalityPathCreateMutationIntent = {
  kind: 'locality.path.create';
  path: LocalityPathEntryIntent[];
  create_anyway?: boolean;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type DiscussionSurfacesEnsureMutationIntent = {
  kind: 'discussion.surfaces.ensure';
  scope_id: string;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type ActorWritePolicyMutationIntent = {
  kind: 'actor.write_policy.update';
  security_mode: 'standard' | 'guarded' | 'every_write';
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type MutationIntent =
  | DiscussionThreadPostMutationIntent
  | DiscussionReplyMutationIntent
  | PacketSignalMutationIntent
  | AssemblyElementCreateMutationIntent
  | AssemblyAssociationClaimMutationIntent
  | HomeLocalityRelationMutationIntent
  | HomeLocalityClaimCompatibilityMutationIntent
  | RoleAssociationClaimMutationIntent
  | RoleAssociationAttestationMutationIntent
  | LocalityPathCreateMutationIntent
  | DiscussionSurfacesEnsureMutationIntent
  | ActorWritePolicyMutationIntent;

// This typed corridor is the temporary containment seam for explicit per-intent mutation
// planners until a future packet-declared or registry-driven mutation model is affordable.

export interface PreparedPacketCandidate {
  packet: PacketEnvelope;
  unsigned_digest: string;
}

export interface PreparedMutation {
  kind: MutationIntent['kind'];
  action_ids: MutationActionId[];
  required_proof_level: WriteProofLevel;
  accepted_proof_methods: MutationProofMethod[];
  source_policy_packet_ids: string[];
  governing_scope_packet_id: string | null;
  prepared_packets: PreparedPacketCandidate[];
}

export interface MutationTicket {
  ticket_id: string;
  actor_packet_id: string;
  kind: MutationIntent['kind'];
  expires_at: string;
}

export interface MutationFinalizeRequest {
  ticket_id: string;
  signed_packets: PacketEnvelope[];
}

export interface MutationPersistEffect {
  packet: {
    packet_id: string;
    revision_id: string;
  };
}
