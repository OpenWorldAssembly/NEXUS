/**
 * File: create.tsx
 * Description: Guided locality selection and creation flow for Nexus home-locality journeys.
 */

import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import {
  LocalityCreateBuilderPanel,
  LocalityCreateKindDialog,
  LocalityCreateSearchPanel,
  LocalityIdentityRequiredCard,
  LocalityKindPickerDialog,
  LocalityOutcomeDialogs,
  LocalityParentPickerDialog,
  LocalityCreatePreviewPanel,
  LocalityRemoveConfirmDialog,
  LocalitySelectedResultDialog,
  getLocalityPreviewAncestorKeys,
  type CreateLocalityKindOption,
  type LocalityCreatePreviewDuplicateWarning,
  type LocalityCreatePreviewScopeRow,
  type LocalityGraphDisplayRow,
  type LocalityGraphDisplaySection,
  type LocalityGraphNode,
  type LocalityLevel,
  type LocalityMessageModalState,
  type LocalityRemoveConfirmModalState,
  type LocalitySuccessModalState,
  type LocalityWorkflowTab,
} from '@app/components/nexus/features/locality';
import { useNexusAuthGate } from '@app/components/nexus/nexus-auth-gate';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  NexusBadge,
  NexusCard,
  NexusSearchField,
  NexusSearchResultList,
  NexusSearchResultRow,
  NexusSearchResultsBoundary,
  NexusSectionHeader,
  useNexusAppearance,
  useNexusLoading,
} from '@app/components/nexus/ui';
import { NexusTabRail, type NexusTabNode } from '@app/components/nexus/ui/tabs/nexus-tabs';
import type {
  LocalityHierarchySystem,
  LocalityScopeDescriptor,
  NexusLocationCreateCandidate,
  NexusLocationSearchResult,
} from '@runtime/nexus/location-search';
import { createLocalityCanonicalNameKey } from '@runtime/nexus/location-search-normalization';
import type {
  NexusLocalityGraphApplyPayload,
  NexusLocalityPathEntryPayload,
  NexusLocalityPathPreviewPayload,
  NexusLocalityReviewEntryPayload,
} from '@runtime/nexus/nexus-api-types';
import {
  fetchNexusLocationSearchPayload,
  previewNexusLocalityPath,
} from '@runtime/nexus/nexus-query-api';
import { NexusApiError } from '@runtime/nexus/nexus-query-api.shared';

type LocalityCreateMode = 'build' | 'preview';

type LocalityTypePickerContext = {
  level: LocalityLevel;
  isTarget: boolean;
  nodeId?: string;
} | null;

const LOCALITY_LEVELS: LocalityLevel[] = ['nation', 'region', 'city', 'district'];
const SEARCH_RESULT_LIMIT = 8;
const LOCALITY_CREATE_SEARCH_LOADING_SCOPE = 'locality-create:search-results';
const LOCALITY_CREATE_PARENT_PICKER_LOADING_SCOPE =
  'locality-create:parent-picker-results';
const LOCALITY_CREATE_PREVIEW_LOADING_SCOPE = 'locality-create:preview';
const LOCALITY_CREATE_PATH_LOADING_SCOPE = 'locality-create:create-path';
const LOCALITY_SET_HOME_LOADING_SCOPE = 'locality-create:set-home';

const LOCALITY_WORKFLOW_TAB_NODES: NexusTabNode[] = [
  { id: 'search', label: 'Search', shortLabel: 'Search' },
  { id: 'create', label: 'Create', shortLabel: 'Create' },
];

const CREATE_LOCALITY_KIND_OPTIONS: CreateLocalityKindOption[] = [
  { id: 'nation', label: 'Nation / Country', description: 'A country, nation, or equivalent top-level locality.', legacyLevel: 'nation', scaleRank: 10 },
  { id: 'state-region', label: 'State / Province / Region', description: 'A state, province, prefecture, autonomous region, or similar area.', legacyLevel: 'region', scaleRank: 20 },
  { id: 'county-district', label: 'County / District / Regency', description: 'A county, district, regency, borough, parish, or similar middle scope.', legacyLevel: 'region', scaleRank: 30 },
  { id: 'electoral-district', label: 'Electoral district', description: 'A congressional, legislative, council, or other voting district.', legacyLevel: 'district', scaleRank: 40 },
  { id: 'city-town', label: 'City / Town / Village', description: 'A city, town, village, municipality, ward, or similar local place.', legacyLevel: 'city', scaleRank: 50 },
  { id: 'postal-code', label: 'Postal code', description: 'A ZIP code, postal code, or delivery zone.', legacyLevel: 'district', scaleRank: 60 },
  { id: 'neighborhood', label: 'Neighborhood', description: 'A neighborhood, community area, subdivision, or local district.', legacyLevel: 'district', scaleRank: 70 },
  { id: 'street-block', label: 'Street / Block', description: 'A street, road, block, corridor, or similar addressing scope.', legacyLevel: 'district', scaleRank: 80 },
  { id: 'building', label: 'Building', description: 'A building, campus structure, venue, or facility.', legacyLevel: 'district', scaleRank: 90 },
  { id: 'custom', label: 'Custom locality scope', description: 'A manually defined locality scope that does not fit the common labels.', legacyLevel: 'district', scaleRank: null },
];

function getDefaultKindIdForLevel(level: LocalityLevel): string {
  if (level === 'nation') return 'nation';
  if (level === 'region') return 'state-region';
  if (level === 'city') return 'city-town';
  return 'neighborhood';
}

function getHierarchySystemForKindOption(
  option: CreateLocalityKindOption
): LocalityHierarchySystem {
  if (option.id === 'electoral-district') {
    return 'electoral';
  }

  if (option.id === 'postal-code') {
    return 'postal';
  }

  if (option.id === 'street-block') {
    return 'addressing';
  }

  if (option.id === 'building') {
    return 'building';
  }

  if (option.id === 'custom') {
    return 'custom';
  }

  return 'administrative';
}

function createScopeDescriptorForKindOption(
  option: CreateLocalityKindOption
): LocalityScopeDescriptor {
  return {
    hierarchy_system: getHierarchySystemForKindOption(option),
    local_type_label: option.label,
    local_type_key: option.id,
    legacy_level: option.legacyLevel,
  };
}

function getDefaultKindOption(): CreateLocalityKindOption {
  return (
    CREATE_LOCALITY_KIND_OPTIONS.find((option) => option.id === 'city-town') ??
    CREATE_LOCALITY_KIND_OPTIONS[0]
  );
}

function getKindOptionById(kindId: string): CreateLocalityKindOption {
  return (
    CREATE_LOCALITY_KIND_OPTIONS.find((option) => option.id === kindId) ??
    getDefaultKindOption()
  );
}

function allowsFlexibleHierarchy(kindId: string): boolean {
  return kindId === 'custom';
}

function getKindHierarchyIssue(input: {
  childKindId: string;
  parentKindId: string;
}): string | null {
  if (
    allowsFlexibleHierarchy(input.childKindId) ||
    allowsFlexibleHierarchy(input.parentKindId)
  ) {
    return null;
  }

  const childKind = getKindOptionById(input.childKindId);
  const parentKind = getKindOptionById(input.parentKindId);

  if (childKind.id === 'electoral-district' && parentKind.id === 'city-town') {
    return null;
  }

  if (
    childKind.scaleRank === null ||
    parentKind.scaleRank === null ||
    parentKind.scaleRank < childKind.scaleRank
  ) {
    return null;
  }

  return 'Choose a broader parent type or change one of the types.';
}

function getGraphNodeName(node: LocalityGraphNode): string {
  return node.selectedResult?.name ?? (node.query.trim() || 'Unnamed connected scope');
}

function getParentHierarchyIssue(input: {
  childKindId: string;
  parentKindId: string | null;
}): string | null {
  if (!input.parentKindId) {
    return null;
  }

  return getKindHierarchyIssue({
    childKindId: input.childKindId,
    parentKindId: input.parentKindId,
  });
}

function getKindIdForSearchResult(result: NexusLocationSearchResult): string {
  if (
    result.scope_type_key &&
    CREATE_LOCALITY_KIND_OPTIONS.some((option) => option.id === result.scope_type_key)
  ) {
    return result.scope_type_key;
  }

  return getDefaultKindIdForLevel(result.legacy_level ?? result.level);
}

function getKindOptionsForLevel(level: LocalityLevel, isTarget: boolean): CreateLocalityKindOption[] {
  if (isTarget) {
    return CREATE_LOCALITY_KIND_OPTIONS;
  }

  return CREATE_LOCALITY_KIND_OPTIONS.filter((option) => option.legacyLevel === level);
}

function getDefaultKindSelections(): Record<LocalityLevel, string> {
  return {
    nation: getDefaultKindIdForLevel('nation'),
    region: getDefaultKindIdForLevel('region'),
    city: getDefaultKindIdForLevel('city'),
    district: getDefaultKindIdForLevel('district'),
  };
}

type LocalityLevelEntry = {
  query: string;
  selectedResult: NexusLocationSearchResult | null;
  isNew: boolean;
};

type LocalityLevelErrorMap = Partial<Record<LocalityLevel, string>>;

type LocalityGraphNodeErrorMap = Partial<Record<string, string>>;

type LocalityGraphPreviewResult = {
  previewId: string;
  leafNodeId: string;
  path: NexusLocalityPathEntryPayload[];
  payload: NexusLocalityPathPreviewPayload;
};

type LocalityCreateDraftState = {
  searchQuery?: string;
  activeWorkflowTab?: LocalityWorkflowTab;
  graphNodes?: LocalityGraphNode[];
  targetGraphNodeId?: string;
  applyAsHomeLocality?: boolean;
  selectedCreateKindId?: string;
};

const LOCALITY_CREATE_DRAFT_STORAGE_KEY = 'nexus.locality.create.draft.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDraftSearchResult(value: unknown): value is NexusLocationSearchResult {
  return (
    isRecord(value) &&
    typeof value.scope_id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.path_label === 'string'
  );
}

function sanitizeDraftGraphNode(value: unknown): LocalityGraphNode | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.query !== 'string') {
    return null;
  }

  const kindId = typeof value.kindId === 'string'
    ? value.kindId
    : getDefaultKindIdForLevel('city');

  return {
    id: value.id,
    query: value.query,
    selectedResult: isDraftSearchResult(value.selectedResult) ? value.selectedResult : null,
    isNew: typeof value.isNew === 'boolean' ? value.isNew : value.query.trim().length >= 2,
    kindId,
    parentId: typeof value.parentId === 'string' ? value.parentId : null,
    parentResult: isDraftSearchResult(value.parentResult) ? value.parentResult : null,
    hasParentSelection: typeof value.hasParentSelection === 'boolean'
      ? value.hasParentSelection
      : typeof value.parentId === 'string',
  };
}

