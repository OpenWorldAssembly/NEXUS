/**
 * File: discussion-feed-panel.tsx
 * Description: Feed workspace panel for Nexus discussions.
 */
import type { ComponentProps } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusCard,
  NexusLoadingBoundary,
} from '@app/components/nexus/ui';
import type { NexusDiscussionPost } from '@runtime/nexus/nexus-api-types';

import { DiscussionFeedPostCard } from './discussion-feed-post-card';
import type { DiscussionAppearance, DiscussionVoteValue } from './discussion-types';

type DiscussionFeedPanelProps = {
  appearance: DiscussionAppearance;
  canLoadMoreFeed: boolean;
  canVote: boolean;
  cardTitleClass: string;
  feedListClass: string;
  feedPosts: NexusDiscussionPost[];
  highlightedPostId: string | null;
  isLoadingFeed: boolean;
  isLoadingMoreFeed: boolean;
  metaRowClass: string;
  onLoadMoreFeed: () => void | Promise<void>;
  onNewPost: () => void;
  onOpenPost: (postId: string) => void;
  onScroll: ComponentProps<typeof ScrollView>['onScroll'];
  onVote: (post: NexusDiscussionPost, value: DiscussionVoteValue) => void;
  pendingVotePacketId: string | null;
  requestedPostId: string | null;
};

export function DiscussionFeedPanel({
  appearance,
  canLoadMoreFeed,
  canVote,
  cardTitleClass,
  feedListClass,
  feedPosts,
  highlightedPostId,
  isLoadingFeed,
  isLoadingMoreFeed,
  metaRowClass,
  pendingVotePacketId,
  requestedPostId,
  onLoadMoreFeed,
  onNewPost,
  onOpenPost,
  onScroll,
  onVote,
}: DiscussionFeedPanelProps) {
  return (
    <View className="gap-4">
      <NexusLoadingBoundary scope="discussions:feed">
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          className={feedListClass}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View className="gap-3 p-3">
            {isLoadingFeed && feedPosts.length === 0 ? (
              <Text className={appearance.itemBodyClass}>
                Loading discussion feed...
              </Text>
            ) : null}

            {!isLoadingFeed && feedPosts.length === 0 ? (
              <NexusCard tone="default">
                <Text className={appearance.itemBodyClass}>
                  No top-level threads are visible in this forum yet. Use the post
                  tab to start one.
                </Text>
              </NexusCard>
            ) : null}

            {feedPosts.map((post) => (
              <DiscussionFeedPostCard
                key={post.packet.packet_id}
                post={post}
                appearance={appearance}
                cardTitleClass={cardTitleClass}
                metaRowClass={metaRowClass}
                highlightedPostId={highlightedPostId}
                requestedPostId={requestedPostId}
                pendingVotePacketId={pendingVotePacketId}
                voteLoadingScope={`discussions:vote:${post.packet.packet_id}`}
                canVote={canVote}
                onOpen={onOpenPost}
                onVote={onVote}
              />
            ))}

            {isLoadingMoreFeed ? (
              <Text className={appearance.itemMetaClass}>
                Loading more threads...
              </Text>
            ) : null}

            {canLoadMoreFeed ? (
              <NexusActionButton
                label="Load more threads"
                onPress={onLoadMoreFeed}
                loadingScope="discussions:feed"
              />
            ) : null}

            <NexusActionButton label="New post" onPress={onNewPost} />
          </View>
        </ScrollView>
      </NexusLoadingBoundary>
    </View>
  );
}
