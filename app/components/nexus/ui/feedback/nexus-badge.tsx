/**
 * File: nexus-badge.tsx
 * Description: Shared Nexus badge primitive.
 */
import { Text, View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import type { NexusCardTone } from '@runtime/nexus/nexus-content';
import {
  getNexusBadgeTextClasses,
  getNexusBadgeWrapperClasses,
  getNexusChromeClasses,
  joinClasses,
} from '../layout/nexus-chrome';

export type NexusBadgeProps = {
  label: string;
  tone?: NexusCardTone | 'default';
  className?: string;
  textClassName?: string;
};

/**
 * Inputs: a label string and an optional color tone.
 * Output: a small badge used for metadata, state, and policy cues.
 */
export function NexusBadge({
  label,
  tone = 'default',
  className,
  textClassName,
}: NexusBadgeProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const chrome = getNexusChromeClasses(themeMode, uiDensity);

  return (
    <View
      className={joinClasses(
        chrome.badgeFrameClass,
        getNexusBadgeWrapperClasses(themeMode, tone),
        className,
      )}
    >
      <Text
        className={joinClasses(
          'text-xs font-semibold uppercase tracking-[2px]',
          getNexusBadgeTextClasses(themeMode, tone),
          textClassName,
        )}
      >
        {label}
      </Text>
    </View>
  );
}
