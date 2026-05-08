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

Current direction:

- `Element` remains the durable actor, scope, and container family
- `Element.subtype` is now the forward classifier surface
- `Element.kind` remains live only as compatibility metadata for historical packets and current runtime consumers that have not migrated yet
- dotted subtype forms such as `person.claimed_identity` or `assembly.city` are now the forward model when the older shape previously depended on both `kind` and `subtype`

### Scope

The context or lens around an element. Every person can be treated as their own scope lens through `You`.

### Assembly

A policy-governed civic or geographic element subtype, not a separate storage primitive.

### Initiative

A generic Nexus concept for policy and template lineage in legacy/current compatibility terms. Forward ontology work now models this as `Cause(subtype: initiative)`, and OWA should be treated as one such initiative anchor rather than as a hardcoded exception.

### Claim

The assertion and argument family.

Current forward direction:

- `Claim` can target packets generically
- `Claim` may carry `claim_markdown` and supporting refs
- `Claim(subtype: relation_assertion)` is the forward shape for claims specifically asserting a relation
- legacy `claim_kind` packets such as:

- `role_association`
- `assembly_association`
- `home_locality`

remain readable and are projected into the widened claim shape through compatibility.

Current home-locality direction:

- canonical writes now use `home_locality.relation.set`
- that write produces `Relation(subtype: home_locality)` plus a supporting `Claim(subtype: relation_assertion)`
- legacy `home_locality.claim.set` remains compatibility-only and should be treated as an alias onto the canonical relation-first prepare path
- revise and withdraw semantics remain packet-native: status changes are represented by newly signed packet material rather than in-place mutation

### Attestation

The evidence, certification, support, dispute, and packet-signal family.

Current code truth:

- claim support and dispute currently stay on `Attestation`
- `Attestation` and `Claim` are still distinct in code
- `Attestation` now also carries forward `type/subtype` semantics while preserving `attestation_kind` compatibility

### Role

A reusable role definition packet family. Exact-scope role assertions are currently represented through `Claim(subtype: "relation_assertion")` with `claim_kind: "role_association"` preserved for compatibility.

### Policy

The configuration and legitimacy family for defaults, thresholds, and later execution rules.

Current direction:

- actual adopted or followed graph facts belong in `Relation`
- asserted or disputable statements belong in `Claim`
- evidence and support/dispute posture belong in `Attestation`
- legitimacy-sensitive relation rules belong in `Policy.relation_requirements`

### Decision

A governance artifact family that exists in infrastructure and read surfaces, but whose real workflow semantics are still developing.

## Schema evolution discipline

Before changing packet schemas, read this chapter first.

Also read `docs/implementation-guide/trust-moderation-and-policy.md` before changing `Claim`, `Attestation`, `Relation`, or `Policy` semantics.

For any packet family schema version change, the required checklist is:

- update the active schema or body shape
- update the family compatibility registry entry
- add or update upcast and downcast adapters where backward compatibility is intended
- update current schema version metadata
- update builders and family build definitions so new writes emit the canonical current shape
- update signature and write-preparation behavior if additive or defaulted fields affect compatibility or signing
- add or update tests for parse and read compatibility, adapted read behavior, write preparation, and any supported upcast or downcast path
- document the change in the relevant chapter and add a decision-log note when the change is architecture-significant

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

Current scope-graph direction:

- canonical mounted ancestry prefers `Relation(subtype: default_ancestry_parent)`
- canonical home-locality legitimacy prefers `Relation(subtype: home_locality)` evaluated through `Policy.relation_requirements`
- `Relation(subtype: defined_by_location)` is the live read seam for linked `Location` packets
- legacy `parent_scope` ancestry and legacy `Claim(home_locality)` reads now belong in explicit compatibility projections rather than inline main-path shell logic
