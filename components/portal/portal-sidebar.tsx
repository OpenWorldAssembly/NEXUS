/**
 * File: portal-sidebar.tsx
 * Description: Renders the persistent left-side portal navigation, scope tree, and guest account block.
 */
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { usePortalShell } from '@/components/portal/portal-shell-context';
import {
  PortalActionButton,
  PortalBadge,
  PortalCard,
} from '@/components/portal/portal-ui';
import {
  portalComingSoonSurfaces,
  portalGuestProfile,
} from '@/data/portal/mock-portal-data';
import {
  PORTAL_SECTION_LABELS,
  PORTAL_SECTION_ORDER,
  type PortalNavMode,
  type PortalSection,
} from '@/lib/portal/portal-shell';

type PortalSidebarProps = {
  isDesktop: boolean;
  onRequestClose: () => void;
};

type PortalAccordionProps = {
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/**
 * Inputs: accordion metadata and child content.
 * Output: a collapsible section used inside the portal sidebar.
 */
function PortalAccordion({
  title,
  description,
  isOpen,
  onToggle,
  children,
}: PortalAccordionProps) {
  return (
    <PortalCard className="gap-4 p-4">
      <Pressable
        accessibilityRole="button"
        className="gap-1"
        onPress={onToggle}
      >
        <Text className="text-sm font-semibold uppercase tracking-[2px] text-portal-sky">
          {title}
        </Text>
        <Text className="text-sm leading-6 text-portal-muted">{description}</Text>
      </Pressable>

      {isOpen ? <View className="gap-3">{children}</View> : null}
    </PortalCard>
  );
}

/**
 * Inputs: sidebar container mode and a close callback for narrow screens.
 * Output: the full left-side navigation surface for the guest portal shell.
 */
export default function PortalSidebar({
  isDesktop,
  onRequestClose,
}: PortalSidebarProps) {
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
  const [openAccordionIds, setOpenAccordionIds] = useState([
    'primary',
    'scope',
    'later',
  ]);

  const parentScopes = scopeSummaries.filter(
    (scope) => scope.id === activeScope.parentId,
  );
  const childScopes = scopeSummaries.filter((scope) =>
    activeScope.childIds.includes(scope.id),
  );

  /**
   * Inputs: an accordion id.
   * Output: flips the open state for that accordion.
   */
  const toggleAccordion = (accordionId: string) => {
    setOpenAccordionIds((currentIds) =>
      currentIds.includes(accordionId)
        ? currentIds.filter((currentId) => currentId !== accordionId)
        : [...currentIds, accordionId],
    );
  };

  /**
   * Inputs: a portal section key.
   * Output: navigates to the section and closes the mobile sidebar when needed.
   */
  const handleSectionPress = (section: PortalSection) => {
    setActiveSection(section);

    if (!isDesktop) {
      onRequestClose();
    }
  };

  /**
   * Inputs: a portal nav mode.
   * Output: updates the shell mode without changing the route structure.
   */
  const handleModePress = (mode: PortalNavMode) => {
    setNavigationMode(mode);
  };

  /**
   * Inputs: a scope id.
   * Output: updates the scope lens and closes the mobile sidebar when needed.
   */
  const handleScopePress = (scopeId: string) => {
    setActiveScopeId(scopeId);

    if (!isDesktop) {
      onRequestClose();
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-portal-ink"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-4 px-4 py-5">
      <PortalCard className="gap-4">
        <View className="gap-3">
          <Text className="text-xs font-semibold uppercase tracking-[4px] text-portal-sky">
            OWA Nexus Portal
          </Text>
          <Text className="text-2xl font-bold text-portal-text">
            {portalGuestProfile.displayName}
          </Text>
          <Text className="text-sm leading-6 text-portal-muted">
            {portalGuestProfile.note}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-2">
          <PortalBadge label={portalGuestProfile.statusLabel} tone="sky" />
          <PortalBadge label={portalGuestProfile.trustLabel} tone="gold" />
        </View>

        <PortalCard className="gap-2 bg-white/5 p-4">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-portal-muted">
            My locality
          </Text>
          <Text className="text-base font-semibold text-portal-text">
            {portalGuestProfile.localityLabel}
          </Text>
          <Text className="text-sm leading-6 text-portal-muted">
            You can browse globally now and claim or start a local assembly later.
          </Text>
        </PortalCard>

        <View className="flex-row flex-wrap gap-3">
          <PortalActionButton
            label="Browse visitor lobbies"
            onPress={() => handleSectionPress('discussions')}
            variant="primary"
          />
          <PortalActionButton label="Find my locality" disabled />
        </View>
      </PortalCard>

      <PortalCard className="gap-4">
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
            Scope switcher
          </Text>
          <Text className="text-xl font-bold text-portal-text">
            {activeScope.name}
          </Text>
          <Text className="text-sm leading-6 text-portal-muted">
            {activeScope.description}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-2">
          <PortalBadge label={activeScope.badge} tone="sky" />
          <PortalBadge label={activeScope.publicLobbyLabel} tone="mint" />
        </View>

        <PortalCard className="gap-3 bg-white/5 p-4">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-portal-muted">
            Current branch
          </Text>
          <View className="gap-2">
            {branchNodes.map((node) => {
              const scope = scopeSummaries.find(
                (candidate) => candidate.id === node.scopeId,
              );

              if (!scope) {
                return null;
              }

              const isCurrent = node.scopeId === activeScopeId;

              return (
                <View
                  key={node.scopeId}
                  className="flex-row items-center gap-2"
                  style={{ paddingLeft: node.depth * 12 }}
                >
                  {node.hasChildren ? (
                    <Pressable
                      accessibilityRole="button"
                      className="h-8 w-8 items-center justify-center rounded-full border border-portal-line bg-white/5"
                      onPress={() => toggleScopeExpansion(node.scopeId)}
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
                    className={`flex-1 rounded-2xl border px-3 py-2 ${
                      isCurrent
                        ? 'border-portal-sky bg-portal-sky/10'
                        : 'border-portal-line bg-white/5'
                    }`}
                    onPress={() => handleScopePress(node.scopeId)}
                  >
                    <Text className="text-sm font-semibold text-portal-text">
                      {scope.name}
                    </Text>
                    <Text className="text-xs uppercase tracking-[2px] text-portal-muted">
                      {node.relationship}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </PortalCard>

        <View className="gap-2">
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
      </PortalCard>

      <PortalCard className="gap-3">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
          Portal lens
        </Text>
        <View className="flex-row gap-3">
          {(['function', 'scope'] as PortalNavMode[]).map((mode) => {
            const isActive = navigationMode === mode;

            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                className={`flex-1 rounded-full border px-4 py-3 ${
                  isActive
                    ? 'border-portal-sky bg-portal-sky/10'
                    : 'border-portal-line bg-white/5'
                }`}
                onPress={() => handleModePress(mode)}
              >
                <Text className="text-center text-sm font-semibold capitalize text-portal-text">
                  {mode === 'function' ? 'Function-first' : 'Scope-first'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </PortalCard>

      <PortalAccordion
        title={navigationMode === 'function' ? 'Primary functions' : 'Current scope'}
        description={
          navigationMode === 'function'
            ? 'Move by civic function first, then use the active scope lens inside each surface.'
            : 'Stay inside the selected scope while switching among its public civic surfaces.'
        }
        isOpen={openAccordionIds.includes('primary')}
        onToggle={() => toggleAccordion('primary')}
      >
        {PORTAL_SECTION_ORDER.map((section) => {
          const isActive = activeSection === section;

          return (
            <Pressable
              key={section}
              accessibilityRole="button"
              className={`rounded-2xl border px-4 py-3 ${
                isActive
                  ? 'border-portal-sky bg-portal-sky/10'
                  : 'border-portal-line bg-white/5'
              }`}
              onPress={() => handleSectionPress(section)}
            >
              <Text className="text-sm font-semibold text-portal-text">
                {PORTAL_SECTION_LABELS[section]}
              </Text>
              <Text className="text-sm leading-6 text-portal-muted">
                {navigationMode === 'function'
                  ? `${PORTAL_SECTION_LABELS[section]} across ${activeScope.shortLabel}.`
                  : `${activeScope.shortLabel} ${PORTAL_SECTION_LABELS[section].toLowerCase()} surface.`}
              </Text>
            </Pressable>
          );
        })}
      </PortalAccordion>

      <PortalAccordion
        title={navigationMode === 'function' ? 'Scope lens' : 'Scope branch'}
        description={
          navigationMode === 'function'
            ? 'Keep branch context visible while the center pane stays organized by function.'
            : 'Jump between parents, children, and followed scopes without leaving the portal shell.'
        }
        isOpen={openAccordionIds.includes('scope')}
        onToggle={() => toggleAccordion('scope')}
      >
        {parentScopes.length > 0 ? (
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-portal-muted">
              Parent scopes
            </Text>
            {parentScopes.map((scope) => (
              <Pressable
                key={scope.id}
                accessibilityRole="button"
                className="rounded-2xl border border-portal-line bg-white/5 px-4 py-3"
                onPress={() => handleScopePress(scope.id)}
              >
                <Text className="text-sm font-semibold text-portal-text">
                  {scope.name}
                </Text>
                <Text className="text-sm leading-6 text-portal-muted">
                  {scope.relationshipLabel}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {childScopes.length > 0 ? (
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-portal-muted">
              Child scopes
            </Text>
            {childScopes.map((scope) => (
              <Pressable
                key={scope.id}
                accessibilityRole="button"
                className="rounded-2xl border border-portal-line bg-white/5 px-4 py-3"
                onPress={() => handleScopePress(scope.id)}
              >
                <Text className="text-sm font-semibold text-portal-text">
                  {scope.name}
                </Text>
                <Text className="text-sm leading-6 text-portal-muted">
                  {scope.description}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-portal-muted">
            Visitor channels
          </Text>
          <PortalCard className="gap-2 bg-white/5 p-4">
            <Text className="text-sm font-semibold text-portal-text">
              {activeScope.publicLobbyLabel}
            </Text>
            <Text className="text-sm leading-6 text-portal-muted">
              Guests can post here, while deeper assembly rooms remain read-only until trust and identity flows arrive.
            </Text>
          </PortalCard>
        </View>
      </PortalAccordion>

      <PortalAccordion
        title="Later surfaces"
        description="These remain visible in the information architecture, but they are intentionally deferred in this first portal slice."
        isOpen={openAccordionIds.includes('later')}
        onToggle={() => toggleAccordion('later')}
      >
        <View className="flex-row flex-wrap gap-2">
          {portalComingSoonSurfaces.map((surface) => (
            <PortalBadge key={surface} label={surface} tone="default" />
          ))}
        </View>
      </PortalAccordion>
      </View>
    </ScrollView>
  );
}
