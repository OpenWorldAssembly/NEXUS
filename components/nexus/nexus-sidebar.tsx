/**
 * File: nexus-sidebar.tsx
 * Description: Renders the left-side nexus rails with collapsible primary and secondary navigation panels.
 */
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useNexusShell } from '@/components/nexus/nexus-shell-context';
import { NexusBadge, NexusCard } from '@/components/nexus/nexus-ui';
import {
  NEXUS_COMING_SOON_SURFACES,
  NEXUS_GUEST_PROFILE,
} from '@/lib/nexus/nexus-content';
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
} from '@/lib/nexus/nexus-shell';

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
  scopeName: string;
  scopePath: string;
  scopeDescription: string;
  scopeBadge: string;
  lobbyLabel: string;
  themeMode: NexusThemeMode;
  uiDensity: NexusUiDensity;
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
  activeScope: NexusScopeSummary;
  activeScopeId: string;
  currentScopePath: string;
  followedScopes: NexusScopeSummary[];
  showCurrentContext: boolean;
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
  scopeName,
  scopePath,
  scopeDescription,
  scopeBadge,
  lobbyLabel,
  themeMode,
  uiDensity,
}: NexusCurrentContextCardProps) {
  return (
    <NexusCard
      className={joinClasses(
        'gap-2',
        themeMode === 'dark'
          ? 'bg-white/5'
          : 'border-slate-300 bg-slate-50',
        uiDensity === 'large' ? 'p-5' : 'p-4',
      )}
    >
      <Text
        className={joinClasses(
          'text-xs font-semibold uppercase tracking-[2px]',
          themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600',
        )}
      >
        Current context
      </Text>
      <Text
        className={joinClasses(
          uiDensity === 'large' ? 'text-xl font-semibold' : 'text-lg font-semibold',
          themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900',
        )}
      >
        {scopeName}
      </Text>
      <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-nexus-sky">
        {scopePath}
      </Text>
      <Text
        className={joinClasses(
          uiDensity === 'large' ? 'text-base leading-7' : 'text-sm leading-6',
          themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600',
        )}
      >
        {scopeDescription}
      </Text>
      <View className="items-start gap-2">
        <NexusBadge
          className="max-w-full self-start rounded-[18px]"
          label={scopeBadge}
          textClassName="leading-4"
          tone="sky"
        />
        <NexusBadge
          className="max-w-full self-start rounded-[18px]"
          label={lobbyLabel}
          textClassName="leading-4"
          tone="mint"
        />
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
  activeScope,
  activeScopeId,
  currentScopePath,
  followedScopes,
  showCurrentContext,
  scopeMenuNodes,
  scopeSummaries,
  themeMode,
  uiDensity,
  onScopePress,
}: NexusScopeMenuContentProps) {
  return (
    <>
      {showCurrentContext ? (
        <NexusCurrentContextCard
          lobbyLabel={activeScope.publicLobbyLabel}
          scopeBadge={activeScope.badge}
          scopeDescription={activeScope.description}
          scopeName={activeScope.name}
          scopePath={currentScopePath}
          themeMode={themeMode}
          uiDensity={uiDensity}
        />
      ) : null}

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
  const showCurrentContextInPrimary =
    !isFunctionMode && !isPrimaryRailCollapsed;
  const showCurrentContextInSecondary =
    isFunctionMode || (!isFunctionMode && isPrimaryRailCollapsed);
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
                  {NEXUS_GUEST_PROFILE.displayName}
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
                  onPress={() => router.push('/login')}
                >
                  <Text
                    className={joinClasses(
                      isLargeUi
                        ? 'text-base font-semibold'
                        : 'text-sm font-semibold',
                      titleTextClass,
                    )}
                  >
                    Sign In
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
                  onPress={() => router.push('/signup')}
                >
                  <Text
                    className={joinClasses(
                      isLargeUi
                        ? 'text-base font-semibold'
                        : 'text-sm font-semibold',
                      'text-nexus-canvas',
                    )}
                  >
                    Sign Up
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

              {isPreferencesDrawerOpen ? (
                <View
                  className={joinClasses(
                    'items-center gap-3 rounded-[22px] border',
                    isLargeUi ? 'px-4 py-4' : 'px-3 py-3',
                    themeMode === 'dark'
                      ? 'border-nexus-line bg-white/5'
                      : 'border-slate-300 bg-slate-50',
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
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                className={joinClasses(
                  'flex-row items-center justify-between rounded-full border',
                  isLargeUi ? 'px-4 py-3' : 'px-3 py-2.5',
                  themeMode === 'dark'
                    ? 'border-nexus-line bg-white/5'
                    : 'border-slate-300 bg-slate-100',
                )}
                onPress={togglePreferencesDrawer}
              >
                <Text
                  className={joinClasses(
                    isLargeUi
                      ? 'text-sm font-semibold uppercase tracking-[2px]'
                      : 'text-xs font-semibold uppercase tracking-[2px]',
                    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600',
                  )}
                >
                  Preferences
                </Text>
                <Text
                  className={joinClasses(
                    isLargeUi
                      ? 'text-sm font-semibold uppercase tracking-[2px]'
                      : 'text-xs font-semibold uppercase tracking-[2px]',
                    titleTextClass,
                  )}
                >
                  {isPreferencesDrawerOpen ? 'Hide ^' : 'Open v'}
                </Text>
              </Pressable>
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
                    activeScope={activeScope}
                    activeScopeId={activeScopeId}
                    currentScopePath={currentScopePath}
                    followedScopes={followedScopes}
                    scopeMenuNodes={scopeMenuNodes}
                    scopeSummaries={scopeSummaries}
                    onScopePress={handleScopePress}
                    showCurrentContext={showCurrentContextInPrimary}
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
                    activeScope={activeScope}
                    activeScopeId={activeScopeId}
                    currentScopePath={currentScopePath}
                    followedScopes={followedScopes}
                    scopeMenuNodes={scopeMenuNodes}
                    scopeSummaries={scopeSummaries}
                    onScopePress={handleScopePress}
                    showCurrentContext={showCurrentContextInSecondary}
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
