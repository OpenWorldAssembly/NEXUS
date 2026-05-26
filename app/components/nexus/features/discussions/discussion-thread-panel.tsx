/**
 * File: discussion-thread-panel.tsx
 * Description: Thread workspace panel for Nexus discussions.
 */
import type { ComponentProps } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusCard,
  NexusLoadingBoundary,
} from '@app/components/nexus/ui';
import type {
  NexusDiscussionPost,
  NexusDiscussionReply,
  NexusDiscussionThreadPayload,
} from '@runtime/nexus/nexus-api-types';

import { DiscussionReplyTree } from './discussion-reply-tree';
import { DiscussionRootPostCard } from './discussion-root-post-card';
import type {
  DiscussionAppearance,
  DiscussionVoteValue,
  ReplyBranchStateMap,
  ReplyExpansionState,
  ReplyLoadingStateMap,
} from './discussion-types';

type DiscussionThreadToolbarProps = {
  hasFocusRoute: boolean;
  hasHighlightedPost: boolean;
  hasThreadPayload: boolean;
  onBackToFeed: () => void;
  onDismissFocus: () => void;
  onNewReply: () => void;
};

type DiscussionThreadPanelProps = {
  appearance: DiscussionAppearance;
  branchLoadingStates: ReplyLoadingStateMap;
  branchStates: ReplyBranchStateMap;
  canReply: boolean;
  canVote: boolean;
  feedIsEmpty: boolean;
  hasFocusRoute: boolean;
  highlightedPostId: string | null;
  isLoadingFeed: boolean;
  isLoadingMoreRootReplies: boolean;
  isLoadingThread: boolean;
  isSubmittingReply: boolean;
  metaRowClass: string;
  onBackToFeed: () => void;
  onCancelRootReply: () => void;
  onChangeReplyBody: (nextValue: string) => void;
  onDismissFocus: () => void;
  onGoToFeed: () => void;
  onLoadMoreReplyChildren: (reply: NexusDiscussionReply) => void;
  onLoadMoreRootReplies: () => void | Promise<void>;
  onOpenPostTab: () => void;
  onReplyToRoot: () => void;
  onReplyToPost: (postId: string) => void;
  onScroll: ComponentProps<typeof ScrollView>['onScroll'];
  onSubmitReply: () => void | Promise<void>;
  onToggleReplyExpansion: (reply: NexusDiscussionReply) => void;
  onEnsureReplyChildren: (reply: NexusDiscussionReply) => void;
  onVote: (post: NexusDiscussionPost, value: DiscussionVoteValue) => void;
  pendingVotePacketId: string | null;
  replyBody: string;
  replyError: string | null;
  replyExpansionState: ReplyExpansionState;
  replyTargetLabel: string | null;
  replyTargetPacketId: string | null;
  requestedPostId: string | null;
  rootReplies: NexusDiscussionReply[];
  rootRepliesHasMore: boolean;
  rootTitleClass: string;
  threadError: string | null;
  threadListClass: string;
  threadPayload: NexusDiscussionThreadPayload | null;
  viewerLabel: string;
};

export function DiscussionThreadToolbar({
  hasFocusRoute,
  hasHighlightedPost,
  hasThreadPayload,
  onBackToFeed,
  onDismissFocus,
  onNewReply,
}: DiscussionThreadToolbarProps) {
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <NexusActionButton label="Back to feed" onPress={onBackToFeed} />
      {hasHighlightedPost || hasFocusRoute ? (
        <NexusActionButton
          label="Dismiss focus"
          onPress={onDismissFocus}
          variant="secondary"
        />
      ) : null}
      <NexusActionButton
        label="New reply"
        onPress={onNewReply}
        disabled={!hasThreadPayload}
      />
    </View>
  );
}

