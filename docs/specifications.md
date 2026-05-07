# Open World Assembly Specifications

## Document status

This index describes the repo as it exists in code today.

Use the docs this way:

- `docs/specifications.md` = current implemented behavior and current structure
- `docs/implementation-guide.md` = architecture, decisions, and canon-candidate direction
- `docs/roadmap.md` = planned work, sequencing, and open questions
- `docs/concepts.md` = shared term reference

This document should stay strict about current code truth. If a feature is visible but disabled, it should be described as disabled. If behavior is still planned, it belongs in the roadmap or implementation guide rather than here.

## Current summary

The app is an Expo Router application with a public OWA site and a dedicated Nexus shell under `/nexus/*`.

Current live Nexus areas include:

- packet-backed discussions with shared fortress write preparation and finalize paths
- packet-backed trust and roles surfaces
- a read-only votes workspace
- a scoped Library browse surface
- a shell-level Packet Explorer overlay for deep inspection, lineage, grouped links, and action visibility

Current source split:

- `core/*` = portable packet logic, schemas, builders, contracts, and pure projections
- `runtime/*` = persistence, runtime services, and API glue
- `app/*` = application-layer components, hooks, constants, public content, and shared UI/state
- `src/app/*` = Expo Router route shell and API entrypoints

## Chapters

- [Product Surface](specifications/product-surface.md)
- [Nexus Routes And Workflows](specifications/nexus-routes-and-workflows.md)
- [Architecture And State](specifications/architecture-and-state.md)
- [Known Gaps And Provisional Notes](specifications/known-gaps-and-provisional.md)

### Public action/link model

- Public content actions are represented by `PublicPageAction` in `app/public/content-types.ts`.
- Actions may target internal public routes, external URLs, or static download paths under `/downloads/`.
- Existing internal route `href` usage remains supported as a compatibility bridge while newer content should prefer explicit `target` objects.

