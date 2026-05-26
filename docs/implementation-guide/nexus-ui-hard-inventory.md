# Nexus UI Hard Inventory

## Purpose

This chapter is the hard inventory behind the higher-level Nexus UI component catalog. It is a snapshot of the current Nexus UI landscape used to plan universal template extraction without changing live visuals or route behavior.

This is an audit artifact only. It should guide later consolidation, not imply that every item listed should move immediately.

## Post-inventory folder foundation

After this snapshot, the first safe folder foundation pass moved stable shared modules into the canonical `app/components/nexus/ui/*` tree without visual or route behavior changes:

- `app/components/nexus/loading/*` -> `app/components/nexus/ui/feedback/loading/*`
- `app/components/nexus/action-card/*` -> `app/components/nexus/ui/cards/action-card/*`
- `app/components/nexus/action-list/*` -> `app/components/nexus/ui/actions/action-list/*`
- `app/components/nexus/nexus-tab-primitives.tsx` -> `app/components/nexus/ui/tabs/nexus-tab-primitives.tsx`
- `app/components/nexus/nexus-tabs.tsx` -> `app/components/nexus/ui/tabs/nexus-tabs.tsx`

The first consolidation pass after the folder foundation added `app/components/nexus/ui/overlays/*` and moved repeated modal chrome in dashboard validation, packet Explorer import outcomes, and locality create/reuse/picker dialogs onto `NexusModalShell` while preserving existing visual classes and handlers.

The broad `app/components/nexus/nexus-ui.tsx` primitive file has since been split into focused `ui/actions`, `ui/cards`, `ui/feedback`, `ui/forms`, `ui/layout`, and `ui/tabs` modules. `nexus-ui.tsx` remains as a compatibility bridge only; new shared UI imports should use `@app/components/nexus/ui` or direct family paths.

The discussions route has since started its feature extraction into `app/components/nexus/features/discussions/*`. Feed/thread/post panels, feed/root post cards, vote/reply-count pills, recursive reply tree controls, and post/reply composers now live there, while `src/app/nexus/discussions.tsx` remains the route controller for query state, loading, mutations, auth gates, and reply branch state.

The counts below remain useful as the pre-move hard inventory. New shared UI should prefer the `ui/*` paths.

## Snapshot summary

- Scope inspected: `app/components/nexus/*` and `src/app/nexus/*`.

- Files inspected: `83` non-test TypeScript/TSX files.

- Total lines inspected: `29662`.

- Zones: `feature` 30, `mixed` 9, `route` 15, `shared` 19, `support` 10.

- Raw React Native primitive references: `Pressable` 158, `ScrollView` 62, `TextInput` 32, `Modal` 30, `Switch` 3, `ActivityIndicator` 2.

- Shared Nexus primitive references: `NexusCard` 358, `NexusBadge` 201, `NexusActionButton` 187, `NexusSectionHeader` 19, `NexusSegmentedPill` 17, `NexusPreviewPanel` 14, `NexusTabFrame` 12, `NexusTabRail` 12, `NexusTabLabel` 8, `NexusActionList` 7, `NexusActionListItem` 5, `NexusInlineSelect` 5, `NexusActionMenu` 4, `NexusFocusedPacketSection` 4, `NexusTabStack` 4, `NexusActionCard` 2, `NexusLoadingBoundary` 2.

## Largest UI pressure files

