/**
 * File: discussion-post-composer.tsx
 * Description: Top-level thread composer for Nexus discussions.
 */
import { View } from 'react-native';

import {
  NexusActionButton,
  NexusCard,
  NexusLoadingBoundary,
  NexusTextArea,
  NexusTextInput,
  type NexusLoadingScope,
} from '@app/components/nexus/ui';

type DiscussionPostComposerProps = {
  body: string;
  disabled: boolean;
  isSubmitting: boolean;
  loadingScope?: NexusLoadingScope;
  onChangeBody: (nextValue: string) => void;
  onChangeTitle: (nextValue: string) => void;
  onSubmit: () => void | Promise<void>;
  title: string;
};

export function DiscussionPostComposer({
  title,
  body,
  disabled,
  isSubmitting,
  loadingScope,
  onChangeTitle,
  onChangeBody,
  onSubmit,
}: DiscussionPostComposerProps) {
  const composer = (
    <NexusCard className="gap-4">
      <NexusTextInput
        inputClassName="rounded-[22px]"
        onChangeText={onChangeTitle}
        placeholder="Thread title"
        value={title}
      />
      <NexusTextArea
        inputClassName="min-h-[180px] rounded-[24px] px-4 py-4"
        onChangeText={onChangeBody}
        placeholder="Write your top-level thread."
        value={body}
      />
      <View className="flex-row flex-wrap items-center gap-2">
        <NexusActionButton
          label={isSubmitting ? 'Posting...' : 'Post thread'}
          onPress={onSubmit}
          disabled={disabled}
          variant="primary"
          loadingScope={loadingScope}
        />
      </View>
    </NexusCard>
  );

  return loadingScope ? (
    <NexusLoadingBoundary scope={loadingScope}>{composer}</NexusLoadingBoundary>
  ) : (
    composer
  );
}
