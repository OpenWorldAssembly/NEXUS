/**
 * File: create.tsx
 * Description: Guided canonical locality creation flow for Nexus home-locality journeys.
 */

import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

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
import type { NexusLocationCreateCandidate, NexusLocationSearchResult } from '@runtime/nexus/location-search';
import type {
  NexusLocalityDuplicateWarningPayload,
  NexusLocalityPathPreviewPayload,
  NexusLocalityReviewEntryPayload,
} from '@runtime/nexus/nexus-api-types';
import {
  fetchNexusLocationSearchPayload,
  previewNexusLocalityPath,
} from '@runtime/nexus/nexus-query-api';
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

function createLevelEntries(): Record<LocalityLevel, LocalityLevelEntry> {
  return {
    nation: createLevelEntry(),
    region: createLevelEntry(),
    city: createLevelEntry(),
    district: createLevelEntry(),
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

function normalizeCandidateLevel(
  level: NexusLocationCreateCandidate['level'] | null | undefined
): LocalityLevel {
  return level ?? 'city';
}

function getCreateCandidateKey(candidate: NexusLocationCreateCandidate | null): string | null {
  if (!candidate) {
    return null;
  }

  return `${normalizeCandidateLevel(candidate.level)}:${candidate.query.trim().toLowerCase()}`;
}

function buildVisiblePathEntries(input: {
  entries: Record<LocalityLevel, LocalityLevelEntry>;
  visibleLevels: LocalityLevel[];
}) {
  return input.visibleLevels.map((level) => {
    const entry = input.entries[level];

    return {
      level,
      name: entry.selectedResult?.name ?? entry.query.trim(),
      existing_scope_id: entry.selectedResult?.scope_id ?? null,
      alias_keys: [],
      display_aliases: [],
    };
  });
}

function findIncompleteLevel(input: {
  entries: Record<LocalityLevel, LocalityLevelEntry>;
  visibleLevels: LocalityLevel[];
}): LocalityLevel | null {
  return (
    input.visibleLevels.find((level) => {
      const entry = input.entries[level];

      return !entry.selectedResult && !entry.isNew;
    }) ?? null
  );
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
  const canUseNew =
    input.isEnabled && query.length >= 2 && !input.entry.selectedResult && !input.entry.isNew;

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
        editable={input.isEnabled && !input.entry.selectedResult}
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
            This {input.level} will be created only after review.
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

function ReviewDispositionBadge({
  entry,
}: {
  entry: NexusLocalityReviewEntryPayload;
}) {
  if (entry.disposition === 'reuse_existing') {
    return <NexusBadge label="reuse existing" tone="mint" />;
  }

  return <NexusBadge label="create new" tone="gold" />;
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
  const {
    activeScope,
    currentActorPacketId,
    refreshShellData,
    setActiveScopeId,
  } = useNexusShell();
  const { currentMode, isAuthenticated, runFortressMutation } = useIdentityShell();
  const returnTo = getSingleParam(params.return_to) ?? '/nexus/trust';
  const returnScopeId = getSingleParam(params.return_scope_id);
  const initialQuery = getSingleParam(params.query) ?? '';
  const shouldSetHome = getSingleParam(params.set_home) === '1';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<NexusLocationSearchResult[]>([]);
  const [searchCreateCandidate, setSearchCreateCandidate] =
    useState<NexusLocationCreateCandidate | null>(null);
  const [appliedSearchCandidateKey, setAppliedSearchCandidateKey] = useState<string | null>(null);
  const [notFoundModalCandidate, setNotFoundModalCandidate] =
    useState<NexusLocationCreateCandidate | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [finalLevel, setFinalLevel] = useState<LocalityLevel>('city');
  const [levelEntries, setLevelEntries] = useState<Record<LocalityLevel, LocalityLevelEntry>>(
    () => createLevelEntries()
  );
  const [seededTargetLevel, setSeededTargetLevel] = useState<LocalityLevel | null>(null);
  const [reviewPreview, setReviewPreview] = useState<NexusLocalityPathPreviewPayload | null>(
    null
  );
  const [homeScopeSelection, setHomeScopeSelection] = useState<Record<string, boolean>>({});
  const [applyAsHomeLocality, setApplyAsHomeLocality] = useState(shouldSetHome);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
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
    ...(applyAsHomeLocality ? { set_home: '1' } : {}),
  }).toString()}`;
  const { authGateModal, guardNexusWrite, openNexusAuthGateForError } =
    useNexusAuthGate({
      returnTo: returnToSelf,
      returnScopeId,
    });
  const scrollViewRef = useRef<ScrollView>(null);
  const builderOffsetYRef = useRef(0);

  const searchCandidateKey = getCreateCandidateKey(searchCreateCandidate);
  const showSearchCreateRow =
    Boolean(searchCreateCandidate) &&
    searchQuery.trim().length >= 2 &&
    results.length === 0 &&
    !isSearching &&
    searchCandidateKey !== appliedSearchCandidateKey;

  const scrollToBuilder = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, builderOffsetYRef.current - 24),
        animated: true,
      });
    }, 80);
  };

  const resetReviewState = () => {
    setReviewPreview(null);
    setHomeScopeSelection({});
  };

  useEffect(() => {
    let isMounted = true;

    if (searchQuery.trim().length < 2) {
      setResults([]);
      setSearchCreateCandidate(null);
      setIsSearching(false);
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
          setSearchCreateCandidate(payload.create_candidate);
        })
        .catch((error) => {
          if (!isMounted) {
            return;
          }

          setResults([]);
          setSearchCreateCandidate(null);
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

  useEffect(() => {
    if (!reviewPreview) {
      setHomeScopeSelection({});
      return;
    }

    setHomeScopeSelection(
      Object.fromEntries(
        reviewPreview.suggested_home_scope_entries.map((entry) => [
          entry.scope_id,
          entry.checked_by_default,
        ])
      )
    );
  }, [reviewPreview]);

  const buildPathEntries = (
    entries: Record<LocalityLevel, LocalityLevelEntry> = levelEntries
  ) =>
    buildVisiblePathEntries({
      entries,
      visibleLevels,
    });

  const runLocalityPreview = async (input?: {
    entries?: Record<LocalityLevel, LocalityLevelEntry>;
    createAnyway?: boolean;
  }) => {
    const entries = input?.entries ?? levelEntries;
    const createAnyway = input?.createAnyway ?? false;
    const incompleteLevel = findIncompleteLevel({
      entries,
      visibleLevels,
    });

    if (incompleteLevel) {
      setErrorMessage(
        `Select an existing ${incompleteLevel} or mark it as new before review.`
      );
      return;
    }

    const path = buildVisiblePathEntries({
      entries,
      visibleLevels,
    });

    if (path.some((entry) => !entry.existing_scope_id && entry.name.length < 2)) {
      setErrorMessage('Every new locality level needs at least two searchable characters.');
      return;
    }

    setIsReviewing(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const payload = await previewNexusLocalityPath({
        actor_packet_id: currentActorPacketId,
        path,
        create_anyway: createAnyway,
      });

      setReviewPreview(payload);
    } catch (error) {
      setReviewPreview(null);
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to preview locality path.'
      );
    } finally {
      setIsReviewing(false);
    }
  };

  const handleLevelQueryChange = (level: LocalityLevel, query: string) => {
    setErrorMessage(null);
    setStatusMessage(null);
    resetReviewState();
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
    if (seededTargetLevel === level) {
      setSeededTargetLevel(null);
    }

    setErrorMessage(null);
    setStatusMessage(null);
    resetReviewState();
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
    if (seededTargetLevel === level) {
      setSeededTargetLevel(null);
    }

    setErrorMessage(null);
    setStatusMessage(null);
    resetReviewState();
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
    if (seededTargetLevel === level) {
      setSeededTargetLevel(null);
    }

    setErrorMessage(null);
    setStatusMessage(null);
    resetReviewState();
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

  const handleUseSearchCreateCandidate = (
    candidateOverride?: NexusLocationCreateCandidate | null
  ) => {
    const candidate = candidateOverride ?? searchCreateCandidate;

    if (!candidate) {
      return;
    }

    const nextFinalLevel = normalizeCandidateLevel(candidate.level);
    const previousLevel = getPreviousLevel(nextFinalLevel);
    const hintedParentResult = candidate.parent_scope_id
      ? (results.find((result) => result.scope_id === candidate.parent_scope_id) ?? null)
      : null;
    const nextEntries = createLevelEntries();

    if (
      previousLevel &&
      hintedParentResult &&
      hintedParentResult.level === previousLevel
    ) {
      nextEntries[previousLevel] = {
        query: hintedParentResult.name,
        selectedResult: hintedParentResult,
        isNew: false,
      };
    }

    nextEntries[nextFinalLevel] = {
      query: candidate.query.trim(),
      selectedResult: null,
      isNew: true,
    };

    setErrorMessage(null);
    setStatusMessage(null);
    resetReviewState();
    setAppliedSearchCandidateKey(getCreateCandidateKey(candidate));
    setNotFoundModalCandidate(null);
    setApplyAsHomeLocality(true);
    setSeededTargetLevel(nextFinalLevel);
    setFinalLevel(nextFinalLevel);
    setLevelEntries(nextEntries);
    scrollToBuilder();
  };

  const handleSelectLocality = async (locality: NexusLocationSearchResult) => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (applyAsHomeLocality) {
      const applyHomeLocalitySelection = async () => {
        try {
          await runFortressMutation({
            intent: {
              kind: 'home_locality.relation.set',
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

  const handleUseExistingWarning = async (
    warning: NexusLocalityDuplicateWarningPayload
  ) => {
    const nextEntries = clearDownstreamEntries(
      {
        ...levelEntries,
        [warning.level]: {
          query: warning.existing_result.name,
          selectedResult: warning.existing_result,
          isNew: false,
        },
      },
      warning.level
    );

    setErrorMessage(null);
    setStatusMessage(null);
    resetReviewState();
    setLevelEntries(nextEntries);
    await runLocalityPreview({
      entries: nextEntries,
      createAnyway: false,
    });
  };

  const handleEditWarning = (warning: NexusLocalityDuplicateWarningPayload) => {
    setErrorMessage(null);
    setStatusMessage(null);
    resetReviewState();
    setLevelEntries((currentEntries) =>
      clearDownstreamEntries(
        {
          ...currentEntries,
          [warning.level]: {
            query: currentEntries[warning.level].query,
            selectedResult: null,
            isNew: false,
          },
        },
        warning.level
      )
    );
  };

  const handleCreatePath = async (createAnyway = false) => {
    const path = buildPathEntries();

    const applyCreatePath = async () => {
      setIsSubmitting(true);
      setErrorMessage(null);
      setStatusMessage(null);

      try {
        const finalizedMutation = await runFortressMutation<{
          created_packets: unknown[];
          created_relation_packet_ids: string[];
          created_location_packet_ids: string[];
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

        setStatusMessage(
          payload.created_packets.length > 0
            ? `Created ${payload.created_packets.length} locality packet(s).`
            : 'Existing locality path reused.'
        );

        await handleSelectLocality(payload.final_result);
      } catch (error) {
        if (openNexusAuthGateForError(error, applyCreatePath)) {
          return;
        }

        if (error instanceof NexusApiError && error.status === 409) {
          await runLocalityPreview({ createAnyway: false });
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
      <ScrollView ref={scrollViewRef} className="flex-1" showsVerticalScrollIndicator={false}>
        <View className={appearance.pageContainerClass}>
          <NexusSectionHeader
            eyebrow="Locality"
            title="Find or create a locality"
            description="Search the Nexus locality directory first. If the place is missing, build a confirmed broad-to-narrow path, review it, and then create the canonical locality. No third-party geocoder is used in this phase."
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
                Browsing and previewing localities is available here, but minting a
                public locality Element or setting home locality requires a signed
                claimed identity.
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
                onChangeText={(nextValue) => {
                  setSearchQuery(nextValue);
                  setAppliedSearchCandidateKey(null);
                  setErrorMessage(null);
                }}
                onSubmitEditing={() => {
                  if (results[0]) {
                    void handleSelectLocality(results[0]);
                    return;
                  }

                  if (searchCreateCandidate && showSearchCreateRow) {
                    setNotFoundModalCandidate(searchCreateCandidate);
                  }
                }}
                placeholder="Search locality or rough path"
                placeholderTextColor={appearance.textInputPlaceholderColor}
                className={`rounded-[18px] border px-4 py-3 ${appearance.textInputClass}`}
              />
              {isSearching ? (
                <Text className={appearance.itemMetaClass}>Searching Nexus directory...</Text>
              ) : null}
            </View>

            {results.length > 0 || showSearchCreateRow ? (
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
                {showSearchCreateRow && searchCreateCandidate ? (
                  <Pressable
                    className={`rounded-[18px] border px-4 py-3 ${appearance.cardInsetClass}`}
                    onPress={() => handleUseSearchCreateCandidate(searchCreateCandidate)}
                  >
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className={appearance.itemTitleClass}>
                        No results found. Create “{searchCreateCandidate.query.trim()}”
                      </Text>
                      <NexusBadge label={normalizeCandidateLevel(searchCreateCandidate.level)} tone="gold" />
                    </View>
                    <Text className={appearance.itemMetaClass}>
                      Seed the path builder with a new locality Element.
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text className={appearance.itemBodyClass}>
                Search by locality name, alias, packet id, or known path tokens.
              </Text>
            )}

            <View className="gap-2">
              <Text className={appearance.itemMetaClass}>Selection mode</Text>
              <NexusSegmentedPill
                options={[
                  { id: 'off', label: 'Return only' },
                  { id: 'on', label: 'Use as home' },
                ]}
                activeId={applyAsHomeLocality ? 'on' : 'off'}
                onSelect={(optionId) => {
                  setApplyAsHomeLocality(optionId === 'on');
                }}
              />
            </View>
          </NexusCard>

          <View onLayout={(event) => { builderOffsetYRef.current = event.nativeEvent.layout.y; }}>
            <NexusCard className="gap-4">
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                  Build locality path
              </Text>
              <Text className={appearance.itemBodyClass}>
                Search each level from broadest to narrowest. Existing localities are
                reused; new levels are only created after review.
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
                onSelect={(level) => {
                  setFinalLevel(level as LocalityLevel);
                  setSeededTargetLevel(null);
                  setErrorMessage(null);
                  setStatusMessage(null);
                  resetReviewState();
                }}
              />
            </View>

            <View className="gap-3">
              {visibleLevels.map((level) => {
                const previousLevel = getPreviousLevel(level);
                const parentEntry = previousLevel ? levelEntries[previousLevel] : null;
                const parentResult = parentEntry?.selectedResult ?? null;
                const parentIsPendingNew = parentEntry?.isNew ?? false;
                const isEnabled =
                  seededTargetLevel === level ||
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

            <View className="flex-row flex-wrap gap-3">
              <NexusActionButton
                label={isReviewing ? 'Reviewing...' : 'Review path'}
                variant="primary"
                disabled={isReviewing || isSubmitting}
                onPress={() => void runLocalityPreview({ createAnyway: false })}
              />
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

          {reviewPreview ? (
            <NexusCard className="gap-4">
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                  Review path
                </Text>
                <Text className={appearance.itemBodyClass}>
                  Preview explains what would happen. Create reruns the canonical
                  planner and writer, so duplicate checks may still change before
                  write.
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-2">
                <NexusBadge
                  label={`${reviewPreview.planned_scope_packet_ids.length} planned locality scope ids`}
                  tone="gold"
                />
                <NexusBadge
                  label={`${reviewPreview.planned_relation_packet_ids.length} planned relation ids`}
                  tone="sky"
                />
                <NexusBadge
                  label={`${reviewPreview.planned_location_packet_ids.length} planned location ids`}
                  tone="sky"
                />
              </View>

              <View className="gap-3">
                {reviewPreview.review_entries.map((entry) => (
                  <View
                    key={`${entry.level}-${entry.name}-${entry.planned_scope_packet_id ?? entry.existing_result?.scope_id ?? 'review'}`}
                    className={`gap-2 rounded-[18px] border px-4 py-3 ${appearance.cardInsetClass}`}
                  >
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className={appearance.itemTitleClass}>{entry.name}</Text>
                      <NexusBadge label={entry.level} tone="sky" />
                      <ReviewDispositionBadge entry={entry} />
                    </View>
                    <Text className={appearance.itemMetaClass}>
                      {entry.existing_result?.path_label ??
                        `Will be created in the ${entry.level} branch.`}
                    </Text>
                  </View>
                ))}
              </View>

              {applyAsHomeLocality ? (
                <NexusCard className={`gap-3 p-4 ${appearance.cardInsetClass}`}>
                  <Text className={appearance.itemTitleClass}>Home branch to include</Text>
                  <Text className={appearance.itemBodyClass}>
                    These scopes are pre-checked by default for review in this pass.
                    Unchecking them changes only this preview UI for now.
                  </Text>
                  <View className="gap-2">
                    {reviewPreview.suggested_home_scope_entries.map((entry) => (
                      <Pressable
                        key={entry.scope_id}
                        className={`rounded-[18px] border px-4 py-3 ${appearance.cardInsetClass}`}
                        onPress={() =>
                          setHomeScopeSelection((currentSelection) => ({
                            ...currentSelection,
                            [entry.scope_id]: !currentSelection[entry.scope_id],
                          }))
                        }
                      >
                        <View className="flex-row flex-wrap items-center gap-2">
                          <NexusBadge
                            label={
                              homeScopeSelection[entry.scope_id] !== false
                                ? 'included'
                                : 'excluded'
                            }
                            tone={
                              homeScopeSelection[entry.scope_id] !== false ? 'mint' : 'gold'
                            }
                          />
                          <Text className={appearance.itemTitleClass}>{entry.name}</Text>
                          <NexusBadge label={entry.level} tone="sky" />
                        </View>
                        <Text className={appearance.itemMetaClass}>{entry.path_label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </NexusCard>
              ) : null}

              {reviewPreview.duplicate_warnings.length > 0 ? (
                <NexusCard className={`gap-3 p-4 ${appearance.cardInsetClass}`} tone="gold">
                  <Text className={appearance.itemTitleClass}>Possible duplicates</Text>
                  {reviewPreview.duplicate_warnings.map((warning) => (
                    <View
                      key={`${warning.level}-${warning.existing_scope_id}`}
                      className="gap-2"
                    >
                      <Text className={appearance.itemBodyClass}>{warning.message}</Text>
                      <Text className={appearance.itemMetaClass}>
                        Existing match: {warning.existing_result.path_label}
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        <NexusActionButton
                          label="Use existing"
                          variant="ghost"
                          onPress={() => void handleUseExistingWarning(warning)}
                        />
                        <NexusActionButton
                          label="Edit name"
                          variant="ghost"
                          onPress={() => handleEditWarning(warning)}
                        />
                      </View>
                    </View>
                  ))}
                </NexusCard>
              ) : null}

              <View className="gap-2">
                <Text className={appearance.itemMetaClass}>Finalization mode</Text>
                <NexusSegmentedPill
                  options={[
                    { id: 'off', label: 'Create and return' },
                    { id: 'on', label: 'Create as home' },
                  ]}
                  activeId={applyAsHomeLocality ? 'on' : 'off'}
                  onSelect={(optionId) => {
                    setApplyAsHomeLocality(optionId === 'on');
                  }}
                />
              </View>

              <View className="flex-row flex-wrap gap-3">
                <NexusActionButton
                  label={
                    isSubmitting
                      ? 'Creating locality...'
                      : applyAsHomeLocality
                        ? 'Create and use as home'
                        : 'Create locality'
                  }
                  variant="primary"
                  disabled={isSubmitting || reviewPreview.duplicate_warnings.length > 0}
                  onPress={() => void handleCreatePath(false)}
                />
                {reviewPreview.duplicate_warnings.length > 0 ? (
                  <NexusActionButton
                    label={isSubmitting ? 'Creating locality...' : 'Create anyway'}
                    variant="ghost"
                    disabled={isSubmitting}
                    onPress={() => void handleCreatePath(true)}
                  />
                ) : null}
              </View>
            </NexusCard>
          ) : null}
        </View>
      </ScrollView>
      <Modal
        animationType="fade"
        transparent
        visible={notFoundModalCandidate !== null}
        onRequestClose={() => setNotFoundModalCandidate(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-4">
          <Pressable
            className="absolute inset-0"
            onPress={() => setNotFoundModalCandidate(null)}
          />
          <NexusCard className="w-full max-w-xl gap-4">
            <Text className={appearance.surfaceTitleClass}>No matching locality found</Text>
            <Text className={appearance.itemBodyClass}>
              Create a new locality path from “{notFoundModalCandidate?.query.trim() ?? ''}”?
            </Text>
            <View className="flex-row flex-wrap gap-3">
              <NexusActionButton
                label="Create locality"
                variant="primary"
                onPress={() => handleUseSearchCreateCandidate(notFoundModalCandidate)}
              />
              <NexusActionButton
                label="Dismiss"
                variant="ghost"
                onPress={() => setNotFoundModalCandidate(null)}
              />
            </View>
          </NexusCard>
        </View>
      </Modal>
      {authGateModal}
    </View>
  );
}
