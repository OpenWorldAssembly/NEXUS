/**
 * File: nexus-discussion-focus-panel.tsx
 * Description: Renders a compact focused reply-chain summary for the Nexus discussions thread tab.
 */

import { Pressable, Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import type {
  NexusDiscussionFocus,
  NexusDiscussionPost,
} from '@runtime/nexus/nexus-api-types';

type NexusDiscussionFocusPanelProps = {
  focus: NexusDiscussionFocus;
  onDismiss: () => void;
  onReveal: () => void;
};

function formatTimestamp(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getFocusPreviewText(item: NexusDiscussionPost): string {
  return item.excerpt ?? item.content_markdown ?? item.title;
}

/**
 * Inputs: a packet-backed discussion focus chain.
 * Output: an unobtrusive focus strip that can be dismissed or used to reveal the loaded tree path.
 */
export function NexusDiscussionFocusPanel({
  focus,
  onDismiss,
  onReveal,
}: NexusDiscussionFocusPanelProps) {
  const { themeMode } = useNexusShell();
  const appearance = useNexusAppearance();
  const focusedItems = focus.focus_chain_items.filter(
    (focusItem) => focusItem.packet.packet_id !== focus.root_post_packet_id
  );
  const titleClass =
    themeMode === 'dark'
      ? 'text-sm font-semibold text-nexus-text'
      : 'text-sm font-semibold text-slate-900';
  const closeClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-white/5 text-nexus-muted'
      : 'border-slate-300 bg-slate-100 text-slate-600';

  if (focusedItems.length === 0) {
    return null;
  }

  return (
    <NexusCard className="gap-3 border-nexus-sky/60 bg-nexus-sky/5 p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <NexusBadge label="In focus" tone="sky" />
            <Text className={appearance.itemMetaClass}>
              {`${focusedItems.length} reply${focusedItems.length === 1 ? '' : ' chain levels'}`}
            </Text>
          </View>
          <Text className={appearance.itemBodyClass}>
            Showing the selected reply inside its loaded parent chain.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss focused reply chain"
          className={`h-8 w-8 items-center justify-center rounded-full border ${closeClass}`}
          onPress={onDismiss}
        >
          <Text className="text-base font-semibold">×</Text>
        </Pressable>
      </View>

      <View className="gap-2">
        {focusedItems.map((focusItem, index) => {
          const isFocusedItem =
            focusItem.packet.packet_id === focus.highlight_packet_id;

          return (
            <View
              key={focusItem.packet.packet_id}
              className="rounded-2xl border border-nexus-line/50 bg-nexus-strong/70 p-3"
              style={{ marginLeft: Math.min(index, 3) * 14 }}
            >
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className={appearance.itemMetaClass}>
                  {`${focusItem.author_label} - ${formatTimestamp(
                    focusItem.created_at
                  )}`}
                </Text>
                {isFocusedItem ? <NexusBadge label="focused" tone="mint" /> : null}
              </View>
              <Text className={titleClass} numberOfLines={1}>
                {focusItem.title}
              </Text>
              <Text className={appearance.itemBodyClass} numberOfLines={2}>
                {getFocusPreviewText(focusItem)}
              </Text>
            </View>
          );
        })}
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        <NexusActionButton label="Show in tree" onPress={onReveal} />
      </View>
    </NexusCard>
  );
}
