# Open World Assembly Specifications

## Document status

This document describes the repo as it exists in code today.

It records the currently implemented product surface, route structure, layout behavior, and interaction boundaries. It does not treat canon text, long-range planning copy, or deferred nexus ideas as implemented behavior.

Sections marked **Provisional** reflect incomplete workflows or intentionally deferred systems.

## Current product surface

The app is an Expo Router application with two visible layers:

- a public OWA website shell for orientation and placeholder public pages
- a dedicated nexus shell under `/nexus/*` for the first guest-facing OWA nexus slice

Implemented scope today:

- a shared public shell with persistent `Header` and `Footer`
- redesigned public landing, about, and charter destination pages using NativeWind styling
- placeholder public auth destination pages
- a dedicated nexus layout for `/nexus/*`
- nexus routes for `Dashboard`, `Discussions`, `Votes`, `Library`, and `Account`
- nexus shell state for scope selection, section selection, guest capabilities, and function-first vs scope-first mode
- packet-backed shell and scope query APIs feeding dashboard, discussions, votes, and library surfaces
- NativeWind-based styling for the nexus layer

Not implemented today:

- authenticated user state
- persistent form submission or saved nexus actions
- remote multi-node sync beyond the local SQLite packet store
- real packet detail routes
- real-time chat
- protected/private spaces
- trust-weighted ranking, delegation, or moderation workflows

## Current routes and screens

The route tree is file-based and defined by the `app` directory.

### `/`

Screen component: `HomePage`

Role:

- public landing page for OWA
- introduces OWA as a democratic coordination layer for humanity
- presents three call-to-action links: `Learn More`, `Read the Charter`, and `Browse the Nexus`

Implemented content blocks:

- rotating hero slider with multiple public narratives, generated background artwork, slower eased horizontal carousel transitions, and a dedicated control row below a clipped slide viewport
- principle cards for decentralization, consent, and scale
- supporting cards focused on local legitimacy and action-oriented democratic coordination

### `/about`

Screen component: `AboutPage`

Role:

- public explanation page for the system model and civic framing

Status:

- contains multiple canon/workspace-derived public explanation sections
- includes a dedicated section navigator that centers the chosen chapter in view
- drives both the active chapter state and the section animations from one shared focus line at the vertical midpoint of the visible scroll viewport
- measures the actual scroll viewport inside the public shell so chapter focus is centered between the header and footer rather than against the full browser window
- collapses and expands each chapter card based on a widened midpoint-distance interpolation band with a short center hold
- gives each section its own parallax background artwork
- uses a restrained parallax background shift that stays in sync with the same longer chapter progress curve
- separates chapters with larger vertical spacing so the page reads as distinct sections rather than a continuous strip of imagery
- softens chapter edges with stronger blurred edge strips and shadows rather than a true masked fade effect
- presents each section as a large scroll chapter rather than a compact accordion card
- stays within the public site shell and does not enter the nexus layout

### `/docs`

Screen component: `DocsPage`

Role:

- public charter destination page

Status:

- still **Provisional** because the charter text itself is not written yet
- now frames `/docs` as the charter route and explains the role of canon, implementation guide, and workspace notes as current source material

### `/login`

Screen component: `LoginPage`

Role:

- placeholder authentication entry point

Status:

- **Provisional**
- contains static placeholder copy only
- no real auth flow, validation, or session handling is implemented

### `/signup`

Screen component: `SignupPage`

Role:

- placeholder account creation entry point

Status:

- **Provisional**
- contains static placeholder copy only
- no account creation or onboarding workflow is implemented

## Nexus route tree

The nexus now has its own nested route layout under `app/nexus/_layout.tsx`.

### `/nexus`

Route file: `app/nexus/index.tsx`

Role:

- nexus route entry path
- immediately redirects to `/nexus/dashboard`

### `/nexus/dashboard`

Screen component: `NexusDashboardPage`

Role:

- guest dashboard and civic control panel
- shows current scope summary, aggregate queues, and recommended packet previews
- uses the shared nexus page shell with a compact header titled as `<scope> Dashboard`

Status:

- packet-backed
- metrics, queue cards, and recommended packets load from `/api/nexus/scopes/[scopeId]/dashboard`

### `/nexus/discussions`

Screen component: `NexusDiscussionsPage`

Role:

