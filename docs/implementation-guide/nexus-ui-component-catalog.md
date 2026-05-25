# Nexus UI Component Catalog

## Purpose

This catalog records the current Nexus UI component landscape before a broader universal-template cleanup. It is an audit artifact only: it should guide later consolidation work without moving files, changing visuals, or coupling Nexus UI to the public site design system.

Public-site components may be useful references, but Nexus should keep its own component system because the public site and Nexus workspace are separate product surfaces.

For exact file-level counts, route-local component candidates, raw React Native primitive usage, and extraction sequencing, see [Nexus UI Hard Inventory](nexus-ui-hard-inventory.md).

## Current pressure points

- `src/app/nexus/locality/create.tsx` and `src/app/nexus/discussions.tsx` are the largest route-local UI surfaces and contain many one-off controls, pickers, composers, modals, and layout sections.
- `app/components/nexus/nexus-ui.tsx` is the main shared primitive file, but it now carries many unrelated primitives in one place.
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

## Component family catalog

| Family | Current files and usages | Current status | Duplication notes | Future template target | Migration risk |
| --- | --- | --- | --- | --- | --- |
| Cards and packet cards | `app/components/nexus/nexus-ui.tsx` (`NexusCard`), `ui/cards/action-card/*`, `focus/*`, `dashboard/*`, route-local nested cards in `trust`, `roles`, `votes`, `library`, `discussions`, `locality/create`, and packet explorer panels | Shared base plus feature-specific compositions | `NexusCard` is used widely, but route files still compose repeated metric cards, inset cards, warning cards, focused packet panels, and packet preview rows manually | `ui/cards` with base surface, metric/stat card, packet card, focused packet panel, warning/outcome card, and repeated inset section patterns | Medium |
| Action buttons, menus, lists, and badge strips | `NexusActionButton` in `nexus-ui.tsx`; `ui/cards/action-card/*`; `ui/actions/action-list/*`; packet action conversion in `packet-actions/*`; dashboard queue/list actions | Strongest shared foundation | Shared action menus and badge strips exist, but route-local action clusters and raw buttons still appear in large pages; button/menu scoped loading is now available but adoption is caller-owned | `ui/actions` with action button, icon/menu button, action menu, action cluster, action list, badge strip, and packet-action adapters | Low |
| Tabs and tab decks | `ui/tabs/nexus-tabs.tsx`, `ui/tabs/nexus-tab-primitives.tsx`, route uses in `roles`, `identity/sign-in`, `locality/create`, packet explorer toolbar and primary rail; Explorer document tabs in `packet-explorer/nexus-packet-explorer-tab-deck.tsx` | Shared navigation tabs plus separate Explorer document tabs | Function-surface tabs and Explorer tabs both use `NexusTabFrame` / `NexusTabLabel`, but differ in close controls, tooltip behavior, wrapping, and session/document semantics | `ui/tabs` with shared frame/label/close primitives, navigation rail/stack, segmented tabs, and Explorer document-tab extension | Medium |
| Modals, gates, confirmations, and overlays | `nexus-auth-gate.tsx`, `nexus-shell-entry-gate.tsx`, `nexus-feature-status-context.tsx`, route-local `Modal` in `dashboard`, `locality/create`, `packet-explorer/import`, plus packet explorer shell overlay | Scattered, partially shared | Repeated backdrop-card-close patterns exist across dashboard validation, import outcomes, locality success/error/remove/type/parent pickers, and auth/entry gates | `ui/overlays` with modal shell, confirmation dialog, outcome dialog, anchored popover, blocking gate, and shell overlay host | High |
| Dropdowns, selects, pickers, and menus | `NexusInlineSelect` in `nexus-ui.tsx`; `NexusActionMenu`; locality kind/parent/result pickers; identity location search; packet explorer search/export lookup lists; sidebar menus | Mixed shared and route-local | Action menus are shared; inline select is shared; most result pickers and search dropdowns are route-local despite similar listbox/search-result behavior | `ui/menus` or `ui/forms` with inline select, anchored menu, searchable result list, picker modal, and selectable row | Medium |
| Text inputs, composers, search fields, and form rows | Raw `TextInput` in `trust`, `roles`, `discussions`, `locality/create`, packet explorer search/import/export; `nexus-identity-ui.tsx` identity fields; discussion reply/post composers | Mostly route-local with one identity-specific shared set | Text inputs use shared appearance classes but not a universal field/composer shell. Search-result dropdowns, multiline composers, passphrase fields, and note fields repeat label/error/hint patterns | `ui/forms` with field shell, text input, textarea/composer, search box, result list, error text, hint text, and field action row | High |
| Loading and feedback states | `ui/feedback/loading/*`; local `isLoading*` flags in route pages; text-only loading states in discussions and packet explorer; warnings/errors with `NexusCard` tones | New shared loading foundation plus local display states | Scoped loading provider/boundary exists, but most routes still render custom loading, refreshing, empty, and error copy locally | `ui/feedback` with loading boundary, inline loading row, empty state, error state, warning state, status badge, and operation outcome card | Medium |
| Shell, sidebars, rails, and page layout | `nexus-shell.tsx`, `nexus-shell-context.tsx`, `nexus-shell-chrome-context.tsx`, `nexus-sidebar.tsx`, route-level `NexusSectionHeader`, page `ScrollView` containers, packet explorer panel layout | Shared shell with large route-local page composition | Route pages repeat scroll containers, page gutters, card grids, metric rows, and section groupings; sidebar is large and contains several embedded control patterns | `ui/layout` with page frame, section header, section band, metric grid, rail section, shell drawer primitives, panel split, and responsive content frame | High |
| Preview, focus, and inspection panels | `preview/*`, `focus/*`, dashboard focused panels, packet explorer inspector panels, library packet cards | Feature-specific with reusable pieces | Preview/focus/Explorer all present selected packet context with actions, badges, summary, provenance, and navigation; the visual grammar is related but not unified | `ui/inspection` or `ui/cards` extension with packet summary panel, focus panel, preview rail, inspector section, and packet action slot | Medium |
| Segmented controls and toggles | `NexusSegmentedPill` in `nexus-ui.tsx`; identity security preferences; import source/validation mode; sidebar preference toggles | Shared segmented primitive plus route/sidebar variants | Segmented controls exist, but preference switches and binary toggles are still custom in sidebar/security contexts | `ui/forms` with segmented control, binary toggle, preference row, and compact option group | Low |

