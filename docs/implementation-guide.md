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

- `core/*` = Core Contracts Vault: portable packet law, definitions, builders, defaults, dependencies, policy requirement contracts, graph logic, and verification rules
- `runtime/*` = Trusted Runtime Coordinators: request intake, validation, regulation, planning, building, inspection, testing, certification, archive, verification, import, export, projection, storage, and API glue
- `app/*` = Signal Cockpit: reusable UI, hooks, content, loading state, intent emission, and projection display
- `src/app/*` = Expo Router route shell and API entrypoints

The current product stack is still best understood as:

- OWA = geography-first civic application profile
- Nexus = portable signed-packet substrate, graph engine, and runtime coordination model
- FCF = principles and coordination physics behind the public experience

## Chapter workflow

For the implementation guide, the chapter files under `docs/implementation-guide/*` are the canonical content source.

- update the relevant chapter file first when implementation-guide canon changes
- keep this top-level file as a short index and navigation shell
- do not hand-edit generated public docs artifacts under `app/public/generated/`, `public/downloads/`, or `docs/public/version-records/`

## Chapters

- [Packet Definition Manifest R&D](implementation-guide/packet-definition-manifest-rd.md)
- [Packet Runtime Modernization](implementation-guide/packet-runtime-modernization.md)

- [Architecture And Layers](implementation-guide/architecture-and-layers.md)
- [Nexus UI Component Catalog](implementation-guide/nexus-ui-component-catalog.md)
- [Nexus UI Hard Inventory](implementation-guide/nexus-ui-hard-inventory.md)
- [Core Entities And Packet Model](implementation-guide/core-entities-and-packet-model.md)
- [Trust, Moderation, And Policy](implementation-guide/trust-moderation-and-policy.md)
- [Governance, Initiatives, And Decisions](implementation-guide/governance-initiatives-and-decisions.md)
- [Decision Log 2026-04](implementation-guide/decision-log-2026-04.md)
- [Decision Log 2026-05](implementation-guide/decision-log-2026-05.md)
