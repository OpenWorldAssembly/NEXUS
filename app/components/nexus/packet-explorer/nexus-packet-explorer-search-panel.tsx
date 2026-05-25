import { Text, TextInput, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusSegmentedPill,
  useNexusAppearance,
} from '@app/components/nexus/ui';
import type {
  NexusPacketExplorerSearchGroup,
  NexusPacketExplorerSearchGroupKey,
  NexusPacketExplorerSearchPayload,
  NexusPacketExplorerSearchResultRow,
} from '@runtime/nexus/nexus-api-types';

function getVerificationBadgeProps(
  verification: NexusPacketExplorerSearchResultRow['verification']
): { label: string; tone?: 'default' | 'sky' | 'gold' | 'rose' | 'mint' } | null {
  if (!verification) {
    return null;
  }

  if (
    verification.status === 'signature_invalid' ||
    verification.status === 'canonicalization_mismatch'
  ) {
    return {
      label: 'Validation failed',
      tone: 'rose',
    };
  }

  if (verification.status === 'trusted_signer') {
    return {
      label: 'Validated locally',
      tone: 'mint',
    };
  }

  if (verification.status === 'unsigned') {
    return {
      label: 'Unsigned',
      tone: 'gold',
    };
  }

  if (verification.status === 'unknown_signer') {
    return {
      label: 'Signer unavailable locally',
      tone: 'gold',
    };
  }

  if (verification.status === 'external_report_only') {
    return {
      label: 'External report only',
      tone: 'gold',
    };
  }

  return {
    label: verification.status.replace(/_/g, ' '),
  };
}

export type NexusPacketExplorerSearchCategory =
  | 'all'
  | NexusPacketExplorerSearchGroupKey;

type PacketExplorerRoutePacketInput = {
  packetId: string;
  preferredRevisionId?: string | null;
  titleSnapshot?: string | null;
  seedSummary?: {
    type: string | null;
    summary: string | null;
    label: string | null;
  } | null;
};

type NexusPacketExplorerSearchPanelProps = {
  searchValue: string;
  searchResult: NexusPacketExplorerSearchPayload | null;
  searchError: string | null;
  isSearching: boolean;
  activeCategory: NexusPacketExplorerSearchCategory;
  onChangeSearchValue: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  onSelectCategory: (category: NexusPacketExplorerSearchCategory) => void;
  onChangeCategoryPage: (
    category: Exclude<NexusPacketExplorerSearchCategory, 'all'>,
    nextPage: number
  ) => void;
  onOpenPacketInExplorer: (input: PacketExplorerRoutePacketInput) => void;
  onRoutePacketToExport: (input: PacketExplorerRoutePacketInput) => void;
};

function getGroupCount(
  searchResult: NexusPacketExplorerSearchPayload | null,
  groupKey: NexusPacketExplorerSearchCategory
): number {
  if (!searchResult) {
    return 0;
  }

  if (groupKey === 'all') {
    return searchResult.total_result_count;
  }

  return searchResult.groups.find((group) => group.key === groupKey)?.count ?? 0;
}

