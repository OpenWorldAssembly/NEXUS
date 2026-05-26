/**
 * File: locality-create-dialogs.tsx
 * Description: Feature-local modal content for the Nexus locality create route.
 */

import type { RefObject } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusSearchField,
  NexusSearchResultList,
  NexusSearchResultRow,
  NexusSearchResultsBoundary,
  NexusSearchStatusText,
  useNexusAppearance,
} from '@app/components/nexus/ui';
import { NexusModalShell } from '@app/components/nexus/ui/overlays';
import type {
  NexusLocationCreateCandidate,
  NexusLocationSearchResult,
} from '@runtime/nexus/location-search';
import type {
  CreateLocalityKindOption,
  LocalityGraphNode,
  LocalityMessageModalState,
  LocalityRemoveConfirmModalState,
  LocalitySuccessModalState,
} from './locality-create-types';

const DIALOG_BACKDROP_CLASS = 'absolute inset-0';
const DIALOG_CONTAINER_CLASS = 'flex-1 items-center justify-center bg-black/50 px-4';
const BASIC_DIALOG_CARD_CLASS = 'w-full max-w-xl gap-4';
const SCROLL_DIALOG_CARD_CLASS = 'max-h-[86%] w-full max-w-2xl gap-4';

export function LocalitySelectedResultDialog({
  hasReturnTarget,
  result,
  getResultTypeLabel,
  onClose,
  onOpenDashboard,
  onReturnWithLocality,
  onSetHomeLocality,
}: {
  hasReturnTarget: boolean;
  result: NexusLocationSearchResult | null;
  getResultTypeLabel: (result: NexusLocationSearchResult) => string;
  onClose: () => void;
  onOpenDashboard: (result: NexusLocationSearchResult) => void;
  onReturnWithLocality: (result: NexusLocationSearchResult) => void;
  onSetHomeLocality: (result: NexusLocationSearchResult) => void;
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusModalShell
      backdropClassName={DIALOG_BACKDROP_CLASS}
      cardClassName={BASIC_DIALOG_CARD_CLASS}
      containerClassName={DIALOG_CONTAINER_CLASS}
      contentClassName={null}
      onClose={onClose}
      visible={result !== null}
    >
      <Text className={appearance.surfaceTitleClass}>Use this locality?</Text>
      <View className={`gap-2 rounded-[18px] border px-4 py-3 ${appearance.cardInsetClass}`}>
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className={appearance.itemTitleClass}>{result?.name}</Text>
          {result ? <NexusBadge label={getResultTypeLabel(result)} tone="sky" /> : null}
        </View>
        <Text className={appearance.itemMetaClass}>{result?.path_label}</Text>
      </View>
      <View className="flex-row flex-wrap gap-3">
        {result ? (
          <NexusActionButton
            label="Set as home locality"
            variant="primary"
            onPress={() => onSetHomeLocality(result)}
          />
        ) : null}
        {result ? (
          <NexusActionButton
            label="Open scope"
            variant="ghost"
            onPress={() => onOpenDashboard(result)}
          />
        ) : null}
        {result && hasReturnTarget ? (
          <NexusActionButton
            label="Use this locality and return"
            variant="ghost"
            onPress={() => onReturnWithLocality(result)}
          />
        ) : null}
        <NexusActionButton label="Dismiss" variant="ghost" onPress={onClose} />
      </View>
    </NexusModalShell>
  );
}

export function LocalityRemoveConfirmDialog({
  state,
  onCancel,
  onConfirm,
}: {
  state: LocalityRemoveConfirmModalState;
  onCancel: () => void;
  onConfirm: (nodeId: string) => void;
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusModalShell
      backdropClassName={DIALOG_BACKDROP_CLASS}
      cardClassName={BASIC_DIALOG_CARD_CLASS}
      containerClassName={DIALOG_CONTAINER_CLASS}
      contentClassName={null}
      onClose={onCancel}
      visible={state !== null}
    >
      <View className="gap-2">
        <Text className={appearance.surfaceTitleClass}>Remove locality from draft?</Text>
        <Text className={appearance.itemBodyClass}>
          Are you sure you want to remove {state?.nodeName ?? 'this locality'}? Doing so will disconnect the connected children.
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-3">
        <NexusActionButton
          label="Remove and disconnect"
          variant="primary"
          onPress={() => {
            if (state) {
              onConfirm(state.nodeId);
            }
          }}
        />
        <NexusActionButton label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </NexusModalShell>
  );
}

