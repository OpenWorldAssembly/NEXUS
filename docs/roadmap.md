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

We already have stable `packet_id`, immutable `revision_id`, DAG ancestry, and the first target-version compatibility foundation. The remaining work is to apply that foundation consistently to family evolution decisions, especially discussion packets.

This track should define:

- what `schema_version` means at the packet-family level
- when a change is a new packet revision versus a new family schema version
- when a change is big enough to justify a new packet family
- how parsers/upcasters/downcasters should behave
- how target-version inspection and versioned write preparation expose exact changes and losses
- how imported legacy packets are normalized without silently rewriting history
- how merge procedures differ for append-only families versus editable document-style families

Target output:

- explicit schema-evolution rules in `core/schema`
- family-level compatibility handlers, upcasters, downcasters, and loss policies
- documented revision procedure for new writes, amendments, merges, supersessions, and imports
- discussion-family compatibility plan before any stored-family rename or unification

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
- how discussion spaces and forums become element-configurable instead of fixed starter bundles

Default direction:

- use policy packets as first-class configuration and legitimacy references
- keep only the truly universal safety and packet-integrity rules hardcoded
- keep the current default discussion forums as a locality-creation convention until policy-backed, element-configurable forum surfaces are designed

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

### 6. Location / home locality / mounted scope model

Location needs its own first-class roadmap track rather than remaining a loose extension of identity metadata or assembly association.

This track should define:

- how `Global + You` behave as the default baseline for every actor
- how one active deepest `home_locality` claim determines the mounted geographic chain
- how home locality remains distinct from broader `assembly_association`
- how followed scopes remain lightweight navigation choices rather than trust or locality claims
- how the shell distinguishes mounted scopes from known/discoverable scopes
- how locality search becomes a canonical directory with controlled creation instead of loose text matching
- how geographic locality creation works without turning public scope creation into free-form text minting
- how location verification rolls up without collapsing all broader assembly trust into simple residency posture
- how every locality/assembly remains a cryptographic `Element` in the fractal coordination framework
- how future shared assembly custody should live in a dedicated family rather than overloading person key bindings

Default direction:

- every actor gets `Global + You` by default
- home locality becomes one active deepest geographic claim with inferred ancestors
- ancestors are inferred; descendants are not
- `follow` remains a lightweight bookmark/navigation behavior
- `assembly_association` stays distinct from geographic home locality
- remote scopes are followed or visited as guest spaces rather than casually treated as geographic association claims
- locality search should become a canonical directory with controlled parent-path-based creation
- no third-party geocoder is required for the first locality phases
- shared assembly-key or custody work is architectural future work, not part of the early locality phases
- packet-native follow/subscription should become its own later core packet pass; current follows remain shell preferences and should not be treated as trust, locality, or association claims

Planned phase sequence:

1. Phase 1: home-locality semantics and mounted scopes
   - add `home_locality` claim kind
   - make `Global + You` the default baseline
   - mount ancestors from the deepest active home locality
   - distinguish mounted scopes from known/discoverable scopes
2. Phase 2: canonical locality search and optional disclosure cleanup
   - keep identity create/claim working without location
   - stop using `identity.location_disclosure` as mounted-scope truth
   - improve canonical locality search and no-result handling
   - current implementation has begun this phase by making create/claim location optional, writing selected canonical places as `home_locality`, and improving graph-backed matching; no-result create prompts and guided creation remain future work
3. Phase 3: guided locality creation
   - controlled creation under a confirmed parent path
   - canonical uniqueness rules
   - geographic-first locality creation flow
4. Phase 4: locality verification and trust rollups
   - distinguish direct home-locality claim from rolled-up descendant locality verification
   - keep broader assembly trust separate from simple residency posture
5. Phase 5: assembly custody foundation
   - define a future dedicated assembly custody/key family such as `AssemblyKeyset`
   - defer real shared-key operations and threshold signing until later

Guardrails to preserve:

- `identity.location_disclosure` remains optional profile or disclosure metadata rather than mounted-scope truth
- one deepest home-locality chain is the canonical person-location model
- follows mount only the chosen scope
- assembly association should not be reused as a synonym for “I live here”
- remote scopes remain follow or guest spaces by default
- locality creation should be controlled and parent-path-based, not free-form public text minting
- each locality or assembly remains a real cryptographic `Element`
- shared assembly custody should eventually live in a dedicated family rather than overloading person key bindings

### 7. Packet Explorer and inspectability

The system needs a first-class packet inspection surface before governance gets much deeper.

This track should deliver:

- packet detail view
- header/body/provenance/signature visibility
- raw, adapted-current, and adapted-target schema views
- visible adapter diffs and loss warnings for versioned reads or writes
- revision ancestry and preferred-head visibility
- incoming/outgoing edges
- links to related discussions, votes, policies, and actions
- import/export/follow/fork/attest entry points where appropriate

