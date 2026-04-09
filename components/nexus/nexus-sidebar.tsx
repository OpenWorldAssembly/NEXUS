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
  nexusComingSoonSurfaces,
  nexusGuestProfile,
} from '@/data/nexus/mock-nexus-data';
import {
  NEXUS_SECTION_LABELS,
  NEXUS_SECTION_ORDER,
  buildNexusBranchNodes,
  getNexusAncestorIds,
  type NexusScopeBranchNode,
  type NexusScopeSummary,
  type NexusSection,
} from '@/lib/nexus/nexus-shell';

type NexusSidebarProps = {
  isDesktop: boolean;
  onRequestClose: () => void;
};

type NexusPrimaryNavItemProps = {
  title: string;
  detail: string;
  isActive: boolean;
  onPress: () => void;
};

type NexusRailToggleProps = {
  direction: '<' | '>';
  onPress: () => void;
};

type NexusCurrentContextCardProps = {
  scopeName: string;
  scopePath: string;
  scopeDescription: string;
  scopeBadge: string;
  lobbyLabel: string;
};

type NexusScopeMenuRowProps = {
  depth: number;
  isActive: boolean;
  isLineage: boolean;
  scopeMeta: string;
  scopeName: string;
  onPress: () => void;
};

type NexusFunctionMenuContentProps = {
  activeScope: NexusScopeSummary;
  activeSection: NexusSection;
  showScopedLabel: boolean;
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
  onScopePress: (scopeId: string) => void;
};

/**
 * Inputs: rail toggle direction and press callback.
 * Output: an edge-mounted collapse or expand button for a nexus rail.
 */
