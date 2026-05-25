/**
 * File: create.tsx
 * Description: Renders the Nexus-shell claimed-identity creation flow with explicit starting session and write-approval preferences.
 */

import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { buildIdentityRouteHref, getIdentityReturnDestination } from '@app/components/nexus/nexus-route-utils';
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
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { NexusActionButton, NexusCard } from '@app/components/nexus/ui';
import type { NexusSecurityMode } from '@runtime/nexus/nexus-api-types';
import {
  DISPLAY_ALIAS_MAX_LENGTH,
  normalizeDisplayAlias,
  validateDisplayAlias,
  validatePassphrase,
  validatePassphraseConfirmation,
} from '@runtime/nexus/identity-validation';

export default function NexusIdentityCreatePage() {
  const params = useLocalSearchParams<{
    return_to?: string | string[];
    return_scope_id?: string | string[];
    home_scope_id?: string | string[];
    home_scope_name?: string | string[];
    home_scope_level?: string | string[];
    home_scope_path?: string | string[];
  }>();
  const router = useRouter();
  const { setActiveScopeId } = useNexusShell();
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
  const { returnTo, returnScopeId } = getIdentityReturnDestination({
    returnToParam: params.return_to,
    returnScopeIdParam: params.return_scope_id,
    fallback: '/nexus/identity/security?welcome=create',
  });
  const returnedHomeScopeId = Array.isArray(params.home_scope_id)
    ? params.home_scope_id[0]
    : params.home_scope_id;
  const returnedHomeScopeName = Array.isArray(params.home_scope_name)
    ? params.home_scope_name[0]
    : params.home_scope_name;
  const returnedHomeScopeLevel = Array.isArray(params.home_scope_level)
    ? params.home_scope_level[0]
    : params.home_scope_level;
  const returnedHomeScopePath = Array.isArray(params.home_scope_path)
    ? params.home_scope_path[0]
    : params.home_scope_path;

  useEffect(() => {
    if (!returnedHomeScopeId || !returnedHomeScopeName) {
      return;
    }

    const level = ['nation', 'region', 'city', 'district'].includes(
      returnedHomeScopeLevel ?? ''
    )
      ? (returnedHomeScopeLevel as 'nation' | 'region' | 'city' | 'district')
      : 'district';

    setLocationSelection({
      query: returnedHomeScopeName,
      selectedResult: {
        scope_id: returnedHomeScopeId,
        name: returnedHomeScopeName,
        short_label: returnedHomeScopeName,
        locality_label: returnedHomeScopeName,
        level,
        path_label: returnedHomeScopePath ?? returnedHomeScopeName,
        parent_path_label: null,
        canonical_name_key: returnedHomeScopeName.toLowerCase(),
        match_type: 'exact',
        description: `${returnedHomeScopeName} locality`,
        disclosure_options: [],
      },
      selectedDisclosureIndex: null,
    });
  }, [
    returnedHomeScopeId,
    returnedHomeScopeLevel,
    returnedHomeScopeName,
    returnedHomeScopePath,
  ]);

  const navigateAfterSuccess = () => {
    if (returnScopeId) {
      setActiveScopeId(returnScopeId);
    }

    router.replace(returnTo as Href);
  };

  const locationDisclosure = buildLocationDisclosure(locationSelection);
  const residenceScopePacketId = locationSelection.selectedResult?.scope_id ?? null;
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
      : null;

  const handleCreate = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createClaimedIdentity({
        alias: normalizeDisplayAlias(alias),
        passphrase,
        keepMeLoggedIn: selectedRememberedSessions,
        locationDisclosure,
        residenceScopePacketId,
      });
      await refreshAuthSession();

      if (selectedSecurityMode !== 'guarded') {
        await setSecurityMode(selectedSecurityMode);
      }

      navigateAfterSuccess();
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
          onCreateLocality={(query) => {
            const identityReturnParams = new URLSearchParams();

            if (returnTo !== '/nexus/identity/security?welcome=create') {
              identityReturnParams.set('return_to', returnTo);
            }

            if (returnScopeId) {
              identityReturnParams.set('return_scope_id', returnScopeId);
            }

            const identityReturnTo = `/nexus/identity/create${
              identityReturnParams.toString().length > 0
                ? `?${identityReturnParams.toString()}`
                : ''
            }`;

            router.push({
              pathname: '/nexus/locality/create',
              params: {
                query,
                return_to: identityReturnTo,
                ...(returnScopeId ? { return_scope_id: returnScopeId } : {}),
              },
            } as Href);
          }}
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
          {returnTo !== '/nexus/identity/security?welcome=create' ? (
            <NexusActionButton
              label="Go back"
              onPress={() => {
                if (returnScopeId) {
                  setActiveScopeId(returnScopeId);
                }

                router.push(returnTo as Href);
              }}
            />
          ) : null}
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
            onPress={() =>
              router.push(
                buildIdentityRouteHref({
                  pathname: '/nexus/identity/sign-in',
                  returnTo:
                    returnTo !== '/nexus/identity/security?welcome=create'
                      ? returnTo
                      : null,
                  returnScopeId,
                })
              )
            }
          />
          <NexusActionButton
            label="Restore bundle"
            onPress={() =>
              router.push(
                buildIdentityRouteHref({
                  pathname: '/nexus/identity/restore',
                  returnTo:
                    returnTo !== '/nexus/identity/security?welcome=create'
                      ? returnTo
                      : null,
                  returnScopeId,
                })
              )
            }
          />
        </View>
      </NexusCard>
    </IdentityPageShell>
  );
}