Default direction:

- keep `Library` as the browse-and-collect surface
- keep `Packet Explorer` as the inspect-and-navigate surface
- do not block this on graph visualization

### 8. Governance loop

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

### 9. Actions, reports, and learning loops

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
6. location / home-locality / mounted-scope model
7. packet explorer
8. first governance loop
9. action-family evolution

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

## Recorded priorities from repo analysis

The recent repo analysis and planning review sharpened several priorities that should stay visible in the roadmap until resolved.

### Catch-up before widening

The repo is currently broader than it is deep. Identity/auth and discussions are the two most coherent end-to-end verticals. Dashboard, trust, votes, roles, and library all exist, but much of that width is still blocked-in projection work or provisional semantics.

That means the next serious system push should be a catch-up phase, not another ontology-expansion pass. Before adding policy-heavy workflows, modules, actions, or deeper governance, the current blocked-in surfaces need to be made semantically honest and operational.

### Roles need a cleaner semantic center

The claim-family refactor resolved the earlier mismatch between global actor-body role state and scope-local legitimacy, but a few future-extensibility guardrails should stay explicit:

- scoped role and assembly assertions now live on `Claim` packets
- support and dispute evidence stays on `Attestation`
- role and trust posture should continue to be projection-derived rather than copied onto actor bodies

Future guardrails to preserve now:

- keep `claim_status` semantically extensible even though runtime currently only uses `active` and `withdrawn`
- leave schema space for structured evidence beyond free-text `note`, such as packet-linked `evidence_refs`
- explicitly decide later whether assembly association should allow one active association total, one per branch, or multiple simultaneous associations
- treat `authority_scope_ref = scope_ref` as the current default for association claims, not a universal rule for every future claim kind

Working direction:

- keep scoped social assertions inspectable through `Claim`
- keep `Attestation` for support, dispute, verification, and related evidence on those claims
- prefer computed posture over duplicating social-state lists on actor or scope bodies
- widen the `Claim` family only when a new claim kind has clear runtime and policy semantics, not just because a relationship exists

### Scope and locality semantics still need to be locked

The current shell still behaves like a globally exposed testing tree more than a true personal or locality-aware assembly map.

The intended direction is:

- automatic scopes: `Global` plus `You`
- attached scopes: assemblies the actor is actually associated with
- followed scopes: scopes the actor chooses to keep mounted
- discoverable scopes: known but not automatically mounted

Location and home-scope behavior should be designed only after the role/schema cleanup is stable enough that locality is not being layered onto muddy social primitives.

### Library needs deliberate visibility modes

The current library surface is using generic scope-lens visibility, which makes it feel like a whole-graph view instead of a true scoped library.

Planned direction:

- near term: make Library local to the active scope by default
- longer term: distinguish between local, inherited, global, and all-visible modes instead of treating them as one flattened packet list

## Immediate recorded defects and cleanup backlog

These issues should be treated as active stabilization work, not as background wishes.

- Scope-menu clicks, same-device remembered-session reuse, and default local-only Library behavior have now been stabilized in code; keep them recorded here only as regression-sensitive areas.
- Role claiming can still error and should be treated as an active stabilization target even after the first roles workspace pass.
- Location claiming is still incomplete and should be treated as a dedicated later subsystem, not assumed to be a simple bugfix.
- Assembly creation exists but remains rough and under-tested.

## Practical next-phase sequence

For the next practical system phase, use this order:

1. stabilize blocked-in surfaces and fix the known route/session/library/role issues
2. lock scope visibility semantics and remove global-tree assumptions from the default shell behavior
3. clean up role-claim semantics so scoped legitimacy is modeled honestly
4. redesign location and assembly-association flow on top of the cleaned role/schema model
5. redesign dashboard, trust, votes, roles, and library around their real workflows
6. only then widen into policy-heavy modules, actions, and broader governance machinery

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
- How far should the `Claim` family generalize beyond `role_association` and `assembly_association`, and which future claim kinds deserve first-class support?
- What uniqueness rule should govern active `assembly_association` claims: one total, one per branch, or multiple simultaneous associations?
- When should structured claim evidence move beyond `note` into packet-linked evidence refs or other richer evidence payloads?
- Which future claim statuses should become runtime-meaningful beyond `active` and `withdrawn`, and what transition rules should govern them?
- Which packet families should remain append-only versus mergeable?
- How should schema migration tooling work for long-lived bundles and offline nodes?
- When `Mission -> Action` happens, should that be a compatibility alias, a formal family rename, or a new family generation with upcasters?

## Working rule

Whenever a new feature or schema change is proposed, ask:

1. Is this a core packet/runtime primitive?
2. Is this an OWA policy or governance default?
3. Is this only an app-layer presentation or navigation choice?

If that boundary is not clear first, the change is probably not ready to implement.
