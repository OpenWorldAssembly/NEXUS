/**
 * File: discussion-reply-tree.tsx
 * Description: Recursive reply tree for Nexus discussion threads.
 */
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusLoadingBoundary,
  type NexusLoadingScope,
} from '@app/components/nexus/ui';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import type {
  NexusDiscussionPost,
  NexusDiscussionReply,
} from '@runtime/nexus/nexus-api-types';

import { formatDiscussionTimestamp } from './discussion-format';
import { DiscussionReplyComposer } from './discussion-reply-composer';
import { DiscussionVotePill } from './discussion-vote-pill';
import type {
  DiscussionAppearance,
  DiscussionVoteValue,
  ReplyBranchStateMap,
  ReplyExpansionState,
  ReplyLoadingStateMap,
} from './discussion-types';

type DiscussionReplyNodeProps = {
  appearance: DiscussionAppearance;
  branchLoadingStates: ReplyLoadingStateMap;
  branchStates: ReplyBranchStateMap;
  canReply: boolean;
  canVote: boolean;
  getReplyBranchLoadingScope?: (reply: NexusDiscussionReply) => NexusLoadingScope;
  getReplyComposerLoadingScope?: (reply: NexusDiscussionReply) => NexusLoadingScope;
  getVoteLoadingScope?: (post: NexusDiscussionPost) => NexusLoadingScope;
  highlightedPostId: string | null;
  isSubmittingReply: boolean;
  onChangeReplyBody: (nextValue: string) => void;
  onEnsureReplyChildren: (reply: NexusDiscussionReply) => void;
  onLoadMoreReplyChildren: (reply: NexusDiscussionReply) => void;
  onReply: (postId: string) => void;
  onSubmitReply: () => void | Promise<void>;
  onToggleReplyExpansion: (reply: NexusDiscussionReply) => void;
  onVote: (post: NexusDiscussionPost, value: DiscussionVoteValue) => void;
  pendingVotePacketId: string | null;
  reply: NexusDiscussionReply;
  replyBody: string;
  replyError: string | null;
  replyExpansionState: ReplyExpansionState;
  replyTargetPacketId: string | null;
  viewerLabel: string;
};

export type DiscussionReplyTreeProps = Omit<DiscussionReplyNodeProps, 'reply'> & {
  replies: NexusDiscussionReply[];
};

