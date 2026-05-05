# Stabilization And Surface Polish

## Current baseline

The repo already has:

- the `core / runtime / app / src/app` split
- packet schema and builder foundations
- SQLite-backed packet and revision storage
- cryptographic identity continuity
- packet-backed discussions and attestations
- a functional Nexus shell
- a read-only Packet Explorer

The next planning focus is still catch-up and semantic stabilization.

## Near-term priorities

- keep identity/auth and discussions as the strongest reference verticals
- harden roles, trust, library, and votes around truthful current behavior
- keep Packet Explorer read-only while its semantics, filters, and action seams are clarified
- improve surface honesty through warnings, disabled-placeholder clarity, and route-state cleanup where needed

## Packet Explorer follow-up backlog

- packet-id and revision-id search from the Home tab
- import packet and import bundle flows
- `Fork`, `Adapt`, `Export`, and `Follow` semantics
- diff views and revision compare
- richer link grouping and filtering
- eventual action execution through the fortress corridor rather than route-local writes

## Working order

1. stabilize blocked-in surfaces
2. clarify scope visibility and surface semantics
3. tighten trust, role, and relationship modeling
4. only then widen into deeper policy-heavy and governance-heavy workflows