| Lines | Zone | File | Primary component candidates | Raw primitives |
| ---: | --- | --- | --- | --- |
| 3604 | route | `src/app/nexus/locality/create.tsx` | LocalityLevelSearchRow, NexusLocalityCreatePage | Pressable 26, Modal 15, TextInput 8, ScrollView 10 |
| 2447 | route | `src/app/nexus/discussions.tsx` | InlineReplyComposer, DiscussionVotePill, ReplyCountPill, ReplyNode, ReplyTree, NexusDiscussionsPage | Pressable 9, TextInput 4, ScrollView 7 |
| 2056 | support | `app/components/nexus/identity-shell-context.tsx` | IdentityShellContext, IdentityShellProvider | — |
| 1962 | mixed | `app/components/nexus/nexus-sidebar.tsx` | NexusGuestAvatar, NexusRailToggle, NexusPreferenceSwitch, NexusCurrentContextCard, NexusMenuSectionLabel, NexusPrimaryNavItem | Pressable 26, ScrollView 6, Switch 2 |
| 1261 | shared | `app/components/nexus/nexus-ui.tsx` | NexusThemedBevelEdges, NexusBevelEdges, NexusCard, NexusSectionHeader, NexusBadge, NexusChevronIcon | Pressable 18, Modal 3, ScrollView 3 |
| 967 | feature | `app/components/nexus/packet-explorer/nexus-packet-explorer-import-panel.tsx` | ImportResultCard, ImportHistoryCard, NexusPacketExplorerImportPanel | Pressable 2, Modal 3, TextInput 2 |
| 859 | support | `app/components/nexus/nexus-shell-context.tsx` | NexusShellContext, NexusShellProvider | — |
| 795 | feature | `app/components/nexus/packet-explorer/nexus-packet-explorer-export-panel.tsx` | ExportPreviewCard, NexusPacketExplorerExportPanel | Pressable 3, TextInput 6 |
| 772 | mixed | `app/components/nexus/nexus-packet-explorer.tsx` | NexusPacketExplorer | Pressable 9, Modal 3 |
| 768 | feature | `app/components/nexus/packet-explorer/nexus-packet-explorer-content.tsx` | NexusPacketExplorerSeededSummary, NexusPacketExplorerLineagePanel, NexusPacketExplorerActionsPanel, NexusPacketExplorerValidationPanel, NexusPacketExplorerContent | ScrollView 3 |
| 714 | route | `src/app/nexus/roles.tsx` | NexusRolesPage | TextInput 2, ScrollView 3 |
| 676 | shared | `app/components/nexus/nexus-tabs.tsx` | NexusTabButton, NexusTabRail, NexusTabStack | ScrollView 5 |
| 659 | route | `src/app/nexus/trust.tsx` | NexusTrustPage | TextInput 2, ScrollView 3 |
| 655 | route | `src/app/nexus/dashboard.tsx` | NexusDashboardPage | Pressable 2, Modal 3, ScrollView 3 |
| 639 | route | `src/app/nexus/identity/sign-in.tsx` | NexusIdentitySignInPage | Pressable 3 |

## Raw primitive inventory

These are the files most likely to contain local button, modal, form, scroll, or overlay behavior that may eventually be promoted into Nexus-native templates. Counts are lexical references, not rendered instance counts.