export function DiscussionThreadPanel({
  appearance,
  branchLoadingStates,
  branchStates,
  canReply,
  canVote,
  feedIsEmpty,
  hasFocusRoute,
  highlightedPostId,
  isLoadingFeed,
  isLoadingMoreRootReplies,
  isLoadingThread,
  isSubmittingReply,
  metaRowClass,
  pendingVotePacketId,
  replyBody,
  replyError,
  replyExpansionState,
  replyTargetLabel,
  replyTargetPacketId,
  requestedPostId,
  rootReplies,
  rootRepliesHasMore,
  rootTitleClass,
  threadError,
  threadListClass,
  threadPayload,
  viewerLabel,
  onBackToFeed,
  onCancelRootReply,
  onChangeReplyBody,
  onDismissFocus,
  onEnsureReplyChildren,
  onGoToFeed,
  onLoadMoreReplyChildren,
  onLoadMoreRootReplies,
  onOpenPostTab,
  onReplyToPost,
  onReplyToRoot,
  onScroll,
  onSubmitReply,
  onToggleReplyExpansion,
  onVote,
}: DiscussionThreadPanelProps) {
  return (
    <View className="gap-4">
      <DiscussionThreadToolbar
        hasHighlightedPost={Boolean(highlightedPostId)}
        hasFocusRoute={hasFocusRoute}
        hasThreadPayload={Boolean(threadPayload)}
        onBackToFeed={onBackToFeed}
        onDismissFocus={onDismissFocus}
        onNewReply={onReplyToRoot}
      />

      {!requestedPostId && isLoadingFeed ? (
        <Text className={appearance.itemBodyClass}>Loading the top thread...</Text>
      ) : null}

      {!requestedPostId && !isLoadingFeed && feedIsEmpty ? (
        <NexusCard>
          <Text className={appearance.itemBodyClass}>
            No thread is selected yet because this forum does not have any visible
            top-level threads.
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            <NexusActionButton label="Go to feed" onPress={onGoToFeed} />
            <NexusActionButton label="Open post tab" onPress={onOpenPostTab} />
          </View>
        </NexusCard>
      ) : null}

      {requestedPostId && isLoadingThread && !threadPayload ? (
        <Text className={appearance.itemBodyClass}>Loading thread...</Text>
      ) : null}

      {threadError ? (
        <NexusCard tone="rose">
          <Text className={appearance.itemBodyClass}>{threadError}</Text>
        </NexusCard>
      ) : null}

      {requestedPostId && threadPayload ? (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          className={threadListClass}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View className="gap-4 p-3">
            <DiscussionRootPostCard
              rootPost={threadPayload.root_post}
              appearance={appearance}
              metaRowClass={metaRowClass}
              rootTitleClass={rootTitleClass}
              highlightedPostId={highlightedPostId}
              replyTargetLabel={replyTargetLabel}
              replyTargetPacketId={replyTargetPacketId}
              viewerLabel={viewerLabel}
              replyBody={replyBody}
              replyError={replyError}
              isSubmittingReply={isSubmittingReply}
              pendingVotePacketId={pendingVotePacketId}
              voteLoadingScope={`discussions:vote:${threadPayload.root_post.packet.packet_id}`}
              replyComposerLoadingScope={`discussions:reply-composer:${threadPayload.root_post.packet.packet_id}`}
              canVote={canVote}
              canReply={canReply}
              onVote={onVote}
              onReplyToRoot={onReplyToRoot}
              onChangeReplyBody={onChangeReplyBody}
              onCancelReply={onCancelRootReply}
              onSubmitReply={onSubmitReply}
            />

            <NexusLoadingBoundary scope="discussions:root-replies">
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                  {`Replies (${threadPayload.root_post.descendant_count})`}
                </Text>
                {rootReplies.length > 0 ? (
                  <DiscussionReplyTree
                    replies={rootReplies}
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
                    getReplyBranchLoadingScope={(reply) =>
                      `discussions:reply-branch:${reply.packet.packet_id}`
                    }
                    getReplyComposerLoadingScope={(reply) =>
                      `discussions:reply-composer:${reply.packet.packet_id}`
                    }
                    getVoteLoadingScope={(post) =>
                      `discussions:vote:${post.packet.packet_id}`
                    }
                    onToggleReplyExpansion={onToggleReplyExpansion}
                    onEnsureReplyChildren={onEnsureReplyChildren}
                    onLoadMoreReplyChildren={onLoadMoreReplyChildren}
                    onReply={onReplyToPost}
                    onVote={onVote}
                    onChangeReplyBody={onChangeReplyBody}
                    onSubmitReply={onSubmitReply}
                  />
                ) : (
                  <NexusCard>
                    <Text className={appearance.itemBodyClass}>
                      No replies are visible yet.
                    </Text>
                  </NexusCard>
                )}
              </View>

              {isLoadingMoreRootReplies ? (
                <Text className={appearance.itemMetaClass}>
                  Loading more replies...
                </Text>
              ) : null}

              <View className="flex-row flex-wrap items-center gap-2">
                <NexusActionButton label="New reply" onPress={onReplyToRoot} />
                {rootRepliesHasMore ? (
                  <NexusActionButton
                    label="Load more replies"
                    onPress={onLoadMoreRootReplies}
                    loadingScope="discussions:root-replies"
                  />
                ) : null}
              </View>
            </NexusLoadingBoundary>
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}
