/**
 * File: nexus-sidebar.tsx
 * Description: Renders the left-side nexus rails with collapsible primary and secondary navigation panels.
 */
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  NexusCurrentContextCard,
  NexusFunctionMenuContent,
  NexusGuestAvatar,
  NexusPreferenceSwitch,
  NexusRailToggle,
  NexusScopeMenuContent,
} from '@app/components/nexus/features/sidebar';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import { useNexusAuthGate } from '@app/components/nexus/nexus-auth-gate';
import {
  NexusCard,
  NexusChevronIcon,
  NexusSegmentedPill,
  NexusThemedBevelEdges,
  getNexusChromeClasses,
  useNexusLoading,
} from '@app/components/nexus/ui';
import type { NexusSecurityMode } from '@runtime/nexus/nexus-api-types';
import {
  NEXUS_SECTION_ORDER,
  getNexusRailWidth,
  getNexusAncestorIds,
  NEXUS_COLLAPSED_RAIL_WIDTH,
  type NexusScopeSummary,
  type NexusSection,
} from '@runtime/nexus/nexus-shell';

type NexusSidebarProps = {
  isDesktop: boolean;
  onRequestClose: () => void;
};

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
 * Inputs: a possibly missing scope summary from a lookup.
 * Output: whether the lookup resolved to a real scope summary.
 */
function isNexusScopeSummary(
  scope: NexusScopeSummary | undefined,
): scope is NexusScopeSummary {
  return Boolean(scope);
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
  const { runWithLoading } = useNexusLoading();
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
    const loadingScope = `sidebar:scope-follow:${scopeId}`;
    const runScopeFollow = async () => {
      try {
        await setScopeFollowed(scopeId, isFollowed);
      } catch (error: unknown) {
        if (
          openNexusAuthGateForError(error, () =>
            runWithLoading(loadingScope, runScopeFollow)
          )
        ) {
          return;
        }

        throw error;
      }
    };

    await runWithLoading(loadingScope, runScopeFollow);
  };

  const handleScopeAssociatePress = async (
    scopeId: string,
    isAssociated: boolean
  ) => {
    const loadingScope = `sidebar:scope-associate:${scopeId}`;
    const runScopeAssociation = async () => {
      try {
        await setScopeAssociated(scopeId, isAssociated);
      } catch (error: unknown) {
        if (
          openNexusAuthGateForError(error, () =>
            runWithLoading(loadingScope, runScopeAssociation)
          )
        ) {
          return;
        }

        throw error;
      }
    };

    await runWithLoading(loadingScope, runScopeAssociation);
  };

  const handleScopeMainVisiblePress = async (
    scopeId: string,
    isMainVisible: boolean
  ) => {
    const loadingScope = `sidebar:scope-main-visible:${scopeId}`;
    const runScopeMainVisibility = async () => {
      try {
        await setScopeMainVisible(scopeId, isMainVisible);
      } catch (error: unknown) {
        if (
          openNexusAuthGateForError(error, () =>
            runWithLoading(loadingScope, runScopeMainVisibility)
          )
        ) {
          return;
        }

        throw error;
      }
    };

    await runWithLoading(loadingScope, runScopeMainVisibility);
  };

  const handleOpenScopeInExplorer = (scope: NexusScopeSummary) => {
    openPacketInExplorer({
      packetId: scope.packetId,
      titleSnapshot: scope.name,
      seedSummary: {
        type: 'Element',
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