- Reddit-inspired discussion surface with horizontal forum tabs plus three internal discussion workspaces: `Feed`, `Thread`, and `Post`
- includes packet-backed forum feed state, thread detail state, inline targeted reply composition, nested replies, and universal packet vote controls for discussion posts
- renders the active forum as one connected shell: top-level discussion tabs attach to the active forum container, and inner workspace tabs attach to the active feed/thread/post pane rather than floating as separate cards
- uses local Expo Router API routes backed by the canonical SQLite packet store and derived discussion/vote indexes
- requires local web server output so those API routes can execute during development
- uses the same shared nexus page shell and compact scope-first header pattern as the other nexus routes
- route title casing now follows normal title case, for example `Global Commons Discussions`

Status:

- **Provisional**
- discussion forums and top-level feeds are loaded from `/api/nexus/scopes/[scopeId]/discussions` with optional `forum`, `sort`, `show_hidden`, and `viewer_session_id` query parameters
- discussion forums and top-level feeds now support cursor paging through optional `cursor` and `limit` query parameters
- discussion thread detail is loaded from `/api/nexus/scopes/[scopeId]/discussions/thread` with `post_packet_id` plus optional `reply_sort`, `show_hidden`, `viewer_session_id`, `cursor`, and `limit` query parameters
- direct child replies for any post are loaded from `/api/nexus/scopes/[scopeId]/discussions/replies` with `thread_post_packet_id`, `parent_post_packet_id`, and optional `reply_sort`, `show_hidden`, `viewer_session_id`, `cursor`, and `limit` query parameters
- local workspace state on `/nexus/discussions` is route-driven through `view` (`feed | thread | post`), `post`, `replyTo`, `sort`, `replySort`, and `showHidden` query parameters
- discussion tabs now project one forum per thread kind and prefer authority threads from the active scope over inherited ancestor threads, which prevents duplicate visitor-lobby tabs
- read-only forum tab labels are scope-aware (for example `Sunnymead Ranch general`) even when the backing thread packet is inherited from an ancestor scope
- guest writer identity is session-scoped and anonymous, top-level post creation is point-gated, replies are threaded, and the same universal `PacketVote` model powers `+1/-1` controls on posts and replies
- the active anonymous guest session label is reused across posts, replies, and packet votes and is persisted through packet external refs plus the derived anonymous actor key
- feed sorting controls now live inside the `Feed` workspace, reply sorting controls live inside the `Thread` workspace, and `New post` actions are available from both the feed and thread workspaces
- feed and reply sort options now render as single segmented pills with the active sort highlighted; the visible options are currently `new`, `top`, `controversial`, and `old`, and both workspaces default to `new` sorting when no explicit query override is present
- feed cards themselves now act as the primary thread-open affordance, while the inline action row on feed cards is limited to vote, descendant-total reply count, and moderation state
- the `Thread` workspace auto-opens the current top feed item when no explicit thread is selected, and otherwise falls back to an empty-state guidance card when the active forum has no visible top-level posts
- reply creation is written through `/api/nexus/scopes/[scopeId]/discussions/replies` using `parent_post_packet_id` in the request body, and packet votes are written through `/api/nexus/packets/vote` using `target_packet_id` in the request body
- seeded visitor-lobby starter posts exist across the initial scope tree so zero-start anonymous guests can reply immediately and begin earning points
- packet mechanics stay outside the screen layer: canonical writes, preferred-revision updates, vote tally refresh, reply-tree construction, and future bundle import/export or merge behavior remain on the packet-store plus server-service boundary, while the route screen consumes API projections
- the thread detail surface now visually distinguishes the root `Original post` from the reply tree so nested replies read as derivative discussion
- replies at depth `0-4` render expanded by default, while depth `5+` branches default to collapsed `Continue thread` affordances until the user expands them
- each reply card now exposes its collapse or expand control from a dedicated left-hand tree rail, collapsing a reply hides that reply card and its descendants together, and the rail shows a child-count bubble when that branch has replies
- each reply rail now uses one combined arrow-plus-count marker, and that count reflects the entire branch hidden by that control (`the reply itself + all descendants`) rather than only direct children
- collapsed replies keep only their plain author/timestamp meta row visible beside the rail; reply body content, pills, and child cards stay hidden until the branch is expanded again
- the feed and thread workspaces both use taller internal scroll surfaces on larger screens while falling back to normal page scrolling on smaller screens
- after a reply is submitted, the inline reply composer closes and the thread remains in view with the newly created reply visually highlighted
- reply composers now expose a `Cancel` action, and collapsing the targeted branch keeps the in-progress reply body as temporary front-end draft state instead of discarding it
- discussion action buttons now use the shared compact button footprint instead of stretching across the full content column
- the thread workspace uses `New reply` actions, at the top-right and bottom-left of the pane, to target the original post directly; nested replies still use `Reply here` on the relevant reply card
- vote pills now show selected `+1` or `-1` state by segment highlighting instead of appending `set` text, and reply-count pills match the same height rhythm as the vote control
- thread-side post cards no longer repeat inline reply-count pills; the root thread count is shown in the `REPLIES (n)` section heading instead
- reply cards render as meta-plus-body only, without a duplicated reply-title treatment, and reply composers identify their target as `Replying to OP` or `Replying to {author} - {timestamp}`
- discussion sort bars now stay on one line by default with adjacent action pills, while `Show moderated` is allowed to wrap only when the viewport becomes too narrow to keep the full control set visible
- the top-right route header shows the session short label plus point balance and no longer repeats an `Anonymous Guest` status badge

