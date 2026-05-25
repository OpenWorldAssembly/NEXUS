/**
 * File: nexus-search-result-row.tsx
 * Description: Shared selectable row shell for Nexus search results.
 */
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useNexusAppearance } from '../../layout';

export type NexusSearchResultRowProps = {
  accessibilityLabel?: string;
  attached?: boolean;
  badges?: ReactNode;
  body?: ReactNode;
  children?: ReactNode;
  className?: string;
  isActive?: boolean;
  isSelected?: boolean;
  meta?: ReactNode;
  onPress?: () => void;
  title?: ReactNode;
  unstyled?: boolean;
};

function joinClasses(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function NexusSearchResultRow({
  accessibilityLabel,
  attached = false,
  badges,
  body,
  children,
  className,
  isActive = false,
  isSelected = false,
  meta,
  onPress,
  title,
  unstyled = false,
}: NexusSearchResultRowProps) {
  const appearance = useNexusAppearance();
  const selectedClass =
    isSelected || isActive ? 'border-nexus-sky bg-nexus-sky/10' : appearance.cardInsetClass;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className={joinClasses(
        unstyled
          ? undefined
          : attached
            ? 'border-t border-nexus-line/60 px-4 py-3'
            : `rounded-[18px] border px-4 py-3 ${selectedClass}`,
        !unstyled && attached && (isSelected || isActive) ? 'bg-nexus-sky/10' : '',
        className
      )}
      onPress={onPress}
    >
      {children ?? (
        <View className="gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            {typeof title === 'string' ? (
              <Text className={appearance.itemTitleClass}>{title}</Text>
            ) : (
              title
            )}
            {badges}
          </View>
          {typeof meta === 'string' ? (
            <Text className={appearance.itemMetaClass}>{meta}</Text>
          ) : (
            meta
          )}
          {typeof body === 'string' ? (
            <Text className={appearance.itemBodyClass}>{body}</Text>
          ) : (
            body
          )}
        </View>
      )}
    </Pressable>
  );
}