export function LocalityParentPickerDialog({
  graphNodes,
  isParentSearching,
  loadingScope,
  parentPickerNode,
  parentSearchInputRef,
  parentSearchQuery,
  parentSearchResults,
  getDraftParentDisabledReason,
  getGraphNodeKind,
  getGraphNodeName,
  getResultTypeLabel,
  onClose,
  onSearchQueryChange,
  onSearchSubmit,
  onSelectDraftParent,
  onSelectExistingParent,
}: {
  graphNodes: LocalityGraphNode[];
  isParentSearching: boolean;
  loadingScope: string;
  parentPickerNode: LocalityGraphNode | null;
  parentSearchInputRef: RefObject<TextInput | null>;
  parentSearchQuery: string;
  parentSearchResults: NexusLocationSearchResult[];
  getDraftParentDisabledReason: (
    childNode: LocalityGraphNode,
    parentNode: LocalityGraphNode
  ) => string | null;
  getGraphNodeKind: (node: LocalityGraphNode) => CreateLocalityKindOption;
  getGraphNodeName: (node: LocalityGraphNode) => string;
  getResultTypeLabel: (result: NexusLocationSearchResult) => string;
  onClose: () => void;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: () => void;
  onSelectDraftParent: (nodeId: string, parentId: string | null) => void;
  onSelectExistingParent: (
    nodeId: string,
    result: NexusLocationSearchResult
  ) => void;
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusModalShell
      backdropClassName={DIALOG_BACKDROP_CLASS}
      cardClassName={SCROLL_DIALOG_CARD_CLASS}
      containerClassName={DIALOG_CONTAINER_CLASS}
      contentClassName={null}
      onClose={onClose}
      visible={parentPickerNode !== null}
    >
      <View className="gap-2">
        <Text className={appearance.surfaceTitleClass}>Choose parent scope</Text>
        <Text className={appearance.itemBodyClass}>
          Select an on-screen scope, search existing localities, or use Global Commons as the root parent.
        </Text>
      </View>
      {parentPickerNode ? (
        <ScrollView className="max-h-96" showsVerticalScrollIndicator>
          <View className="gap-4 pr-1">
            <View className="gap-2">
              <Text className={appearance.itemMetaClass}>Draft options</Text>
              <Pressable
                className={`rounded-[18px] border px-4 py-3 ${appearance.cardInsetClass}`}
                onPress={() => onSelectDraftParent(parentPickerNode.id, null)}
              >
                <View className="gap-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className={appearance.itemTitleClass}>Global Commons</Text>
                    <NexusBadge label="root parent" tone="sky" />
                    {parentPickerNode.hasParentSelection &&
                    !parentPickerNode.parentId &&
                    !parentPickerNode.parentResult ? (
                      <NexusBadge label="current" tone="mint" />
                    ) : null}
                  </View>
                  <Text className={appearance.itemMetaClass}>
                    Use the global root when this locality has no narrower known parent yet.
                  </Text>
                </View>
              </Pressable>
              {graphNodes
                .filter((candidateNode) => candidateNode.id !== parentPickerNode.id)
                .map((candidateNode) => {
                  const disabledReason = getDraftParentDisabledReason(
                    parentPickerNode,
                    candidateNode
                  );

                  return (
                    <Pressable
                      key={candidateNode.id}
                      disabled={Boolean(disabledReason)}
                      className={`rounded-[18px] border px-4 py-3 ${appearance.cardInsetClass} ${
                        disabledReason ? 'opacity-50' : ''
                      }`}
                      onPress={() => onSelectDraftParent(parentPickerNode.id, candidateNode.id)}
                    >
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className={appearance.itemTitleClass}>
                          {getGraphNodeName(candidateNode)}
                        </Text>
                        <NexusBadge label={getGraphNodeKind(candidateNode).label} tone="sky" />
                        {candidateNode.selectedResult ? (
                          <NexusBadge label="existing" tone="mint" />
                        ) : null}
                        {parentPickerNode.parentId === candidateNode.id ? (
                          <NexusBadge label="current" tone="mint" />
                        ) : null}
                      </View>
                      {disabledReason ? (
                        <Text className="mt-2 text-sm text-nexus-rose">{disabledReason}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
            </View>

            <View className="gap-2">
              <Text className={appearance.itemMetaClass}>Search existing localities</Text>
              <NexusSearchField
                ref={parentSearchInputRef}
                autoFocus={parentPickerNode !== null}
                value={parentSearchQuery}
                onChangeText={onSearchQueryChange}
                onSubmitEditing={onSearchSubmit}
                placeholder="Search existing parent scope"
                hasAttachedResults={parentSearchResults.length > 0}
              />
              <NexusSearchResultsBoundary
                loadingLabel="Searching existing localities..."
                loadingScope={loadingScope}
              >
                {parentSearchResults.length > 0 ? (
                  <NexusSearchResultList attached>
                    {parentSearchResults.map((result) => (
                      <NexusSearchResultRow
                        key={result.scope_id}
                        attached
                        onPress={() => onSelectExistingParent(parentPickerNode.id, result)}
                      >
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className={appearance.itemTitleClass}>{result.name}</Text>
                          <NexusBadge label={getResultTypeLabel(result)} tone="sky" />
                          {parentPickerNode.parentResult?.scope_id === result.scope_id ? (
                            <NexusBadge label="current" tone="mint" />
                          ) : null}
                        </View>
                        <Text className={appearance.itemMetaClass}>{result.path_label}</Text>
                      </NexusSearchResultRow>
                    ))}
                  </NexusSearchResultList>
                ) : null}
              </NexusSearchResultsBoundary>
              {isParentSearching ? (
                <NexusSearchStatusText>Searching existing localities...</NexusSearchStatusText>
              ) : null}
            </View>
          </View>
        </ScrollView>
      ) : null}
      <View className="flex-row flex-wrap gap-3">
        <NexusActionButton label="Dismiss" variant="ghost" onPress={onClose} />
      </View>
    </NexusModalShell>
  );
}

export function LocalityKindPickerDialog({
  activeKindId,
  options,
  visible,
  onClose,
  onSelectOption,
}: {
  activeKindId: string | null;
  options: CreateLocalityKindOption[];
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: CreateLocalityKindOption) => void;
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusModalShell
      backdropClassName={DIALOG_BACKDROP_CLASS}
      cardClassName={SCROLL_DIALOG_CARD_CLASS}
      containerClassName={DIALOG_CONTAINER_CLASS}
      contentClassName={null}
      onClose={onClose}
      visible={visible}
    >
      <View className="gap-2">
        <Text className={appearance.surfaceTitleClass}>Choose locality type</Text>
        <Text className={appearance.itemBodyClass}>
          Choose the closest current type for this locality row.
        </Text>
      </View>
      <ScrollView className="max-h-96" showsVerticalScrollIndicator>
        <View className="gap-2 pr-1">
          {options.map((option) => {
            const isSelected = option.id === activeKindId;

            return (
              <Pressable
                key={option.id}
                className={`rounded-[18px] border px-4 py-2 ${
                  isSelected ? 'border-nexus-sky bg-nexus-sky/10' : appearance.cardInsetClass
                }`}
                onPress={() => onSelectOption(option)}
              >
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className={appearance.itemTitleClass}>{option.label}</Text>
                  <NexusBadge label={option.legacyLevel} tone={isSelected ? 'mint' : 'sky'} />
                </View>
                <Text className={appearance.itemMetaClass}>{option.description}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View className="flex-row flex-wrap gap-3">
        <NexusActionButton label="Dismiss" variant="ghost" onPress={onClose} />
      </View>
    </NexusModalShell>
  );
}

export function LocalityCreateKindDialog({
  candidate,
  options,
  selectedKindId,
  onClose,
  onConfirm,
  onSelectOption,
}: {
  candidate: NexusLocationCreateCandidate | null;
  options: CreateLocalityKindOption[];
  selectedKindId: string;
  onClose: () => void;
  onConfirm: () => void;
  onSelectOption: (
    candidate: NexusLocationCreateCandidate,
    option: CreateLocalityKindOption
  ) => void;
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusModalShell
      backdropClassName={DIALOG_BACKDROP_CLASS}
      cardClassName={SCROLL_DIALOG_CARD_CLASS}
      containerClassName={DIALOG_CONTAINER_CLASS}
      contentClassName={null}
      onClose={onClose}
      visible={candidate !== null}
    >
      <View className="gap-2">
        <Text className={appearance.surfaceTitleClass}>
          Create new locality scope for {`"${candidate?.query.trim() ?? ''}"`}
        </Text>
        <Text className={appearance.itemBodyClass}>
          Choose the closest current type to continue.
        </Text>
      </View>
      <ScrollView className="max-h-96" showsVerticalScrollIndicator>
        <View className="gap-2 pr-1">
          {options.map((option) => {
            const isSelected = option.id === selectedKindId;

            return (
              <Pressable
                key={option.id}
                className={`rounded-[18px] border px-4 py-2 ${
                  isSelected ? 'border-nexus-sky bg-nexus-sky/10' : appearance.cardInsetClass
                }`}
                onPress={() => {
                  if (!candidate) {
                    return;
                  }

                  onSelectOption(candidate, option);
                }}
              >
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className={appearance.itemTitleClass}>{option.label}</Text>
                  <NexusBadge label={option.legacyLevel} tone={isSelected ? 'mint' : 'sky'} />
                </View>
                <Text className={appearance.itemMetaClass}>{option.description}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View className="flex-row flex-wrap gap-3">
        <NexusActionButton label="Continue" variant="primary" onPress={onConfirm} />
        <NexusActionButton label="Dismiss" variant="ghost" onPress={onClose} />
      </View>
    </NexusModalShell>
  );
}

export function LocalityOutcomeDialogs({
  successModal,
  workflowErrorModal,
  onCloseSuccess,
  onCloseWorkflowError,
  onOpenDashboard,
}: {
  successModal: LocalitySuccessModalState;
  workflowErrorModal: LocalityMessageModalState;
  onCloseSuccess: () => void;
  onCloseWorkflowError: () => void;
  onOpenDashboard: (locality: NexusLocationSearchResult) => void;
}) {
  const appearance = useNexusAppearance();

  return (
    <>
      <NexusModalShell
        backdropClassName={DIALOG_BACKDROP_CLASS}
        cardClassName={BASIC_DIALOG_CARD_CLASS}
        containerClassName={DIALOG_CONTAINER_CLASS}
        contentClassName={null}
        onClose={onCloseSuccess}
        visible={successModal !== null}
      >
        <Text className={appearance.surfaceTitleClass}>{successModal?.title}</Text>
        <Text className={appearance.itemBodyClass}>{successModal?.message}</Text>
        <View className="flex-row flex-wrap gap-3">
          {successModal?.showDashboardAction ? (
            <NexusActionButton
              label="Open dashboard"
              variant="primary"
              onPress={() => {
                if (successModal) {
                  onOpenDashboard(successModal.locality);
                }
              }}
            />
          ) : null}
          <NexusActionButton label="Dismiss" variant="ghost" onPress={onCloseSuccess} />
        </View>
      </NexusModalShell>

      <NexusModalShell
        backdropClassName={DIALOG_BACKDROP_CLASS}
        cardClassName={BASIC_DIALOG_CARD_CLASS}
        containerClassName={DIALOG_CONTAINER_CLASS}
        contentClassName={null}
        onClose={onCloseWorkflowError}
        tone="rose"
        visible={workflowErrorModal !== null}
      >
        <Text className={appearance.surfaceTitleClass}>{workflowErrorModal?.title}</Text>
        <Text className={appearance.itemBodyClass}>{workflowErrorModal?.message}</Text>
        <View className="flex-row flex-wrap gap-3">
          <NexusActionButton
            label="Dismiss"
            variant="primary"
            onPress={onCloseWorkflowError}
          />
        </View>
      </NexusModalShell>
    </>
  );
}
