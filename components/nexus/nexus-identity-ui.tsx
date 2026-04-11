/**
 * File: nexus-identity-ui.tsx
 * Description: Provides shared Nexus-shell UI primitives for identity route screens.
 */

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import {
  NexusActionButton,
  NexusCard,
  NexusSegmentedPill,
  NexusSectionHeader,
  useNexusAppearance,
} from '@/components/nexus/nexus-ui';
import type { NexusLocationSearchResult } from '@/lib/nexus/location-search';
import type { NexusSecurityMode } from '@/lib/nexus/nexus-api-types';
import { fetchNexusLocationSearchPayload } from '@/lib/nexus/nexus-query-api';

export type IdentityLocationSelection = {
  query: string;
  selectedResult: NexusLocationSearchResult | null;
  selectedDisclosureIndex: number | null;
};

export function buildLocationDisclosure(selection: IdentityLocationSelection) {
  if (!selection.selectedResult) {
    return null;
  }

  const optionIndex = selection.selectedDisclosureIndex;

  if (optionIndex === null || optionIndex < 0) {
    return null;
  }

  const selectedOption =
    selection.selectedResult.disclosure_options[optionIndex] ?? null;

  if (!selectedOption) {
    return null;
  }

  return {
    scope: selectedOption.scope,
    value: selectedOption.value,
  };
}

export function IdentityPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const appearance = useNexusAppearance();

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className={appearance.pageContainerClass}>
        <NexusSectionHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
        />
        {children}
      </View>
    </ScrollView>
  );
}

export function IdentityField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const appearance = useNexusAppearance();

  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
        {label}
      </Text>
      {children}
      {hint ? <Text className={appearance.itemMetaClass}>{hint}</Text> : null}
      {error ? <Text className="text-sm text-nexus-rose">{error}</Text> : null}
    </View>
  );
}

export function IdentityInput(props: React.ComponentProps<typeof TextInput>) {
  const appearance = useNexusAppearance();

  return (
    <TextInput
      {...props}
      placeholderTextColor={appearance.textInputPlaceholderColor}
      className={`rounded-[18px] border px-4 py-3 ${appearance.textInputClass}`}
    />
  );
}

export function IdentityRouteLinks({
  onSignIn,
  onCreate,
  onClaim,
  onRestore,
  showClaim,
}: {
  onSignIn: () => void;
  onCreate: () => void;
  onClaim: () => void;
  onRestore: () => void;
  showClaim?: boolean;
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard className="gap-3">
      <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
        Identity paths
      </Text>
      <Text className={appearance.itemBodyClass}>
        Guest and claimed identities are lifecycle states of the same cryptographic actor model.
      </Text>
      <View className="flex-row flex-wrap gap-3">
        <NexusActionButton label="Sign in" onPress={onSignIn} />
        {showClaim ? (
          <NexusActionButton label="Claim this guest" variant="primary" onPress={onClaim} />
        ) : null}
        <NexusActionButton label="Create fresh identity" onPress={onCreate} />
        <NexusActionButton label="Restore bundle" onPress={onRestore} />
      </View>
    </NexusCard>
  );
}

export function IdentityPreferenceCard({
  title = 'Claimed-session preferences',
  description,
  rememberClaimedSessions,
  securityMode,
  onChangeRememberClaimedSessions,
  onChangeSecurityMode,
  disabled = false,
}: {
  title?: string;
  description?: string;
  rememberClaimedSessions: boolean;
  securityMode: NexusSecurityMode;
  onChangeRememberClaimedSessions: (nextValue: boolean) => void;
  onChangeSecurityMode: (nextValue: NexusSecurityMode) => void;
  disabled?: boolean;
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard className={`gap-4 ${appearance.cardInsetClass}`}>
      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          {title}
        </Text>
        <Text className={appearance.itemBodyClass}>
          {description ??
            'Choose the starting session and write behavior. You can change both later from the profile drawer or the identity security page.'}
        </Text>
      </View>

      <View className="gap-3">
        <Text className={appearance.itemMetaClass}>Session persistence</Text>
        <NexusSegmentedPill
          options={[
            { id: 'temp', label: 'TEMP' },
            { id: 'save', label: 'SAVE' },
          ]}
          activeId={rememberClaimedSessions ? 'save' : 'temp'}
          onSelect={(optionId) => onChangeRememberClaimedSessions(optionId === 'save')}
          disabled={disabled}
        />
        <Text className={appearance.itemMetaClass}>
          TEMP stays non-remembered. SAVE remembers future claimed sessions on this device.
        </Text>
      </View>

      <View className="gap-3">
        <Text className={appearance.itemMetaClass}>Write approval</Text>
        <NexusSegmentedPill
          options={[
            { id: 'standard', label: 'OFF' },
            { id: 'guarded', label: 'MED' },
            { id: 'every_write', label: 'MAX' },
          ]}
          activeId={securityMode}
          onSelect={(optionId) => onChangeSecurityMode(optionId as NexusSecurityMode)}
          disabled={disabled}
        />
        <Text className={appearance.itemMetaClass}>
          OFF is normal. MED re-checks sensitive or higher-impact writes. MAX asks every time.
        </Text>
      </View>
    </NexusCard>
  );
}

