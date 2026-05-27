/**
 * File: account.tsx
 * Description: Renders the wrapper-level Nexus account overview for identity custody and security.
 */

import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import { useNexusAuthGate } from '@app/components/nexus/nexus-auth-gate';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusScrollFrame,
  NexusSectionHeader,
  useNexusAppearance,
} from '@app/components/nexus/ui';

function getStorageLabel(
  storageMode: 'none' | 'session_only' | 'saved_on_device' | null
) {
  if (storageMode === 'saved_on_device') {
    return 'Saved on this device';
  }

  if (storageMode === 'session_only') {
    return 'Session-only browser storage';
  }

  return 'No browser storage';
}

export default function NexusAccountPage() {
  const router = useRouter();
  const appearance = useNexusAppearance();
  const { currentActorLabel, currentIdentityMode, followedScopes } = useNexusShell();
  const {
    currentActorPacketId,
    currentStorageMode,
    isAuthenticated,
    isCurrentIdentityUnlocked,
    isUsingSessionCookies,
    passkeyCount,
    rememberClaimedSessions,
    securityMode,
  } = useIdentityShell();
  const { authGateModal, openNexusAuthGate } = useNexusAuthGate({
    returnTo: '/nexus/account',
    returnScopeId: null,
  });

  const hasActiveClaimedSession =
    currentIdentityMode === 'claimed' && isAuthenticated;
  const primaryIdentityActionLabel =
    currentIdentityMode === 'claimed'
      ? hasActiveClaimedSession
        ? isCurrentIdentityUnlocked
          ? 'Identity security'
          : 'Unlock this identity'
        : 'Resume this identity'
      : 'Sign in';
  const secondaryIdentityActionLabel =
    currentIdentityMode === 'claimed' ? 'Switch identity' : 'Create fresh identity';

  return (
    <NexusScrollFrame>
      <View className={appearance.pageContainerClass}>
        <NexusSectionHeader
          eyebrow="Account"
          title="Account"
          description="Manage identity, session, and account controls for the Nexus shell."
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <NexusBadge label={currentActorLabel} tone="mint" />
            </View>
          }
        />

        <View className="gap-4 xl:flex-row">
          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Current identity
              </Text>
              <Text className={appearance.surfaceTitleClass}>{currentActorLabel}</Text>
              <View className="flex-row flex-wrap gap-3">
                <NexusBadge
                  label={currentIdentityMode === 'claimed' ? 'Claimed identity' : 'Guest identity'}
                  tone={currentIdentityMode === 'claimed' ? 'gold' : 'sky'}
                />
                <NexusBadge
                  label={isAuthenticated ? 'Claimed session active' : 'No claimed session'}
                  tone={isAuthenticated ? 'mint' : 'default'}
                />
                <NexusBadge
                  label={isCurrentIdentityUnlocked ? 'Signing key unlocked' : 'Signing key locked'}
                  tone={isCurrentIdentityUnlocked ? 'mint' : 'gold'}
                />
                <NexusBadge label={getStorageLabel(currentStorageMode)} />
                <NexusBadge label={isUsingSessionCookies ? 'Cookies active' : 'No auth cookies'} />
              </View>
              <Text className={appearance.itemBodyClass}>
                {hasActiveClaimedSession
                  ? isCurrentIdentityUnlocked
                    ? `Remembered claimed sign-ins are currently ${
                        rememberClaimedSessions ? 'enabled' : 'disabled'
                      }, and write approval is set to ${securityMode ?? 'guest-only'}.`
                    : 'A claimed session is active, but the local identity bundle is locked. Unlock this identity to resume signed writes and security tools.'
                  : currentIdentityMode === 'claimed'
                    ? 'This claimed identity is saved locally, but no claimed session is active yet. Resume this identity to manage passkeys, sessions, and write approval.'
                    : `Current guest persistence is ${
                        currentStorageMode === 'none' ? 'temporary' : 'saved'
                      }, and remembered claimed sign-ins are currently ${
                        rememberClaimedSessions ? 'enabled' : 'disabled'
                      }.`}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <NexusActionButton
                  label={primaryIdentityActionLabel}
                  variant="primary"
                  onPress={() =>
                    hasActiveClaimedSession && !isCurrentIdentityUnlocked
                      ? openNexusAuthGate('unlock_required')
                      : router.push(
                          hasActiveClaimedSession && isCurrentIdentityUnlocked
                            ? '/nexus/identity/security'
                            : '/nexus/identity/sign-in'
                        )
                  }
                />
                {currentIdentityMode !== 'claimed' ? (
                  <NexusActionButton
                    label="Claim this guest"
                    onPress={() => router.push('/nexus/identity/claim')}
                  />
                ) : null}
                {currentIdentityMode === 'claimed' &&
                primaryIdentityActionLabel !== 'Identity security' ? (
                  <NexusActionButton
                    label="Identity security"
                    onPress={() => router.push('/nexus/identity/security')}
                  />
                ) : null}
                <NexusActionButton
                  label={secondaryIdentityActionLabel}
                  onPress={() =>
                    router.push(
                      currentIdentityMode === 'claimed'
                        ? '/nexus/identity/sign-in'
                        : '/nexus/identity/create'
                    )
                  }
                />
              </View>
              <View className="flex-row flex-wrap gap-3">
                <NexusBadge label={`${passkeyCount} passkeys`} tone="sky" />
                <NexusBadge label={currentActorPacketId ?? 'No identity packet id'} />
              </View>
            </NexusCard>
          </View>

          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Scoped workspaces
              </Text>
              <Text className={appearance.itemBodyClass}>
                Association claims, role legitimacy, and other scoped participation tools now live in Trust and Roles instead of Account.
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <NexusActionButton
                  label="Open Trust"
                  onPress={() => router.push('/nexus/trust')}
                />
                <NexusActionButton
                  label="Open Roles"
                  onPress={() => router.push('/nexus/roles')}
                />
              </View>
            </NexusCard>

            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Followed scopes
              </Text>
              <View className="gap-3">
                {followedScopes.map((scope) => (
                  <NexusCard key={scope.id} className={`gap-2 p-4 ${appearance.cardInsetClass}`}>
                    <Text className={appearance.itemTitleClass}>{scope.name}</Text>
                    <Text className={appearance.itemMetaClass}>{scope.relationshipLabel}</Text>
                  </NexusCard>
                ))}
              </View>
            </NexusCard>
          </View>
        </View>
      </View>
      {authGateModal}
    </NexusScrollFrame>
  );
}
