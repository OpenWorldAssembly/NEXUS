/**
 * File: sign-in.tsx
 * Description: Renders the Nexus-shell claimed-identity sign-in entrypoint with local, passkey, and import tabs.
 */

import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { buildIdentityRouteHref, getIdentityReturnDestination } from '@app/components/nexus/nexus-route-utils';
import {
  IdentityField,
  IdentityInput,
  IdentityPageShell,
} from '@app/components/nexus/nexus-identity-ui';
import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  NexusActionButton,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/ui';
import { NexusTabRail, type NexusTabNode } from '@app/components/nexus/ui/tabs/nexus-tabs';
import type { NexusIdentitySearchResultPayload } from '@runtime/nexus/nexus-api-types';
import { fetchNexusIdentitySearchPayload } from '@runtime/nexus/nexus-query-api';
import {
  validateEncryptedBundleJson,
  validatePassphrase,
} from '@runtime/nexus/identity-validation';

type SignInMode = 'local' | 'passkey' | 'import';

const IDENTITY_MODE_TAB_NODES: NexusTabNode[] = [
  { id: 'local', label: 'Saved / Find identity', shortLabel: 'Saved / Find' },
  { id: 'passkey', label: 'Passkey' },
  { id: 'import', label: 'Import bundle', shortLabel: 'Import' },
];

function getStorageModeCopy(
  storageMode: 'none' | 'session_only' | 'saved_on_device' | null
) {
  if (storageMode === 'session_only') {
    return 'Session-only browser actor';
  }

  if (storageMode === 'saved_on_device') {
    return 'Saved on this device';
  }

  return 'Temporary guest actor';
}

function dedupeIdentityOptions(
  identities: NexusIdentitySearchResultPayload[]
): NexusIdentitySearchResultPayload[] {
  const identityMap = new Map<string, NexusIdentitySearchResultPayload>();

  identities.forEach((identity) => {
    const currentIdentity = identityMap.get(identity.actor_packet_id);

    if (!currentIdentity) {
      identityMap.set(identity.actor_packet_id, identity);
      return;
    }

    identityMap.set(identity.actor_packet_id, {
      ...currentIdentity,
      ...identity,
      saved_on_device: currentIdentity.saved_on_device || identity.saved_on_device,
      display_alias:
        identity.display_alias || currentIdentity.display_alias,
    });
  });

  return Array.from(identityMap.values());
}

