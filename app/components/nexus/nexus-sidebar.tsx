/**
 * File: nexus-sidebar.tsx
 * Description: Renders the left-side nexus rails with collapsible primary and secondary navigation panels.
 */
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import { NexusBadge, NexusCard, NexusSegmentedPill } from '@app/components/nexus/nexus-ui';
import type { NexusSecurityMode } from '@runtime/nexus/nexus-api-types';
import {
  NEXUS_COMING_SOON_SURFACES,
} from '@runtime/nexus/nexus-content';
import {
  NEXUS_SECTION_LABELS,
  NEXUS_SECTION_ORDER,
  buildNexusBranchNodes,
  getNexusRailWidth,
  getNexusAncestorIds,
  NEXUS_COLLAPSED_RAIL_WIDTH,
  type NexusScopeBranchNode,
  type NexusScopeSummary,
  type NexusSection,
  type NexusThemeMode,
  type NexusUiDensity,
} from '@runtime/nexus/nexus-shell';

type NexusSidebarProps = {
  isDesktop: boolean;
  onRequestClose: () => void;
};

type NexusPrimaryNavItemProps = {
  title: string;
  detail: string;
  isActive: boolean;
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
  onPress: () => void;
};

type NexusRailToggleProps = {
  direction: '<' | '>';
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
  onPress: () => void;
};

type NexusCurrentContextCardProps = {
  scope: NexusScopeSummary;
  scopePath: string;
  activeSection: NexusSection;
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
};

type NexusScopeSnapshotMetric = {
  label: string;
  value: string;
};

type NexusScopeMenuRowProps = {
  depth: number;
  isActive: boolean;
  isLineage: boolean;
  scopeMeta: string;
  scopeName: string;
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
  onPress: () => void;
};

type NexusFunctionMenuContentProps = {
  activeScope: NexusScopeSummary;
  activeSection: NexusSection;
  showScopedLabel: boolean;
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
  onSectionPress: (section: NexusSection) => void;
};

type NexusScopeMenuContentProps = {
  activeScopeId: string;
  followedScopes: NexusScopeSummary[];
  scopeMenuNodes: NexusScopeBranchNode[];
  scopeSummaries: NexusScopeSummary[];
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
  onScopePress: (scopeId: string) => void;
};

type NexusPreferenceSwitchProps<TOption extends string> = {
  label: string;
  leftLabel: string;
  leftValue: TOption;
  rightLabel: string;
  rightValue: TOption;
  selectedValue: TOption;
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
  onSelect: (value: TOption) => void;
};

/**
 * Inputs: any number of class names.
 * Output: a single space-delimited class name string.
 */
