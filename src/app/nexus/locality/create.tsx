/**
 * File: create.tsx
 * Description: Guided canonical locality creation flow for Nexus home-locality journeys.
 */

import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusSectionHeader,
  NexusSegmentedPill,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import type { NexusLocationSearchResult } from '@runtime/nexus/location-search';
import {
  createNexusLocality,
  fetchNexusLocationSearchPayload,
  NexusLocalityDuplicateWarningClientError,
  setNexusHomeLocality,
} from '@runtime/nexus/nexus-query-api';
import type { NexusLocalityDuplicateWarningPayload } from '@runtime/nexus/nexus-api-types';

type LocalityLevel = 'nation' | 'region' | 'city' | 'district';

const LOCALITY_LEVELS: LocalityLevel[] = ['nation', 'region', 'city', 'district'];

function getSingleParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function appendReturnParams(
  href: string,
  locality: NexusLocationSearchResult,
  returnScopeId: string | null
): Href {
  const [pathname, queryString = ''] = href.split('?');
  const params = new URLSearchParams(queryString);

  params.set('home_scope_id', locality.scope_id);
  params.set('home_scope_name', locality.name);
  params.set('home_scope_level', locality.level);
  params.set('home_scope_path', locality.path_label);

  if (returnScopeId) {
    params.set('return_scope_id', returnScopeId);
  }

  return `${pathname}?${params.toString()}` as Href;
}

function createLevelValues(query: string): Record<LocalityLevel, string> {
  return {
    nation: '',
    region: '',
    city: '',
    district: query,
  };
}

