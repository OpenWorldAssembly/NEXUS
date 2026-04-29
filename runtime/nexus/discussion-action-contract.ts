/**
 * File: discussion-action-contract.ts
 * Description: Shared discussion action descriptors for UI and headless Nexus consumers.
 */

import type { NexusActionIntentDescriptor } from '@core/contracts';

export const DISCUSSION_ACTION_DESCRIPTORS: NexusActionIntentDescriptor[] = [
  {
    id: 'discussion.open_thread',
    execution_kind: 'navigation',
    requires_selection: true,
    target_kind: 'discussion_post',
  },
  {
    id: 'discussion.reply',
    execution_kind: 'mutation',
    mutation_kind: 'discussion.reply.create',
    requires_selection: true,
    target_kind: 'discussion_message',
  },
  {
    id: 'discussion.vote_up',
    execution_kind: 'mutation',
    mutation_kind: 'attestation.packet_signal.set',
    requires_selection: true,
    target_kind: 'discussion_message',
  },
  {
    id: 'discussion.vote_down',
    execution_kind: 'mutation',
    mutation_kind: 'attestation.packet_signal.set',
    requires_selection: true,
    target_kind: 'discussion_message',
  },
  {
    id: 'discussion.create_top_level',
    execution_kind: 'mutation',
    mutation_kind: 'discussion.thread_post.create',
    requires_selection: false,
    target_kind: 'discussion_forum',
  },
  {
    id: 'discussion.expand_branch',
    execution_kind: 'local',
    requires_selection: true,
    target_kind: 'discussion_reply',
  },
  {
    id: 'discussion.collapse_branch',
    execution_kind: 'local',
    requires_selection: true,
    target_kind: 'discussion_reply',
  },
  {
    id: 'discussion.load_more_replies',
    execution_kind: 'query',
    requires_selection: true,
    target_kind: 'discussion_reply',
  },
  {
    id: 'discussion.load_more_feed',
    execution_kind: 'query',
    requires_selection: false,
    target_kind: 'discussion_forum',
  },
];

export function getDiscussionActionDescriptor(
  actionId: NexusActionIntentDescriptor['id']
): NexusActionIntentDescriptor | null {
  return DISCUSSION_ACTION_DESCRIPTORS.find(
    (descriptor) => descriptor.id === actionId
  ) ?? null;
}