### `/nexus/votes`

Screen component: `NexusVotesPage`

Role:

- dedicated vote floor surface
- shows public pipeline stages, proposal previews, and governance visibility cues
- uses the shared nexus page shell with a compact header titled as `<scope> Votes`

Status:

- packet-backed
- stage cards and vote/proposal cards load from `/api/nexus/scopes/[scopeId]/votes`
- guests can inspect but cannot vote, object, or delegate

### `/nexus/library`

Screen component: `NexusLibraryPage`

Role:

- basic packet browser surface
- supports packet-type filtering and packet preview cards
- uses the shared nexus page shell with a compact header titled as `<scope> Library`

Status:

- packet-backed
- library cards load from `/api/nexus/scopes/[scopeId]/library` with optional family filtering
- packet actions are visible as placeholders and remain disabled

### `/nexus/account`

Screen component: `NexusAccountPage`

Role:

- guest-facing identity and onboarding shell
- shows anonymous guest status, capabilities, followed scopes, and locality/trust placeholders
- uses the shared nexus page shell with a compact header titled as `<scope> Account`

Status:

- **Provisional**
- no authentication or credential proofs are implemented
- the account page title now reflects the active scope, while the page content shows the current anonymous session label and points balance rather than a generic anonymous-guest placeholder

## Current navigation structure

Navigation is implemented with Expo Router using a top-level stack in `app/_layout.tsx` and a nested nexus stack in `app/nexus/_layout.tsx`.

### Public shell

Public routes render inside a persistent shell composed of:

- `Header`
- main stack content area
- `Footer`

Current public header links:

- `Home` -> `/`
- `About` -> `/about`
- `Charter` -> `/docs`
- `Nexus` -> `/nexus`

Current public behavior:

- the active public link is highlighted from the current pathname
- the `OWA` brand label links to `/`
- the public header no longer exposes auth routes
- the nexus is reachable from both the home-page CTA and the `Nexus` header link
- the public footer now uses a compact single-row layout with minimal brand copy, lightweight page links, and one `Nexus` action

### Nexus shell

Nexus routes do not render the public `Header` or `Footer`.

Nexus shell composition:

- two adjacent left-side navigation columns on desktop
- mobile top bar with a toggle that opens the same left-side navigation tray from the left edge
- main surface on the right for the active route
- all nexus routes now use one shared centered page frame with consistent width, compact headers, and scope-first route titles such as `Global Commons Library`

Left-side shell sections:

