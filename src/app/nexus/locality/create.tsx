/**
 * File: create.tsx
 * Description: Guided canonical locality creation flow for Nexus home-locality journeys.
 */

import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import { useNexusAuthGate } from '@app/components/nexus/nexus-auth-gate';
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
  fetchNexusLocationSearchPayload,
} from '@runtime/nexus/nexus-query-api';
import type { NexusLocalityDuplicateWarningPayload } from '@runtime/nexus/nexus-api-types';
import { NexusApiError } from '@runtime/nexus/nexus-query-api.shared';

type LocalityLevel = 'nation' | 'region' | 'city' | 'district';

const LOCALITY_LEVELS: LocalityLevel[] = ['nation', 'region', 'city', 'district'];

type LocalityLevelEntry = {
  query: string;
  selectedResult: NexusLocationSearchResult | null;
  isNew: boolean;
};

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

function toRouteScopeId(packetId: string): string {
  if (packetId.startsWith('nexus:element/')) {
    return packetId.slice('nexus:element/'.length);
  }

  return packetId.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function createLevelEntry(query = ''): LocalityLevelEntry {
  return {
    query,
    selectedResult: null,
    isNew: false,
  };
}

function createLevelEntries(query: string): Record<LocalityLevel, LocalityLevelEntry> {
  return {
    nation: createLevelEntry(),
    region: createLevelEntry(),
    city: createLevelEntry(),
    district: createLevelEntry(query),
  };
}

function getLevelLabel(level: LocalityLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function getPreviousLevel(level: LocalityLevel): LocalityLevel | null {
  const levelIndex = LOCALITY_LEVELS.indexOf(level);

  if (levelIndex <= 0) {
    return null;
  }

  return LOCALITY_LEVELS[levelIndex - 1];
}

function clearDownstreamEntries(
  entries: Record<LocalityLevel, LocalityLevelEntry>,
  level: LocalityLevel
): Record<LocalityLevel, LocalityLevelEntry> {
  const levelIndex = LOCALITY_LEVELS.indexOf(level);

  return Object.fromEntries(
    LOCALITY_LEVELS.map((currentLevel, index) => [
      currentLevel,
      index > levelIndex ? createLevelEntry() : entries[currentLevel],
    ])
  ) as Record<LocalityLevel, LocalityLevelEntry>;
}

function LocalityLevelSearchRow(input: {
  level: LocalityLevel;
  entry: LocalityLevelEntry;
  isEnabled: boolean;
  parentResult: NexusLocationSearchResult | null;
  parentIsPendingNew: boolean;
  onQueryChange: (level: LocalityLevel, query: string) => void;
  onSelectResult: (level: LocalityLevel, result: NexusLocationSearchResult) => void;
  onUseNew: (level: LocalityLevel) => void;
  onClear: (level: LocalityLevel) => void;
}) {
  const appearance = useNexusAppearance();
  const [results, setResults] = useState<NexusLocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const query = input.entry.query.trim();
  const parentScopeId = input.parentResult?.scope_id ?? null;
  const shouldSearch =
    input.isEnabled &&
    !input.parentIsPendingNew &&
    !input.entry.selectedResult &&
    !input.entry.isNew &&
    query.length >= 2;

  useEffect(() => {
    let isMounted = true;

    if (!shouldSearch) {
      setResults([]);
      setIsSearching(false);
      return () => {
        isMounted = false;
      };
    }

    setIsSearching(true);
    const timeoutHandle = setTimeout(() => {
      void fetchNexusLocationSearchPayload(query, {
        level: input.level,
        parentScopeId,
      })
        .then((payload) => {
          if (!isMounted) {
            return;
          }

          setResults(payload.results);
        })
        .catch(() => {
          if (!isMounted) {
            return;
          }

          setResults([]);
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
  }, [input.level, parentScopeId, query, shouldSearch]);

  const pendingParentCopy = input.parentIsPendingNew
    ? `This ${input.level} will be created under the pending new parent after review.`
    : null;
  const useNewLabel = `Use as new ${input.level}`;
  const canUseNew = input.isEnabled && query.length >= 2 && !input.entry.selectedResult;

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className={appearance.itemMetaClass}>{input.level.toUpperCase()}</Text>
        {input.entry.selectedResult ? (
          <NexusBadge label="existing" tone="mint" />
        ) : input.entry.isNew ? (
          <NexusBadge label="new candidate" tone="gold" />
        ) : null}
      </View>
      <TextInput
        value={input.entry.query}
        editable={input.isEnabled && !input.entry.selectedResult && !input.entry.isNew}
        onChangeText={(nextQuery) => input.onQueryChange(input.level, nextQuery)}
        placeholder={
          input.isEnabled
            ? `Search or enter ${input.level}`
            : `Choose ${getLevelLabel(getPreviousLevel(input.level) ?? 'nation').toLowerCase()} first`
        }
        placeholderTextColor={appearance.textInputPlaceholderColor}
        className={`rounded-[18px] border px-4 py-3 ${
          input.isEnabled ? appearance.textInputClass : appearance.cardInsetClass
        }`}
      />

      {pendingParentCopy ? (
        <Text className={appearance.itemMetaClass}>{pendingParentCopy}</Text>
      ) : null}

      {input.entry.selectedResult ? (
        <View className={`gap-2 rounded-[18px] border px-4 py-3 ${appearance.cardInsetClass}`}>
          <Text className={appearance.itemTitleClass}>{input.entry.selectedResult.name}</Text>
          <Text className={appearance.itemMetaClass}>
            {input.entry.selectedResult.path_label}
          </Text>
          <NexusActionButton
            label="Change"
            variant="ghost"
            onPress={() => input.onClear(input.level)}
          />
        </View>
      ) : null}

      {input.entry.isNew ? (
        <View className={`gap-2 rounded-[18px] border px-4 py-3 ${appearance.cardInsetClass}`}>
          <Text className={appearance.itemTitleClass}>{input.entry.query}</Text>
          <Text className={appearance.itemBodyClass}>
            This {input.level} will be created only after duplicate checks pass.
          </Text>
          <NexusActionButton
            label="Change"
            variant="ghost"
            onPress={() => input.onClear(input.level)}
          />
        </View>
      ) : null}

      {isSearching ? (
        <Text className={appearance.itemMetaClass}>Searching this level...</Text>
      ) : null}

      {results.length > 0 ? (
        <View className="gap-2">
          {results.map((result) => (
            <Pressable
              key={result.scope_id}
              className={`rounded-[18px] border px-4 py-3 ${appearance.cardInsetClass}`}
              onPress={() => input.onSelectResult(input.level, result)}
            >
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className={appearance.itemTitleClass}>{result.name}</Text>
                <NexusBadge label={result.match_type.replace(/_/g, ' ')} />
              </View>
              <Text className={appearance.itemMetaClass}>{result.path_label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {canUseNew ? (
        <NexusActionButton
          label={useNewLabel}
          variant="ghost"
          onPress={() => input.onUseNew(input.level)}
        />
      ) : null}
    </View>
  );
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
  const { currentMode, isAuthenticated, runFortressMutation } = useIdentityShell();
  const returnTo = getSingleParam(params.return_to) ?? '/nexus/trust';
  const returnScopeId = getSingleParam(params.return_scope_id);
  const initialQuery = getSingleParam(params.query) ?? '';
  const shouldSetHome = getSingleParam(params.set_home) === '1';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<NexusLocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [finalLevel, setFinalLevel] = useState<LocalityLevel>('district');
  const [levelEntries, setLevelEntries] = useState<
    Record<LocalityLevel, LocalityLevelEntry>
  >(
    () => createLevelEntries(initialQuery)
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
  const { authGateModal, guardNexusWrite, openNexusAuthGateForError } =
    useNexusAuthGate({
      returnTo: returnToSelf,
      returnScopeId,
    });

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

  const handleLevelQueryChange = (level: LocalityLevel, query: string) => {
    setDuplicateWarnings([]);
    setLevelEntries((currentEntries) =>
      clearDownstreamEntries(
        {
          ...currentEntries,
          [level]: {
            query,
            selectedResult: null,
            isNew: false,
          },
        },
        level
      )
    );
  };

  const handleSelectLevelResult = (
    level: LocalityLevel,
    result: NexusLocationSearchResult
  ) => {
    setDuplicateWarnings([]);
    setLevelEntries((currentEntries) =>
      clearDownstreamEntries(
        {
          ...currentEntries,
          [level]: {
            query: result.name,
            selectedResult: result,
            isNew: false,
          },
        },
        level
      )
    );
  };

  const handleUseNewLevel = (level: LocalityLevel) => {
    setDuplicateWarnings([]);
    setLevelEntries((currentEntries) =>
      clearDownstreamEntries(
        {
          ...currentEntries,
          [level]: {
            ...currentEntries[level],
            query: currentEntries[level].query.trim(),
            selectedResult: null,
            isNew: true,
          },
        },
        level
      )
    );
  };

  const handleClearLevel = (level: LocalityLevel) => {
    setDuplicateWarnings([]);
    setLevelEntries((currentEntries) =>
      clearDownstreamEntries(
        {
          ...currentEntries,
          [level]: createLevelEntry(),
        },
        level
      )
    );
  };

  const handleSelectLocality = async (locality: NexusLocationSearchResult) => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (shouldSetHome) {
      const applyHomeLocalitySelection = async () => {
        try {
          await runFortressMutation({
            intent: {
              kind: 'home_locality.claim.set',
              home_scope_packet_id: locality.scope_id,
            },
          });
          await refreshShellData();
          setActiveScopeId(toRouteScopeId(locality.scope_id));
          router.replace({
            pathname: '/nexus/dashboard',
            params: {
              locality_created: '1',
              locality_name: locality.name,
            },
          } as Href);
        } catch (error) {
          if (openNexusAuthGateForError(error, applyHomeLocalitySelection)) {
            return;
          }

          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to set home locality.'
          );
        }
      };

      await guardNexusWrite(
        {
          requiresClaimedIdentity: true,
          writeRisk: 'standard',
        },
        applyHomeLocalitySelection
      );

      return;
    }

    router.replace(appendReturnParams(returnTo, locality, returnScopeId));
  };

  const handleCreatePath = async (createAnyway = false) => {
    const path = visibleLevels.map((level) => {
      const entry = levelEntries[level];

      if (entry.selectedResult) {
        return {
          level,
          name: entry.selectedResult.name,
          existing_scope_id: entry.selectedResult.scope_id,
        };
      }

      return {
        level,
        name: entry.query.trim(),
        existing_scope_id: null,
      };
    });

    const incompleteLevel = visibleLevels.find((level) => {
      const entry = levelEntries[level];

      return !entry.selectedResult && !entry.isNew;
    });

    if (incompleteLevel) {
      setErrorMessage(
        `Select an existing ${incompleteLevel} or mark it as new before review.`
      );
      return;
    }

    if (path.some((entry) => !entry.existing_scope_id && entry.name.length < 2)) {
      setErrorMessage('Every new locality level needs at least two searchable characters.');
      return;
    }

    const applyCreatePath = async () => {
      setIsSubmitting(true);
      setErrorMessage(null);
      setStatusMessage(null);

      try {
        const finalizedMutation = await runFortressMutation<{
          created_packets: unknown[];
          final_result: NexusLocationSearchResult;
          duplicate_warnings: NexusLocalityDuplicateWarningPayload[];
        }>({
          intent: {
            kind: 'locality.path.create',
            path,
            create_anyway: createAnyway,
          },
        });
        const payload = finalizedMutation.result;

        setDuplicateWarnings(payload.duplicate_warnings);
        setStatusMessage(
          payload.created_packets.length > 0
            ? `Created ${payload.created_packets.length} locality Element(s).`
            : 'Existing locality path reused.'
        );

        await handleSelectLocality(payload.final_result);
      } catch (error) {
        if (openNexusAuthGateForError(error, applyCreatePath)) {
          return;
        }

        if (
          error instanceof NexusApiError &&
          error.status === 409 &&
          typeof error.payload === 'object' &&
          error.payload !== null &&
          Array.isArray(
            (error.payload as { duplicate_warnings?: unknown }).duplicate_warnings
          )
        ) {
          setDuplicateWarnings(
            (error.payload as {
              duplicate_warnings: NexusLocalityDuplicateWarningPayload[];
            }).duplicate_warnings
          );
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

    await guardNexusWrite(
      {
        requiresClaimedIdentity: true,
        writeRisk: 'standard',
      },
      applyCreatePath
    );
  };

  return (
    <View className="flex-1">
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
              Build locality path
            </Text>
            <Text className={appearance.itemBodyClass}>
              Search each level from broadest to narrowest. Existing localities are
              reused; new levels are created together only after review.
            </Text>
          </View>

          <View className="gap-2">
            <Text className={appearance.itemMetaClass}>Deepest locality level</Text>
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
            {visibleLevels.map((level) => {
              const previousLevel = getPreviousLevel(level);
              const parentEntry = previousLevel ? levelEntries[previousLevel] : null;
              const parentResult = parentEntry?.selectedResult ?? null;
              const parentIsPendingNew = parentEntry?.isNew ?? false;
              const isEnabled =
                previousLevel === null ||
                Boolean(parentEntry?.selectedResult) ||
                Boolean(parentEntry?.isNew);

              return (
                <LocalityLevelSearchRow
                  key={level}
                  level={level}
                  entry={levelEntries[level]}
                  isEnabled={isEnabled}
                  parentResult={parentResult}
                  parentIsPendingNew={parentIsPendingNew}
                  onQueryChange={handleLevelQueryChange}
                  onSelectResult={handleSelectLevelResult}
                  onUseNew={handleUseNewLevel}
                  onClear={handleClearLevel}
                />
              );
            })}
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
              disabled={isSubmitting}
              onPress={() => void handleCreatePath(false)}
            />
            {duplicateWarnings.length > 0 ? (
              <NexusActionButton
                label="Create anyway"
                variant="ghost"
                disabled={isSubmitting}
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
      {authGateModal}
    </View>
  );
}
