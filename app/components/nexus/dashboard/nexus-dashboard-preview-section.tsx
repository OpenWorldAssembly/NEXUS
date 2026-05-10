/**
 * File: nexus-dashboard-preview-section.tsx
 * Description: Renders fixed-height clickable dashboard function preview sections.
 */
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { NexusCard, useNexusAppearance } from '@app/components/nexus/nexus-ui';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type NexusDashboardPreviewSectionProps = {
  children?: ReactNode;
  className?: string;
  emptyLabel?: string;
  meta?: string;
  onOpen: () => void;
  title: string;
};

/**
 * Inputs: section label, click target, optional meta, and compact preview rows.
 * Output: a fixed-height dashboard module that opens its function surface.
 */
export function NexusDashboardPreviewSection({
  children,
  className,
  emptyLabel,
  meta,
  onOpen,
  title,
}: NexusDashboardPreviewSectionProps) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard
      accessibilityLabel={`Open ${title}`}
      className={joinClasses('h-[335px] min-w-[280px] flex-1 basis-[280px] gap-3', className)}
      contentClassName="h-full gap-3"
      onPress={onOpen}
    >
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            {title}
          </Text>
          {meta ? <Text className={appearance.itemMetaClass}>{meta}</Text> : null}
        </View>
        <Text className="text-xs font-bold uppercase tracking-[2px] text-nexus-sky">
          Open
        </Text>
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
