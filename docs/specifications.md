# Open World Assembly Specifications

## Document status

This document describes the repo as it exists in code today.

It records the currently implemented product surface, route structure, layout behavior, and interaction boundaries. It does not treat canon text, long-range planning copy, or deferred portal ideas as implemented behavior.

Sections marked **Provisional** reflect mock-data surfaces, incomplete workflows, or intentionally deferred systems.

## Current product surface

The app is an Expo Router application with two visible layers:

- a public OWA website shell for orientation and placeholder public pages
- a dedicated portal shell under `/portal/*` for the first guest-facing OWA Nexus slice

Implemented scope today:

- a shared public shell with persistent `Header` and `Footer`
- redesigned public landing, about, and charter destination pages using NativeWind styling
- placeholder public auth destination pages
- a dedicated portal layout for `/portal/*`
- portal routes for `Dashboard`, `Discussions`, `Votes`, `Library`, and `Account`
- portal shell state for scope selection, scope tree expansion, section selection, guest capabilities, and function-first vs scope-first mode
- typed mock portal data for scopes, forums, votes, packets, and guest onboarding cues
- NativeWind-based styling for the portal layer

Not implemented today:

- authenticated user state
- persistent form submission or saved portal actions
- API fetching or remote storage
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

- rotating hero slider with multiple public narratives and generated background artwork
- principle cards for decentralization, consent, and scale
- supporting cards focused on local legitimacy and action-oriented democratic coordination

### `/about`

Screen component: `AboutPage`

Role:

- public explanation page for the system model and civic framing

Status:

- contains multiple expandable content sections
- includes section-link chips that switch focus among the main explanatory areas
- stays within the public site shell and does not enter the portal layout

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

## Portal route tree

The portal now has its own nested route layout under `app/portal/_layout.tsx`.

### `/portal`

Route file: `app/portal/index.tsx`

Role:

- portal entry path
- immediately redirects to `/portal/dashboard`

### `/portal/dashboard`

Screen component: `PortalDashboardPage`

Role:

- guest dashboard and civic control panel
- shows current scope summary, aggregate queues, and recommended packet previews

Status:

- **Provisional**
- driven entirely by seeded mock data

### `/portal/discussions`

Screen component: `PortalDiscussionsPage`

Role:

- Reddit-inspired discussion surface with forum previews and active thread cards
- includes the only enabled guest write affordance in the current portal slice: the visitor lobby composer

Status:

- **Provisional**
- guest posts are local session-only UI state, not persisted packets

### `/portal/votes`

Screen component: `PortalVotesPage`

Role:

- dedicated vote floor surface
- shows public pipeline stages, proposal previews, and governance visibility cues

Status:

- **Provisional**
- guests can inspect but cannot vote, object, or delegate

### `/portal/library`

Screen component: `PortalLibraryPage`

Role:

- basic packet browser surface
- supports packet-type filtering and packet preview cards

Status:

- **Provisional**
- packet actions are visible as placeholders and remain disabled

### `/portal/account`

Screen component: `PortalAccountPage`

Role:

- guest-facing identity and onboarding shell
- shows anonymous guest status, capabilities, followed scopes, and locality/trust placeholders

Status:

- **Provisional**
- no authentication, credential proofs, or persistent profile data is implemented

## Current navigation structure

Navigation is implemented with Expo Router using a top-level stack in `app/_layout.tsx` and a nested portal stack in `app/portal/_layout.tsx`.

### Public shell

Public routes render inside a persistent shell composed of:

- `Header`
- main stack content area
- `Footer`

Current public header links:

- `Home` -> `/`
- `About` -> `/about`
- `Charter` -> `/docs`
- `Nexus` -> `/portal`

Current public behavior:

- the active public link is highlighted from the current pathname
- the `OWA` brand label links to `/`
- the public header no longer exposes auth routes
- the portal is reachable from both the home-page CTA and the `Nexus` header link

### Portal shell

Portal routes do not render the public `Header` or `Footer`.

Portal shell composition:

- two adjacent left-side navigation columns on desktop
- mobile top bar with a toggle that opens the same left-side navigation tray from the left edge
- main surface on the right for the active route

Left-side shell sections:

- compact guest identity strip showing `Anonymous Guest`
- public-site return link at the top of the portal rail
- `Sign In` and `Sign Up` actions
- compact navigation preference switch inside the guest identity strip
- primary navigation column that switches between functions or the scope tree
- secondary navigation column that reveals the other menu immediately to the right
- followed scopes and visitor-channel context inside the secondary column

Portal route list:

- `/portal/dashboard`
- `/portal/discussions`
- `/portal/votes`
- `/portal/library`
- `/portal/account`

## Existing workflows

### Public orientation workflow

Implemented flow:

1. user lands on `/`
2. user reads public framing and summary cards
3. user navigates to `/about`, `/docs`, or `/portal`

### Public site navigation workflow

Implemented flow:

1. user uses the persistent public header on any public route
2. user moves among the public pages
3. current page is indicated by active header-link styling

### Portal entry workflow

Implemented flow:

1. user selects `Enter Portal` from the landing page
2. router enters `/portal`
3. `/portal` redirects to `/portal/dashboard`
4. portal loads in `Global Guest` state with `Global Commons` as the initial scope lens

### Portal scope workflow

Implemented flow:

1. guest opens the scope tree or followed scope chips
2. guest chooses a scope
3. the active scope updates in shared portal shell state
4. dashboard, discussion, vote, library, and account surfaces filter against that scope lens

Status:

- **Provisional**
- the scope model is mock data only

### Portal mode workflow

