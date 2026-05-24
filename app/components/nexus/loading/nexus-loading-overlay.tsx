/**
 * File: nexus-loading-overlay.tsx
 * Description: Renders the visual treatment for active Nexus loading boundaries.
 */
import { ActivityIndicator, Text, View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';

type NexusLoadingOverlayProps = {
  label?: string;
};

function joinClasses(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Inputs: optional loading label.
 * Output: a theme-aware loading veil for the current visual boundary.
 */
export function NexusLoadingOverlay({ label }: NexusLoadingOverlayProps) {
  const { themeMode } = useNexusShell();
  const veilClass =
    themeMode === 'dark' ? 'bg-slate-950/45' : 'bg-white/60';
  const plateClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-nexus-panel/95'
      : 'border-slate-300 bg-white/95';
  const textClass =
    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600';
  const indicatorColor = themeMode === 'dark' ? '#6dd3ff' : '#0284c7';

  return (
    <View
      className={joinClasses(
        'absolute inset-0 z-50 items-center justify-center',
        veilClass
      )}
    >
      <View
        className={joinClasses(
          'items-center justify-center gap-3 rounded-nexus border px-5 py-4',
          plateClass
        )}
      >
        <ActivityIndicator color={indicatorColor} size="small" />
        {label ? (
          <Text className={joinClasses('text-sm font-semibold', textClass)}>
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
