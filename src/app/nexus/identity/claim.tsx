/**
 * File: claim.tsx
 * Description: Renders the Nexus-shell guest-claim flow for continuing the current cryptographic actor as a claimed identity.
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
import { NexusActionButton, NexusBadge, NexusCard, useNexusAppearance } from '@app/components/nexus/nexus-ui';
import type { NexusSecurityMode } from '@runtime/nexus/nexus-api-types';
import {
  normalizeDisplayAlias,
  validateDisplayAlias,
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
  const params = useLocalSearchParams<{
    return_to?: string | string[];
    return_scope_id?: string | string[];
    home_scope_id?: string | string[];
    home_scope_name?: string | string[];
    home_scope_level?: string | string[];
    home_scope_path?: string | string[];
  }>();
  const router = useRouter();
  const appearance = useNexusAppearance();
  const { setActiveScopeId } = useNexusShell();
  const {
    claimCurrentGuest,
    currentLabel,
    currentMode,
    currentStorageMode,
    isAuthenticated,
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
  const { returnTo, returnScopeId } = getIdentityReturnDestination({
    returnToParam: params.return_to,
    returnScopeIdParam: params.return_scope_id,
    fallback: '/nexus/identity/security?welcome=claim',
  });
  const hasReturnTarget = returnTo !== '/nexus/identity/security?welcome=claim';
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

  const handleClaim = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await claimCurrentGuest({
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
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('already claimed') &&
        hasReturnTarget
      ) {
        await refreshAuthSession();
        navigateAfterSuccess();
        return;
      }

      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to claim this guest identity.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentMode === 'claimed') {
    if (isSubmitting) {
      return (
        <IdentityPageShell
          eyebrow="Identity"
          title="Finalizing identity"
          description="Completing sign-in and routing you into the next Nexus workspace."
        >
          <NexusCard>
            <Text className={appearance.itemBodyClass}>
              Completing sign-in and loading the next screen.
            </Text>
          </NexusCard>
        </IdentityPageShell>
      );
    }

    const isClaimReadyState = hasReturnTarget || isAuthenticated;

    return (
      <IdentityPageShell
        eyebrow="Identity"
        title={isClaimReadyState ? 'Identity ready' : 'This actor is already claimed'}
        description={
          isClaimReadyState
            ? 'This actor is already a claimed identity and the session is active. You can continue into the workspace or security surface.'
            : 'Claiming preserves guest continuity, but the currently selected actor is already a claimed identity.'
        }
      >
        <NexusCard className="gap-4">
          <Text className={appearance.itemBodyClass}>
            {isClaimReadyState
              ? 'Your claimed identity is ready to continue.'
              : 'Open identity security to manage passkeys, sessions, and exports, or create a fresh claimed identity if you want a separate actor.'}
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {hasReturnTarget ? (
              <NexusActionButton
                label="Return to workspace"
                variant="primary"
                onPress={navigateAfterSuccess}
              />
            ) : isAuthenticated ? (
              <NexusActionButton
                label="Open security"
                variant="primary"
                onPress={() => router.replace('/nexus/identity/security')}
              />
            ) : (
              <NexusActionButton
                label="Open security"
                variant="primary"
                onPress={() => router.replace('/nexus/identity/security')}
              />
            )}
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
          onCreateLocality={(query) => {
            const identityReturnParams = new URLSearchParams();

            if (returnTo !== '/nexus/identity/security?welcome=claim') {
              identityReturnParams.set('return_to', returnTo);
            }

            if (returnScopeId) {
              identityReturnParams.set('return_scope_id', returnScopeId);
            }

            const identityReturnTo = `/nexus/identity/claim${
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
            label={
              returnTo !== '/nexus/identity/security?welcome=claim'
                ? 'Go back'
                : 'Continue as guest'
            }
            onPress={() => {
              if (returnScopeId) {
                setActiveScopeId(returnScopeId);
              }

              router.push(
                returnTo !== '/nexus/identity/security?welcome=claim'
                  ? (returnTo as Href)
                  : '/nexus/account'
              );
            }}
          />
          <NexusActionButton
            label="Start fresh instead"
            onPress={() =>
              router.push(
                buildIdentityRouteHref({
                  pathname: '/nexus/identity/create',
                  returnTo:
                    returnTo !== '/nexus/identity/security?welcome=claim'
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
