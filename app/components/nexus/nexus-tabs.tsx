/**
 * File: nexus-tabs.tsx
 * Description: Provides projection-ready, stackable tab primitives for Nexus workspace surfaces.
 */
import { useState, type ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { NexusBevelEdges } from '@app/components/nexus/nexus-ui';

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
  kind?: NexusTabNodeKind;
  children?: NexusTabNode[];
  defaultChildId?: string;
  endAction?: ReactNode;
};

export type NexusTabPath = string[];

type NexusResolvedTabLevel = {
  nodes: NexusTabNode[];
  activeId: string | null;
  depth: number;
  parentNode?: NexusTabNode;
};

type NexusTabStackProps = {
  tree: NexusTabNode[];
  valuePath: NexusTabPath;
  onChangePath: (path: NexusTabPath) => void;
  className?: string;
  railClassName?: string;
  maxDepth?: number;
  maxRows?: number;
  truncate?: 'middle' | 'end' | 'none';
  wrapMode?: 'scroll' | 'wrap';
};

type NexusTabRailProps = {
  nodes: NexusTabNode[];
  activeId: string | null;
  depth?: number;
  onSelect: (tabId: string) => void;
  className?: string;
  endAction?: ReactNode;
  maxRows?: number;
  truncate?: 'middle' | 'end' | 'none';
  wrapMode?: 'scroll' | 'wrap';
};

type NexusTabButtonProps = {
  node: NexusTabNode;
  active: boolean;
  depth: number;
  onPress: () => void;
  onMeasuredHeight?: (height: number) => void;
  truncate: 'middle' | 'end' | 'none';
};

type NexusTabSizeConfig = {
  minWidth: number;
  inactiveMaxWidth: number;
  activeMaxWidth: number;
  inactiveMaxCharacters: number;
  activeMaxCharacters: number;
};

const NEXUS_TAB_ROW_GAP = 6;
const DEFAULT_NEXUS_TAB_MAX_ROWS = 3;
const DEFAULT_NEXUS_TAB_MAX_ITEMS = 100;

