# Nexus UI Component Catalog

## Purpose

This catalog records the current Nexus UI component landscape before a broader universal-template cleanup. It is an audit artifact only: it should guide later consolidation work without moving files, changing visuals, or coupling Nexus UI to the public site design system.

Public-site components may be useful references, but Nexus should keep its own component system because the public site and Nexus workspace are separate product surfaces.

For exact file-level counts, route-local component candidates, raw React Native primitive usage, and extraction sequencing, see [Nexus UI Hard Inventory](nexus-ui-hard-inventory.md).

## Current pressure points

- `src/app/nexus/locality/create.tsx` and `src/app/nexus/discussions.tsx` are the largest route-local UI surfaces and contain many one-off controls, pickers, composers, modals, and layout sections.
- `app/components/nexus/nexus-ui.tsx` is now a temporary compatibility bridge; shared primitive implementations live in focused `app/components/nexus/ui/*` component-type modules.
- `app/components/nexus/ui/tabs/nexus-tabs.tsx`, `app/components/nexus/ui/tabs/nexus-tab-primitives.tsx`, and `app/components/nexus/packet-explorer/nexus-packet-explorer-tab-deck.tsx` already share some tab skeleton pieces, but the Explorer tab deck remains a separate document-tab system.
- Modal and overlay behavior is spread across route-local `Modal` usage, auth gates, feature-status explainers, packet explorer overlays, sidebar drawers, and loading boundaries.
- Action chrome is the most mature shared area: packet cards, badge strips, menu buttons, action menus, action lists, and scoped loading plumbing already form a reusable foundation.

## Folder foundation status

The first Nexus UI folder foundation pass moved stable shared modules into `app/components/nexus/ui/*` without changing visuals or route structure:

- `loading/*` now lives at `ui/feedback/loading/*`
- `action-card/*` now lives at `ui/cards/action-card/*`
- `action-list/*` now lives at `ui/actions/action-list/*`
- `nexus-tabs.tsx` and `nexus-tab-primitives.tsx` now live under `ui/tabs/*`

The older locations should not be reused for new shared UI. Larger feature folders and route-local surfaces are intentionally unchanged until later extraction passes.

## Overlay consolidation status

The first universal-template consolidation pass added shared overlay primitives under `app/components/nexus/ui/overlays/*`:

- `NexusModalShell` owns the reusable `Modal` backdrop, close press target, centering, and Nexus card frame.
- `NexusOutcomeDialog` and `NexusConfirmDialog` compose common outcome and confirmation dialog patterns on top of the shell.
- `NexusPopover` reserves a lightweight shared frame for caller-positioned overlay panels.

The initial migration moved repeated modal chrome in dashboard packet validation, packet Explorer import outcomes, and locality create/reuse/picker dialogs onto the shared shell while preserving their existing visual classes and handlers. Auth/session logic remains outside the generic overlay primitives.

## Primitive split status

The broad `nexus-ui.tsx` primitive file has been split into focused component-type modules while preserving visual behavior:

- card surfaces live in `ui/cards/nexus-card.tsx`
- action buttons and chevrons live in `ui/actions/*`
- badges live in `ui/feedback/nexus-badge.tsx`
- segmented controls and inline selects live in `ui/forms/*`
- chrome, appearance, bevel, and section-header helpers live in `ui/layout/*`
- attached tab rails live in `ui/tabs/nexus-attached-tab-rail.tsx`

Nexus callers should import from `@app/components/nexus/ui` or a direct family path. `app/components/nexus/nexus-ui.tsx` remains only as a temporary bridge for compatibility and should not be the source for new imports.

## Feature extraction status

The first large route decomposition passes created `app/components/nexus/features/discussions/*` for discussion-specific composed UI. The route still owns query normalization, data loading, mutations, auth gates, router navigation, and reply branch state, while extracted feature components render feed/thread/post workspace panels, feed post cards, root post cards, reply trees, vote/reply-count pills, and post/reply composers.

