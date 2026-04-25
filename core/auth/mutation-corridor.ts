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
  | ActorWritePolicyMutationIntent;

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
