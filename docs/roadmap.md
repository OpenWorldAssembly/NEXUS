# Open World Assembly Roadmap

## Purpose

This document compiles the planning direction developed across the project-planning thread into one working roadmap.

Use the docs this way:

- `docs/specifications.md` = what exists in code today
- `docs/implementation-guide.md` = architecture, implementation rules, and major decisions
- `docs/roadmap.md` = planned direction, sequencing, and open questions

This roadmap is intentionally forward-looking. It does not imply that planned naming, routes, or governance behavior are already implemented.

## Planning frame

The working stack is:

- `FCF` = underlying principles and coordination physics
- `Nexus` = portable substrate and packet engine
- `OWA` = geography-first civic implementation running on Nexus

Publicly, OWA remains the primary product story. Internally, Nexus stays the reusable substrate. FCF remains principle-level guidance, not a code package.

## Current baseline

The repo is no longer in the “prove the concept exists” stage.

Substantial foundations already exist:

- real `core / runtime / app` source separation
- portable packet schema and builder layer
- SQLite-backed packet and revision storage
- cryptographic identity, claimed sessions, local bundle custody, and security modes
- packet-backed discussions and attestations
- a functional Nexus shell with scope and function navigation

The next planning focus is not another structural refactor. It is locking semantic foundations before trust, governance, and broader reuse grow on unstable assumptions.

## Locked direction

These are the planning decisions that should be treated as current default direction unless explicitly revised.

### Product and architecture

- OWA remains web-first.
- Discord is a later adapter, not a current product constraint.
- The repo architecture is now `core / runtime / app`, with `src/app` as the Expo Router entry shell.
- Core remains portable and UI-agnostic.
- Runtime owns storage, orchestration, and API-facing glue.
- App owns screens, components, hooks, public content, and other adapter-layer concerns.

### Surface model

- `You` is a scope lens, not a special-case utility page.
- `You` should behave like any other scope lens and work with any function.
- `Trust` is a function surface that should work across any scope, including `You`.
- `Account` is wrapper-level identity custody and security: keys, sessions, devices, export, restore, sign-in, and security posture.
- `Account` may later be entered through `You` and/or `Trust`, but its conceptual role should stay distinct from social legitimacy.
- `Library` remains the scoped collection surface.
- `Packet Explorer` remains the deep inspection surface, even if it is entered through Library and linked cards.

### System language

- OWA defaults should be policy-driven where possible rather than hardcoded as universal law.
- Trust should begin as inspectable evidence plus thresholds, not opaque score math.
- Roles should begin as scoped claims plus support evidence, not as a hardcoded parallel authority system.
- Packet compatibility must support evolving packet schemas in addition to evolving packet revisions.
- Terminology pivots such as `Mission -> Action` should happen only after schema-evolution rules are explicit.

## Major roadmap tracks

The next work should be organized by dependency, not by aesthetics or convenience.

### 1. Packet schema evolution and revision procedure

This is the most important foundation track.

We already have stable `packet_id`, immutable `revision_id`, and DAG ancestry. What is still missing is an explicit compatibility model for changing packet shapes over time.

This track should define:

- what `schema_version` means at the packet-family level
- when a change is a new packet revision versus a new family schema version
- when a change is big enough to justify a new packet family
- how parsers/upcasters/downcasters should behave
- how imported legacy packets are normalized without silently rewriting history
- how merge procedures differ for append-only families versus editable document-style families

Target output:

- explicit schema-evolution rules in `core/schema`
- family-level compatibility handlers or upcasters
- documented revision procedure for new writes, amendments, merges, supersessions, and imports

### 2. Trust and legitimacy

Trust is the next major product-defining system.

Current packet-backed attestations expose evidence, but the repo does not yet have a clear legitimacy model for membership, participation depth, or role eligibility.

This track should define:

- assembly association states
- endorsement and vouch patterns
- legitimacy thresholds by scope
- which trust states are informational only
- which trust states gate posting, voting, review, moderation, or role claims
- how trust remains inspectable even when defaults hide or deprioritize low-trust activity

Default direction:

- start with threshold-and-evidence logic
- avoid hidden global reputation scores
- reuse `Attestation` where possible before adding new trust families

### 3. Roles and scoped authority

Roles should be layered onto trust rather than invented as a disconnected system.

This track should define:

- what a role claim packet or role-claim pattern looks like
- what evidence can support a role claim
- which roles are OWA defaults and which are policy-defined
- whether role claims are self-asserted first, endorsed later, or only granted externally
- how role authority is scoped and revoked

Default direction:

- start with scoped role claims plus supporting attestations
- keep OWA role semantics in policy and app-layer behavior, not hardcoded deep into Nexus core

### 4. Policy system and defaults