- compact guest identity strip showing `Anonymous Guest`
- anonymous guest avatar between the `OWA Nexus` label and guest display name
- centered brand label, auth actions, and preference rows inside the guest identity strip
- guest display name in the profile strip now uses the real session-scoped anonymous label, and the current point balance is shown directly beneath it
- `Sign In` and `Sign Up` actions
- public-site return link positioned beneath the auth actions inside the guest identity strip
- a small `Preferences` tab at the bottom of the guest identity strip that expands a drawer for navigation mode, shell theme, and UI size controls
- the preferences tab is visually attached to the drawer as its footer row, uses a chevron icon instead of `open/hide` text, and animates open or closed
- compact one-line shell preference rows inside that drawer, with the setting label on the left, the switch centered, and the current mode label on the right
- primary navigation column that switches between the function menu or scope menu
- secondary navigation column that reveals the other menu immediately to the right
- open primary and secondary rails use the same width, and the Nexus UI-size preference also adjusts shared route-surface spacing, typography, badges, buttons, and form controls through the Nexus appearance layer
- the scope menu uses a full visible scope map with a fixed-width connector lane, so every scope stays visible without pushing lower labels to the right
- the secondary rail now always pins a separate current-context snapshot card at its top, mirroring the guest profile card and exposing quick assembly stats such as activity level, member count, and trust score
- the scope snapshot card is now a smaller metrics-only lens with no descriptive body copy or badges, and its three stat tiles change with the active Nexus section while keeping the same compact card shape
- followed scopes stay with the scope menu column
- deferred surfaces stay with the functions menu column
- current-scope summary card is pinned to the top of the secondary rail regardless of whether the secondary rail is currently showing the scope menu or function menu, and it no longer shares a container with the scope map
- current-context badges stay inside the card and wrap within the available width when labels run long
- the shell theme preference affects the dedicated Nexus shell, the nested Nexus navigator background, and the current Nexus route surfaces without changing the public-site shell
- secondary rail can remain open even when the primary rail is collapsed
- each rail can be collapsed independently and remembers its own open or closed state
- left and right swipe gestures collapse or expand the rails from the outside in and inside out

Nexus route list:

- `/nexus/dashboard`
- `/nexus/discussions`
- `/nexus/votes`
- `/nexus/library`
- `/nexus/account`

## Existing workflows

### Public orientation workflow

Implemented flow:

1. user lands on `/`
2. user reads public framing and summary cards
3. user navigates to `/about`, `/docs`, or `/nexus`

### Public site navigation workflow

Implemented flow:

1. user uses the persistent public header on any public route
2. user moves among the public pages
3. current page is indicated by active header-link styling

### Nexus entry workflow

Implemented flow:

1. user selects `Enter Nexus` from the landing page
2. router enters `/nexus`
3. `/nexus` redirects to `/nexus/dashboard`
4. nexus loads in `Global Guest` state with `Global Commons` as the initial scope lens

### Nexus scope workflow

Implemented flow:

1. guest opens the scope menu branch navigator or followed scope chips
2. guest chooses a scope
3. the active scope updates in shared nexus shell state
4. dashboard, discussion, vote, library, and account surfaces filter against that scope lens

Status:

- packet-backed
- scope summaries are now loaded from `/api/nexus/shell` and derived from `Element(kind: "assembly")` packets
- shell scope ids are route-safe labels (for example `global-commons`) that map server-side to canonical packet refs

### Nexus mode workflow

Implemented flow:

1. guest toggles between `Function-first` and `Scope-first`
2. the primary left rail switches between the function menu and the scope menu
3. the secondary column immediately to the right switches to the complementary menu
4. route structure remains unchanged and the same surfaces remain reachable

Status:

- **Provisional**
- mode is a shell preference only; it does not change data shape or persistence

### Discussion posting workflow

Implemented flow:

1. guest opens `/nexus/discussions`
2. guest receives a session-scoped anonymous guest label for the current browser session
3. guest loads a forum feed from `/api/nexus/scopes/[scopeId]/discussions`
4. guest can switch between `Feed`, `Thread`, and `Post` workspaces without leaving the route
5. guest can open a root post by pressing its feed card, the `Thread` workspace auto-opens the current top feed item when no explicit post is selected, and the guest can reply to any post in that tree through an inline composer attached to the selected reply target while voting `+1/-1` on visible discussion posts when the thread participation rules allow it
6. feed sorting happens inside the `Feed` workspace, reply sorting happens inside the `Thread` workspace, and the feed/thread workspaces both provide direct navigation into the `Post` workspace for new top-level posts
7. top-level posts are allowed only when the viewer has enough points for that thread's `top_level_post_cost`
8. top-level feeds and reply branches are loaded incrementally through cursor-based API pages rather than returning the entire forum or thread tree in one payload
9. discussion writes are sent to the local API routes, written into the local SQLite packet store as canonical `DiscussionPost` or `PacketVote` packets, and then re-projected back into the feed/detail UI
10. the anonymous guest session id and short label are preserved on those packets through external refs and the same actor key used for vote ownership and point ledgers

Status:

