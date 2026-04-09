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
  NexusSectionHeader,
} from '@/components/nexus/nexus-ui';
import {
  nexusGuestChecklist,
  nexusGuestProfile,
} from '@/data/nexus/mock-nexus-data';

/**
 * Inputs: none.
 * Output: the guest-facing account shell with identity placeholders and locality onboarding cues.
 */
export default function NexusAccountPage() {
  const { activeScope, followedScopes, guestCapabilities } = useNexusShell();

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="gap-6 px-4 py-6 lg:px-8 lg:py-8">
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
                <Text className="text-3xl font-bold text-nexus-text">
                  {nexusGuestProfile.displayName}
                </Text>
                <Text className="text-sm leading-7 text-nexus-muted">
                  {nexusGuestProfile.note}
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <NexusBadge label={nexusGuestProfile.statusLabel} tone="sky" />
                <NexusBadge label={nexusGuestProfile.trustLabel} tone="gold" />
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
                  <NexusCard key={capability} className="gap-2 bg-white/5 p-4">
                    <Text className="text-base font-semibold text-nexus-text">
                      {capability}
                    </Text>
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
                {nexusGuestChecklist.map((item) => (
                  <NexusCard
                    key={item.id}
                    className="gap-2 bg-white/5 p-4"
                    tone={item.tone}
                  >
                    <Text className="text-base font-semibold text-nexus-text">
                      {item.title}
                    </Text>
                    <Text className="text-sm leading-6 text-nexus-muted">
                      {item.detail}
                    </Text>
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
                  <NexusCard key={scope.id} className="gap-2 bg-white/5 p-4">
                    <Text className="text-base font-semibold text-nexus-text">
                      {scope.name}
                    </Text>
                    <Text className="text-sm leading-6 text-nexus-muted">
                      {scope.description}
                    </Text>
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
