/**
 * File: mutation-corridor.ts
 * Description: Shared prepare/finalize mutation types for the Dispatch-owned write corridor.
 */

import type {
  MutationProofMethod,
  WriteProofLevel,
} from '@core/auth/proof-types';
import type { MutationActionId } from '@core/auth/write-policy';
import type {
  PacketEnvelope,
  ReactionAttestationValue,
} from '@core/schema/packet-schema';

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

export type PacketVoteMutationIntent = {
  kind: 'reaction.vote.set';
  scope_id: string;
  target_packet_id: string;
  value: 'up' | 'down' | null;
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
  initiative_packet_id?: string | null;
  seed_discussions?: boolean;
  add_association?: boolean;
  association_note?: string | null;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type AssociationRelationSetMutationIntent = {
  kind: 'relation.association.add';
  target_packet_id: string;
  scope_id: string;
  note?: string | null;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type AssociationRelationClearMutationIntent = {
  kind: 'relation.association.clear';
  target_packet_id: string;
  scope_id: string;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type ResidenceRelationMutationIntent = {
  kind: 'relation.residence.add';
  residence_scope_packet_id: string | null;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type FollowRelationSetMutationIntent = {
  kind: 'relation.follow.add';
  scope_id: string;
  target_scope_packet_id: string;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type FollowRelationClearMutationIntent = {
  kind: 'relation.follow.clear';
  scope_id: string;
  target_scope_packet_id: string;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type RoleParticipationMutationIntent = {
  kind: 'relation.participation.add' | 'relation.participation.clear';
  scope_id: string;
  role_packet_id: string;
  note?: string | null;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type ReactionAttestationMutationIntent = {
  kind: 'reaction.attestation.set';
  scope_id: string;
  target_packet_id: string;
  attestation_value: ReactionAttestationValue | null;
  note?: string | null;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type LocalityScopeDescriptorIntent = {
  hierarchy_system:
    | 'planetary'
    | 'administrative'
    | 'electoral'
    | 'postal'
    | 'addressing'
    | 'building'
    | 'custom';
  local_type_label: string;
  local_type_key: string;
  legacy_level: 'nation' | 'region' | 'city' | 'district';
};

export type LocalityPathEntryIntent = {
  level: 'nation' | 'region' | 'city' | 'district';
  name: string;
  existing_scope_id?: string | null;
  alias_keys?: string[];
  display_aliases?: string[];
  scope_descriptor?: LocalityScopeDescriptorIntent | null;
};

export type LocalityPathCreateMutationIntent = {
  kind: 'locality.path.create';
  path: LocalityPathEntryIntent[];
  create_anyway?: boolean;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type LocalityGraphApplyMutationIntent = {
  kind: 'locality.graph.apply';
  paths: LocalityPathEntryIntent[][];
  create_anyway?: boolean;
  residence_scope_packet_id?: string | null;
  associated_scope_packet_ids?: string[];
  followed_scope_packet_ids?: string[];
  main_visible_scope_packet_ids?: string[];
  show_associated_parent_chains?: boolean;
  show_followed_parent_chains?: boolean;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type DiscussionSurfacesEnsureMutationIntent = {
  kind: 'discussion.surfaces.ensure';
  scope_id: string;
  initiative_packet_id?: string | null;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type ActorWritePolicyMutationIntent = {
  kind: 'actor.write_policy.update';
  security_mode: 'standard' | 'guarded' | 'every_write';
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type PreferenceElementSetMutationIntent = {
  kind: 'preference.element.set';
  scope_display?: {
    main_visible_scope_packet_ids?: string[];
    show_associated_parent_chains?: boolean;
    show_followed_parent_chains?: boolean;
  };
  shell_chrome?: {
    navigation_mode?: 'function' | 'scope';
    theme_mode?: 'dark' | 'light';
    ui_density?: 'small' | 'large';
  };
  note?: string | null;
  created_at?: string | null;
  mutation_nonce?: string | null;
};

export type MutationIntent =
  | DiscussionThreadPostMutationIntent
  | DiscussionReplyMutationIntent
  | PacketVoteMutationIntent
  | AssemblyElementCreateMutationIntent
  | AssociationRelationSetMutationIntent
  | AssociationRelationClearMutationIntent
  | ResidenceRelationMutationIntent
  | FollowRelationSetMutationIntent
  | FollowRelationClearMutationIntent
  | RoleParticipationMutationIntent
  | ReactionAttestationMutationIntent
  | LocalityPathCreateMutationIntent
  | LocalityGraphApplyMutationIntent
  | DiscussionSurfacesEnsureMutationIntent
  | ActorWritePolicyMutationIntent
  | PreferenceElementSetMutationIntent;

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

export interface PreparedWriteTicket {
  ticket_id: string;
  actor_packet_id: string;
  kind: MutationIntent['kind'];
  expires_at: string;
}

export type MutationTicket = PreparedWriteTicket;

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
