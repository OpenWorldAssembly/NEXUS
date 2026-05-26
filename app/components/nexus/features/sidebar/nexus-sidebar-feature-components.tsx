/**
 * File: nexus-sidebar-feature-components.tsx
 * Description: Feature-local UI components for the Nexus sidebar rails, scope menus, and preference controls.
 */
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  NexusCard,
  NexusCardMenuButton,
  NexusChevronIcon,
  NexusLoadingBoundary,
  NexusThemedBevelEdges,
  getNexusChromeClasses,
} from '@app/components/nexus/ui';
import {
  NEXUS_SECTION_ORDER,
  getNexusSectionMenuDetail,
  getNexusSectionMenuTitle,
  isNexusGeographicTreeScope,
  type NexusProjectedScopeGroup,
  type NexusProjectedScopeSection,
  type NexusSidebarScopeSectionId,
  type NexusScopeSummary,
  type NexusSection,
  type NexusThemeMode,
  type NexusUiDensity,
} from '@runtime/nexus/nexus-shell';

type NexusPrimaryNavItemProps = {
  title: string;
  detail: string;
  isActive: boolean;
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
  onPress: () => void;
};

type NexusRailToggleProps = {
  direction: 'left' | 'right';
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

type NexusScopeSectionVisibilityState = Record<NexusSidebarScopeSectionId, boolean>;

type NexusFunctionMenuContentProps = {
  activeScope: NexusScopeSummary;
  activeSection: NexusSection;
  showActiveSelection: boolean;
  showScopedLabel: boolean;
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
  onSectionPress: (section: NexusSection) => void;
};

type NexusScopeMenuContentProps = {
  activeScopeId: string;
  associatedGraph: NexusProjectedScopeSection;
  discoverableSection: NexusProjectedScopeSection;
  followedGraph: NexusProjectedScopeSection;
  homeGraph: NexusProjectedScopeSection;
  mainGraph: NexusProjectedScopeSection;
  scopeSummaries: NexusScopeSummary[];
  mainVisibleScopePacketIds: string[];
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
  onOpenInExplorerPress: (scope: NexusScopeSummary) => void;
  onScopeAssociatePress: (scopeId: string, isAssociated: boolean) => void;
  onScopePress: (scopeId: string) => void;
  onScopeFollowPress: (scopeId: string, isFollowed: boolean) => void;
  onScopeMainVisiblePress: (scopeId: string, isMainVisible: boolean) => void;
  onSetSectionParentChains: (
    sectionId: Extract<NexusSidebarScopeSectionId, 'associated' | 'followed'>,
    showParentChains: boolean
  ) => void;
};

export type NexusPreferenceSwitchProps<TOption extends string> = {
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

const SIDEBAR_SCOPE_LIST_LIMIT = 10;
const SIDEBAR_SCOPE_GROUP_INITIAL_LIMIT = 8;
const SIDEBAR_SECTION_MAX_HEIGHT = 280;

function joinClasses(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function getScopeMonogram(shortLabel?: string): string {
  const normalizedLabel = shortLabel?.trim() || 'Scope';

  return normalizedLabel
    .split(/[\s/.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'SC';
}

function truncateScopeCopy(value: string | undefined, maxLength: number): string {
  if (!value) {
    return '';
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}â€¦`;
}

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

function getScopeTrustScore(scope: NexusScopeSummary): number {
  const trustScore =
    42 +
    Math.min(scope.stats.members, 180) / 3 +
    scope.stats.activeVotes * 2 +
    scope.stats.hotDiscussions;

  return Math.max(48, Math.min(97, Math.round(trustScore)));
}

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

function isMainTreeEligibleScope(scope: NexusScopeSummary): boolean {
  return (
    scope.isAssociated ||
    scope.isFollowed ||
    isNexusGeographicTreeScope(scope)
  );
}

function getScopeLoadingScopes(scopeId: string): string[] {
  return [
    `sidebar:scope-follow:${scopeId}`,
    `sidebar:scope-associate:${scopeId}`,
    `sidebar:scope-main-visible:${scopeId}`,
  ];
}

function NexusScopeLoadingBoundary({
  children,
  scopeId,
}: {
  children: ReactNode;
  scopeId: string;
}) {
  return getScopeLoadingScopes(scopeId).reduceRight(
    (wrappedChildren, loadingScope) => (
      <NexusLoadingBoundary scope={loadingScope}>
        {wrappedChildren}
      </NexusLoadingBoundary>
    ),
    children
  );
}

export function NexusGuestAvatar({
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

export function NexusRailToggle({
  direction,
  themeMode,
  uiDensity,
  onPress,
}: NexusRailToggleProps) {
  const chrome = getNexusChromeClasses(themeMode, uiDensity);

  return (
    <Pressable
      accessibilityRole="button"
      className={joinClasses(
        'absolute right-[-14px] top-1/2 z-10 -translate-y-5 items-center justify-center rounded-full border',
        uiDensity === 'large' ? 'h-11 w-11' : 'h-10 w-10',
        chrome.railToggleClass,
      )}
      onPress={onPress}
    >
      <NexusChevronIcon direction={direction} variant="rail" />
    </Pressable>
  );
}

export function NexusPreferenceSwitch<TOption extends string>({
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
  const chrome = getNexusChromeClasses(themeMode, uiDensity);

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
          isRightSelected
            ? chrome.preferenceSwitchTrackActiveClass
            : chrome.preferenceSwitchTrackClass,
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

export function NexusCurrentContextCard({
  scope,
  scopePath,
  activeSection,
  themeMode,
  uiDensity,
}: NexusCurrentContextCardProps) {
  const snapshotMetrics = getScopeSnapshotMetrics(scope, activeSection);
  const activeFunctionTitle = getNexusSectionMenuTitle(activeSection, scope);
  const compactScopePath = truncateScopeCopy(scopePath, 36);
  const chrome = getNexusChromeClasses(themeMode, uiDensity);

  return (
    <NexusCard
      className={joinClasses(
        'min-h-[228px] gap-4 overflow-hidden',
        chrome.cardInsetClass,
        uiDensity === 'large' ? 'p-5' : 'p-4',
      )}
    >
      <Text
        className={joinClasses(
          'self-center text-center text-xs font-semibold uppercase tracking-[3px]',
          themeMode === 'dark' ? 'text-nexus-sky' : 'text-sky-600',
        )}
        numberOfLines={2}
      >
        {scope.name}
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
          {activeFunctionTitle}
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
            className={joinClasses('items-center', chrome.statChipClass)}
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
            <NexusThemedBevelEdges themeMode={themeMode} subtle />
          </View>
        ))}
      </View>
    </NexusCard>
  );
}

export function NexusMenuSectionLabel({
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

export function NexusPrimaryNavItem({
  title,
  detail,
  isActive,
  themeMode,
  uiDensity,
  onPress,
}: NexusPrimaryNavItemProps) {
  const chrome = getNexusChromeClasses(themeMode, uiDensity);

  return (
    <Pressable
      accessibilityRole="button"
      className={joinClasses(
        isActive ? chrome.navItemActiveClass : chrome.navItemClass,
        uiDensity === 'large' ? 'px-5 py-5' : 'px-4 py-4',
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
      <NexusThemedBevelEdges themeMode={themeMode} subtle />
    </Pressable>
  );
}

export function NexusFunctionMenuContent({
  activeScope,
  activeSection,
  showActiveSelection,
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
            detail={getNexusSectionMenuDetail(section, activeScope)}
            isActive={showActiveSelection && activeSection === section}
            onPress={() => onSectionPress(section)}
            title={getNexusSectionMenuTitle(section, activeScope)}
            themeMode={themeMode}
            uiDensity={uiDensity}
          />
        ))}
      </View>

    </>
  );
}

export function NexusScopeSectionHeader({
  count,
  isOpen,
  onPress,
  themeMode,
  title,
  uiDensity,
}: {
  count: number;
  isOpen: boolean;
  onPress: () => void;
  themeMode: NexusThemeMode;
  title: string;
  uiDensity: NexusUiDensity;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="flex-row items-center justify-between gap-3"
      onPress={onPress}
    >
      <Text
        className={joinClasses(
          uiDensity === 'large'
            ? 'text-sm font-semibold uppercase tracking-[2.2px]'
            : 'text-xs font-semibold uppercase tracking-[2px]',
          themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900',
        )}
      >
        {title}
      </Text>
      <View className="flex-row items-center gap-2">
        <Text
          className={joinClasses(
            uiDensity === 'large' ? 'text-sm font-semibold' : 'text-xs font-semibold',
            themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600',
          )}
        >
          {count}
        </Text>
        <NexusChevronIcon isOpen={isOpen} />
      </View>
    </Pressable>
  );
}

export function NexusScopeActionMenu({
  align = 'top',
  isInMainTree,
  isOpen,
  onAssociatePress,
  onFollowPress,
  onMainTreePress,
  onOpenInExplorerPress,
  onOpenPress,
  onToggle,
  scope,
  themeMode,
  uiDensity,
}: {
  align?: 'top' | 'bottom';
  isInMainTree: boolean;
  isOpen: boolean;
  onAssociatePress: () => void;
  onFollowPress: () => void;
  onMainTreePress: () => void;
  onOpenInExplorerPress: () => void;
  onOpenPress: () => void;
  onToggle: () => void;
  scope: NexusScopeSummary;
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
}) {
  const chrome = getNexusChromeClasses(themeMode, uiDensity);
  const canMutateScope = scope.level !== 'personal';
  const canSetMainTreeVisibility =
    isMainTreeEligibleScope(scope) || isInMainTree;

  return (
    <View className="relative z-50 overflow-visible">
      <NexusCardMenuButton
        accessibilityLabel={`More actions for ${scope.name}`}
        onPress={onToggle}
      />

      {isOpen ? (
        <View
          className={joinClasses(
            'absolute right-0 z-50 min-w-[180px] gap-1 overflow-hidden rounded-2xl border p-2 definition-lg',
            align === 'bottom' ? 'bottom-full mb-2' : 'top-full mt-2',
            chrome.inlineSelectMenuClass
          )}
          style={{
            elevation: 50,
            backgroundColor: themeMode === 'dark' ? '#102133' : '#ffffff',
          }}
        >
          {[
            { key: 'open', label: 'Open', onPress: onOpenPress, visible: true },
            {
              key: 'follow',
              label: scope.isFollowed ? 'Unfollow' : 'Follow',
              onPress: onFollowPress,
              visible: canMutateScope,
            },
            {
              key: 'associate',
              label: scope.isAssociated ? 'Disassociate' : 'Associate',
              onPress: onAssociatePress,
              visible: canMutateScope,
            },
            {
              key: 'main-tree',
              label: isInMainTree
                ? 'Remove from main tree'
                : 'Add to main tree',
              onPress: onMainTreePress,
              visible: canSetMainTreeVisibility,
            },
            {
              key: 'explorer',
              label: 'Open in Explorer',
              onPress: onOpenInExplorerPress,
              visible: true,
            },
          ]
            .filter((action) => action.visible)
            .map((action) => (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                className={joinClasses(
                  chrome.compactButtonClass,
                  uiDensity === 'large' ? 'px-3 py-2.5' : 'px-2.5 py-2'
                )}
                onPress={action.onPress}
              >
                <Text
                  className={joinClasses(
                    uiDensity === 'large' ? 'text-sm font-semibold' : 'text-xs font-semibold',
                    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900'
                  )}
                >
                  {action.label}
                </Text>
                <NexusThemedBevelEdges themeMode={themeMode} subtle />
              </Pressable>
            ))}
        </View>
      ) : null}
    </View>
  );
}

export function NexusScopeListRow({
  activeScopeId,
  depth = 0,
  isMenuOpen = false,
  menuButton,
  onPress,
  parentChainPath = null,
  showParentChain = false,
  scope,
  themeMode,
  uiDensity,
}: {
  activeScopeId: string;
  depth?: number;
  isMenuOpen?: boolean;
  menuButton: ReactNode;
  onPress: () => void;
  parentChainPath?: string | null;
  showParentChain?: boolean;
  scope: NexusScopeSummary;
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
}) {
  const row = (
    <View
      className="relative overflow-visible"
      style={{
        marginLeft: depth * 12,
        zIndex: isMenuOpen ? 80 : 1,
        elevation: isMenuOpen ? 80 : 1,
      }}
    >
      <NexusCard
        accessibilityLabel={`Open ${scope.name}`}
        action={menuButton}
        className="min-w-0 overflow-visible"
        compact
        onPress={onPress}
        selected={activeScopeId === scope.id}
      >
        <View className="min-w-0">
          <Text
            className={joinClasses(
              uiDensity === 'large'
                ? 'text-base font-semibold leading-6'
                : 'text-sm font-semibold leading-5',
              themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900'
            )}
            numberOfLines={3}
          >
            {scope.name}
          </Text>
          {showParentChain && parentChainPath ? (
            <Text
              className={joinClasses(
                uiDensity === 'large'
                  ? 'mt-1 text-[11px] leading-5'
                  : 'mt-1 text-[10px] leading-4',
                themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600'
              )}
              numberOfLines={2}
            >
              {parentChainPath}
            </Text>
          ) : null}
        </View>
      </NexusCard>
    </View>
  );

  return <NexusScopeLoadingBoundary scopeId={scope.id}>{row}</NexusScopeLoadingBoundary>;
}

export function NexusGroupedScopeRows({
  activeScopeId,
  groups,
  mainVisibleScopePacketIds,
  onOpenInExplorerPress,
  onScopeAssociatePress,
  onScopeFollowPress,
  onScopeMainVisiblePress,
  onScopePress,
  openMenuKey,
  showParentChains,
  scopeSectionId,
  scopeSummaryById,
  setOpenMenuKey,
  themeMode,
  uiDensity,
}: {
  activeScopeId: string;
  groups: NexusProjectedScopeGroup[];
  onOpenInExplorerPress: (scope: NexusScopeSummary) => void;
  onScopeAssociatePress: (scopeId: string, isAssociated: boolean) => void;
  onScopeFollowPress: (scopeId: string, isFollowed: boolean) => void;
  onScopeMainVisiblePress: (scopeId: string, isMainVisible: boolean) => void;
  onScopePress: (scopeId: string) => void;
  mainVisibleScopePacketIds: string[];
  openMenuKey: string | null;
  showParentChains: boolean;
  scopeSectionId: NexusSidebarScopeSectionId;
  scopeSummaryById: Map<string, NexusScopeSummary>;
  setOpenMenuKey: (menuKey: string | null) => void;
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
}) {
  const [visibleGroupCounts, setVisibleGroupCounts] = useState<Record<string, number>>({});
  const totalVisibleScopeCount = groups.reduce(
    (count, group) => count + group.rows.length,
    0
  );
  const useScrollContainer = totalVisibleScopeCount > SIDEBAR_SCOPE_LIST_LIMIT;
  const Wrapper = useScrollContainer ? ScrollView : View;
  const wrapperProps = useScrollContainer
    ? {
        className: 'max-h-[280px]',
        nestedScrollEnabled: true,
        showsVerticalScrollIndicator: false,
        style: { maxHeight: SIDEBAR_SECTION_MAX_HEIGHT },
      }
    : {};

  return (
    <Wrapper {...wrapperProps}>
      <View className="gap-3">
        {groups.map((group) => {
          const groupKey = `${scopeSectionId}:${group.id}`;
          const visibleCount =
            visibleGroupCounts[groupKey] ?? SIDEBAR_SCOPE_GROUP_INITIAL_LIMIT;
          const visibleRows = group.rows.slice(0, visibleCount);
          const remainingCount = Math.max(0, group.rows.length - visibleRows.length);

          return (
            <View key={group.id} className="gap-2">
              <Text
                className={joinClasses(
                  uiDensity === 'large'
                    ? 'text-[11px] font-semibold uppercase tracking-[1.8px]'
                    : 'text-[10px] font-semibold uppercase tracking-[1.6px]',
                  themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600'
                )}
              >
                {group.title}
              </Text>
              <View className="gap-2">
                {visibleRows.map((row, rowIndex) => {
                  const scope = scopeSummaryById.get(row.scopeId);

                  if (!scope) {
                    return null;
                  }

                  const isInMainTree = mainVisibleScopePacketIds.includes(
                    scope.packetId
                  );
                  const menuKey = `${scopeSectionId}:${group.id}:${row.scopeId}`;

                  return (
                    <NexusScopeListRow
                      key={scope.id}
                      activeScopeId={activeScopeId}
                      depth={scopeSectionId === 'home' ? row.projectedDepth : 0}
                      isMenuOpen={openMenuKey === menuKey}
                      menuButton={
                        <NexusScopeActionMenu
                          align={
                            groups.length > 1 || visibleRows.length > 1
                              ? rowIndex >= visibleRows.length - 2
                                ? 'bottom'
                                : 'top'
                              : 'bottom'
                          }
                          isInMainTree={isInMainTree}
                          isOpen={openMenuKey === menuKey}
                          onAssociatePress={() => {
                            setOpenMenuKey(null);
                            onScopeAssociatePress(scope.id, !scope.isAssociated);
                          }}
                          onFollowPress={() => {
                            setOpenMenuKey(null);
                            onScopeFollowPress(scope.id, !scope.isFollowed);
                          }}
                          onMainTreePress={() => {
                            setOpenMenuKey(null);
                            onScopeMainVisiblePress(scope.id, !isInMainTree);
                          }}
                          onOpenInExplorerPress={() => {
                            setOpenMenuKey(null);
                            onOpenInExplorerPress(scope);
                          }}
                          onOpenPress={() => {
                            setOpenMenuKey(null);
                            onScopePress(scope.id);
                          }}
                          onToggle={() =>
                            setOpenMenuKey(
                              openMenuKey === menuKey ? null : menuKey
                            )
                          }
                          scope={scope}
                          themeMode={themeMode}
                          uiDensity={uiDensity}
                        />
                      }
                      onPress={() => {
                        setOpenMenuKey(null);
                        onScopePress(scope.id);
                      }}
                      parentChainPath={row.parentChainPath}
                      scope={scope}
                      showParentChain={showParentChains}
                      themeMode={themeMode}
                      uiDensity={uiDensity}
                    />
                  );
                })}
              </View>
              {remainingCount > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  className="self-start"
                  onPress={() =>
                    setVisibleGroupCounts((currentValue) => ({
                      ...currentValue,
                      [groupKey]: visibleCount + SIDEBAR_SCOPE_LIST_LIMIT,
                    }))
                  }
                >
                  <Text
                    className={joinClasses(
                      uiDensity === 'large' ? 'text-sm font-semibold' : 'text-xs font-semibold',
                      themeMode === 'dark' ? 'text-nexus-sky' : 'text-sky-600'
                    )}
                  >
                    Show more ({remainingCount})
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </Wrapper>
  );
}

export function NexusScopeMenuContent({
  activeScopeId,
  associatedGraph,
  discoverableSection,
  followedGraph,
  homeGraph,
  mainGraph,
  scopeSummaries,
  mainVisibleScopePacketIds,
  themeMode,
  uiDensity,
  onOpenInExplorerPress,
  onScopeAssociatePress,
  onScopePress,
  onScopeFollowPress,
  onScopeMainVisiblePress,
  onSetSectionParentChains,
}: NexusScopeMenuContentProps) {
  const [sectionVisibility, setSectionVisibility] = useState<NexusScopeSectionVisibilityState>({
    home: true,
    associated: true,
    followed: true,
    main: true,
    discoverable: false,
  });
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const scopeSummaryById = useMemo(
    () => new Map(scopeSummaries.map((scopeSummary) => [scopeSummary.id, scopeSummary])),
    [scopeSummaries]
  );
  const projectedSections = [
    mainGraph,
    homeGraph,
    associatedGraph,
    followedGraph,
    discoverableSection,
  ];

  return (
    <View className="relative gap-4">
      {openMenuKey ? (
        <Pressable
          accessibilityLabel="Close scope actions"
          accessibilityRole="button"
          className="absolute inset-0 z-40"
          onPress={() => setOpenMenuKey(null)}
        />
      ) : null}
      {projectedSections.map((section) => {
        const sectionId = section.id;
        const supportsParentToggle =
          sectionId === 'associated' || sectionId === 'followed';

        return (
          <View key={section.id} className="gap-2">
            <NexusScopeSectionHeader
              count={section.count}
              isOpen={sectionVisibility[sectionId]}
              onPress={() => {
                setOpenMenuKey(null);
                setSectionVisibility((currentValue) => ({
                  ...currentValue,
                  [sectionId]: !currentValue[sectionId],
                }));
              }}
              themeMode={themeMode}
              title={section.title}
              uiDensity={uiDensity}
            />
            {supportsParentToggle ? (
              <Pressable
                accessibilityRole="button"
                className="self-start"
                onPress={() => {
                  setOpenMenuKey(null);
                  onSetSectionParentChains(
                    sectionId,
                    !section.showParentChains
                  );
                }}
              >
                <Text
                  className={joinClasses(
                    uiDensity === 'large'
                      ? 'text-[11px] font-semibold uppercase tracking-[1.8px]'
                      : 'text-[10px] font-semibold uppercase tracking-[1.6px]',
                    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600'
                  )}
                >
                  {section.showParentChains
                    ? 'Hide parent context'
                    : 'Show parent context'}
                </Text>
              </Pressable>
            ) : null}
            {sectionVisibility[sectionId] && section.groups.length > 0 ? (
              <NexusGroupedScopeRows
                activeScopeId={activeScopeId}
                groups={section.groups}
                mainVisibleScopePacketIds={mainVisibleScopePacketIds}
                onOpenInExplorerPress={onOpenInExplorerPress}
                onScopeAssociatePress={onScopeAssociatePress}
                onScopeFollowPress={onScopeFollowPress}
                onScopeMainVisiblePress={onScopeMainVisiblePress}
                onScopePress={onScopePress}
                openMenuKey={openMenuKey}
                scopeSectionId={section.id}
                scopeSummaryById={scopeSummaryById}
                setOpenMenuKey={setOpenMenuKey}
                showParentChains={section.showParentChains}
                themeMode={themeMode}
                uiDensity={uiDensity}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