export default function NexusIdentitySignInPage() {
  const params = useLocalSearchParams<{
    signed_out?: string | string[];
    return_to?: string | string[];
    return_scope_id?: string | string[];
  }>();
  const router = useRouter();
  const appearance = useNexusAppearance();
  const { setActiveScopeId } = useNexusShell();
  const {
    currentLabel,
    currentActorPacketId,
    currentMode,
    currentStorageMode,
    isAuthenticated,
    isCurrentIdentityUnlocked,
    isPasskeySupported,
    rememberClaimedSessions,
    restoreIdentityFromBundle,
    signInStoredIdentity,
    signInWithPasskey,
    storedIdentityPreviews,
  } = useIdentityShell();
  const claimedIdentities = useMemo(
    () => storedIdentityPreviews.filter((identity) => identity.stored_kind === 'claimed'),
    [storedIdentityPreviews]
  );
  const [activeMode, setActiveMode] = useState<SignInMode>('local');
  const [identityQuery, setIdentityQuery] = useState('');
  const [selectedIdentityId, setSelectedIdentityId] = useState('');
  const [identityResults, setIdentityResults] = useState<
    NexusIdentitySearchResultPayload[]
  >([]);
  const [identitySearchError, setIdentitySearchError] = useState<string | null>(null);
  const [isSearchingIdentities, setIsSearchingIdentities] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [bundleJson, setBundleJson] = useState('');
  const [bundlePassphrase, setBundlePassphrase] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<'bundle' | 'passkey' | 'import' | null>(null);
  const normalizedIdentityQuery = identityQuery.trim().toLowerCase();
  const hasActiveClaimedSession = currentMode === 'claimed' && isAuthenticated;
  const signedOut =
    typeof params.signed_out === 'string'
      ? params.signed_out === 'true'
      : Array.isArray(params.signed_out)
        ? params.signed_out[0] === 'true'
        : false;
  const { returnTo, returnScopeId } = getIdentityReturnDestination({
    returnToParam: params.return_to,
    returnScopeIdParam: params.return_scope_id,
    fallback: '/nexus/identity/security',
  });
  const hasReturnTarget = returnTo !== '/nexus/identity/security';

  const navigateAfterIdentitySuccess = () => {
    if (returnScopeId) {
      setActiveScopeId(returnScopeId);
    }

    router.replace(returnTo as Href);
  };

  useEffect(() => {
    let isMounted = true;

    if (normalizedIdentityQuery.length < 2) {
      setIdentityResults([]);
      setIdentitySearchError(null);
      setIsSearchingIdentities(false);
      return () => {
        isMounted = false;
      };
    }

    setIsSearchingIdentities(true);
    const timeoutHandle = setTimeout(() => {
      void fetchNexusIdentitySearchPayload({
        query: identityQuery,
        savedActorPacketIds: claimedIdentities.map((identity) => identity.actor_packet_id),
      })
        .then((payload) => {
          if (!isMounted) {
            return;
          }

          setIdentityResults(payload.results);
          setIdentitySearchError(null);
        })
        .catch((nextError) => {
          if (!isMounted) {
            return;
          }

          setIdentityResults([]);
          setIdentitySearchError(
            nextError instanceof Error
              ? nextError.message
              : 'Unable to search identities right now.'
          );
        })
        .finally(() => {
          if (isMounted) {
            setIsSearchingIdentities(false);
          }
        });
    }, 220);

    return () => {
      isMounted = false;
      clearTimeout(timeoutHandle);
    };
  }, [claimedIdentities, identityQuery, normalizedIdentityQuery]);

  const visibleIdentities = useMemo(() => {
    if (normalizedIdentityQuery.length === 0) {
      return dedupeIdentityOptions(
        claimedIdentities.map((identity) => ({
          actor_packet_id: identity.actor_packet_id,
          display_alias: identity.alias,
          claim_status: identity.claim_status,
          saved_on_device: true,
          match_source: 'alias' as const,
        }))
      );
    }

    return dedupeIdentityOptions(identityResults);
  }, [claimedIdentities, identityResults, normalizedIdentityQuery]);
  const selectableIdentityMap = useMemo(() => {
    const nextMap = new Map<string, NexusIdentitySearchResultPayload>();

    claimedIdentities.forEach((identity) => {
      nextMap.set(identity.actor_packet_id, {
        actor_packet_id: identity.actor_packet_id,
        display_alias: identity.alias,
        claim_status: identity.claim_status,
        saved_on_device: true,
        match_source: 'alias',
      });
    });
    identityResults.forEach((identity) => {
      nextMap.set(identity.actor_packet_id, identity);
    });

    return nextMap;
  }, [claimedIdentities, identityResults]);

  useEffect(() => {
    if (visibleIdentities.length > 0 && selectedIdentityId.length === 0) {
      setSelectedIdentityId(visibleIdentities[0]?.actor_packet_id ?? '');
      return;
    }

    if (visibleIdentities.length === 0 && normalizedIdentityQuery.length === 0) {
      setSelectedIdentityId('');
    }
  }, [normalizedIdentityQuery.length, selectedIdentityId, visibleIdentities]);

  const selectedIdentity = selectableIdentityMap.get(selectedIdentityId) ?? null;
  const showIdentityResults =
    visibleIdentities.length > 0 &&
    (!selectedIdentity ||
      normalizedIdentityQuery.length === 0 ||
      normalizedIdentityQuery !==
        (selectedIdentity.display_alias || selectedIdentity.actor_packet_id)
          .trim()
          .toLowerCase());
  const showSelectedIdentityCard = selectedIdentity !== null && !showIdentityResults;
  const selectedIdentityIsCurrentActor =
    selectedIdentity?.actor_packet_id === currentActorPacketId;
  const bundleActionLabel =
    isBusy === 'bundle'
      ? 'Signing in...'
      : selectedIdentityIsCurrentActor && currentMode === 'claimed' && !hasActiveClaimedSession
        ? 'Resume this identity'
        : selectedIdentityIsCurrentActor &&
            currentMode === 'claimed' &&
            hasActiveClaimedSession &&
            !isCurrentIdentityUnlocked
          ? 'Unlock this identity'
          : 'Sign in';

  const passphraseError =
    passphrase.length > 0 ? validatePassphrase(passphrase) : 'Passphrase is required.';
  const bundleJsonError =
    bundleJson.length > 0
      ? validateEncryptedBundleJson(bundleJson)
      : 'Paste an encrypted identity bundle.';
  const bundlePassphraseError =
    bundlePassphrase.length > 0
      ? validatePassphrase(bundlePassphrase)
      : 'Bundle passphrase is required.';

  const handleBundleSignIn = async () => {
    setIsBusy('bundle');
    setErrorMessage(null);

    try {
      await signInStoredIdentity({
        actorPacketId: selectedIdentityId,
        passphrase,
        keepMeLoggedIn: rememberClaimedSessions,
      });
      navigateAfterIdentitySuccess();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to sign in right now.'
      );
    } finally {
      setIsBusy(null);
    }
  };

  const handlePasskeySignIn = async () => {
    setIsBusy('passkey');
    setErrorMessage(null);

    try {
      await signInWithPasskey({
        keepMeLoggedIn: rememberClaimedSessions,
      });
      navigateAfterIdentitySuccess();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to sign in with a passkey.'
      );
    } finally {
      setIsBusy(null);
    }
  };

  const handleImport = async () => {
    setIsBusy('import');
    setErrorMessage(null);

    try {
      await restoreIdentityFromBundle({
        encryptedBundleJson: bundleJson,
        passphrase: bundlePassphrase,
      });
      navigateAfterIdentitySuccess();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to restore that bundle.'
      );
    } finally {
      setIsBusy(null);
    }
  };

  return (
    <IdentityPageShell
      eyebrow="Identity"
      title="Sign in to a claimed identity"
      description="Find a claimed identity in Nexus, unlock one already saved on this device, use a device passkey, or import an encrypted bundle. Restore/import is the recovery path, not the normal everyday sign-in path."
    >
      {signedOut ? (
        <NexusCard tone="gold">
          <Text className={appearance.itemBodyClass}>
            Signed out. Nexus has already switched you back to a guest actor, so you can keep browsing or sign into another identity.
          </Text>
        </NexusCard>
      ) : null}

      <NexusCard className="gap-4">
        <View className="gap-2">
          <Text className={appearance.surfaceTitleClass}>Current actor</Text>
          <Text className="text-2xl font-bold text-nexus-text">{currentLabel}</Text>
          <Text className={appearance.itemBodyClass}>
            {hasActiveClaimedSession
              ? currentMode === 'claimed'
                ? isCurrentIdentityUnlocked
                  ? 'Claimed session active. This identity is ready for signed writes on this device.'
                  : 'Claimed session active. Unlock this saved identity bundle to resume signed writes on this device.'
                : `Claimed session active. ${getStorageModeCopy(currentStorageMode)}.`
              : currentMode === 'claimed'
                ? 'This claimed identity is saved on this device, but no claimed session is active. Resume it here when you are ready.'
                : `Guest actor active. ${getStorageModeCopy(currentStorageMode)}.`}
          </Text>
        </View>
      </NexusCard>

      <View className="gap-0">
        <NexusTabRail
          activeId={activeMode}
          maxRows={2}
          nodes={IDENTITY_MODE_TAB_NODES}
          onSelect={(nextValue) => setActiveMode(nextValue as SignInMode)}
          truncate="middle"
          wrapMode="wrap"
        />

        <NexusCard className="gap-4 rounded-t-none border-t-0">
        {activeMode === 'local' ? (
          <View className="gap-4">
            <View className="gap-2">
              <Text className={appearance.surfaceTitleClass}>Saved or known identity</Text>
              <Text className={appearance.itemBodyClass}>
                Search the Nexus graph by display alias, packet id, or public-key-related match. If the identity is already saved on this device, unlock it with its bundle passphrase.
              </Text>
            </View>

            <IdentityField
              label="Find identity"
              hint="Search Nexus by display alias, packet id, or key match."
              error={identitySearchError ?? undefined}
            >
              <IdentityInput
                value={identityQuery}
                onChangeText={setIdentityQuery}
                placeholder="Search claimed identities in Nexus"
              />
            </IdentityField>

            {showSelectedIdentityCard ? (
              <View className="gap-2">
                <Text className={appearance.itemMetaClass}>Selected identity</Text>
                <View className="rounded-[18px] border border-nexus-sky bg-nexus-sky/10 px-4 py-3">
                  <Text className={appearance.itemTitleClass}>{selectedIdentity.display_alias}</Text>
                  <Text className={appearance.itemMetaClass}>
                    {selectedIdentity.actor_packet_id}
                  </Text>
                  <Text className={appearance.itemMetaClass}>
                    {selectedIdentity.saved_on_device
                      ? 'Saved on this device'
                      : 'Known in Nexus, but not saved on this device'}
                  </Text>
                </View>
              </View>
            ) : null}

            {isSearchingIdentities ? (
              <Text className={appearance.itemMetaClass}>Searching identities…</Text>
            ) : null}

            {visibleIdentities.length === 0 ? (
              <NexusCard className={`gap-3 p-4 ${appearance.cardInsetClass}`}>
                <Text className={appearance.itemBodyClass}>
                  {normalizedIdentityQuery.length > 0
                    ? 'No claimed identities match this search in Nexus.'
                    : 'No claimed identities are saved on this device yet.'}
                </Text>
              </NexusCard>
            ) : showIdentityResults ? (
              <View className="gap-3">
                {visibleIdentities.map((identity) => {
                  const isSelected = selectedIdentityId === identity.actor_packet_id;

                  return (
                    <Pressable
                      key={identity.actor_packet_id}
                      className={`rounded-[18px] border px-4 py-3 ${
                        isSelected
                          ? 'border-nexus-sky bg-nexus-sky/10'
                          : appearance.cardInsetClass
                      }`}
                      onPress={() => {
                        setSelectedIdentityId(identity.actor_packet_id);
                        setIdentityQuery(identity.display_alias ?? '');
                      }}
                    >
                      <Text className={appearance.itemTitleClass}>
                        {identity.display_alias}
                      </Text>
                      <Text className={appearance.itemMetaClass}>
                        {identity.actor_packet_id}
                      </Text>
                      <Text className={appearance.itemMetaClass}>
                        {identity.saved_on_device
                          ? 'Saved on this device'
                          : 'Known in Nexus only'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <IdentityField
              label="Bundle passphrase"
              hint="This unlocks the encrypted local identity bundle. It is not the passkey."
              error={
                selectedIdentity && !selectedIdentity.saved_on_device
                  ? 'This identity is not saved on this device. Import its bundle or use passkey sign-in instead.'
                  : (passphraseError ?? undefined)
              }
            >
              <IdentityInput
                value={passphrase}
                onChangeText={setPassphrase}
                placeholder="Passphrase for the selected saved identity"
                secureTextEntry
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (
                    visibleIdentities.length > 0 &&
                    selectedIdentityId.length > 0 &&
                    selectedIdentity?.saved_on_device &&
                    !passphraseError &&
                    isBusy === null
                  ) {
                    void handleBundleSignIn();
                  }
                }}
              />
            </IdentityField>

            <NexusActionButton
              label={bundleActionLabel}
              variant="primary"
              onPress={() => {
                void handleBundleSignIn();
              }}
              disabled={
                isBusy !== null ||
                visibleIdentities.length === 0 ||
                selectedIdentityId.length === 0 ||
                !selectedIdentity?.saved_on_device ||
                Boolean(passphraseError)
              }
            />
          </View>
        ) : null}

        {activeMode === 'passkey' ? (
          <View className="gap-4">
            <View className="gap-2">
              <Text className={appearance.surfaceTitleClass}>Device passkey</Text>
              <Text className={appearance.itemBodyClass}>
                This uses your device or browser authenticator, like Windows Hello, a phone, or a security key. It is not a pasted file or a copied string.
              </Text>
            </View>

            {!isPasskeySupported ? (
              <Text className="text-sm text-nexus-rose">
                Passkeys are unavailable in this environment.
              </Text>
            ) : null}

            <Text className={appearance.itemMetaClass}>
              Passkey sign-in creates the claimed session. If you want to write packets on this device afterward, you may still need to unlock the saved local identity bundle.
            </Text>

            <NexusActionButton
              label={isBusy === 'passkey' ? 'Checking passkey...' : 'Sign in with passkey'}
              variant="primary"
              onPress={() => {
                void handlePasskeySignIn();
              }}
              disabled={isBusy !== null || !isPasskeySupported}
            />
          </View>
        ) : null}

        {activeMode === 'import' ? (
          <View className="gap-4">
            <View className="gap-2">
              <Text className={appearance.surfaceTitleClass}>Import encrypted bundle</Text>
              <Text className={appearance.itemBodyClass}>
                Use this when the identity is not already saved on this device. Import adds the encrypted bundle locally and then signs it in.
              </Text>
            </View>

            <IdentityField
              label="Encrypted identity bundle"
              error={bundleJsonError ?? undefined}
            >
              <IdentityInput
                value={bundleJson}
                onChangeText={setBundleJson}
                placeholder="Paste encrypted identity bundle JSON"
                multiline
                style={{ minHeight: 180, textAlignVertical: 'top' }}
              />
            </IdentityField>

            <IdentityField
              label="Bundle passphrase"
              hint="This decrypts the imported bundle locally."
              error={bundlePassphraseError ?? undefined}
            >
              <IdentityInput
                value={bundlePassphrase}
                onChangeText={setBundlePassphrase}
                placeholder="Passphrase used for this encrypted bundle"
                secureTextEntry
              />
            </IdentityField>

            <NexusActionButton
              label={isBusy === 'import' ? 'Importing...' : 'Import and sign in'}
              variant="primary"
              onPress={() => {
                void handleImport();
              }}
              disabled={
                isBusy !== null ||
                Boolean(bundleJsonError) ||
                Boolean(bundlePassphraseError)
              }
            />
          </View>
        ) : null}
        </NexusCard>
      </View>

      <NexusCard className="gap-4">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          Other paths
        </Text>
        <View className="flex-row flex-wrap gap-3">
          <NexusActionButton
            label={hasReturnTarget ? 'Go back' : 'Continue as guest'}
            onPress={() => {
              if (returnScopeId) {
                setActiveScopeId(returnScopeId);
              }

              router.push((hasReturnTarget ? returnTo : '/nexus/account') as Href);
            }}
          />
          {currentMode !== 'claimed' ? (
            <NexusActionButton
              label="Claim current guest"
              variant="primary"
              onPress={() =>
                router.push(
                  buildIdentityRouteHref({
                    pathname: '/nexus/identity/claim',
                    returnTo: hasReturnTarget ? returnTo : null,
                    returnScopeId,
                  })
                )
              }
            />
          ) : null}
          <NexusActionButton
            label="Create new"
            onPress={() =>
              router.push(
                buildIdentityRouteHref({
                  pathname: '/nexus/identity/create',
                  returnTo: hasReturnTarget ? returnTo : null,
                  returnScopeId,
                })
              )
            }
          />
        </View>
      </NexusCard>

      {errorMessage ? (
        <NexusCard tone="rose">
          <Text className={appearance.itemBodyClass}>{errorMessage}</Text>
        </NexusCard>
      ) : null}
    </IdentityPageShell>
  );
}