Discussion loading scopes are visual-boundary owned: feed load-more, root replies, reply branches, vote pills, and post/reply composers now have scoped loading seams without coupling loading to packet action registries or runtime mutation types.

The workspace panel shapes are intentionally feature-local but generic-friendly: feed panels, thread toolbars, recursive tree sections, and composer panels can be promoted into `ui/*` later if another Nexus surface proves the same reusable skeleton.

The sidebar has also started feature-local extraction under `app/components/nexus/features/sidebar/*`. `nexus-sidebar.tsx` remains the shell controller for router, auth, preference, rail-state, and scope mutation handling, while rail toggles, preference switches, function menus, scope rows, grouped scope sections, and scope action menus now live in the sidebar feature module.

## Component Type Catalog

| Component type | Current files and usages | Current status | Duplication notes | Future template target | Migration risk |
| --- | --- | --- | --- | --- | --- |
| Cards and packet cards | `ui/cards/nexus-card.tsx`, `ui/cards/action-card/*`, `focus/*`, `dashboard/*`, route-local nested cards in `trust`, `roles`, `votes`, `library`, `discussions`, `locality/create`, and packet explorer panels | Shared base plus feature-specific compositions | `NexusCard` is used widely, but route files still compose repeated metric cards, inset cards, warning cards, focused packet panels, and packet preview rows manually | `ui/cards` with base surface, metric/stat card, packet card, focused packet panel, warning/outcome card, and repeated inset section patterns | Medium |
| Action buttons, menus, lists, and badge strips | `NexusActionButton` and `NexusChevronIcon` in `ui/actions/*`; `ui/cards/action-card/*`; `ui/actions/action-list/*`; packet action conversion in `packet-actions/*`; dashboard queue/list actions | Strongest shared foundation | Shared action menus and badge strips exist, but route-local action clusters and raw buttons still appear in large pages; button/menu scoped loading is now available but adoption is caller-owned | `ui/actions` with action button, icon/menu button, action menu, action cluster, action list, badge strip, and packet-action adapters | Low |
| Tabs and tab decks | `ui/tabs/nexus-tabs.tsx`, `ui/tabs/nexus-tab-primitives.tsx`, route uses in `roles`, `identity/sign-in`, `locality/create`, packet explorer toolbar and primary rail; Explorer document tabs in `packet-explorer/nexus-packet-explorer-tab-deck.tsx` | Shared navigation tabs plus separate Explorer document tabs | Function-surface tabs and Explorer tabs both use `NexusTabFrame` / `NexusTabLabel`, but differ in close controls, tooltip behavior, wrapping, and session/document semantics | `ui/tabs` with shared frame/label/close primitives, navigation rail/stack, segmented tabs, and Explorer document-tab extension | Medium |
| Modals, gates, confirmations, and overlays | `ui/overlays/*`, `nexus-auth-gate.tsx`, `nexus-shell-entry-gate.tsx`, `nexus-feature-status-context.tsx`, packet explorer shell overlay, remaining route-local overlay variants | Shared modal shell now exists; gates remain specialized | Dashboard validation, packet import outcome, and locality create/reuse/picker dialogs now use shared modal chrome; auth/entry gates and feature-status overlays still need careful migration because they carry session or shell-specific behavior | `ui/overlays` with modal shell, confirmation dialog, outcome dialog, anchored popover, blocking gate, and shell overlay host | Medium |
| Dropdowns, selects, pickers, and menus | `NexusInlineSelect` in `ui/forms/*`; `ui/forms/search/*`; `NexusActionMenu`; locality kind/parent/result pickers; identity location search; packet explorer search/export lookup lists; sidebar menus | Mixed shared and route-local | Action menus and inline selects are shared; search dropdown/result chrome now has shared field/list/row primitives, while picker-specific side effects remain local | `ui/menus` or `ui/forms` with inline select, anchored menu, searchable result list, picker modal, and selectable row | Medium |
| Text inputs, composers, search fields, and form rows | `ui/forms/nexus-field-shell.tsx`, `ui/forms/nexus-text-input.tsx`, `ui/forms/nexus-text-area.tsx`, `ui/forms/nexus-field-action-row.tsx`, `ui/forms/search/*`, `features/discussions/*`; raw `TextInput` remains in larger route-local specialized controls | Shared field/input/search chrome is now available | Identity fields now wrap the generic shell/input primitives; Packet Explorer import/export fields, trust notes, roles support comments, and discussion post/reply composers use shared input/textarea seams. Broader route-local form sections still need careful migration | `ui/forms` with field shell, text input, textarea/composer, search box, result list, error text, hint text, and field action row | Medium |
| Loading and feedback states | `ui/feedback/loading/*`; `ui/feedback/nexus-feedback-states.tsx`; discussion feature loading scopes; local `isLoading*` flags in route pages; warnings/errors with `NexusCard` tones | Shared loading and basic feedback cards now exist | Scoped loading provider/boundary exists, and discussions now mounts visual-boundary scopes for feed, root replies, reply branches, vote pills, and composers. Most routes still render custom loading, refreshing, empty, and error copy locally where the surrounding layout is route-specific | `ui/feedback` with loading boundary, inline loading row, empty state, error state, warning state, status badge, and operation outcome card | Medium |
| Shell, sidebars, rails, and page layout | `ui/layout/nexus-page-frame.tsx`, `ui/layout/nexus-scroll-frame.tsx`, `ui/layout/nexus-panel*.tsx`, `ui/layout/nexus-metric-grid.tsx`, `ui/layout/nexus-section-band.tsx`, `ui/layout/nexus-toolbar-row.tsx`, `features/sidebar/*`, `nexus-shell.tsx`, `nexus-sidebar.tsx`, route-level `NexusSectionHeader`, packet explorer panel layout | Shared layout primitives are available; sidebar feature components now exist | Identity page shell, dashboard/trust/roles metric rows, a Packet Explorer search workbench panel, and sidebar rail/scope/menu components now use shared or feature-local wrappers. Shell/sidebar state remains controller-owned | `ui/layout` with page frame, section header, section band, metric grid, rail section, shell drawer primitives, panel split, and responsive content frame | Medium |
| Preview, focus, and inspection panels | `preview/*`, `focus/*`, dashboard focused panels, packet explorer inspector panels, library packet cards | Feature-specific with reusable pieces | Preview/focus/Explorer all present selected packet context with actions, badges, summary, provenance, and navigation; the visual grammar is related but not unified | `ui/inspection` or `ui/cards` extension with packet summary panel, focus panel, preview rail, inspector section, and packet action slot | Medium |
| Segmented controls and toggles | `NexusSegmentedPill` in `ui/forms/*`; identity security preferences; import source/validation mode; sidebar preference toggles | Shared segmented primitive plus route/sidebar variants | Segmented controls exist, but preference switches and binary toggles are still custom in sidebar/security contexts | `ui/forms` with segmented control, binary toggle, preference row, and compact option group | Low |

