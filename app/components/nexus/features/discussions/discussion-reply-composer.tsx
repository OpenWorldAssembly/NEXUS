/**
 * File: discussion-reply-composer.tsx
 * Description: Inline nested reply composer for Nexus discussion threads.
 */
import { Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusLoadingBoundary,
  NexusTextArea,
  type NexusLoadingScope,
} from '@app/components/nexus/ui';

import type { DiscussionAppearance } from './discussion-types';

type DiscussionReplyComposerProps = {
  appearance: DiscussionAppearance;
  disabled: boolean;
  error: string | null;
  isSubmitting: boolean;
  loadingScope?: NexusLoadingScope;
  onCancel: () => void;
  onChangeText: (nextValue: string) => void;
  onSubmit: () => void | Promise<void>;
  targetLabel: string;
  value: string;
  viewerLabel: string;
};

export function DiscussionReplyComposer({
  appearance,
  targetLabel,
  viewerLabel,
  value,
  error,
  disabled,
  isSubmitting,
  loadingScope,
  onChangeText,
  onCancel,
  onSubmit,
}: DiscussionReplyComposerProps) {
  const composer = (
    <NexusCard className="gap-4 border-nexus-sky/60 p-4">
      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          Reply composer
        </Text>
        <Text className={appearance.sectionBodyClass}>{targetLabel}</Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <NexusBadge label={`posting as ${viewerLabel}`} tone="sky" />
        <NexusBadge label="nested reply" tone="default" />
      </View>

      <NexusTextArea
        inputClassName="min-h-[120px] rounded-[24px] px-4 py-4"
        onChangeText={onChangeText}
        placeholder="Write a reply."
        value={value}
      />

      {error ? (
        <Text className="text-sm leading-6 text-nexus-rose">{error}</Text>
      ) : null}

      <View className="flex-row flex-wrap items-center gap-2">
        <NexusActionButton label="Cancel" onPress={onCancel} />
        <NexusActionButton
          label={isSubmitting ? 'Replying...' : 'Post reply'}
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
