/**
 * File: discussion-feed-post-card.tsx
 * Description: Feed-list thread preview card for Nexus discussions.
 */
import { Pressable, Text, View } from 'react-native';

import { NexusCard, type NexusLoadingScope } from '@app/components/nexus/ui';
import type { NexusDiscussionPost } from '@runtime/nexus/nexus-api-types';

import { formatDiscussionTimestamp } from './discussion-format';
import { DiscussionReplyCountPill, DiscussionVotePill } from './discussion-vote-pill';
import type { DiscussionAppearance, DiscussionVoteValue } from './discussion-types';

type DiscussionFeedPostCardProps = {
  appearance: DiscussionAppearance;
  canVote: boolean;
  cardTitleClass: string;
  highlightedPostId: string | null;
  metaRowClass: string;
  onOpen: (postId: string) => void;
  onVote: (post: NexusDiscussionPost, value: DiscussionVoteValue) => void;
  pendingVotePacketId: string | null;
  post: NexusDiscussionPost;
  requestedPostId: string | null;
  voteLoadingScope?: NexusLoadingScope;
};

export function DiscussionFeedPostCard({
  post,
  appearance,
  cardTitleClass,
  metaRowClass,
  highlightedPostId,
  requestedPostId,
  pendingVotePacketId,
  voteLoadingScope,
  canVote,
  onOpen,
  onVote,
}: DiscussionFeedPostCardProps) {
  return (
    <Pressable onPress={() => onOpen(post.packet.packet_id)}>
      <NexusCard
        className={`gap-3 ${
          requestedPostId === post.packet.packet_id
            ? 'border-nexus-sky/70 bg-nexus-sky/10'
            : post.packet.packet_id === highlightedPostId
              ? 'border-nexus-sky/70 bg-nexus-sky/10'
              : ''
        }`}
      >
        <View className="gap-1">
          <Text className={metaRowClass}>
            {post.author_label} - {formatDiscussionTimestamp(post.created_at)}
          </Text>
          <Text className={cardTitleClass}>{post.title}</Text>
        </View>

        <Text className={appearance.itemBodyClass}>
          {post.excerpt ?? post.content_markdown ?? ''}
        </Text>

        <View className="flex-row flex-wrap items-center gap-2">
          <DiscussionVotePill
            score={post.vote_summary.net_score}
            viewerValue={post.vote_summary.viewer_value}
            canVote={post.actions['discussion.vote_up']?.enabled ?? canVote}
            disabled={pendingVotePacketId === post.packet.packet_id}
            loadingScope={voteLoadingScope}
            onVote={(event, value) => {
              event.stopPropagation?.();
              onVote(post, value);
            }}
          />
          <DiscussionReplyCountPill replyCount={post.descendant_count} />
        </View>
      </NexusCard>
    </Pressable>
  );
}
