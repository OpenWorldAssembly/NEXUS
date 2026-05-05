# Core Entities And Packet Model

## Packet graph foundation

The packet graph remains the most robust unifying model.

Core packet rules:

- `packet_id` is the stable logical packet identity
- `revision_id` is the immutable exact revision identity
- `parent_revision_refs` represent DAG ancestry
- `schema_version` tracks family-shape compatibility
- `edges` are the shared typed relationship collection
- `authority_scope_ref` and `applicable_scope_refs` stay separate
- `revision_mode` expresses family write semantics

Raw stored packets remain the historical signed fact. Adapted packets are runtime read views, and interpreted or read-model outputs are additional projections on top of those reads.

## Core entities

### Element

The universal identity anchor.

- person
- assembly
- organization
- service
- overlay or coordination group
- initiative

### Scope

The context or lens around an element. Every person can be treated as their own scope lens through `You`.

### Assembly

A policy-governed civic or geographic element subtype, not a separate storage primitive.

### Initiative

A generic Nexus concept for policy and template lineage. OWA should be modeled as an initiative inside Nexus rather than as a hardcoded exception.

### Claim

The current canonical packet family for scoped social assertions, including:

- `role_association`
- `assembly_association`
- `home_locality`

Current code truth:

- `Claim` remains a distinct packet family today
- the docs should continue to describe that as current architecture

### Attestation

The current packet family for support, dispute, and other evidence-oriented signals.

Current code truth:

- claim support and dispute currently stay on `Attestation`
- `Attestation` and `Claim` are still distinct in code

### Role

A reusable role definition packet family. Exact-scope role assertions are currently represented through `Claim(kind: "role_association")`.

### Policy

The configuration and legitimacy family for defaults, thresholds, and later execution rules.

### Decision

A governance artifact family that exists in infrastructure and read surfaces, but whose real workflow semantics are still developing.

## Relationships and graph semantics

The graph should continue to express relationships through typed refs and edges rather than UI-only linkage. Important relationship categories remain:

- references or depends_on
- proposes or supersedes
- belongs_to
- scoped_to
- endorsed_by or vouched_by
- implements or enacts
- reports_on
- fork_of or derived_from