export function LocationLookupField({
  selection,
  onChange,
  error,
}: {
  selection: IdentityLocationSelection;
  onChange: (nextSelection: IdentityLocationSelection) => void;
  error?: string;
}) {
  const appearance = useNexusAppearance();
  const [results, setResults] = useState<NexusLocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const normalizedQuery = selection.query.trim().toLowerCase();
  const shouldShowResults =
    results.length > 0 &&
    (!selection.selectedResult ||
      normalizedQuery.length === 0 ||
      normalizedQuery !== selection.selectedResult.name.trim().toLowerCase());

  useEffect(() => {
    let isMounted = true;

    if (selection.query.trim().length < 2) {
      setResults([]);
      setSearchError(null);
      return () => {
        isMounted = false;
      };
    }

    setIsSearching(true);
    const timeoutHandle = setTimeout(() => {
      void fetchNexusLocationSearchPayload(selection.query)
        .then((payload) => {
          if (!isMounted) {
            return;
          }

          setResults(payload.results);
          setSearchError(null);
        })
        .catch((nextError) => {
          if (!isMounted) {
            return;
          }

          setResults([]);
          setSearchError(
            nextError instanceof Error
              ? nextError.message
              : 'Unable to search those locations right now.'
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
  }, [selection.query]);

  return (
    <IdentityField
      label="Location disclosure"
      hint="Pick a place, then choose how much of it to reveal."
      error={error ?? searchError ?? undefined}
    >
      <IdentityInput
        value={selection.query}
        onChangeText={(nextQuery) =>
          onChange({
            query: nextQuery,
            selectedResult:
              selection.selectedResult &&
              selection.selectedResult.name.toLowerCase() === nextQuery.trim().toLowerCase()
                ? selection.selectedResult
                : null,
            selectedDisclosureIndex: null,
          })
        }
        placeholder="Search city, region, or district"
      />
      {isSearching ? <Text className={appearance.itemMetaClass}>Searching locations…</Text> : null}
      {shouldShowResults ? (
        <View className="gap-2">
          {results.map((result) => {
            const isSelected = selection.selectedResult?.scope_id === result.scope_id;

            return (
              <Pressable
                key={result.scope_id}
                className={`rounded-[18px] border px-4 py-3 ${
                  isSelected ? 'border-nexus-sky bg-nexus-sky/10' : appearance.cardInsetClass
                }`}
                onPress={() =>
                  onChange({
                    query: result.name,
                    selectedResult: result,
                    selectedDisclosureIndex: 0,
                  })
                }
              >
                <Text className={appearance.itemTitleClass}>{result.name}</Text>
                <Text className={appearance.itemMetaClass}>{result.path_label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {selection.selectedResult ? (
        <View className="gap-2">
          <Text className={appearance.itemMetaClass}>Reveal location as:</Text>
          <View className="flex-row flex-wrap gap-2">
            {selection.selectedResult.disclosure_options.map((option, optionIndex) => (
              <Pressable
                key={`${selection.selectedResult?.scope_id}-${option.scope}-${option.value}`}
                className={`rounded-full border px-3 py-2 ${
                  selection.selectedDisclosureIndex === optionIndex
                    ? 'border-nexus-sky bg-nexus-sky/10'
                    : appearance.cardInsetClass
                }`}
                onPress={() =>
                  onChange({
                    ...selection,
                    selectedDisclosureIndex: optionIndex,
                  })
                }
              >
                <Text className="text-xs font-semibold uppercase tracking-[2px] text-nexus-text">
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </IdentityField>
  );
}