function readLocalityCreateDraft(): LocalityCreateDraftState | null {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }

  try {
    const rawDraft = window.sessionStorage.getItem(LOCALITY_CREATE_DRAFT_STORAGE_KEY);

    if (!rawDraft) {
      return null;
    }

    const parsedDraft: unknown = JSON.parse(rawDraft);

    if (!isRecord(parsedDraft)) {
      return null;
    }

    const graphNodes = Array.isArray(parsedDraft.graphNodes)
      ? parsedDraft.graphNodes
          .map((node) => sanitizeDraftGraphNode(node))
          .filter((node): node is LocalityGraphNode => node !== null)
      : undefined;

    return {
      searchQuery: typeof parsedDraft.searchQuery === 'string' ? parsedDraft.searchQuery : undefined,
      activeWorkflowTab: parsedDraft.activeWorkflowTab === 'create' ? 'create' : 'search',
      graphNodes: graphNodes && graphNodes.length > 0 ? graphNodes : undefined,
      targetGraphNodeId: typeof parsedDraft.targetGraphNodeId === 'string'
        ? parsedDraft.targetGraphNodeId
        : undefined,
      applyAsHomeLocality: typeof parsedDraft.applyAsHomeLocality === 'boolean'
        ? parsedDraft.applyAsHomeLocality
        : undefined,
      selectedCreateKindId: typeof parsedDraft.selectedCreateKindId === 'string'
        ? parsedDraft.selectedCreateKindId
        : undefined,
    };
  } catch {
    return null;
  }
}

function writeLocalityCreateDraft(draft: LocalityCreateDraftState) {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }

  window.sessionStorage.setItem(LOCALITY_CREATE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

function clearLocalityCreateDraft() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }

  window.sessionStorage.removeItem(LOCALITY_CREATE_DRAFT_STORAGE_KEY);
}


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


