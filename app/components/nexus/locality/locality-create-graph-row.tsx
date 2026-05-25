/**
 * File: locality-create-graph-row.tsx
 * Description: Row component for editing one locality scope in the locality creation graph.
 */

import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  useNexusAppearance,
} from '@app/components/nexus/ui';
import type { NexusLocationSearchResult } from '@runtime/nexus/location-search';
import { fetchNexusLocationSearchPayload } from '@runtime/nexus/nexus-query-api';

export type LocalityCreateGraphRowNode = {
  id: string;
  query: string;
  selectedResult: NexusLocationSearchResult | null;
  isNew: boolean;
  kindId: string;
  parentId: string | null;
  parentResult: NexusLocationSearchResult | null;
  hasParentSelection: boolean;
};

function getLocationAliasLabels(result: NexusLocationSearchResult): string[] {
  const labels = new Set<string>();

  for (const alias of result.display_aliases ?? []) {
    if (alias && alias !== result.name) {
      labels.add(alias);
    }
  }

  for (const alias of result.alias_keys ?? []) {
    if (alias && alias !== result.canonical_name_key) {
      labels.add(alias);
    }
  }

  return Array.from(labels).slice(0, 6);
}

export function LocalityCreateGraphRow(input: {
  node: LocalityCreateGraphRowNode;
  depth: number;
  isTarget: boolean;
  kindLabel: string;
  parentLabel: string;
  existingParentResult: NexusLocationSearchResult | null;
  canRemove: boolean;
  errorMessage?: string | null;
  inputRef?: (node: TextInput | null) => void;
  getResultTypeLabel: (result: NexusLocationSearchResult) => string;
  searchResultLimit: number;
  onQueryChange: (nodeId: string, query: string) => void;
  onSubmitNode: (nodeId: string) => void;
  onSelectResult: (nodeId: string, result: NexusLocationSearchResult) => void;
  onSelectExistingChild: (nodeId: string, result: NexusLocationSearchResult) => void;
  onOpenKindPicker: (nodeId: string) => void;
  onOpenParentPicker: (nodeId: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onClearExistingNode: (nodeId: string) => void;
}) {
  const appearance = useNexusAppearance();
  const query = input.node.query.trim();
  const [results, setResults] = useState<NexusLocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showChildren, setShowChildren] = useState(false);
  const [children, setChildren] = useState<NexusLocationSearchResult[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [hasLoadedChildren, setHasLoadedChildren] = useState(false);
  const selectedScopeId = input.node.selectedResult?.scope_id ?? null;
  const isExistingScope = Boolean(input.node.selectedResult);
  const shouldSearch = !isExistingScope && query.length >= 2;

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
      void fetchNexusLocationSearchPayload(query)
        .then((payload) => {
          if (!isMounted) {
            return;
          }

          setResults(payload.results.slice(0, input.searchResultLimit));
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
  }, [input.searchResultLimit, query, shouldSearch]);

  useEffect(() => {
    let isMounted = true;

    if (!showChildren || !input.existingParentResult) {
      setChildren([]);
      setHasLoadedChildren(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLoadingChildren(true);
    void fetchNexusLocationSearchPayload('', {
      childrenOf: input.existingParentResult.scope_id,
    })
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setChildren(
          payload.results.filter((result) => result.scope_id !== selectedScopeId)
        );
        setHasLoadedChildren(true);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setChildren([]);
        setHasLoadedChildren(true);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingChildren(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [input.existingParentResult, selectedScopeId, showChildren]);

  const submitNode = () => {
    const firstResult = results[0] ?? null;

    if (firstResult) {
      input.onSelectResult(input.node.id, firstResult);
      setResults([]);
      return;
    }

    input.onSubmitNode(input.node.id);
  };

  return (
    <View style={{ marginLeft: input.depth * 18 }} className="gap-2">
      <View className="flex-row gap-3">
        {input.depth > 0 ? (
          <View className="w-4 items-center">
            <View className="h-full w-px bg-nexus-line/80" />
          </View>
        ) : null}
        <View className={`min-w-0 flex-1 gap-3 rounded-[22px] border p-4 ${appearance.cardInsetClass}`}>
          <View className="gap-3">
            <View className="flex-row flex-wrap items-start justify-between gap-3">
              <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
                <Text className={appearance.itemMetaClass}>LOCALITY SCOPE</Text>
                {input.node.selectedResult ? (
                  <NexusBadge label="existing" tone="mint" />
                ) : input.node.isNew || input.node.query.trim().length >= 2 ? (
                  <NexusBadge label="new candidate" tone="gold" />
                ) : null}
              </View>
              <View className="flex-row flex-wrap gap-2">
                {isExistingScope ? (
                  <NexusActionButton
                    label="Clear"
                    variant="ghost"
                    onPress={() => input.onClearExistingNode(input.node.id)}
                  />
                ) : null}
                {input.canRemove ? (
                  <NexusActionButton
                    label="Remove"
                    variant="ghost"
                    onPress={() => input.onRemoveNode(input.node.id)}
                  />
                ) : null}
              </View>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <Pressable
                disabled={isExistingScope}
                className={`rounded-[14px] border px-3 py-2 ${appearance.cardInsetClass} ${
                  isExistingScope ? 'opacity-80' : ''
                }`}
                onPress={() => input.onOpenKindPicker(input.node.id)}
              >
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className={appearance.itemMetaClass}>TYPE</Text>
                  <Text className={appearance.itemTitleClass}>{input.kindLabel}</Text>
                </View>
              </Pressable>
              <Pressable
                className={`rounded-[14px] border px-3 py-2 ${appearance.cardInsetClass}`}
                onPress={() => input.onOpenParentPicker(input.node.id)}
              >
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className={appearance.itemMetaClass}>PARENT</Text>
                  <Text className={appearance.itemTitleClass}>{input.parentLabel}</Text>
                </View>
              </Pressable>
              {input.existingParentResult ? (
                <NexusActionButton
                  label={
                    showChildren
                      ? 'Hide existing siblings'
                      : hasLoadedChildren && children.length === 0
                        ? 'No existing siblings'
                        : 'View existing siblings'
                  }
                  variant="ghost"
                  onPress={() => setShowChildren((currentValue) => !currentValue)}
                />
              ) : null}
            </View>
          </View>

          <View className="gap-0">
            <TextInput
              ref={input.inputRef}
              value={input.node.query}
              editable={!isExistingScope}
              onChangeText={(nextQuery) => input.onQueryChange(input.node.id, nextQuery)}
              onSubmitEditing={submitNode}
              returnKeyType="next"
              placeholder={`Search or enter ${input.kindLabel.toLowerCase()}`}
              placeholderTextColor={appearance.textInputPlaceholderColor}
              className={`${
                results.length > 0
                  ? 'rounded-t-[18px] rounded-b-none border px-4 py-3'
                  : 'rounded-[18px] border px-4 py-3'
              } ${isExistingScope ? appearance.cardInsetClass : appearance.textInputClass}`}
            />
            {results.length > 0 ? (
              <View className="overflow-hidden rounded-b-[18px] border border-t-0 border-nexus-line/70 bg-white/[0.03]">
                {results.map((result) => (
                  <Pressable
                    key={result.scope_id}
                    className="border-t border-nexus-line/60 px-4 py-3"
                    onPress={() => {
                      input.onSelectResult(input.node.id, result);
                      setResults([]);
                    }}
                  >
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className={appearance.itemTitleClass}>{result.name}</Text>
                      <NexusBadge label={input.getResultTypeLabel(result)} tone="sky" />
                      <NexusBadge label={result.match_type.replace(/_/g, ' ')} />
                    </View>
                    <Text className={appearance.itemMetaClass}>{result.path_label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {isSearching ? (
            <Text className={appearance.itemMetaClass}>Searching existing localities...</Text>
          ) : null}

          {input.existingParentResult && showChildren ? (
            <View className="gap-2">
              <View className={`gap-2 rounded-[18px] border p-3 ${appearance.cardInsetClass}`}>
                {isLoadingChildren ? (
                  <Text className={appearance.itemMetaClass}>Loading known siblings...</Text>
                ) : children.length > 0 ? (
                  children.map((child) => {
                    const aliases = getLocationAliasLabels(child);

                    return (
                      <Pressable
                        key={child.scope_id}
                        className="gap-1 rounded-[14px] border border-nexus-line/60 px-3 py-2"
                        onPress={() => input.onSelectExistingChild(input.node.id, child)}
                      >
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className={appearance.itemTitleClass}>{child.name}</Text>
                          <NexusBadge label={input.getResultTypeLabel(child)} tone="sky" />
                        </View>
                        {aliases.length > 0 ? (
                          <Text className={appearance.itemMetaClass}>
                            Aliases: {aliases.join(', ')}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })
                ) : (
                  <Text className={appearance.itemMetaClass}>No known sibling localities yet.</Text>
                )}
              </View>
            </View>
          ) : null}

          {input.errorMessage ? (
            <Text className="text-sm text-nexus-rose">{input.errorMessage}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
