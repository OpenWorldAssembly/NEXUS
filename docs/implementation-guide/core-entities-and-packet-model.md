# Core Entities And Packet Model

## Packet graph foundation

The packet graph remains the most robust unifying model.

Core packet rules:

- `packet_id` is the stable logical packet identity
- `revision_id` is the immutable exact revision identity
- `parent_revision_refs` represent DAG ancestry
- `schema_version` tracks type-shape compatibility
- `edges` are the shared typed relationship collection
- `authority_scope_ref` and `applicable_scope_refs` stay separate
- `revision_mode` expresses type write semantics

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

- `Element` remains the durable actor, scope, and container type
- `Element.subtype` is the canonical classifier surface
- fresh Element packets reject the old top-level `kind` classifier
- dotted subtype forms such as `person.claimed_identity` or `assembly.city` are the forward model when the older shape previously depended on multiple classifier fields

### Scope

The context or lens around an element. Every person can be treated as their own scope lens through `You`.

### Assembly

A policy-governed civic or geographic element subtype, not a separate storage primitive.

### Initiative

A generic Nexus concept for policy, template lineage, defaults, and work hierarchy. The pre-reseed reset treats `Action(subtype: initiative)` as the canonical top-level initiative anchor above campaign, program, mission, and task semantics. `Cause` is no longer an active fresh packet type.

### Claim

The assertion and argument type.

Current forward direction:

- `Claim` can target packets generically
- `Claim` may carry `claim_markdown` and supporting refs
- `Claim(subtype: relation_assertion)` is the forward shape for claims specifically asserting a relation
- relation-specific claim semantics live under `Claim(subtype: relation_assertion).relation_assertion.subtype`

Current home-locality direction:

- canonical writes now use `relation.residence.add`
- that write produces `Relation(subtype: residence)` only; claims and attestations can be added around the relation, but are not automatically minted
- legacy `residence.claim.set` is retired from live fresh writes; historical `Claim(residence)` material remains readable through compatibility projections
- revise and withdraw semantics remain packet-native: status changes are represented by newly signed packet material rather than in-place mutation

### Attestation

The evidence, certification, support, dispute, and packet-signal type.

Current code truth:

- claim support and dispute currently stay on `Attestation`
- `Attestation` and `Claim` are still distinct in code
- `Attestation.subtype` is the canonical attestation classifier

### Role

A reusable role definition packet type. Exact-scope role assertions are currently represented through `Claim(subtype: "relation_assertion")` with `relation_assertion.subtype: "role_association"`.

### Policy

The configuration and legitimacy type for defaults, thresholds, and later execution rules.

Current direction:

- actual adopted or followed graph facts belong in `Relation`
- asserted or disputable statements belong in `Claim`
- evidence and support/dispute posture belong in `Attestation`
- legitimacy-sensitive relation rules belong in `Policy.relation_requirements`
- default inheritance belongs in `Policy.default_policy`, using packet refs for policies, templates, default packet sets, and preference material rather than runtime-only default names
- governance readiness belongs in `Policy.governance_policy`, reserving voter eligibility, trust stage, quorum, approval, vote method, and decision-report hooks without executing voting yet
- dependency requirements remain in `Policy.dependencies_policy`; subscriptions record what a subject accepts or excludes, and projections compare the two

### Decision

A governance artifact type that exists in infrastructure and read surfaces, but whose real workflow semantics are still developing.

## Converging civic grammar

The long-term Nexus direction is converging on a smaller reusable civic grammar:

- `Element`
- `Relation`
- `Claim`
- `Attestation`
- `Report`
- `Action`
- `Policy`

Current code already implements most of that grammar directly. `Action` now carries the forward initiative/work hierarchy and packet-backed default override refs, while `Report` has landed as a real packet type but its live use is still intentionally narrow.

Current code now ships the first concrete `Report` type use:

- `Report(subtype: verification_report)`
- `Report(subtype: import_report)`
- `Report(subtype: decision_report)` as reserved governance closure-report shape

This first live usage should still be understood narrowly. The type now exists as real packet infrastructure, but broader audit, incident, decision, or resolution report semantics remain later architectural work rather than implicit current product truth.

## Packet-backed defaults

Defaults should remain packet-native rather than becoming `Element` fields or runtime constants. The current pre-reseed inheritance direction is:

- `Definition(subtype: defaults_definition)` parts carried alongside each packet definition
- bundle/default packet-set material
- initiative `Action` policy/template/default packet-set refs
- element policy/template refs or relations
- actor/client `Preference`

OWA-specific behavior should be represented by the default OWA `Action(subtype: initiative)` packet and its linked policies, templates, bundles, and preferences, not by special cases in generic packet schemas.

The default OWA seed now links its forward `Action(subtype: initiative)` anchor to default-inheritance and governance-baseline `Policy` packets. New default/policy resolution should use the Action anchor, then layer policy-selected `defaults_definition_refs` and explicit overrides on top of definition-native defaults.

## Schema evolution discipline

Before changing packet schemas, read this chapter first.

Also read `docs/implementation-guide/trust-moderation-and-policy.md` before changing `Claim`, `Attestation`, `Relation`, or `Policy` semantics.

For any packet type schema version change, the required checklist is:

- update the active schema or body shape
- update the type compatibility registry entry
- add or update upcast and downcast adapters where backward compatibility is intended
- update current schema version metadata
- update builders and type build definitions so new writes emit the canonical current shape
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
- canonical home-locality projection prefers `Relation(subtype: residence)`; legitimacy evidence can attach through separate Claims and Attestations when policy or contestation requires it
- canonical follow relations now use `Relation(subtype: follow)` and are actor-only; legacy shell follow preferences are compatibility-only read input
- canonical association now uses `Relation(subtype: association)` without automatic claim wrapping, and associated scopes now count as mounted related scopes in shell projection
- canonical policy adoption now uses `Relation(subtype: subscription)` targeting a Policy packet rather than a separate `adopts_policy` relation subtype
- dependency requirements remain policy-layer semantics, usually `Policy.dependencies_policy`, while `depends_on` remains available only as a structural edge type rather than a Relation subtype
- subscription relations can carry `subscription_options` for inherited/default policies, dependencies, modules, templates, and default packet sets; excluding a required default does not erase the subscription, but projection should report partial alignment or review needs
- `Relation(subtype: defined_by_location)` is the live read seam for linked `Location` packets
- `locality.path.create` now emits locality `Element` packets, `default_ancestry_parent` relations, provisional `Location(subtype: region)` packets, and `defined_by_location` relations together
- locality rows can now carry dynamic descriptor metadata, which is currently stored in linked `Location.spatial_payload.scope_descriptor` rather than through a packet schema bump
- legacy locality levels such as `nation | region | city | district` now function as compatibility buckets, while actual ancestry comes from the ordered path graph and not from a hardcoded four-slot ladder
- locality depth remains projection-only and should not be stored as a universal packet truth
- legacy `parent_scope` ancestry, shell follow preferences, and legacy `Claim(residence)` reads now belong in explicit compatibility projections or compatibility mirrors rather than inline main-path logic
