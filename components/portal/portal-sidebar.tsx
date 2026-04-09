/**
 * File: portal-sidebar.tsx
 * Description: Renders the left-side primary and secondary portal navigation columns.
 */
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { usePortalShell } from '@/components/portal/portal-shell-context';
import { PortalBadge, PortalCard } from '@/components/portal/portal-ui';
import {
  portalComingSoonSurfaces,
  portalGuestProfile,
} from '@/data/portal/mock-portal-data';
import {
  PORTAL_SECTION_LABELS,
  PORTAL_SECTION_ORDER,
  type PortalNavMode,
  type PortalScopeBranchNode,
  type PortalSection,
} from '@/lib/portal/portal-shell';

type PortalSidebarProps = {
  isDesktop: boolean;
  onRequestClose: () => void;
};

type PortalPrimaryNavItemProps = {
  title: string;
  detail: string;
  isActive: boolean;
  onPress: () => void;
};

type PortalScopeTreeItemProps = {
  node: PortalScopeBranchNode;
  isActive: boolean;
  scopeName: string;
  relationshipLabel: string;
  onPress: () => void;
  onToggle: () => void;
};

/**
 * Inputs: title/detail metadata and active/press state.
 * Output: a primary navigation row for either the function or scope preference.
 */
function PortalPrimaryNavItem({
  title,
  detail,
  isActive,
  onPress,
}: PortalPrimaryNavItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`rounded-[24px] border px-4 py-4 ${
        isActive
          ? 'border-portal-sky bg-portal-sky/10'
          : 'border-portal-line bg-white/5'
      }`}
      onPress={onPress}
    >
      <Text className="text-base font-semibold text-portal-text">{title}</Text>
      <Text className="mt-1 text-sm leading-6 text-portal-muted">{detail}</Text>
    </Pressable>
  );
}

/**
 * Inputs: branch-tree node data and current scope selection callbacks.
 * Output: a scope row for the primary scope-first tree.
 */