## Route-local areas to audit first during consolidation

1. `src/app/nexus/locality/create.tsx`
   - Contains modal variants, type/kind pickers, parent pickers, search result dropdowns, graph rows, preview controls, warning/outcome states, and form fields.
   - Best first extraction targets: modal shell, picker shell, search result list, form field shell.

2. `src/app/nexus/discussions.tsx`
   - Still owns feed/thread/post workspace state, routing, loading, mutations, auth gates, reply branch state, and pagination actions.
   - Feature extraction now lives in `features/discussions/*`: feed/thread/post panels, feed cards, root post cards, vote/reply-count pills, reply tree controls, and post/reply composers. Future work can consider promoting workspace panel shells, scrollable feed panels, thread toolbars, composer shells, reaction/vote skeletons, and recursive tree rails only after non-discussion reuse appears.

3. `app/components/nexus/nexus-sidebar.tsx`
   - Still owns shell state, router/auth hooks, preference persistence, rail animation, and scope mutation handlers.
   - First feature extraction now lives in `features/sidebar/*`: rail toggles, guest avatar, preference switch, current context card, function menu rows, scope section headers, grouped scope rows, scope action menus, and scope menu content. Future work can promote rail toggles, compact nav rows, grouped collapsible sections, and anchored compact action menus only after other surfaces need the same shape.

