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
