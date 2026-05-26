/**
 * File: discussion-types.ts
 * Description: Shared UI-facing types for Nexus discussion feature components.
 */
import type { GestureResponderEvent } from 'react-native';

import type { useNexusAppearance } from '@app/components/nexus/ui';
import type {
  NexusDiscussionPost,
  NexusDiscussionReply,
} from '@runtime/nexus/nexus-api-types';

export type DiscussionAppearance = ReturnType<typeof useNexusAppearance>;
export type DiscussionVoteValue = 'up' | 'down';
export type DiscussionVoteHandler = (
  event: GestureResponderEvent,
  value: DiscussionVoteValue
) => void;

export type ReplyBranchState = {
  replies: NexusDiscussionReply[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ReplyBranchStateMap = Record<string, ReplyBranchState>;
export type ReplyLoadingStateMap = Record<string, boolean>;
export type ReplyExpansionState = Record<string, boolean>;

export type DiscussionPostActionHandler = (post: NexusDiscussionPost) => void;
