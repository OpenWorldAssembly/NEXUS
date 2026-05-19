/**
 * File: nexus-sidebar.tsx
 * Description: Renders the left-side nexus rails with collapsible primary and secondary navigation panels.
 */
import { usePathname, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useNexusAuthGate } from '@app/components/nexus/nexus-auth-gate';
import {
  NexusCard,
  NexusCardMenuButton,
  NexusChevronIcon,
  NexusSegmentedPill,
  NexusThemedBevelEdges,
  getNexusChromeClasses,
} from '@app/components/nexus/nexus-ui';
import type { NexusSecurityMode } from '@runtime/nexus/nexus-api-types';
import {
  NEXUS_SECTION_ORDER,
  getNexusSectionMenuDetail,
  getNexusSectionMenuTitle,
  getNexusRailWidth,
  getNexusAncestorIds,
  isNexusGeographicTreeScope,
  NEXUS_COLLAPSED_RAIL_WIDTH,
  type NexusProjectedScopeGroup,
  type NexusProjectedScopeSection,
  type NexusSidebarScopeSectionId,
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

const SIDEBAR_SCOPE_LIST_LIMIT = 10;
const SIDEBAR_SCOPE_GROUP_INITIAL_LIMIT = 8;
const SIDEBAR_SECTION_MAX_HEIGHT = 280;

/**
 * Inputs: any number of class names.
 * Output: a single space-delimited class name string.
 */
function joinClasses(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function getWriteApprovalSuccessMessage(securityMode: NexusSecurityMode): string {
  switch (securityMode) {
    case 'every_write':
      return 'Every write now requires fresh approval.';
    case 'guarded':
      return 'Guarded write approval is active.';
    case 'standard':
    default:
      return 'Standard write approval is active.';
  }
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

/**
 * Inputs: a possibly missing scope summary from a lookup.
 * Output: whether the lookup resolved to a real scope summary.
 */
function isNexusScopeSummary(
  scope: NexusScopeSummary | undefined,
): scope is NexusScopeSummary {
  return Boolean(scope);
}

function isMainTreeEligibleScope(scope: NexusScopeSummary): boolean {
  return (
    scope.isAssociated ||
    scope.isFollowed ||
    isNexusGeographicTreeScope(scope)
  );
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

/**
 * Inputs: active function state and the active scope lens.
 * Output: the function menu content for either the primary or secondary rail.
 */
function NexusFunctionMenuContent({
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

function NexusScopeSectionHeader({
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

function NexusScopeActionMenu({
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
            'absolute right-0 z-50 min-w-[180px] gap-1 overflow-hidden rounded-2xl border p-2 shadow-lg',
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

function NexusScopeListRow({
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
  return (
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
}

function NexusGroupedScopeRows({
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

/**
 * Inputs: active scope state, related scope lists, and click handlers.
 * Output: the packet-native grouped scope menu with compact home, associated, followed, and discoverable sections.
 */
function NexusScopeMenuContent({
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

/**
 * Inputs: sidebar container mode and a close callback for narrow screens.
 * Output: the left-side nexus navigation split into collapsible primary and secondary rails.
 */
export default function NexusSidebar({
  isDesktop,
  onRequestClose,
}: NexusSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    activeScope,
    activeScopeId,
    activeSection,
    associatedGraph,
    currentActorLabel,
    currentIdentityMode,
    discoverableSection,
    followedGraph,
    homeGraph,
    mainGraph,
    mainVisibleScopePacketIds,
    navigationMode,
    scopeSummaries,
    themeMode,
    uiDensity,
    isPreferencesDrawerOpen,
    isPrimaryRailCollapsed,
    isSecondaryRailCollapsed,
    setActiveScopeId,
    setActiveSection,
    setScopeAssociated,
    setScopeFollowed,
    setScopeMainVisible,
    setScopeSectionParentChains,
    setNavigationMode,
    setThemeMode,
    setUiDensity,
    togglePreferencesDrawer,
    togglePrimaryRailCollapsed,
    toggleSecondaryRailCollapsed,
    openPacketInExplorer,
  } = useNexusShell();
  const {
    currentStorageMode,
    isAuthenticated,
    isCurrentIdentityUnlocked,
    rememberClaimedSessions,
    securityMode,
    setRememberClaimedSessions,
    setSecurityMode,
  } = useIdentityShell();
  const { authGateModal, openNexusAuthGate, openNexusAuthGateForError } =
    useNexusAuthGate({
      returnTo: pathname || '/nexus',
      returnScopeId: activeScopeId,
    });
  const [preferenceStatusMessage, setPreferenceStatusMessage] = useState<string | null>(
    null
  );
  const [preferenceErrorMessage, setPreferenceErrorMessage] = useState<string | null>(
    null
  );
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
  const isGraphSurface = NEXUS_SECTION_ORDER.some(
    (section) => pathname === `/nexus/${section}` || pathname.startsWith(`/nexus/${section}/`)
  );
  const visualActiveScopeId = isGraphSurface ? activeScopeId : '';
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
  const branchPathScopes = [
    ...getNexusAncestorIds(scopeSummaries, activeScope.id)
      .map((scopeId) => scopeSummaries.find((scope) => scope.id === scopeId))
      .filter(isNexusScopeSummary),
    activeScope,
  ] as NexusScopeSummary[];
  const currentScopePath = branchPathScopes
    .map((scope) => scope.shortLabel)
    .join(' / ');
  const chrome = getNexusChromeClasses(themeMode, uiDensity);
  const railBorderClass =
    themeMode === 'dark' ? 'border-nexus-line' : 'border-slate-300';
  const primaryRailClass =
    themeMode === 'dark' ? 'bg-nexus-ink' : 'bg-slate-100';
  const secondaryRailClass =
    themeMode === 'dark' ? 'bg-nexus-panel' : 'bg-slate-50';
  const profileCardClass = chrome.panelCardClass;
  const panelCardClass = chrome.panelCardClass;
  const titleTextClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const mutedTextClass =
    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600';
  const homeButtonClass = chrome.navItemClass;
  const signInButtonClass = chrome.topToggleButtonClass;
  const signUpButtonClass = chrome.topToggleButtonPrimaryClass;
  const preferencesPanelClass = chrome.preferencePanelClass;
  const preferencesButtonClass = chrome.preferenceButtonClass;
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

  const handleScopeFollowPress = async (scopeId: string, isFollowed: boolean) => {
    const runScopeFollow = async () => {
      try {
        await setScopeFollowed(scopeId, isFollowed);
      } catch (error: unknown) {
        if (openNexusAuthGateForError(error, runScopeFollow)) {
          return;
        }

        throw error;
      }
    };

    await runScopeFollow();
  };

  const handleScopeAssociatePress = async (
    scopeId: string,
    isAssociated: boolean
  ) => {
    const runScopeAssociation = async () => {
      try {
        await setScopeAssociated(scopeId, isAssociated);
      } catch (error: unknown) {
        if (openNexusAuthGateForError(error, runScopeAssociation)) {
          return;
        }

        throw error;
      }
    };

    await runScopeAssociation();
  };

  const handleScopeMainVisiblePress = async (
    scopeId: string,
    isMainVisible: boolean
  ) => {
    const runScopeMainVisibility = async () => {
      try {
        await setScopeMainVisible(scopeId, isMainVisible);
      } catch (error: unknown) {
        if (openNexusAuthGateForError(error, runScopeMainVisibility)) {
          return;
        }

        throw error;
      }
    };

    await runScopeMainVisibility();
  };

  const handleOpenScopeInExplorer = (scope: NexusScopeSummary) => {
    openPacketInExplorer({
      packetId: scope.packetId,
      titleSnapshot: scope.name,
      seedSummary: {
        family: 'Element',
        summary: scope.description,
        label: scope.shortLabel,
      },
    });
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
              <Pressable
                accessibilityRole="link"
                className={joinClasses(
                  'self-center px-2 py-1',
                )}
                onPress={() => router.push('/')}
              >
                <Text className="text-center text-xs font-semibold uppercase tracking-[4px] text-nexus-sky">
                  Open World Assembly
                </Text>
              </Pressable>
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
                  className={joinClasses(signInButtonClass)}
                  onPress={() =>
                    router.push(
                      hasActiveClaimedSession
                        ? '/nexus/account'
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
                    {hasActiveClaimedSession ? 'Account' : 'Sign In'}
                  </Text>
                  <NexusThemedBevelEdges themeMode={themeMode} subtle />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  className={joinClasses(signUpButtonClass)}
                  onPress={() =>
                    router.push(
                      hasActiveClaimedSession
                        ? '/nexus/identity/sign-in'
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
                    {hasActiveClaimedSession ? 'Switch' : 'Claim'}
                  </Text>
                  <NexusThemedBevelEdges themeMode={themeMode} subtle />
                </Pressable>
              </View>

              {hasActiveClaimedSession && !isCurrentIdentityUnlocked ? (
                <Pressable
                  accessibilityRole="button"
                  className={joinClasses(
                    'items-center',
                    homeButtonClass,
                    isLargeUi ? 'px-4 py-3' : 'px-3 py-2.5',
                  )}
                  onPress={() => openNexusAuthGate('unlock_required')}
                >
                  <Text
                    className={joinClasses(
                      isLargeUi
                        ? 'text-sm font-semibold uppercase tracking-[2px]'
                        : 'text-xs font-semibold uppercase tracking-[2px]',
                      titleTextClass,
                    )}
                  >
                    Unlock Identity
                  </Text>
                  <NexusThemedBevelEdges themeMode={themeMode} subtle />
                </Pressable>
              ) : null}

              <View
                className={joinClasses(
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
                          setPreferenceStatusMessage(null);
                          setPreferenceErrorMessage(null);
                          void setRememberClaimedSessions(value === 'save').catch(
                            (error: unknown) => {
                              setPreferenceErrorMessage(
                                error instanceof Error
                                  ? error.message
                                  : 'Unable to update session preferences.'
                              );
                            }
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
                          setPreferenceStatusMessage(null);
                          setPreferenceErrorMessage(null);
                          const nextMode = value as NexusSecurityMode;

                          if (nextMode === (securityMode ?? 'guarded')) {
                            return;
                          }

                          const applySecurityModeChange = async () => {
                            try {
                              await setSecurityMode(nextMode);
                              setPreferenceStatusMessage(
                                getWriteApprovalSuccessMessage(nextMode)
                              );
                            } catch (error: unknown) {
                              if (
                                openNexusAuthGateForError(
                                  error,
                                  applySecurityModeChange
                                )
                              ) {
                                return;
                              }

                              setPreferenceErrorMessage(
                                error instanceof Error
                                  ? error.message
                                  : 'Unable to update write approval.'
                              );
                            }
                          };
                          void applySecurityModeChange();
                        }}
                        disabled={!hasActiveClaimedSession}
                      />
                      {preferenceStatusMessage ? (
                        <Text
                          className={joinClasses(
                            isLargeUi ? 'text-xs' : 'text-[11px]',
                            themeMode === 'dark'
                              ? 'text-nexus-mint'
                              : 'text-emerald-700',
                          )}
                        >
                          {preferenceStatusMessage}
                        </Text>
                      ) : null}
                      {preferenceErrorMessage ? (
                        <Text
                          className={joinClasses(
                            isLargeUi ? 'text-xs' : 'text-[11px]',
                            'text-nexus-rose',
                          )}
                        >
                          {preferenceErrorMessage}
                        </Text>
                      ) : null}
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
                  />
                </Pressable>
                <NexusThemedBevelEdges themeMode={themeMode} subtle />
              </View>
            </NexusCard>

            <NexusCard
              className={joinClasses(
                'gap-3 overflow-visible',
                panelCardClass,
                isLargeUi ? 'p-5' : 'p-4',
              )}
            >
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                {primaryTitle}
              </Text>
              {isFunctionMode ? (
                <Text
                  className={joinClasses(
                    isLargeUi ? 'text-base leading-7' : 'text-sm leading-6',
                    mutedTextClass,
                  )}
                >
                  {primaryDescription}
                </Text>
              ) : null}

              <View className="gap-3">
                {isFunctionMode ? (
                  <NexusFunctionMenuContent
                    activeScope={activeScope}
                    activeSection={activeSection}
                    onSectionPress={handleSectionPress}
                    showActiveSelection={isGraphSurface}
                    showScopedLabel={false}
                    themeMode={themeMode}
                    uiDensity={uiDensity}
                  />
                ) : (
                  <NexusScopeMenuContent
                    activeScopeId={visualActiveScopeId}
                    associatedGraph={associatedGraph}
                    discoverableSection={discoverableSection}
                    followedGraph={followedGraph}
                    homeGraph={homeGraph}
                    mainGraph={mainGraph}
                    scopeSummaries={scopeSummaries}
                    mainVisibleScopePacketIds={mainVisibleScopePacketIds}
                    onOpenInExplorerPress={handleOpenScopeInExplorer}
                    onSetSectionParentChains={(sectionId, showParentChains) => {
                      void setScopeSectionParentChains(
                        sectionId,
                        showParentChains
                      ).catch(() => undefined);
                    }}
                    onScopeAssociatePress={(scopeId, isAssociated) => {
                      void handleScopeAssociatePress(scopeId, isAssociated).catch(
                        () => undefined
                      );
                    }}
                    onScopePress={handleScopePress}
                    onScopeFollowPress={(scopeId, isFollowed) => {
                      void handleScopeFollowPress(scopeId, isFollowed).catch(
                        () => undefined
                      );
                    }}
                    onScopeMainVisiblePress={(scopeId, isMainVisible) => {
                      void handleScopeMainVisiblePress(
                        scopeId,
                        isMainVisible
                      ).catch(() => undefined);
                    }}
                    themeMode={themeMode}
                    uiDensity={uiDensity}
                  />
                )}
              </View>
            </NexusCard>
          </ScrollView>

          <NexusRailToggle
            direction="left"
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
            direction="right"
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
                'gap-4 overflow-visible',
                panelCardClass,
                isLargeUi ? 'p-5' : 'p-4',
              )}
            >
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                {secondaryTitle}
              </Text>
              {!isFunctionMode ? (
                <Text
                  className={joinClasses(
                    isLargeUi ? 'text-base leading-7' : 'text-sm leading-6',
                    mutedTextClass,
                  )}
                >
                  {secondaryDescription}
                </Text>
              ) : null}

              <View className="gap-3">
                {isFunctionMode ? (
                  <NexusScopeMenuContent
                    activeScopeId={visualActiveScopeId}
                    associatedGraph={associatedGraph}
                    discoverableSection={discoverableSection}
                    followedGraph={followedGraph}
                    homeGraph={homeGraph}
                    mainGraph={mainGraph}
                    scopeSummaries={scopeSummaries}
                    mainVisibleScopePacketIds={mainVisibleScopePacketIds}
                    onOpenInExplorerPress={handleOpenScopeInExplorer}
                    onSetSectionParentChains={(sectionId, showParentChains) => {
                      void setScopeSectionParentChains(
                        sectionId,
                        showParentChains
                      ).catch(() => undefined);
                    }}
                    onScopeAssociatePress={(scopeId, isAssociated) => {
                      void handleScopeAssociatePress(scopeId, isAssociated).catch(
                        () => undefined
                      );
                    }}
                    onScopePress={handleScopePress}
                    onScopeFollowPress={(scopeId, isFollowed) => {
                      void handleScopeFollowPress(scopeId, isFollowed).catch(
                        () => undefined
                      );
                    }}
                    onScopeMainVisiblePress={(scopeId, isMainVisible) => {
                      void handleScopeMainVisiblePress(
                        scopeId,
                        isMainVisible
                      ).catch(() => undefined);
                    }}
                    themeMode={themeMode}
                    uiDensity={uiDensity}
                  />
                ) : (
                  <NexusFunctionMenuContent
                    activeScope={activeScope}
                    activeSection={activeSection}
                    onSectionPress={handleSectionPress}
                    showActiveSelection={isGraphSurface}
                    showScopedLabel={true}
                    themeMode={themeMode}
                    uiDensity={uiDensity}
                  />
                )}
              </View>
            </NexusCard>
          </ScrollView>

          <NexusRailToggle
            direction="left"
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
            direction="right"
            onPress={toggleSecondaryRailCollapsed}
            themeMode={themeMode}
            uiDensity={uiDensity}
          />
        </View>
      ) : null}
      {authGateModal}
    </View>
  );
}