- **Provisional**
- discussion packets and packet votes are persisted through the local SQLite packet store in `data/nexus/owa-packets.db`
- anonymous guests currently receive a temporary `10`-point testing grant, replies are free, top-level posts cost `10`, and only positively scored replies earn ongoing spendable points in the current implementation
- discussion moderation is derived from raw packet votes: content is deprioritized at `total_votes >= 4 && net_score <= -2` and auto-hidden at `total_votes >= 6 && downvote_ratio >= 0.75`
- visitor-lobby scope resolution accepts both route-safe scope ids and percent-encoded canonical packet refs
- the older `data/nexus/visitor-lobby-bundle.json` file now serves only as a legacy import source during backend initialization
- discussion packets do not stand alone: `DiscussionThread` packets attach to scope `Element` packets through `authority_scope_ref` and `applicable_scope_refs`, top-level and reply posts attach to their thread through `thread_ref`, and nested replies attach to parent posts through `reply_to_ref`

## Major entities and their roles

### Implemented application entities

#### Root layout

Defined by `app/_layout.tsx`.

Role:

- wraps the app in a theme provider
- conditionally applies the public shell only on non-nexus routes
- keeps the nexus route subtree available in the top-level stack

#### Nexus layout

Defined by `app/nexus/_layout.tsx`.

Role:

- provides the dedicated nexus shell
- mounts the nested nexus stack
- shares nexus shell state across all nexus screens

#### Nexus shell provider

Defined by `components/nexus/nexus-shell-context.tsx`.

Role:

- stores `navigationMode`
- stores `activeScopeId`
- stores `expandedScopeIds`
- derives `activeSection` from the current pathname
- exposes guest capabilities and scope data to nexus screens

#### Nexus sidebar and shell

Defined by `components/nexus/nexus-shell.tsx` and `components/nexus/nexus-sidebar.tsx`.

Role:

- render a compact account header plus a two-stage left-side navigation system
- keep either functions or scopes primary based on shell preference
- render the complementary secondary menu in the adjacent column
- render the scope menu as a full visible scope map rather than an indented nested tree
- keep scope-only support content with the scope menu and function-only support content with the function menu
- support persisted rail collapse state and horizontal swipe collapse/expand behavior
- provide responsive collapse behavior while keeping the tray anchored to the left edge

#### Nexus query payloads

Defined by:

- `lib/nexus/server/nexus-query-data.ts`
- `app/api/nexus/shell+api.ts`
- `app/api/nexus/scopes/[scopeId]/*+api.ts`

Role:

- project packet-store data into shell, dashboard, discussions, votes, and library payloads
- keep UI clients decoupled from storage classes through route-level contracts
- preserve the old visitor-lobby JSON bundle only as a legacy migration source during service bootstrap

### Domain-level entities

Status:

- packet-backed
- runtime packet-schema foundation under `domain/*` is now wired into active nexus surfaces through server query routes
- there are now typed packet builders and an initial seed packet dataset under `domain/packets/*`
- there are now Expo and Node SQLite-backed `PacketStore` implementations under `storage/*`, plus concrete browser/nexus query-service implementations that read from the same SQLite search index

Important note:

- nexus content is packet-themed and type-labeled
- packet, proposal, assembly, mission, and trust concepts now render from packet-backed API projections on the active nexus routes
- seed packet data is now loaded into the local SQLite store through the shared server bootstrap when no assembly packets exist yet
- query services remain the projection seam, while packet detail routes and deeper action workflows are still pending

## Current architecture patterns

### Routing pattern

- Expo Router file-based routing
- top-level stack in `app/_layout.tsx`
- nested nexus stack in `app/nexus/_layout.tsx`
- `/nexus` redirects to `/nexus/dashboard`

### Layout pattern

- public and nexus shells now have separate layout behavior
- public pages remain centered content pages with shared header/footer chrome
- nexus pages render inside a dedicated app-style shell with a persistent left rail on desktop and an overlay shell on smaller screens

### Component pattern

- function components throughout
- route screens use default exports
- nexus layout logic is split into reusable components under `components/nexus`

### Styling pattern

- public shell chrome and the landing/about/charter pages now use NativeWind `className` styling
- public pages use a dedicated public token set layered into `tailwind.config.js`
- the public landing page hero now includes a rotating slider with generated SVG background imagery
- the public about page uses large scroll-driven chapters with per-section parallax artwork and smooth scroll-based emphasis
- nexus screens and nexus shell use NativeWind `className` styling
- nexus theme tokens are defined in `tailwind.config.js`
- NativeWind is configured through `babel.config.js`, `metro.config.js`, `global.css`, and `nativewind-env.d.ts`

### State and data pattern

