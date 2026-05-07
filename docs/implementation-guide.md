# Open World Assembly Implementation Guide

## Purpose and scope

This index is the durable architecture and decision reference for OWA and Nexus.

Use the docs this way:

- `docs/specifications.md` = what exists in code today
- `docs/implementation-guide.md` = architecture, implementation rules, decisions, and canon-candidate direction
- `docs/roadmap.md` = planned work and open questions
- `docs/concepts.md` = shared term reference

This guide can record current implementation rules and future-facing canon candidates, but it should label those clearly and should not present them as current code truth when they are not yet implemented.

## Current summary

The active architecture is:

- `core/*` = portable engine, schemas, packets, projections, and contracts
- `runtime/*` = storage, runtime orchestration, and API-facing glue
- `app/*` = application-layer UI, hooks, content, and shared state
- `src/app/*` = Expo Router route shell and API entrypoints

The current product stack is still best understood as:

- OWA App = public-facing civic surface
- Nexus Browser = graph and inspection surface
- Nexus Core = portable packet engine

## Chapters

- [Architecture And Layers](implementation-guide/architecture-and-layers.md)
- [Core Entities And Packet Model](implementation-guide/core-entities-and-packet-model.md)
- [Trust, Moderation, And Policy](implementation-guide/trust-moderation-and-policy.md)
- [Governance, Initiatives, And Decisions](implementation-guide/governance-initiatives-and-decisions.md)
- [Decision Log 2026-04](implementation-guide/decision-log-2026-04.md)
- [Decision Log 2026-05](implementation-guide/decision-log-2026-05.md)

### Public content link contract cleanup (Pass 10A)

- Public-site actions now use shared content types from `app/public/content-types.ts` rather than component-owned action types.
- `PublicLinkTarget` supports route, external, and static download targets while preserving legacy route `href` fields for existing content.
- External public links are centralized in `app/public/public-links.ts` so Support, footer, and future document/download passes have one place to wire real URLs.


### Docs directory and readable document shell (Pass 10B)

- The public `/docs` route now uses a directory-first shape instead of rendering the OWA Charter as a grid of principle cards.
- Readable documents are consumed from `app/public/generated/public-docs.generated.ts`, which is intentionally shaped as future build output from public Markdown source files.
- The current generated-style module is maintained by hand until the public docs build pipeline compiles Markdown, downloadable artifacts, and reader data.
- The old docs principle-grid components were removed from active use so the docs page can evolve around document directory entries, readable web documents, and static download links.

### Public docs Markdown build pipeline (Pass 10C)

- Public docs source is now declared in `docs/public/public-docs.manifest.json` and compiled by `scripts/build-public-docs.mjs`.
- The build script creates readable document data in `app/public/generated/public-docs.generated.ts`, static Markdown downloads in `public/downloads/`, and hash-based internal version records in `docs/public/version-records/`.
- Source documents may be defined by `sourceDir` or ordered `sourceFiles`, allowing chapter-split docs to compile into one current public artifact per document.
- `npm run docs:build` is wired into `npm run export:web` so Railway/web exports rebuild generated docs before the Expo web build.
- Version records are for internal record-keeping only; the public docs page exposes only the current readable/downloadable document versions.

### Docs reader scroll and action cleanup (Pass 10E)

- The Docs page scroll controls now target the shared `PublicPageShell` scroll view directly instead of using browser `scrollIntoView`, avoiding outer-page scroll jumps that made the footer appear to float over content.
- Document directory actions can render in a stacked layout so `Download .md` and disabled PDF placeholders do not overflow narrow cards.
- The readable document view returned to one continuous card with an internal outline and section dividers, rather than giving each document section its own card.
- The public footer now uses an opaque `bg-public-shell` background so it does not visually blend with scrolled content behind it.
