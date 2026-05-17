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

## Chapter workflow

For the implementation guide, the chapter files under `docs/implementation-guide/*` are the canonical content source.

- update the relevant chapter file first when implementation-guide canon changes
- keep this top-level file as a short index and navigation shell
- do not hand-edit generated public docs artifacts under `app/public/generated/`, `public/downloads/`, or `docs/public/version-records/`

## Chapters

- [Packet Definition Manifest R&D](implementation-guide/packet-definition-manifest-rd.md)

- [Architecture And Layers](implementation-guide/architecture-and-layers.md)
- [Core Entities And Packet Model](implementation-guide/core-entities-and-packet-model.md)
- [Trust, Moderation, And Policy](implementation-guide/trust-moderation-and-policy.md)
- [Governance, Initiatives, And Decisions](implementation-guide/governance-initiatives-and-decisions.md)
- [Decision Log 2026-04](implementation-guide/decision-log-2026-04.md)
- [Decision Log 2026-05](implementation-guide/decision-log-2026-05.md)