function SearchResultCard(input: {
  result: NexusPacketExplorerSearchResultRow;
  onOpenPacketInExplorer: NexusPacketExplorerSearchPanelProps['onOpenPacketInExplorer'];
  onRoutePacketToExport: NexusPacketExplorerSearchPanelProps['onRoutePacketToExport'];
}) {
  const appearance = useNexusAppearance();
  const verificationBadge = getVerificationBadgeProps(input.result.verification);

  return (
    <NexusCard className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className={appearance.itemTitleClass}>{input.result.title}</Text>
        <NexusBadge label={input.result.type} tone="sky" />
        <NexusBadge label={input.result.match_reason} tone="gold" />
        {verificationBadge ? (
          <NexusBadge
            label={verificationBadge.label}
            tone={verificationBadge.tone}
          />
        ) : null}
        {input.result.status ? (
          <NexusBadge label={input.result.status} />
        ) : null}
      </View>

      <Text className={appearance.itemMetaClass}>{input.result.label}</Text>
      <Text className={appearance.itemBodyClass}>{input.result.packet_id}</Text>
      {input.result.matched_revision_id ? (
        <Text className={appearance.itemMetaClass}>
          Matched revision: {input.result.matched_revision_id}
        </Text>
      ) : input.result.revision_id ? (
        <Text className={appearance.itemMetaClass}>
          Preferred revision: {input.result.revision_id}
        </Text>
      ) : null}
      {input.result.summary ? (
        <Text className={appearance.itemBodyClass}>{input.result.summary}</Text>
      ) : null}

      <View className="flex-row flex-wrap gap-3">
        <NexusActionButton
          label="Open"
          variant="primary"
          onPress={() =>
            input.onOpenPacketInExplorer({
              packetId: input.result.packet_id,
              preferredRevisionId: input.result.revision_id,
              titleSnapshot: input.result.title,
              seedSummary: {
                type: input.result.type,
                summary: input.result.summary,
                label: input.result.label,
              },
            })
          }
        />
        <NexusActionButton
          label="Export"
          onPress={() =>
            input.onRoutePacketToExport({
              packetId: input.result.packet_id,
              preferredRevisionId: input.result.revision_id,
              titleSnapshot: input.result.title,
              seedSummary: {
                type: input.result.type,
                summary: input.result.summary,
                label: input.result.label,
              },
            })
          }
        />
      </View>
    </NexusCard>
  );
}

function SearchGroupSection(input: {
  group: NexusPacketExplorerSearchGroup;
  isPreview: boolean;
  onSelectCategory: (category: NexusPacketExplorerSearchCategory) => void;
  onChangeCategoryPage: NexusPacketExplorerSearchPanelProps['onChangeCategoryPage'];
  onOpenPacketInExplorer: NexusPacketExplorerSearchPanelProps['onOpenPacketInExplorer'];
  onRoutePacketToExport: NexusPacketExplorerSearchPanelProps['onRoutePacketToExport'];
}) {
  const appearance = useNexusAppearance();

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className={appearance.surfaceTitleClass}>{input.group.label}</Text>
        <NexusBadge label={`${input.group.count} results`} tone="sky" />
      </View>

      {input.group.count === 0 ? (
        <NexusCard>
          <Text className={appearance.itemBodyClass}>
            No results found in this category.
          </Text>
        </NexusCard>
      ) : (
        input.group.results.map((result) => (
          <SearchResultCard
            key={`${input.group.key}:${result.packet_id}:${result.match_type}:${result.matched_revision_id ?? result.revision_id ?? 'none'}`}
            result={result}
            onOpenPacketInExplorer={input.onOpenPacketInExplorer}
            onRoutePacketToExport={input.onRoutePacketToExport}
          />
        ))
      )}

      {input.isPreview && input.group.count > input.group.results.length ? (
        <View className="gap-2">
          <Text className={appearance.itemMetaClass}>
            Showing first {input.group.results.length} results in this preview.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <NexusActionButton
              label={`See all in ${input.group.label.replace(' matches', '')}`}
              onPress={() => input.onSelectCategory(input.group.key)}
            />
          </View>
        </View>
      ) : null}

      {!input.isPreview && input.group.total_pages > 1 ? (
        <View className="flex-row flex-wrap items-center gap-3">
          <NexusActionButton
            label="Previous"
            onPress={() =>
              input.onChangeCategoryPage(
                input.group.key,
                Math.max(input.group.current_page - 1, 1)
              )
            }
            disabled={input.group.current_page <= 1}
          />
          <Text className={appearance.itemMetaClass}>
            Page {input.group.current_page} of {input.group.total_pages}
          </Text>
          <NexusActionButton
            label="Next"
            onPress={() =>
              input.onChangeCategoryPage(
                input.group.key,
                Math.min(input.group.current_page + 1, input.group.total_pages)
              )
            }
            disabled={input.group.current_page >= input.group.total_pages}
          />
        </View>
      ) : null}
    </View>
  );
}

