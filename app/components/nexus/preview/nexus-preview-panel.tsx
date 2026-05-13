/**
 * File: nexus-preview-panel.tsx
 * Description: Renders a fixed-height Nexus preview panel for compact function or packet previews.
 */
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { NexusCard, useNexusAppearance } from '@app/components/nexus/nexus-ui';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type NexusPreviewPanelProps = {
  children?: ReactNode;
  className?: string;
  emptyLabel?: string;
  meta?: string;
  onOpen: () => void;
  title: string;
};

/**
 * Inputs: preview label, click target, optional meta, and compact preview rows.
 * Output: a reusable fixed-height Nexus preview panel.
 */
export function NexusPreviewPanel({
  children,
  className,
  emptyLabel,
  meta,
  onOpen,
  title,
}: NexusPreviewPanelProps) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard
      className={joinClasses('h-[335px] min-w-[280px] flex-1 basis-[280px] gap-3', className)}
      contentClassName="h-full gap-3"
    >
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            {title}
          </Text>
          {meta ? <Text className={appearance.itemMetaClass}>{meta}</Text> : null}
        </View>
        <Pressable
          accessibilityLabel={`Open ${title}`}
          accessibilityRole="button"
          className="rounded-nexus px-1.5 py-1 active:bg-white/10"
          onPress={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          <Text className="text-xs font-bold uppercase tracking-[2px] text-nexus-sky">
            Open
          </Text>
        </Pressable>
      </View>

      <ScrollView
        className="h-[252px]"
        contentContainerClassName="min-h-full"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {children ?? (
          <View className="min-h-full justify-center">
            <Text className={appearance.itemBodyClass}>{emptyLabel ?? 'Nothing to preview.'}</Text>
          </View>
        )}
      </ScrollView>
    </NexusCard>
  );
}