function joinClasses(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

function getFirstEnabledNode(nodes: NexusTabNode[]): NexusTabNode | null {
  return nodes.find((node) => !node.disabled) ?? null;
}

function getPreferredChildNode(parentNode: NexusTabNode): NexusTabNode | null {
  if (!parentNode.children?.length) {
    return null;
  }

  if (parentNode.defaultChildId) {
    const defaultNode = parentNode.children.find(
      (childNode) => childNode.id === parentNode.defaultChildId && !childNode.disabled,
    );

    if (defaultNode) {
      return defaultNode;
    }
  }

  return getFirstEnabledNode(parentNode.children);
}

function completePathFromNode(pathPrefix: NexusTabPath, node: NexusTabNode): NexusTabPath {
  const nextPath = [...pathPrefix];
  let cursor: NexusTabNode | null = node;

  while (cursor) {
    const preferredChild = getPreferredChildNode(cursor);

    if (!preferredChild) {
      break;
    }

    nextPath.push(preferredChild.id);
    cursor = preferredChild;
  }

  return nextPath;
}

export function resolveNexusTabPath(
  tree: NexusTabNode[],
  requestedPath: NexusTabPath,
): NexusTabPath {
  const resolvedPath: NexusTabPath = [];
  let currentNodes = tree;

  while (currentNodes.length > 0) {
    const requestedId = requestedPath[resolvedPath.length];
    const requestedNode = requestedId
      ? currentNodes.find((node) => node.id === requestedId && !node.disabled) ?? null
      : null;
    const selectedNode = requestedNode ?? getFirstEnabledNode(currentNodes);

    if (!selectedNode) {
      break;
    }

    resolvedPath.push(selectedNode.id);
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

  while (currentNodes.length > 0 && (maxDepth === undefined || depth < maxDepth)) {
    const requestedId = requestedPath[depth];
    const selectedNode = requestedId
      ? currentNodes.find((node) => node.id === requestedId && !node.disabled) ?? null
      : getFirstEnabledNode(currentNodes);

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

function resolvePathForSelection(
  tree: NexusTabNode[],
  currentPath: NexusTabPath,
  depth: number,
  selectedId: string,
): NexusTabPath {
  const nextBasePath = [...currentPath.slice(0, depth), selectedId];
  let currentNodes = tree;
  let selectedNode: NexusTabNode | null = null;

  for (let index = 0; index < nextBasePath.length; index += 1) {
    selectedNode = currentNodes.find((node) => node.id === nextBasePath[index]) ?? null;

    if (!selectedNode) {
      return resolveNexusTabPath(tree, nextBasePath);
    }

    currentNodes = selectedNode.children ?? [];
  }

  if (!selectedNode) {
    return resolveNexusTabPath(tree, nextBasePath);
  }

  return completePathFromNode(nextBasePath, selectedNode);
}


function getTabSizeConfig(depth: number, uiDensity: string): NexusTabSizeConfig {
  const depthIndex = Math.min(depth, 3);
  const densityOffset = uiDensity === 'large' ? 16 : 0;

  if (depthIndex === 0) {
    return {
      minWidth: 112 + densityOffset,
      inactiveMaxWidth: 320 + densityOffset,
      activeMaxWidth: 360 + densityOffset,
      inactiveMaxCharacters: 48,
      activeMaxCharacters: 64,
    };
  }

  if (depthIndex === 1) {
    return {
      minWidth: 88 + densityOffset,
      inactiveMaxWidth: 260 + densityOffset,
      activeMaxWidth: 300 + densityOffset,
      inactiveMaxCharacters: 38,
      activeMaxCharacters: 52,
    };
  }

  return {
    minWidth: 76 + densityOffset,
    inactiveMaxWidth: 220 + densityOffset,
    activeMaxWidth: 260 + densityOffset,
    inactiveMaxCharacters: 30,
    activeMaxCharacters: 42,
  };
}

function middleTruncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength || maxLength <= 0) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  const visibleCharacterCount = Math.max(1, maxLength - 3);
  const leadingCount = Math.ceil(visibleCharacterCount / 2);
  const trailingCount = Math.floor(visibleCharacterCount / 2);

  return `${value.slice(0, leadingCount)}...${value.slice(value.length - trailingCount)}`;
}

function getRenderedTabLabel(
  node: NexusTabNode,
  active: boolean,
  truncate: 'middle' | 'end' | 'none',
  sizeConfig: NexusTabSizeConfig,
): string {
  const label = active ? node.label : node.shortLabel ?? node.label;

  if (truncate === 'none') {
    return label;
  }

  const maxCharacters = active
    ? sizeConfig.activeMaxCharacters
    : sizeConfig.inactiveMaxCharacters;

  if (truncate === 'middle') {
    return middleTruncateText(label, maxCharacters);
  }

  return label.length > maxCharacters ? `${label.slice(0, Math.max(1, maxCharacters - 3))}...` : label;
}

function getTabDepthClasses(depth: number, active: boolean, isDark: boolean): string {
  const depthIndex = Math.min(depth, 3);
  const baseSizeClass =
    depthIndex === 0
      ? 'px-3.5 py-2.5'
      : depthIndex === 1
        ? 'px-3 py-2'
        : 'px-2.5 py-1.5';
  const inactiveSurfaceClass = isDark
    ? 'border-nexus-line/60 bg-white/5'
    : 'border-slate-300 bg-slate-100';
  const activeSurfaceClass = isDark
    ? 'border-nexus-sky bg-nexus-panel'
    : 'border-sky-400 bg-white';

  return joinClasses(
    'relative shrink-0 overflow-hidden rounded-t-nexus border shadow-sm',
    baseSizeClass,
    active ? joinClasses(activeSurfaceClass, '-mb-px') : inactiveSurfaceClass,
  );
}
function getTabRailDepthClasses(depth: number, _isDark: boolean): string {
  if (depth === 0) {
    return '';
  }

  if (depth === 1) {
    return '-mt-px pl-2 pt-1.5';
  }

  return '-mt-px pl-4 pt-1.5';
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
  const inactiveTextClass = isDark ? 'text-nexus-text' : 'text-slate-900';
  const mutedTextClass = isDark ? 'text-nexus-muted' : 'text-slate-600';
  const sizeConfig = getTabSizeConfig(depth, uiDensity);
  const label = getRenderedTabLabel(node, active, truncate, sizeConfig);
  const shouldTruncate = truncate !== 'none';
  const ellipsizeMode = truncate === 'middle' ? 'middle' : 'tail';
  const titleSizeClass =
    depth === 0
      ? uiDensity === 'large'
        ? 'text-base'
        : 'text-sm'
      : uiDensity === 'large'
        ? 'text-sm'
        : 'text-xs';
  const maxWidth = active ? sizeConfig.activeMaxWidth : sizeConfig.inactiveMaxWidth;

  const handleLayout = (event: LayoutChangeEvent) => {
    onMeasuredHeight?.(event.nativeEvent.layout.height);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: node.disabled }}
      className={getTabDepthClasses(depth, active, isDark)}
      disabled={node.disabled}
      onLayout={handleLayout}
      onPress={onPress}
      style={{ minWidth: sizeConfig.minWidth, maxWidth }}
    >
      {active ? (
        <View
          pointerEvents="none"
          className={joinClasses(
            'absolute inset-x-0 top-0 h-1',
            isDark ? 'bg-nexus-sky' : 'bg-sky-500',
          )}
        />
      ) : null}
      <View className="min-w-0 flex-row items-center gap-2">
        <Text
          className={joinClasses(
            titleSizeClass,
            'min-w-0 shrink font-semibold',
            active ? activeTextClass : inactiveTextClass,
          )}
          ellipsizeMode={ellipsizeMode}
          numberOfLines={shouldTruncate ? 1 : undefined}
        >
          {label}
        </Text>
        {node.badge !== undefined ? (
          <View
            className={joinClasses(
              'shrink-0 rounded-full border px-2 py-0.5',
              isDark ? 'border-nexus-line/70 bg-nexus-ink/50' : 'border-slate-300 bg-slate-50',
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
      <NexusBevelEdges subtle />
    </Pressable>
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
  const { themeMode } = useNexusShell();
  const isDark = themeMode === 'dark';
  const [contentHeight, setContentHeight] = useState(0);
  const [tabHeight, setTabHeight] = useState(0);
  const shouldWrap = wrapMode === 'wrap';
  const maxRailHeight =
    shouldWrap && tabHeight > 0
      ? tabHeight * maxRows + NEXUS_TAB_ROW_GAP * Math.max(0, maxRows - 1)
      : undefined;
  const shouldConstrainHeight =
    maxRailHeight !== undefined && contentHeight > maxRailHeight + 1;
  const constrainedStyle = shouldConstrainHeight ? { maxHeight: maxRailHeight } : undefined;

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

  const renderedNodes = nodes.slice(0, DEFAULT_NEXUS_TAB_MAX_ITEMS).map((node) => (
    <NexusTabButton
      key={node.id}
      active={node.id === activeId}
      depth={depth}
      node={node}
      onMeasuredHeight={handleTabMeasuredHeight}
      onPress={() => onSelect(node.id)}
      truncate={truncate}
    />
  ));

  if (nodes.length === 0) {
    return null;
  }

  return (
    <View className={joinClasses('min-w-0', getTabRailDepthClasses(depth, isDark), className)}>
      <View className="min-w-0 flex-row items-start gap-2">
        {shouldWrap ? (
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={shouldConstrainHeight}
            className={joinClasses(
              'min-w-0 flex-1 rounded-t-nexus px-1 pt-1',
              isDark ? 'bg-nexus-ink/20' : 'bg-slate-100/70',
            )}
            style={constrainedStyle}
            contentContainerStyle={{ paddingRight: 8, paddingBottom: shouldConstrainHeight ? 6 : 0 }}
          >
            <View
              className="min-w-0 flex-row flex-wrap items-end gap-x-1.5"
              onLayout={handleContentLayout}
              style={{ rowGap: NEXUS_TAB_ROW_GAP, width: '100%' }}
            >
              {renderedNodes}
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="min-w-0 flex-1"
            contentContainerStyle={{ paddingRight: 8 }}
          >
            <View className="flex-row items-end gap-1.5">{renderedNodes}</View>
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
  const resolvedPath = resolveNexusTabPath(tree, valuePath);
  const levels = resolveNexusTabLevels(tree, resolvedPath, maxDepth);

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
            onChangePath(resolvePathForSelection(tree, resolvedPath, level.depth, tabId));
          }}
          truncate={truncate}
          wrapMode={wrapMode}
        />
      ))}
    </View>
  );
}
