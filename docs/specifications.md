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

Status:

- packet-backed
- metrics, queue cards, and recommended packets load from `/api/nexus/scopes/[scopeId]/dashboard`

### `/nexus/discussions`

Screen component: `NexusDiscussionsPage`

Role:

- Reddit-inspired discussion surface with horizontal forum tabs and one active forum workspace
- includes the only enabled guest write affordance in the current nexus slice: the visitor lobby composer
- loads and saves visitor-lobby posts through local Expo Router API routes backed by the local SQLite packet store
- requires local web server output so those API routes can execute during development

Status:

- **Provisional**
- visitor-lobby posts persist as canonical `DiscussionThread` and `DiscussionPost` packets inside the local SQLite packet store for web development
- forum tabs are packet-backed from `/api/nexus/scopes/[scopeId]/discussions`, can be deep-linked through the optional `forum` query parameter, and still fall back safely to visitor-lobby when no thread packets are available
- discussion tabs now project one forum per thread kind and prefer authority threads from the active scope over inherited ancestor threads, which prevents duplicate visitor-lobby tabs
- read-only forum tab labels are scope-aware (for example `Sunnymead Ranch general`) even when the backing thread packet is inherited from an ancestor scope
- non-lobby discussion areas remain read-only placeholders even though their forum metadata is now packet-backed

### `/nexus/votes`

Screen component: `NexusVotesPage`

Role:

- dedicated vote floor surface
- shows public pipeline stages, proposal previews, and governance visibility cues

Status:

- packet-backed
- stage cards and vote/proposal cards load from `/api/nexus/scopes/[scopeId]/votes`
- guests can inspect but cannot vote, object, or delegate

### `/nexus/library`

Screen component: `NexusLibraryPage`

Role:

- basic packet browser surface
- supports packet-type filtering and packet preview cards

Status:

- packet-backed
- library cards load from `/api/nexus/scopes/[scopeId]/library` with optional family filtering
- packet actions are visible as placeholders and remain disabled

### `/nexus/account`

Screen component: `NexusAccountPage`

Role:

- guest-facing identity and onboarding shell
- shows anonymous guest status, capabilities, followed scopes, and locality/trust placeholders

Status:

- **Provisional**
- no authentication, credential proofs, or persistent profile data is implemented

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
- the public footer now uses a denser multi-column layout rather than repeating the header nav as simple pills

### Nexus shell

Nexus routes do not render the public `Header` or `Footer`.

Nexus shell composition:

- two adjacent left-side navigation columns on desktop
- mobile top bar with a toggle that opens the same left-side navigation tray from the left edge
- main surface on the right for the active route

Left-side shell sections:

- compact guest identity strip showing `Anonymous Guest`
- anonymous guest avatar between the `OWA Nexus` label and guest display name
- centered brand label, auth actions, and preference rows inside the guest identity strip
- `Sign In` and `Sign Up` actions
- public-site return link positioned beneath the auth actions inside the guest identity strip
- a small `Preferences` tab at the bottom of the guest identity strip that expands a drawer for navigation mode, shell theme, and UI size controls
- compact one-line shell preference rows inside that drawer, with the setting label on the left, the switch centered, and the current mode label on the right
- primary navigation column that switches between the function menu or scope menu
- secondary navigation column that reveals the other menu immediately to the right
- open primary and secondary rails use the same width, and the Nexus UI-size preference also adjusts shared route-surface spacing, typography, badges, buttons, and form controls through the Nexus appearance layer
- the scope menu uses a full visible scope map with a fixed-width connector lane, so every scope stays visible without pushing lower labels to the right
- followed scopes stay with the scope menu column
- deferred surfaces stay with the functions menu column
- current-scope summary card stays with whichever column is currently acting as the scope menu and appears above the branch navigator
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

### Visitor lobby posting workflow

Implemented flow:

1. guest opens `/nexus/discussions`
2. guest receives a session-scoped anonymous guest label for the current browser session
3. guest enters a title and/or body in the visitor lobby composer
4. guest presses `Post to visitor lobby`
5. the request is sent to a local API route, written into the local SQLite packet store as a canonical discussion packet, and returned to the UI

Status:

- **Provisional**
- posts are persisted through the local SQLite packet store in `data/nexus/owa-packets.db`
- visitor-lobby scope resolution accepts both route-safe scope ids and percent-encoded canonical packet refs
- the older `data/nexus/visitor-lobby-bundle.json` file now serves only as a legacy import source during backend initialization

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
- a live visitor-lobby backend that stores canonical discussion packets in the local SQLite packet store and imports the old bundle only for migration
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
