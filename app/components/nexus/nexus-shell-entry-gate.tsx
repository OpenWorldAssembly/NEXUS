/**
 * File: nexus-shell-entry-gate.tsx
 * Description: Renders the shell-level early-access entry gate for Nexus.
 */
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/ui';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';

type NexusShellGateContent = {
  eyebrow: string;
  title: string;
  intro: string;
  warnings: string[];
  closing: string;
  continueLabel: string;
};

const EARLY_ACCESS_GATE_CONTENT: NexusShellGateContent = {
  eyebrow: 'Early access',
  title: 'Nexus is still in early alpha.',
  intro:
    'This workspace is live enough to explore, but it is not stable or complete yet.',
  warnings: [
    'Some features are missing, disabled, or only partially implemented.',
    'You may run into broken flows, rough edges, or changing behavior.',
    'Data can still be reset, lost, or become incompatible during active development.',
  ],
  closing:
    'Use this build for exploration and testing, not for dependable long-term record keeping.',
  continueLabel: 'Continue',
};

type NexusShellEntryGateProps = {
  isVisible: boolean;
  onDismiss: () => void;
};

/**
 * Inputs: visibility state and a dismiss handler.
 * Output: the blocking shell-level early-access gate overlay.
 */
export default function NexusShellEntryGate({
  isVisible,
  onDismiss,
}: NexusShellEntryGateProps) {
  const appearance = useNexusAppearance();
  const { themeMode } = useNexusShell();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1100;
  const backdropClass =
    themeMode === 'dark' ? 'bg-slate-950/70' : 'bg-slate-900/35';

  if (!isVisible) {
    return null;
  }

  return (
    <View className="absolute inset-0 z-50 items-center justify-center px-5 py-8">
      <Pressable
        accessibilityRole="button"
        className={`absolute inset-0 ${backdropClass}`}
        onPress={onDismiss}
      />

      <NexusCard
        tone="gold"
        className={`z-10 w-full gap-5 ${
          isDesktop ? 'max-w-[760px] px-8 py-8' : 'max-w-[620px]'
        }`}
      >
        <View className="gap-3">
          <NexusBadge label={EARLY_ACCESS_GATE_CONTENT.eyebrow} tone="gold" />
          <Text className={appearance.surfaceTitleClass}>
            {EARLY_ACCESS_GATE_CONTENT.title}
          </Text>
          <Text className={appearance.sectionBodyClass}>
            {EARLY_ACCESS_GATE_CONTENT.intro}
          </Text>
        </View>

        <View className="gap-3 rounded-[24px] border border-nexus-line/70 bg-white/5 p-4">
          {EARLY_ACCESS_GATE_CONTENT.warnings.map((warning) => (
            <View key={warning} className="flex-row items-start gap-3">
              <Text className="pt-0.5 text-sm font-bold text-nexus-gold">•</Text>
              <Text className="min-w-0 flex-1 text-sm leading-6 text-nexus-text">
                {warning}
              </Text>
            </View>
          ))}
        </View>

        <Text className={appearance.itemBodyClass}>
          {EARLY_ACCESS_GATE_CONTENT.closing}
        </Text>

        <View className="flex-row flex-wrap gap-3">
          <NexusActionButton
            label={EARLY_ACCESS_GATE_CONTENT.continueLabel}
            variant="primary"
            onPress={onDismiss}
          />
        </View>
      </NexusCard>
    </View>
  );
}