4. `app/components/nexus/packet-explorer/*`
   - Contains Explorer-specific tabs, toolbars, import/export/search panels, data panels, link groups, and modal outcomes.
   - Best first extraction targets: document-tab extension, workbench panel frame, lookup/result list, import/export outcome dialog.

5. Identity routes and `nexus-identity-ui.tsx`
   - Already have identity field primitives, but route-local selection cards, search results, passphrase forms, and security controls overlap with broader Nexus form needs.
   - Best first extraction targets: field shell generalization, selectable row/card, security preference row.

## Recommended target organization

Future consolidation should create a Nexus-native shared UI home without moving everything at once:

- `app/components/nexus/ui/actions`
  - action buttons, icon/menu buttons, action menus, action clusters, action lists, badge strips
- `app/components/nexus/ui/cards`
  - base cards, packet cards, metric/stat cards, warning/outcome cards, focus/preview cards
- `app/components/nexus/ui/tabs`
  - tab primitives, navigation rails/stacks, segmented controls, Explorer document-tab extensions
- `app/components/nexus/ui/overlays`
  - modal shell, confirmation dialog, outcome dialog, popover, feature-status overlay, auth/entry gates
- `app/components/nexus/ui/forms`
  - field shell, text input, textarea/composer, action row, `search/*`, picker shell, toggles
- `app/components/nexus/ui/layout`
  - page frame, scroll frame, section header, panel/workbench panel, section band, toolbar row, metric grid, rail section, panel split, responsive content frame
- `app/components/nexus/ui/feedback`
  - loading boundary/overlay exports, empty state, error state, warning state, status rows

The existing folders can then become either adapters around the shared UI or feature-specific compositions:

- `packet-explorer/*` should keep Explorer state/workbench logic but use shared tabs, overlays, forms, feedback, and panel frames.
- `locality/*` should keep locality graph/search semantics but use shared picker, form/search, modal, and warning/outcome components.
- `features/discussions/*` keeps discussion-specific workspace, post/reply/vote composition while consuming shared UI primitives and caller-owned loading scopes.
- `features/sidebar/*` keeps sidebar-specific rail, preference, function-menu, scope-list, and scope-action composition while consuming shared UI primitives and caller-owned loading scopes for async scope actions.
- `ui/overlays/*`, `ui/cards/action-card/*`, `ui/actions/action-list/*`, `ui/feedback/loading/*`, and `ui/tabs/*` now form the initial shared UI foundation.
- `ui/forms/search/*` now provides generic search field, result-list, result-row, status, empty/error, and loading-boundary wrappers. It intentionally does not own packet, identity, or locality search behavior.
- `ui/forms/*` now also provides generic field shell, text input, text area, and field action row primitives. Identity-specific field wrappers remain as compatibility adapters around those generic forms.
- `ui/feedback/*` now provides basic inline loading plus empty, error, warning, status, and operation card primitives. Scoped loading remains visual-scope owned by callers.
- `ui/layout/*` now provides page/scroll frames, panel/workbench wrappers, panel headers, section bands, toolbar rows, and metric grids. Panel loading remains caller-owned by visual scope.

## Migration guidance

- Do not begin with a mass folder move. Promote one repeated pattern at a time.
- Preserve live visuals exactly unless a later task explicitly asks for design changes.
- Prefer extracting route-local UI only after at least two call sites need the same behavior.
- Keep runtime/core untouched; this is presentation infrastructure only.
- Treat public-site components as reference material, not dependencies.
- For each extraction pass, update this catalog or replace it with a more precise design-system chapter once the target folder structure becomes real.
