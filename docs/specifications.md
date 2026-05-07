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


### Public docs page structure

- The `/docs` route renders a public docs hero, document directory, selected readable document, and downloads/resources panel.
- The Charter, Nexus README, Implementation Guide, Specifications, and Roadmap are currently selectable and readable on-page through `PublicDocumentReader` and `PUBLIC_READABLE_DOCUMENTS`.
- Directory entries currently include the OWA Charter, Nexus README, Implementation Guide, Specifications, and Roadmap.
- Generated Markdown download actions point at `/downloads/*` artifacts and trigger browser downloads on web. PDF actions remain disabled placeholders until the PDF export pipeline is implemented.

### Public docs generated artifacts

- The `/docs` page can switch its readable panel between Charter, Nexus README, Implementation Guide, Specifications, and Roadmap entries.
- Directory read buttons select the readable document in-page and scroll to the reader anchor; Markdown download buttons point at generated static files under `/downloads/`.
- `scripts/build-public-docs.mjs` is the current source of truth for compiling public Markdown sources into generated reader data and static Markdown downloads.
- Generated PDF actions remain disabled placeholders until a PDF export step is added.
- The document reader displays a local outline and anchored section cards for long generated documents; this is separate from the reusable secondary navigation system for now.

### Public Docs Reader Behavior

- Public document cards may expose a `Read Below` action that selects the current document and scrolls the Docs page shell to the readable document panel.
- Reader outline items scroll within the public page shell rather than using browser-level document scrolling.
- Markdown downloads use static files generated into `public/downloads/` and should be triggered as browser downloads on web.
- PDF actions remain disabled placeholders until the PDF pipeline is added.

### Core packet ontology foundation

- `core/schema/packet-schema.ts` now supports four additional forward packet families: `Cause`, `Action`, `Relation`, and `Location`.
- `Element` bodies now support broader scope/entity metadata, including `type`, `scope_kind`, `scope_system`, `status`, alias arrays, and optional custody hints, while preserving legacy locality and identity fields.
- `Policy` bodies now support structured `dependency_policy` and `alignment_policy` sections in addition to the older trust and write policy fields.
- `core/packets/*` now includes forward builders and family-owned build definitions for `Cause`, `Action`, `Relation`, and `Location`.
- `core/projections/forward-ontology.ts` provides narrow forward projections so legacy `Initiative` / `Program` / `Campaign` packets can be read as cause-shaped projections, mission-family packets can be read as action-shaped projections, and claim packets can be read as relation assertions.
- Existing stored packet families remain readable through compatibility handling; this pass does not add new routes or visible product workflows.
