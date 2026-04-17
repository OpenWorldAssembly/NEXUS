/**
 * File: claim.tsx
 * Description: Renders the Nexus-shell guest-claim flow for continuing the current cryptographic actor as a claimed identity.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  buildLocationDisclosure,
  IdentityField,
  IdentityInput,
  IdentityPageShell,
  IdentityPreferenceCard,
  type IdentityLocationSelection,
  LocationLookupField,
} from '@app/components/nexus/nexus-identity-ui';
import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import { NexusActionButton, NexusBadge, NexusCard, useNexusAppearance } from '@app/components/nexus/nexus-ui';
import type { NexusSecurityMode } from '@runtime/nexus/nexus-api-types';
import {
  normalizeDisplayAlias,
  validateDisplayAlias,
  validateLocationDisclosure,
  validatePassphrase,
  validatePassphraseConfirmation,
} from '@runtime/nexus/identity-validation';

function getStorageModeCopy(
  storageMode: 'none' | 'session_only' | 'saved_on_device' | null
) {
  if (storageMode === 'session_only') {
    return 'Session-only guest';
  }

  if (storageMode === 'saved_on_device') {
    return 'Saved guest';
  }

  return 'Temporary guest';
}

export default function NexusIdentityClaimPage() {
  const router = useRouter();
  const appearance = useNexusAppearance();
  const {
    claimCurrentGuest,
    currentLabel,
    currentMode,
    currentStorageMode,
    rememberClaimedSessions,
    refreshAuthSession,
    securityMode,
    setRememberClaimedSessions,
    setSecurityMode,
  } = useIdentityShell();
  const [alias, setAlias] = useState(currentLabel.startsWith('Guest ') ? '' : currentLabel);
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirmation, setPassphraseConfirmation] = useState('');
  const [locationSelection, setLocationSelection] = useState<IdentityLocationSelection>({
    query: '',
    selectedResult: null,
    selectedDisclosureIndex: null,
  });
  const [selectedRememberedSessions, setSelectedRememberedSessions] = useState(
    rememberClaimedSessions
  );
  const [selectedSecurityMode, setSelectedSecurityMode] = useState<NexusSecurityMode>(
    securityMode ?? 'guarded'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const locationDisclosure = buildLocationDisclosure(locationSelection);
  const aliasError =
    alias.length > 0 ? validateDisplayAlias(alias) : 'Display alias is required.';
  const passphraseError =
    passphrase.length > 0 ? validatePassphrase(passphrase) : 'Passphrase is required.';
  const passphraseConfirmationError =
    passphraseConfirmation.length > 0
      ? validatePassphraseConfirmation(passphrase, passphraseConfirmation)
      : 'Confirm the passphrase for this bundle.';
  const locationError =
    locationSelection.query.trim().length > 0 && !locationSelection.selectedResult
      ? 'Choose a canonical place from the lookup results.'
      : validateLocationDisclosure(locationDisclosure ?? null);

  const handleClaim = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await claimCurrentGuest({
        alias: normalizeDisplayAlias(alias),
        passphrase,
        keepMeLoggedIn: selectedRememberedSessions,
        locationDisclosure,
      });
      await refreshAuthSession();

      if (selectedSecurityMode !== 'guarded') {
        await setSecurityMode(selectedSecurityMode);
      }

      router.replace('/nexus/identity/security?welcome=claim');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to claim this guest identity.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentMode === 'claimed') {
    return (
      <IdentityPageShell
        eyebrow="Identity"
        title="This actor is already claimed"
        description="Claiming preserves guest continuity, but the currently selected actor is already a claimed identity."
      >
        <NexusCard className="gap-4">
          <Text className={appearance.itemBodyClass}>
            Open identity security to manage passkeys, sessions, and exports, or create a fresh claimed identity if you want a separate actor.
          </Text>
          <View className="flex-row flex-wrap gap-3">
            <NexusActionButton
              label="Open security"
              variant="primary"
              onPress={() => router.replace('/nexus/identity/security')}
            />
            <NexusActionButton
              label="Create fresh identity"
              onPress={() => router.push('/nexus/identity/create')}
            />
          </View>
        </NexusCard>
      </IdentityPageShell>
    );
  }

  return (
    <IdentityPageShell
      eyebrow="Identity"
      title="Claim the current guest"
      description="Keep this guest actor and continue forward as the same claimed identity."
    >
      <NexusCard className="gap-4">
        <Text className={appearance.surfaceTitleClass}>{currentLabel}</Text>
        <View className="flex-row flex-wrap gap-3">
          <NexusBadge label="Guest actor active" tone="sky" />
          <NexusBadge label={getStorageModeCopy(currentStorageMode)} />
        </View>
        <Text className={appearance.itemBodyClass}>
          This preserves the current actor and its packet history.
        </Text>
      </NexusCard>

      <NexusCard className="gap-4">
        <IdentityField
          label="Display alias"
          hint="Shown to others and changeable later. The cryptographic actor underneath stays the same."
          error={aliasError ?? undefined}
        >
          <IdentityInput
            value={alias}
            onChangeText={setAlias}
            placeholder="Display alias"
            autoCapitalize="words"
          />
        </IdentityField>

        <IdentityField
          label="Bundle passphrase"
          hint="This protects the encrypted local bundle created from the current guest actor."
          error={passphraseError ?? undefined}
        >
          <IdentityInput
            value={passphrase}
            onChangeText={setPassphrase}
            placeholder="Passphrase for encrypted local bundle"
            secureTextEntry
          />
        </IdentityField>

        <IdentityField
          label="Confirm passphrase"
          error={passphraseConfirmationError ?? undefined}
        >
          <IdentityInput
            value={passphraseConfirmation}
            onChangeText={setPassphraseConfirmation}
            placeholder="Confirm bundle passphrase"
            secureTextEntry
          />
        </IdentityField>

        <LocationLookupField
          selection={locationSelection}
          onChange={setLocationSelection}
          error={locationError ?? undefined}
        />

        <IdentityPreferenceCard
          title="Claimed-session preferences"
          description="Set the starting session and write behavior. You can change both later."
          rememberClaimedSessions={selectedRememberedSessions}
          securityMode={selectedSecurityMode}
          onChangeRememberClaimedSessions={(nextValue) => {
            setSelectedRememberedSessions(nextValue);
            void setRememberClaimedSessions(nextValue);
          }}
          onChangeSecurityMode={setSelectedSecurityMode}
        />

        <Text className="text-sm text-nexus-muted">
          Passkeys are optional extra protection. You can add one later from identity security.
        </Text>

        {errorMessage ? <Text className="text-sm text-nexus-rose">{errorMessage}</Text> : null}

        <View className="flex-row flex-wrap gap-3">
          <NexusActionButton
            label={isSubmitting ? 'Claiming guest identity...' : 'Claim current guest'}
            variant="primary"
            onPress={() => {
              void handleClaim();
            }}
            disabled={
              isSubmitting ||
              Boolean(aliasError) ||
              Boolean(passphraseError) ||
              Boolean(passphraseConfirmationError) ||
              Boolean(locationError)
            }
          />
          <NexusActionButton
            label="Continue as guest"
            onPress={() => router.push('/nexus/account')}
          />
          <NexusActionButton
            label="Start fresh instead"
            onPress={() => router.push('/nexus/identity/create')}
          />
        </View>
      </NexusCard>
    </IdentityPageShell>
  );
}
