/**
 * File: nexus-card-menu-button.tsx
 * Description: Provides the shared integrated Nexus card kebab action button.
 */
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type NexusCardMenuButtonProps = {
  accessibilityLabel?: string;
  className?: string;
  onPress: () => void;
};

/**
 * Inputs: a press callback and optional accessibility label.
 * Output: a subtle integrated kebab action button for Nexus cards.
 */
export function NexusCardMenuButton({
  accessibilityLabel = 'Open card actions',
  className,
  onPress,
}: NexusCardMenuButtonProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const iconColor = themeMode === 'dark' ? '#9bb2c5' : '#64748b';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className={joinClasses(
        'items-center justify-center rounded-nexus',
        uiDensity === 'large' ? 'h-8 w-8' : 'h-7 w-7',
        themeMode === 'dark'
          ? 'bg-white/0 active:bg-white/10'
          : 'bg-white/0 active:bg-slate-200',
        className,
      )}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
    >
      <MaterialIcons
        color={iconColor}
        name="more-vert"
        size={uiDensity === 'large' ? 22 : 20}
      />
    </Pressable>
  );
}
