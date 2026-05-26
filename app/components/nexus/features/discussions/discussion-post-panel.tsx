/**
 * File: discussion-post-panel.tsx
 * Description: Top-level post workspace panel for Nexus discussions.
 */
import { Text, View } from 'react-native';

import { NexusActionButton, NexusBadge, NexusCard } from '@app/components/nexus/ui';

import { DiscussionPostComposer } from './discussion-post-composer';
import type { DiscussionAppearance } from './discussion-types';

type DiscussionPostPanelProps = {
  appearance: DiscussionAppearance;
  body: string;
  canSubmit: boolean;
  isSubmittingPost: boolean;
  onBackToFeed: () => void;
  onChangeBody: (nextValue: string) => void;
  onChangeTitle: (nextValue: string) => void;
  onSubmit: () => void | Promise<void>;
  submitError: string | null;
  title: string;
  topLevelPostingLocked: boolean;
  viewerLabel: string | null | undefined;
};

export function DiscussionPostPanel({
  appearance,
  body,
  canSubmit,
  isSubmittingPost,
  submitError,
  title,
  topLevelPostingLocked,
  viewerLabel,
  onBackToFeed,
  onChangeBody,
  onChangeTitle,
  onSubmit,
}: DiscussionPostPanelProps) {
  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-row flex-wrap items-center gap-2">
          <NexusBadge label={`posting as ${viewerLabel}`} tone="sky" />
        </View>

        <NexusActionButton label="Back to feed" onPress={onBackToFeed} />
      </View>

      {topLevelPostingLocked ? (
        <NexusCard tone="gold">
          <Text className={appearance.itemBodyClass}>
            Top-level posting is not open to this actor in the current forum.
            Visitor lobbies accept any signed actor, while the other forums
            require this scope to be part of your claimed home-locality branch.
          </Text>
        </NexusCard>
      ) : null}

      {submitError ? (
        <NexusCard tone="rose">
          <Text className={appearance.itemBodyClass}>{submitError}</Text>
        </NexusCard>
      ) : null}

      <DiscussionPostComposer
        title={title}
        body={body}
        isSubmitting={isSubmittingPost}
        loadingScope="discussions:post-composer"
        onChangeTitle={onChangeTitle}
        onChangeBody={onChangeBody}
        onSubmit={onSubmit}
        disabled={!canSubmit}
      />
    </View>
  );
}
