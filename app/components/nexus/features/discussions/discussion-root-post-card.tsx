/**
 * File: discussion-root-post-card.tsx
 * Description: Root thread post card for Nexus discussions.
 */
import { Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  type NexusLoadingScope,
} from '@app/components/nexus/ui';
import type { NexusDiscussionPost } from '@runtime/nexus/nexus-api-types';

import { formatDiscussionTimestamp } from './discussion-format';
import { DiscussionReplyComposer } from './discussion-reply-composer';
import { DiscussionVotePill } from './discussion-vote-pill';
import type { DiscussionAppearance, DiscussionVoteValue } from './discussion-types';

type DiscussionRootPostCardProps = {
  appearance: DiscussionAppearance;
  canReply: boolean;
  canVote: boolean;
  highlightedPostId: string | null;
  isSubmittingReply: boolean;
  metaRowClass: string;
  onCancelReply: () => void;
  onChangeReplyBody: (nextValue: string) => void;
  onReplyToRoot: () => void;
  onSubmitReply: () => void | Promise<void>;
  onVote: (post: NexusDiscussionPost, value: DiscussionVoteValue) => void;
  pendingVotePacketId: string | null;
  replyBody: string;
  replyComposerLoadingScope?: NexusLoadingScope;
  replyError: string | null;
  replyTargetLabel: string | null;
  replyTargetPacketId: string | null;
  rootPost: NexusDiscussionPost;
  rootTitleClass: string;
  viewerLabel: string;
  voteLoadingScope?: NexusLoadingScope;
};

export function DiscussionRootPostCard({
  rootPost,
  appearance,
  metaRowClass,
  rootTitleClass,
  highlightedPostId,
  replyTargetLabel,
  replyTargetPacketId,
  viewerLabel,
  replyBody,
  replyError,
  isSubmittingReply,
  pendingVotePacketId,
  voteLoadingScope,
  replyComposerLoadingScope,
  canVote,
  canReply,
  onVote,
  onReplyToRoot,
  onChangeReplyBody,
  onCancelReply,
  onSubmitReply,
}: DiscussionRootPostCardProps) {
  const isRootReplyTarget = replyTargetPacketId === rootPost.packet.packet_id;
  const isRootHighlighted = highlightedPostId === rootPost.packet.packet_id;

  return (
    <NexusCard
      className={`gap-4 border-nexus-sky/70 ${
        isRootHighlighted ? 'bg-nexus-sky/10' : 'bg-nexus-strong'
      }`}
    >
      <View className="gap-2">
        <View className="flex-row flex-wrap items-center gap-2">
          <NexusBadge label="Original post" tone="sky" />
          {replyTargetLabel && replyTargetPacketId && !isRootReplyTarget ? (
            <NexusBadge label={`replying to ${replyTargetLabel}`} tone="default" />
          ) : null}
          {isRootHighlighted ? <NexusBadge label="focused" tone="mint" /> : null}
        </View>

        <Text className={metaRowClass}>
          {rootPost.author_label} - {formatDiscussionTimestamp(rootPost.created_at)}
        </Text>
        <Text className={rootTitleClass}>{rootPost.title}</Text>
      </View>

      <Text className={appearance.sectionBodyClass}>
        {rootPost.content_markdown ?? rootPost.excerpt ?? ''}
      </Text>

      <View className="flex-row flex-wrap items-center gap-2">
        <DiscussionVotePill
          score={rootPost.vote_summary.net_score}
          viewerValue={rootPost.vote_summary.viewer_value}
          canVote={rootPost.actions['discussion.vote_up']?.enabled ?? canVote}
          disabled={pendingVotePacketId === rootPost.packet.packet_id}
          loadingScope={voteLoadingScope}
          onVote={(event, value) => {
            event.stopPropagation?.();
            onVote(rootPost, value);
          }}
        />
        <NexusActionButton
          label={isRootReplyTarget ? 'Reply target' : 'Reply to OP'}
          onPress={onReplyToRoot}
        />
      </View>

      {isRootReplyTarget ? (
        <DiscussionReplyComposer
          appearance={appearance}
          targetLabel="Replying to OP"
          viewerLabel={viewerLabel}
          value={replyBody}
          error={replyError}
          disabled={
            !replyBody.trim() ||
            isSubmittingReply ||
            !(rootPost.actions['discussion.reply']?.enabled ?? canReply)
          }
          isSubmitting={isSubmittingReply}
          loadingScope={replyComposerLoadingScope}
          onChangeText={onChangeReplyBody}
          onCancel={onCancelReply}
          onSubmit={onSubmitReply}
        />
      ) : null}
    </NexusCard>
  );
}
