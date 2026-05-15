/**
 * File: locality-create-preview-panel.tsx
 * Description: Preview and confirmation panel for locality graph creation.
 */

import { Pressable, Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import type {
  NexusLocalityDuplicateWarningPayload,
  NexusLocalityReviewEntryPayload,
} from '@runtime/nexus/nexus-api-types';

type LocalityPreviewLevel = NexusLocalityReviewEntryPayload['level'];

export type LocalityCreatePreviewScopeRow = {
  key: string;
  scopeId: string;
  name: string;
  level: LocalityPreviewLevel;
  typeLabel: string;
  disposition: NexusLocalityReviewEntryPayload['disposition'];
  pathLabel: string;
  parentKey: string | null;
};

export type LocalityCreatePreviewDuplicateWarning = NexusLocalityDuplicateWarningPayload & {
  previewId: string;
  leafNodeId: string;
};

export function getLocalityPreviewAncestorKeys(
  rows: LocalityCreatePreviewScopeRow[],
  scopeKey: string | null
): Set<string> {
  const ancestorKeys = new Set<string>();

  if (!scopeKey) {
    return ancestorKeys;
  }

  const rowByKey = new Map(rows.map((row) => [row.key, row]));
  let currentRow = rowByKey.get(scopeKey) ?? null;

  while (currentRow) {
    if (ancestorKeys.has(currentRow.key)) {
      break;
    }

    ancestorKeys.add(currentRow.key);
    currentRow = currentRow.parentKey ? rowByKey.get(currentRow.parentKey) ?? null : null;
  }

  return ancestorKeys;
}

function CheckboxControl({
  checked,
  disabled = false,
  label,
  onPress,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      className={`h-9 w-[68px] items-center justify-center ${disabled ? 'opacity-50' : ''}`}
      disabled={disabled}
      onPress={onPress}
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded-[4px] border ${
          checked ? 'border-nexus-sky bg-nexus-sky/15' : 'border-nexus-line/80 bg-black/10'
        }`}
      >
        {checked ? <Text className="text-[10px] font-semibold text-nexus-sky">✓</Text> : null}
      </View>
    </Pressable>
  );
}

function getTreeRows(input: {
  rows: LocalityCreatePreviewScopeRow[];
  checkedKeys: Set<string>;
}): { row: LocalityCreatePreviewScopeRow; depth: number }[] {
  const childrenByParent = new Map<string | null, LocalityCreatePreviewScopeRow[]>();

  input.rows.forEach((row) => {
    if (!input.checkedKeys.has(row.key)) {
      return;
    }

    const parentKey = row.parentKey && input.checkedKeys.has(row.parentKey) ? row.parentKey : null;
    const siblings = childrenByParent.get(parentKey) ?? [];
    siblings.push(row);
    childrenByParent.set(parentKey, siblings);
  });

  const treeRows: { row: LocalityCreatePreviewScopeRow; depth: number }[] = [];
  const visited = new Set<string>();

  const visit = (row: LocalityCreatePreviewScopeRow, depth: number) => {
    if (visited.has(row.key)) {
      return;
    }

    visited.add(row.key);
    treeRows.push({ row, depth });
    (childrenByParent.get(row.key) ?? []).forEach((childRow) => visit(childRow, depth + 1));
  };

  (childrenByParent.get(null) ?? []).forEach((row) => visit(row, 0));

  return treeRows;
}

function getPreviewActionRows(
  rows: LocalityCreatePreviewScopeRow[]
): { row: LocalityCreatePreviewScopeRow; depth: number }[] {
  const rowByKey = new Map(rows.map((row) => [row.key, row]));
  const depthCache = new Map<string, number>();

  const getDepth = (row: LocalityCreatePreviewScopeRow, seen = new Set<string>()): number => {
    const cachedDepth = depthCache.get(row.key);

    if (cachedDepth !== undefined) {
      return cachedDepth;
    }

    if (!row.parentKey || seen.has(row.parentKey)) {
      depthCache.set(row.key, 0);
      return 0;
    }

    const parentRow = rowByKey.get(row.parentKey);

    if (!parentRow) {
      depthCache.set(row.key, 0);
      return 0;
    }

    seen.add(row.key);
    const depth = getDepth(parentRow, seen) + 1;
    depthCache.set(row.key, depth);
    return depth;
  };

  return rows.map((row) => ({ row, depth: getDepth(row) }));
}

function dispositionLabel(disposition: LocalityCreatePreviewScopeRow['disposition']) {
  return disposition === 'reuse_existing' ? 'reuse existing' : 'create new';
}

export function LocalityCreatePreviewPanel({
  rows,
  duplicateWarnings,
  locationDefinitionCount,
  relationLinkCount,
  homeScopeKey,
  scopeTreeSelection,
  associationSelection,
  followSelection,
  hasReturnTarget,
  isSubmitting,
  onToggleHomeScope,
  onToggleScopeTree,
  onToggleAssociation,
  onToggleFollow,
  onUseExistingWarning,
  onEditWarning,
  onBackToEdit,
  onCreate,
}: {
  rows: LocalityCreatePreviewScopeRow[];
  duplicateWarnings: LocalityCreatePreviewDuplicateWarning[];
  locationDefinitionCount: number;
  relationLinkCount: number;
  homeScopeKey: string | null;
  scopeTreeSelection: Record<string, boolean>;
  associationSelection: Record<string, boolean>;
  followSelection: Record<string, boolean>;
  hasReturnTarget: boolean;
  isSubmitting: boolean;
  onToggleHomeScope: (scopeKey: string) => void;
  onToggleScopeTree: (scopeKey: string) => void;
  onToggleAssociation: (scopeKey: string) => void;
  onToggleFollow: (scopeKey: string) => void;
  onUseExistingWarning: (warning: LocalityCreatePreviewDuplicateWarning) => void;
  onEditWarning: (warning: LocalityCreatePreviewDuplicateWarning) => void;
  onBackToEdit: () => void;
  onCreate: (createAnyway: boolean) => void;
}) {
  const appearance = useNexusAppearance();
  const homeTreeKeys = getLocalityPreviewAncestorKeys(rows, homeScopeKey);
  const actionRows = getPreviewActionRows(rows);
  const checkedTreeKeys = new Set<string>(
    rows
      .filter((row) => {
        const isEligibleForMainTree =
          homeTreeKeys.has(row.key) ||
          Boolean(associationSelection[row.key]) ||
          Boolean(followSelection[row.key]);

        return isEligibleForMainTree && (scopeTreeSelection[row.key] ?? true);
      })
      .map((row) => row.key)
  );
  const treeRows = getTreeRows({ rows, checkedKeys: checkedTreeKeys });

  return (
    <NexusCard className="gap-4 rounded-t-none border-t-0">
      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          Confirm locality graph
        </Text>
        <Text className={appearance.surfaceTitleClass}>Review scope actions</Text>
        <Text className={appearance.itemBodyClass}>
          Choose home, association, follow, and main-tree visibility before creating the draft graph.
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <NexusBadge label={`${rows.length} scopes reviewed`} tone="sky" />
        <NexusBadge label={`${locationDefinitionCount} location definitions`} tone="sky" />
        <NexusBadge label={`${relationLinkCount} relationship links`} tone="sky" />
        {homeScopeKey ? <NexusBadge label="home locality selected" tone="mint" /> : null}
      </View>

      <View className="gap-2">
        <View className="gap-1">
          <Text className={appearance.itemTitleClass}>Scope actions</Text>
          <Text className={appearance.itemMetaClass}>
            Main tree visibility is available only through home, association, or follow selections.
          </Text>
        </View>
        <View className="flex-row items-end gap-2 px-4">
          <View className="min-w-0 flex-1">
            <Text className={appearance.itemMetaClass}>SCOPE</Text>
          </View>
          <Text className={`w-[68px] text-center ${appearance.itemMetaClass}`}>HOME</Text>
          <Text className={`w-[68px] text-center ${appearance.itemMetaClass}`}>ASSOC.</Text>
          <Text className={`w-[68px] text-center ${appearance.itemMetaClass}`}>FOLLOW</Text>
          <Text className={`w-[68px] text-center ${appearance.itemMetaClass}`}>MAIN</Text>
        </View>
        <View className="gap-2">
          {actionRows.map(({ row, depth }) => {
            const isHome = homeScopeKey === row.key;
            const isHomeTreeScope = homeTreeKeys.has(row.key);
            const isAssociated = Boolean(associationSelection[row.key]);
            const isFollowed = Boolean(followSelection[row.key]);
            const isMainTreeEligible = isHomeTreeScope || isAssociated || isFollowed;
            const isInMainTree = isMainTreeEligible && (scopeTreeSelection[row.key] ?? true);

            return (
              <View key={row.key} style={{ marginLeft: depth * 18 }} className="flex-row gap-3">
                {depth > 0 ? (
                  <View className="w-4 items-center">
                    <View className="h-full w-px bg-nexus-line/80" />
                  </View>
                ) : null}
                <View className={`min-w-0 flex-1 flex-row items-center gap-2 rounded-[18px] border px-4 py-3 ${appearance.cardInsetClass}`}>
                  <View className="min-w-0 flex-1 gap-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className={appearance.itemTitleClass}>{row.name}</Text>
                      <NexusBadge label={row.typeLabel} tone="sky" />
                      <NexusBadge
                        label={dispositionLabel(row.disposition)}
                        tone={row.disposition === 'reuse_existing' ? 'mint' : 'gold'}
                      />
                    </View>
                    <Text className={appearance.itemMetaClass}>{row.pathLabel}</Text>
                  </View>
                  <CheckboxControl
                    label={`Make ${row.name} home`}
                    checked={isHome}
                    onPress={() => onToggleHomeScope(row.key)}
                  />
                  <CheckboxControl
                    label={`Associate with ${row.name}`}
                    checked={isAssociated}
                    onPress={() => onToggleAssociation(row.key)}
                  />
                  <CheckboxControl
                    label={`Follow ${row.name}`}
                    checked={isFollowed}
                    onPress={() => onToggleFollow(row.key)}
                  />
                  <CheckboxControl
                    label={`Show ${row.name} in main tree`}
                    checked={isInMainTree}
                    disabled={!isMainTreeEligible}
                    onPress={() => onToggleScopeTree(row.key)}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View className="gap-2">
        <Text className={appearance.itemTitleClass}>Main tree preview</Text>
        {treeRows.length > 0 ? (
          <View className="gap-2">
            {treeRows.map(({ row, depth }) => (
              <View key={row.key} style={{ marginLeft: depth * 18 }} className="flex-row gap-3">
                {depth > 0 ? (
                  <View className="w-4 items-center">
                    <View className="h-full w-px bg-nexus-line/80" />
                  </View>
                ) : null}
                <View
                  className={`min-w-0 flex-1 flex-row flex-wrap items-center gap-2 rounded-[16px] border px-3 py-2 ${appearance.cardInsetClass}`}
                >
                  <Text className={appearance.itemBodyClass}>{row.name}</Text>
                  <NexusBadge label={row.typeLabel} tone={homeScopeKey === row.key ? 'mint' : 'sky'} />
                  {homeScopeKey === row.key ? <NexusBadge label="home" tone="mint" /> : null}
                  {associationSelection[row.key] ? <NexusBadge label="associate" tone="mint" /> : null}
                  {followSelection[row.key] ? <NexusBadge label="follow" tone="sky" /> : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text className={appearance.itemMetaClass}>
            Choose home, associate, or follow on at least one scope to preview the main tree.
          </Text>
        )}
      </View>

      {duplicateWarnings.length > 0 ? (
        <NexusCard className={`gap-3 p-4 ${appearance.cardInsetClass}`} tone="gold">
          <Text className={appearance.itemTitleClass}>Possible duplicates</Text>
          {duplicateWarnings.map((warning) => (
            <View
              key={`${warning.previewId}-${warning.level}-${warning.existing_scope_id}`}
              className="gap-2"
            >
              <Text className={appearance.itemBodyClass}>{warning.message}</Text>
              <Text className={appearance.itemMetaClass}>
                Existing match: {warning.existing_result.path_label}
                {warning.existing_result.scope_type_label
                  ? ` · ${warning.existing_result.scope_type_label}`
                  : ''}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <NexusActionButton
                  label="Use existing"
                  variant="ghost"
                  onPress={() => onUseExistingWarning(warning)}
                />
                <NexusActionButton
                  label="Edit name"
                  variant="ghost"
                  onPress={() => onEditWarning(warning)}
                />
              </View>
            </View>
          ))}
        </NexusCard>
      ) : null}

      <View className="flex-row flex-wrap gap-3">
        <NexusActionButton label="Back to edit" variant="ghost" onPress={onBackToEdit} />
        <NexusActionButton
          label={
            isSubmitting
              ? 'Creating locality...'
              : homeScopeKey
                ? 'Create and apply selections'
                : hasReturnTarget
                  ? 'Create and return'
                  : 'Create locality'
          }
          variant="primary"
          disabled={isSubmitting || duplicateWarnings.length > 0}
          onPress={() => onCreate(false)}
        />
        {duplicateWarnings.length > 0 ? (
          <NexusActionButton
            label={isSubmitting ? 'Creating locality...' : 'Create anyway'}
            variant="ghost"
            disabled={isSubmitting}
            onPress={() => onCreate(true)}
          />
        ) : null}
      </View>
    </NexusCard>
  );
}