export default function NexusLocalityCreatePage() {
  const params = useLocalSearchParams<{
    return_to?: string | string[];
    return_scope_id?: string | string[];
    query?: string | string[];
    set_home?: string | string[];
  }>();
  const router = useRouter();
  const appearance = useNexusAppearance();
  const { activeScope, refreshShellData, setActiveScopeId } = useNexusShell();
  const { createVerifiedRequestBody, currentMode, isAuthenticated } = useIdentityShell();
  const returnTo = getSingleParam(params.return_to) ?? '/nexus/trust';
  const returnScopeId = getSingleParam(params.return_scope_id);
  const initialQuery = getSingleParam(params.query) ?? '';
  const shouldSetHome = getSingleParam(params.set_home) === '1';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<NexusLocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [finalLevel, setFinalLevel] = useState<LocalityLevel>('district');
  const [levelValues, setLevelValues] = useState<Record<LocalityLevel, string>>(
    () => createLevelValues(initialQuery)
  );
  const [duplicateWarnings, setDuplicateWarnings] = useState<
    NexusLocalityDuplicateWarningPayload[]
  >([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isClaimedIdentity = currentMode === 'claimed' && isAuthenticated;
  const visibleLevels = useMemo(
    () => LOCALITY_LEVELS.slice(0, LOCALITY_LEVELS.indexOf(finalLevel) + 1),
    [finalLevel]
  );
  const returnToSelf = `/nexus/locality/create?${new URLSearchParams({
    query: searchQuery,
    return_to: returnTo,
    ...(returnScopeId ? { return_scope_id: returnScopeId } : {}),
    ...(shouldSetHome ? { set_home: '1' } : {}),
  }).toString()}`;

  useEffect(() => {
    let isMounted = true;

    if (searchQuery.trim().length < 2) {
      setResults([]);
      return () => {
        isMounted = false;
      };
    }

    setIsSearching(true);
    const timeoutHandle = setTimeout(() => {
      void fetchNexusLocationSearchPayload(searchQuery)
        .then((payload) => {
          if (!isMounted) {
            return;
          }

          setResults(payload.results);
        })
        .catch((error) => {
          if (!isMounted) {
            return;
          }

          setResults([]);
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to search localities.'
          );
        })
        .finally(() => {
          if (isMounted) {
            setIsSearching(false);
          }
        });
    }, 220);

    return () => {
      isMounted = false;
      clearTimeout(timeoutHandle);
    };
  }, [searchQuery]);

  const handleSelectLocality = async (locality: NexusLocationSearchResult) => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (shouldSetHome) {
      if (!isClaimedIdentity) {
        setErrorMessage('Sign in with a claimed identity before setting home locality.');
        return;
      }

      try {
        const requestBody = await createVerifiedRequestBody(
          '/api/nexus/locality/home',
          'PUT',
          {
            home_scope_packet_id: locality.scope_id,
          }
        );

        await setNexusHomeLocality({ requestBody });
        await refreshShellData();

        if (returnScopeId) {
          setActiveScopeId(returnScopeId);
        }

        router.replace(returnTo as Href);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to set home locality.'
        );
      }

      return;
    }

    router.replace(appendReturnParams(returnTo, locality, returnScopeId));
  };

  const handleCreatePath = async (createAnyway = false) => {
    if (!isClaimedIdentity) {
      setErrorMessage('Sign in with a claimed identity before creating a public locality.');
      return;
    }

    const path = visibleLevels.map((level) => ({
      level,
      name: levelValues[level].trim(),
    }));

    if (path.some((entry) => entry.name.length < 2)) {
      setErrorMessage('Fill every level in the confirmed path before creating.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const requestBody = await createVerifiedRequestBody(
        '/api/nexus/locality',
        'POST',
        {
          path,
          create_anyway: createAnyway,
        }
      );
      const payload = await createNexusLocality({ requestBody });

      setDuplicateWarnings(payload.duplicate_warnings);
      setStatusMessage(
        payload.created_packets.length > 0
          ? `Created ${payload.created_packets.length} locality Element(s).`
          : 'Existing locality path reused.'
      );

      await handleSelectLocality(payload.final_result);
    } catch (error) {
      if (error instanceof NexusLocalityDuplicateWarningClientError) {
        setDuplicateWarnings(error.duplicateWarnings);
        setErrorMessage(error.message);
      } else {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to create locality.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className={appearance.pageContainerClass}>
        <NexusSectionHeader
          eyebrow="Locality"
          title="Find or create a locality"
          description="Search the Nexus locality directory first. If the place is missing, create a canonical geographic Element from a confirmed broad-to-narrow path. No third-party geocoder is used in this phase."
          trailing={<NexusBadge label={activeScope.name} tone="sky" />}
        />

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

        {!isClaimedIdentity ? (
          <NexusCard className="gap-4" tone="gold">
            <Text className={appearance.itemTitleClass}>Claimed identity required</Text>
            <Text className={appearance.itemBodyClass}>
              Browsing and selecting existing localities is available here, but minting a
              public locality Element requires a signed claimed identity.
            </Text>
            <View className="flex-row flex-wrap gap-3">
              <NexusActionButton
                label="Sign in"
                variant="primary"
                onPress={() =>
                  router.push({
                    pathname: '/nexus/identity/sign-in',
                    params: {
                      return_to: returnToSelf,
                      ...(returnScopeId ? { return_scope_id: returnScopeId } : {}),
                    },
                  } as Href)
                }
              />
              <NexusActionButton
                label="Claim current guest"
                onPress={() =>
                  router.push({
                    pathname: '/nexus/identity/claim',
                    params: {
                      return_to: returnToSelf,
                      ...(returnScopeId ? { return_scope_id: returnScopeId } : {}),
                    },
                  } as Href)
                }
              />
            </View>
          </NexusCard>
        ) : null}

        <NexusCard className="gap-4">
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
              Search existing localities
            </Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search locality or rough path"
              placeholderTextColor={appearance.textInputPlaceholderColor}
              className={`rounded-[18px] border px-4 py-3 ${appearance.textInputClass}`}
            />
            {isSearching ? (
              <Text className={appearance.itemMetaClass}>Searching Nexus directory...</Text>
            ) : null}
          </View>

          {results.length > 0 ? (
            <View className="gap-2">
              {results.map((result) => (
                <Pressable
                  key={result.scope_id}
                  className={`rounded-[18px] border px-4 py-3 ${appearance.cardInsetClass}`}
                  onPress={() => void handleSelectLocality(result)}
                >
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className={appearance.itemTitleClass}>{result.name}</Text>
                    <NexusBadge label={result.level} tone="sky" />
                    <NexusBadge label={result.match_type.replace(/_/g, ' ')} />
                  </View>
                  <Text className={appearance.itemMetaClass}>{result.path_label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text className={appearance.itemBodyClass}>
              Search by locality name, alias, packet id, or known path tokens.
            </Text>
          )}
        </NexusCard>

        <NexusCard className="gap-4">
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
              Create missing path
            </Text>
            <Text className={appearance.itemBodyClass}>
              Fill the confirmed path from broadest to narrowest. Existing exact matches
              are reused; similar matches warn before creation.
            </Text>
          </View>

          <View className="gap-2">
            <Text className={appearance.itemMetaClass}>Most specific level</Text>
            <NexusSegmentedPill
              options={LOCALITY_LEVELS.map((level) => ({
                id: level,
                label: level.toUpperCase(),
              }))}
              activeId={finalLevel}
              onSelect={(level) => setFinalLevel(level as LocalityLevel)}
            />
          </View>

          <View className="gap-3">
            {visibleLevels.map((level) => (
              <View key={level} className="gap-2">
                <Text className={appearance.itemMetaClass}>{level.toUpperCase()}</Text>
                <TextInput
                  value={levelValues[level]}
                  onChangeText={(nextValue) =>
                    setLevelValues((currentValues) => ({
                      ...currentValues,
                      [level]: nextValue,
                    }))
                  }
                  placeholder={`Canonical ${level} name`}
                  placeholderTextColor={appearance.textInputPlaceholderColor}
                  className={`rounded-[18px] border px-4 py-3 ${appearance.textInputClass}`}
                />
              </View>
            ))}
          </View>

          {duplicateWarnings.length > 0 ? (
            <NexusCard className={`gap-3 p-4 ${appearance.cardInsetClass}`} tone="gold">
              <Text className={appearance.itemTitleClass}>Possible duplicates</Text>
              {duplicateWarnings.map((warning) => (
                <Text key={`${warning.level}-${warning.existing_scope_id}`} className={appearance.itemBodyClass}>
                  {warning.message}
                </Text>
              ))}
            </NexusCard>
          ) : null}

          <View className="flex-row flex-wrap gap-3">
            <NexusActionButton
              label={isSubmitting ? 'Creating locality...' : 'Review and create'}
              variant="primary"
              disabled={isSubmitting || !isClaimedIdentity}
              onPress={() => void handleCreatePath(false)}
            />
            {duplicateWarnings.length > 0 ? (
              <NexusActionButton
                label="Create anyway"
                variant="ghost"
                disabled={isSubmitting || !isClaimedIdentity}
                onPress={() => void handleCreatePath(true)}
              />
            ) : null}
            <NexusActionButton
              label="Go back"
              onPress={() => {
                if (returnScopeId) {
                  setActiveScopeId(returnScopeId);
                }

                router.replace(returnTo as Href);
              }}
            />
          </View>
        </NexusCard>
      </View>
    </ScrollView>
  );
}
