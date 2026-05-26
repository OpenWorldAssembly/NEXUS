/**
 * File: locality-create-panels.tsx
 * Description: Feature-local visual panels for the Nexus locality create route.
 */

import { Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusLoadingBoundary,
  NexusSearchField,
  NexusSearchResultList,
  NexusSearchResultRow,
  NexusSearchResultsBoundary,
  NexusSearchStatusText,
  useNexusAppearance,
} from '@app/components/nexus/ui';
import { LocalityCreateGraphRow } from './locality-create-graph-row';
import type {
  LocalityCreateBuilderPanelProps,
  LocalitySearchPanelProps,
} from './locality-create-types';

export function LocalityIdentityRequiredCard({
  onClaimCurrentGuest,
  onSignIn,
}: {
  onClaimCurrentGuest: () => void;
  onSignIn: () => void;
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard className="gap-4" tone="gold">
      <Text className={appearance.itemTitleClass}>Claimed identity required</Text>
      <Text className={appearance.itemBodyClass}>
        Browsing and previewing localities is available here, but minting a
        public locality Element or setting home locality requires a signed
        claimed identity.
      </Text>
      <View className="flex-row flex-wrap gap-3">
        <NexusActionButton label="Sign in" onPress={onSignIn} variant="primary" />
        <NexusActionButton label="Claim current guest" onPress={onClaimCurrentGuest} />
      </View>
    </NexusCard>
  );
}

export function LocalityCreateSearchPanel({
  effectiveSearchCreateCandidate,
  hasSearchDropdown,
  hiddenSearchResultCount,
  isSearching,
  loadingScope,
  resultLimit,
  resultsCount,
  searchQuery,
  showSearchCreateRow,
  visibleSearchResults,
  getDefaultKindIdForLevel,
  getResultTypeLabel,
  normalizeCandidateLevel,
  onChangeSearchQuery,
  onClearGraphNodeErrors,
  onSelectCreateCandidate,
  onSelectCreateKindId,
  onSelectExistingResult,
  onSubmitSearch,
}: LocalitySearchPanelProps) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard className="gap-4 rounded-t-none border-t-0">
      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          Search localities
        </Text>
        <View className="gap-1">
          <Text className={appearance.itemBodyClass}>
            Enter the locality you would like to set as your home.
          </Text>
          <Text className={appearance.itemBodyClass}>
            You may only have one home locality at a time.
          </Text>
        </View>
        <View className="gap-0">
          <NexusSearchField
            value={searchQuery}
            onChangeText={(nextValue) => {
              onChangeSearchQuery(nextValue);
              onClearGraphNodeErrors();
            }}
            onSubmitEditing={onSubmitSearch}
            placeholder="Search city, region, country, or path"
            hasAttachedResults={hasSearchDropdown}
          />

          <NexusSearchResultsBoundary
            loadingLabel="Searching Nexus directory..."
            loadingScope={loadingScope}
          >
            {hasSearchDropdown ? (
              <NexusSearchResultList attached>
                {visibleSearchResults.map((result) => (
                  <NexusSearchResultRow
                    key={result.scope_id}
                    attached
                    onPress={() => onSelectExistingResult(result)}
                  >
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className={appearance.itemTitleClass}>{result.name}</Text>
                      <NexusBadge label={getResultTypeLabel(result)} tone="sky" />
                      <NexusBadge label={result.match_type.replace(/_/g, ' ')} />
                    </View>
                    <Text className={appearance.itemMetaClass}>
                      {result.path_label}
                      {result.scope_hierarchy_system
                        ? ` · ${result.scope_hierarchy_system}`
                        : ''}
                    </Text>
                  </NexusSearchResultRow>
                ))}
                {showSearchCreateRow && effectiveSearchCreateCandidate ? (
                  <NexusSearchResultRow
                    attached
                    onPress={() => {
                      onSelectCreateCandidate(effectiveSearchCreateCandidate);
                      onSelectCreateKindId(
                        getDefaultKindIdForLevel(
                          normalizeCandidateLevel(
                            effectiveSearchCreateCandidate.level
                          )
                        )
                      );
                    }}
                  >
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className={appearance.itemTitleClass}>
                        Create {`"${effectiveSearchCreateCandidate.query.trim()}"`} as a new locality scope
                      </Text>
                      <NexusBadge label="new locality" tone="gold" />
                    </View>
                  </NexusSearchResultRow>
                ) : null}
                {hiddenSearchResultCount > 0 ? (
                  <Text
                    className={`border-t border-nexus-line/60 px-4 py-3 ${appearance.itemMetaClass}`}
                  >
                    Showing first {resultLimit} of {resultsCount}. Refine your search to narrow results.
                  </Text>
                ) : null}
              </NexusSearchResultList>
            ) : null}
          </NexusSearchResultsBoundary>
        </View>

        {isSearching ? (
          <NexusSearchStatusText>Searching Nexus directory...</NexusSearchStatusText>
        ) : null}
      </View>
    </NexusCard>
  );
}

