# Architecture And Layers

## Product layers

The long-term architecture remains a three-layer stack with strict boundaries:

### OWA App

The public-facing civic surface.

- OWA-native framing and navigation
- geography-first assembly experience
- place -> assembly -> deliberation -> proposals or votes -> actions -> record -> learning

### Nexus Browser

The packet and graph surface.

- inspect packets
- follow links
- inspect provenance
- search and filter
- browse incoming and outgoing references

### Nexus Core

The portable engine with no UI assumptions.

- packet typing and validation
- graph building
- read and write operations
- import/export bundles
- merge strategy
- trust hooks
- policy evaluation

The load-bearing rule stays the same: data is the system; platforms are adapters.

## Repository boundaries

The active repo split is:

- `core/*` for portable packet logic, schemas, builders, interpreters, projections, and contracts
- `runtime/*` for persistence, runtime services, query services, auth/trust/discussion orchestration, and API glue
- `app/*` for application-layer components, hooks, constants, public content, and shared state
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
- graph relationships and traversal
- import/export/merge rules
- signing and verification law
- policy evaluation hooks and deterministic business logic

### Adapters own

- routing and navigation
- rendering and layout
- input UX
- device or browser integration
- orchestration around core-owned operations

Adapters should not invent parallel business logic for trust, validation, compatibility, or merge behavior.

### Nexus scoped loading

Nexus loading chrome is an app-layer concern. The scoped loading provider, boundary, overlay, and hook live under `app/components/nexus/loading/*` and track caller-owned visual scopes such as a page, panel, tab, card, menu, or action pane.

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
