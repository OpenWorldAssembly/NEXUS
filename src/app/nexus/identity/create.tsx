/**
 * File: create.tsx
 * Description: Renders the Nexus-shell claimed-identity creation flow with explicit starting session and write-approval preferences.
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
import { NexusActionButton, NexusCard } from '@app/components/nexus/nexus-ui';
import type { NexusSecurityMode } from '@runtime/nexus/nexus-api-types';
import {
  DISPLAY_ALIAS_MAX_LENGTH,
  normalizeDisplayAlias,
  validateDisplayAlias,
  validateLocationDisclosure,
  validatePassphrase,
  validatePassphraseConfirmation,
} from '@runtime/nexus/identity-validation';

export default function NexusIdentityCreatePage() {
  const router = useRouter();
  const {
    createClaimedIdentity,
    rememberClaimedSessions,
    refreshAuthSession,
    securityMode,
    setRememberClaimedSessions,
    setSecurityMode,
  } = useIdentityShell();
  const [alias, setAlias] = useState('');
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

  const handleCreate = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createClaimedIdentity({
        alias: normalizeDisplayAlias(alias),
        passphrase,
        keepMeLoggedIn: selectedRememberedSessions,
        locationDisclosure,
      });
      await refreshAuthSession();

      if (selectedSecurityMode !== 'guarded') {
        await setSecurityMode(selectedSecurityMode);
      }

      router.replace('/nexus/identity/security?welcome=create');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to create that claimed identity.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <IdentityPageShell
      eyebrow="Identity"
      title="Create a claimed identity"
      description="This creates a cryptographic person element inside Nexus. Your display alias is changeable later, while the underlying actor stays the same cryptographic anchor."
    >
      <NexusCard className="gap-4">
        <IdentityField
          label="Display alias"
          hint={`Shown to others, changeable later, and not treated as a permanent username. Maximum ${DISPLAY_ALIAS_MAX_LENGTH} characters.`}
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
          hint="This protects the encrypted local identity bundle on this device. It is separate from your passkey."
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
          rememberClaimedSessions={selectedRememberedSessions}
          securityMode={selectedSecurityMode}
          onChangeRememberClaimedSessions={(nextValue) => {
            setSelectedRememberedSessions(nextValue);
            void setRememberClaimedSessions(nextValue);
          }}
          onChangeSecurityMode={setSelectedSecurityMode}
          description="Set the starting session and write behavior. You can change both later."
        />

        <Text className="text-sm text-nexus-muted">
          Passkeys are optional extra protection. You can add one later from identity security.
        </Text>

        {errorMessage ? <Text className="text-sm text-nexus-rose">{errorMessage}</Text> : null}

        <View className="flex-row flex-wrap gap-3">
          <NexusActionButton
            label={isSubmitting ? 'Creating claimed identity...' : 'Create claimed identity'}
            variant="primary"
            onPress={() => {
              void handleCreate();
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
            label="Sign in instead"
            onPress={() => router.push('/nexus/identity/sign-in')}
          />
          <NexusActionButton
            label="Restore bundle"
            onPress={() => router.push('/nexus/identity/restore')}
          />
        </View>
      </NexusCard>
    </IdentityPageShell>
  );
}