function NexusRailToggle({ direction, onPress }: NexusRailToggleProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className="absolute right-[-14px] top-1/2 z-10 h-10 w-10 -translate-y-5 items-center justify-center rounded-full border border-nexus-line bg-nexus-ink"
      onPress={onPress}
    >
      <Text className="text-sm font-semibold text-nexus-text">{direction}</Text>
    </Pressable>
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
}: NexusCurrentContextCardProps) {
  return (
    <NexusCard className="gap-2 bg-white/5 p-4">
      <Text className="text-xs font-semibold uppercase tracking-[2px] text-nexus-muted">
        Current context
      </Text>
      <Text className="text-lg font-semibold text-nexus-text">{scopeName}</Text>
      <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-nexus-sky">
        {scopePath}
      </Text>
      <Text className="text-sm leading-6 text-nexus-muted">
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
function NexusMenuSectionLabel({ label }: { label: string }) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-[2px] text-nexus-muted">
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
  onPress,
}: NexusPrimaryNavItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`rounded-[24px] border px-4 py-4 ${
        isActive
          ? 'border-nexus-sky bg-nexus-sky/10'
          : 'border-nexus-line bg-white/5'
      }`}
      onPress={onPress}
    >
      <Text className="text-base font-semibold text-nexus-text">{title}</Text>
      <Text className="mt-1 text-sm leading-6 text-nexus-muted">{detail}</Text>
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
        className={`flex-1 rounded-[18px] border px-3 py-3 ${
          isActive
            ? 'border-nexus-sky bg-nexus-sky/10'
            : 'border-nexus-line bg-white/5'
        }`}
        onPress={onPress}
      >
        <Text
          className="text-sm font-semibold leading-5 text-nexus-text"
          numberOfLines={2}
        >
          {scopeName}
        </Text>
        <Text
          className="mt-1 text-[10px] font-semibold uppercase tracking-[1.6px] text-nexus-muted"
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
  onSectionPress,
}: NexusFunctionMenuContentProps) {
  return (
    <>
      {showScopedLabel ? (
        <NexusMenuSectionLabel label="Functions for this scope" />
      ) : null}

      <View className="gap-3">
        {NEXUS_SECTION_ORDER.map((section) => (
          <NexusPrimaryNavItem
            key={section}
            detail={`${NEXUS_SECTION_LABELS[section]} across ${activeScope.shortLabel}.`}
            isActive={activeSection === section}
            onPress={() => onSectionPress(section)}
            title={NEXUS_SECTION_LABELS[section]}
          />
        ))}
      </View>

      <View className="gap-2 pt-2">
        <NexusMenuSectionLabel label="Deferred surfaces" />
        <View className="flex-row flex-wrap gap-2">
          {nexusComingSoonSurfaces.map((surface) => (
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
        />
      ) : null}

      <View className="gap-2">
        <NexusMenuSectionLabel label="Scope map" />
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
              />
            );
          })}
        </View>
      </View>

      <View className="gap-2 pt-2">
        <NexusMenuSectionLabel label="Followed scopes" />
        <View className="flex-row flex-wrap gap-2">
          {followedScopes.map((scope) => (
            <Pressable
              key={scope.id}
              accessibilityRole="button"
              className={`rounded-full border px-3 py-2 ${
                scope.id === activeScopeId
                  ? 'border-nexus-mint bg-nexus-mint/10'
                  : 'border-nexus-line bg-white/5'
              }`}
              onPress={() => onScopePress(scope.id)}
            >
              <Text className="text-sm font-semibold text-nexus-text">
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
    isPrimaryRailCollapsed,
    isSecondaryRailCollapsed,
    setActiveScopeId,
    setActiveSection,
    setNavigationMode,
    togglePrimaryRailCollapsed,
    toggleSecondaryRailCollapsed,
  } = useNexusShell();

  const isFunctionMode = navigationMode === 'function';
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

  /**
   * Inputs: none.
   * Output: toggles the nexus preference between function-first and scope-first.
   */
  const handleModeToggle = () => {
    setNavigationMode(isFunctionMode ? 'scope' : 'function');
  };

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
    <View className="flex-1 flex-row bg-nexus-ink">
      {!isPrimaryRailCollapsed ? (
        <View className="relative w-[264px] border-r border-nexus-line bg-nexus-ink">
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-4 px-4 py-5"
            showsVerticalScrollIndicator={false}
          >
            <NexusCard className="gap-3 p-4">
              <Pressable
                accessibilityRole="button"
                className="self-start rounded-full border border-nexus-line bg-white/5 px-3 py-2"
                onPress={() => router.push('/' as Href)}
              >
                <Text className="text-xs font-semibold uppercase tracking-[2px] text-nexus-text">
                  Back to Home
                </Text>
              </Pressable>

              <Text className="text-xs font-semibold uppercase tracking-[4px] text-nexus-sky">
                OWA Nexus Nexus
              </Text>
              <Text className="text-xl font-bold text-nexus-text">
                {nexusGuestProfile.displayName}
              </Text>

              <View className="gap-2">
                <Text className="text-[11px] font-semibold uppercase tracking-[2px] text-nexus-muted">
                  Navigation preference
                </Text>
                <Text className="text-sm font-semibold text-nexus-text">
                  {isFunctionMode ? 'Prioritizing functions' : 'Prioritizing scopes'}
                </Text>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: !isFunctionMode }}
                  className={`w-[72px] rounded-full border p-1 ${
                    isFunctionMode
                      ? 'border-nexus-line bg-white/5'
                      : 'border-nexus-sky bg-nexus-sky/10'
                  }`}
                  onPress={handleModeToggle}
                >
                  <View
                    className={`h-6 w-6 rounded-full ${
                      isFunctionMode ? 'bg-nexus-text' : 'bg-nexus-sky'
                    } ${isFunctionMode ? 'self-start' : 'self-end'}`}
                  />
                </Pressable>
              </View>

              <View className="flex-row gap-2">
                <Pressable
                  accessibilityRole="button"
                  className="rounded-full border border-nexus-line bg-white/5 px-3 py-2"
                  onPress={() => router.push('/login')}
                >
                  <Text className="text-sm font-semibold text-nexus-text">
                    Sign In
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  className="rounded-full border border-nexus-sky bg-nexus-sky px-3 py-2"
                  onPress={() => router.push('/signup')}
                >
                  <Text className="text-sm font-semibold text-nexus-canvas">
                    Sign Up
                  </Text>
                </Pressable>
              </View>
            </NexusCard>

            <NexusCard className="gap-3 p-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                {primaryTitle}
              </Text>
              <Text className="text-sm leading-6 text-nexus-muted">
                {primaryDescription}
              </Text>

              <View className="gap-3">
                {isFunctionMode ? (
                  <NexusFunctionMenuContent
                    activeScope={activeScope}
                    activeSection={activeSection}
                    onSectionPress={handleSectionPress}
                    showScopedLabel={false}
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
                  />
                )}
              </View>
            </NexusCard>
          </ScrollView>

          <NexusRailToggle direction="<" onPress={togglePrimaryRailCollapsed} />
        </View>
      ) : (
        <View className="relative w-[28px] border-r border-nexus-line bg-nexus-ink">
          <NexusRailToggle direction=">" onPress={togglePrimaryRailCollapsed} />
        </View>
      )}

      {!isSecondaryRailCollapsed ? (
        <View className="relative min-w-[400px] flex-1 bg-nexus-panel">
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-4 px-4 py-5"
            showsVerticalScrollIndicator={false}
          >
            <NexusCard className="gap-4 p-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                {secondaryTitle}
              </Text>
              <Text className="text-sm leading-6 text-nexus-muted">
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
                  />
                ) : (
                  <NexusFunctionMenuContent
                    activeScope={activeScope}
                    activeSection={activeSection}
                    onSectionPress={handleSectionPress}
                    showScopedLabel={true}
                  />
                )}
              </View>
            </NexusCard>
          </ScrollView>

          <NexusRailToggle
            direction="<"
            onPress={toggleSecondaryRailCollapsed}
          />
        </View>
      ) : null}

      {isSecondaryRailCollapsed ? (
        <View className="relative w-[28px] border-r border-nexus-line bg-nexus-panel">
          <NexusRailToggle
            direction=">"
            onPress={toggleSecondaryRailCollapsed}
          />
        </View>
      ) : null}
    </View>
  );
}
