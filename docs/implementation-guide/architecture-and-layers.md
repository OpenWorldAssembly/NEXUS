# Architecture And Layers

## Architecture shape

The long-term architecture is a three-layer stack with strict boundaries:

### Core Nexus / Core Contracts Vault

The portable packet law and machinery.

- packet schemas, definitions, builders, compatibility, and validation
- defaults definitions and dependencies definitions
- policy requirement contracts and deterministic graph logic
- canonicalization, signing, verification, import/export/merge rules
- no database ownership, private-key custody, route assumptions, UI state, or platform-specific behavior

### Runtime / Trusted Runtime Coordinators

The trusted execution environment around Core.

- session and actor context
- request dispatch and validation
- policy/regulation resolution against live packet state
- packet planning, building, inspection, testing, certification, archival, verification, import, export, and projection
- storage adapters and API-facing glue
- signing-ticket flow and mutation finalization

Runtime coordinators feed live context through the Core Contracts Vault and execute trusted local code. Packet definitions can describe allowed behavior, but imported definitions do not execute runtime behavior.

### Interface / Event Cockpit

The reusable user-facing cockpit.

- surfaces, page layout builders, cards, menus, tabs, badges, forms, modals, and loading overlays
- lightweight input validation and intent emission
- ticket/signing prompts, confirmations, errors, success states, and refresh requests
- projection consumption through view models

The interface should not decide packet validity, policy authority, or graph truth. The Interface Event Coordinator shapes user events, manages client-side validation/loading/refresh lifecycle, and submits intent toward the Trusted Dispatch Coordinator.

The load-bearing rule stays the same: data is the system; platforms are adapters.

## Product framing

The current product stack remains:

- `FCF` = principles and coordination physics
- `Nexus` = portable signed-packet substrate and graph engine
- `OWA` = geography-first civic application profile on Nexus

OWA may provide default policies, default packets, projection preferences, governance presets, and seed choices. OWA should not mutate Nexus packet builders or redefine core packet anatomy.

## Repository boundaries

The active repo split is:

- `core/*` for portable packet logic, schemas, builders, interpreters, definition contracts, pure projections, and graph rules
- `runtime/*` for trusted coordinators, persistence, runtime services, query services, auth/trust/discussion orchestration, and API glue
- `app/*` for Event Cockpit components, hooks, constants, public content, reusable UI, and shared state
- `src/app/*` for the Expo Router route shell and API entrypoints

## Documentation system

The multi-chapter internal docs now use a chapter-first source-of-truth model.

Canonical content lives in:

- `docs/implementation-guide/*`
- `docs/specifications/*`
- `docs/roadmap/*`

The top-level files:

- `docs/implementation-guide.md`
- `docs/specifications.md`
- `docs/roadmap.md`

remain short local index shells only.

Public docs generation is now expected to follow that structure:

- `docs/public/public-docs.manifest.json` owns the ordered public source lists
- `scripts/validate-public-docs.mjs` validates manifest and shell/source-of-truth rules
- `scripts/build-public-docs.mjs` compiles readable docs data, Markdown downloads, PDF downloads, and version records
- generated artifacts under `app/public/generated/`, `public/downloads/`, and `docs/public/version-records/` are derived outputs and should not be edited by hand

Expected workflow:

- update chapter files first
- run `npm run docs:validate` after canon doc edits
- rely on `npm run docs:build` during site/export builds or when intentionally refreshing generated public docs artifacts

## Core versus adapters

### Core owns

- packet schemas and validation
- packet definitions, builders, defaults definitions, and dependencies definitions
- graph relationships and traversal
- import/export/merge rules
- signing and verification law
- policy requirement hooks and deterministic business logic

### Runtime owns

- trusted coordinator workflows
- live packet lookup and storage writes
- actor/session context
- signing-ticket flow
- policy resolution against current state
- verification reports and runtime-owned indexes
- API-facing orchestration

### Adapters and interface own

- routing and navigation
- rendering and layout
- input UX
- loading, confirmation, and error chrome
- device or browser integration
- projection display

Adapters should not invent parallel business logic for trust, validation, compatibility, policy, or merge behavior.

### Nexus scoped loading

Nexus loading chrome is an app-layer concern. The scoped loading provider, boundary, overlay, and hook live under `app/components/nexus/ui/feedback/loading/*` and track caller-owned visual scopes such as a page, panel, tab, card, menu, or action pane.

The loading system must not depend on packet type, mutation intent, packet action registry entries, or runtime operation categories. Runtime and core code should remain unaware of blur overlays, spinners, and UI input blocking.

The active state starts immediately so duplicate input inside the same boundary can be blocked before the delayed visual overlay appears. The visible state is delayed to prevent spinner flicker on fast operations, and visible overlays may remain briefly to satisfy the minimum visible duration.

Shared Nexus buttons and action-menu items can carry optional loading scopes, allowing common action chrome to start scoped loading without knowing packet types or runtime operation semantics. The UI site still owns the visual scope choice because it knows which page, panel, tab, card, menu, or action pane should be blocked.

## Navigation and shell model

The intended navigation model still uses three mental axes:

- place or scope
- topic or work
- time or evidence

The current implemented Nexus slice is a practical early version of that model, with:

- dashboard
- discussions
- votes
- roles
- trust
- library
- packet explorer as a shell-level inspection workspace
- account and identity custody as wrapper-level surfaces
