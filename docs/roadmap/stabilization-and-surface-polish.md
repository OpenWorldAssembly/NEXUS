# Stabilization And Surface Polish

## Current baseline

The repo already has:

- the `core / runtime / app / src/app` split
- packet schema and builder foundations
- SQLite-backed packet and revision storage
- cryptographic identity continuity
- packet-backed discussions and attestations
- a functional Nexus shell
- a Packet Explorer with live Search, Import, and Export workbenches

The next planning focus is still catch-up and semantic stabilization.

## Near-term priorities

- keep identity/auth and discussions as the strongest reference verticals
- harden roles, trust, library, and votes around truthful current behavior
- harden Packet Explorer around truthful import, verification, and trust reporting rather than treating its current live workbenches as the main unfinished problem
- improve surface honesty through warnings, disabled-placeholder clarity, and route-state cleanup where needed
- treat recent dashboard, focus, and shared packet-card polish as good substrate work that should stay secondary unless a regression appears

## Packet Explorer follow-up backlog

- richer provenance and peer-trust reporting on top of the new verification corridor
- stale-versus-current verification surfacing and revalidation affordances beyond the first truthful revision anchoring pass
- broader import history filtering, bundle lineage inspection, and verification follow-up entrypoints
- broader report semantics beyond verification and import
- `Fork`, `Adapt`, and `Follow` semantics
- diff views and revision compare
- richer link grouping and filtering
- eventual action execution through the fortress corridor rather than route-local writes
- first-class `Bundle` packets after verification and locality UX hardening, with legacy bundle JSON remaining a runtime transport format rather than becoming a schema-compatibility type

## Working order

1. harden import verification and truthful packet-status reporting
2. improve locality creation UX on top of the new writer path
3. add provider-neutral locality standardization and duplicate or equivalence handling
4. tighten trust, role, and relationship modeling
5. only then widen into deeper policy-heavy and governance-heavy workflows

The dedicated validation workflow screen remains intentionally unsupported. The next major implementation chapter after the current verification tidy work is still locality UX, not first-class Bundle implementation.

## Bundle direction already locked in

- `Bundle` should become a first-class packet type later rather than staying permanently as a runtime-only JSON wrapper.
- Rebundling or forwarding someone else’s bundle should create a new bundle packet, not a revision of the original bundle packet.
- Bundle history should therefore behave as a lineage graph of related bundle packets rather than one shared revision chain.
- Runtime `import_report`, `export_report`, and `verification_report` packets should remain the portable record surface around bundle movement and validation.
- Local trust should stay node-local even when those reports travel with exported artifacts.