## Route-local areas to audit first during consolidation

1. `src/app/nexus/locality/create.tsx`
   - Contains modal variants, type/kind pickers, parent pickers, search result dropdowns, graph rows, preview controls, warning/outcome states, and form fields.
   - Best first extraction targets: modal shell, picker shell, search result list, form field shell.

2. `src/app/nexus/discussions.tsx`
   - Contains feed/thread/post workspace composition, vote pill, reply tree controls, composers, inline loading states, focus/highlight badges, and pagination actions.
   - Best first extraction targets: composer shell, reaction/vote pane, recursive reply card, inline loading/empty state.

3. `app/components/nexus/nexus-sidebar.tsx`
   - Contains rail layout, section rows, preference drawer, menu buttons, scope rows, and identity/session controls.
   - Best first extraction targets: rail section, preference row/toggle, scope action row, compact menu row.

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
  - field shell, text input, textarea/composer, search box, searchable result list, picker shell, toggles
- `app/components/nexus/ui/layout`
  - page frame, section header, metric grid, rail section, panel split, responsive content frame
- `app/components/nexus/ui/feedback`
  - loading boundary/overlay exports, empty state, error state, warning state, status rows

The existing folders can then become either adapters around the shared UI or feature-specific compositions:

- `packet-explorer/*` should keep Explorer state/workbench logic but use shared tabs, overlays, forms, feedback, and panel frames.
- `locality/*` should keep locality graph/search semantics but use shared picker, form, modal, and warning/outcome components.
- `ui/cards/action-card/*`, `ui/actions/action-list/*`, `ui/feedback/loading/*`, and `ui/tabs/*` now form the initial shared UI folder foundation.

## Migration guidance

- Do not begin with a mass folder move. Promote one repeated pattern at a time.
- Preserve live visuals exactly unless a later task explicitly asks for design changes.
- Prefer extracting route-local UI only after at least two call sites need the same behavior.
- Keep runtime/core untouched; this is presentation infrastructure only.
- Treat public-site components as reference material, not dependencies.
- For each extraction pass, update this catalog or replace it with a more precise design-system chapter once the target folder structure becomes real.