Policies are the extension mechanism that lets OWA have defaults without freezing Nexus into one ideology or one permanent governance model.

This track should define:

- baseline OWA policies
- policy inheritance and override rules by scope
- how a scope adopts, amends, supersedes, or rejects policies
- which runtime invariants are universal and which are policy-controlled
- how policy references affect discussions, actions, governance, trust gates, and moderation defaults

Default direction:

- use policy packets as first-class configuration and legitimacy references
- keep only the truly universal safety and packet-integrity rules hardcoded

### 5. `You`, `Trust`, and `Account` information architecture

This is the next major IA clarification.

Target model:

- `You` = personal scope lens
- `Trust` = function across any scope
- `Account` = wrapper-level identity and security custody

This track should settle:

- how `You` participates in dashboard, discussions, votes, library, and trust
- what appears in `Trust` for a person scope versus an assembly scope
- whether `Account` remains a separate persistent surface or becomes a wrapper/drawer entered from `You` and `Trust`
- where security-mode changes, device management, and export/restore reminders belong

Default direction:

- do not collapse trust and security into the same concept
- keep identity custody distinct from legitimacy, even if the eventual UI entry points overlap

### 6. Packet Explorer and inspectability

The system needs a first-class packet inspection surface before governance gets much deeper.

This track should deliver:

- packet detail view
- header/body/provenance/signature visibility
- revision ancestry and preferred-head visibility
- incoming/outgoing edges
- links to related discussions, votes, policies, and actions
- import/export/follow/fork/attest entry points where appropriate

Default direction:

- keep `Library` as the browse-and-collect surface
- keep `Packet Explorer` as the inspect-and-navigate surface
- do not block this on graph visualization

### 7. Governance loop

Governance should come after trust, policy, and inspectability are defined well enough to avoid immediate rewrites.

This track should eventually deliver:

- signal or petition intake
- proposal drafting and revision
- linked deliberation
- scoped review and role-aware checkpoints
- timed voting
- decision publication
- decision-to-action linkage

Default direction:

- treat OWA governance as an app-layer implementation on top of Nexus primitives
- keep revisions inspectable and tied to proposal history

### 8. Actions, reports, and learning loops

Longer term, OWA needs an honest action loop rather than stopping at proposals and votes.

This track should cover:

- `Mission -> Action` terminology migration
- action templates, plans, and reports
- after-action review linkage
- relationships between decisions, actions, modules, policies, and outcomes

Default direction:

- do not rename mission-family packets until schema compatibility rules are ready

## Recommended implementation order

To minimize breakage and avoid semantic churn, the recommended order is:

1. packet schema evolution rules
2. trust and legitimacy model
3. role-claim model
4. policy model
5. `You / Trust / Account` IA decisions
6. packet explorer
7. first governance loop
8. action-family evolution

This is intentionally dependency-first. It avoids building governance, role UI, or terminology migrations on top of unresolved packet semantics.

## Near-term implementation chunks

These are the smallest practical system chunks that fit the current direction.

### Chunk A: Schema and revision brief

Produce one design pass that settles:

- schema-version policy
- revision procedure
- merge categories by family
- compatibility expectations for future renames and family evolution

### Chunk B: Trust model brief

Produce one design pass that settles:

- trust evidence types
- legitimacy stages
- scope-local thresholds
- what gates what

### Chunk C: Role and policy brief

Produce one design pass that settles:

- role-claim structure
- supporting evidence model
- baseline OWA policies
- local override rules

### Chunk D: IA brief for `You / Trust / Account`

Produce one design pass that settles:

- navigation placement
- route/workspace implications
- which information belongs in each surface
- whether `Account` stays separate or becomes a wrapper-entered security surface

Only after those briefs are stable should implementation begin on the next major feature wave.

## Deferred or explicitly out of scope for the next system pass

These remain important, but should not lead the next implementation cycle:

- another major codebase restructuring pass
- Discord adapter revival
- mesh transport work
- federation/delegation mechanics
- real-time chat
- advanced reputation math
- deep governance role automation
- public-site polish work being handled outside Codex

## Open questions

These questions are still live and should be answered in the next planning passes.

- Should `Account` remain a distinct wrapper-level surface, or become a security drawer/workspace entered from `You` and `Trust`?
- Which role families are true OWA defaults versus policy-defined local choices?
- Which packet families should remain append-only versus mergeable?
- How should schema migration tooling work for long-lived bundles and offline nodes?
- When `Mission -> Action` happens, should that be a compatibility alias, a formal family rename, or a new family generation with upcasters?

## Working rule

Whenever a new feature or schema change is proposed, ask:

1. Is this a core packet/runtime primitive?
2. Is this an OWA policy or governance default?
3. Is this only an app-layer presentation or navigation choice?

If that boundary is not clear first, the change is probably not ready to implement.
