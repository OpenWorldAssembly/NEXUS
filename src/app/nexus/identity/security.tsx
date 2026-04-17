/**
 * File: security.tsx
 * Description: Renders the Nexus-shell session, passkey, and export controls for the active identity.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  IdentityField,
  IdentityInput,
  IdentityPageShell,
} from '@app/components/nexus/nexus-identity-ui';
import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusSegmentedPill,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import {
  PASSPHRASE_EXPORT_MIN_LENGTH,
  validatePassphrase,
  validatePassphraseConfirmation,
} from '@runtime/nexus/identity-validation';

function getStorageModeCopy(storageMode: 'none' | 'session_only' | 'saved_on_device' | null) {
  if (storageMode === 'session_only') {
    return 'Session-only browser storage';
  }

  if (storageMode === 'saved_on_device') {
    return 'Saved on this device';
  }

  return 'No browser storage';
}

export default function NexusIdentitySecurityPage() {
  const params = useLocalSearchParams<{ welcome?: string | string[] }>();
  const router = useRouter();
  const appearance = useNexusAppearance();
  const {
    currentIdentity,
    currentLabel,
    currentMode,
    currentStorageMode,
    exportCurrentIdentityBundle,
    isAuthenticated,
    isCurrentIdentityUnlocked,
    isPasskeySupported,
    isUsingSessionCookies,
    passkeyCount,
    passkeySummaries,
    registerCurrentPasskey,
    rememberClaimedSessions,
    revokeOtherSessions,
    revokePasskey,
    revokeSession,
    securityMode,
    sessionSummaries,
    setRememberClaimedSessions,
    setSecurityMode,
    saveGuestOnDevice,
    signOut,
  } = useIdentityShell();
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [exportPassphraseConfirmation, setExportPassphraseConfirmation] = useState('');
  const [exportedBundle, setExportedBundle] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const welcomeMode =
    typeof params.welcome === 'string'
      ? params.welcome
      : Array.isArray(params.welcome)
        ? params.welcome[0] ?? null
        : null;

  const exportPassphraseError =
    exportPassphrase.length > 0
      ? validatePassphrase(exportPassphrase, PASSPHRASE_EXPORT_MIN_LENGTH)
      : 'Export passphrase is required.';
  const exportPassphraseConfirmationError =
    exportPassphraseConfirmation.length > 0
      ? validatePassphraseConfirmation(exportPassphrase, exportPassphraseConfirmation)
      : 'Confirm the export passphrase.';
  const hasActiveClaimedSession = currentMode === 'claimed' && isAuthenticated;
  const sessionPreferenceActiveId =
    currentMode === 'claimed'
      ? rememberClaimedSessions
        ? 'save'
        : 'temp'
      : currentStorageMode === 'none'
        ? 'temp'
        : 'save';

  const handleAction = async (action: () => Promise<void>, successMessage: string) => {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await action();
      setStatusMessage(successMessage);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to complete that action.');
    }
  };

  return (
    <IdentityPageShell
      eyebrow="Identity"
      title="Identity security"
      description="Manage the Nexus shell around the current cryptographic actor: remembered sessions, write approval, passkeys, device sessions, and encrypted bundle export."
    >
      <View className="gap-4 xl:flex-row">
        <View className="flex-1 gap-4">
          {welcomeMode === 'create' || welcomeMode === 'claim' ? (
            <NexusCard tone="gold">
              <View className="gap-3">
                <Text className={appearance.itemBodyClass}>
                  {welcomeMode === 'create'
                    ? 'Your claimed identity is ready. Export an encrypted bundle soon and store it somewhere safe so this device is not your only copy.'
                    : 'Your guest actor is now claimed. Export an encrypted bundle soon and store it somewhere safe so you can restore it on another device.'}
                </Text>
                <Text className={appearance.itemMetaClass}>
                  The encrypted bundle contains the private signing material protected by your passphrase. The public identity packet remains separate.
                </Text>
              </View>
            </NexusCard>
          ) : null}

          <NexusCard className="gap-4">
            <Text className={appearance.surfaceTitleClass}>{currentLabel}</Text>
            <View className="flex-row flex-wrap gap-3">
              <NexusBadge label={currentMode === 'claimed' ? 'Claimed identity' : 'Guest actor'} tone={currentMode === 'claimed' ? 'gold' : 'sky'} />
              <NexusBadge label={isAuthenticated ? 'Claimed session active' : 'No claimed session'} tone={isAuthenticated ? 'mint' : 'default'} />
              <NexusBadge label={isCurrentIdentityUnlocked ? 'Signing key unlocked' : 'Signing key locked'} tone={isCurrentIdentityUnlocked ? 'mint' : 'gold'} />
              <NexusBadge label={isUsingSessionCookies ? 'Cookies active' : 'No auth cookies'} />
              <NexusBadge label={getStorageModeCopy(currentStorageMode)} />
            </View>
            <Text className={appearance.itemBodyClass}>
              Passkeys are optional extra protection for claimed auth and protected actions. Bundle passphrases protect the encrypted local identity bundle itself.
            </Text>
            <View className="flex-row flex-wrap gap-3">
              <NexusActionButton label="Open account overview" onPress={() => router.push('/nexus/account')} />
              {currentMode !== 'claimed' ? (
                <NexusActionButton label="Claim this guest" variant="primary" onPress={() => router.push('/nexus/identity/claim')} />
              ) : null}
              {currentMode !== 'claimed' && currentStorageMode !== 'saved_on_device' ? (
                <NexusActionButton
                  label="Save on this device"
                  onPress={() => {
                    void handleAction(
                      () => saveGuestOnDevice(),
                      'Saved this guest on the current device.'
                    );
                  }}
                />
              ) : null}
            </View>
          </NexusCard>

          <NexusCard className="gap-4">
            <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">Session preferences</Text>
            <View className="gap-3">
              <Text className={appearance.itemTitleClass}>
                {currentMode === 'claimed'
                  ? 'Remember future claimed sign-ins'
                  : 'Current guest persistence'}
              </Text>
              <NexusSegmentedPill
                options={[
                  { id: 'temp', label: 'TEMP' },
                  { id: 'save', label: 'SAVE' },
                ]}
                activeId={sessionPreferenceActiveId}
                onSelect={(optionId) => {
                  const nextRememberedValue = optionId === 'save';

                  void handleAction(
                    () => setRememberClaimedSessions(nextRememberedValue),
                    currentMode === 'claimed'
                      ? nextRememberedValue
                        ? 'Future claimed sign-ins will request remembered sessions.'
                        : 'Future claimed sign-ins will stay non-remembered by default.'
                      : nextRememberedValue
                        ? 'This guest now persists in browser storage immediately.'
                        : 'This guest is now temporary and browser persistence was cleared.'
                  );
                }}
              />
            </View>
            <Text className={appearance.itemMetaClass}>
              {currentMode === 'claimed'
                ? 'This preference applies to future claimed sign-ins by default.'
                : 'TEMP keeps the current guest temporary. SAVE keeps the current guest across refreshes in this browser session right away.'}
            </Text>
            <View className="gap-3">
              <Text className={appearance.itemTitleClass}>Write approval</Text>
              <NexusSegmentedPill
                options={[
                  { id: 'standard', label: 'OFF' },
                  { id: 'guarded', label: 'MED' },
                  { id: 'every_write', label: 'MAX' },
                ]}
                activeId={securityMode ?? 'guarded'}
                onSelect={(optionId) => {
                  const nextMode = optionId as 'standard' | 'guarded' | 'every_write';
                  const successMessage =
                    nextMode === 'every_write'
                      ? 'Every write now requires fresh approval.'
                      : nextMode === 'guarded'
                        ? 'Guarded write approval is active.'
                        : 'Standard write approval is active.';

                  void handleAction(() => setSecurityMode(nextMode), successMessage);
                }}
                disabled={!hasActiveClaimedSession}
              />
            </View>
            <Text className={appearance.itemMetaClass}>
              OFF uses the active claimed session after unlock. MED adds fresh approval for sensitive and higher-impact writes. MAX asks for fresh approval before every write.
            </Text>
          </NexusCard>

          <NexusCard className="gap-4">
            <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">Passkeys</Text>
            <View className="flex-row flex-wrap gap-3">
              <NexusBadge label={isPasskeySupported ? 'Passkeys supported' : 'No passkey support'} tone={isPasskeySupported ? 'mint' : 'rose'} />
              <NexusBadge label={`${passkeyCount} registered`} tone="sky" />
              <NexusBadge label={passkeyCount > 0 ? 'Passkey ready' : 'Passkey optional'} tone={passkeyCount > 0 ? 'mint' : 'gold'} />
            </View>
            <Text className={appearance.itemMetaClass}>
              Add a passkey if you want faster device-bound sign-in and re-approval. Nexus can still work from the encrypted local bundle and passphrase alone.
            </Text>
            <NexusActionButton
              label="Register passkey"
              onPress={() => {
                void handleAction(() => registerCurrentPasskey(), 'Registered a new passkey.');
              }}
              disabled={!hasActiveClaimedSession || !isPasskeySupported}
            />
            <View className="gap-3">
              {passkeySummaries.map((passkey) => (
                <NexusCard key={passkey.credential_id} className={`gap-2 p-4 ${appearance.cardInsetClass}`}>
                  <Text className={appearance.itemTitleClass}>{passkey.credential_id}</Text>
                  <Text className={appearance.itemMetaClass}>Last used {passkey.last_used_at ?? 'never'}</Text>
                  <NexusActionButton
                    label="Revoke passkey"
                    onPress={() => {
                      void handleAction(() => revokePasskey(passkey.credential_id), 'Revoked the selected passkey.');
                    }}
                    disabled={passkeyCount <= 1}
                  />
                </NexusCard>
              ))}
            </View>
          </NexusCard>
        </View>

        <View className="flex-1 gap-4">
          <NexusCard className="gap-4">
            <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">Sessions and devices</Text>
            <View className="flex-row flex-wrap gap-3">
              <NexusActionButton label="Sign out" onPress={() => {
                void handleAction(async () => {
                  await signOut();
                  router.replace('/nexus/identity/sign-in?signed_out=true');
                }, 'Signed out the claimed session.');
              }} disabled={!hasActiveClaimedSession} />
              <NexusActionButton label="Sign out other devices" onPress={() => { void handleAction(() => revokeOtherSessions(), 'Revoked all other active sessions.'); }} disabled={!hasActiveClaimedSession || sessionSummaries.length <= 1} />
            </View>
            <View className="gap-3">
              {sessionSummaries.map((sessionSummary) => (
                <NexusCard key={sessionSummary.session_id} className={`gap-2 p-4 ${appearance.cardInsetClass}`}>
                  <Text className={appearance.itemTitleClass}>{sessionSummary.device_label}</Text>
                  <Text className={appearance.itemMetaClass}>
                    {sessionSummary.auth_method} · last seen {sessionSummary.last_seen_at}
                  </Text>
                  <View className="flex-row flex-wrap gap-3">
                    <NexusBadge label={sessionSummary.persistent_login ? 'Remembered session' : 'Non-remembered session'} tone="gold" />
                    {sessionSummary.is_current ? <NexusBadge label="Current device" tone="mint" /> : null}
                  </View>
                  <NexusActionButton
                    label="Revoke session"
                    onPress={() => {
                      void handleAction(() => revokeSession(sessionSummary.session_id), 'Revoked the selected session.');
                    }}
                    disabled={sessionSummary.is_current}
                  />
                </NexusCard>
              ))}
            </View>
          </NexusCard>

          <NexusCard className="gap-4">
            <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">Export encrypted bundle</Text>
            <IdentityField label="Export passphrase" hint="Used for the exported encrypted bundle only." error={exportPassphraseError ?? undefined}>
              <IdentityInput value={exportPassphrase} onChangeText={setExportPassphrase} placeholder="Passphrase for exported bundle" secureTextEntry />
            </IdentityField>
            <IdentityField label="Confirm export passphrase" error={exportPassphraseConfirmationError ?? undefined}>
              <IdentityInput value={exportPassphraseConfirmation} onChangeText={setExportPassphraseConfirmation} placeholder="Confirm export passphrase" secureTextEntry />
            </IdentityField>
            <View className="flex-row flex-wrap gap-3">
              <NexusActionButton label="Restore another bundle" onPress={() => router.push('/nexus/identity/restore')} />
              <NexusActionButton
                label="Export encrypted bundle"
                variant="primary"
                onPress={() => {
                  void handleAction(async () => {
                    const bundleJson = await exportCurrentIdentityBundle(exportPassphrase);
                    setExportedBundle(bundleJson);
                  }, 'Exported the current encrypted identity bundle.');
                }}
                disabled={!currentIdentity || !isCurrentIdentityUnlocked || Boolean(exportPassphraseError) || Boolean(exportPassphraseConfirmationError)}
              />
            </View>
            {exportedBundle ? (
              <IdentityInput value={exportedBundle} editable={false} multiline style={{ minHeight: 220, textAlignVertical: 'top' }} />
            ) : null}
          </NexusCard>

          {statusMessage ? (
            <NexusCard tone="mint">
              <Text className={appearance.itemBodyClass}>{statusMessage}</Text>
            </NexusCard>
          ) : null}
          {errorMessage ? (
            <NexusCard tone="rose">
              <Text className={appearance.itemBodyClass}>{errorMessage}</Text>
            </NexusCard>
          ) : null}
        </View>
      </View>
    </IdentityPageShell>
  );
}
