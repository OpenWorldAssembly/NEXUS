/**
 * File: nexus-segmented-pill.tsx
 * Description: Shared Nexus segmented selection primitive.
 */
import { Pressable, Text, View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  NexusThemedBevelEdges,
  getNexusChromeClasses,
  joinClasses,
} from '../layout/nexus-chrome';

export type NexusSegmentedPillProps = {
  options: {
    id: string;
    label: string;
  }[];
  activeId: string;
  onSelect: (optionId: string) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function NexusSegmentedPill({
  options,
  activeId,
  onSelect,
  disabled = false,
  compact = false,
}: NexusSegmentedPillProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const chrome = getNexusChromeClasses(themeMode, uiDensity);
  const activeSegmentClass = chrome.segmentedActiveClass;
  const activeTextClass =
    themeMode === 'dark' ? 'text-nexus-sky' : 'text-sky-700';
  const inactiveTextClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const segmentSizeClass =
    compact || uiDensity === 'small' ? 'px-3 py-2' : 'px-4 py-2.5';

  return (
    <View
      className={joinClasses(
        chrome.segmentedContainerClass,
        disabled ? 'opacity-45' : '',
      )}
    >
      {options.map((option, optionIndex) => {
        const isActive = option.id === activeId;

        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            className={joinClasses(
              segmentSizeClass,
              optionIndex > 0 ? 'border-l' : '',
              themeMode === 'dark' ? 'border-nexus-line/70' : 'border-slate-300',
              isActive ? activeSegmentClass : '',
            )}
            disabled={disabled}
            onPress={() => onSelect(option.id)}
          >
            <Text
              className={joinClasses(
                compact || uiDensity === 'small'
                  ? 'text-xs font-semibold uppercase tracking-[2px]'
                  : 'text-sm font-semibold uppercase tracking-[2px]',
                isActive ? activeTextClass : inactiveTextClass,
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
      <NexusThemedBevelEdges themeMode={themeMode} subtle />
    </View>
  );
}