function joinClasses(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Inputs: the active shell theme and density.
 * Output: a compact anonymous guest avatar for the nexus profile rail.
 */
function NexusGuestAvatar({
  themeMode,
  uiDensity,
}: {
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
}) {
  return (
    <View
      className={joinClasses(
        'items-center justify-center rounded-full border',
        uiDensity === 'large' ? 'h-16 w-16' : 'h-14 w-14',
        themeMode === 'dark'
          ? 'border-nexus-line bg-white/5'
          : 'border-slate-300 bg-slate-100',
      )}
    >
      <Text
        className={joinClasses(
          uiDensity === 'large'
            ? 'text-xl font-bold uppercase'
            : 'text-lg font-bold uppercase',
          themeMode === 'dark' ? 'text-nexus-sky' : 'text-sky-600',
        )}
      >
        AG
      </Text>
    </View>
  );
}

/**
 * Inputs: whether the chevron points upward, plus theme and density.
 * Output: a small chevron icon for collapsible guest-header controls.
 */
function NexusChevronIcon({
  isOpen,
  themeMode,
  uiDensity,
}: {
  isOpen: boolean;
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
}) {
  const lineClass =
    themeMode === 'dark' ? 'bg-nexus-text' : 'bg-slate-900';
  const sizeClass = uiDensity === 'large' ? 'w-2.5' : 'w-2';

  return (
    <View
      className={joinClasses(
        'h-4 w-4 items-center justify-center',
        isOpen ? 'rotate-180' : '',
      )}
    >
      <View className="flex-row items-center justify-center gap-[1px]">
        <View className={joinClasses(sizeClass, 'h-[2px] rotate-45 rounded-full', lineClass)} />
        <View
          className={joinClasses(
            sizeClass,
            'h-[2px] -rotate-45 rounded-full',
            lineClass,
          )}
        />
      </View>
    </View>
  );
}

/**
 * Inputs: a short label string.
 * Output: a compact two-letter monogram for scope header avatars.
 */
function getScopeMonogram(shortLabel?: string): string {
  const normalizedLabel = shortLabel?.trim() || 'Scope';

  return normalizedLabel
    .split(/[\s/.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'SC';
}

/**
 * Inputs: raw scope copy plus a max length.
 * Output: trimmed scope copy that will not overrun compact rail cards.
 */
function truncateScopeCopy(value: string | undefined, maxLength: number): string {
  if (!value) {
    return '';
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Inputs: the current scope stats.
 * Output: a compact activity label for the scope snapshot card.
 */
function getScopeActivityLevel(scope: NexusScopeSummary): string {
  const activityScore =
    scope.stats.hotDiscussions + scope.stats.activeVotes + scope.stats.missions;

  if (activityScore >= 16) {
    return 'High';
  }

  if (activityScore >= 8) {
    return 'Steady';
  }

  return 'Quiet';
}

/**
 * Inputs: the current scope stats.
 * Output: a mock trust score for the current scope snapshot card.
 */
function getScopeTrustScore(scope: NexusScopeSummary): number {
  const trustScore =
    42 +
    Math.min(scope.stats.members, 180) / 3 +
    scope.stats.activeVotes * 2 +
    scope.stats.hotDiscussions;

  return Math.max(48, Math.min(97, Math.round(trustScore)));
}

/**
 * Inputs: the current scope and active function section.
 * Output: three compact snapshot metrics tailored to the current section lens.
 */
function getScopeSnapshotMetrics(
  scope: NexusScopeSummary,
  activeSection: NexusSection,
): NexusScopeSnapshotMetric[] {
  const trustScore = getScopeTrustScore(scope);
  const activityLevel = getScopeActivityLevel(scope);
  const recentPostsEstimate = Math.max(1, scope.stats.hotDiscussions * 3);
  const hotThreadsEstimate = Math.max(1, scope.stats.hotDiscussions);
  const packetEstimate = Math.max(
    6,
    scope.stats.hotDiscussions * 2 +
      scope.stats.activeVotes * 3 +
      scope.stats.missions * 2 +
      Math.round(scope.stats.members / 8),
  );
  const reportEstimate = Math.max(1, scope.stats.missions);
  const quorumEstimate = Math.max(5, Math.round(scope.stats.members * 0.18));
  const turnoutEstimate = Math.max(
    1,
    Math.min(scope.stats.members, scope.stats.activeVotes * 7),
  );

  switch (activeSection) {
    case 'discussions':
      return [
        { label: 'Recent', value: String(recentPostsEstimate) },
        { label: 'Threads', value: String(hotThreadsEstimate) },
        { label: 'Lobby', value: scope.stats.guestLobbyOpen ? 'Open' : 'Quiet' },
      ];
    case 'votes':
      return [
        { label: 'Open', value: String(scope.stats.activeVotes) },
        { label: 'Quorum', value: String(quorumEstimate) },
        { label: 'Turnout', value: String(turnoutEstimate) },
      ];
    case 'roles':
      return [
        { label: 'Claims', value: String(Math.max(1, Math.round(scope.stats.members / 6))) },
        { label: 'Standing', value: scope.level === 'personal' ? 'Personal' : 'Assembly' },
        { label: 'Trust', value: String(trustScore) },
      ];
    case 'library':
      return [
        { label: 'Packets', value: String(packetEstimate) },
        { label: 'Reports', value: String(reportEstimate) },
        { label: 'Threads', value: String(hotThreadsEstimate) },
      ];
    case 'trust':
      return [
        { label: 'Your trust', value: 'Inspect' },
        { label: 'Assembly', value: String(trustScore) },
        { label: 'Standing', value: scope.level === 'personal' ? 'Personal' : 'Public' },
      ];
    case 'dashboard':
    default:
      return [
        { label: 'Activity', value: activityLevel },
        { label: 'Members', value: String(scope.stats.members) },
        { label: 'Votes', value: String(scope.stats.activeVotes) },
      ];
  }
}

/**
 * Inputs: rail toggle direction and press callback.
 * Output: an edge-mounted collapse or expand button for a nexus rail.
 */
function NexusRailToggle({
  direction,
  themeMode,
  uiDensity,
  onPress,
}: NexusRailToggleProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={joinClasses(
        'absolute right-[-14px] top-1/2 z-10 -translate-y-5 items-center justify-center rounded-full border',
        uiDensity === 'large' ? 'h-11 w-11' : 'h-10 w-10',
        themeMode === 'dark'
          ? 'border-nexus-line bg-nexus-ink'
          : 'border-slate-300 bg-white',
      )}
      onPress={onPress}
    >
      <Text
        className={joinClasses(
          uiDensity === 'large'
            ? 'text-base font-semibold'
            : 'text-sm font-semibold',
          themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900',
        )}
      >
        {direction}
      </Text>
    </Pressable>
  );
}

/**
 * Inputs: a label, two state labels, and the current selected value.
 * Output: a compact switch-style preference control for the guest shell header.
 */
function NexusPreferenceSwitch<TOption extends string>({
  label,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  selectedValue,
  themeMode,
  uiDensity,
  onSelect,
}: NexusPreferenceSwitchProps<TOption>) {
  const isRightSelected = selectedValue === rightValue;
  const selectedLabel = isRightSelected ? rightLabel : leftLabel;

  return (
    <View className="self-center flex-row items-center justify-center gap-3">
      <Text
        className={joinClasses(
          uiDensity === 'large'
            ? 'w-[68px] text-right text-xs font-semibold uppercase tracking-[2px]'
            : 'w-[60px] text-right text-[11px] font-semibold uppercase tracking-[2px]',
          themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600',
        )}
      >
        {label}
      </Text>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: isRightSelected }}
        className={joinClasses(
          uiDensity === 'large'
            ? 'w-[64px] rounded-full border p-1'
            : 'w-[58px] rounded-full border p-1',
          themeMode === 'dark'
            ? isRightSelected
              ? 'border-nexus-sky bg-nexus-sky/10'
              : 'border-nexus-line bg-white/5'
            : isRightSelected
              ? 'border-sky-400 bg-sky-50'
              : 'border-slate-300 bg-slate-100',
        )}
        onPress={() => onSelect(isRightSelected ? leftValue : rightValue)}
      >
        <View
          className={joinClasses(
            uiDensity === 'large'
              ? 'h-6 w-6 rounded-full'
              : 'h-5 w-5 rounded-full',
            isRightSelected ? 'self-end' : 'self-start',
            themeMode === 'dark'
              ? isRightSelected
                ? 'bg-nexus-sky'
                : 'bg-nexus-text'
              : isRightSelected
                ? 'bg-sky-500'
                : 'bg-slate-700',
          )}
        />
      </Pressable>
      <Text
        className={joinClasses(
          uiDensity === 'large'
            ? 'w-[92px] text-left text-sm font-semibold uppercase tracking-[1.8px]'
            : 'w-[84px] text-left text-xs font-semibold uppercase tracking-[1.8px]',
          themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900',
        )}
      >
        {selectedLabel}
      </Text>
    </View>
  );
}

/**
 * Inputs: current scope labels and summary metadata.
 * Output: a compact current-context card used by whichever rail is acting as the scope menu.
 */
function NexusCurrentContextCard({
  scope,
  scopePath,
  activeSection,
  themeMode,
  uiDensity,
}: NexusCurrentContextCardProps) {
  const snapshotMetrics = getScopeSnapshotMetrics(scope, activeSection);
  const compactScopePath = truncateScopeCopy(scopePath, 36);

  return (
    <NexusCard
      className={joinClasses(
        'min-h-[228px] gap-4 overflow-hidden',
        themeMode === 'dark'
          ? 'bg-white/5'
          : 'border-slate-300 bg-slate-50',
        uiDensity === 'large' ? 'p-5' : 'p-4',
      )}
    >
      <Text
        className={joinClasses(
          'self-center text-center text-xs font-semibold uppercase tracking-[3px]',
          themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600',
        )}
      >
        Current Context
      </Text>

      <View className="items-center gap-3">
        <View
          className={joinClasses(
            'items-center justify-center rounded-full border',
            uiDensity === 'large' ? 'h-16 w-16' : 'h-14 w-14',
            themeMode === 'dark'
              ? 'border-nexus-line bg-white/5'
              : 'border-slate-300 bg-slate-100',
          )}
        >
          <Text
            className={joinClasses(
              uiDensity === 'large'
                ? 'text-xl font-bold uppercase'
                : 'text-lg font-bold uppercase',
              themeMode === 'dark' ? 'text-nexus-mint' : 'text-emerald-600',
            )}
          >
            {getScopeMonogram(scope.shortLabel)}
          </Text>
        </View>

        <Text
          className={joinClasses(
            'text-center font-bold',
            uiDensity === 'large' ? 'text-2xl' : 'text-xl',
            themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900',
          )}
          numberOfLines={2}
        >
          {scope.name}
        </Text>

        <Text
          className="text-center text-[11px] font-semibold uppercase tracking-[1px] text-nexus-sky"
          numberOfLines={1}
        >
          {compactScopePath}
        </Text>
      </View>

      <View className="flex-row gap-1.5">
        {snapshotMetrics.map((metric) => (
          <View
            key={metric.label}
            className={joinClasses(
              'flex-1 items-center rounded-[18px] border px-2 py-3',
              themeMode === 'dark'
                ? 'border-nexus-line bg-nexus-ink/40'
                : 'border-slate-300 bg-white',
            )}
          >
            <Text className="text-center text-[10px] font-semibold uppercase tracking-[1.4px] text-nexus-sky">
              {metric.label}
            </Text>
            <Text
              className={joinClasses(
                'mt-2 text-center font-semibold',
                uiDensity === 'large' ? 'text-base' : 'text-sm',
                themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900',
              )}
              numberOfLines={1}
            >
              {metric.value}
            </Text>
          </View>
        ))}
      </View>
    </NexusCard>
  );
}

/**
 * Inputs: a scope level string.
 * Output: a human-readable label for the scope row metadata line.
 */
function getScopeLevelLabel(level: NexusScopeSummary['level']): string {
  switch (level) {
    case 'global':
      return 'Global branch';
    case 'nation':
      return 'National branch';
    case 'region':
      return 'Regional branch';
    case 'city':
      return 'City branch';
    case 'district':
      return 'District branch';
    default:
      return 'Scope branch';
  }
}

/**
 * Inputs: a possibly missing scope summary from a lookup.
 * Output: whether the lookup resolved to a real scope summary.
 */
function isNexusScopeSummary(
  scope: NexusScopeSummary | undefined,
): scope is NexusScopeSummary {
  return Boolean(scope);
}

/**
 * Inputs: a small menu section label.
 * Output: a consistently styled eyebrow label inside nexus menu cards.
 */
function NexusMenuSectionLabel({
  label,
  themeMode,
  uiDensity,
}: {
  label: string;
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
}) {
  return (
    <Text
      className={joinClasses(
        uiDensity === 'large'
          ? 'text-[13px] font-semibold uppercase tracking-[2.2px]'
          : 'text-xs font-semibold uppercase tracking-[2px]',
        themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600',
      )}
    >
      {label}
    </Text>
  );
}

/**
 * Inputs: title and detail metadata plus active and press state.
 * Output: a function-menu row for either the primary or secondary rail.
 */
function NexusPrimaryNavItem({
  title,
  detail,
  isActive,
  themeMode,
  uiDensity,
  onPress,
}: NexusPrimaryNavItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={joinClasses(
        'rounded-[24px] border',
        uiDensity === 'large' ? 'px-5 py-5' : 'px-4 py-4',
        themeMode === 'dark'
          ? isActive
            ? 'border-nexus-sky bg-nexus-sky/10'
            : 'border-nexus-line bg-white/5'
          : isActive
            ? 'border-sky-400 bg-sky-50'
            : 'border-slate-300 bg-slate-100',
      )}
      onPress={onPress}
    >
      <Text
        className={joinClasses(
          uiDensity === 'large'
            ? 'text-lg font-semibold'
            : 'text-base font-semibold',
          themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900',
        )}
      >
        {title}
      </Text>
      <Text
        className={joinClasses(
          uiDensity === 'large'
            ? 'mt-2 text-base leading-7'
            : 'mt-1 text-sm leading-6',
          themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600',
        )}
      >
        {detail}
      </Text>
    </Pressable>
  );
}

/**
 * Inputs: scope row metadata, interaction state, and a click handler.
 * Output: a flat scope-navigation row that stays left-aligned regardless of branch depth.
 */
function NexusScopeMenuRow({
  depth,
  isActive,
  isLineage,
  scopeMeta,
  scopeName,
  themeMode,
  uiDensity,
  onPress,
}: NexusScopeMenuRowProps) {
  const connectorOffset = 10 + depth * 6;

  return (
    <View className="flex-row items-center gap-3">
      <View className="relative h-12 w-11 justify-center">
        <View
          className="absolute bottom-1 left-[10px] top-1 w-px rounded-full bg-nexus-line/20"
        />
        <View
          className={`absolute top-1/2 h-px -translate-y-px rounded-full ${
            isLineage ? 'bg-nexus-sky/60' : 'bg-nexus-line/60'
          }`}
          style={{ left: 10, width: depth * 6 + 10 }}
        />
        <View
          className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-[5px] rounded-full ${
            isActive
              ? 'bg-nexus-sky'
              : isLineage
                ? 'bg-nexus-sky/60'
                : 'bg-nexus-line'
          }`}
          style={{ left: connectorOffset + 8 }}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        className={joinClasses(
          'flex-1 rounded-[18px] border',
          uiDensity === 'large' ? 'px-4 py-3.5' : 'px-3 py-3',
          themeMode === 'dark'
            ? isActive
              ? 'border-nexus-sky bg-nexus-sky/10'
              : 'border-nexus-line bg-white/5'
            : isActive
              ? 'border-sky-400 bg-sky-50'
              : 'border-slate-300 bg-slate-100',
        )}
        onPress={onPress}
      >
        <Text
          className={joinClasses(
            uiDensity === 'large'
              ? 'text-base font-semibold leading-6'
              : 'text-sm font-semibold leading-5',
            themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900',
          )}
          numberOfLines={2}
        >
          {scopeName}
        </Text>
        <Text
          className={joinClasses(
            uiDensity === 'large'
              ? 'mt-1.5 text-[11px] font-semibold uppercase tracking-[1.8px]'
              : 'mt-1 text-[10px] font-semibold uppercase tracking-[1.6px]',
            themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600',
          )}
          numberOfLines={1}
        >
          {scopeMeta}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Inputs: active function state and the active scope lens.
 * Output: the function menu content for either the primary or secondary rail.
 */
function NexusFunctionMenuContent({
  activeScope,
  activeSection,
  showScopedLabel,
  themeMode,
  uiDensity,
  onSectionPress,
}: NexusFunctionMenuContentProps) {
  return (
    <>
      {showScopedLabel ? (
        <NexusMenuSectionLabel
          label="Functions for this scope"
          themeMode={themeMode}
          uiDensity={uiDensity}
        />
      ) : null}

      <View className="gap-3">
        {NEXUS_SECTION_ORDER.map((section) => (
          <NexusPrimaryNavItem
            key={section}
            detail={`${NEXUS_SECTION_LABELS[section]} across ${activeScope.shortLabel}.`}
            isActive={activeSection === section}
            onPress={() => onSectionPress(section)}
            title={NEXUS_SECTION_LABELS[section]}
            themeMode={themeMode}
            uiDensity={uiDensity}
          />
        ))}
      </View>

      <View className="gap-2 pt-2">
        <NexusMenuSectionLabel
          label="Deferred surfaces"
          themeMode={themeMode}
          uiDensity={uiDensity}
        />
        <View className="flex-row flex-wrap gap-2">
          {NEXUS_COMING_SOON_SURFACES.map((surface) => (
            <NexusBadge key={surface} label={surface} tone="default" />
          ))}
        </View>
      </View>
    </>
  );
}

/**
 * Inputs: active scope state, related scope lists, and a click handler.
 * Output: the scope menu content with the current context pinned above the branch navigator.
 */
function NexusScopeMenuContent({
  activeScopeId,
  followedScopes,
  scopeMenuNodes,
  scopeSummaries,
  themeMode,
  uiDensity,
  onScopePress,
}: NexusScopeMenuContentProps) {
  return (
    <>
      <View className="gap-2">
        <NexusMenuSectionLabel
          label="Scope map"
          themeMode={themeMode}
          uiDensity={uiDensity}
        />
        <View className="relative gap-2 pl-1">
          {scopeMenuNodes.map((node) => {
            const scope = scopeSummaries.find(
              (scopeSummary) => scopeSummary.id === node.scopeId,
            );

            if (!scope) {
              return null;
            }

            return (
              <NexusScopeMenuRow
                key={scope.id}
                depth={node.depth}
                isActive={scope.id === activeScopeId}
                isLineage={
                  node.relationship === 'global' ||
                  node.relationship === 'parent' ||
                  node.relationship === 'current'
                }
                onPress={() => onScopePress(scope.id)}
                scopeMeta={getScopeLevelLabel(scope.level)}
                scopeName={scope.name}
                themeMode={themeMode}
                uiDensity={uiDensity}
              />
            );
          })}
        </View>
      </View>

      <View className="gap-2 pt-2">
        <NexusMenuSectionLabel
          label="Followed scopes"
          themeMode={themeMode}
          uiDensity={uiDensity}
        />
        <View className="flex-row flex-wrap gap-2">
          {followedScopes.map((scope) => (
            <Pressable
              key={scope.id}
              accessibilityRole="button"
              className={joinClasses(
                uiDensity === 'large'
                  ? 'rounded-full border px-3.5 py-2.5'
                  : 'rounded-full border px-3 py-2',
                themeMode === 'dark'
                  ? scope.id === activeScopeId
                    ? 'border-nexus-mint bg-nexus-mint/10'
                    : 'border-nexus-line bg-white/5'
                  : scope.id === activeScopeId
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-slate-300 bg-slate-100',
              )}
              onPress={() => onScopePress(scope.id)}
            >
              <Text
                className={joinClasses(
                  uiDensity === 'large'
                    ? 'text-base font-semibold'
                    : 'text-sm font-semibold',
                  themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900',
                )}
              >
                {scope.shortLabel}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
}

/**
 * Inputs: sidebar container mode and a close callback for narrow screens.
 * Output: the left-side nexus navigation split into collapsible primary and secondary rails.
 */
export default function NexusSidebar({
  isDesktop,
  onRequestClose,
}: NexusSidebarProps) {
  const router = useRouter();
  const {
    activeScope,
    activeScopeId,
    activeSection,
    currentActorLabel,
    currentIdentityMode,
    followedScopes,
    navigationMode,
    scopeSummaries,
    themeMode,
    uiDensity,
    isPreferencesDrawerOpen,
    isPrimaryRailCollapsed,
    isSecondaryRailCollapsed,
    setActiveScopeId,
    setActiveSection,
    setNavigationMode,
    setThemeMode,
    setUiDensity,
    togglePreferencesDrawer,
    togglePrimaryRailCollapsed,
    toggleSecondaryRailCollapsed,
  } = useNexusShell();
  const {
    currentStorageMode,
    isAuthenticated,
    rememberClaimedSessions,
    securityMode,
    setRememberClaimedSessions,
    setSecurityMode,
  } = useIdentityShell();
  const hasActiveClaimedSession =
    currentIdentityMode === 'claimed' && isAuthenticated;
  const sessionPreferenceActiveId =
    currentIdentityMode === 'claimed'
      ? rememberClaimedSessions
        ? 'save'
        : 'temp'
      : currentStorageMode === 'none'
        ? 'temp'
        : 'save';

  const isFunctionMode = navigationMode === 'function';
  const isLargeUi = uiDensity === 'large';
  const railWidth = getNexusRailWidth(uiDensity);
  const primaryTitle = isFunctionMode ? 'Function menu' : 'Scope menu';
  const primaryDescription = isFunctionMode
    ? 'Choose the civic function in focus.'
    : 'Move through the active branch and nearby public scopes.';
  const secondaryTitle = isFunctionMode ? 'Scope menu' : 'Function menu';
  const secondaryDescription = isFunctionMode
    ? 'Switch branches and keep scope context visible.'
    : 'Move through the current scope by civic function.';
  const scopeMenuNodes = buildNexusBranchNodes(
    scopeSummaries,
    activeScopeId,
    scopeSummaries.map((scope) => scope.id),
  );
  const branchPathScopes = [
    ...getNexusAncestorIds(scopeSummaries, activeScope.id)
      .map((scopeId) => scopeSummaries.find((scope) => scope.id === scopeId))
      .filter(isNexusScopeSummary),
    activeScope,
  ] as NexusScopeSummary[];
  const currentScopePath = branchPathScopes
    .map((scope) => scope.shortLabel)
    .join(' / ');
  const railBorderClass =
    themeMode === 'dark' ? 'border-nexus-line' : 'border-slate-300';
  const primaryRailClass =
    themeMode === 'dark' ? 'bg-nexus-ink' : 'bg-slate-100';
  const secondaryRailClass =
    themeMode === 'dark' ? 'bg-nexus-panel' : 'bg-slate-50';
  const profileCardClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-nexus-panel'
      : 'border-slate-300 bg-white';
  const panelCardClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-nexus-panel'
      : 'border-slate-300 bg-white';
  const titleTextClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const mutedTextClass =
    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600';
  const homeButtonClass =
    themeMode === 'dark'
      ? 'border-nexus-line bg-white/5'
      : 'border-slate-300 bg-slate-100';
  const signInButtonClass =
    themeMode === 'dark'
      ? 'border-nexus-line bg-white/5'
      : 'border-slate-300 bg-slate-100';
  const signUpButtonClass =
    themeMode === 'dark'
      ? 'border-nexus-sky bg-nexus-sky'
      : 'border-sky-500 bg-sky-500';
  const preferencesPanelClass =
    themeMode === 'dark'
      ? 'border-nexus-line bg-white/5'
      : 'border-slate-300 bg-slate-50';
  const preferencesButtonClass =
    themeMode === 'dark'
      ? 'border-nexus-line/80 bg-nexus-ink/40'
      : 'border-slate-300 bg-slate-100';
  const preferencesAnimation = useRef(
    new Animated.Value(isPreferencesDrawerOpen ? 1 : 0),
  ).current;

  useEffect(() => {
    Animated.timing(preferencesAnimation, {
      toValue: isPreferencesDrawerOpen ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isPreferencesDrawerOpen, preferencesAnimation]);

  const preferencesContentHeight = preferencesAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isLargeUi ? 348 : 320],
  });
  const preferencesContentOpacity = preferencesAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const preferencesContentTranslateY = preferencesAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
  });

  /**
   * Inputs: a nexus section key.
   * Output: navigates to the section and closes the mobile tray when needed.
   */
  const handleSectionPress = (section: NexusSection) => {
    setActiveSection(section);

    if (!isDesktop) {
      onRequestClose();
    }
  };

  /**
   * Inputs: a scope id.
   * Output: updates the current scope and closes the mobile tray when needed.
   */
  const handleScopePress = (scopeId: string) => {
    setActiveScopeId(scopeId);

    if (!isDesktop) {
      onRequestClose();
    }
  };

  return (
    <View className={joinClasses('flex-1 flex-row', primaryRailClass)}>
      {!isPrimaryRailCollapsed ? (
        <View
          className={joinClasses(
            'relative border-r',
            railBorderClass,
            primaryRailClass,
          )}
          style={{ width: railWidth }}
        >
          <ScrollView
            className="flex-1"
            contentContainerClassName={joinClasses(
              isLargeUi ? 'gap-5 px-5 py-6' : 'gap-4 px-4 py-5',
            )}
            showsVerticalScrollIndicator={false}
          >
            <NexusCard
              className={joinClasses(
                'gap-4',
                profileCardClass,
                isLargeUi ? 'p-5' : 'p-4',
              )}
            >
              <Text className="self-center text-center text-xs font-semibold uppercase tracking-[4px] text-nexus-sky">
                OWA Nexus
              </Text>
              <View className="items-center gap-3">
                <NexusGuestAvatar themeMode={themeMode} uiDensity={uiDensity} />
                <Text
                  className={joinClasses(
                    isLargeUi ? 'text-2xl' : 'text-xl',
                    'font-bold',
                    titleTextClass,
                  )}
                >
                  {currentActorLabel}
                </Text>
                <Text
                  className={joinClasses(
                    isLargeUi ? 'text-base' : 'text-sm',
                    'font-semibold',
                    mutedTextClass,
                  )}
                >
                  {currentIdentityMode === 'claimed'
                    ? 'claimed identity'
                    : 'guest identity'}
                </Text>
              </View>

              <View className="self-center flex-row gap-2">
                <Pressable
                  accessibilityRole="button"
                  className={joinClasses(
                    isLargeUi
                      ? 'rounded-full border px-4 py-2.5'
                      : 'rounded-full border px-3 py-2',
                    signInButtonClass,
                  )}
                  onPress={() =>
                    router.push(
                      hasActiveClaimedSession
                        ? '/nexus/identity/security'
                        : '/nexus/identity/sign-in'
                    )
                  }
                >
                  <Text
                    className={joinClasses(
                      isLargeUi
                        ? 'text-base font-semibold'
                        : 'text-sm font-semibold',
                      titleTextClass,
                    )}
                  >
                    {hasActiveClaimedSession ? 'Security' : 'Sign In'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  className={joinClasses(
                    isLargeUi
                      ? 'rounded-full border px-4 py-2.5'
                      : 'rounded-full border px-3 py-2',
                    signUpButtonClass,
                  )}
                  onPress={() =>
                    router.push(
                      hasActiveClaimedSession
                        ? '/nexus/account'
                        : '/nexus/identity/claim'
                    )
                  }
                >
                  <Text
                    className={joinClasses(
                      isLargeUi
                        ? 'text-base font-semibold'
                        : 'text-sm font-semibold',
                      'text-nexus-canvas',
                    )}
                  >
                    {hasActiveClaimedSession ? 'Profile' : 'Claim'}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                className={joinClasses(
                  'items-center rounded-full border',
                  isLargeUi ? 'px-4 py-3' : 'px-3 py-2.5',
                  homeButtonClass,
                )}
                onPress={() => router.push('/' as Href)}
              >
                <Text
                  className={joinClasses(
                    isLargeUi
                      ? 'text-sm font-semibold uppercase tracking-[2px]'
                      : 'text-xs font-semibold uppercase tracking-[2px]',
                    titleTextClass,
                  )}
                >
                  Back to Home
                </Text>
              </Pressable>

              <View
                className={joinClasses(
                  'overflow-hidden rounded-[22px] border',
                  preferencesPanelClass,
                )}
              >
                <Animated.View
                  style={{
                    height: preferencesContentHeight,
                    opacity: preferencesContentOpacity,
                    transform: [{ translateY: preferencesContentTranslateY }],
                  }}
                >
                  <View
                    className={joinClasses(
                      'items-center gap-3',
                      isLargeUi ? 'px-4 py-4' : 'px-3 py-3',
                    )}
                  >
                    <NexusPreferenceSwitch
                      label="Navi"
                      leftLabel="Functions"
                      leftValue="function"
                      onSelect={setNavigationMode}
                      rightLabel="Scopes"
                      rightValue="scope"
                      selectedValue={navigationMode}
                      themeMode={themeMode}
                      uiDensity={uiDensity}
                    />

                    <NexusPreferenceSwitch
                      label="Theme"
                      leftLabel="Dark"
                      leftValue="dark"
                      onSelect={setThemeMode}
                      rightLabel="Light"
                      rightValue="light"
                      selectedValue={themeMode}
                      themeMode={themeMode}
                      uiDensity={uiDensity}
                    />

                    <NexusPreferenceSwitch
                      label="Size"
                      leftLabel="Small"
                      leftValue="small"
                      onSelect={setUiDensity}
                      rightLabel="Large"
                      rightValue="large"
                      selectedValue={uiDensity}
                      themeMode={themeMode}
                      uiDensity={uiDensity}
                    />

                    <View className="items-center gap-2">
                      <Text
                        className={joinClasses(
                          isLargeUi
                            ? 'text-[13px] font-semibold uppercase tracking-[2px]'
                            : 'text-[11px] font-semibold uppercase tracking-[2px]',
                          themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600',
                        )}
                      >
                        Session
                      </Text>
                      <NexusSegmentedPill
                        compact
                        options={[
                          { id: 'temp', label: 'TEMP' },
                          { id: 'save', label: 'SAVE' },
                        ]}
                        activeId={sessionPreferenceActiveId}
                        onSelect={(value) => {
                          void setRememberClaimedSessions(value === 'save').catch(
                            () => undefined
                          );
                        }}
                      />
                    </View>

                    <View className="items-center gap-2">
                      <Text
                        className={joinClasses(
                          isLargeUi
                            ? 'text-[13px] font-semibold uppercase tracking-[2px]'
                            : 'text-[11px] font-semibold uppercase tracking-[2px]',
                          themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600',
                        )}
                      >
                        Write approval
                      </Text>
                      <NexusSegmentedPill
                        compact
                        options={[
                          { id: 'standard', label: 'OFF' },
                          { id: 'guarded', label: 'MED' },
                          { id: 'every_write', label: 'MAX' },
                        ]}
                        activeId={securityMode ?? 'guarded'}
                        onSelect={(value) => {
                          void setSecurityMode(value as NexusSecurityMode).catch(
                            () => undefined
                          );
                        }}
                        disabled={!hasActiveClaimedSession}
                      />
                    </View>
                  </View>
                </Animated.View>

                <Pressable
                  accessibilityRole="button"
                  className={joinClasses(
                    'flex-row items-center justify-between border-t',
                    isLargeUi ? 'px-4 py-3' : 'px-3 py-2.5',
                    preferencesButtonClass,
                  )}
                  onPress={togglePreferencesDrawer}
                >
                  <Text
                    className={joinClasses(
                      isLargeUi
                        ? 'text-sm font-semibold uppercase tracking-[2px]'
                        : 'text-xs font-semibold uppercase tracking-[2px]',
                      themeMode === 'dark'
                        ? 'text-nexus-muted'
                        : 'text-slate-600',
                    )}
                  >
                    Preferences
                  </Text>
                  <NexusChevronIcon
                    isOpen={isPreferencesDrawerOpen}
                    themeMode={themeMode}
                    uiDensity={uiDensity}
                  />
                </Pressable>
              </View>
            </NexusCard>

            <NexusCard
              className={joinClasses(
                'gap-3',
                panelCardClass,
                isLargeUi ? 'p-5' : 'p-4',
              )}
            >
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                {primaryTitle}
              </Text>
              <Text
                className={joinClasses(
                  isLargeUi ? 'text-base leading-7' : 'text-sm leading-6',
                  mutedTextClass,
                )}
              >
                {primaryDescription}
              </Text>

              <View className="gap-3">
                {isFunctionMode ? (
                  <NexusFunctionMenuContent
                    activeScope={activeScope}
                    activeSection={activeSection}
                    onSectionPress={handleSectionPress}
                    showScopedLabel={false}
                    themeMode={themeMode}
                    uiDensity={uiDensity}
                  />
                ) : (
                  <NexusScopeMenuContent
                    activeScopeId={activeScopeId}
                    followedScopes={followedScopes}
                    scopeMenuNodes={scopeMenuNodes}
                    scopeSummaries={scopeSummaries}
                    onScopePress={handleScopePress}
                    themeMode={themeMode}
                    uiDensity={uiDensity}
                  />
                )}
              </View>
            </NexusCard>
          </ScrollView>

          <NexusRailToggle
            direction="<"
            onPress={togglePrimaryRailCollapsed}
            themeMode={themeMode}
            uiDensity={uiDensity}
          />
        </View>
      ) : (
        <View
          className={joinClasses(
            'relative border-r',
            railBorderClass,
            primaryRailClass,
          )}
          style={{ width: NEXUS_COLLAPSED_RAIL_WIDTH }}
        >
          <NexusRailToggle
            direction=">"
            onPress={togglePrimaryRailCollapsed}
            themeMode={themeMode}
            uiDensity={uiDensity}
          />
        </View>
      )}

      {!isSecondaryRailCollapsed ? (
        <View
          className={joinClasses('relative', secondaryRailClass)}
          style={{ width: railWidth }}
        >
          <ScrollView
            className="flex-1"
            contentContainerClassName={joinClasses(
              isLargeUi ? 'gap-5 px-5 py-6' : 'gap-4 px-4 py-5',
            )}
            showsVerticalScrollIndicator={false}
          >
            <NexusCurrentContextCard
              scope={activeScope}
              scopePath={currentScopePath}
              activeSection={activeSection}
              themeMode={themeMode}
              uiDensity={uiDensity}
            />

            <NexusCard
              className={joinClasses(
                'gap-4',
                panelCardClass,
                isLargeUi ? 'p-5' : 'p-4',
              )}
            >
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                {secondaryTitle}
              </Text>
              <Text
                className={joinClasses(
                  isLargeUi ? 'text-base leading-7' : 'text-sm leading-6',
                  mutedTextClass,
                )}
              >
                {secondaryDescription}
              </Text>

              <View className="gap-3">
                {isFunctionMode ? (
                  <NexusScopeMenuContent
                    activeScopeId={activeScopeId}
                    followedScopes={followedScopes}
                    scopeMenuNodes={scopeMenuNodes}
                    scopeSummaries={scopeSummaries}
                    onScopePress={handleScopePress}
                    themeMode={themeMode}
                    uiDensity={uiDensity}
                  />
                ) : (
                  <NexusFunctionMenuContent
                    activeScope={activeScope}
                    activeSection={activeSection}
                    onSectionPress={handleSectionPress}
                    showScopedLabel={true}
                    themeMode={themeMode}
                    uiDensity={uiDensity}
                  />
                )}
              </View>
            </NexusCard>
          </ScrollView>

          <NexusRailToggle
            direction="<"
            onPress={toggleSecondaryRailCollapsed}
            themeMode={themeMode}
            uiDensity={uiDensity}
          />
        </View>
      ) : null}

      {isSecondaryRailCollapsed ? (
        <View
          className={joinClasses(
            'relative border-r',
            railBorderClass,
            secondaryRailClass,
          )}
          style={{ width: NEXUS_COLLAPSED_RAIL_WIDTH }}
        >
          <NexusRailToggle
            direction=">"
            onPress={toggleSecondaryRailCollapsed}
            themeMode={themeMode}
            uiDensity={uiDensity}
          />
        </View>
      ) : null}
    </View>
  );
}