export function LocalityCreateBuilderPanel({
  canPreviewGraph,
  graphDisplaySections,
  graphNodeErrors,
  graphNodes,
  hasInvalidGraphHierarchy,
  inputRefs,
  isGraphReadyForPreview,
  isReviewing,
  isSubmitting,
  loadingScope,
  resultLimit,
  targetGraphNodeId,
  getGraphNodeKind,
  getGraphNodeName,
  getGraphNodeParentHierarchyIssue,
  getResultTypeLabel,
  onAddConnectedScope,
  onBackToSearch,
  onClearExistingNode,
  onOpenKindPicker,
  onOpenParentPicker,
  onPreview,
  onQueryChange,
  onRemoveNode,
  onSelectExistingChild,
  onSelectResult,
  onSubmitNode,
}: LocalityCreateBuilderPanelProps) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard className="gap-4 rounded-t-none border-t-0">
      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          Create locality
        </Text>
        <Text className={appearance.itemBodyClass}>
          Add locality scopes, then connect parents only when the relationship is useful.
        </Text>
      </View>

      <NexusLoadingBoundary label="Previewing locality path..." scope={loadingScope}>
        <View className="gap-4">
          {graphDisplaySections.map((section) => (
            <View key={section.id} className="gap-3">
              {section.id === 'unconnected' ? (
                <View className="gap-1 pt-1">
                  <Text className={appearance.itemMetaClass}>UNPLACED LOCALITIES</Text>
                  <Text className={appearance.itemBodyClass}>
                    Choose a parent when you want to place these in the draft tree.
                  </Text>
                </View>
              ) : null}
              {section.rows.map(({ node, depth }) => {
                const parentNode = node.parentId
                  ? graphNodes.find((candidateNode) => candidateNode.id === node.parentId) ?? null
                  : null;
                const existingParentResult = node.parentResult ?? parentNode?.selectedResult ?? null;
                const parentLabel = node.parentResult
                  ? `${node.parentResult.name} (existing)`
                  : parentNode
                    ? getGraphNodeName(parentNode)
                    : node.selectedResult && !node.hasParentSelection
                      ? 'Existing path'
                      : node.hasParentSelection
                        ? 'Global Commons'
                        : 'Choose parent';

                return (
                  <LocalityCreateGraphRow
                    key={node.id}
                    node={node}
                    depth={depth}
                    isTarget={node.id === targetGraphNodeId}
                    kindLabel={getGraphNodeKind(node).label}
                    parentLabel={parentLabel}
                    existingParentResult={existingParentResult}
                    canRemove={graphNodes.length > 1}
                    errorMessage={
                      graphNodeErrors[node.id] ??
                      getGraphNodeParentHierarchyIssue(graphNodes, node) ??
                      null
                    }
                    inputRef={(inputNode) => {
                      inputRefs.current[node.id] = inputNode;
                    }}
                    getResultTypeLabel={getResultTypeLabel}
                    searchResultLimit={resultLimit}
                    onQueryChange={onQueryChange}
                    onSubmitNode={onSubmitNode}
                    onSelectResult={onSelectResult}
                    onSelectExistingChild={onSelectExistingChild}
                    onOpenKindPicker={onOpenKindPicker}
                    onOpenParentPicker={onOpenParentPicker}
                    onRemoveNode={onRemoveNode}
                    onClearExistingNode={onClearExistingNode}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </NexusLoadingBoundary>

      <View className="flex-row flex-wrap gap-3">
        <NexusActionButton label="Add locality scope" onPress={onAddConnectedScope} />
        <NexusActionButton
          label={isReviewing ? 'Previewing...' : 'Next: Preview'}
          variant="primary"
          disabled={isReviewing || isSubmitting || !canPreviewGraph}
          onPress={onPreview}
        />
        <NexusActionButton label="Back to search" onPress={onBackToSearch} />
      </View>
      {!isGraphReadyForPreview ? (
        <Text className={appearance.itemMetaClass}>
          Add a name, type, and parent choice for every scope before preview. Parent may be set to none.
        </Text>
      ) : hasInvalidGraphHierarchy ? (
        <Text className="text-sm text-nexus-rose">
          One or more parent choices conflict with the selected locality types.
        </Text>
      ) : null}
    </NexusCard>
  );
}
