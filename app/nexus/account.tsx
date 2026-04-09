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
} from '@/lib/nexus/nexus-content';

/**
 * Inputs: a kebab-case guest capability id.
 * Output: a readable label for the account surface.
 */
function formatGuestCapabilityLabel(capability: string): string {
  return capability.replace(/-/g, ' ');
}

/**
 * Inputs: none.
 * Output: the guest-facing account shell with identity placeholders and locality onboarding cues.
 */
export default function NexusAccountPage() {
  const {
    activeScope,
    anonymousSession,
    availablePoints,
    followedScopes,
    guestCapabilities,
  } = useNexusShell();
  const appearance = useNexusAppearance();

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className={appearance.pageContainerClass}>
        <NexusSectionHeader
          eyebrow="Account"
          title={`${activeScope.name} Account`}
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <NexusBadge label={anonymousSession.short_label} tone="mint" />
              <NexusBadge label={`${availablePoints} points`} tone="sky" />
            </View>
          }
        />

        <View className="gap-4 xl:flex-row">
          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                  Session
                </Text>
                <Text className={appearance.surfaceTitleClass}>
                  {anonymousSession.short_label}
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <NexusBadge label={`${availablePoints} points`} tone="sky" />
                <NexusBadge label={`Browsing ${activeScope.shortLabel}`} tone="mint" />
                <NexusBadge label="Guest standing" tone="gold" />
              </View>

              <View className="flex-row flex-wrap gap-3">
                <NexusActionButton label="Add locality later" disabled />
                <NexusActionButton label="Connect identity later" disabled />
              </View>
            </NexusCard>

            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Capabilities
              </Text>
              <View className="gap-3">
                {guestCapabilities.map((capability) => (
                  <NexusCard
                    key={capability}
                    className={`gap-2 p-4 ${appearance.cardInsetClass}`}
                  >
                    <Text className={appearance.itemTitleClass}>
                      {formatGuestCapabilityLabel(capability)}
                    </Text>
                  </NexusCard>
                ))}
              </View>
            </NexusCard>
          </View>

          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Next steps
              </Text>
              <View className="gap-3">
                {NEXUS_GUEST_CHECKLIST.map((item) => (
                  <NexusCard
                    key={item.id}
                    className={`gap-2 p-4 ${appearance.cardInsetClass}`}
                    tone={item.tone}
                  >
                    <Text className={appearance.itemTitleClass}>{item.title}</Text>
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
                    <Text className={appearance.itemMetaClass}>{scope.relationshipLabel}</Text>
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