- public pages are still stateless
- nexus state is shared through a local React context provider
- shell scope data and active route cards now load from packet-backed API routes
- visitor-lobby read and write flows use the same local packet store as shell/query projections
- server bootstrap backfills missing personal-tree seed packets on startup so partially-seeded local DBs recover automatically
- Node SQLite writes use strict query-specific named-parameter bindings to avoid runtime binding errors during packet updates
- local web forum persistence depends on `expo.web.output = "server"` in `app.json`
- packet import/export bundles, revision publishing, and merge behavior remain defined by the `PacketStore` contract and storage/service layer rather than in route components

## Current naming patterns

### Route file naming

- route filenames are lowercase
- nested routes match URL segments directly

Examples:

- `app/index.tsx`
- `app/nexus/dashboard.tsx`
- `app/nexus/discussions.tsx`
- `app/api/nexus/shell+api.ts`
- `app/api/nexus/scopes/[scopeId]/dashboard+api.ts`
- `app/api/nexus/scopes/[scopeId]/visitor-lobby+api.ts`

### Component naming

- React component names use PascalCase
- route components continue to end with `Page`
- shared nexus building blocks use descriptive names such as `NexusShell`, `NexusSidebar`, and `NexusCard`

## Repo structure in current use

### Active implementation areas

- `app`
  - public route files, root layout, and nexus route files
- `components/layout`
  - shared public header and footer
- `components/nexus`
    - nexus shell, sidebar, context, and UI primitives
- `data/nexus`
  - runtime packet database files plus legacy migration artifacts such as the old visitor-lobby bundle
- `domain`
  - package-style packet foundation split into schema, core, packets, and projections
- `storage`
  - packet-store schema constant, SQLite row projections, shared query-service logic, and the Expo/Node SQLite-backed packet-store and query-service implementations
- `lib/nexus`
    - nexus route/scope helpers, packet-backed query API clients, and server projection/repository helpers
- `hooks`
  - color scheme helpers
- `constants/theme.ts`
  - shared theme constants and font mappings

### Present but not active in runtime behavior

- `domain/schema`
  - defines the canonical `PacketEnvelope`, packet-family Zod schemas, packet refs, revision refs, multi-parent revision ancestry, and parser entrypoints
- `domain/core`
  - defines `PacketStore`, `BrowserQueryService`, and `NexusQueryService` interfaces, including preferred-revision and revision-head contracts
- `storage`
  - defines the concrete persistence layer and query adapters, including SQLite-oriented record projections, schema initialization, Expo/native packet-store logic, Node/server packet-store logic, and shared browser/nexus query-service implementations
- `domain/projections`
  - derives display labels, titles, summaries, and statuses from canonical packet family plus subtype
- `lib`
  - now partially active through `lib/nexus`, but still not the canonical domain/data engine layer

## Implementation boundaries

What is implemented:

- public route structure
- public header/footer shell
- redesigned public splash, about, and charter destination pages
- dedicated nexus shell under `/nexus/*`
- first-slice nexus surfaces for dashboard, discussions, votes, library, and account
- guest-only interaction policy with visitor-lobby posting as the only enabled write affordance
- packet-backed shell and scope query routes feeding active nexus surfaces
- canonical packet schema definitions with nested `header/body` envelopes
- stable `packet_id` plus immutable `revision_id` packet identity rules
- multi-parent revision ancestry for divergent branches and merge revisions
- typed packet edges, scope refs, packet-store interfaces, a SQLite-backed packet-store implementation, and storage schema definitions
- shared browser and nexus query-service implementations over the packet search index
- a packet-backed discussion engine that stores canonical discussion and packet-vote packets in the local SQLite packet store, projects derived reply/vote/ledger indexes, and imports the old visitor-lobby bundle only for migration
- derived packet label helpers for future browser and nexus projections

What remains unimplemented but is still referenced by docs or shell affordances:

- real authentication and identity continuity
- persistent packets and packet detail pages
- map / nexus browser
- missions surface
- messages / live chat
- notifications
- protected assemblies and trust-gated spaces
- moderation workflows
- packet detail routes and cross-surface navigation from card projections into packet inspectors

## Provisional notes

The following areas should still be treated as provisional:

- guest posting behavior beyond the local visitor-lobby packet-store implementation
- the exact final ontology for assemblies, scopes, and overlays
- how locality claiming, join/start flows, and trust progression will work
- vote execution, delegation, and propagation semantics
- packet actions that currently appear as disabled placeholders
- any architecture in `docs/implementation-guide.md` beyond the new packet schema foundation that is not yet represented in executable code