function DiscussionReplyNode({
  reply,
  appearance,
  highlightedPostId,
  replyTargetPacketId,
  canVote,
  canReply,
  viewerLabel,
  replyBody,
  replyError,
  isSubmittingReply,
  pendingVotePacketId,
  branchStates,
  branchLoadingStates,
  replyExpansionState,
  getReplyBranchLoadingScope,
  getReplyComposerLoadingScope,
  getVoteLoadingScope,
  onToggleReplyExpansion,
  onEnsureReplyChildren,
  onLoadMoreReplyChildren,
  onReply,
  onVote,
  onChangeReplyBody,
  onSubmitReply,
}: DiscussionReplyNodeProps) {
  const { themeMode } = useNexusShell();
  const isHighlighted = reply.packet.packet_id === highlightedPostId;
  const isReplyTarget = reply.packet.packet_id === replyTargetPacketId;
  const childBranchState = branchStates[reply.packet.packet_id];
  const childReplies = childBranchState?.replies ?? reply.replies;
  const childHasMore = childBranchState?.hasMore ?? reply.child_page.has_more;
  const isLoadingChildren =
    branchLoadingStates[reply.packet.packet_id] ?? false;
  const collapsedBranchCount = reply.descendant_count + 1;
  const isExpanded =
    replyExpansionState[reply.packet.packet_id] === true ||
    (replyExpansionState[reply.packet.packet_id] !== false &&
      !reply.is_collapsed_by_default);
  const canLoadChildren = reply.reply_count > 0;
  const railButtonClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-white/5'
      : 'border-slate-300 bg-slate-100';
  const railLineClass = themeMode === 'dark' ? 'bg-nexus-line/60' : 'bg-slate-300';
  const railBubbleTextClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const replyAction = reply.actions['discussion.reply'];
  const voteUpAction = reply.actions['discussion.vote_up'];
  const branchAction = reply.actions['discussion.expand_branch'];
  const loadMoreAction = reply.actions['discussion.load_more_replies'];
  const isReplyEnabled = replyAction?.enabled ?? canReply;
  const canVoteHere = voteUpAction?.enabled ?? canVote;
  const canToggleBranch = branchAction?.visible !== false && canLoadChildren;
  const canLoadMoreChildren = loadMoreAction?.visible !== false && childHasMore;
  const branchLoadingScope = getReplyBranchLoadingScope?.(reply);

  useEffect(() => {
    if (
      !isExpanded ||
      !canLoadChildren ||
      childReplies.length > 0 ||
      isLoadingChildren
    ) {
      return;
    }

    onEnsureReplyChildren(reply);
  }, [
    canLoadChildren,
    childReplies.length,
    isExpanded,
    isLoadingChildren,
    onEnsureReplyChildren,
    reply,
  ]);

  const expandedChildren = isExpanded ? (
    <View className="gap-3">
      {childReplies.length > 0 ? (
        <DiscussionReplyTree
          replies={childReplies}
          appearance={appearance}
          highlightedPostId={highlightedPostId}
          replyTargetPacketId={replyTargetPacketId}
          canVote={canVote}
          canReply={canReply}
          viewerLabel={viewerLabel}
          replyBody={replyBody}
          replyError={replyError}
          isSubmittingReply={isSubmittingReply}
          pendingVotePacketId={pendingVotePacketId}
          branchStates={branchStates}
          branchLoadingStates={branchLoadingStates}
          replyExpansionState={replyExpansionState}
          getReplyBranchLoadingScope={getReplyBranchLoadingScope}
          getReplyComposerLoadingScope={getReplyComposerLoadingScope}
          getVoteLoadingScope={getVoteLoadingScope}
          onToggleReplyExpansion={onToggleReplyExpansion}
          onEnsureReplyChildren={onEnsureReplyChildren}
          onLoadMoreReplyChildren={onLoadMoreReplyChildren}
          onReply={onReply}
          onVote={onVote}
          onChangeReplyBody={onChangeReplyBody}
          onSubmitReply={onSubmitReply}
        />
      ) : null}

      {isLoadingChildren ? (
        <Text className={appearance.itemMetaClass}>Loading replies...</Text>
      ) : null}

      {canLoadMoreChildren ? (
        <NexusActionButton
          label="Load more replies"
          onPress={() => onLoadMoreReplyChildren(reply)}
          loadingScope={branchLoadingScope}
        />
      ) : null}
    </View>
  ) : null;

  return (
    <View className="flex-row items-stretch gap-3">
      <View className="w-8 items-center">
        <View className="mt-4 gap-2">
          <Pressable
            accessibilityRole="button"
            className={`h-10 w-10 flex-row items-center justify-center gap-0.5 rounded-full border ${railButtonClass}`}
            disabled={!canToggleBranch}
            onPress={() => onToggleReplyExpansion(reply)}
          >
            <Text className={`text-[10px] font-semibold ${railBubbleTextClass}`}>
              {isExpanded ? '<' : '>'}
            </Text>
            <Text className={`text-[10px] font-semibold ${railBubbleTextClass}`}>
              {collapsedBranchCount}
            </Text>
          </Pressable>
        </View>
        <View className={`mt-2 w-px flex-1 ${railLineClass}`} />
      </View>

      <View className="min-w-0 flex-1 gap-3">
        {!isExpanded ? (
          <View className="mt-4 min-h-[52px] justify-center gap-1">
            <Text className={appearance.itemMetaClass}>
              {reply.author_label} - {formatDiscussionTimestamp(reply.created_at)}
            </Text>
            <Text className={appearance.itemBodyClass} numberOfLines={2}>
              {reply.content_markdown}
            </Text>
          </View>
        ) : null}

        {isExpanded ? (
          <NexusCard
            className={`gap-3 p-4 ${
              isReplyTarget || isHighlighted ? 'border-nexus-sky/70 bg-nexus-panel' : ''
            }`}
          >
            <Text className={appearance.itemMetaClass}>
              {reply.author_label} - {formatDiscussionTimestamp(reply.created_at)}
            </Text>

            <Text className={appearance.itemBodyClass}>
              {reply.content_markdown}
            </Text>

            <View className="flex-row flex-wrap items-center gap-2">
              <DiscussionVotePill
                score={reply.vote_summary.net_score}
                viewerValue={reply.vote_summary.viewer_value}
                canVote={canVoteHere}
                disabled={pendingVotePacketId === reply.packet.packet_id}
                loadingScope={getVoteLoadingScope?.(reply)}
                onVote={(event, value) => {
                  event.stopPropagation?.();
                  onVote(reply, value);
                }}
              />
              {isHighlighted ? <NexusBadge label="focused" tone="mint" /> : null}
              {isReplyTarget ? <NexusBadge label="reply target" tone="sky" /> : null}
              <NexusActionButton
                label={isReplyTarget ? 'Reply target' : 'Reply here'}
                onPress={() => onReply(reply.packet.packet_id)}
              />
            </View>

            {isReplyTarget ? (
              <DiscussionReplyComposer
                appearance={appearance}
                targetLabel={`Replying to ${reply.author_label} - ${formatDiscussionTimestamp(
                  reply.created_at
                )}`}
                viewerLabel={viewerLabel}
                value={replyBody}
                error={replyError}
                disabled={!replyBody.trim() || isSubmittingReply || !isReplyEnabled}
                isSubmitting={isSubmittingReply}
                loadingScope={getReplyComposerLoadingScope?.(reply)}
                onChangeText={onChangeReplyBody}
                onCancel={() => onReply('')}
                onSubmit={onSubmitReply}
              />
            ) : null}
          </NexusCard>
        ) : null}

        {branchLoadingScope ? (
          <NexusLoadingBoundary scope={branchLoadingScope}>
            {expandedChildren}
          </NexusLoadingBoundary>
        ) : (
          expandedChildren
        )}
      </View>
    </View>
  );
}

export function DiscussionReplyTree(props: DiscussionReplyTreeProps) {
  const { replies, ...replyNodeProps } = props;

  return (
    <View className="gap-3">
      {replies.map((reply) => (
        <DiscussionReplyNode
          key={reply.packet.packet_id}
          reply={reply}
          {...replyNodeProps}
        />
      ))}
    </View>
  );
}
