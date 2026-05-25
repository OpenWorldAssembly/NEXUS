/**
 * File: nexus-tabs.tsx
 * Description: Provides projection-ready, stackable tab primitives for Nexus workspace surfaces.
 */
import { useMemo, useState, type ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { ScrollView, Text, View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  getNexusTabSizeConfig,
  getRenderedNexusTabLabel,
  NexusTabFrame,
  NexusTabLabel,
  type NexusTabSizeConfig,
  type NexusTabTruncateMode,
} from './nexus-tab-primitives';

/**
 * Tab model notes:
 * - NexusTabStack renders a tree as a selected path, one rail per selected branch.
 * - The component is projection UI only. It should not infer packet policy, permissions, or action availability.
 * - Use it for navigational/projection tabs. Keep closable document tabs and compact setting toggles separate.
 */
export type NexusTabNodeKind =
  | 'view'
  | 'filter'
  | 'sort'
  | 'mode'
  | 'action'
  | 'compose';

export type NexusTabNode = {
  id: string;
  label: string;
  shortLabel?: string;
  badge?: string | number;
  disabled?: boolean;
  /** Semantic hint only; action availability should still come from the projection/action layer. */
  kind?: NexusTabNodeKind;
  children?: NexusTabNode[];
  defaultChildId?: string;
  /** Optional visual sidecar for the next child rail; keep action semantics outside the renderer. */
  endAction?: ReactNode;
};

export type NexusTabPath = string[];

type NexusResolvedTabLevel = {
  nodes: NexusTabNode[];
  activeId: string | null;
  depth: number;
  parentNode?: NexusTabNode;
};

export type NexusTabStackProps = {
  tree: NexusTabNode[];
  valuePath: NexusTabPath;
  onChangePath: (path: NexusTabPath) => void;
  className?: string;
  railClassName?: string;
  maxDepth?: number;
  maxRows?: number;
  truncate?: NexusTabTruncateMode;
  wrapMode?: 'scroll' | 'wrap';
};

export type NexusTabRailProps = {
  nodes: NexusTabNode[];
  activeId: string | null;
  depth?: number;
  onSelect: (tabId: string) => void;
  className?: string;
  endAction?: ReactNode;
  maxRows?: number;
  truncate?: NexusTabTruncateMode;
  wrapMode?: 'scroll' | 'wrap';
};

type NexusTabButtonProps = {
  node: NexusTabNode;
  active: boolean;
  depth: number;
  onPress: () => void;
  onMeasuredHeight?: (height: number) => void;
  truncate: NexusTabTruncateMode;
};

const NEXUS_TAB_ROW_OVERLAP = 2;
const NEXUS_TAB_ROW_OFFSET = 12;
const NEXUS_TAB_GAP_WIDTH = 6;
const DEFAULT_NEXUS_TAB_MAX_ROWS = 3;
const DEFAULT_NEXUS_TAB_MAX_ITEMS = 100;

function joinClasses(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

function getFirstEnabledNode(nodes: NexusTabNode[]): NexusTabNode | null {
  return nodes.find((node) => !node.disabled) ?? null;
}

function getEnabledNodeById(
  nodes: NexusTabNode[],
  nodeId: string | undefined,
): NexusTabNode | null {
  if (!nodeId) {
    return null;
  }

  return nodes.find((node) => node.id === nodeId && !node.disabled) ?? null;
}

function getPreferredChildNode(parentNode: NexusTabNode): NexusTabNode | null {
  if (!parentNode.children?.length) {
    return null;
  }

  if (parentNode.defaultChildId) {
    const defaultNode = getEnabledNodeById(
      parentNode.children,
      parentNode.defaultChildId,
    );

    if (defaultNode) {
      return defaultNode;
    }
  }

  return getFirstEnabledNode(parentNode.children);
}

function completePathFromNode(
  pathPrefix: NexusTabPath,
  node: NexusTabNode,
  preservedDescendants: NexusTabPath = [],
): NexusTabPath {
  const nextPath = [...pathPrefix];
  let cursor: NexusTabNode | null = node;
  let descendantIndex = 0;

  while (cursor) {
    const children = cursor.children ?? [];

    if (children.length === 0) {
      break;
    }

    const preservedChild = getEnabledNodeById(
      children,
      preservedDescendants[descendantIndex],
    );
    const preferredChild: NexusTabNode | null =
      preservedChild ?? getPreferredChildNode(cursor);

    if (!preferredChild) {
      break;
    }

    nextPath.push(preferredChild.id);
    cursor = preferredChild;
    descendantIndex += 1;
  }

  return nextPath;
}

/**
 * Resolves a requested selected path against the available tree.
 * Invalid or disabled path segments are replaced by each parent's default child,
 * then by the first enabled child.
 */
export function resolveNexusTabPath(
  tree: NexusTabNode[],
  requestedPath: NexusTabPath,
): NexusTabPath {
  const resolvedPath: NexusTabPath = [];
  let currentNodes = tree;
  let parentNode: NexusTabNode | null = null;

  while (currentNodes.length > 0) {
    const requestedId = requestedPath[resolvedPath.length];
    const requestedNode = getEnabledNodeById(currentNodes, requestedId);
    const selectedNode: NexusTabNode | null =
      requestedNode ??
      (parentNode
        ? getPreferredChildNode(parentNode)
        : getFirstEnabledNode(currentNodes));

    if (!selectedNode) {
      break;
    }

    resolvedPath.push(selectedNode.id);
    parentNode = selectedNode;
    currentNodes = selectedNode.children ?? [];
  }

  return resolvedPath;
}

function resolveNexusTabLevels(
  tree: NexusTabNode[],
  requestedPath: NexusTabPath,
  maxDepth?: number,
): NexusResolvedTabLevel[] {
  const levels: NexusResolvedTabLevel[] = [];
  let currentNodes = tree;
  let parentNode: NexusTabNode | undefined;
  let depth = 0;

  while (
    currentNodes.length > 0 &&
    (maxDepth === undefined || depth < maxDepth)
  ) {
    const requestedId = requestedPath[depth];
    const selectedNode =
      getEnabledNodeById(currentNodes, requestedId) ??
      getFirstEnabledNode(currentNodes);

    levels.push({
      nodes: currentNodes,
      activeId: selectedNode?.id ?? null,
      depth,
      parentNode,
    });

    if (!selectedNode) {
      break;
    }

    parentNode = selectedNode;
    currentNodes = selectedNode.children ?? [];
    depth += 1;
  }

  return levels;
}

/**
 * Resolves a new path after selecting a tab at a specific depth.
 * Descendants from the previous path are preserved when the new branch supports them.
 */
export function resolveNexusTabSelectionPath(
  tree: NexusTabNode[],
  currentPath: NexusTabPath,
  depth: number,
  selectedId: string,
): NexusTabPath {
  const nextBasePath = [...currentPath.slice(0, depth), selectedId];
  const preservedDescendants = currentPath.slice(depth + 1);
  let currentNodes = tree;
  let selectedNode: NexusTabNode | null = null;

  for (let index = 0; index < nextBasePath.length; index += 1) {
    selectedNode = getEnabledNodeById(currentNodes, nextBasePath[index]);

    if (!selectedNode) {
      return resolveNexusTabPath(tree, nextBasePath);
    }

    currentNodes = selectedNode.children ?? [];
  }

  if (!selectedNode) {
    return resolveNexusTabPath(tree, nextBasePath);
  }

  return completePathFromNode(
    nextBasePath,
    selectedNode,
    preservedDescendants,
  );
}

function getRenderedTabLabel(
  node: NexusTabNode,
  active: boolean,
  truncate: NexusTabTruncateMode,
  sizeConfig: NexusTabSizeConfig,
): string {
  return getRenderedNexusTabLabel({
    label: active ? node.label : (node.shortLabel ?? node.label),
    active,
    truncate,
    sizeConfig,
  });
}

function getTabRailDepthClasses(depth: number, isDark: boolean): string {
  if (depth === 0) {
    return '';
  }

  return joinClasses(
    'mt-1 pt-2',
    depth > 0 ? 'border-t' : '',
    isDark ? 'border-nexus-line/45' : 'border-slate-300',
  );
}

type PackedNexusTabRow = {
  id: string;
  nodes: NexusTabNode[];
  estimatedWidth: number;
  offset: number;
};

function estimateTabWidth(
  node: NexusTabNode,
  active: boolean,
  depth: number,
  uiDensity: string,
  truncate: NexusTabTruncateMode,
): number {
  const sizeConfig = getNexusTabSizeConfig(depth, uiDensity);
  const label = getRenderedTabLabel(node, active, truncate, sizeConfig);
  const depthIndex = Math.min(depth, 3);
  const characterWidth =
    uiDensity === 'large' ? 7.8 : depthIndex === 0 ? 6.8 : 6.2;
  const horizontalPadding = depthIndex === 0 ? 28 : depthIndex === 1 ? 24 : 20;
  const badgeWidth =
    node.badge !== undefined ? 34 + String(node.badge).length * 5 : 0;
  const estimatedWidth =
    label.length * characterWidth + horizontalPadding + badgeWidth;
  const maxWidth = active
    ? sizeConfig.activeMaxWidth
    : sizeConfig.inactiveMaxWidth;

  return Math.max(sizeConfig.minWidth, Math.min(maxWidth, estimatedWidth));
}

function getRowOffset(rowIndex: number): number {
  return rowIndex % 2 === 1 ? NEXUS_TAB_ROW_OFFSET : 0;
}

function packNexusTabRows(
  nodes: NexusTabNode[],
  activeId: string | null,
  depth: number,
  uiDensity: string,
  truncate: NexusTabTruncateMode,
  railWidth: number,
): PackedNexusTabRow[] {
  const widthBudget = railWidth > 0 ? railWidth : 9999;
  const rows: PackedNexusTabRow[] = [];

  nodes.slice(0, DEFAULT_NEXUS_TAB_MAX_ITEMS).forEach((node) => {
    const nextRowIndex = Math.max(0, rows.length - 1);
    const currentRow = rows[rows.length - 1];
    const active = node.id === activeId;
    const estimatedWidth = estimateTabWidth(
      node,
      active,
      depth,
      uiDensity,
      truncate,
    );
    const currentOffset = currentRow?.offset ?? getRowOffset(nextRowIndex);
    const currentBudget = Math.max(96, widthBudget - currentOffset - 2);
    const projectedWidth = currentRow
      ? currentRow.estimatedWidth + NEXUS_TAB_GAP_WIDTH + estimatedWidth
      : estimatedWidth;

    if (
      currentRow &&
      currentRow.nodes.length > 0 &&
      projectedWidth > currentBudget
    ) {
      const rowIndex = rows.length;
      rows.push({
        id: `row-${rowIndex}-${node.id}`,
        nodes: [node],
        estimatedWidth,
        offset: getRowOffset(rowIndex),
      });
      return;
    }

    if (currentRow) {
      currentRow.nodes.push(node);
      currentRow.estimatedWidth = projectedWidth;
      return;
    }

    rows.push({
      id: `row-0-${node.id}`,
      nodes: [node],
      estimatedWidth,
      offset: getRowOffset(0),
    });
  });

  return rows;
}

export function NexusTabButton({
  node,
  active,
  depth,
  onPress,
  onMeasuredHeight,
  truncate,
}: NexusTabButtonProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const isDark = themeMode === 'dark';
  const activeTextClass = isDark ? 'text-nexus-sky' : 'text-sky-700';
  const mutedTextClass = isDark ? 'text-nexus-muted' : 'text-slate-600';
  const sizeConfig = getNexusTabSizeConfig(depth, uiDensity);
  const maxWidth = active
    ? sizeConfig.activeMaxWidth
    : sizeConfig.inactiveMaxWidth;

  const handleLayout = (event: LayoutChangeEvent) => {
    onMeasuredHeight?.(event.nativeEvent.layout.height);
  };

  return (
    <NexusTabFrame
      active={active}
      depth={depth}
      disabled={node.disabled}
      maxWidth={maxWidth}
      minWidth={sizeConfig.minWidth}
      onLayout={handleLayout}
      onPress={onPress}
    >
      <View className="min-w-0 flex-row items-center gap-2">
        <NexusTabLabel
          active={active}
          depth={depth}
          label={active ? node.label : (node.shortLabel ?? node.label)}
          sizeConfig={sizeConfig}
          truncate={truncate}
        />
        {node.badge !== undefined ? (
          <View
            className={joinClasses(
              'shrink-0 rounded-full border px-2 py-0.5',
              isDark
                ? 'border-nexus-line/70 bg-nexus-ink/50'
                : 'border-slate-300 bg-slate-50',
            )}
          >
            <Text
              className={joinClasses(
                'text-[10px] font-bold uppercase tracking-[1.5px]',
                active ? activeTextClass : mutedTextClass,
              )}
            >
              {node.badge}
            </Text>
          </View>
        ) : null}
      </View>
    </NexusTabFrame>
  );
}
export function NexusTabRail({
  nodes,
  activeId,
  depth = 0,
  onSelect,
  className,
  endAction,
  maxRows = DEFAULT_NEXUS_TAB_MAX_ROWS,
  truncate = 'middle',
  wrapMode = 'wrap',
}: NexusTabRailProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const isDark = themeMode === 'dark';
  const [contentHeight, setContentHeight] = useState(0);
  const [tabHeight, setTabHeight] = useState(0);
  const [railWidth, setRailWidth] = useState(0);
  const shouldWrap = wrapMode === 'wrap';
  const normalizedMaxRows = Math.max(1, maxRows);
  const maxRailHeight =
    shouldWrap && tabHeight > 0
      ? tabHeight * normalizedMaxRows -
        NEXUS_TAB_ROW_OVERLAP * Math.max(0, normalizedMaxRows - 1) +
        2
      : undefined;
  const shouldConstrainHeight =
    maxRailHeight !== undefined && contentHeight > maxRailHeight + 1;
  const constrainedStyle = shouldConstrainHeight
    ? { maxHeight: maxRailHeight }
    : undefined;

  const visibleNodes = useMemo(
    () => nodes.slice(0, DEFAULT_NEXUS_TAB_MAX_ITEMS),
    [nodes],
  );
  const packedRows = useMemo(
    () =>
      packNexusTabRows(
        visibleNodes,
        activeId,
        depth,
        uiDensity,
        truncate,
        railWidth,
      ),
    [visibleNodes, activeId, depth, uiDensity, truncate, railWidth],
  );

  const handleRailLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;

    if (Math.abs(nextWidth - railWidth) > 0.5) {
      setRailWidth(nextWidth);
    }
  };
  const handleContentLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;

    if (Math.abs(nextHeight - contentHeight) > 0.5) {
      setContentHeight(nextHeight);
    }
  };
  const handleTabMeasuredHeight = (height: number) => {
    if (height > 0 && Math.abs(height - tabHeight) > 0.5) {
      setTabHeight(height);
    }
  };

  const renderTabButton = (node: NexusTabNode) => (
    <NexusTabButton
      key={node.id}
      active={node.id === activeId}
      depth={depth}
      node={node}
      onMeasuredHeight={handleTabMeasuredHeight}
      onPress={() => onSelect(node.id)}
      truncate={truncate}
    />
  );

  if (nodes.length === 0) {
    return null;
  }

  return (
    <View
      className={joinClasses(
        'min-w-0',
        getTabRailDepthClasses(depth, isDark),
        className,
      )}
    >
      <View className="min-w-0 flex-row items-start gap-2">
        {shouldWrap ? (
          <View className="min-w-0 w-full flex-1" onLayout={handleRailLayout}>
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={shouldConstrainHeight}
              className={joinClasses(
                'min-w-0 w-full rounded-t-nexus border-l border-b border-t px-1.5 pb-1 pt-1.5',
                isDark
                  ? 'border-nexus-line/55 bg-nexus-ink/20'
                  : 'border-slate-300 bg-slate-100/70',
              )}
              style={constrainedStyle}
              contentContainerStyle={{
                paddingRight: 8,
                paddingBottom: shouldConstrainHeight ? 6 : 0,
              }}
            >
              <View className="min-w-0 w-full" onLayout={handleContentLayout}>
                {packedRows.map((row, rowIndex) => {
                  const rowHasActiveTab = row.nodes.some(
                    (node) => node.id === activeId,
                  );

                  return (
                    <View
                      key={row.id}
                      className={joinClasses(
                        'relative min-w-0 flex-row items-end gap-1.5 rounded-t-nexus',
                        rowHasActiveTab
                          ? isDark
                            ? 'border-b border-nexus-sky/35 bg-nexus-sky/5'
                            : 'border-b border-sky-300/70 bg-sky-50/80'
                          : false,
                      )}
                      style={{
                        marginLeft: row.offset,
                        marginTop:
                          rowIndex === 0 ? 0 : -NEXUS_TAB_ROW_OVERLAP,
                        maxWidth:
                          railWidth > 0
                            ? Math.max(96, railWidth - row.offset - 2)
                            : undefined,
                      }}
                    >
                      {rowHasActiveTab ? (
                        <View
                          pointerEvents="none"
                          className={joinClasses(
                            'absolute bottom-0 left-0 top-1 w-0.5 rounded-full',
                            isDark ? 'bg-nexus-sky/70' : 'bg-sky-500/70',
                          )}
                        />
                      ) : null}
                      {row.nodes.map(renderTabButton)}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="min-w-0 w-full flex-1"
            contentContainerStyle={{ paddingRight: 8 }}
          >
            <View className="flex-row items-end gap-1.5">
              {visibleNodes.map(renderTabButton)}
            </View>
          </ScrollView>
        )}
        {endAction ? <View className="shrink-0 pb-1">{endAction}</View> : null}
      </View>
    </View>
  );
}
export function NexusTabStack({
  tree,
  valuePath,
  onChangePath,
  className,
  railClassName,
  maxDepth,
  maxRows = DEFAULT_NEXUS_TAB_MAX_ROWS,
  truncate = 'middle',
  wrapMode = 'wrap',
}: NexusTabStackProps) {
  const resolvedPath = useMemo(
    () => resolveNexusTabPath(tree, valuePath),
    [tree, valuePath],
  );
  const levels = useMemo(
    () => resolveNexusTabLevels(tree, resolvedPath, maxDepth),
    [tree, resolvedPath, maxDepth],
  );

  return (
    <View className={joinClasses('min-w-0 gap-0', className)}>
      {levels.map((level) => (
        <NexusTabRail
          key={`${level.depth}:${level.nodes.map((node) => node.id).join('|')}`}
          activeId={level.activeId}
          className={railClassName}
          depth={level.depth}
          endAction={level.parentNode?.endAction}
          maxRows={maxRows}
          nodes={level.nodes}
          onSelect={(tabId) => {
            onChangePath(
              resolveNexusTabSelectionPath(
                tree,
                resolvedPath,
                level.depth,
                tabId,
              ),
            );
          }}
          truncate={truncate}
          wrapMode={wrapMode}
        />
      ))}
    </View>
  );
}