function PortalScopeTreeItem({
  node,
  isActive,
  scopeName,
  relationshipLabel,
  onPress,
  onToggle,
}: PortalScopeTreeItemProps) {
  return (
    <View
      className="flex-row items-center gap-2"
      style={{ paddingLeft: node.depth * 12 }}
    >
      {node.hasChildren ? (
        <Pressable
          accessibilityRole="button"
          className="h-8 w-8 items-center justify-center rounded-full border border-portal-line bg-white/5"
          onPress={onToggle}
        >
          <Text className="text-sm font-semibold text-portal-text">
            {node.isExpanded ? '-' : '+'}
          </Text>
        </Pressable>
      ) : (
        <View className="h-8 w-8" />
      )}

      <Pressable
        accessibilityRole="button"
        className={`flex-1 rounded-[20px] border px-3 py-3 ${
          isActive
            ? 'border-portal-sky bg-portal-sky/10'
            : 'border-portal-line bg-white/5'
        }`}
        onPress={onPress}
      >
        <Text className="text-sm font-semibold text-portal-text">{scopeName}</Text>
        <Text className="text-xs uppercase tracking-[2px] text-portal-muted">
          {relationshipLabel}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Inputs: sidebar container mode and a close callback for narrow screens.
 * Output: the left-side portal navigation split into primary and secondary columns.
 */
export default function PortalSidebar({
  isDesktop,
  onRequestClose,
}: PortalSidebarProps) {
  const router = useRouter();
  const {
    activeScope,
    activeScopeId,
    activeSection,
    branchNodes,
    followedScopes,
    navigationMode,
    scopeSummaries,
    setActiveScopeId,
    setActiveSection,
    setNavigationMode,
    toggleScopeExpansion,
  } = usePortalShell();

  const primaryTitle =
    navigationMode === 'function' ? 'Primary functions' : 'Primary scopes';
  const primaryDescription =
    navigationMode === 'function'
      ? 'Choose the main civic function here. The secondary panel keeps scope context available.'
      : 'Choose the branch or locality here. The secondary panel then exposes the available civic surfaces.';
  const secondaryTitle =
    navigationMode === 'function' ? 'Scope menu' : 'Function menu';
  const secondaryDescription =
    navigationMode === 'function'
      ? 'Switch branches, check followed scopes, and keep the current locality visible while moving by function.'
      : 'Move through the current scope by civic function without losing your place in the branch tree.';

  /**
   * Inputs: a portal nav mode.
   * Output: updates the portal preference between function-first and scope-first.
   */
  const handleModePress = (mode: PortalNavMode) => {
    setNavigationMode(mode);
  };

  /**
   * Inputs: a portal section key.
   * Output: navigates to the section and closes the mobile tray when needed.
   */
  const handleSectionPress = (section: PortalSection) => {
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
    <View className="flex-1 flex-row bg-portal-ink">
      <ScrollView
        className="w-[232px] border-r border-portal-line bg-portal-ink"
        contentContainerClassName="gap-4 px-4 py-5"
        showsVerticalScrollIndicator={false}
      >
        <PortalCard className="gap-3 p-4">
          <Pressable
            accessibilityRole="button"
            className="self-start rounded-full border border-portal-line bg-white/5 px-3 py-2"
            onPress={() => router.push('/')}
          >
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-portal-text">
              Back to Home
            </Text>
          </Pressable>

          <Text className="text-xs font-semibold uppercase tracking-[4px] text-portal-sky">
            OWA Nexus Portal
          </Text>
          <Text className="text-xl font-bold text-portal-text">
            {portalGuestProfile.displayName}
          </Text>

          <View className="rounded-full border border-portal-line bg-white/5 p-1">
            <View className="flex-row gap-1">
              {(['function', 'scope'] as PortalNavMode[]).map((mode) => {
                const isActive = navigationMode === mode;

                return (
                  <Pressable
                    key={mode}
                    accessibilityRole="button"
                    className={`flex-1 rounded-full px-3 py-2 ${
                      isActive ? 'bg-portal-sky' : 'bg-transparent'
                    }`}
                    onPress={() => handleModePress(mode)}
                  >
                    <Text
                      className={`text-center text-xs font-semibold uppercase tracking-[2px] ${
                        isActive ? 'text-portal-canvas' : 'text-portal-muted'
                      }`}
                    >
                      {mode === 'function' ? 'Functions' : 'Scopes'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              className="rounded-full border border-portal-line bg-white/5 px-3 py-2"
              onPress={() => router.push('/login')}
            >
              <Text className="text-sm font-semibold text-portal-text">
                Sign In
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="rounded-full border border-portal-sky bg-portal-sky px-3 py-2"
              onPress={() => router.push('/signup')}
            >
              <Text className="text-sm font-semibold text-portal-canvas">
                Sign Up
              </Text>
            </Pressable>
          </View>
        </PortalCard>

        <PortalCard className="gap-3 p-4">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
            {primaryTitle}
          </Text>
          <Text className="text-sm leading-6 text-portal-muted">
            {primaryDescription}
          </Text>

          <View className="gap-3">
            {navigationMode === 'function'
              ? PORTAL_SECTION_ORDER.map((section) => (
                  <PortalPrimaryNavItem
                    key={section}
                    detail={`${PORTAL_SECTION_LABELS[section]} across ${activeScope.shortLabel}.`}
                    isActive={activeSection === section}
                    onPress={() => handleSectionPress(section)}
                    title={PORTAL_SECTION_LABELS[section]}
                  />
                ))
              : branchNodes.map((node) => {
                  const scope = scopeSummaries.find(
                    (candidate) => candidate.id === node.scopeId,
                  );

                  if (!scope) {
                    return null;
                  }

                  return (
                    <PortalScopeTreeItem
                      key={node.scopeId}
                      isActive={node.scopeId === activeScopeId}
                      node={node}
                      onPress={() => handleScopePress(node.scopeId)}
                      onToggle={() => toggleScopeExpansion(node.scopeId)}
                      relationshipLabel={node.relationship}
                      scopeName={scope.name}
                    />
                  );
                })}
          </View>
        </PortalCard>
      </ScrollView>

      <ScrollView
        className="min-w-[320px] flex-1 bg-portal-panel"
        contentContainerClassName="gap-4 px-4 py-5"
        showsVerticalScrollIndicator={false}
      >
        <PortalCard className="gap-4 p-4">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
            {secondaryTitle}
          </Text>
          <Text className="text-sm leading-6 text-portal-muted">
            {secondaryDescription}
          </Text>

          <PortalCard className="gap-2 bg-white/5 p-4">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-portal-muted">
              Current context
            </Text>
            <Text className="text-lg font-semibold text-portal-text">
              {activeScope.name}
            </Text>
            <Text className="text-sm leading-6 text-portal-muted">
              {activeScope.description}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <PortalBadge label={activeScope.badge} tone="sky" />
              <PortalBadge label={activeScope.publicLobbyLabel} tone="mint" />
            </View>
          </PortalCard>

          <View className="gap-3">
            {navigationMode === 'function' ? (
              <>
                <Text className="text-xs font-semibold uppercase tracking-[2px] text-portal-muted">
                  Scope tree
                </Text>
                {branchNodes.map((node) => {
                  const scope = scopeSummaries.find(
                    (candidate) => candidate.id === node.scopeId,
                  );

                  if (!scope) {
                    return null;
                  }

                  return (
                    <PortalScopeTreeItem
                      key={node.scopeId}
                      isActive={node.scopeId === activeScopeId}
                      node={node}
                      onPress={() => handleScopePress(node.scopeId)}
                      onToggle={() => toggleScopeExpansion(node.scopeId)}
                      relationshipLabel={node.relationship}
                      scopeName={scope.name}
                    />
                  );
                })}
              </>
            ) : (
              <>
                <Text className="text-xs font-semibold uppercase tracking-[2px] text-portal-muted">
                  Functions for this scope
                </Text>
                {PORTAL_SECTION_ORDER.map((section) => (
                  <PortalPrimaryNavItem
                    key={section}
                    detail={`${activeScope.shortLabel} ${PORTAL_SECTION_LABELS[section].toLowerCase()} surface.`}
                    isActive={activeSection === section}
                    onPress={() => handleSectionPress(section)}
                    title={PORTAL_SECTION_LABELS[section]}
                  />
                ))}
              </>
            )}
          </View>
        </PortalCard>

        <PortalCard className="gap-4 p-4">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
            Followed and public surfaces
          </Text>

          <View className="gap-3">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-portal-muted">
              Followed scopes
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {followedScopes.map((scope) => (
                <Pressable
                  key={scope.id}
                  accessibilityRole="button"
                  className={`rounded-full border px-3 py-2 ${
                    scope.id === activeScopeId
                      ? 'border-portal-mint bg-portal-mint/10'
                      : 'border-portal-line bg-white/5'
                  }`}
                  onPress={() => handleScopePress(scope.id)}
                >
                  <Text className="text-sm font-semibold text-portal-text">
                    {scope.shortLabel}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <PortalCard className="gap-2 bg-white/5 p-4">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-portal-muted">
              Visitor channel
            </Text>
            <Text className="text-base font-semibold text-portal-text">
              {activeScope.publicLobbyLabel}
            </Text>
            <Text className="text-sm leading-6 text-portal-muted">
              Public guests can speak here. Broader posting, chat, and protected spaces stay deferred.
            </Text>
          </PortalCard>

          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-portal-muted">
              Deferred surfaces
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {portalComingSoonSurfaces.map((surface) => (
                <PortalBadge key={surface} label={surface} tone="default" />
              ))}
            </View>
          </View>
        </PortalCard>
      </ScrollView>
    </View>
  );
}
