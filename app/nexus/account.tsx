/**
 * File: account.tsx
 * Description: Renders the guest identity and onboarding surface for the first nexus slice.
 */
import { ScrollView, Text, View } from 'react-native';

import { useNexusShell } from '@/components/nexus/nexus-shell-context';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  useNexusAppearance,
  NexusSectionHeader,
} from '@/components/nexus/nexus-ui';
import {
  NEXUS_GUEST_CHECKLIST,
  NEXUS_GUEST_PROFILE,
} from '@/lib/nexus/nexus-content';

/**
 * Inputs: none.
 * Output: the guest-facing account shell with identity placeholders and locality onboarding cues.
 */
export default function NexusAccountPage() {
  const {
    activeScope,
    followedScopes,
    guestCapabilities,
  } = useNexusShell();
  const appearance = useNexusAppearance();

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className={appearance.pageContainerClass}>
        <NexusSectionHeader
          eyebrow="Guest account"
          title="Anonymous guest identity shell"
          description="Account is a guest-facing identity surface in this slice, not a real authentication system. It shows how locality, trust, and future credentials can fit without forcing them yet."
        />

        <View className="gap-4 xl:flex-row">
          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                  Current status
                </Text>
                <Text className={appearance.surfaceTitleClass}>{NEXUS_GUEST_PROFILE.displayName}</Text>
                <Text className={appearance.sectionBodyClass}>{NEXUS_GUEST_PROFILE.note}</Text>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <NexusBadge label={NEXUS_GUEST_PROFILE.statusLabel} tone="sky" />
                <NexusBadge label={NEXUS_GUEST_PROFILE.trustLabel} tone="gold" />
                <NexusBadge label={`Browsing ${activeScope.shortLabel}`} tone="mint" />
              </View>

              <View className="flex-row flex-wrap gap-3">
                <NexusActionButton label="Add locality later" disabled />
                <NexusActionButton label="Connect identity later" disabled />
              </View>
            </NexusCard>

            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Guest capabilities in this slice
              </Text>
              <View className="gap-3">
                {guestCapabilities.map((capability) => (
                  <NexusCard
                    key={capability}
                    className={`gap-2 p-4 ${appearance.cardInsetClass}`}
                  >
                    <Text className={appearance.itemTitleClass}>{capability}</Text>
                  </NexusCard>
                ))}
              </View>
            </NexusCard>
          </View>

          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Suggested next steps
              </Text>
              <View className="gap-3">
                {NEXUS_GUEST_CHECKLIST.map((item) => (
                  <NexusCard
                    key={item.id}
                    className={`gap-2 p-4 ${appearance.cardInsetClass}`}
                    tone={item.tone}
                  >
                    <Text className={appearance.itemTitleClass}>{item.title}</Text>
                    <Text className={appearance.itemBodyClass}>{item.detail}</Text>
                  </NexusCard>
                ))}
              </View>
            </NexusCard>

            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Followed scopes
              </Text>
              <View className="gap-3">
                {followedScopes.map((scope) => (
                  <NexusCard
                    key={scope.id}
                    className={`gap-2 p-4 ${appearance.cardInsetClass}`}
                  >
                    <Text className={appearance.itemTitleClass}>{scope.name}</Text>
                    <Text className={appearance.itemBodyClass}>{scope.description}</Text>
                  </NexusCard>
                ))}
              </View>
            </NexusCard>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
