/**
 * File: nexus-card.tsx
 * Description: Shared Nexus card surface primitive.
 */
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import type { NexusCardTone } from '@runtime/nexus/nexus-content';
import {
  NexusThemedBevelEdges,
  getNexusCardPaddingClass,
  getNexusChromeClasses,
  getNexusToneClasses,
  joinClasses,
} from '../layout/nexus-chrome';

export type NexusCardProps = PropsWithChildren<{
  accessibilityLabel?: string;
  action?: ReactNode;
  actionClassName?: string;
  className?: string;
  compact?: boolean;
  contentClassName?: string;
  disabled?: boolean;
  onPress?: () => void;
  selected?: boolean;
  tone?: NexusCardTone | 'default';
}>;

/**
 * Inputs: children content plus optional layout and tone classes.
 * Output: a styled nexus card container.
 */
export function NexusCard({
  accessibilityLabel,
  action,
  actionClassName,
  children,
  className,
  compact = false,
  contentClassName,
  disabled = false,
  onPress,
  selected = false,
  tone = 'default',
}: NexusCardProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const chrome = getNexusChromeClasses(themeMode, uiDensity);
  const selectedToneClass =
    themeMode === 'dark'
      ? 'border-nexus-sky bg-nexus-sky/10'
      : 'border-sky-400 bg-sky-50';
  const paddingClass = compact
    ? uiDensity === 'large'
      ? 'px-4 py-3.5'
      : 'px-3 py-3'
    : getNexusCardPaddingClass(uiDensity);
  const frameClassName = joinClasses(
    chrome.cardFrameClass,
    paddingClass,
    selected ? selectedToneClass : getNexusToneClasses(themeMode, tone),
    disabled ? 'opacity-60' : undefined,
    className,
  );
  const content =
    action || contentClassName ? (
      <View
        className={joinClasses(action ? 'pr-8' : undefined, contentClassName)}
      >
        {children}
      </View>
    ) : (
      children
    );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        className={frameClassName}
        disabled={disabled}
        onPress={onPress}
      >
        {content}
        {action ? (
          <View
            className={joinClasses(
              'absolute right-1.5 top-1.5 z-30 overflow-visible',
              actionClassName,
            )}
          >
            {action}
          </View>
        ) : null}
        <NexusThemedBevelEdges themeMode={themeMode} />
      </Pressable>
    );
  }

  return (
    <View className={frameClassName}>
      {content}
      {action ? (
        <View
          className={joinClasses(
            'absolute right-1.5 top-1.5 z-30 overflow-visible',
            actionClassName,
          )}
        >
          {action}
        </View>
      ) : null}
      <NexusThemedBevelEdges themeMode={themeMode} />
    </View>
  );
}
