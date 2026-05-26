import type { MutableRefObject } from 'react';
import type { TextInput } from 'react-native';

import type {
  NexusLocationCreateCandidate,
  NexusLocationSearchResult,
} from '@runtime/nexus/location-search';
import type { LocalityCreateGraphRowNode } from './locality-create-graph-row';

export type LocalityLevel = 'nation' | 'region' | 'city' | 'district';

export type LocalityWorkflowTab = 'search' | 'create';

export type CreateLocalityKindOption = {
  id: string;
  label: string;
  description: string;
  legacyLevel: LocalityLevel;
  scaleRank: number | null;
};

export type LocalityGraphNode = LocalityCreateGraphRowNode;

export type LocalityGraphDisplayRow = {
  node: LocalityGraphNode;
  depth: number;
};

export type LocalityGraphDisplaySection = {
  id: 'connected' | 'unconnected';
  rows: LocalityGraphDisplayRow[];
};

export type LocalitySuccessModalState = {
  title: string;
  message: string;
  locality: NexusLocationSearchResult;
  showDashboardAction: boolean;
} | null;

export type LocalityMessageModalState = {
  title: string;
  message: string;
} | null;

export type LocalityRemoveConfirmModalState = {
  nodeId: string;
  nodeName: string;
  childCount: number;
} | null;

export type LocalitySearchPanelProps = {
  appliedSearchCandidateKey: string | null;
  effectiveSearchCreateCandidate: NexusLocationCreateCandidate | null;
  errorMessage?: string | null;
  hasSearchDropdown: boolean;
  hiddenSearchResultCount: number;
  isSearching: boolean;
  loadingScope: string;
  resultLimit: number;
  resultsCount: number;
  searchQuery: string;
  showSearchCreateRow: boolean;
  visibleSearchResults: NexusLocationSearchResult[];
  getDefaultKindIdForLevel: (level: LocalityLevel) => string;
  getResultTypeLabel: (result: NexusLocationSearchResult) => string;
  normalizeCandidateLevel: (
    level: NexusLocationCreateCandidate['level'] | null | undefined
  ) => LocalityLevel;
  onChangeSearchQuery: (query: string) => void;
  onClearGraphNodeErrors: () => void;
  onSelectCreateKindId: (kindId: string) => void;
  onSelectCreateCandidate: (candidate: NexusLocationCreateCandidate) => void;
  onSelectExistingResult: (result: NexusLocationSearchResult) => void;
  onSubmitSearch: () => void;
};

export type LocalityCreateBuilderPanelProps = {
  canPreviewGraph: boolean;
  graphDisplaySections: LocalityGraphDisplaySection[];
  graphNodeErrors: Partial<Record<string, string>>;
  graphNodes: LocalityGraphNode[];
  hasInvalidGraphHierarchy: boolean;
  inputRefs: MutableRefObject<Record<string, TextInput | null>>;
  isGraphReadyForPreview: boolean;
  isReviewing: boolean;
  isSubmitting: boolean;
  loadingScope: string;
  resultLimit: number;
  targetGraphNodeId: string;
  getGraphNodeKind: (node: LocalityGraphNode) => CreateLocalityKindOption;
  getGraphNodeName: (node: LocalityGraphNode) => string;
  getGraphNodeParentHierarchyIssue: (
    nodes: LocalityGraphNode[],
    node: LocalityGraphNode
  ) => string | null;
  getResultTypeLabel: (result: NexusLocationSearchResult) => string;
  onAddConnectedScope: () => void;
  onBackToSearch: () => void;
  onClearExistingNode: (nodeId: string) => void;
  onOpenKindPicker: (nodeId: string) => void;
  onOpenParentPicker: (nodeId: string) => void;
  onPreview: () => void;
  onQueryChange: (nodeId: string, query: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onSelectExistingChild: (
    nodeId: string,
    result: NexusLocationSearchResult
  ) => void;
  onSelectResult: (nodeId: string, result: NexusLocationSearchResult) => void;
  onSubmitNode: (nodeId: string) => void;
};