export function NexusPacketExplorerSearchPanel({
  searchValue,
  searchResult,
  searchError,
  isSearching,
  activeCategory,
  onChangeSearchValue,
  onSearch,
  onClear,
  onSelectCategory,
  onChangeCategoryPage,
  onOpenPacketInExplorer,
  onRoutePacketToExport,
}: NexusPacketExplorerSearchPanelProps) {
  const appearance = useNexusAppearance();
  const selectedGroup =
    activeCategory === 'all'
      ? null
      : searchResult?.groups.find((group) => group.key === activeCategory) ?? null;

  return (
    <View className="gap-4">
      <NexusCard className="gap-4">
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Packet Explorer
          </Text>
          <Text className={appearance.surfaceTitleClass}>
            Global Packet Workspace
          </Text>
          <Text className={appearance.sectionBodyClass}>
            Search the current preferred packet index by ID, title, label,
            summary, tag, or type, then open or export what you find.
          </Text>
        </View>

        <TextInput
          className={`rounded-[22px] border px-4 py-3 ${appearance.textInputClass}`}
          onChangeText={onChangeSearchValue}
          onSubmitEditing={() => onSearch()}
          placeholder="Search packet id, revision id, title, label, or summary"
          placeholderTextColor={appearance.textInputPlaceholderColor}
          returnKeyType="search"
          value={searchValue}
        />

        <View className="flex-row flex-wrap gap-2">
          <NexusActionButton
            label={isSearching ? 'Searching...' : 'Search packets'}
            variant="primary"
            onPress={onSearch}
            disabled={isSearching || searchValue.trim().length === 0}
          />
          <NexusActionButton
            label="Clear"
            variant="ghost"
            onPress={onClear}
            disabled={searchValue.trim().length === 0 && !searchResult && !searchError}
          />
        </View>

        {searchError ? (
          <NexusCard tone="rose">
            <Text className={appearance.itemBodyClass}>{searchError}</Text>
          </NexusCard>
        ) : null}
      </NexusCard>

      {searchResult ? (
        <View className="gap-4">
          <NexusCard className="gap-4">
            <View className="gap-2">
              <Text className={appearance.itemMetaClass}>Search categories</Text>
              <NexusSegmentedPill
                options={[
                  { id: 'all', label: `ALL ${getGroupCount(searchResult, 'all')}` },
                  { id: 'direct', label: `DIRECT ${getGroupCount(searchResult, 'direct')}` },
                  { id: 'name', label: `NAME ${getGroupCount(searchResult, 'name')}` },
                  { id: 'text', label: `TEXT ${getGroupCount(searchResult, 'text')}` },
                ]}
                activeId={activeCategory}
                onSelect={(optionId) =>
                  onSelectCategory(optionId as NexusPacketExplorerSearchCategory)
                }
                compact
              />
            </View>
          </NexusCard>

          {activeCategory === 'all' ? (
            searchResult.total_result_count === 0 ? (
              <NexusCard>
                <Text className={appearance.itemBodyClass}>
                  No packets matched this search.
                </Text>
              </NexusCard>
            ) : (
              searchResult.groups.map((group) => (
                <SearchGroupSection
                  key={group.key}
                  group={group}
                  isPreview
                  onSelectCategory={onSelectCategory}
                  onChangeCategoryPage={onChangeCategoryPage}
                  onOpenPacketInExplorer={onOpenPacketInExplorer}
                  onRoutePacketToExport={onRoutePacketToExport}
                />
              ))
            )
          ) : selectedGroup ? (
            <SearchGroupSection
              group={selectedGroup}
              isPreview={false}
              onSelectCategory={onSelectCategory}
              onChangeCategoryPage={onChangeCategoryPage}
              onOpenPacketInExplorer={onOpenPacketInExplorer}
              onRoutePacketToExport={onRoutePacketToExport}
            />
          ) : (
            <NexusCard>
              <Text className={appearance.itemBodyClass}>
                No results found in this category.
              </Text>
            </NexusCard>
          )}
        </View>
      ) : null}
    </View>
  );
}