function createGraphNodeId(): string {
  return `locality-node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createLocalityGraphNode(input: {
  query?: string;
  kindId?: string;
  parentId?: string | null;
  hasParentSelection?: boolean;
} = {}): LocalityGraphNode {
  const query = input.query?.trim() ?? '';

  return {
    id: createGraphNodeId(),
    query,
    selectedResult: null,
    isNew: query.length >= 2,
    kindId: input.kindId ?? getDefaultKindIdForLevel('city'),
    parentId: input.parentId ?? null,
    parentResult: null,
    hasParentSelection: input.hasParentSelection ?? input.parentId !== undefined,
  };
}

function getGraphNodeKind(node: LocalityGraphNode): CreateLocalityKindOption {
  return getKindOptionById(node.kindId);
}

function createExistingLocalityGraphNode(result: NexusLocationSearchResult): LocalityGraphNode {
  return {
    id: createGraphNodeId(),
    query: result.name,
    selectedResult: result,
    isNew: false,
    kindId: getKindIdForSearchResult(result),
    parentId: null,
    parentResult: null,
    hasParentSelection: false,
  };
}

function findExistingGraphNodeForResult(
  nodes: LocalityGraphNode[],
  result: NexusLocationSearchResult
): LocalityGraphNode | null {
  return (
    nodes.find((node) => node.selectedResult?.scope_id === result.scope_id) ?? null
  );
}

function upsertExistingGraphAnchor(input: {
  nodes: LocalityGraphNode[];
  result: NexusLocationSearchResult;
}): { nodes: LocalityGraphNode[]; anchorId: string } {
  const existingAnchor = findExistingGraphNodeForResult(input.nodes, input.result);

  if (existingAnchor) {
    return { nodes: input.nodes, anchorId: existingAnchor.id };
  }

  const anchorNode = createExistingLocalityGraphNode(input.result);
  return { nodes: input.nodes.concat(anchorNode), anchorId: anchorNode.id };
}

function getGraphNodeChildren(
  nodes: LocalityGraphNode[],
  parentId: string | null
): LocalityGraphNode[] {
  return nodes.filter((node) => node.parentId === parentId);
}

function getGraphDisplayRows(nodes: LocalityGraphNode[]): LocalityGraphDisplayRow[] {
  const rows: LocalityGraphDisplayRow[] = [];
  const visited = new Set<string>();

  const visit = (node: LocalityGraphNode, depth: number) => {
    if (visited.has(node.id)) {
      return;
    }

    visited.add(node.id);
    rows.push({ node, depth });

    getGraphNodeChildren(nodes, node.id).forEach((childNode) => visit(childNode, depth + 1));
  };

  getGraphNodeChildren(nodes, null).forEach((node) => visit(node, 0));

  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      visit(node, 0);
    }
  });

  return rows;
}

function getGraphTreeRows(input: {
  nodes: LocalityGraphNode[];
  rootNode: LocalityGraphNode;
  visited: Set<string>;
}): LocalityGraphDisplayRow[] {
  const rows: LocalityGraphDisplayRow[] = [];

  const visit = (node: LocalityGraphNode, depth: number) => {
    if (input.visited.has(node.id)) {
      return;
    }

    input.visited.add(node.id);
    rows.push({ node, depth });

    getGraphNodeChildren(input.nodes, node.id).forEach((childNode) =>
      visit(childNode, depth + 1)
    );
  };

  visit(input.rootNode, 0);
  return rows;
}

function getGraphDisplaySections(input: {
  nodes: LocalityGraphNode[];
  targetNodeId: string;
}): LocalityGraphDisplaySection[] {
  const visited = new Set<string>();
  const targetRootNode = getGraphRootAncestor(input.nodes, input.targetNodeId);
  const sections: LocalityGraphDisplaySection[] = [];

  if (targetRootNode) {
    const connectedRows = getGraphTreeRows({
      nodes: input.nodes,
      rootNode: targetRootNode,
      visited,
    });

    if (connectedRows.length > 0) {
      sections.push({ id: 'connected', rows: connectedRows });
    }
  }

  const unconnectedRows: LocalityGraphDisplayRow[] = [];
  input.nodes.forEach((node) => {
    if (visited.has(node.id)) {
      return;
    }

    const rootNode = getGraphRootAncestor(input.nodes, node.id) ?? node;
    unconnectedRows.push(
      ...getGraphTreeRows({
        nodes: input.nodes,
        rootNode,
        visited,
      })
    );
  });

  if (unconnectedRows.length > 0) {
    sections.push({ id: 'unconnected', rows: unconnectedRows });
  }

  return sections;
}

function getGraphDescendantIds(nodes: LocalityGraphNode[], nodeId: string): Set<string> {
  const descendantIds = new Set<string>();
  const visit = (currentNodeId: string) => {
    nodes
      .filter((node) => node.parentId === currentNodeId)
      .forEach((childNode) => {
        if (descendantIds.has(childNode.id)) {
          return;
        }

        descendantIds.add(childNode.id);
        visit(childNode.id);
      });
  };

  visit(nodeId);
  return descendantIds;
}

function getGraphRootAncestor(
  nodes: LocalityGraphNode[],
  nodeId: string
): LocalityGraphNode | null {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  let currentNode = nodeById.get(nodeId) ?? null;
  const visited = new Set<string>();

  while (currentNode?.parentId) {
    if (visited.has(currentNode.id)) {
      return currentNode;
    }

    visited.add(currentNode.id);
    currentNode = nodeById.get(currentNode.parentId) ?? currentNode;
  }

  return currentNode;
}

function getGraphAncestry(input: {
  nodes: LocalityGraphNode[];
  targetNodeId: string;
}): LocalityGraphNode[] {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  const chain: LocalityGraphNode[] = [];
  let currentNode = nodeById.get(input.targetNodeId) ?? null;
  const visited = new Set<string>();

  while (currentNode) {
    if (visited.has(currentNode.id)) {
      return [];
    }

    visited.add(currentNode.id);
    chain.push(currentNode);
    currentNode = currentNode.parentId ? nodeById.get(currentNode.parentId) ?? null : null;
  }

  return chain.reverse();
}

function getGraphNodeParentKindId(
  nodes: LocalityGraphNode[],
  node: LocalityGraphNode
): string | null {
  if (node.parentResult) {
    return getKindIdForSearchResult(node.parentResult);
  }

  if (!node.parentId) {
    return null;
  }

  const parentNode = nodes.find((candidateNode) => candidateNode.id === node.parentId) ?? null;
  return parentNode?.kindId ?? null;
}

function getGraphNodeParentHierarchyIssue(
  nodes: LocalityGraphNode[],
  node: LocalityGraphNode
): string | null {
  return getParentHierarchyIssue({
    childKindId: node.kindId,
    parentKindId: getGraphNodeParentKindId(nodes, node),
  });
}

function getPathEntriesForExistingLocality(
  result: NexusLocationSearchResult
): NexusLocalityPathEntryPayload[] {
  const pathEntries = result.path_entries?.length
    ? result.path_entries
    : [
        {
          scope_id: result.scope_id,
          name: result.name,
          level: result.legacy_level ?? result.level,
          scope_type_label: result.scope_type_label ?? null,
        },
      ];

  return pathEntries.map((entry) => ({
    level: entry.level,
    name: entry.name,
    existing_scope_id: entry.scope_id,
    alias_keys: [],
    display_aliases: [],
    scope_descriptor: null,
  }));
}

function buildGraphPathEntries(input: {
  nodes: LocalityGraphNode[];
  targetNodeId: string;
}): NexusLocalityPathEntryPayload[] {
  const entries: NexusLocalityPathEntryPayload[] = [];
  const seenExistingScopeIds = new Set<string>();

  const pushEntry = (entry: NexusLocalityPathEntryPayload) => {
    if (entry.existing_scope_id) {
      if (seenExistingScopeIds.has(entry.existing_scope_id)) {
        return;
      }

      seenExistingScopeIds.add(entry.existing_scope_id);
    }

    entries.push(entry);
  };

  for (const node of getGraphAncestry(input)) {
    if (node.parentResult) {
      getPathEntriesForExistingLocality(node.parentResult).forEach(pushEntry);
    }

    if (node.selectedResult) {
      getPathEntriesForExistingLocality(node.selectedResult).forEach(pushEntry);
      continue;
    }

    const kindOption = getGraphNodeKind(node);
    const name = node.query.trim();

    if (!name) {
      continue;
    }

    pushEntry({
      level: kindOption.legacyLevel,
      name,
      existing_scope_id: null,
      alias_keys: [],
      display_aliases: [],
      scope_descriptor: createScopeDescriptorForKindOption(kindOption),
    });
  }

  return entries;
}

function getGraphPreviewRequests(input: {
  nodes: LocalityGraphNode[];
  targetNodeId: string;
}): { previewId: string; leafNodeId: string; path: NexusLocalityPathEntryPayload[] }[] {
  const displayRows = getGraphDisplayRows(input.nodes);
  const leafNodeIds = displayRows
    .filter(({ node }) => getGraphNodeChildren(input.nodes, node.id).length === 0)
    .map(({ node }) => node.id);
  const targetNode = input.nodes.find((node) => node.id === input.targetNodeId) ?? null;
  const targetNodeId = targetNode?.id ?? leafNodeIds[0] ?? null;
  const orderedLeafNodeIds = Array.from(
    new Set([
      ...(targetNodeId && leafNodeIds.includes(targetNodeId) ? [targetNodeId] : []),
      ...leafNodeIds,
    ])
  );
  const seenPathKeys = new Set<string>();

  return orderedLeafNodeIds
    .map((leafNodeId) => {
      const path = buildGraphPathEntries({
        nodes: input.nodes,
        targetNodeId: leafNodeId,
      });
      const pathKey = path
        .map((entry) => entry.existing_scope_id ?? `${entry.level}:${entry.name.toLowerCase()}`)
        .join('>');

      if (path.length === 0 || seenPathKeys.has(pathKey)) {
        return null;
      }

      seenPathKeys.add(pathKey);

      return {
        previewId: `${leafNodeId}:${pathKey}`,
        leafNodeId,
        path,
      };
    })
    .filter(
      (request): request is {
        previewId: string;
        leafNodeId: string;
        path: NexusLocalityPathEntryPayload[];
      } => request !== null
    );
}

function getPreviewEntryScopeId(entry: NexusLocalityReviewEntryPayload): string {
  return (
    entry.existing_result?.scope_id ??
    entry.planned_scope_packet_id ??
    `${entry.level}:${createLocalityCanonicalNameKey(entry.name)}`
  );
}

function buildPreviewScopeRows(
  previews: LocalityGraphPreviewResult[]
): LocalityCreatePreviewScopeRow[] {
  const rowByKey = new Map<string, LocalityCreatePreviewScopeRow>();

  previews.forEach((preview) => {
    let parentKey: string | null = null;
    const pathNames: string[] = [];

    preview.payload.review_entries.forEach((entry) => {
      const scopeId = getPreviewEntryScopeId(entry);
      const key = scopeId;

      pathNames.push(entry.name);

      if (!rowByKey.has(key)) {
        rowByKey.set(key, {
          key,
          scopeId,
          name: entry.name,
          level: entry.level,
          typeLabel: getReviewEntryTypeLabel(entry),
          disposition: entry.disposition,
          pathLabel: pathNames.join(' / '),
          parentKey,
        });
      }

      parentKey = key;
    });
  });

  return Array.from(rowByKey.values());
}

function buildPreviewDuplicateWarnings(
  previews: LocalityGraphPreviewResult[]
): LocalityCreatePreviewDuplicateWarning[] {
  return previews.flatMap((preview) =>
    preview.payload.duplicate_warnings.map((warning) => ({
      ...warning,
      previewId: preview.previewId,
      leafNodeId: preview.leafNodeId,
    }))
  );
}

function countUniquePreviewValues(
  previews: LocalityGraphPreviewResult[],
  selectValues: (payload: NexusLocalityPathPreviewPayload) => string[]
): number {
  return new Set(previews.flatMap((preview) => selectValues(preview.payload))).size;
}

function createLocalityResultFromPreviewRow(
  row: LocalityCreatePreviewScopeRow
): NexusLocationSearchResult {
  return {
    scope_id: row.scopeId,
    name: row.name,
    short_label: row.name,
    locality_label: row.name,
    level: row.level,
    path_label: row.pathLabel,
    parent_path_label: null,
    canonical_name_key: createLocalityCanonicalNameKey(row.name),
    alias_keys: [],
    display_aliases: [],
    path_entries: row.pathLabel.split(' / ').map((name, index, names) => ({
      scope_id: index === names.length - 1 ? row.scopeId : `${row.scopeId}:ancestor:${index}`,
      name,
      level: row.level,
      scope_type_label: index === names.length - 1 ? row.typeLabel : null,
    })),
    match_type: 'exact',
    description: `${row.name} locality`,
    disclosure_options: [],
    scope_descriptor: null,
    scope_type_label: row.typeLabel,
    scope_type_key: null,
    scope_hierarchy_system: null,
    legacy_level: row.level,
    manual_status: null,
  };
}

function autoAcceptGraphNodes(nodes: LocalityGraphNode[]): LocalityGraphNode[] {
  return nodes.map((node) => {
    if (!node.selectedResult && !node.isNew && node.query.trim().length >= 2) {
      return {
        ...node,
        query: node.query.trim(),
        isNew: true,
      };
    }

    return node;
  });
}

function findIncompleteGraphNode(input: {
  nodes: LocalityGraphNode[];
}): LocalityGraphNode | null {
  return (
    input.nodes.find(
      (node) => !node.selectedResult && !node.isNew && node.query.trim().length < 2
    ) ??
    input.nodes.find((node) => !node.selectedResult && !node.hasParentSelection) ??
    null
  );
}

function isGraphReadyForPreview(nodes: LocalityGraphNode[]): boolean {
  return findIncompleteGraphNode({ nodes }) === null;
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

function sortLocalityLevels(levels: LocalityLevel[]): LocalityLevel[] {
  return [...new Set(levels)].sort(
    (leftLevel, rightLevel) =>
      LOCALITY_LEVELS.indexOf(leftLevel) - LOCALITY_LEVELS.indexOf(rightLevel)
  );
}

function getParentLevelsForFinalLevel(finalLevel: LocalityLevel): LocalityLevel[] {
  const finalLevelIndex = LOCALITY_LEVELS.indexOf(finalLevel);

  if (finalLevelIndex <= 0) {
    return [];
  }

  return LOCALITY_LEVELS.slice(0, finalLevelIndex);
}

function getNextConnectedParentLevel(input: {
  finalLevel: LocalityLevel;
  includedParentLevels: LocalityLevel[];
}): LocalityLevel | null {
  const availableParentLevels = getParentLevelsForFinalLevel(input.finalLevel).filter(
    (level) => !input.includedParentLevels.includes(level)
  );

  return availableParentLevels[availableParentLevels.length - 1] ?? null;
}

function getVisibleLevels(input: {
  finalLevel: LocalityLevel;
  includedParentLevels: LocalityLevel[];
}): LocalityLevel[] {
  return sortLocalityLevels([...input.includedParentLevels, input.finalLevel]);
}

function clearDownstreamEntries(
  entries: Record<LocalityLevel, LocalityLevelEntry>,
  level: LocalityLevel,
  options: { preserveLevel?: LocalityLevel | null } = {}
): Record<LocalityLevel, LocalityLevelEntry> {
  const levelIndex = LOCALITY_LEVELS.indexOf(level);

  return Object.fromEntries(
    LOCALITY_LEVELS.map((currentLevel, index) => {
      const shouldPreserve = options.preserveLevel === currentLevel;

      return [
        currentLevel,
        index > levelIndex && !shouldPreserve
            ? createLevelEntry(entries[currentLevel]?.query ?? '')
            : entries[currentLevel],
      ];
    })
  ) as Record<LocalityLevel, LocalityLevelEntry>;
}

function getDownstreamPreserveLevel(
  changedLevel: LocalityLevel,
  seededTargetLevel: LocalityLevel | null
): LocalityLevel | null {
  if (!seededTargetLevel) {
    return null;
  }

  return LOCALITY_LEVELS.indexOf(seededTargetLevel) > LOCALITY_LEVELS.indexOf(changedLevel)
    ? seededTargetLevel
    : null;
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

function createSearchFallbackCreateCandidate(input: {
  query: string;
  results: NexusLocationSearchResult[];
}): NexusLocationCreateCandidate | null {
  const trimmedQuery = input.query.trim();

  if (
    trimmedQuery.length < 2 ||
    input.results.length === 0 ||
    !input.results.some((result) => result.level !== 'nation')
  ) {
    return null;
  }

  return {
    query: trimmedQuery,
    canonical_name_key: createLocalityCanonicalNameKey(trimmedQuery),
    label: 'Need a different branch? Create a new locality path.',
    description:
      'A same-name locality may already exist elsewhere in Nexus. You can still create this locality under a different parent path.',
    level: null,
    parent_scope_id: null,
  };
}

function buildVisiblePathEntries(input: {
  entries: Record<LocalityLevel, LocalityLevelEntry>;
  visibleLevels: LocalityLevel[];
  levelKindSelections: Record<LocalityLevel, string>;
}): NexusLocalityPathEntryPayload[] {
  return input.visibleLevels.flatMap((level): NexusLocalityPathEntryPayload[] => {
    const entry = input.entries[level];
    const isIncluded = entry.selectedResult !== null || entry.isNew;

    if (!isIncluded) {
      return [];
    }

    return [
      {
        level,
        name: entry.selectedResult?.name ?? entry.query.trim(),
        existing_scope_id: entry.selectedResult?.scope_id ?? null,
        alias_keys: [],
        display_aliases: [],
        scope_descriptor: createScopeDescriptorForKindOption(
          getKindOptionById(
            input.levelKindSelections[level] ?? getDefaultKindIdForLevel(level)
          )
        ),
      },
    ];
  });
}

function findNearestSelectedParentResult(input: {
  level: LocalityLevel;
  entries: Record<LocalityLevel, LocalityLevelEntry>;
}): NexusLocationSearchResult | null {
  const levelIndex = LOCALITY_LEVELS.indexOf(input.level);

  for (let index = levelIndex - 1; index >= 0; index -= 1) {
    const candidateLevel = LOCALITY_LEVELS[index];
    const candidateEntry = input.entries[candidateLevel];

    if (candidateEntry?.selectedResult) {
      return candidateEntry.selectedResult;
    }
  }

  return null;
}

function hasPendingNewAncestor(input: {
  level: LocalityLevel;
  entries: Record<LocalityLevel, LocalityLevelEntry>;
}): boolean {
  const levelIndex = LOCALITY_LEVELS.indexOf(input.level);

  for (let index = levelIndex - 1; index >= 0; index -= 1) {
    const candidateLevel = LOCALITY_LEVELS[index];
    const candidateEntry = input.entries[candidateLevel];

    if (candidateEntry?.isNew) {
      return true;
    }
  }

  return false;
}

function autoAcceptDraftEntries(input: {
  entries: Record<LocalityLevel, LocalityLevelEntry>;
  visibleLevels: LocalityLevel[];
}): Record<LocalityLevel, LocalityLevelEntry> {
  return Object.fromEntries(
    LOCALITY_LEVELS.map((level) => {
      const entry = input.entries[level];

      if (
        input.visibleLevels.includes(level) &&
        !entry.selectedResult &&
        !entry.isNew &&
        entry.query.trim().length >= 2
      ) {
        return [
          level,
          {
            ...entry,
            query: entry.query.trim(),
            isNew: true,
          },
        ];
      }

      return [level, entry];
    })
  ) as Record<LocalityLevel, LocalityLevelEntry>;
}

function findIncompleteLevel(input: {
  entries: Record<LocalityLevel, LocalityLevelEntry>;
  visibleLevels: LocalityLevel[];
}): LocalityLevel | null {
  const targetLevel = input.visibleLevels[input.visibleLevels.length - 1] ?? null;

  return (
    input.visibleLevels.find((level) => {
      const entry = input.entries[level];
      const hasTypedValue = entry.query.trim().length > 0;

      if (targetLevel === level) {
        return !entry.selectedResult && !entry.isNew;
      }

      return hasTypedValue && !entry.selectedResult && !entry.isNew;
    }) ?? null
  );
}

function getWorkflowErrorMessage(input: unknown, fallback: string): string {
  const message = input instanceof Error ? input.message : fallback;

  if (message.trim().toLowerCase() === 'not found') {
    return 'The locality preview service was not found in this running build. Restart or rebuild the app, then try previewing again. If it persists, check that /api/nexus/locality-preview is being served.';
  }

  return message;
}

function getSearchResultTypeLabel(result: NexusLocationSearchResult): string {
  return result.scope_type_label ?? getLevelLabel(result.level);
}

function getReviewEntryTypeLabel(entry: NexusLocalityReviewEntryPayload): string {
  return (
    entry.scope_descriptor?.local_type_label ??
    entry.existing_result?.scope_type_label ??
    getLevelLabel(entry.level)
  );
}

function LocalityLevelSearchRow(input: {
  level: LocalityLevel;
  roleLabel: string;
  hierarchyHint: string;
  entry: LocalityLevelEntry;
  isEnabled: boolean;
  parentResult: NexusLocationSearchResult | null;
  parentIsPendingNew: boolean;
  selectedKind: CreateLocalityKindOption;
  inputRef?: (node: TextInput | null) => void;
  onOpenKindPicker: (level: LocalityLevel) => void;
  onQueryChange: (level: LocalityLevel, query: string) => void;
  onSelectResult: (level: LocalityLevel, result: NexusLocationSearchResult) => void;
  onSubmitLevel: (level: LocalityLevel) => void;
  errorMessage?: string | null;
}) {
  const appearance = useNexusAppearance();
  const loading = useNexusLoading();
  const searchLoadingScope = `locality-create:level-row-results:${input.level}`;
  const [results, setResults] = useState<NexusLocationSearchResult[]>([]);
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
      return () => {
        isMounted = false;
      };
    }

    const timeoutHandle = setTimeout(() => {
      const operationId = loading.beginLoading(searchLoadingScope, {
        label: 'Searching existing localities...',
      });

      void fetchNexusLocationSearchPayload(query, {
        level: input.level,
        parentScopeId,
      })
        .then((payload) => {
          if (!isMounted) {
            return;
          }

          setResults(payload.results.slice(0, SEARCH_RESULT_LIMIT));
        })
        .catch(() => {
          if (!isMounted) {
            return;
          }

          setResults([]);
        })
        .finally(() => {
          loading.endLoading(operationId);
        });
    }, 220);

    return () => {
      isMounted = false;
      clearTimeout(timeoutHandle);
    };
  }, [input.level, loading, parentScopeId, query, searchLoadingScope, shouldSearch]);

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className={appearance.itemMetaClass}>{input.roleLabel}</Text>
            {input.entry.selectedResult ? (
              <NexusBadge label="existing" tone="mint" />
            ) : input.entry.isNew ? (
              <NexusBadge label="new candidate" tone="gold" />
            ) : null}
          </View>
          <Text className={appearance.itemBodyClass}>{input.hierarchyHint}</Text>
        </View>
        <Pressable
          className={`rounded-[14px] border px-3 py-2 ${appearance.cardInsetClass}`}
          onPress={() => input.onOpenKindPicker(input.level)}
        >
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className={appearance.itemMetaClass}>TYPE</Text>
            <Text className={appearance.itemTitleClass}>{input.selectedKind.label}</Text>
          </View>
        </Pressable>
      </View>
      <NexusSearchField
        ref={input.inputRef}
        value={input.entry.query}
        editable={input.isEnabled}
        onChangeText={(nextQuery) => input.onQueryChange(input.level, nextQuery)}
        onSubmitEditing={() => input.onSubmitLevel(input.level)}
        returnKeyType="next"
        placeholder={
          input.isEnabled
            ? `Search or enter ${input.selectedKind.label.toLowerCase()}`
            : `Choose ${getLevelLabel(getPreviousLevel(input.level) ?? 'nation').toLowerCase()} first`
        }
        isInset={!input.isEnabled}
      />

      {input.errorMessage ? (
        <Text className="text-sm text-nexus-rose">{input.errorMessage}</Text>
      ) : null}

      {results.length > 0 ? (
        <NexusSearchResultsBoundary
          loadingLabel="Searching existing localities..."
          loadingScope={searchLoadingScope}
        >
        <NexusSearchResultList>
          {results.map((result) => (
            <NexusSearchResultRow
              key={result.scope_id}
              onPress={() => input.onSelectResult(input.level, result)}
            >
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className={appearance.itemTitleClass}>{result.name}</Text>
                <NexusBadge label={getSearchResultTypeLabel(result)} tone="sky" />
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
        </NexusSearchResultList>
        </NexusSearchResultsBoundary>
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
  const loading = useNexusLoading();
  const {
    activeScope,
    currentActorPacketId,
    refreshShellData,
    setActiveScopeId,
  } = useNexusShell();
  const { currentMode, isAuthenticated, runFortressMutation } = useIdentityShell();
  const explicitReturnTo = getSingleParam(params.return_to);
  const returnTo = explicitReturnTo ?? '/nexus/trust';
  const hasReturnTarget = explicitReturnTo !== null;
  const returnScopeId = getSingleParam(params.return_scope_id);
  const initialQuery = getSingleParam(params.query) ?? '';
  const shouldSetHome = getSingleParam(params.set_home) === '1';
  const initialCreateDraft = useMemo(() => {
    const savedDraft = initialQuery.trim().length === 0 ? readLocalityCreateDraft() : null;
    const graphNodes = savedDraft?.graphNodes?.length
      ? savedDraft.graphNodes
      : [
          createLocalityGraphNode({
            query: initialQuery,
            kindId: getDefaultKindIdForLevel('city'),
          }),
        ];
    const targetGraphNodeId = savedDraft?.targetGraphNodeId &&
      graphNodes.some((node) => node.id === savedDraft.targetGraphNodeId)
      ? savedDraft.targetGraphNodeId
      : graphNodes[0]?.id ?? '';

    return {
      savedDraft,
      graphNodes,
      targetGraphNodeId,
    };
  }, [initialQuery]);
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<LocalityWorkflowTab>(
    initialCreateDraft.savedDraft?.activeWorkflowTab ?? 'search'
  );
  const [createMode, setCreateMode] = useState<LocalityCreateMode>('build');
  const [searchQuery, setSearchQuery] = useState(
    initialQuery || initialCreateDraft.savedDraft?.searchQuery || ''
  );
  const [results, setResults] = useState<NexusLocationSearchResult[]>([]);
  const [searchCreateCandidate, setSearchCreateCandidate] =
    useState<NexusLocationCreateCandidate | null>(null);
  const [appliedSearchCandidateKey, setAppliedSearchCandidateKey] = useState<string | null>(null);
  const [createKindCandidate, setCreateKindCandidate] =
    useState<NexusLocationCreateCandidate | null>(null);
  const [selectedCreateKindId, setSelectedCreateKindId] = useState(
    initialCreateDraft.savedDraft?.selectedCreateKindId ?? 'city-town'
  );
  const [selectedExistingResult, setSelectedExistingResult] =
    useState<NexusLocationSearchResult | null>(null);
  const [successModal, setSuccessModal] = useState<LocalitySuccessModalState>(null);
  const [workflowErrorModal, setWorkflowErrorModal] = useState<LocalityMessageModalState>(null);
  const [removeConfirmModal, setRemoveConfirmModal] = useState<LocalityRemoveConfirmModalState>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchRefreshNonce, setSearchRefreshNonce] = useState(0);
  const [finalLevel, setFinalLevel] = useState<LocalityLevel>('city');
  const [includedParentLevels, setIncludedParentLevels] = useState<LocalityLevel[]>([]);
  const [levelKindSelections, setLevelKindSelections] = useState<Record<LocalityLevel, string>>(
    () => getDefaultKindSelections()
  );
  const [graphNodes, setGraphNodes] = useState<LocalityGraphNode[]>(
    () => initialCreateDraft.graphNodes
  );
  const [targetGraphNodeId, setTargetGraphNodeId] = useState(
    () => initialCreateDraft.targetGraphNodeId
  );
  const [graphNodeErrors, setGraphNodeErrors] = useState<LocalityGraphNodeErrorMap>({});
  const [parentPickerNodeId, setParentPickerNodeId] = useState<string | null>(null);
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [parentSearchResults, setParentSearchResults] = useState<NexusLocationSearchResult[]>([]);
  const [isParentSearching, setIsParentSearching] = useState(false);
  const [typePickerContext, setTypePickerContext] = useState<LocalityTypePickerContext>(null);
  const [levelEntries, setLevelEntries] = useState<Record<LocalityLevel, LocalityLevelEntry>>(
    () => createLevelEntries()
  );
  const [seededTargetLevel, setSeededTargetLevel] = useState<LocalityLevel | null>(null);
  const [reviewPreview, setReviewPreview] = useState<NexusLocalityPathPreviewPayload | null>(
    null
  );
  const [reviewPreviews, setReviewPreviews] = useState<LocalityGraphPreviewResult[]>([]);
  const [homeLocalityScopeKey, setHomeLocalityScopeKey] = useState<string | null>(null);
  const [scopeTreeSelection, setScopeTreeSelection] = useState<Record<string, boolean>>({});
  const [associationSelection, setAssociationSelection] = useState<Record<string, boolean>>({});
  const [followSelection, setFollowSelection] = useState<Record<string, boolean>>({});
  const [applyAsHomeLocality, setApplyAsHomeLocality] = useState(
    initialCreateDraft.savedDraft?.applyAsHomeLocality ?? shouldSetHome
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [levelErrors, setLevelErrors] = useState<LocalityLevelErrorMap>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isClaimedIdentity = currentMode === 'claimed' && isAuthenticated;
  const visibleLevels = useMemo(
    () => getVisibleLevels({ finalLevel, includedParentLevels }),
    [finalLevel, includedParentLevels]
  );
  const nextConnectedParentLevel = useMemo(
    () => getNextConnectedParentLevel({ finalLevel, includedParentLevels }),
    [finalLevel, includedParentLevels]
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
  const levelInputRefs = useRef<Record<LocalityLevel, TextInput | null>>({
    nation: null,
    region: null,
    city: null,
    district: null,
  });
  const graphInputRefs = useRef<Record<string, TextInput | null>>({});
  const parentSearchInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    const timeoutHandle = setTimeout(() => {
      writeLocalityCreateDraft({
        searchQuery,
        activeWorkflowTab,
        graphNodes,
        targetGraphNodeId,
        applyAsHomeLocality,
        selectedCreateKindId,
      });
    }, 120);

    return () => clearTimeout(timeoutHandle);
  }, [
    activeWorkflowTab,
    applyAsHomeLocality,
    graphNodes,
    searchQuery,
    selectedCreateKindId,
    targetGraphNodeId,
  ]);

  const effectiveSearchCreateCandidate =
    searchCreateCandidate ??
    createSearchFallbackCreateCandidate({
      query: searchQuery,
      results,
    });
  const searchCandidateKey = getCreateCandidateKey(effectiveSearchCreateCandidate);
  const visibleSearchResults = results.slice(0, SEARCH_RESULT_LIMIT);
  const hiddenSearchResultCount = Math.max(0, results.length - visibleSearchResults.length);
  const showSearchCreateRow =
    Boolean(effectiveSearchCreateCandidate) &&
    searchQuery.trim().length >= 2 &&
    !isSearching &&
    searchCandidateKey !== appliedSearchCandidateKey;
  const hasSearchDropdown =
    visibleSearchResults.length > 0 || showSearchCreateRow || hiddenSearchResultCount > 0;
  const graphDisplaySections = useMemo(
    () => getGraphDisplaySections({ nodes: graphNodes, targetNodeId: targetGraphNodeId }),
    [graphNodes, targetGraphNodeId]
  );
  const targetGraphNode = graphNodes.find((node) => node.id === targetGraphNodeId) ?? graphNodes[0] ?? null;
  const parentPickerNode = parentPickerNodeId
    ? graphNodes.find((node) => node.id === parentPickerNodeId) ?? null
    : null;
  const hasInvalidGraphHierarchy = graphNodes.some((node) =>
    getGraphNodeParentHierarchyIssue(graphNodes, node) !== null
  );
  const canPreviewGraph =
    Boolean(targetGraphNode) && isGraphReadyForPreview(graphNodes) && !hasInvalidGraphHierarchy;

  useEffect(() => {
    setParentSearchQuery('');
    setParentSearchResults([]);
    setIsParentSearching(false);

    if (parentPickerNodeId) {
      setTimeout(() => parentSearchInputRef.current?.focus(), 90);
    }
  }, [parentPickerNodeId]);

  useEffect(() => {
    let isMounted = true;
    const query = parentSearchQuery.trim();

    if (!parentPickerNode || query.length < 2) {
      setParentSearchResults([]);
      setIsParentSearching(false);
      return () => {
        isMounted = false;
      };
    }

    setIsParentSearching(true);
    const timeoutHandle = setTimeout(() => {
      const operationId = loading.beginLoading(
        LOCALITY_CREATE_PARENT_PICKER_LOADING_SCOPE,
        { label: 'Searching existing localities...' }
      );

      void fetchNexusLocationSearchPayload(query)
        .then((payload) => {
          if (!isMounted) {
            return;
          }

          setParentSearchResults(
            payload.results
              .filter((result) => result.scope_id !== parentPickerNode.selectedResult?.scope_id)
              .filter(
                (result) =>
                  getParentHierarchyIssue({
                    childKindId: parentPickerNode.kindId,
                    parentKindId: getKindIdForSearchResult(result),
                  }) === null
              )
              .slice(0, SEARCH_RESULT_LIMIT)
          );
        })
        .catch(() => {
          if (!isMounted) {
            return;
          }

          setParentSearchResults([]);
        })
        .finally(() => {
          if (isMounted) {
            setIsParentSearching(false);
          }
          loading.endLoading(operationId);
        });
    }, 220);

    return () => {
      isMounted = false;
      clearTimeout(timeoutHandle);
    };
  }, [loading, parentPickerNode, parentSearchQuery]);

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
    setReviewPreviews([]);
    setHomeLocalityScopeKey(null);
    setScopeTreeSelection({});
    setAssociationSelection({});
    setFollowSelection({});
    setCreateMode('build');
  };

  const clearLevelErrors = () => {
    setLevelErrors({});
    setGraphNodeErrors({});
  };

  const resetCreateBuilderState = () => {
    clearLocalityCreateDraft();
    setCreateMode('build');
    setFinalLevel('city');
    setIncludedParentLevels([]);
    setLevelKindSelections(getDefaultKindSelections());
    const resetGraphNode = createLocalityGraphNode({ kindId: getDefaultKindIdForLevel('city') });
    setGraphNodes([resetGraphNode]);
    setTargetGraphNodeId(resetGraphNode.id);
    setGraphNodeErrors({});
    setParentPickerNodeId(null);
    setRemoveConfirmModal(null);
    setLevelEntries(createLevelEntries());
    setSeededTargetLevel(null);
    setReviewPreview(null);
    setReviewPreviews([]);
    setHomeLocalityScopeKey(null);
    setScopeTreeSelection({});
    setAssociationSelection({});
    setFollowSelection({});
    setTypePickerContext(null);
    setCreateKindCandidate(null);
    setSelectedCreateKindId(getDefaultKindIdForLevel('city'));
    setApplyAsHomeLocality(shouldSetHome);
    clearLevelErrors();
    setErrorMessage(null);
    setStatusMessage(null);
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
      const operationId = loading.beginLoading(
        LOCALITY_CREATE_SEARCH_LOADING_SCOPE,
        { label: 'Searching Nexus directory...' }
      );

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
          loading.endLoading(operationId);
        });
    }, 220);

    return () => {
      isMounted = false;
      clearTimeout(timeoutHandle);
    };
  }, [loading, searchQuery, searchRefreshNonce]);

  const handleTopSearchSubmit = () => {
    if (showSearchCreateRow && effectiveSearchCreateCandidate && visibleSearchResults.length === 0) {
      setCreateKindCandidate(effectiveSearchCreateCandidate);
      setSelectedCreateKindId(
        getDefaultKindIdForLevel(
          normalizeCandidateLevel(effectiveSearchCreateCandidate.level)
        )
      );
      return;
    }

    if (visibleSearchResults[0]) {
      setSelectedExistingResult(visibleSearchResults[0]);
      return;
    }

    if (!hasSearchDropdown && searchQuery.trim().length >= 2) {
      setSearchRefreshNonce((currentNonce) => currentNonce + 1);
    }
  };

  const previewScopeRows = useMemo(
    () => buildPreviewScopeRows(reviewPreviews),
    [reviewPreviews]
  );
  const previewDuplicateWarnings = useMemo(
    () => buildPreviewDuplicateWarnings(reviewPreviews),
    [reviewPreviews]
  );
  const previewLocationDefinitionCount = useMemo(
    () =>
      countUniquePreviewValues(
        reviewPreviews,
        (payload) => payload.planned_location_packet_ids
      ),
    [reviewPreviews]
  );
  const previewRelationLinkCount = useMemo(
    () =>
      countUniquePreviewValues(
        reviewPreviews,
        (payload) => payload.planned_relation_packet_ids
      ),
    [reviewPreviews]
  );
  const selectedHomePreviewRow = useMemo(
    () =>
      homeLocalityScopeKey
        ? previewScopeRows.find((row) => row.key === homeLocalityScopeKey) ?? null
        : null,
    [homeLocalityScopeKey, previewScopeRows]
  );

  useEffect(() => {
    if (previewScopeRows.length === 0) {
      setHomeLocalityScopeKey(null);
      setScopeTreeSelection({});
      setAssociationSelection({});
      setFollowSelection({});
      return;
    }

    const primaryFinalScopeId = reviewPreview
      ? getPreviewEntryScopeId(
          reviewPreview.review_entries[reviewPreview.review_entries.length - 1]
        )
      : null;
    const defaultHomeKey = applyAsHomeLocality
      ? primaryFinalScopeId ?? previewScopeRows[previewScopeRows.length - 1]?.key ?? null
      : null;

    setHomeLocalityScopeKey((currentKey) => {
      if (!applyAsHomeLocality) {
        return null;
      }

      return currentKey && previewScopeRows.some((row) => row.key === currentKey)
        ? currentKey
        : defaultHomeKey;
    });
    setScopeTreeSelection((currentSelection) =>
      Object.fromEntries(
        previewScopeRows
          .filter((row) => currentSelection[row.key] !== undefined)
          .map((row) => [row.key, currentSelection[row.key]])
      )
    );
    setAssociationSelection((currentSelection) =>
      Object.fromEntries(
        previewScopeRows
          .filter((row) => currentSelection[row.key])
          .map((row) => [row.key, true])
      )
    );
    setFollowSelection((currentSelection) =>
      Object.fromEntries(
        previewScopeRows
          .filter((row) => currentSelection[row.key])
          .map((row) => [row.key, true])
      )
    );
  }, [applyAsHomeLocality, previewScopeRows, reviewPreview]);

  const buildPathEntries = (
    nodes: LocalityGraphNode[] = graphNodes
  ) =>
    buildGraphPathEntries({
      nodes,
      targetNodeId: targetGraphNodeId,
    });

  const runLocalityPreview = async (input?: {
    nodes?: LocalityGraphNode[];
    createAnyway?: boolean;
  }) => {
    const rawNodes = input?.nodes ?? graphNodes;
    const nodes = autoAcceptGraphNodes(rawNodes);
    const createAnyway = input?.createAnyway ?? false;

    if (nodes !== rawNodes) {
      setGraphNodes(nodes);
    }

    const incompleteNode = findIncompleteGraphNode({ nodes });

    if (incompleteNode) {
      setGraphNodeErrors({
        [incompleteNode.id]: incompleteNode.query.trim().length < 2
          ? 'Enter at least two characters before preview.'
          : 'Choose a parent, or choose no parent, before preview.',
      });
      setErrorMessage(null);
      return;
    }

    const invalidHierarchyNode = nodes.find((node) =>
      getGraphNodeParentHierarchyIssue(nodes, node) !== null
    );

    if (invalidHierarchyNode) {
      setGraphNodeErrors({
        [invalidHierarchyNode.id]:
          getGraphNodeParentHierarchyIssue(nodes, invalidHierarchyNode) ??
          'Choose a broader parent type or change one of the types.',
      });
      setErrorMessage(null);
      return;
    }

    const previewRequests = getGraphPreviewRequests({
      nodes,
      targetNodeId: targetGraphNodeId,
    });

    if (previewRequests.length === 0) {
      setWorkflowErrorModal({
        title: 'Unable to preview locality',
        message: 'Select a locality scope before previewing.',
      });
      return;
    }

    const shortRequest = previewRequests.find((request) =>
      request.path.some((entry) => !entry.existing_scope_id && entry.name.length < 2)
    );
    const shortEntry = shortRequest?.path.find(
      (entry) => !entry.existing_scope_id && entry.name.length < 2
    );

    if (shortRequest && shortEntry) {
      const matchingNode = getGraphAncestry({
        nodes,
        targetNodeId: shortRequest.leafNodeId,
      }).find((node) => getGraphNodeKind(node).legacyLevel === shortEntry.level);
      setGraphNodeErrors(
        matchingNode
          ? { [matchingNode.id]: 'Enter at least two searchable characters for this new locality.' }
          : {}
      );
      setErrorMessage(null);
      return;
    }

    setIsReviewing(true);
    setErrorMessage(null);
    clearLevelErrors();
    setStatusMessage(null);

    try {
      await loading.runWithLoading(
        LOCALITY_CREATE_PREVIEW_LOADING_SCOPE,
        async () => {
          const previewResults = await Promise.all(
            previewRequests.map(async (request) => ({
              previewId: request.previewId,
              leafNodeId: request.leafNodeId,
              path: request.path,
              payload: await previewNexusLocalityPath({
                actor_packet_id: currentActorPacketId,
                path: request.path,
                create_anyway: createAnyway,
              }),
            }))
          );
          const primaryPreview =
            previewResults.find((result) => result.leafNodeId === targetGraphNodeId) ??
            previewResults[0] ??
            null;

          setReviewPreviews(previewResults);
          setReviewPreview(primaryPreview?.payload ?? null);
          setActiveWorkflowTab('create');
          setCreateMode('preview');
        },
        { label: 'Previewing locality path...' }
      );
    } catch (error) {
      setReviewPreview(null);
      setReviewPreviews([]);
      setErrorMessage(null);
      setWorkflowErrorModal({
        title: 'Unable to preview locality',
        message: getWorkflowErrorMessage(error, 'Unable to preview locality path.'),
      });
    } finally {
      setIsReviewing(false);
    }
  };

  const handleGraphNodeQueryChange = (nodeId: string, query: string) => {
    setErrorMessage(null);
    clearLevelErrors();
    setStatusMessage(null);
    resetReviewState();
    setGraphNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              query,
              selectedResult: null,
              isNew: false,
            }
          : node
      )
    );
  };

  const handleSubmitGraphNode = (nodeId: string) => {
    const currentNode = graphNodes.find((node) => node.id === nodeId);

    if (!currentNode) {
      return;
    }

    const trimmedQuery = currentNode.query.trim();

    if (trimmedQuery.length < 2) {
      setGraphNodeErrors({
        [nodeId]: 'Enter at least two characters before accepting this locality.',
      });
      return;
    }

    const nextNodes = graphNodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            query: trimmedQuery,
            selectedResult: null,
            isNew: true,
          }
        : node
    );

    setGraphNodes(nextNodes);
    clearLevelErrors();
    resetReviewState();

    const nextBlankNode = getGraphDisplayRows(nextNodes)
      .map((row) => row.node)
      .find((node) => !node.selectedResult && !node.isNew && node.query.trim().length < 2);

    if (nextBlankNode) {
      setTimeout(() => graphInputRefs.current[nextBlankNode.id]?.focus(), 40);
      return;
    }

    graphInputRefs.current[nodeId]?.blur();
  };

  const handleAddConnectedScope = () => {
    const targetNode = graphNodes.find((node) => node.id === targetGraphNodeId) ?? graphNodes[0];

    if (!targetNode) {
      return;
    }

    const nextNode = createLocalityGraphNode({
      kindId: targetNode.kindId,
    });

    setGraphNodes((currentNodes) => currentNodes.concat(nextNode));
    setActiveWorkflowTab('create');
    setCreateMode('build');
    resetReviewState();
    setTimeout(() => graphInputRefs.current[nextNode.id]?.focus(), 60);
  };

  const performRemoveGraphNode = (nodeId: string) => {
    if (graphNodes.length <= 1) {
      return;
    }

    const removedNode = graphNodes.find((node) => node.id === nodeId);

    if (!removedNode) {
      return;
    }

    const nextNodes = graphNodes
      .filter((node) => node.id !== nodeId)
      .map((node) =>
        node.parentId === nodeId
          ? {
              ...node,
              parentId: null,
              parentResult: null,
              hasParentSelection: false,
            }
          : node
      );

    setGraphNodes(nextNodes);
    setTargetGraphNodeId((currentTargetId) =>
      currentTargetId === nodeId ? nextNodes[0]?.id ?? '' : currentTargetId
    );
    setParentPickerNodeId(null);
    setRemoveConfirmModal(null);
    clearLevelErrors();
    resetReviewState();
  };

  const handleRemoveGraphNode = (nodeId: string) => {
    if (graphNodes.length <= 1) {
      return;
    }

    const removedNode = graphNodes.find((node) => node.id === nodeId);

    if (!removedNode) {
      return;
    }

    const childCount = graphNodes.filter((node) => node.parentId === nodeId).length;

    if (childCount > 0) {
      setRemoveConfirmModal({
        nodeId,
        nodeName: getGraphNodeName(removedNode),
        childCount,
      });
      return;
    }

    performRemoveGraphNode(nodeId);
  };

  const handleClearExistingGraphNode = (nodeId: string) => {
    setGraphNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              query: '',
              selectedResult: null,
              isNew: false,
            }
          : node
      )
    );
    clearLevelErrors();
    resetReviewState();
    setTimeout(() => graphInputRefs.current[nodeId]?.focus(), 40);
  };

  const handleSelectGraphParent = (nodeId: string, parentId: string | null) => {
    const childNode = graphNodes.find((node) => node.id === nodeId) ?? null;
    const parentNode = parentId
      ? graphNodes.find((node) => node.id === parentId) ?? null
      : null;
    const hierarchyIssue = childNode && parentNode
      ? getParentHierarchyIssue({
          childKindId: childNode.kindId,
          parentKindId: parentNode.kindId,
        })
      : null;

    if (hierarchyIssue) {
      setGraphNodeErrors({ [nodeId]: hierarchyIssue });
      return;
    }

    setGraphNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              parentId,
              parentResult: null,
              hasParentSelection: true,
            }
          : node
      )
    );
    setParentPickerNodeId(null);
    clearLevelErrors();
    resetReviewState();
  };

  const handleSelectExistingGraphParent = (nodeId: string, result: NexusLocationSearchResult) => {
    const childNode = graphNodes.find((node) => node.id === nodeId) ?? null;
    const hierarchyIssue = childNode
      ? getParentHierarchyIssue({
          childKindId: childNode.kindId,
          parentKindId: getKindIdForSearchResult(result),
        })
      : null;

    if (hierarchyIssue) {
      setGraphNodeErrors({ [nodeId]: hierarchyIssue });
      return;
    }

    setGraphNodes((currentNodes) => {
      const { nodes, anchorId } = upsertExistingGraphAnchor({
        nodes: currentNodes,
        result,
      });

      return nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              parentId: anchorId,
              parentResult: null,
              hasParentSelection: true,
            }
          : node
      );
    });
    setParentPickerNodeId(null);
    clearLevelErrors();
    resetReviewState();
  };

  const handleSelectGraphNodeResult = (nodeId: string, result: NexusLocationSearchResult) => {
    setGraphNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              query: result.name,
              selectedResult: result,
              isNew: false,
              kindId: getKindIdForSearchResult(result),
            }
          : node
      )
    );
    clearLevelErrors();
    resetReviewState();
  };

  const handleSelectExistingChildResult = (nodeId: string, result: NexusLocationSearchResult) => {
    setGraphNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              query: result.name,
              selectedResult: result,
              isNew: false,
              kindId: getKindIdForSearchResult(result),
            }
          : node
      )
    );
    clearLevelErrors();
    resetReviewState();
  };

  const handleLevelQueryChange = (level: LocalityLevel, query: string) => {
    setErrorMessage(null);
    clearLevelErrors();
    setStatusMessage(null);
    resetReviewState();
    setSeededTargetLevel((currentSeededLevel) =>
      level === finalLevel ? level : currentSeededLevel === level ? null : currentSeededLevel
    );
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
        level,
        { preserveLevel: getDownstreamPreserveLevel(level, seededTargetLevel) }
      )
    );
  };

  const handleSelectLevelResult = (
    level: LocalityLevel,
    result: NexusLocationSearchResult
  ) => {
    setSeededTargetLevel((currentSeededLevel) =>
      level === finalLevel ? level : currentSeededLevel === level ? null : currentSeededLevel
    );

    setErrorMessage(null);
    clearLevelErrors();
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
        level,
        { preserveLevel: getDownstreamPreserveLevel(level, seededTargetLevel) }
      )
    );
  };

  const handleSubmitLevel = (level: LocalityLevel) => {
    const entry = levelEntries[level];
    const trimmedQuery = entry.query.trim();

    if (!entry.selectedResult && !entry.isNew) {
      if (trimmedQuery.length < 2) {
        setLevelErrors({
          [level]: 'Enter at least two characters before accepting this locality.',
        });
        return;
      }

      const nextEntries = clearDownstreamEntries(
        {
          ...levelEntries,
          [level]: {
            ...entry,
            query: trimmedQuery,
            selectedResult: null,
            isNew: true,
          },
        },
        level,
        { preserveLevel: getDownstreamPreserveLevel(level, seededTargetLevel) }
      );

      setLevelEntries(nextEntries);
      setSeededTargetLevel((currentSeededLevel) =>
        level === finalLevel ? level : currentSeededLevel === level ? null : currentSeededLevel
      );
      clearLevelErrors();
      resetReviewState();

      if (level === finalLevel) {
        void runLocalityPreview({ createAnyway: false });
        return;
      }
    }

    const submitOrder = [finalLevel, ...visibleLevels.slice(0, -1).reverse()];
    const currentLevelIndex = submitOrder.indexOf(level);
    const nextLevel = submitOrder[currentLevelIndex + 1] ?? null;

    if (nextLevel) {
      setTimeout(() => levelInputRefs.current[nextLevel]?.focus(), 40);
      return;
    }

    void runLocalityPreview({ createAnyway: false });
  };

  const handleSelectKindOption = (option: CreateLocalityKindOption) => {
    if (!typePickerContext) {
      return;
    }

    if (typePickerContext.nodeId) {
      setGraphNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === typePickerContext.nodeId
            ? {
                ...node,
                kindId: option.id,
              }
            : node
        )
      );
      setTypePickerContext(null);
      resetReviewState();
      setActiveWorkflowTab('create');
      return;
    }

    const destinationLevel = option.legacyLevel;

    setLevelKindSelections((currentSelections) => ({
      ...currentSelections,
      [destinationLevel]: option.id,
    }));

    if (typePickerContext.isTarget) {
      const previousTargetLevel = finalLevel;

      if (destinationLevel !== previousTargetLevel) {
        setLevelEntries((currentEntries) => {
          const previousTargetEntry = currentEntries[previousTargetLevel];
          const shouldClearPreviousTarget = seededTargetLevel === previousTargetLevel;

          return {
            ...currentEntries,
            [destinationLevel]: {
              ...currentEntries[destinationLevel],
              query: previousTargetEntry.query,
              selectedResult: null,
              isNew: previousTargetEntry.query.trim().length >= 2,
            },
            ...(shouldClearPreviousTarget
              ? {
                  [previousTargetLevel]: createLevelEntry(),
                }
              : {}),
          };
        });
      }

      setIncludedParentLevels((currentLevels) =>
        sortLocalityLevels(
          currentLevels.filter(
            (level) =>
              level !== destinationLevel &&
              LOCALITY_LEVELS.indexOf(level) < LOCALITY_LEVELS.indexOf(destinationLevel)
          )
        )
      );
      setFinalLevel(destinationLevel);
      setSeededTargetLevel(destinationLevel);
    } else if (destinationLevel !== typePickerContext.level) {
      const previousParentLevel = typePickerContext.level;

      setLevelEntries((currentEntries) => {
        const previousParentEntry = currentEntries[previousParentLevel];

        return {
          ...currentEntries,
          [destinationLevel]: {
            ...currentEntries[destinationLevel],
            query: previousParentEntry.query,
            selectedResult: null,
            isNew: previousParentEntry.query.trim().length >= 2,
          },
          [previousParentLevel]: createLevelEntry(),
        };
      });
      setIncludedParentLevels((currentLevels) =>
        sortLocalityLevels(
          currentLevels
            .filter((level) => level !== previousParentLevel && level !== destinationLevel)
            .concat(destinationLevel)
        )
      );
    }

    setTypePickerContext(null);
    resetReviewState();
    setActiveWorkflowTab('create');
  };


  const handleAddConnectedParentScope = () => {
    if (!nextConnectedParentLevel) {
      return;
    }

    setIncludedParentLevels((currentLevels) =>
      sortLocalityLevels([...currentLevels, nextConnectedParentLevel])
    );
    setLevelKindSelections((currentSelections) => ({
      ...currentSelections,
      [nextConnectedParentLevel]:
        currentSelections[nextConnectedParentLevel] ??
        getDefaultKindIdForLevel(nextConnectedParentLevel),
    }));
    setActiveWorkflowTab('create');
    setCreateMode('build');
    resetReviewState();
    setTimeout(() => levelInputRefs.current[nextConnectedParentLevel]?.focus(), 60);
  };

  const handleRemoveConnectedParentScope = (level: LocalityLevel) => {
    setIncludedParentLevels((currentLevels) =>
      currentLevels.filter((currentLevel) => currentLevel !== level)
    );
    setLevelEntries((currentEntries) => ({
      ...currentEntries,
      [level]: createLevelEntry(),
    }));
    clearLevelErrors();
    resetReviewState();
  };

  const handleUseSearchCreateCandidate = (
    candidateOverride?: NexusLocationCreateCandidate | null,
    kindOptionOverride?: CreateLocalityKindOption
  ) => {
    const candidate = candidateOverride ?? effectiveSearchCreateCandidate;

    if (!candidate) {
      return;
    }

    const nextKindId = kindOptionOverride?.id ?? selectedCreateKindId;
    const nextFinalLevel = kindOptionOverride?.legacyLevel ?? normalizeCandidateLevel(candidate.level);
    const nextEntries = createLevelEntries();
    const nextGraphNode = createLocalityGraphNode({
      query: candidate.query.trim(),
      kindId: nextKindId,
    });

    nextEntries[nextFinalLevel] = {
      query: candidate.query.trim(),
      selectedResult: null,
      isNew: true,
    };

    setErrorMessage(null);
    setStatusMessage(null);
    resetReviewState();
    setAppliedSearchCandidateKey(getCreateCandidateKey(candidate));
    setCreateKindCandidate(null);
    setApplyAsHomeLocality(true);
    setSeededTargetLevel(nextFinalLevel);
    setFinalLevel(nextFinalLevel);
    setIncludedParentLevels([]);
    setLevelKindSelections((currentSelections) => ({
      ...currentSelections,
      [nextFinalLevel]: nextKindId,
    }));
    setGraphNodes([nextGraphNode]);
    setTargetGraphNodeId(nextGraphNode.id);
    setGraphNodeErrors({});
    setParentPickerNodeId(null);
    setActiveWorkflowTab('create');
    setCreateMode('build');
    setLevelEntries(nextEntries);
    scrollToBuilder();
  };

  const openLocalityDashboard = (locality: NexusLocationSearchResult) => {
    setActiveScopeId(toRouteScopeId(locality.scope_id));
    router.replace('/nexus/dashboard' as Href);
  };

  const returnWithLocality = (locality: NexusLocationSearchResult) => {
    router.replace(appendReturnParams(returnTo, locality, returnScopeId));
  };

  const applyHomeLocalitySelection = async (
    locality: NexusLocationSearchResult,
    options: { created?: boolean } = {}
  ) => {
    await runFortressMutation({
      intent: {
        kind: 'relation.residence.add',
        residence_scope_packet_id: locality.scope_id,
      },
    });
    await refreshShellData();
    setActiveScopeId(toRouteScopeId(locality.scope_id));
    setSelectedExistingResult(null);
    setSuccessModal({
      title: options.created ? 'Locality created' : 'Home locality updated',
      message: options.created
        ? `${locality.name} has been created and set as your home locality.`
        : `${locality.name} is now your home locality.`,
      locality,
      showDashboardAction: true,
    });
  };

  const handleSetHomeLocality = async (locality: NexusLocationSearchResult) => {
    setErrorMessage(null);
    setStatusMessage(null);

    const guardedApplyHomeLocalitySelection = async () => {
      try {
        await loading.runWithLoading(
          LOCALITY_SET_HOME_LOADING_SCOPE,
          () => applyHomeLocalitySelection(locality),
          { label: 'Setting home locality...' }
        );
      } catch (error) {
        if (openNexusAuthGateForError(error, guardedApplyHomeLocalitySelection)) {
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
      guardedApplyHomeLocalitySelection
    );
  };

  const handleTogglePreviewHomeScope = (scopeKey: string) => {
    const nextKey = homeLocalityScopeKey === scopeKey ? null : scopeKey;

    setHomeLocalityScopeKey(nextKey);
    setApplyAsHomeLocality(Boolean(nextKey));

    if (nextKey) {
      const homeTreeKeys = getLocalityPreviewAncestorKeys(previewScopeRows, nextKey);

      setScopeTreeSelection((currentSelection) => {
        const nextSelection = { ...currentSelection };

        homeTreeKeys.forEach((homeTreeKey) => {
          if (nextSelection[homeTreeKey] === undefined) {
            nextSelection[homeTreeKey] = true;
          }
        });

        return nextSelection;
      });
    }
  };

  const handleToggleScopeTreeSelection = (scopeKey: string) => {
    const homeTreeKeys = getLocalityPreviewAncestorKeys(previewScopeRows, homeLocalityScopeKey);
    const isEligibleForMainTree =
      homeTreeKeys.has(scopeKey) ||
      Boolean(associationSelection[scopeKey]) ||
      Boolean(followSelection[scopeKey]);

    if (!isEligibleForMainTree) {
      return;
    }

    setScopeTreeSelection((currentSelection) => ({
      ...currentSelection,
      [scopeKey]: !(currentSelection[scopeKey] ?? true),
    }));
  };

  const handleToggleAssociationSelection = (scopeKey: string) => {
    const nextValue = !associationSelection[scopeKey];

    setAssociationSelection((currentSelection) => ({
      ...currentSelection,
      [scopeKey]: nextValue,
    }));

    if (nextValue) {
      setScopeTreeSelection((currentSelection) => ({
        ...currentSelection,
        [scopeKey]: currentSelection[scopeKey] ?? true,
      }));
    }
  };

  const handleToggleFollowSelection = (scopeKey: string) => {
    const nextValue = !followSelection[scopeKey];

    setFollowSelection((currentSelection) => ({
      ...currentSelection,
      [scopeKey]: nextValue,
    }));

    if (nextValue) {
      setScopeTreeSelection((currentSelection) => ({
        ...currentSelection,
        [scopeKey]: currentSelection[scopeKey] ?? true,
      }));
    }
  };

  const handleUseExistingWarning = async (
    warning: LocalityCreatePreviewDuplicateWarning
  ) => {
    const ancestry = getGraphAncestry({
      nodes: graphNodes,
      targetNodeId: warning.leafNodeId,
    });
    const warningNode = ancestry.find(
      (node) => getGraphNodeKind(node).legacyLevel === warning.level
    );

    if (!warningNode) {
      return;
    }

    const nextNodes = graphNodes.map((node) =>
      node.id === warningNode.id
        ? {
            ...node,
            query: warning.existing_result.name,
            selectedResult: warning.existing_result,
            isNew: false,
          }
        : node
    );

    setErrorMessage(null);
    setStatusMessage(null);
    resetReviewState();
    setGraphNodes(nextNodes);
    await runLocalityPreview({
      nodes: nextNodes,
      createAnyway: false,
    });
  };

  const handleEditWarning = (warning: LocalityCreatePreviewDuplicateWarning) => {
    const ancestry = getGraphAncestry({
      nodes: graphNodes,
      targetNodeId: warning.leafNodeId,
    });
    const warningNode = ancestry.find(
      (node) => getGraphNodeKind(node).legacyLevel === warning.level
    );

    if (!warningNode) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    resetReviewState();
    setGraphNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === warningNode.id
          ? {
              ...node,
              selectedResult: null,
              isNew: false,
            }
          : node
      )
    );
  };

  const handleCreatePath = async (createAnyway = false) => {
    const fallbackPath = buildPathEntries();
    const paths = reviewPreviews.length > 0
      ? reviewPreviews.map((preview) => preview.path)
      : [fallbackPath];
    const homeTreeKeys = getLocalityPreviewAncestorKeys(
      previewScopeRows,
      homeLocalityScopeKey
    );
    const associatedScopePacketIds = previewScopeRows
      .filter((row) => associationSelection[row.key])
      .map((row) => row.scopeId);
    const followedScopePacketIds = previewScopeRows
      .filter((row) => followSelection[row.key])
      .map((row) => row.scopeId);
    const mainVisibleScopePacketIds = previewScopeRows
      .filter((row) => {
        const isEligibleForMainTree =
          homeTreeKeys.has(row.key) ||
          Boolean(associationSelection[row.key]) ||
          Boolean(followSelection[row.key]);

        return isEligibleForMainTree && (scopeTreeSelection[row.key] ?? true);
      })
      .map((row) => row.scopeId);

    const applyCreatePath = async () => {
      setIsSubmitting(true);
      setErrorMessage(null);
      setStatusMessage(null);

      try {
        await loading.runWithLoading(
          LOCALITY_CREATE_PATH_LOADING_SCOPE,
          async () => {
            const finalizedMutation =
              await runFortressMutation<NexusLocalityGraphApplyPayload>({
                intent: {
                  kind: 'locality.graph.apply',
                  paths,
                  create_anyway: createAnyway,
                  residence_scope_packet_id: selectedHomePreviewRow?.scopeId ?? null,
                  associated_scope_packet_ids: associatedScopePacketIds,
                  followed_scope_packet_ids: followedScopePacketIds,
                  main_visible_scope_packet_ids: mainVisibleScopePacketIds,
                  show_associated_parent_chains: true,
                  show_followed_parent_chains: true,
                },
              });
            const primaryPayload = finalizedMutation.result;
            const primaryResult =
              primaryPayload.final_result ?? primaryPayload.path_results[0]?.final_result ?? null;
            const createdNewPackets = primaryPayload.path_results.some(
              (pathResult) => pathResult.created_packets.length > 0
            );

            if (!primaryResult) {
              throw new Error('No locality path was created.');
            }

            setStatusMessage(null);
            await refreshShellData();

            if (selectedHomePreviewRow) {
              const selectedHomeLocality =
                createLocalityResultFromPreviewRow(selectedHomePreviewRow);
              resetCreateBuilderState();
              setActiveScopeId(toRouteScopeId(selectedHomeLocality.scope_id));
              setSelectedExistingResult(null);
              setSuccessModal({
                title: createdNewPackets ? 'Locality created' : 'Home locality updated',
                message: createdNewPackets
                  ? `${selectedHomeLocality.name} has been created and set as your home locality.`
                  : `${selectedHomeLocality.name} is now your home locality.`,
                locality: selectedHomeLocality,
                showDashboardAction: true,
              });
              return;
            }

            if (hasReturnTarget) {
              returnWithLocality(primaryResult);
              return;
            }

            resetCreateBuilderState();
            setSuccessModal({
              title: createdNewPackets ? 'Locality graph created' : 'Locality graph reused',
              message: createdNewPackets
                ? `${primaryResult.name} and related localities are ready to use.`
                : `${primaryResult.name} already exists and is ready to use.`,
              locality: primaryResult,
              showDashboardAction: true,
            });
          },
          { label: 'Creating locality graph...' }
        );
      } catch (error) {
        if (openNexusAuthGateForError(error, applyCreatePath)) {
          return;
        }

        if (error instanceof NexusApiError && error.status === 409) {
          await runLocalityPreview({ createAnyway: false });
          setWorkflowErrorModal({
            title: 'Possible duplicate found',
            message: getWorkflowErrorMessage(error, 'The locality graph needs another preview before it can be created.'),
          });
        } else {
          setErrorMessage(null);
          setWorkflowErrorModal({
            title: 'Unable to create locality',
            message: getWorkflowErrorMessage(error, 'Unable to create locality graph.'),
          });
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


  const selectedCreateKind =
    CREATE_LOCALITY_KIND_OPTIONS.find((option) => option.id === selectedCreateKindId) ??
    getDefaultKindOption();
  const typePickerOptions = typePickerContext?.nodeId
    ? CREATE_LOCALITY_KIND_OPTIONS
    : typePickerContext
      ? typePickerContext.isTarget
        ? getKindOptionsForLevel(typePickerContext.level, true)
        : CREATE_LOCALITY_KIND_OPTIONS.filter((option) => {
            const optionLevelIndex = LOCALITY_LEVELS.indexOf(option.legacyLevel);
            const finalLevelIndex = LOCALITY_LEVELS.indexOf(finalLevel);
            const isAlreadyUsed =
              option.legacyLevel !== typePickerContext.level &&
              includedParentLevels.includes(option.legacyLevel);

            return optionLevelIndex < finalLevelIndex && !isAlreadyUsed;
          })
      : [];
  const selectedTypePickerOption = typePickerContext
    ? typePickerOptions.find((option) => {
        if (typePickerContext.nodeId) {
          return (
            option.id ===
            (graphNodes.find((node) => node.id === typePickerContext.nodeId)?.kindId ?? null)
          );
        }

        return option.id === levelKindSelections[typePickerContext.level];
      }) ?? typePickerOptions[0] ?? null
    : null;
  const activeTypePickerKindId = typePickerContext?.nodeId
    ? graphNodes.find((node) => node.id === typePickerContext.nodeId)?.kindId ?? null
    : typePickerContext
      ? levelKindSelections[typePickerContext.level]
      : null;
  const getDraftParentDisabledReason = (
    childNode: LocalityGraphNode,
    parentNode: LocalityGraphNode
  ) => {
    const isDescendant = getGraphDescendantIds(graphNodes, childNode.id).has(parentNode.id);
    const hierarchyIssue = getParentHierarchyIssue({
      childKindId: childNode.kindId,
      parentKindId: parentNode.kindId,
    });

    return isDescendant || hierarchyIssue ? 'Beneath selected scope' : null;
  };

  const confirmCreateKindSelection = () => {
    if (!createKindCandidate || !selectedCreateKind) {
      return;
    }

    handleUseSearchCreateCandidate(
      {
        ...createKindCandidate,
        level: selectedCreateKind.legacyLevel,
      },
      selectedCreateKind
    );
  };

  useEffect(() => {
    if (!createKindCandidate && !typePickerContext) {
      return undefined;
    }

    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCreateKindCandidate(null);
        setTypePickerContext(null);
        return;
      }

      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (createKindCandidate) {
        confirmCreateKindSelection();
        return;
      }

      if (selectedTypePickerOption) {
        handleSelectKindOption(selectedTypePickerOption);
      }
    };

    window.addEventListener('keydown', handleModalKeyDown, true);

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', handleModalKeyDown, true);
    }

    return () => {
      window.removeEventListener('keydown', handleModalKeyDown, true);

      if (typeof document !== 'undefined') {
        document.removeEventListener('keydown', handleModalKeyDown, true);
      }
    };
  }, [
    createKindCandidate,
    selectedCreateKindId,
    selectedTypePickerOption,
    typePickerContext,
  ]);

  return (
    <View className="flex-1">
      <ScrollView ref={scrollViewRef} className="flex-1" showsVerticalScrollIndicator={false}>
        <View className={appearance.pageContainerClass}>
          <NexusSectionHeader
            eyebrow="Locality"
            title={shouldSetHome ? 'Home Locality' : 'Find or create a locality'}
            description={
              shouldSetHome
                ? 'Choose the locality OWA should use as your home scope for discovery, posting context, and future civic workflows.'
                : 'Find an existing locality scope or create a manual locality when the place is missing.'
            }
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
            <LocalityIdentityRequiredCard
              onSignIn={() =>
                router.push({
                  pathname: '/nexus/identity/sign-in',
                  params: {
                    return_to: returnToSelf,
                    ...(returnScopeId ? { return_scope_id: returnScopeId } : {}),
                  },
                } as Href)
              }
              onClaimCurrentGuest={() =>
                router.push({
                  pathname: '/nexus/identity/claim',
                  params: {
                    return_to: returnToSelf,
                    ...(returnScopeId ? { return_scope_id: returnScopeId } : {}),
                  },
                } as Href)
              }
            />
          ) : null}

          <View className="gap-0">
            <NexusTabRail
              activeId={activeWorkflowTab}
              maxRows={2}
              nodes={LOCALITY_WORKFLOW_TAB_NODES}
              onSelect={(tabId) => {
                setActiveWorkflowTab(tabId as LocalityWorkflowTab);
                if (tabId === 'create' && !reviewPreview) {
                  setCreateMode('build');
                }
              }}
              truncate="middle"
              wrapMode="wrap"
            />

            {activeWorkflowTab === 'search' ? (
              <LocalityCreateSearchPanel
                appliedSearchCandidateKey={appliedSearchCandidateKey}
                effectiveSearchCreateCandidate={effectiveSearchCreateCandidate}
                hasSearchDropdown={hasSearchDropdown}
                hiddenSearchResultCount={hiddenSearchResultCount}
                isSearching={isSearching}
                loadingScope={LOCALITY_CREATE_SEARCH_LOADING_SCOPE}
                resultLimit={SEARCH_RESULT_LIMIT}
                resultsCount={results.length}
                searchQuery={searchQuery}
                showSearchCreateRow={showSearchCreateRow}
                visibleSearchResults={visibleSearchResults}
                getDefaultKindIdForLevel={getDefaultKindIdForLevel}
                getResultTypeLabel={getSearchResultTypeLabel}
                normalizeCandidateLevel={normalizeCandidateLevel}
                onChangeSearchQuery={(nextValue) => {
                  setSearchQuery(nextValue);
                  setAppliedSearchCandidateKey(null);
                  setErrorMessage(null);
                }}
                onClearLevelErrors={clearLevelErrors}
                onSelectCreateCandidate={setCreateKindCandidate}
                onSelectCreateKindId={setSelectedCreateKindId}
                onSelectExistingResult={setSelectedExistingResult}
                onSubmitSearch={handleTopSearchSubmit}
              />
            ) : null}
          {activeWorkflowTab === 'create' ? (
            <View onLayout={(event) => { builderOffsetYRef.current = event.nativeEvent.layout.y; }}>
              {createMode === 'build' ? (
                <LocalityCreateBuilderPanel
                  canPreviewGraph={canPreviewGraph}
                  graphDisplaySections={graphDisplaySections}
                  graphNodeErrors={graphNodeErrors}
                  graphNodes={graphNodes}
                  hasInvalidGraphHierarchy={hasInvalidGraphHierarchy}
                  inputRefs={graphInputRefs}
                  isGraphReadyForPreview={isGraphReadyForPreview(graphNodes)}
                  isReviewing={isReviewing}
                  isSubmitting={isSubmitting}
                  loadingScope={LOCALITY_CREATE_PREVIEW_LOADING_SCOPE}
                  resultLimit={SEARCH_RESULT_LIMIT}
                  targetGraphNodeId={targetGraphNodeId}
                  getGraphNodeKind={getGraphNodeKind}
                  getGraphNodeName={getGraphNodeName}
                  getGraphNodeParentHierarchyIssue={getGraphNodeParentHierarchyIssue}
                  getResultTypeLabel={getSearchResultTypeLabel}
                  onAddConnectedScope={handleAddConnectedScope}
                  onBackToSearch={() => setActiveWorkflowTab('search')}
                  onClearExistingNode={handleClearExistingGraphNode}
                  onOpenKindPicker={(nodeId) => {
                    const graphNode = graphNodes.find((candidateNode) => candidateNode.id === nodeId);
                    if (!graphNode) {
                      return;
                    }

                    setTypePickerContext({
                      level: getGraphNodeKind(graphNode).legacyLevel,
                      isTarget: graphNode.id === targetGraphNodeId,
                      nodeId,
                    });
                  }}
                  onOpenParentPicker={setParentPickerNodeId}
                  onPreview={() => void runLocalityPreview({ createAnyway: false })}
                  onQueryChange={handleGraphNodeQueryChange}
                  onRemoveNode={handleRemoveGraphNode}
                  onSelectExistingChild={handleSelectExistingChildResult}
                  onSelectResult={handleSelectGraphNodeResult}
                  onSubmitNode={handleSubmitGraphNode}
                />
              ) : null}
              {createMode === 'preview' && reviewPreview ? (
                <LocalityCreatePreviewPanel
                  rows={previewScopeRows}
                  duplicateWarnings={previewDuplicateWarnings}
                  locationDefinitionCount={previewLocationDefinitionCount}
                  relationLinkCount={previewRelationLinkCount}
                  homeScopeKey={homeLocalityScopeKey}
                  scopeTreeSelection={scopeTreeSelection}
                  associationSelection={associationSelection}
                  followSelection={followSelection}
                  hasReturnTarget={hasReturnTarget}
                  isSubmitting={isSubmitting}
                  onToggleHomeScope={handleTogglePreviewHomeScope}
                  onToggleScopeTree={handleToggleScopeTreeSelection}
                  onToggleAssociation={handleToggleAssociationSelection}
                  onToggleFollow={handleToggleFollowSelection}
                  onUseExistingWarning={(warning) => void handleUseExistingWarning(warning)}
                  onEditWarning={handleEditWarning}
                  onBackToEdit={() => setCreateMode('build')}
                  onCreate={(createAnyway) => void handleCreatePath(createAnyway)}
                />
              ) : null}
            </View>
          ) : null}
          </View>
        </View>
      </ScrollView>
      <LocalitySelectedResultDialog
        hasReturnTarget={hasReturnTarget}
        result={selectedExistingResult}
        getResultTypeLabel={getSearchResultTypeLabel}
        onClose={() => setSelectedExistingResult(null)}
        onOpenDashboard={openLocalityDashboard}
        onReturnWithLocality={returnWithLocality}
        onSetHomeLocality={(locality) => void handleSetHomeLocality(locality)}
      />

      <LocalityRemoveConfirmDialog
        state={removeConfirmModal}
        onCancel={() => setRemoveConfirmModal(null)}
        onConfirm={performRemoveGraphNode}
      />

      <LocalityParentPickerDialog
        graphNodes={graphNodes}
        isParentSearching={isParentSearching}
        loadingScope={LOCALITY_CREATE_PARENT_PICKER_LOADING_SCOPE}
        parentPickerNode={parentPickerNode}
        parentSearchInputRef={parentSearchInputRef}
        parentSearchQuery={parentSearchQuery}
        parentSearchResults={parentSearchResults}
        getDraftParentDisabledReason={getDraftParentDisabledReason}
        getGraphNodeKind={getGraphNodeKind}
        getGraphNodeName={getGraphNodeName}
        getResultTypeLabel={getSearchResultTypeLabel}
        onClose={() => setParentPickerNodeId(null)}
        onSearchQueryChange={setParentSearchQuery}
        onSearchSubmit={() => {
          const firstResult = parentSearchResults[0] ?? null;

          if (firstResult && parentPickerNode) {
            handleSelectExistingGraphParent(parentPickerNode.id, firstResult);
          }
        }}
        onSelectDraftParent={handleSelectGraphParent}
        onSelectExistingParent={handleSelectExistingGraphParent}
      />

      <LocalityKindPickerDialog
        activeKindId={activeTypePickerKindId}
        options={typePickerOptions}
        visible={typePickerContext !== null}
        onClose={() => setTypePickerContext(null)}
        onSelectOption={handleSelectKindOption}
      />

      <LocalityCreateKindDialog
        candidate={createKindCandidate}
        options={CREATE_LOCALITY_KIND_OPTIONS}
        selectedKindId={selectedCreateKindId}
        onClose={() => setCreateKindCandidate(null)}
        onConfirm={confirmCreateKindSelection}
        onSelectOption={(candidate, option) => {
          setSelectedCreateKindId(option.id);
          handleUseSearchCreateCandidate(
            {
              ...candidate,
              level: option.legacyLevel,
            },
            option
          );
        }}
      />

      <LocalityOutcomeDialogs
        successModal={successModal}
        workflowErrorModal={workflowErrorModal}
        onCloseSuccess={() => setSuccessModal(null)}
        onCloseWorkflowError={() => setWorkflowErrorModal(null)}
        onOpenDashboard={openLocalityDashboard}
      />
      {authGateModal}
    </View>
  );
}
