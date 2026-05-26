# Product Surface

## Scope today

The product currently has two visible layers:

- a public OWA website shell for orientation and placeholder public pages
- a dedicated Nexus shell under `/nexus/*` for the first guest-facing OWA Nexus slice

Implemented surface today includes:

- public `Home`, `About`, and `Docs` pages inside the public shell
- Nexus identity routes for sign-in, create, claim, restore, and security
- a locality creation route for canonical geographic assembly creation
- Nexus routes for `Dashboard`, `Discussions`, `Votes`, `Roles`, `Trust`, and `Library`
- a shell-level Packet Explorer overlay
- a hidden wrapper-level `/nexus/account` custody route reached from the profile area

Not implemented today:

- remote multi-node sync beyond the local SQLite packet store
- real-time chat
- protected or private spaces
- trust-weighted ranking, moderation enforcement, delegation, or proposal execution
- dedicated routed packet detail pages outside Packet Explorer

## Public docs surface

- the public `/docs` route renders a docs hero, a document directory, a selected readable document panel, and downloads/resources panels
- the current directory includes Charter, Nexus README, Implementation Guide, Specifications, and Roadmap
- readable docs are served from `app/public/generated/public-docs.generated.ts`
- Markdown and PDF downloads are served from generated artifacts under `/downloads/*`
- the readable document surface uses one continuous document with an outline and anchored sections

## Public content links

- public content actions are represented by `PublicPageAction` in `app/public/content-types.ts`
- actions may target internal public routes, external URLs, or static download paths under `/downloads/`
- existing internal route `href` usage remains supported as a compatibility bridge while newer content should prefer explicit `target` objects

## Current surface roles

### Library

Library is the scoped browse surface.

- it is packet-backed
- it defaults to a local-only view keyed to the active authority scope
- `Open packet` launches Packet Explorer without navigating away from Library
- packet actions on Library cards remain intentionally narrow

### Packet Explorer

Packet Explorer is the inspect-and-traverse surface.

- it opens as a shell-level overlay
- it is still read-only for packet mutation, but its Home workspace now includes live search, import, and export workbenches
- packet validation is now a first-class Explorer workflow rather than only a future concept
- it is separate from Library
- it supports session-persistent tabs with an auto-created Home tab
- its Home workspace now splits into `Search`, `Import`, and `Export` sub-tabs rendered directly in the shared inspector row
- `Search` is now a manual grouped packet finder over the current preferred packet index, with `All`, `Direct`, `Name`, and `Text` result groupings, capped preview slices inside `All`, and paged category views for deeper result review
- `Import` now supports two-step packet and bundle ingest through `Analyze` then `Commit`, with paste-first JSON input plus web-only `.json` file upload
- `Import` now also supports three explicit validation modes: `Validate first`, `Validate after`, and `Don't validate`
- `Import` now exposes recent import-report history and direct `Open report` follow-up actions using the existing `import_report` packet type, with the current history view intentionally reflecting the latest local report per imported artifact identity rather than a full append-only event ledger
- `Export` now supports raw preferred-revision packet export, bounded bundle export, full local-store bundle export, a compact direct packet lookup when no export target is preloaded, and an explicit cancel/reset path when a packet export target was preloaded earlier
- it now uses shared packet display-title normalization instead of exposing raw encoded packet ids as loaded titles where a human title can be derived
- it supports `View as` inspection lenses for `Summary`, `Raw`, `Adapted`, and `Read Model`
- it exposes `Data`, `Lineage`, `Verification`, `Links`, and `Actions` inspector rails using the same compact attached-tab style as the Home workspace tabs
- its packet tab deck now presents `Home` as the leftmost workspace tab, uses middle truncation for packet labels, and exposes desktop hover metadata for full packet titles and revision context
- its main content region now reads as one primary scroll surface inside the drawer instead of trapping long packet reads inside tiny inner scroll panes
- its packet-shell and inspector-control header bands can now collapse locally to reclaim vertical space without leaving helper rows behind, and collapsed bands are restored from the top command row
- it groups `Incoming` and `Outgoing` links by related packet, with explicit `Open in new tab`, `Open in current tab`, and `View in Library` actions for graph traversal
- it surfaces read-only `NexusActionState` and `NexusActionIntentDescriptor` data where available
- its verification rail now distinguishes structural validity, compatibility, signature result, signer result, provenance, local trust, and local versus external report history
- its verification rail now includes a direct `Verify` or `Reverify` control, refreshes the active packet payload after local validation, and explicitly surfaces whether the latest local report is current for the preferred revision or stale against newer packet revisions
- packet search rows and export lookup rows now surface cached verification state when available so untrusted or failed packets are visible before opening the inspector

### Discussions

Discussions are the most mature interactive Nexus surface today.