Implemented flow:

1. guest toggles between `Function-first` and `Scope-first`
2. the primary left rail switches between function tabs and the scope tree
3. the secondary column immediately to the right switches to the complementary menu
4. route structure remains unchanged and the same surfaces remain reachable

Status:

- **Provisional**
- mode is a shell preference only; it does not change data shape or persistence

### Visitor lobby posting workflow

Implemented flow:

1. guest opens `/portal/discussions`
2. guest enters a title and/or body in the visitor lobby composer
3. guest presses `Post to visitor lobby`
4. a local session-only draft preview appears in the discussion surface

Status:

- **Provisional**
- posts are not stored, synced, or converted into durable packets yet

## Major entities and their roles

### Implemented application entities

#### Root layout

Defined by `app/_layout.tsx`.

Role:

- wraps the app in a theme provider
- conditionally applies the public shell only on non-portal routes
- keeps the portal route subtree available in the top-level stack

#### Portal layout

Defined by `app/portal/_layout.tsx`.

Role:

- provides the dedicated portal shell
- mounts the nested portal stack
- shares portal shell state across all portal screens

#### Portal shell provider

Defined by `components/portal/portal-shell-context.tsx`.

Role:

- stores `navigationMode`
- stores `activeScopeId`
- stores `expandedScopeIds`
- derives `activeSection` from the current pathname
- exposes guest capabilities and scope data to portal screens

#### Portal sidebar and shell

Defined by `components/portal/portal-shell.tsx` and `components/portal/portal-sidebar.tsx`.

Role:

- render a compact account header plus a two-stage left-side navigation system
- keep either functions or scopes primary based on shell preference
- render the complementary secondary menu in the adjacent column
- provide responsive collapse behavior while keeping the tray anchored to the left edge

#### Portal mock data

Defined by `data/portal/mock-portal-data.ts`.

Role:

- seeds the current portal UI
- provides scope summaries, dashboard queues, forum previews, vote previews, packet previews, and guest onboarding copy

### Domain-level entities

Status:

- **Provisional**
- there is still no runtime domain model, persistence layer, or packet engine wired into the UI

Important note:

- portal content is packet-themed and type-labeled
- packet, proposal, assembly, mission, and trust concepts remain mock UI data rather than active runtime entities

## Current architecture patterns

### Routing pattern

- Expo Router file-based routing
- top-level stack in `app/_layout.tsx`
- nested portal stack in `app/portal/_layout.tsx`
- `/portal` redirects to `/portal/dashboard`

### Layout pattern

- public and portal shells now have separate layout behavior
- public pages remain centered content pages with shared header/footer chrome
- portal pages render inside a dedicated app-style shell with a persistent left rail on desktop and an overlay shell on smaller screens

### Component pattern

- function components throughout
- route screens use default exports
- portal layout logic is split into reusable components under `components/portal`

### Styling pattern

- public shell chrome and the landing/about/charter pages now use NativeWind `className` styling
- public pages use a dedicated public token set layered into `tailwind.config.js`
- the public landing page hero now includes a rotating slider with generated SVG background imagery
- portal screens and portal shell use NativeWind `className` styling
- portal theme tokens are defined in `tailwind.config.js`
- NativeWind is configured through `babel.config.js`, `metro.config.js`, `global.css`, and `nativewind-env.d.ts`

### State and data pattern

- public pages are still stateless
- portal state is shared through a local React context provider
- all current portal content is mock data, not fetched or persisted data
- no API or storage integration is implemented

## Current naming patterns

### Route file naming

- route filenames are lowercase
- nested routes match URL segments directly

Examples:

- `app/index.tsx`
- `app/portal/dashboard.tsx`
- `app/portal/discussions.tsx`

### Component naming

- React component names use PascalCase
- route components continue to end with `Page`
- shared portal building blocks use descriptive names such as `PortalShell`, `PortalSidebar`, and `PortalCard`

## Repo structure in current use

### Active implementation areas

- `app`
  - public route files, root layout, and portal route files
- `components/layout`
  - shared public header and footer
- `components/portal`
  - portal shell, sidebar, context, and UI primitives
- `data/portal`
  - mock portal data
- `lib/portal`
  - portal route and scope helpers
- `hooks`
  - color scheme helpers
- `constants/theme.ts`
  - shared theme constants and font mappings

### Present but not active in runtime behavior

- `data/schemas`
  - still present but empty
- `domain`
  - still present but not wired into active app behavior
- `lib`
  - now partially active through `lib/portal`, but still not a domain/data engine layer

## Implementation boundaries

What is implemented:

- public route structure
- public header/footer shell
- redesigned public splash, about, and charter destination pages
- dedicated portal shell under `/portal/*`
- first-slice portal surfaces for dashboard, discussions, votes, library, and account
- guest-only interaction policy with visitor-lobby posting as the only enabled write affordance
- typed mock data for scope-aware portal UI blocking

What remains unimplemented but is still referenced by docs or shell affordances:

- real authentication and identity continuity
- persistent packets and packet detail pages
- map / nexus browser
- missions surface
- messages / live chat
- notifications
- protected assemblies and trust-gated spaces
- moderation workflows
- backend data architecture

## Provisional notes

The following areas should still be treated as provisional:

- guest posting behavior beyond the local visitor-lobby mock
- the exact final ontology for assemblies, scopes, and overlays
- how locality claiming, join/start flows, and trust progression will work
- vote execution, delegation, and propagation semantics
- packet actions that currently appear as disabled placeholders
- any architecture in `docs/implementation-guide.md` that is not yet represented in executable code
