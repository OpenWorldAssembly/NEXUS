/**
 * File: nexus-chevron-icon.tsx
 * Description: Shared Nexus chevron icon primitive.
 */
import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { joinClasses } from '../layout/nexus-chrome';

export type NexusChevronIconDirection = 'up' | 'down' | 'left' | 'right';

export type NexusChevronIconProps = {
  isOpen?: boolean;
  direction?: NexusChevronIconDirection;
  variant?: 'disclosure' | 'rail';
  className?: string;
};

const NEXUS_CHEVRON_ICON_NAMES: Record<
  NexusChevronIconDirection,
  keyof typeof MaterialIcons.glyphMap
> = {
  down: 'keyboard-arrow-down',
  left: 'keyboard-arrow-left',
  right: 'keyboard-arrow-right',
  up: 'keyboard-arrow-up',
};

/**
 * Inputs: a direction or legacy open state plus optional variant and wrapper classes.
 * Output: a theme-aware vector chevron for Nexus disclosure controls and rail handles.
 */
export function NexusChevronIcon({
  isOpen,
  direction,
  variant = 'disclosure',
  className,
}: NexusChevronIconProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const resolvedDirection = direction ?? (isOpen ? 'up' : 'down');
  const iconColor = themeMode === 'dark' ? '#ecf4fb' : '#0f172a';
  const railIconColor = themeMode === 'dark' ? '#6dd3ff' : '#0284c7';
  const iconSize =
    variant === 'rail'
      ? uiDensity === 'large'
        ? 30
        : 28
      : uiDensity === 'large'
        ? 23
        : 21;

  return (
    <View
      className={joinClasses(
        'items-center justify-center',
        variant === 'rail' ? 'h-7 w-7' : 'h-4 w-4',
        className,
      )}
    >
      <MaterialIcons
        color={variant === 'rail' ? railIconColor : iconColor}
        name={NEXUS_CHEVRON_ICON_NAMES[resolvedDirection]}
        size={iconSize}
      />
    </View>
  );
}