| File | Pressable | Modal | TextInput | ScrollView | Other raw primitives |
| --- | ---: | ---: | ---: | ---: | --- |
| `src/app/nexus/locality/create.tsx` | 26 | 15 | 8 | 10 | — |
| `app/components/nexus/nexus-sidebar.tsx` | 26 | 0 | 0 | 6 | Switch 2 |
| `app/components/nexus/nexus-ui.tsx` | 18 | 3 | 0 | 3 | — |
| `src/app/nexus/discussions.tsx` | 9 | 0 | 4 | 7 | — |
| `app/components/nexus/nexus-packet-explorer.tsx` | 9 | 3 | 0 | 0 | — |
| `app/components/nexus/locality/locality-create-graph-row.tsx` | 9 | 0 | 3 | 0 | — |
| `app/components/nexus/action-card/nexus-card-badge-strip.tsx` | 8 | 3 | 0 | 0 | — |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-export-panel.tsx` | 3 | 0 | 6 | 0 | — |
| `app/components/nexus/nexus-identity-ui.tsx` | 3 | 0 | 3 | 3 | — |
| `src/app/nexus/dashboard.tsx` | 2 | 3 | 0 | 3 | — |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-import-panel.tsx` | 2 | 3 | 2 | 0 | — |
| `app/components/nexus/nexus-tab-primitives.tsx` | 7 | 0 | 0 | 0 | — |
| `app/components/nexus/preview/nexus-preview-panel.tsx` | 3 | 0 | 0 | 3 | — |
| `src/app/nexus/roles.tsx` | 0 | 0 | 2 | 3 | — |
| `app/components/nexus/nexus-tabs.tsx` | 0 | 0 | 0 | 5 | — |
| `src/app/nexus/trust.tsx` | 0 | 0 | 2 | 3 | — |
| `app/components/nexus/nexus-auth-gate.tsx` | 4 | 0 | 0 | 0 | — |
| `src/app/nexus/library.tsx` | 0 | 0 | 0 | 4 | — |
| `src/app/nexus/account.tsx` | 0 | 0 | 0 | 3 | Switch 1 |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-content.tsx` | 0 | 0 | 0 | 3 | — |
| `src/app/nexus/identity/sign-in.tsx` | 3 | 0 | 0 | 0 | — |
| `app/components/nexus/locality/locality-create-preview-panel.tsx` | 3 | 0 | 0 | 0 | — |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-tab-deck.tsx` | 0 | 0 | 0 | 3 | — |
| `src/app/nexus/votes.tsx` | 0 | 0 | 0 | 3 | — |
| `app/components/nexus/action-card/nexus-action-menu.tsx` | 3 | 0 | 0 | 0 | — |
| `app/components/nexus/discussions/nexus-discussion-focus-panel.tsx` | 3 | 0 | 0 | 0 | — |
| `app/components/nexus/action-list/nexus-action-list-item.tsx` | 3 | 0 | 0 | 0 | — |
| `app/components/nexus/focus/nexus-focused-packet-section.tsx` | 3 | 0 | 0 | 0 | — |
| `app/components/nexus/action-card/nexus-card-menu-button.tsx` | 3 | 0 | 0 | 0 | — |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-search-panel.tsx` | 0 | 0 | 2 | 0 | — |
| `app/components/nexus/nexus-shell.tsx` | 2 | 0 | 0 | 0 | — |
| `app/components/nexus/nexus-feature-status-context.tsx` | 2 | 0 | 0 | 0 | — |
| `app/components/nexus/nexus-shell-entry-gate.tsx` | 2 | 0 | 0 | 0 | — |
| `app/components/nexus/loading/nexus-loading-overlay.tsx` | 0 | 0 | 0 | 0 | ActivityIndicator 2 |
| `app/components/nexus/loading/nexus-loading-boundary.tsx` | 2 | 0 | 0 | 0 | — |

## Shared component inventory

These files already behave like shared UI substrate or close relatives. They should generally be reorganized before route files are rewritten.

| File | Lines | Exported/public components | Local component helpers | Families | Shared primitives referenced |
| --- | ---: | --- | --- | --- | --- |
| `app/components/nexus/action-card/nexus-action-card.tsx` | 81 | NexusActionCard | — | actions, cards | NexusActionCard 1, NexusCard 4 |
| `app/components/nexus/action-card/nexus-action-menu-controller.tsx` | 159 | NexusActionMenuControllerProvider | NexusActionMenuControllerContext | actions, cards | NexusActionMenu 2 |
| `app/components/nexus/action-card/nexus-action-menu.tsx` | 139 | NexusActionMenu | — | actions, cards | NexusActionMenu 1 |
| `app/components/nexus/action-card/nexus-card-action-cluster.tsx` | 137 | NexusCardActionCluster | — | actions, cards | — |
| `app/components/nexus/action-card/nexus-card-badge-strip.tsx` | 484 | NexusCardBadgeStrip | NexusCardBadgeIconView, NexusCardBadgeButton | actions, cards, overlays | — |
| `app/components/nexus/action-card/nexus-card-menu-button.tsx` | 57 | NexusCardMenuButton | — | actions, cards | — |
| `app/components/nexus/action-list/nexus-action-list-item.tsx` | 108 | NexusActionListItem | — | actions | NexusActionListItem 1 |
| `app/components/nexus/action-list/nexus-action-list.tsx` | 40 | NexusActionList | — | actions | NexusActionList 1 |
| `app/components/nexus/loading/nexus-loading-boundary.tsx` | 52 | NexusLoadingBoundary | — | feedback | NexusLoadingBoundary 1 |
| `app/components/nexus/loading/nexus-loading-context.tsx` | 341 | NexusLoadingProvider | NexusLoadingContext | cards, feedback | — |
| `app/components/nexus/loading/nexus-loading-overlay.tsx` | 56 | NexusLoadingOverlay | — | overlays, feedback | — |
| `app/components/nexus/nexus-tab-primitives.tsx` | 427 | NexusTabFrame, NexusTabLabel, NexusTabDetail, NexusTabCloseButton | NexusTabBevelEdges | actions, tabs | NexusTabFrame 1, NexusTabLabel 1 |
| `app/components/nexus/nexus-tabs.tsx` | 676 | NexusTabButton, NexusTabRail, NexusTabStack | — | actions, tabs, layout | NexusTabFrame 3, NexusTabLabel 2, NexusTabRail 2, NexusTabStack 2 |
| `app/components/nexus/nexus-ui.tsx` | 1261 | NexusThemedBevelEdges, NexusBevelEdges, NexusCard, NexusSectionHeader, NexusBadge, NexusChevronIcon, NexusActionButton, NexusSegmentedPill, NexusAttachedTabRail, NexusInlineSelect | — | actions, cards, tabs, overlays, forms, layout | NexusActionButton 1, NexusCard 1, NexusSectionHeader 1, NexusInlineSelect 1, NexusSegmentedPill 1, NexusTabFrame 3, NexusTabLabel 2, NexusBadge 1 |

## Feature component inventory

These files are feature-specific compositions. Most should keep their domain/controller logic but gradually consume shared `ui/*` templates for chrome, forms, overlays, panels, and feedback.

| File | Lines | Component candidates | Families | Raw primitives | Shared primitives referenced |
| --- | ---: | --- | --- | --- | --- |
| `app/components/nexus/features/discussions/*` | post-inventory extraction | DiscussionFeedPanel, DiscussionThreadPanel, DiscussionPostPanel, DiscussionThreadToolbar, DiscussionFeedPostCard, DiscussionRootPostCard, DiscussionReplyTree, DiscussionVotePill, DiscussionReplyCountPill, DiscussionPostComposer, DiscussionReplyComposer | cards, actions, forms, feedback, layout | Pressable retained only inside feature controls | NexusActionButton, NexusCard, NexusBadge, NexusLoadingBoundary, NexusTextInput, NexusTextArea |
| `app/components/nexus/discussions/nexus-discussion-focus-panel.tsx` | 127 | NexusDiscussionFocusPanel | cards, layout | Pressable 3 | NexusActionButton 2, NexusCard 3, NexusBadge 3 |
| `app/components/nexus/focus/nexus-focused-packet-section.tsx` | 105 | NexusFocusedPacketSection | cards, layout | Pressable 3 | NexusFocusedPacketSection 1 |
| `app/components/nexus/locality/locality-create-graph-row.tsx` | 336 | LocalityCreateGraphRow | forms | Pressable 9, TextInput 3 | NexusActionButton 4, NexusBadge 6 |
| `app/components/nexus/locality/locality-create-preview-panel.tsx` | 401 | CheckboxControl, LocalityCreatePreviewPanel | cards, layout, feedback | Pressable 3 | NexusActionButton 6, NexusCard 5, NexusBadge 11 |
| `app/components/nexus/nexus-auth-gate.tsx` | 566 | NexusAuthGateModal | overlays | Pressable 4 | NexusActionButton 3, NexusCard 3 |
| `app/components/nexus/nexus-identity-ui.tsx` | 377 | IdentityPageShell, IdentityField, IdentityInput, IdentityRouteLinks, IdentityPreferenceCard, LocationLookupField | cards, forms, layout | Pressable 3, TextInput 3, ScrollView 3 | NexusActionButton 6, NexusCard 7, NexusSectionHeader 2, NexusSegmentedPill 3 |
| `app/components/nexus/nexus-packet-explorer.tsx` | 772 | NexusPacketExplorer | overlays | Pressable 9, Modal 3 | NexusActionButton 2, NexusCard 3 |
| `app/components/nexus/nexus-shell-entry-gate.tsx` | 113 | NexusShellEntryGate | overlays, layout | Pressable 2 | NexusActionButton 2, NexusCard 3, NexusBadge 2 |
| `app/components/nexus/nexus-shell.tsx` | 243 | NexusShell | layout | Pressable 2 | — |
| `app/components/nexus/nexus-sidebar.tsx` | 1962 | NexusGuestAvatar, NexusRailToggle, NexusPreferenceSwitch, NexusCurrentContextCard, NexusMenuSectionLabel, NexusPrimaryNavItem, NexusFunctionMenuContent, NexusScopeSectionHeader, NexusScopeActionMenu, NexusScopeListRow, NexusGroupedScopeRows, Wrapper, NexusScopeMenuContent, NexusSidebar | actions, cards, forms, layout | Pressable 26, ScrollView 6, Switch 2 | NexusCard 11, NexusSegmentedPill 3 |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-content.tsx` | 768 | NexusPacketExplorerSeededSummary, NexusPacketExplorerLineagePanel, NexusPacketExplorerActionsPanel, NexusPacketExplorerValidationPanel, NexusPacketExplorerContent | actions, layout | ScrollView 3 | NexusActionButton 6, NexusCard 29, NexusBadge 11 |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-data-panel.tsx` | 210 | NexusPacketExplorerDataPanel | layout | — | NexusCard 11, NexusBadge 7 |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-export-panel.tsx` | 795 | ExportPreviewCard, NexusPacketExplorerExportPanel | cards, forms, layout | Pressable 3, TextInput 6 | NexusActionButton 6, NexusCard 19, NexusInlineSelect 2, NexusSegmentedPill 2, NexusBadge 6 |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-home-panel.tsx` | 96 | NexusPacketExplorerHomePanel | layout | — | — |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-import-panel.tsx` | 967 | ImportResultCard, ImportHistoryCard, NexusPacketExplorerImportPanel | cards, overlays, forms, layout | Pressable 2, Modal 3, TextInput 2 | NexusActionButton 13, NexusCard 23, NexusSegmentedPill 3, NexusBadge 31 |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-links-panel.tsx` | 303 | NexusPacketExplorerLinkDirectionSection, NexusPacketExplorerLinksPanel | layout | — | NexusActionButton 8, NexusCard 5, NexusBadge 9 |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-primary-rail.tsx` | 51 | NexusPacketExplorerPrimaryRail | layout | — | NexusTabRail 2 |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-search-panel.tsx` | 401 | SearchResultCard, SearchGroupSection, NexusPacketExplorerSearchPanel | cards, forms, layout | TextInput 2 | NexusActionButton 8, NexusCard 15, NexusSegmentedPill 2, NexusBadge 6 |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-shell-header.tsx` | 53 | NexusPacketExplorerShellHeader | layout | — | NexusActionButton 5 |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-tab-deck.tsx` | 258 | NexusPacketExplorerTabDeck | tabs | ScrollView 3 | NexusActionButton 3, NexusCard 3, NexusTabFrame 5, NexusTabLabel 3, NexusBadge 2 |
| `app/components/nexus/packet-explorer/nexus-packet-explorer-toolbar.tsx` | 109 | NexusPacketExplorerToolbar | layout | — | NexusActionButton 3, NexusInlineSelect 2, NexusTabRail 2 |
| `app/components/nexus/preview/nexus-preview-panel.tsx` | 79 | NexusPreviewPanel | cards, layout | Pressable 3, ScrollView 3 | NexusCard 3, NexusPreviewPanel 1 |
| `app/components/nexus/preview/nexus-stat-card.tsx` | 46 | NexusStatCard | cards | — | NexusCard 3 |

## Route-local component inventory

Route-local components are the highest-risk extraction zone because they often blend controller state, data fetching, and UI chrome. They should be audited for behavior before any extraction.

| Route file | Lines | Local component candidates | Families | Raw primitives | Shared primitives referenced |
| --- | ---: | --- | --- | --- | --- |
| `src/app/nexus/_layout.tsx` | 71 | NexusLayoutContent, NexusLayout | layout | — | — |
| `src/app/nexus/account.tsx` | 203 | NexusAccountPage | forms | ScrollView 3, Switch 1 | NexusActionButton 7, NexusCard 9, NexusSectionHeader 2, NexusBadge 9 |
| `src/app/nexus/dashboard.tsx` | 655 | NexusDashboardPage | overlays | Pressable 2, Modal 3, ScrollView 3 | NexusActionButton 3, NexusCard 11, NexusSectionHeader 2, NexusFocusedPacketSection 2, NexusPreviewPanel 11, NexusActionList 5, NexusActionListItem 3, NexusBadge 5 |
| `src/app/nexus/discussions.tsx` | 1691 after panel extraction | NexusDiscussionsPage route/controller; workspace panels and post/reply/vote feature components moved to `features/discussions/*` | forms, cards, feedback, layout | route still owns outer page ScrollView composition | NexusActionButton, NexusCard, NexusSectionHeader, NexusTabStack, NexusBadge |
| `src/app/nexus/identity/claim.tsx` | 425 | NexusIdentityClaimPage | support | — | NexusActionButton 8, NexusCard 9, NexusBadge 3 |
| `src/app/nexus/identity/create.tsx` | 328 | NexusIdentityCreatePage | support | — | NexusActionButton 5, NexusCard 3 |
| `src/app/nexus/identity/restore.tsx` | 152 | NexusIdentityRestorePage | support | — | NexusActionButton 5, NexusCard 3 |
| `src/app/nexus/identity/security.tsx` | 588 | NexusIdentitySecurityPage | support | — | NexusActionButton 12, NexusCard 25, NexusSegmentedPill 3, NexusBadge 11 |
| `src/app/nexus/identity/sign-in.tsx` | 639 | NexusIdentitySignInPage | support | Pressable 3 | NexusActionButton 7, NexusCard 13, NexusTabRail 2 |
| `src/app/nexus/index.tsx` | 14 | NexusIndexPage | support | — | — |
| `src/app/nexus/library.tsx` | 317 | NexusLibraryPage | support | ScrollView 4 | NexusActionButton 5, NexusCard 9, NexusSectionHeader 2, NexusBadge 5 |
| `src/app/nexus/locality/create.tsx` | 3604 | LocalityLevelSearchRow, NexusLocalityCreatePage | overlays, forms | Pressable 26, Modal 15, TextInput 8, ScrollView 10 | NexusActionButton 19, NexusCard 25, NexusSectionHeader 2, NexusTabRail 2, NexusBadge 19 |
| `src/app/nexus/roles.tsx` | 714 | NexusRolesPage | forms | TextInput 2, ScrollView 3 | NexusActionButton 7, NexusCard 23, NexusSectionHeader 2, NexusTabRail 2, NexusBadge 17 |
| `src/app/nexus/trust.tsx` | 659 | NexusTrustPage | forms | TextInput 2, ScrollView 3 | NexusActionButton 9, NexusCard 31, NexusSectionHeader 2, NexusBadge 20 |
| `src/app/nexus/votes.tsx` | 210 | NexusVotesPage | support | ScrollView 3 | NexusActionButton 4, NexusCard 13, NexusSectionHeader 2, NexusBadge 7 |

## Support and context files with UI adjacency

These are not primary UI templates, but several contain providers, controllers, or state that UI templates depend on. They should remain outside presentation folders unless their visual pieces are separated first.

| File | Lines | Component/provider candidates | Exported types | Zone |
| --- | ---: | --- | --- | --- |
| `app/components/nexus/identity-shell-context.tsx` | 2056 | IdentityShellContext, IdentityShellProvider | — | support |
| `app/components/nexus/identity-shell-fortress-adapter.ts` | 367 | — | — | support |
| `app/components/nexus/nexus-auth-gate-types.ts` | 12 | — | — | support |
| `app/components/nexus/nexus-feature-status-context.tsx` | 234 | NexusFeatureStatusContext, NexusFeatureStatusOverlay, NexusFeatureStatusProvider | — | support |
| `app/components/nexus/nexus-feature-status-registry.ts` | 203 | — | NexusFeatureStatusKind, NexusFeatureStatusEntry, NexusFeatureStatusId | support |
| `app/components/nexus/nexus-route-utils.ts` | 77 | — | — | support |
| `app/components/nexus/nexus-shell-chrome-context.tsx` | 56 | NexusShellChromeContext, NexusShellChromeProvider | — | support |
| `app/components/nexus/nexus-shell-context.tsx` | 859 | NexusShellContext, NexusShellProvider | — | support |
| `app/components/nexus/nexus-shell-preferences.ts` | 67 | — | NexusShellPreferenceMode, PersistNexusElementPreferenceInput, PersistNexusElementPreferenceResult | support |
| `app/components/nexus/packet-actions/nexus-packet-action-registry.ts` | 57 | — | NexusPacketActionInput, NexusPacketActionHandlers, NexusPacketActionRegistryInput | support |

## Extraction candidate queue

Recommended order, based on duplication, risk, and likely payoff:

1. **Overlays and modal shells**: initial shared modal shell and outcome/confirm primitives now exist under `ui/overlays`; remaining work should focus on auth/session gates, feature-status overlays, badge tooltips, and any modal content that deserves picker/outcome-specific composition. Keep auth/session logic separate from modal chrome.

2. **Form field shells and searchable result lists**: base segmented, inline-select, field shell, text input, text area, action row, and search-result primitives now live under `ui/forms`; Explorer search/export/import fields, identity lookup, locality create search dropdowns, trust notes, roles comments, and discussion composers now have shared presentation seams. Remaining work should target preference rows and broader route-local form sections.

3. **Layout frames and section scaffolds**: page/scroll frames, panel/workbench wrappers, panel headers, section bands, toolbar rows, and metric grids now live under `ui/layout`; identity page shell, dashboard/trust/roles metric rows, and a Packet Explorer workbench panel have begun adopting them. Remaining work should target repeated route page wrappers, packet explorer panel shells, sidebar rail sections, and dashboard card rows.

4. **Feedback states**: scoped loading and basic empty/error/warning/status/operation cards now live under `ui/feedback`; remaining work should replace route-local loading, refreshing, empty, and outcome copy only where the shared card can preserve the existing layout.

5. **Tab unification**: keep Explorer document tabs as an extension of shared tab primitives. Do this after overlays/forms/layout so tab work does not become a broad behavioral rewrite.

6. **Packet inspection/focus panels**: focus, preview, dashboard, library, and Explorer all present packet summaries with related action/badge/provenance slots. Extract only after action/menu behavior stays stable.

7. **Discussion feature promotion candidates**: workspace panel shells, scrollable feed panels, thread toolbars, composers, vote/reaction pills, and recursive tree rails are now isolated under `features/discussions`; promote them into `ui/*` only after another surface needs the same skeleton.


## Suggested future folder map

```txt
app/components/nexus/ui/
  actions/     # buttons, menu buttons, action menus, action lists, badge strips
  cards/       # base surfaces, packet cards, focus/preview cards, stat cards, warning/outcome cards
  tabs/        # shared tab frame/label/rail/stack plus Explorer document-tab extensions
  overlays/    # modal shell, confirmation, outcome dialog, popover, gates, tooltip hosts
  forms/       # field shell, text input, text area, composer, search box/result list, picker shell, toggles
  layout/      # page/scroll frame, section band/header, panel/workbench panel, panel split, rail section, toolbar frame, metric grid
  feedback/    # loading, empty, error, warning, operation result/status rows
```

## Guardrails for later migrations

- Preserve visuals and behavior first; extract structure before changing design.

- Do not move runtime/core logic into shared UI folders.

- Do not make packet-type-specific UI decisions inside generic templates. Generic templates receive slots, labels, state, handlers, and scope strings.

- Prefer one migration family per pass. A pass that touches overlays, tabs, forms, and route controllers at once is too wide.

- Update this hard inventory or the component catalog after each consolidation pass so the map does not rot into wall art.
