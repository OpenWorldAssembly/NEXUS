/**
 * File: discussion-vote-pill.tsx
 * Description: Vote and reply-count pill controls for Nexus discussion cards.
 */
import { Pressable, Text, View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { NexusLoadingBoundary, type NexusLoadingScope } from '@app/components/nexus/ui';

import { formatDiscussionReplyLabel } from './discussion-format';
import type { DiscussionVoteHandler, DiscussionVoteValue } from './discussion-types';

type DiscussionVotePillProps = {
  canVote: boolean;
  disabled: boolean;
  loadingScope?: NexusLoadingScope;
  onVote: DiscussionVoteHandler;
  score: number;
  viewerValue: DiscussionVoteValue | null;
};

type DiscussionReplyCountPillProps = {
  replyCount?: number;
  replyLabel?: string;
};

function useVotePillClasses() {
  const { themeMode } = useNexusShell();

  return {
    containerClass:
      themeMode === 'dark'
        ? 'border-nexus-line/70 bg-white/5'
        : 'border-slate-300 bg-slate-100',
    dividerClass:
      themeMode === 'dark' ? 'border-nexus-line/70' : 'border-slate-300',
    buttonClass:
      themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900',
  };
}

export function DiscussionVotePill({
  score,
  viewerValue,
  canVote,
  disabled,
  loadingScope,
  onVote,
}: DiscussionVotePillProps) {
  const { containerClass, dividerClass, buttonClass } = useVotePillClasses();
  const { themeMode } = useNexusShell();
  const scoreClass =
    score < 0
      ? 'text-nexus-rose'
      : score > 0
        ? 'text-nexus-mint'
        : buttonClass;
  const activeVoteSegmentClass =
    themeMode === 'dark'
      ? 'bg-nexus-sky/12 text-nexus-sky'
      : 'bg-sky-100 text-sky-700';
  const pill = (
    <View className={`flex-row items-center overflow-hidden rounded-full border ${containerClass}`}>
      <Pressable
        accessibilityRole="button"
        className={`px-4 py-2.5 ${viewerValue === 'up' ? activeVoteSegmentClass : ''}`}
        disabled={!canVote || disabled}
        onPress={(event) => onVote(event, 'up')}
      >
        <Text
          className={`text-sm font-semibold ${
            viewerValue === 'up' ? '' : buttonClass
          }`}
        >
          +1
        </Text>
      </Pressable>
      <View className={`border-l px-4 py-2.5 ${dividerClass}`}>
        <Text className={`text-sm font-semibold ${scoreClass}`}>{score}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        className={`border-l px-4 py-2.5 ${dividerClass} ${
          viewerValue === 'down' ? activeVoteSegmentClass : ''
        }`}
        disabled={!canVote || disabled}
        onPress={(event) => onVote(event, 'down')}
      >
        <Text
          className={`text-sm font-semibold ${
            viewerValue === 'down' ? '' : buttonClass
          }`}
        >
          -1
        </Text>
      </Pressable>
    </View>
  );

  return loadingScope ? (
    <NexusLoadingBoundary scope={loadingScope}>{pill}</NexusLoadingBoundary>
  ) : (
    pill
  );
}

export function DiscussionReplyCountPill({
  replyCount,
  replyLabel,
}: DiscussionReplyCountPillProps) {
  const { containerClass } = useVotePillClasses();
  const { themeMode } = useNexusShell();
  const textClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const label = replyLabel ?? formatDiscussionReplyLabel(replyCount ?? 0);

  return (
    <View className={`rounded-full border px-4 py-2.5 ${containerClass}`}>
      <Text className={`text-sm font-semibold ${textClass}`}>{label}</Text>
    </View>
  );
}