- discussion feed, thread, and post workspaces are packet-backed
- reply, vote, expand, and create actions are now runtime-projected instead of being only page-local heuristics
- interactive writes use the shared prepare/sign/finalize mutation corridor
- compatibility still keeps legacy discussion type shapes readable while canonical discussion packets drive current writes

### Dashboard

Dashboard is now a real packet-backed preview workspace rather than only a shell landing page.

- it loads scope-backed metrics, queue items, and preview packet projections from runtime payloads
- preview sections now use the shared packet-card and action-list language rather than route-local one-off cards
- one packet can be focused at a time inside each preview surface, and that focus state remains local to the surface rather than becoming a routed detail view
- focused packet actions still use the same shared packet action menu language as non-focused preview rows
- packet action menus now include `Validate`, `Revalidate`, and `View verification` where local or imported verification evidence exists

### Locality creation

`/nexus/locality/create` is now a guided review-first locality workflow rather than a thin write form.

- the route still searches the existing locality directory first
- when search does not find the intended locality, the existing `create_candidate` seam now seeds the broad-to-narrow builder directly instead of dead-ending
- top-level search can now still hand off into locality creation when same-name results exist elsewhere, so a result like `Ontario` in one branch does not suppress creating `Ontario` under another chosen parent path
- the create UI can still be edited target-first, but preview and create now normalize that editing state into a broad-to-narrow planner path before runtime planning
- the builder now uses a real non-mutating `Review path` step before any write occurs
- locality rows are now descriptor-first under the hood: each row can carry a hierarchy system, local type label, local type key, and legacy compatibility bucket
- sparse paths are now valid planner truth, so a path such as `Canada -> Vancouver` no longer needs a required intermediate `region` row just to satisfy the old ladder
- review distinguishes reused existing levels from newly planned locality levels
- duplicate warnings are now actionable through `Use existing`, `Edit name`, and `Create anyway`
- `Use as home locality` is now an explicit toggle shared by both existing-locality selection and newly created locality completion
- review can also show a pre-checked home-branch inclusion checklist, but that checklist remains preview-only in this pass and does not yet change persisted home-locality semantics
- created locality packets now record descriptor metadata inside linked `Location.spatial_payload`, while legacy `nation | region | city | district` levels remain compatibility buckets rather than the full future locality model
- locality confirm now writes through one composite runtime apply seam above `locality.path.create`, so locality graph creation, home-locality selection, association, follow, and temporary main-tree display choices are orchestrated together instead of being chained one mutation at a time in the page

### Scope sidebar

The Nexus scope sidebar now reflects the packet-native scope graph more directly.

- it groups scope context into `Main tree`, `Home scopes`, `Associated scopes`, `Followed scopes`, and `Discoverable scopes`
- `Home scopes` render as a projected trunk ordered from the broadest mounted geography down toward the personal `You` scope
- associated scopes now count as mounted related scopes, but remain outside the geographic home trunk rather than being mixed into its ancestry chain
- associated, followed, main, and discoverable scopes are now server-projected grouped sections instead of thin client-side reconstructions from id arrays
- associated and followed sections can now persist lightweight parent-context display independently, using text-only contextual chains rather than full extra scope cards
- `Main tree` defaults to the home scope trunk when no explicit visibility preference has been saved, then uses explicit packet-backed display preferences for add/remove actions over eligible home, associated, and followed scopes
- scope rows stay click-to-open, while secondary actions move into compact side overflow menus
- section placement now carries most of the relationship meaning, rather than depending on inline badge clutter
- follow and association actions now use the canonical packet-native mutation corridor and then refresh shell projection from the server result
- guests are routed through the existing identity/auth gate instead of silently writing follow or association state

### Shared packet-card action UI

Several packet-facing surfaces now share one compact card and row action language.

- dashboard preview rows, focused packet panels, and related Nexus packet lists now use reusable packet action menus instead of route-local action clusters
- compact icon badges can surface packet state without consuming card body space, and expose tooltip detail when needed
- `Open in Explorer` is now part of the shared packet action vocabulary rather than a one-off dashboard affordance
- validation actions now use the same shared packet action language, with local modal feedback and a deep-link path into Explorer verification

### Votes

Votes are currently read-only.

- the route is packet-backed
- guests can inspect governance visibility cues and proposal or vote cards
- voting, objection, delegation, and execution workflows are not yet live
- visible disabled actions now use the same shared feature-status explainer pattern rather than acting like dead buttons

## Current caveats

The following behaviors are not active product truth yet:

- initiative filtering in feeds, Library, or Explorer
- official versus unofficial packet visibility modes
- automoderation or visibility projection beyond current placeholders and packet-backed evidence reads
- projection definitions now drive preferred packet-action surface routing, but they do not yet fully generate generic UI layouts
- available actions are partly runtime-projected, not fully definition-driven
- policy-driven voting and decision execution are still not active
- universal UI component extraction and loading-overlay integration are ongoing
