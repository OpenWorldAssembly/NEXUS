/**
 * File: account.tsx
 * Description: Renders the guest identity and onboarding surface for the first portal slice.
 */
import { ScrollView, Text, View } from 'react-native';

import { usePortalShell } from '@/components/portal/portal-shell-context';
import {
  PortalActionButton,
  PortalBadge,
  PortalCard,
  PortalSectionHeader,
} from '@/components/portal/portal-ui';
import {
  portalGuestChecklist,
  portalGuestProfile,
} from '@/data/portal/mock-portal-data';

/**
 * Inputs: none.
 * Output: the guest-facing account shell with identity placeholders and locality onboarding cues.
 */
export default function PortalAccountPage() {
  const { activeScope, followedScopes, guestCapabilities } = usePortalShell();

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <PortalSectionHeader
          eyebrow="Guest account"
          title="Anonymous guest identity shell"
          description="Account is a guest-facing identity surface in this slice, not a real authentication system. It shows how locality, trust, and future credentials can fit without forcing them yet."
        />

        <View className="gap-4 xl:flex-row">
          <View className="flex-1 gap-4">
            <PortalCard className="gap-4">
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
                  Current status
                </Text>
                <Text className="text-3xl font-bold text-portal-text">
                  {portalGuestProfile.displayName}
                </Text>
                <Text className="text-sm leading-7 text-portal-muted">
                  {portalGuestProfile.note}
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <PortalBadge label={portalGuestProfile.statusLabel} tone="sky" />
                <PortalBadge label={portalGuestProfile.trustLabel} tone="gold" />
                <PortalBadge label={`Browsing ${activeScope.shortLabel}`} tone="mint" />
              </View>

              <View className="flex-row flex-wrap gap-3">
                <PortalActionButton label="Add locality later" disabled />
                <PortalActionButton label="Connect identity later" disabled />
              </View>
            </PortalCard>

            <PortalCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
                Guest capabilities in this slice
              </Text>
              <View className="gap-3">
                {guestCapabilities.map((capability) => (
                  <PortalCard key={capability} className="gap-2 bg-white/5 p-4">
                    <Text className="text-base font-semibold text-portal-text">
                      {capability}
                    </Text>
                  </PortalCard>
                ))}
              </View>
            </PortalCard>
          </View>

          <View className="flex-1 gap-4">
            <PortalCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
                Suggested next steps
              </Text>
              <View className="gap-3">
                {portalGuestChecklist.map((item) => (
                  <PortalCard
                    key={item.id}
                    className="gap-2 bg-white/5 p-4"
                    tone={item.tone}
                  >
                    <Text className="text-base font-semibold text-portal-text">
                      {item.title}
                    </Text>
                    <Text className="text-sm leading-6 text-portal-muted">
                      {item.detail}
                    </Text>
                  </PortalCard>
                ))}
              </View>
            </PortalCard>

            <PortalCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
                Followed scopes
              </Text>
              <View className="gap-3">
                {followedScopes.map((scope) => (
                  <PortalCard key={scope.id} className="gap-2 bg-white/5 p-4">
                    <Text className="text-base font-semibold text-portal-text">
                      {scope.name}
                    </Text>
                    <Text className="text-sm leading-6 text-portal-muted">
                      {scope.description}
                    </Text>
                  </PortalCard>
                ))}
              </View>
            </PortalCard>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
