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

- packet-backed discussions with shared signed write preparation and finalize paths
- packet-backed trust and roles surfaces
- a read-only votes workspace
- a scoped Library browse surface
- a shell-level Packet Explorer overlay for deep inspection, lineage, grouped links, and action visibility

Current source split:

- `core/*` = portable packet logic, schemas, builders, contracts, and pure projections
- `runtime/*` = trusted runtime coordination, persistence, runtime services, and API glue
- `app/*` = application-layer components, hooks, constants, public content, and shared UI/state
- `src/app/*` = Expo Router route shell and API entrypoints

## Chapter workflow

For specifications, the chapter files under `docs/specifications/*` are the canonical content source.

- update the relevant chapter file first when specifications truth changes
- keep this top-level file as a short index and navigation shell
- do not hand-edit generated public docs artifacts under `app/public/generated/`, `public/downloads/`, or `docs/public/version-records/`

## Chapters

- [Product Surface](specifications/product-surface.md)
- [Nexus Routes And Workflows](specifications/nexus-routes-and-workflows.md)
- [Architecture And State](specifications/architecture-and-state.md)
- [Known Gaps And Provisional Notes](specifications/known-gaps-and-provisional.md)
