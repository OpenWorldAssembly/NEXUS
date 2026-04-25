# Open World Assembly Implementation Guide

## Purpose and scope

This guide is the “scrape everything” implementation reference for building OWA Nexus as a new, dedicated OWA repo that replaces the current `nexus_app` lineage while preserving and integrating every durable feature, architecture primitive, and implementation idea we’ve accumulated: Nexus core, packet graph, offline-first distribution, trust/identity, governance mechanics, OPSEC/safety options, and the OWA assembly model.

It is intentionally detailed and operational. It should be possible for someone new to the project to open this doc and build the system without needing to hunt through old workspaces, Discord summaries, whitepapers, or prototype code.

The product target is an Expo-based web app, with responsive layouts across desktop, tablet, and mobile, built atop a portable core engine and a local-first data model.

Planning companion:

- `docs/roadmap.md` holds forward-looking roadmap and sequencing work
- this guide holds implementation rules, architecture decisions, and durable build guidance

## Product layers and system architecture

The cleanest long-term architecture is a three-layer product stack, with strict boundaries:

### OWA App (public-facing civic surface)

The “assembly experience” layer. OWA-native framing and navigation:

**place → assembly → deliberation → proposals/votes → actions → record → learning**

This is where geographic locality is primary, and where overlay structures such as teams and nodes appear as secondary coordination layers.

### Nexus Browser (dataset/graph surface)

The “information and coordination substrate” interface: browse packets, follow links, inspect provenance, fork/reuse, search/filter, and see incoming/outgoing references.

It is not specific to OWA in concept, but is shaped for OWA use.

### Nexus Core (portable engine)

No UI assumptions. Owns:

- packet typing and validation
- graph building
- link resolution
- read and write operations
- import and export bundles
- merge and conflict strategy
- trust hooks
- policy evaluation

UI layers are adapters.

The key design stance: **data is the system; platforms are adapters.** The app is not “the platform,” it is one adapter onto a portable dataset.

Architecturally, the repository now uses three real source roots plus one framework entry root:

- `core/*` = portable engine, schemas, packets, projections, and contracts
- `runtime/*` = storage, runtime orchestration, Node services, and API-facing glue
- `app/*` = application-layer UI, content, hooks, constants, and shared screens/components
- `src/app/*` = Expo Router entry shell for routes and API entrypoints

This split is behavior-preserving at the architecture level. Public route paths and existing auth payloads stay stable while ownership boundaries are explicit. Product work such as `Mission -> Action` and `Library`/`Packet Explorer` still remains separate from the structural split, but the `Trust` function swap and `You` scope lens are now active in the current Nexus slice.

## Route tree and navigation model

The routing model should reflect the user’s mental map of “where am I in the fractal” and “what’s happening here,” while also exposing the underlying packet graph.

A good default is a three-axis navigation:

### Place / Scope axis (where)

- World → Region → Nation → State/Province → County/Metro → City → Neighborhood → Venue/Local Node
- Personal scope (`You`) as the actor-backed self lens that uses the same function grammar as other scopes
- Actual granularity depends on adoption
- Each scope is an Assembly context with identity, trust, decision history, active deliberations, and actions

### Topic / Work axis (what)

- Issues / topics
- Initiatives / programs / campaigns
- Missions / actions
- Policies / modules

### Time / Evidence axis (what happened)

- Activity feed: signals, proposals, votes, actions
- Records: minutes, after-action reports
- Outcomes and learning loop

Practically, this becomes a route tree like:

### Home

- My locality (default assembly)
- My active contexts (assemblies, overlays, initiatives)
- My tasks / commitments

### Assemblies

- Assembly overview (identity, scope, trust posture, how it connects upward/downward)
- Deliberation (threads)
- Proposals & voting (pipeline)
- Actions (missions, coordination)
- Record (decisions, AARs, artifacts)
- Members & trust (views + privacy controls)
- Settings (policies, permissions, safety posture)

### Initiatives

- Initiative overview
- Programs / campaigns
- Action library (templates + reports)

### Graph / Library

- Packet browser
- Search
- Incoming/outgoing links
- Fork/reuse workflows

### Trust

- Trust posture by scope
- Association legitimacy
- Role claims and supporting evidence
- Policy thresholds and participation gates

### Roles

- Role catalog by scope
- Claim or unclaim a role from the active scope
- Review who has claimed each role in that scope
- Support or dispute those role claims with scoped evidence

### Wrapper account/security

- Identity ceremonies
- Sessions and passkeys
- Export keys and restore
- Device and safety controls

Layout rule: desktop can be multi-pane, with left for scope tree, center for content, and right for context/related graph. Tablet can be partially split. Phone can be stacked. The route tree stays stable; pane density adapts.

### Current implemented nexus slice

The current repo now has a first blocked-in nexus slice under `/nexus/*`.

Implemented routes in this slice:

- `/nexus/dashboard`
- `/nexus/discussions`
- `/nexus/votes`
- `/nexus/roles`
- `/nexus/library`
- `/nexus/trust`
- `/nexus/account` as a hidden wrapper-level account/custody route reached from the profile link
- `/login`
- `/signup`

Implemented shell behavior in this slice:

- dedicated nexus layout separate from the public header/footer shell
- left-heavy desktop shell with a compact guest header, anonymous guest avatar, auth actions, a home link beneath auth, a bottom-mounted preference drawer tab, a primary rail, and a secondary rail
- responsive mobile overlay for the same left-side shell, still opening from the left edge
- function-first vs scope-first as a shell preference rather than separate route systems
- the scope menu uses a full visible scope map instead of an indented tree, so deeper scopes do not lose width as the branch descends and the user does not have to drill into path-only views
- per-rail collapse handles and swipe gestures that collapse the outer-most rail first and expand the primary rail first
- current-scope summary content lives with the active scope menu rather than staying fixed to one rail, it stays above the scope map when the scope menu is visible, and long badge labels are constrained to wrap inside the card
- the current-scope summary is now a mirrored top card pinned to the secondary rail rather than a nested block inside the scope map card, and it has been tightened into a metrics-only scope lens whose three stat tiles change with the active Nexus section instead of repeating generic trust/status pills
- secondary rail can remain open while the primary rail is collapsed
- `Global Guest` as the default nexus entry state
- `You` as a first-class personal scope lens resolved from the active actor packet and rendered as a child leaf under the actor's local assembly branch
- visitor-lobby posting as the only enabled guest write interaction
- discussion writes now flow through local API routes into a local SQLite-backed packet store with cryptographic person-actor provenance, and the active discussion model now uses `DiscussionSpace -> DiscussionForum -> DiscussionThread -> DiscussionPost -> DiscussionReply`
- the first fortress write seam now exists for discussions: canonical discussion thread/post/reply candidates are built and evaluated through `core/auth/*`, scope-level `Policy(kind: "write_lock")` packets can raise required proof levels for those actions, and the signed packet bundle sent from the browser is now treated as a signer artifact that must match the canonical candidate rather than as the authoritative mutation payload
- the fortress seam now includes a shared prepare/sign/finalize corridor for the first migrated interactive writes: `/api/nexus/mutations/prepare` returns canonical unsigned packet candidates plus one-time mutation tickets, the current web identity shell signs those exact candidates through a temporary signer-adapter path, and `/api/nexus/mutations/finalize` re-verifies digests, signatures, proof level, authority, and policy before runtime persists any packet effects
- canonical unsigned packet matching in the corridor now uses shared digest law rather than object-string comparison, so signer artifacts are checked against the same canonicalization substrate used by compatibility-aware signature verification
- the first corridor-backed actions now include discussion post or reply creation, packet-signal vote attestations, and actor write-preference updates; broader claim, locality, assembly, and other interactive packet writes still remain migration follow-ups
- actor write approval is no longer only a runtime preference row: the active write-preference update flow now revises a typed `Policy(kind: "write_lock")` packet and, when needed, revises the actor `Element` policy refs so later writes are governed by packet-backed policy state
- local web runs now use Expo `web.output = "server"` so the visitor-lobby API routes can actually execute
- all current `/nexus/*` routes now share one centered page-frame width through the common Nexus UI layer instead of mixing route-specific max-width wrappers
- route headers have been tightened into a common scope-first pattern such as `Global Commons Library` or `United States Votes`, with optional compact trailing badges instead of the earlier title-plus-subtitle-plus-explanation blocks
- placeholder rollout/explanatory cards have started being removed from the current route surfaces in favor of denser, more functional cards and lists
- the primary function surface now uses `Roles` and `Trust` instead of `Account`, while account/security custody stays accessible from the profile link and `/nexus/identity/*` routes
- the hidden account route now acts as a wrapper-level custody and local-assembly continuity workspace, including memory-only temporary guests, session-only guests, saved guests, and claimed identity flows with export, restore, claim, sign-in, sign-out, and local lock-state messaging
- scope changes from wrapper-level account and identity routes now navigate visibly back into the scoped `Trust` workspace instead of only changing shell state in the background
- signing out of a claimed session now restores a preserved guest actor when possible, otherwise Nexus immediately generates a fresh temporary guest so the shell never keeps showing the signed-out claimed identity as the active actor
- the main scope map now renders only the actor's geographic home branch rather than rebuilding from every known or followed scope, and the separate explore/follow lists are deduped and capped as lightweight sidebars until a dedicated Nexus map exists
- the discussions thread workspace has been simplified by removing the separate expandable thread picker; feed remains the primary thread-switching surface, and successful inline replies now collapse the composer and mark the newly created reply inside the thread
- membership-required discussion forums now use the actor's active home-locality branch as the write gate; visitor-lobby forums remain open to signed guest posting, while remote or followed-only scopes show a local community-claim modal instead of surfacing raw backend write errors
- shared Nexus action buttons now opt into a compact self-sized footprint by default so standalone actions do not stretch full-width inside vertical card layouts
- every nexus actor that touches the graph is now a real `Element(kind: "person")`, including ephemeral guests and device-saved guests
- claimed sign-in now uses client-generated `P-256` keys, a signed challenge-response flow, encrypted local identity bundles, and optional persistent auth cookies that stay separate from packet-signing truth
- passkeys are now optional extra protection instead of a hard requirement for claimed use, and protected security actions can re-approve through either passkey or signed-key re-auth from the unlocked local bundle
- the shell sign-in workspace now uses graph-backed identity discovery and graph-backed location discovery from the packet graph itself, while keeping private signing-key custody strictly local unless the user imports a bundle or uses passkey sign-in
- identity create/claim now treat the location picker as optional home-locality setup: skipping location keeps the default `Global + You` mounted baseline, while choosing a canonical geographic scope writes `Claim(kind: "home_locality")` after the claimed session is active; profile `location_disclosure` remains separate optional metadata rather than mounted-scope truth
- locality search now returns directory-style metadata for canonical names, aliases, parent path context, match type, and create candidates; `/nexus/locality/create` provides the first controlled locality creation flow for geographic `Element(kind: "assembly")` packets
- the trust route now projects scoped trust posture, association evidence, role claim summary, and baseline participation gates from policy defaults rather than showing a hidden reputation score
- the trust route keeps trust metrics first, then groups home-locality, follow/unfollow, and assembly-association actions under `Scope relationship` so location controls stay available without dominating every trust page
- the roles route now projects the role catalog for the active scope, scope-relevant claimants, claimant trust stages for that role, and real support/dispute evidence with inline review actions
- protected guest role actions now open a local sign-in-required confirmation modal instead of attempting the write and surfacing raw backend identity errors
- the sign-in identity picker now dedupes saved and discovered claimed identities by actor packet id, keeps the selected identity in one place at a time, and distinguishes resuming or unlocking the current identity from switching to another one
- identity ceremonies now preserve `return_to` and `return_scope_id` context for protected role-entry flows so sign-in, claim, create, and restore can return the user to the same workspace and scope lens after success
- exact-scope role claims are now always visible on the roles route for that scope, and role actions immediately re-fetch the scoped payload so claimant rows, counts, and claim or unclaim button state stay synchronized without a manual page refresh
- the roles route now presents one role at a time through tabs so growing role catalogs do not push all claimant/evidence sections into one long vertical stack
- guest-claim return flows treat an already-claimed current actor as a successful ready state when a protected action supplied `return_to`, instead of stranding the user on the generic already-claimed page
- remembered same-device claimed sign-ins now reuse the existing persistent session by default, and refresh-token rotation updates that same session in place instead of multiplying device-session rows
- identity security now shows only active sessions by default, sorts the current session first, and surfaces explicit empty or error states instead of silently blanking the session area
- person-packet signature verification now accepts both the current canonical `Element` shape and older signed revisions that predate additive defaults such as `claimed_role_refs: []` and `locality: null`, so stored claimed identities can still sign in and authorize role, assembly-association, or locality writes without weakening signature checks
- the library route now defaults to a strict local-only packet view keyed to the active authority scope rather than using the broader inherited scope lens
- personal-scope function rows now keep clean function titles while using `Personal ...` wording in the supporting subtext, and the scope-map connector lane uses semantic width cues so `Global -> ... -> You` reads visually from broadest to narrowest with `You` labeled as a `Personal branch`

Current implementation boundary:

- nexus shell scopes, dashboard cards, vote lanes, discussion forums, and library cards are now loaded from packet-backed API projections instead of local mock arrays
- a packet foundation now exists under `core/schema`, `core/contracts`, `core/packets`, and `core/projections`, with runtime persistence and service orchestration under `runtime/*`
- the current codebase now includes a canonical `PacketEnvelope = { header, body }` model, Zod packet-family parsers, per-family schema-compatibility upcasters, explicit family `revision_mode` metadata, packet-store/query-service interfaces, packet label projections, shared browser/nexus query-service implementations, an Expo `SQLitePacketStore`, and a server-side `NodeSQLitePacketStore`
- the shared server bootstrap now seeds the personal scope tree, resets discussion packets by seed version in local dev, and reseeds per-scope discussion spaces, forum tabs, starter threads, root posts, and nested replies
- a first trust-and-roles slice now exists through `Role` packets, scoped `Claim` packets for `role_association` and `assembly_association`, claim-targeted attestation evidence, scoped trust projections, role claimant projections, baseline trust policy defaults, and the `Trust` / `Roles` workspaces
- packet detail routes, deeper trust weighting, and protected spaces remain later phases

## Core entities and data model

The most robust unifying model we have is the packet graph: everything is a typed packet node, relationships are explicit edges, and the system is the evolving graph.

The current repo foundation should treat the packet envelope as:

- `packet_id` = stable logical packet identity
- `revision_id` = immutable exact revision reference
- `parent_revision_refs` = exact revision ancestry, including merge revisions with multiple parents
- `family` = canonical packet family
- `schema_version` = family-shape compatibility, not content revision numbering
- `edges` = the single typed relationship collection
- `authority_scope_ref` plus `applicable_scope_refs` = ownership and applicability, separated
- `parent_scope` = the explicit child-to-parent assembly edge for geographic scope trees
- packet-family `revision_mode` = explicit write semantics (`append_only`, `replaceable`, reserved `mergeable`)

The current repo foundation also now treats `Element` as the only identity-root family. Assemblies, teams, nodes, people, orgs, and services are `Element` kinds rather than separate top-level storage primitives.

The implementation guide should treat the following as first-class packet families. Some already exist in prototype form; others are to be added or extended.

## Identity and participation

### Element

The universal identity anchor: person, org, assembly, overlay group, or service/node.

Must support persistent continuity, pseudonymous by default, and later cryptographic signing.

### Assembly (geographic element subtype)

Represents an OWA assembly at a defined geographic scope.

Holds:
- location metadata
- scope boundaries
- local trust posture
- decision rules
- links to parent and child assemblies

### Overlay group (team/node/constellation)

A non-geographic coordination element.

Linked to one or more assemblies but does not replace the assembly legitimacy anchor.

### Role

A reusable role definition packet that can be claimed by eligible actor elements and supported or disputed through attestations.

Current implementation stance:

- `Role` is its own packet family
- scoped role assertions are stored as `Claim(kind: "role_association")`
- support and dispute stay on `Attestation`, but now target the relevant claim packet through `claim_support` and `claim_dispute`
- trust posture is projected from evidence and policy thresholds rather than a hidden score

### Claim

The canonical packet family for scoped social assertions such as:

- `role_association`
- `assembly_association`

Current implementation stance:

- one logical claim identity exists per `(subject_ref, claim_kind, target_ref, scope_ref)`
- claim and unclaim mutate that same logical claim through revisions with `status: active | withdrawn`
- claim packets use the claimed scope as `authority_scope_ref`
- discovery may include ancestor scopes through `applicable_scope_refs`, but active role legitimacy is exact-scope only

## Direction and intent

### Initiative / Program / Campaign

These already exist as a clean hierarchy:

**umbrella direction → repeatable effort → timeboxed push**

OWA can use them for issue tracks, reforms, and long-term efforts.

## Governance and decision flow

### Signal / Petition (early intent / noise filter)

Early-stage: “something matters, here’s the scope, here’s a proposal direction.”

Should support thresholds and escalation rules without forcing immediate vote.

### Proposal

Formal actionable motion.

Links to:
- deliberation threads
- affected scopes
- modules / policies
- downstream action plans

### Vote / Decision record

Vote events and their aggregation outputs.

Needs to support one-signal multi-scope propagation, the OBMS concept, without duplicate voting.

The stored artifact should separate:
- local vote facts
- aggregation transforms
- resulting decision statements

## Action and learning

### MissionTemplate / MissionPlan / MissionReport

This is a strong execution loop already:

**reusable blueprint → instantiated plan → after-action report**

It provides Act → Learn structure and a living library of what works.

### Module

Capability building blocks such as:
- comms
- safety
- supply
- reporting
- coordination

Modules can be reused across initiatives and missions.

### Policy

Human-readable constraints and rules that can be referenced by missions, plans, and governance, and later validated automatically.

Current implementation now also uses `Policy` for baseline trust defaults such as:

- association support thresholds
- role-claim support thresholds
- posting/voting/review trust gates

## Documentation and memory

### Minutes / AAR / Artifact packets

AARs already exist conceptually and in prototype.

We should canonize records as packets, and ensure auditability plus portability.

### DiscussionThread / DiscussionPost

Discussion should also be packet-native rather than treated as a special UI-only surface.

`DiscussionThread` and `DiscussionPost` should remain their own packet families, while narrower ideas such as forum posts stay as subtypes inside those families.

## Graph relationships

The model needs explicit relationship types beyond links embedded in markdown.

At minimum:

- `references` / `depends_on`
- `proposes` / `supersedes`
- `belongs_to` (initiative/program/campaign)
- `scoped_to` (assembly/geography)
- `endorsed_by` / `vouched_by` (trust)
- `implements` / `enacts` (proposal → action plan)
- `reports_on` (mission report → plan/template)
- `fork_of` / `derived_from`

If we get these edges right, browsing, search, provenance, and learning become natural.

## Core and adapters boundary

This boundary is where most projects rot. The guide should be explicit and uncompromising.

### Core owns

- packet schemas and validation
- graph building and querying
- link extraction and normalization
- data import/export (bundles)
- merge and reconciliation logic
- signing and verification hooks, and later full implementation
- policy evaluation hooks
- trust primitives, not UI view logic
- indexing strategy and query APIs

### Adapters own

Expo web app, optional Discord, optional CLI:

- rendering and navigation
- input UX (forms, editors, selectors)
- local device integration, such as camera for presence proof or QR flow, if ever used
- orchestration, meaning calling core APIs

Adapters must never invent parallel logic, such as:
- trust scoring in UI
- packet validation in UI
- ad hoc merge behavior

## State, storage, and sync assumptions

The system wants to be local-first and offline-first by default.

### Local canonical store (v0): SQLite

- JSON-first storage with targeted indices
- “index what you query”
- supports portability and low ops
- works in node contexts and browser contexts, via appropriate SQLite builds / WASM strategy depending on Expo/web constraints

### Graph build strategy

- store packets as JSON blobs
- maintain a link table for incoming and outgoing edges
- compute denormalized views for browsing, flattened display fields, but not as the source of truth

### Bundles and distribution

A bundle is a portable package of packets plus metadata for transfer.

Bundles are importable and exportable, enabling:
- local sharing
- peer-to-peer sharing
- hosted mirrors
- archival snapshots
- sneakernet

### Bandwidth tiers

Design for graceful degradation across:

- high bandwidth, near real-time sync
- low bandwidth, delayed bundle exchange
- intermittent offline, store-and-forward
- full offline, operate locally and reconcile later

### Conflict and merge

The guide should explicitly include:

- packet identity rules, stable refs and versioning
- merge policies per packet type, since some are append-only records and some are forkable documents
- conflict surfacing UX, such as show diffs and choose branch/fork

## Trust, identity, OPSEC, and abuse resistance

This is where “well-rounded” matters. OPSEC is not the product. It is a necessary capability for real-world conditions.

## Trust as layered and probabilistic

The system should avoid binary “verified/unverified” thinking.

Trust is confidence built over time, through evidence, participation history, and relational context.

That implies:

- opt-in proof tiers, where stronger proof yields stronger influence, especially locally
- voucher / attestation networks, weighted and independence-aware
- time-based trust growth
- scoped influence, local-first and harder to fake at scale

## Identity continuity without forced exposure

We should support persistent pseudonymous identity by default, with later cryptographic signing for continuity and tamper-evident records.

Real-name disclosure must be optional and private where needed.

## OPSEC and safety options

Scraped nugget category, not the whole product.

The guide should include a dedicated **Safety & OPSEC Modes** section covering:

### Participation privacy posture

- public identity vs stable pseudonym vs anonymous participation, where allowed by local policy
- visibility of membership and rosters, including “no roster” modes
- redaction rules in minutes and AARs, focusing on roles and outcomes rather than personal identity
- assembly-level privacy tiers
- open-by-default with cause-based privacy exceptions
- protected deliberation channels for sensitive topics
- ability to publish outcomes without publishing participant identities

### Action safety

- safety protocol modules for missions
- baseline legal compliance expectations
- required safety toggle patterns for high-risk actions, forcing explicit acknowledgement

### Abuse resistance

- anti-sybil posture: make fake identities expensive and low-impact, not just “prevent”
- rate limits / friction on high-impact actions
- scoped authority: local grounding constrains influence

The key is to write these as capability options with clear defaults and clear escalation paths, not as paranoia-driven product identity.

## Naming conventions, UI/layout rules, and repo structure

## Naming conventions

The guide should define naming at four levels.

### Packet IDs

- `packet_id` is the stable logical packet identity
- `revision_id` is the immutable exact revision reference
- revision ancestry belongs in `parent_revision_refs`, and packet-to-packet lineage belongs in typed `edges`
- packet stores should track multiple head revisions plus one preferred revision instead of assuming every packet stays linear
- human-facing semantic versioning should live inside body schemas where it actually matters, not in the generic header

### Schemas and types

- TypeScript types mirror schema names exactly
- Zod validators are the canonical validators
- display models are views, never the source of truth
- every packet family should have one body schema, one body type, and one parser entrypoint through the schema registry

### UI labels

- user-visible labels should be consistent across app surfaces
- avoid drift between code names and UI terms by maintaining a small lexicon

### Repo and package names

- monorepo packages named for function: `core`, `schema`, `storage`, `sync`, `ui`, `adapters`
- avoid “misc” buckets

## UI/layout rules

Document rules that keep the UI coherent across devices:

- routes are stable; layout density changes per device
- graph context is always one gesture away, incoming/outgoing references
- every proposal, plan, report, and policy is linkable by ref
- “where am I in the fractal?” is always visible, with scope breadcrumb plus upward/downward links
- “what happens next?” is always explicit, with pipeline state:
  **signal → proposal → decision → plan → report**

## Repo structure

A practical initial layout:

```text
/apps/owa
/packages/core
/packages/schema
/packages/storage
/packages/sync
/packages/ui-kit
/packages/adapters/discord
/docs
```

With notes:

- `/apps/owa` = Expo app, web-first, responsive, eventually mobile
- `/packages/ui-kit` = shared components
- `/packages/adapters/discord` = optional, if retained
- `/docs` = canon, implementation guide, RFCs, decision log

The guide should include “what goes where” rules so we do not end up with circular dependency soup.

## Decision log, tradeoffs, open questions, and change discipline

This is the implementation guide’s anti-entropy system.

## Decision log

Every major decision gets a short entry:

### 2026-04-10 - Identity continuity uses cryptographic person elements for every actor

- Context: the earlier nexus slice still treated guest participation as an anonymous session label layered beside the packet graph, which would have forced a separate identity model once claim/sign-in work arrived.
- Options considered: keep anonymous sessions until “real auth” exists, add cryptography only for claimed users, or make every graph actor a real `Element(kind: "person")` and let lifecycle determine authority.
- Decision: every nexus actor that can write to the graph is now a cryptographic person element. The implemented lifecycle is `ephemeral_guest` (memory/session only), `persistent_guest` (device-local opt-in), and `claimed` (backed by an encrypted local identity bundle plus optional web sign-in).
- Why: one actor model keeps provenance, signing, verification, packet authorship, and future trust work consistent from day one. It also avoids a later migration from fake guest actors to real packet identities.
- Consequences / follow-ups: discussion and packet-vote writes now resolve `provenance.created_by` from a verified actor packet, legacy `anonymous-session:*` refs remain readable for older discussion content, and trust weighting or assembly authority rules remain intentionally deferred.

### 2026-04-17 - Migration-ready split keeps existing roots but tightens ownership boundaries

- Context: the repo already had real `domain/*` and `storage/*` seams, but large auth, identity, and discussion files were still concentrating runtime, orchestration, and reusable logic together.
- Options considered: rename the repo into new `core/runtime/interface` roots immediately, keep shipping features without tightening ownership, or preserve the current roots while extracting responsibility by subsystem first.
- Decision: keep the existing top-level folders for now, but treat `domain/*` as portable logic, `storage/*` as persistence/query adapters, `lib/nexus/server/*` as runtime/API orchestration, `lib/nexus/*` as client/runtime helpers, and `app/*` plus `components/*` as UI orchestration only.
- Why: this gives the repo a migration-ready split without paying the extra churn cost of immediate package/root renames, and it lets later moves into explicit `core/runtime/interface` namespaces stay mechanical.
- Consequences / follow-ups: visible naming stays stable during this refactor, the first landed seams now include `domain/packets/identity.ts`, `domain/packets/discussion.ts`, `lib/nexus/identity-storage.ts`, `lib/nexus/server/auth-service.*`, `lib/nexus/server/nexus-packet-service-*`, `lib/nexus/server/discussion-service.scope.ts`, `lib/nexus/server/discussion-service.pagination.ts`, and split `lib/nexus/nexus-api-types.*` / `lib/nexus/nexus-query-api.*` barrels, and tests should attach to those extracted subsystem helpers so later boundary moves stay safer.

### 2026-04-17 - Final source roots are `core`, `runtime`, and `app`

- Context: after the subsystem extractions landed, the remaining ambiguity was no longer responsibility ownership inside the code; it was the top-level folder model itself.
- Options considered: stop at the transitional roots, rename everything directly into `core/runtime/app` while risking Expo Router conflicts, or use `src/app` as the framework route shell so top-level `app/*` could become the full application layer safely.
- Decision: rename `domain/*` to `core/*`, move `storage/*` and `lib/nexus/*` under `runtime/*`, move application-layer UI/content/support code under top-level `app/*`, and relocate the Expo Router tree to `src/app/*`.
- Why: this gives the repo real architectural roots without turning shared UI files into accidental routes, and it keeps the route surface thin while still letting `app/*` represent the whole application layer.
- Consequences / follow-ups: old `domain`, `storage`, and `lib/nexus` roots are gone, imports now resolve through `@core/*`, `@runtime/*`, and `@app/*`, and future file-size cleanup can happen incrementally inside the new roots instead of being blocked on another structural rename.

### 2026-04-17 - Trust becomes the top-level function and `You` becomes a personal scope lens

- Context: the shell still treated `Account` as a primary function workspace even though the next product phase needed scope-local legitimacy, role claims, and trust posture to work across every scope, including the current actor.
- Options considered: keep `Account` as the main function until a later UI pass, collapse security controls directly into trust, or swap the function surface now while leaving wrapper-level identity custody separate.
- Decision: replace the top-level `Account` function with `Trust`, keep `/nexus/account` as a hidden wrapper-level account/custody route reached through the profile link, and add `You` as a first-class personal scope lens resolved from the active actor packet.
- Why: this matches the intended shell grammar better. `Trust` is a function that applies to any scope, while account/security is wrapper-level identity custody rather than a civic workspace peer beside dashboard, discussions, votes, or library.
- Consequences / follow-ups: the shell section order is now `dashboard / discussions / votes / roles / trust / library`, `You` can be used with those same functions, trust payloads must stay scope-local and actor-aware, and future information architecture work can decide whether wrapper-level account tools should later be entered through `You` or remain profile-linked.

### 2026-04-17 - Roles become a dedicated scope workspace and role evidence uses real attestations

- Context: the first trust pass could project claimed roles for the current actor, but role review was still mixed into the trust surface and did not yet show scope-level claimant lists, real support/dispute actions, or inline evidence review.
- Options considered: keep roles embedded in Trust longer, block in UI-only placeholders first, or add a dedicated `Roles` workspace backed by the existing role claim and attestation model.
- Decision: add `/nexus/roles` as a top-level function, move role claim and unclaim actions onto that surface, project scope-relevant claimants per role, and use claim-targeted `Attestation(kind: "claim_support" | "claim_dispute")` writes with `note` as the public comment field.
- Why: this keeps `Trust` actor-centric while making `Roles` the scope-facing review surface. It also reuses the existing packet model instead of inventing a second role-voting subsystem.
- Consequences / follow-ups: claimant lists are now scope-relevant rather than global, disputes require a comment, support and dispute are mutually exclusive per viewer/claimant/role/scope, evidence is inspected inline on the roles page for now, and later attestation-browser work should build on the same edge projections instead of replacing them.

### 2026-04-17 - Packet schema compatibility, role packets, and baseline trust projections are now first-class

- Context: packet revisions already existed, but schema evolution, trust semantics, and role legitimacy were still mostly planned concepts rather than enforceable structures in the runtime.
- Options considered: keep using `schema_version` as a reserved placeholder, add a generic claim family first, or land the smallest compatibility-aware trust slice using the existing packet graph model.
- Decision: add per-family schema compatibility handling with explicit upcasters and future-version rejection, add required family `revision_mode` metadata, introduce `Role` and `Claim` as packet families, move role and assembly association assertions onto scoped `Claim` packets, extend `Attestation` with generic claim support/dispute evidence kinds, and project trust through explicit stages plus baseline policy thresholds.
- Why: this keeps packet history backward-compatible while making trust evidence inspectable and portable. It also avoids overbuilding a generic claim system before the simpler role-and-attestation model is proven.
- Consequences / follow-ups: older `Element` and `Policy` bodies can upcast into the current internal shape without rewriting stored revisions, trust now has a real runtime/API slice instead of only conceptual docs, numeric trust scores remain deferred, and future governance or packet explorer work should build on the same family-compatibility and evidence-threshold rules rather than inventing separate trust state.

### 2026-04-23 - Schema compatibility moved from ad hoc patches to a compatibility read/write pipeline

- Context: the first compatibility slice worked for simple upcasts, but later schema changes kept leaking into auth/runtime as one-off fixes such as legacy signature-field stripping and implicit read-time normalization.
- Options considered: keep extending `parsePacketEnvelope` plus local runtime patches, add a separate runtime-only compatibility wrapper, or promote schema compatibility into a first-class core pipeline with explicit raw/adapted/read-for-write modes.
- Decision: compatibility is now owned by `core/schema` through a versioned family registry that can parse raw revisions, adapt them into canonical runtime packets, prepare legacy packets for adapted-save writes, and supply legacy unsigned-packet candidates for signature verification. Packet storage keeps raw imported revisions intact, runtime reads adapted packets by default, and internal read paths can return raw-plus-adaptation metadata for later packet-browser work.
- Why: schema evolution should be solved once at the packet boundary instead of rediscovered in auth, storage, route handlers, or query services every time a field is added or normalized.
- Consequences / follow-ups: `Element`, `Claim`, and `Policy` now have explicit adapter entries instead of scattered special cases, legacy imported bundles preserve raw revision JSON while query/runtime surfaces still receive canonical adapted packets, and declared-current packets that still carry older body shapes are now interpreted through effective legacy compatibility profiles so old accounts and seed-era packets do not bypass adapters just because their `schema_version` was stamped forward early. Future packet-browser work can build on raw/adapted/adaptation-summary reads, and any new family/schema change should land with an adapter entry plus adaptation summary before runtime code grows another compatibility patch.

### 2026-04-23 - Fortress pass 1 moved discussion write admission into core mutation law

- Context: schema compatibility now protects historical packet shapes, but discussion writes were still allowing the browser to build authoritative packet envelopes while runtime routes and services mixed actor assertion checks, session proof checks, provenance assumptions, and family-specific admissibility rules together.
- Options considered: keep patching discussion service directly, try to move the whole write surface behind a new auth law at once, or pilot the fortress move on discussion thread/post/reply writes first.
- Decision: add the first `core/auth/*` slice for portable proof levels, typed write-policy evaluation, discussion write authority checks, and canonical mutation-candidate construction; extend `Policy` with typed `write_policy` support for `policy_kind: "write_lock"`; keep runtime responsible for sessions, unlock, reauth, and signer access; and change discussion post/reply routes so the intent fields are authoritative while any signed packet bundle must match the canonical core-built candidate before persistence.
- Why: this starts moving write truth out of route/service folklore without pretending the current browser-held signing keys already live in core, and it gives the broader fortress refactor one concrete pilot family instead of another architectural sketch.
- Consequences / follow-ups: discussion thread/post/reply creation now has one canonical candidate path shared by client and server, scope `Element` packets can reference typed write-lock policies through `header.moderation.policy_refs`, guest visitor-lobby posting still works as the default no-policy baseline, and the next fortress passes should widen the same mutation-law seam across claims/roles/trust while pulling the signer implementation further down out of the UI layer.

### 2026-04-24 - Fortress pass 2 introduced the shared prepare/sign/finalize corridor

- Context: the first fortress pass removed browser authority over discussion packet shape, but the browser still built canonical candidates locally, packet-signal vote writes still accepted client-authored attestation packets, and write approval preferences still lived primarily in runtime auth storage rather than packet-backed policy.
- Options considered: keep extending discussion-specific write glue, move private-key custody into core immediately, or add a shared prepare/sign/finalize corridor that lets core own canonical candidates and final admission while runtime continues to host proofs, tickets, signer access, and persistence.
- Decision: add shared mutation transport endpoints (`/api/nexus/mutations/prepare` and `/api/nexus/mutations/finalize`), canonical unsigned digest checks, and one-time mutation tickets so core now prepares exact packet candidates, runtime issues actor-bound expiring tickets, the current web identity shell signs the prepared candidates through a temporary signer-adapter path, and finalize re-verifies digest, signature, authority, proof level, and policy before persisting any packet effects. The first corridor-backed actions are discussion post or reply creation, packet-signal vote attestations, and actor write-preference updates.
- Why: this creates the first real universal write corridor without forcing server-held private keys. Core now owns the canonical bytes, digest law, and final admission contract for migrated actions, while runtime remains the environment-specific proof and signer host instead of the source of mutation truth.
- Consequences / follow-ups: packet-backed `write_lock` policy is now the real write-preference source for the active UI flow, but broader interactive routes such as role claims, locality writes, assembly writes, and other user-triggered packet mutations still need migration onto the same corridor; the legacy auth-store `security_mode` row remains a compatibility fallback until every caller stops depending on it; and a later audit pass should add hard guardrails so non-allowlisted interactive routes cannot keep calling packet-store write helpers directly outside the corridor.

### 2026-04-10 - Claimed auth uses local keys plus server challenge sessions

- Context: the repo needed secure sign-up/sign-in and “keep me logged in” behavior without making browser cookies the source of identity truth.
- Options considered: traditional password-only server auth, passkey-first auth before the packet flow exists, or local key custody with a server-issued session wrapper.
- Decision: claimed identities now generate `P-256` keypairs client-side, store encrypted identity bundles locally with a passphrase, sign server-issued challenges to create auth sessions, and optionally receive persistent refresh-backed cookies for `keep me logged in`.
- Why: this keeps identity truth attached to packet-verifiable key control while still giving the web app an industry-standard `HttpOnly`/`Secure`/`SameSite=Lax` session layer for UX.
- Consequences / follow-ups: guests receive no auth cookie by default, memory-only guests now exist without browser storage unless the user explicitly chooses session-only or device-local persistence, claimed identities can remain selected but locally locked after reload until the user re-enters the passphrase, and future passkey or key-rotation work should extend the same person-element plus challenge-response model rather than replacing it.

- decision
- date
- context
- options considered
- why we chose it
- consequences / follow-ups

Examples of decisions worth logging early:

- Expo routing approach
- SQLite strategy for web, native vs WASM
- packet versioning strategy
- bundle format and signing approach
- trust tier definitions and influence weighting
- how OBMS aggregation is represented and audited

### 2026-04-08 - Packet identity uses stable packets plus immutable revisions

- Context: earlier Nexus variants mixed object IDs, packet versions, and packet snapshots in ways that made lineage and storage harder to normalize.
- Options considered: keep `object_id + packet_version`, keep the old flat packet shape, or move to a nested envelope with stable packet identity and immutable revisions.
- Decision: use `PacketEnvelope = { header, body }`, with stable `packet_id`, immutable `revision_id`, and `schema_version` reserved for parser compatibility.
- Why: this cleanly separates logical identity from exact stored state, fits append-only storage, and lines up better with bundle sync, revision comparison, and future merge rules.
- Consequences / follow-ups: SQLite storage should normalize `packets` and `packet_revisions`, future bundle manifests should export revision refs directly, and body-level semantic versioning stays family-specific instead of leaking into the generic header.

### 2026-04-08 - Revision history is a DAG, not a single chain

- Context: mesh sync, offline edits, and interface diversity mean multiple valid revisions can descend from the same parent before a device sees the other branch.
- Options considered: keep one `previous_revision_id`, store conflicts only as packet edges, or model revision ancestry as a multi-parent DAG.
- Decision: replace single-predecessor revision ancestry with `parent_revision_refs`, allow multiple concurrent head revisions per packet, and track one preferred revision separately from the full head set.
- Why: real conflict handling needs merge revisions with multiple parents, not just a linear timeline plus hand-wavy lineage metadata.
- Consequences / follow-ups: packet stores should expose head status, import logic should detect fast-forward vs divergence vs merge, append-only families should usually coexist rather than merge, and forkable document families need merge policies plus compare UX.

### 2026-04-08 - Packet relationships use one typed edge collection

- Context: older Nexus variants used a mix of header slots, nullable relation fields, and separate dependency lists, which made graph traversal inconsistent.
- Options considered: keep dedicated relation slots, keep a separate dependency list plus ad hoc links, or normalize all relationships into one edge model.
- Decision: store packet relationships in a single `edges: PacketEdge[]` collection, with scope ownership separated into `authority_scope_ref` and `applicable_scope_refs`.
- Why: one edge model gives the browser, storage layer, and nexus projections a single graph vocabulary for lineage, dependencies, memberships, reports, and scope applicability.
- Consequences / follow-ups: packet family bodies should point to other packets through refs, storage should index normalized edges, and localized nexus views should read projections from the shared graph rather than inventing separate packet-like types.

### 2026-04-08 - Element stays the identity-root family

- Context: OWA needs to represent assemblies, teams, nodes, people, orgs, and services without fragmenting the identity layer into parallel storage primitives.
- Options considered: separate top-level families for assemblies and teams, keep the old mixed approach, or make `Element` the single identity root with kinds.
- Decision: keep `Element` as the identity-root family and model assemblies, teams, nodes, people, organizations, and services as `Element` kinds.
- Why: it keeps identity continuity, trust, and scope references centered on one root family while still allowing subtype-specific UI labels.
- Consequences / follow-ups: scope refs should target `Element` packets, nexus labels can still say `assembly packet` or similar through display projections, and follow-on schema work should prefer subtypes before creating new top-level families.

### 2026-04-08 - Add packet builders and first seed dataset

- Context: the schema layer existed, but we still needed a concrete way to start creating canonical packets for forum work, scope trees, and later persistence adapters.
- Options considered: keep hand-authoring raw packet JSON, build packet families ad hoc inside UI/data files, or add a dedicated builder layer with reusable seed datasets.
- Decision: add typed packet builders under `domain/packets` for the active creation slice (`Element`, `DiscussionThread`, `DiscussionPost`, `Policy`, `Proposal`, and `Vote`) plus a reusable seed dataset for `Global Commons -> United States -> California -> Moreno Valley -> Sunnymead Ranch`, a person element, and forum-linked packets.
- Why: it gives the repo one consistent path for creating valid packets, keeps packet logic out of the UI layer, and gives forum work a real packet dataset instead of temporary shapes.
- Consequences / follow-ups: the next persistence step should import these seed packets into an in-memory or SQLite-backed `PacketStore`, future seed datasets should use the same builder layer, and additional packet-family builders can be added as those surfaces move from concept to implementation.

### 2026-04-08 - Use `parent_scope` for assembly hierarchy

- Context: the first real assembly seeds needed an explicit way to represent `Global -> national -> state -> city -> neighborhood` lineage without overloading person membership or scope applicability.
- Options considered: overload `member_of`, rely only on `authority_scope_ref` / `applicable_scope_refs`, or add a dedicated edge type for assembly hierarchy.
- Decision: use `parent_scope` as the child-to-parent assembly edge in the packet graph.
- Why: it keeps scope hierarchy legible and queryable without conflating assembly lineage with person membership, proposal scope, or packet ownership.
- Consequences / follow-ups: incoming `parent_scope` edges can power child-assembly discovery later, and packet-store indexing should treat `parent_scope` as a first-class navigational edge.

### 2026-04-08 - Dedicated nexus shell under `/nexus/*`

- Context: the repo only had a public website shell plus a placeholder nexus page.
- Options considered: keep the nexus inside the public header/footer shell, create a hybrid shell, or split the nexus into its own nested layout.
- Decision: create a dedicated nested nexus layout while leaving the outer public website unchanged.
- Why: the nexus needs app-like navigation density, persistent scope context, and a responsive left rail that would fight the public-site shell.
- Consequences / follow-ups: public pages remain simple and static, while nexus work can now evolve independently through `app/nexus/_layout.tsx` and nexus-specific components.

### 2026-04-08 - Global guest default with visitor-lobby-only posting

- Context: the nexus needed a usable initial state before auth, credentials, locality claiming, or trust progression exist.
- Options considered: force scope selection first, open in a demo locality, or default to a global guest nexus.
- Decision: default to `Global Guest` in `Global Commons`, allow public browsing across scopes, and allow posting only in visitor lobby spaces.
- Why: it preserves open browsing and orientation without pretending trust, membership, or vote rights already exist.
- Consequences / follow-ups: join/start-locality flows, identity continuity, and trust-aware permissions can arrive later without rewriting the first nexus shell.

### 2026-04-08 - File-backed visitor lobby before SQL

- Context: the discussions surface needed to become genuinely usable before the SQL adapter and full packet-store persistence path are wired into the app.
- Options considered: keep visitor-lobby posting local-only, wait for SQL before adding any persistence, or introduce a lightweight local API plus shared bundle file as the first durable write path.
- Decision: persist visitor-lobby posts through Expo Router API routes into a shared JSON bundle file, store them as canonical `DiscussionThread` and `DiscussionPost` packets, and use session-scoped anonymous guest labels through external refs rather than overloading packet authorship fields.
- Why: it creates a real read/write loop now, exercises a repository seam the later SQL adapter can replace, and avoids blocking the UI on unfinished infrastructure.
- Consequences / follow-ups: only the visitor lobby uses live persistence in this slice, the bundle path remains local-dev oriented, later SQL work should swap the repository implementation without changing the discussions UI contract, and anonymous guests can later gain real `Element(kind: "person")` packets without changing the discussion packet family itself.

### 2026-04-08 - Simplify discussions into one active forum workspace

- Context: once the visitor-lobby persistence path existed, the discussions page still felt crowded because the lobby composer, forum list, and read-only thread preview examples all competed for width inside the nexus shell.
- Options considered: keep the split-column preview-heavy layout, move previews elsewhere, or simplify the surface around one active forum at a time with a switchable forum menu.
- Decision: make `app/nexus/discussions.tsx` a single active-forum workspace with horizontal forum tabs, keep only the selected forum visible beneath it, remove the read-only thread preview cards, and back the selected tab with the `forum` query parameter instead of creating separate route files.
- Why: it keeps the visitor lobby readable when both shell menus are open, preserves visibility into the planned forum structure, and reduces filler while leaving a stable layout for future packet-backed discussion spaces.
- Consequences / follow-ups: the visitor lobby remains the only writable forum in the MVP, non-lobby forums still need real packet/thread integrations later, the active tab is deep-linkable without fragmenting the route tree, the base discussions route now falls back locally instead of issuing a mount-time router redirect, and richer forum pages can later graduate into dedicated nested routes if they truly diverge.

### 2026-04-08 - Consolidate packet storage code under `storage`

- Context: packet storage artifacts were split awkwardly between `domain/*` code and a raw SQL schema file under `data/schemas`, which blurred the line between runtime content and canonical storage logic.
- Options considered: keep the mixed layout, move everything storage-related into `data/*`, or treat packet storage as part of the domain layer and keep `data/*` for mock/runtime content only.
- Decision: move the packet-store schema into a dedicated top-level `storage` boundary, keep row projections and the `SQLitePacketStore` implementation in the same boundary, and reserve `data/*` for UI mock content plus runtime bundle files.
- Why: packet storage is business logic, not content. Keeping schema, projections, and store implementation together reduces drift and makes the later SQLite-backed runtime easier to reason about.
- Consequences / follow-ups: docs and future code should treat `storage/*` as the packet persistence boundary, while `data/nexus` remains a temporary runtime/content area until active routes fully read from the packet store.

### 2026-04-08 - Add `SQLitePacketStore` on Expo SQLite

- Context: the packet contract and schema already existed, but we needed a real SQL-backed implementation before additional packet-backed features started inventing one-off repositories.
- Options considered: wait until the visitor-lobby repository is replaced, build a Node-only SQLite adapter, or implement the canonical packet store directly on Expo SQLite so it can serve app/runtime use cases.
- Decision: install `expo-sqlite`, fix the Expo plugin configuration, and add `SQLitePacketStore` under `storage` with schema initialization, revision writes, preferred-head tracking, edge queries, and JSON bundle import/export.

### 2026-04-08 - Keep storage as a separate boundary from domain logic

- Context: the repo briefly treated storage implementation as part of the `domain/*` tree, which blurred the line between business rules and infrastructure.
- Options considered: leave storage inside `domain/*`, move storage back into `data/*`, or create a dedicated top-level storage boundary.
- Decision: keep packet schemas, packet builders, and service interfaces in `domain/*`, but move the concrete persistence layer to top-level `storage/*`.
- Why: this preserves the original UI / business / storage separation more faithfully while still keeping the codebase small and navigable.
- Consequences / follow-ups: imports should treat `storage/*` as infrastructure, `domain/index.ts` should no longer re-export storage, and future non-SQL persistence adapters should live beside SQLite under the same storage boundary.
- Why: this gives the repo one canonical packet persistence implementation that matches the current Expo stack and can later replace specialized temporary stores instead of competing with them.
- Consequences / follow-ups: active routes still need wiring before the packet store becomes user-visible, visitor-lobby persistence should eventually delegate to the packet store, and browser/nexus query services can now be implemented over the same SQLite backing layer.

### 2026-04-08 - Move the live visitor-lobby backend onto the packet store

- Context: the discussion UI and packet foundations were ready, but the live visitor-lobby backend still wrote to a standalone JSON bundle instead of the canonical packet store.
- Options considered: keep the file bundle longer, route the API through Expo SQLite, or add a dedicated server-side SQLite packet-store adapter for Expo Router API routes.
- Decision: add `NodeSQLitePacketStore` under `storage/*`, wire the visitor-lobby repository to that store, seed public lobby threads there, and import the older `data/nexus/visitor-lobby-bundle.json` only as a one-time legacy migration source.
- Why: it keeps the UI contract stable while finally making the live discussion backend use the same packet/revision/edge model as the rest of the system, and it avoids depending on Expo SQLite inside the server route runtime.
- Consequences / follow-ups: the visitor-lobby bundle file is no longer the active write path, the local canonical database now lives at `data/nexus/owa-packets.db`, anonymous guests still remain session-labeled external refs until low-trust guest elements arrive, and future forum surfaces should build on the same packet-store boundary instead of inventing custom repositories.

### 2026-04-09 - Enable server web output for local forum API routes

- Context: the discussion backend had been wired to Expo Router API routes, but the app config still used `web.output = "static"`, which prevented the local web runtime from executing those routes.
- Options considered: keep static output and move persistence client-side, add a separate external backend just for the forum MVP, or switch the Expo web runtime to server output so the existing API routes can run locally.
- Decision: set `expo.web.output` to `server` in `app.json` and treat local forum persistence as a server-runtime feature.
- Why: the current visitor-lobby MVP already depends on local API routes and Node-backed SQLite, so server output is the minimal change that lets the existing backend actually run.
- Consequences / follow-ups: local web development needs a restarted dev server after the config change, API-route-backed persistence is now available in local web runs, and any future static-only export plan will need a different backend story instead of assuming the visitor-lobby server routes still exist.

### 2026-04-09 - Implement shared browser and nexus query services over SQLite search rows

- Context: the packet store could write, read, and merge packets, but the repo still lacked a concrete query layer that could drive packet browser views or replace nexus mock cards.
- Options considered: add list/search methods directly to `PacketStore`, build one-off route-specific repositories, or keep `PacketStore` focused on persistence while implementing dedicated browser/nexus query services over the packet search index.
- Decision: implement shared `PacketStoreBrowserQueryService` and `PacketStoreNexusQueryService` in `storage/query-services.ts`, then add Node and Expo SQLite adapters that load `packet_search_index` rows from the same database as the packet store.
- Why: this keeps persistence and projection concerns separate, preserves the clean domain/storage boundary, and gives both server and app runtimes one packet-native query surface.
- Consequences / follow-ups: browser queries now support packet lookup, link traversal, revision-head inspection, and field-level revision comparison; nexus queries now support scope-aware dashboard, discussion, vote, and library card lists; and the next UI integration pass can start replacing `data/nexus/mock-nexus-data.ts` with packet-backed projections.

### 2026-04-09 - Replace active nexus mock arrays with packet-backed shell and scope query routes

- Context: query services existed, but the active `/nexus/*` screens and shell context were still reading from `data/nexus/mock-nexus-data.ts`, which left packet logic disconnected from the visible app.
- Options considered: keep mock UI data while only visitor-lobby stayed live, wire each screen directly to storage classes, or add explicit packet-backed API routes and switch shell/screens over route-by-route.
- Decision: add packet-backed API routes (`/api/nexus/shell` and scoped dashboard/discussions/votes/library routes), bootstrap all of them through one shared server packet-service singleton, remove `mock-nexus-data.ts` from active imports, and move surviving static copy into `lib/nexus/nexus-content.ts`.
- Why: this preserves the UI/business/storage separation while making the visible nexus experience run on real packet projections from the canonical SQLite store.
- Consequences / follow-ups: scope trees now come from `Element(kind: "assembly")` packets, page cards come from `NexusQueryService`, the visitor-lobby repository shares the same seeded packet store, and any remaining placeholder behavior should now be treated as packet projection gaps instead of mock-data debt.

### 2026-04-09 - Use route-safe scope ids and fix packet write ordering for SQLite FK integrity

- Context: scoped API routes were receiving packet ids like `nexus:element/global-commons` in URL params, which made route matching brittle, and first writes of new packets could fail with SQLite foreign-key errors because revision rows were inserted before packet-head rows.
- Options considered: keep packet ids in route params and patch URL handling ad hoc, relax foreign keys, or separate route ids from packet refs while enforcing packet-head-first writes.
- Decision: project assembly scopes to route-safe ids (for example `global-commons`) for shell and scoped API URLs while mapping them back to packet refs server-side, and insert an initial `packets` row before inserting `packet_revisions` when creating a new packet.
- Why: this keeps API routing predictable and preserves strict SQLite FK guarantees without weakening schema constraints.
- Consequences / follow-ups: active scope URLs remain human-readable, scope lenses still use canonical packet refs internally, visitor-lobby post creation now succeeds for first-write packets in a fresh database, and the server bootstrap now backfills any missing seed packets instead of skipping seeding once any element exists.

### 2026-04-09 - Pass strict named-parameter subsets to Node SQLite updates

- Context: Node SQLite rejects unknown named parameters by default, and packet update statements were receiving full records that included fields not referenced in their SQL.
- Options considered: globally allow unknown named parameters, manually maintain query-specific parameter maps, or relax type safety around statements.
- Decision: keep strict statement behavior and pass query-specific parameter subsets for packet update operations.
- Why: this prevents runtime write failures such as `unknown named parameter 'created_at'` while preserving strict SQL binding semantics.
- Consequences / follow-ups: packet writes now remain stable on clean databases and after resets without weakening SQLite parameter validation.

### 2026-04-09 - Normalize discussion scope ids and dedupe forum tabs by thread kind

- Context: discussion tabs were showing duplicate visitor-lobby surfaces across scopes, and visitor-lobby API requests could fail when route params arrived percent-encoded (for example `nexus%3Aelement%2Fglobal-commons`).
- Options considered: leave tab duplication and rely on manual seed cleanup, hard-delete conflicting discussion threads, or normalize scope ids at the repository boundary and project one tab per discussion thread kind.
- Decision: decode scope ids before packet resolution in the visitor-lobby repository, prefer an existing `visitor_lobby` thread for the current authority scope before auto-creating one, and build discussions tabs from `DiscussionThread` packets with one winner per `thread_kind`, preferring current-scope authority threads over inherited ancestors.
- Why: this keeps URL-driven scope requests resilient, prevents accidental duplicate visitor-lobby threads from becoming user-facing tab clutter, and preserves intentional inheritance for non-local thread kinds without multiplying tabs.
- Consequences / follow-ups: fallback shell scope ids should stay route-safe (for example `global-commons`), existing duplicate visitor-lobby threads remain in storage but no longer produce duplicate tabs, and future thread-kind additions should define their forum-id mapping/order in one place.

### 2026-04-09 - Make discussion tab labels scope-aware while preserving inherited thread linkage

- Context: after deduping forum tabs by thread kind, deeper scopes still displayed ancestor-owned read-only tab titles like `Global general`, which made the scope lens feel incorrect even though packet selection was working.
- Options considered: keep ancestor titles, duplicate thread packets into every scope just for labels, or project scope-local tab titles while preserving references to the selected canonical thread packet.
- Decision: keep thread selection/ownership logic unchanged, but render forum tab titles from active scope name + normalized forum kind for known kinds (`visitor_lobby`, `general`, `proposals`, `reports`).
- Why: this improves user comprehension in scope-first browsing without creating fake packet copies or breaking thread packet linkage.
- Consequences / follow-ups: unknown/custom thread kinds still use their source packet titles, and if future localization/branding rules are added they should be centralized in the same forum-title projection helper.

### 2026-04-10 - Attestations replace packet votes as the reusable trust edge

- Context: the repo had a working `PacketVote` discussion reaction primitive, but the next trust milestone needed one shared signed relationship packet that could cover discussion reactions, proposal support, attendance vouches, identity attestations, and person-to-assembly locality claims without inventing separate packet families for each.
- Options considered: keep `PacketVote` and overload its meaning further, add a second trust packet family beside it, or rename and generalize the existing primitive into one canonical `Attestation` family while keeping discussion `+1/-1` behavior stable.
- Decision: rename the reusable trust primitive from `PacketVote` to `Attestation`, expand its body with `attestation_kind`, optional `context_ref`, optional `supporting_refs`, optional `note`, and optional `supersedes_ref`, and move attestation indexing and mutation logic into a dedicated `SQLiteAttestationService`.
- Why: this keeps one signed edge primitive for the graph, gives locality and trust flows a first-class home outside the discussion service, and still lets the existing discussion UI consume the same `vote_summary` shape while the product vocabulary moves toward attestations.
- Consequences / follow-ups: discussion `+1/-1` reactions now flow through `Attestation(kind: "packet_signal")`, derived attestation rows now live in `attestation_index` and `attestation_tally_index`, `/api/nexus/packets/vote` remains behavior-compatible as the current discussion reaction transport, and assembly continuity plus role legitimacy now ride on scoped `Claim` packets with claim-targeted support/dispute attestations.

### 2026-04-09 - Universal packet votes power the first real discussion engine

- Context: the packet-backed visitor lobby was working, but discussions were still effectively a flat guest post list with no threaded replies, no reusable vote system, and no point/trust hooks for future moderation and anti-spam rules.
- Options considered: keep bolting discussion-only reactions onto the visitor-lobby repository, reuse governance `Vote` packets for every `+1/-1` signal, or add a universal packet-vote family plus a dedicated discussion service over the canonical packet store.
- Decision: add `PacketVote` as a first-class packet family for universal `+1/-1` signals, keep formal governance `Vote` packets separate, extend `DiscussionThread` packets with participation rules and default sort metadata, and move discussion reads/writes into one server-side `SQLiteDiscussionService` that projects threaded replies, vote tallies, actor ledgers, and moderation flags from canonical packets.
- Why: this keeps the vote model reusable across the graph, preserves a clean distinction between support/quality signals and binding governance ballots, and gives the discussions UI one coherent backend instead of several visitor-lobby special cases.
- Consequences / follow-ups: `/nexus/discussions` now uses packet-backed feed/detail APIs, anonymous guests start at `0` points, only replies can earn points, top-level posts cost `10`, negative discussion content can be deprioritized or hidden through derived vote thresholds, and the discussion engine still projects `discussion_post_index` plus `discussion_actor_ledger` from canonical packets while raw attestation tallies now live in the dedicated attestation service.

### 2026-04-09 - Keep packet ids out of dynamic route segments

- Context: discussion thread-detail, reply, and packet-vote APIs were originally shaped around dynamic route params such as `[postId]` and `[packetId]`, but canonical packet ids contain `/`, which makes those APIs fragile even when ids are URL-encoded.
- Options considered: keep dynamic packet-id route params, invent a separate transport-safe packet-id encoding, or move packet refs into query strings and request bodies while leaving canonical ids unchanged.
- Decision: use query/body packet refs for discussion detail, reply, and packet-vote APIs (`post_packet_id`, `parent_post_packet_id`, `target_packet_id`) and keep packet ids out of path segments.
- Why: it preserves canonical packet ids, avoids route-matching edge cases, and keeps packet transport concerns separate from UI routing concerns.
- Consequences / follow-ups: `/nexus/discussions` now opens thread detail through a query-based API, reply/vote mutations no longer depend on dynamic packet-id routes, and future packet/browser APIs should prefer query/body refs over path params when packet ids may contain reserved URL characters.

### 2026-04-09 - Temporary anonymous testing grant for discussions

- Context: the new point-gated discussion rules were correct for the intended anti-spam flow, but they made it awkward to test top-level posting immediately while the forum surface is still under active development.
- Options considered: keep true zero-start guests, temporarily reduce top-level post cost, or grant a temporary testing balance to anonymous guests.
- Decision: keep the normal point ledger logic but give anonymous guests a temporary `10`-point starting balance in the discussion service for testing.
- Why: it preserves the overall earned/spent point model while making the current UI testable without seed-only reply farming every session.
- Consequences / follow-ups: guests can currently open one top-level thread immediately in testing, the grant lives in discussion service policy rather than in the canonical packet schema, and it should be removed or replaced with the real onboarding/trust rule once broader forum testing is complete.

### 2026-04-09 - Keep packet mechanics portable and UI projections replaceable

- Context: the first real discussion upgrade introduced many new files at once, which raised the risk of packet logic, route transport, and UI projection code drifting back into each other.
- Options considered: let the screen own more ranking and mutation logic, collapse storage/query/projection layers together for speed, or keep packet mechanics, server-side projections, and UI rendering as separate seams.
- Decision: keep canonical packet validation, revision writes, publish, import/export bundles, and merge behavior on the `PacketStore` plus server-service boundary, let `SQLiteDiscussionService` and query routes own scope-aware projections and ranking, and keep `app/nexus/discussions.tsx` as a client of those payloads rather than a second packet engine.
- Why: this preserves the original UI / business / storage split, keeps packet mechanics portable to future adapters, and lets forum UX iterate without rewriting bundle/import/merge code.
- Consequences / follow-ups: discussion packet ids now travel through query params or request bodies instead of route path segments, thread/post packets remain attached to scope `Element` packets through `authority_scope_ref`, `applicable_scope_refs`, `thread_ref`, and `reply_to_ref`, and future importer/merge work should extend `PacketStore` and server services rather than teaching route screens how to reconcile packets.

### 2026-04-09 - Split discussions into feed, thread, and post workspaces

- Context: once threaded replies and voting were working, the discussions page still stacked forum feed, top-level composer, and thread detail in one long surface, which made reply targeting feel vague and made nested replies harder to parse.
- Options considered: keep the stacked layout, move everything into pop-out modals, or keep one route with explicit internal workspaces.
- Decision: keep `/nexus/discussions` as one route, but split the page into `Feed`, `Thread`, and `Post` workspaces driven by route state, and render the reply composer inline beneath the exact root post or nested reply chosen as the target.
- Why: this keeps the route model simple while making the forum behave more like a real threaded workspace, and it removes the misleading generic reply composer from the bottom of the page.
- Consequences / follow-ups: `Open thread` now switches the page into the thread workspace, `Reply` sets both the active thread focus and the reply target, and anonymous guest continuity is now more legible in the UI because the same session-backed label is shown alongside the writer controls that already persist into post, reply, and packet-vote external refs.

### 2026-04-09 - Make the discussions screen a connected forum shell instead of stacked cards

- Context: after adding the `Feed`, `Thread`, and `Post` workspaces, the discussions page still felt visually fragmented because forum tabs, workspace tabs, sort controls, and content panels all rendered as separate stacked cards with too much duplicated labeling.
- Options considered: keep polishing the stacked-card layout, move workspaces into modal/pop-out flows, or build one connected forum shell with tab rails physically attached to the active content surface.
- Decision: render forum tabs as a connected rail above the active forum shell, render workspace tabs as a second connected rail inside that shell, move feed/thread sorting controls into their respective workspaces, add `New post` actions from the feed surface, and constrain the whole discussions content lane to a saner max width on large screens.
- Why: this makes the page read like one coherent forum tool instead of several debugging panels, keeps the important metadata and actions away from the far right edge on desktop, and preserves the same route/query model across all scopes and discussion kinds.
- Consequences / follow-ups: duplicated eyebrow/description text was removed from the active forum container, feed cards now surface reply counts and actions in a narrower readable lane, and future discussion polish should keep using the forum-shell pattern rather than introducing disconnected card stacks again.

### 2026-04-09 - Treat feed cards as thread launch surfaces and keep thread selection inside the thread workspace

- Context: the first connected-shell pass improved tab structure, but the discussions page still felt awkward because feed cards depended on extra `Open thread` / `Reply` buttons, the content lane had become too narrow on large screens, and the thread workspace had no in-place way to switch threads.
- Options considered: keep separate feed-card action buttons, move thread opening into a pop-out, or make the feed cards themselves the primary thread-launch affordance while adding a lightweight in-workspace thread picker.
- Decision: widen the discussions lane to a middle ground between full-width and over-centered, make each feed card itself open the selected thread when pressed, keep only vote controls inline on feed cards, open the thread picker by default when no thread is selected, and visually mark the root post as the `Original post` ahead of the reply tree.
- Why: this reduces button clutter, makes the feed read more like a real forum index, lets users switch threads without leaving the thread workspace, and clarifies the hierarchy between the original post and its replies.
- Consequences / follow-ups: the thread workspace now owns both reply sorting and thread selection, feed cards no longer expose redundant reply/open buttons, and future UI polish should keep reinforcing “tap card to inspect thread” rather than reintroducing detached action rows.

### 2026-04-09 - Paginate discussion feeds and reply branches while simplifying thread selection

- Context: the lighter feed-card design improved scanability, but the discussions route still loaded entire top-level feeds and reply trees at once, and the temporary thread picker added during the previous pass felt heavier than the surrounding tab workflow.
- Options considered: keep loading entire discussion trees, add hard depth limits, keep a persistent thread picker in the thread workspace, or move to paged feed/reply reads with route-driven default thread selection.
- Decision: add cursor-based paging to `/api/nexus/scopes/[scopeId]/discussions`, `/api/nexus/scopes/[scopeId]/discussions/thread`, and `/api/nexus/scopes/[scopeId]/discussions/replies`; paginate top-level posts and direct child replies separately; collapse reply branches by default at depth `5+`; and let the `Thread` workspace auto-open the current top feed item when no explicit thread is selected instead of rendering a persistent picker.
- Why: this keeps the packet/service boundary clean, makes large discussions scale without teaching the UI to hold the whole tree in memory, and preserves a lighter route model where `Feed` remains the canonical thread-switching surface.
- Consequences / follow-ups: discussion projections now expose `next_cursor` / `has_more` metadata for feeds and reply branches, the thread workspace keeps the root post pinned while child replies load incrementally, `Load more` fallbacks remain alongside near-bottom auto-loading, and future browser-grade forum work should continue extending the query service rather than moving pagination or merge logic into route components.

### 2026-04-09 - Use segmented pills and left-rail branch toggles for discussion scanning

- Context: after paging and auto-open thread selection were in place, discussion cards still took too much effort to scan because sort options were scattered as individual buttons, vote pills nested extra badges, and reply collapse controls lived inline with the action row instead of reading as tree structure.
- Options considered: keep the existing button rows, move collapse controls into reply headers, or treat sort and vote controls as compact segmented pills while moving branch toggles into a dedicated reply rail.
- Decision: capitalize the route title consistently, default both feed and reply sorting to `new`, render sort controls as one highlighted segmented pill per workspace, simplify vote pills to `(+1 / score / -1)` without a nested score badge, move reply collapse/expand controls into a left-hand rail beside each reply card, and extend the internal feed/thread scroll panes so they use more vertical room on large screens.
- Why: this improves scanability, keeps important controls in one predictable place, and makes the reply tree read more like a connected conversation structure instead of a stack of detached cards.
- Consequences / follow-ups: the thread workspace now exposes `New reply` actions that target the original post from both the top-right and bottom-left of the thread pane, reply cards keep their own inline `Reply here` action for targeted nested replies, and future visual polish should continue reinforcing the tree rail rather than reintroducing collapse controls into the main action row.

### 2026-04-09 - Fully collapse reply branches down to rail-only markers

- Context: the first left-rail tree pass made reply structure clearer, but collapsed replies still showed summary content, which reduced the value of collapse as a true reading aid.
- Options considered: keep compact collapsed summaries, hide only the children, or hide the entire reply body and keep only the rail markers visible.
- Decision: collapsing a reply now hides that reply card and its descendants entirely, leaving only the rail marker controls visible; the vote control leads the utility row, feed cards use descendant-total reply counts instead of direct-child counts, thread cards drop their inline reply-count pills, and each reply rail now shows one combined arrow-plus-count marker whose number is the whole hidden branch size (`self + descendants`).
- Why: this makes collapse useful for actively pruning a long thread while reading downward, and it lets the left rail double as both the structural connector and the branch-depth cue.
- Consequences / follow-ups: the reply tree heading now shows `REPLIES (count)` based on the root post descendant-total count, selected `+1/-1` state is conveyed through highlighted segments instead of `set` text, and future thread polish should continue treating the rail as the primary branch-control surface.

### 2026-04-09 - Treat replies as body-only cards with meta-preserving collapsed state

- Context: once branch counts and collapse markers were working, reply cards still looked like titled posts because they rendered a duplicated title/body pattern, and the reply composer still echoed reply text instead of showing the actual target identity.
- Options considered: keep reply titles in case they become useful later, render a compact synthetic title, or treat replies as body-first records while keeping only author/time context visible when collapsed.
- Decision: reply cards now render their meta row plus body only, collapsed replies keep the same plain author/timestamp text visible beside the rail without a special summary container, and reply composers now label targets as `Replying to OP` or `Replying to {author} - {timestamp}` instead of reusing reply body text.
- Why: this keeps replies visually distinct from top-level threads, reduces duplicated content, and makes reply targeting much clearer in deep nested conversations.
- Consequences / follow-ups: future reply-level enhancements should continue using author/time context rather than inventing synthetic reply titles, and collapsed branches should remain lightweight so readers can prune long trees without losing orientation.

### 2026-04-09 - Simplify visible sort controls and preserve reply drafts on cancel or collapse

- Context: after the previous UI passes, the segmented sort controls plus `Show moderated` button could still overflow smaller widths, and open reply composers had no clean cancel path while collapse behavior depended too much on the open composer state.
- Options considered: keep every sort option visible, move sort/filter controls into a dropdown, or trim the visible sort set and let moderation/filter actions wrap beneath the sort pill while preserving draft text locally.
- Decision: keep the visible sort controls to `new`, `top`, `controversial`, and `old` for both feed and thread workspaces, move `Show moderated` onto the next wrapped control row, add a `Cancel` action to reply composers, stop clearing reply draft text whenever the target changes, and allow a targeted reply branch to collapse while keeping its draft in front-end state until reopened or submitted.
- Why: this keeps the controls readable on narrow layouts without introducing a new dropdown pattern, and it makes reply composition feel safer because users can back out or collapse a branch without losing their in-progress text.
- Consequences / follow-ups: the backend still supports richer sort modes if we want to surface them later in another control pattern, and future composer work should continue treating draft preservation as UI state rather than pushing partial replies into the packet layer.

### 2026-04-09 - Keep discussion control bars single-line by default and trim redundant guest status

- Context: after the simplified sort pass, the discussion control bars became safer on narrow widths but no longer held the intended one-line layout on normal desktop widths, and the top-right route header still repeated `Anonymous Guest` even though the short label and point balance already made the session state clear.
- Decision: keep the segmented sort control and adjacent action pills on one wrapping row by default so `Show moderated` only falls beneath the sort pill when the viewport truly gets tight, and remove the redundant `Anonymous Guest` status badge from the route header trailing cluster.
- Why: this preserves the cleaner one-line desktop rhythm while still degrading gracefully on smaller widths, and it keeps the top-right identity strip focused on the two pieces of information that matter during forum testing: who the session is and how many points it has.
- Consequences / follow-ups: if we add richer account state later, it should return to the shared shell/header through more meaningful identity or trust cues rather than a repeated guest label.

### 2026-04-10 - Reset discussions onto space, forum, thread, root-post, and reply packets

- Context: the discussion engine had outgrown the old `DiscussionThread`-as-forum model and the legacy visitor-lobby bridge, and adding real forum tabs plus dedicated reply packets was cheaper to do during a dev-data reset than after more content accumulated.
- Options considered: keep patching the inherited thread-kind model, add forum packets but keep replies as `DiscussionPost`, or reset local discussion data and mirror the UI structure directly in the packet hierarchy.
- Decision: reset local discussion data, add `DiscussionSpace` packets attached to scope elements, add one `DiscussionForum` packet per visible tab, keep `DiscussionThread` for a real thread inside a forum, keep `DiscussionPost` only for thread root posts, and add `DiscussionReply` as the dedicated nested reply family. Top-level discussion creation now writes `DiscussionThread + DiscussionPost`, nested replies now write `DiscussionReply`, and the legacy visitor-lobby repository and anonymous-session bridge were removed from the active repo path.
- Why: the packet graph now matches the discussions UI directly, forum discovery comes from real forum packets instead of thread-kind inference, reply-tree traversal is explicit, and the local dev database can be rebuilt deterministically against one seed version instead of carrying transitional discussion baggage.
- Consequences / follow-ups: server bootstrap now performs a discussion-seed-version reset before reseeding discussion packets, every seeded scope now gets a `DiscussionSpace`, four seeded forum tabs, starter threads, root posts, and nested replies, `/nexus/discussions` keeps the same user-facing surface while reading from the new hierarchy, and future trust/voucher work can attach to this cleaner discussion graph without another schema split.

### 2026-04-08 - Function-first and scope-first as one system

- Context: the nexus needs to support both “go to a function then filter by scope” and “go to a scope then explore its surfaces.”
- Options considered: separate route systems, separate tabs with duplicated screens, or one shared shell preference over the same routes.
- Decision: keep the same nexus routes and data in both modes, and change only the navigation emphasis in the left rail.
- Why: it keeps the product mentally coherent and prevents two parallel navigation stacks from drifting out of sync.
- Consequences / follow-ups: future nexus sections should remain reachable in both modes without forking route structure.

### 2026-04-08 - Primary and secondary left-side navigation columns

- Context: the first nexus shell still felt like stacked cards rather than a true app navigation system.
- Options considered: keep the scope tree and function controls in separate cards, move secondary navigation into the main surface, or split the left shell into primary and secondary columns.
- Decision: place a compact guest header at the top, keep shell preferences directly beneath it as one-line switch rows with fixed alignment, then render a primary column and an adjacent secondary column within the left-side shell.
- Why: it makes the shell behavior legible. The chosen preference determines whether functions or scopes are primary, and the other menu becomes the secondary column immediately to the right.
- Consequences / follow-ups: future nexus sections should plug into the same two-stage left-side navigation pattern, and responsive trays should continue to open from the left rather than flipping sides.

### 2026-04-09 - Equal-width rails with shell-local appearance preferences

- Context: the primary and secondary rails had drifted to different widths, and the guest header was becoming the natural place for shell-level preferences beyond function-first versus scope-first.
- Options considered: keep asymmetric rail sizing, hard-code one new equal width, or derive both rails from one shared width setting and expose that through a Nexus-only UI-size preference while also staging a shell-scoped theme toggle.
- Decision: make both open rails share the same width through `getNexusRailWidth`, add `themeMode` and `uiDensity` to the Nexus shell state, and expose compact inline controls for navigation mode, shell theme, and UI size inside the guest header.
- Why: one shared rail width keeps the two-column navigator visually coherent, while shell-local preferences let the Nexus feel more like an app without touching the outer public website.
- Consequences / follow-ups: the current light mode now reaches the shared Nexus shell primitives, the core `/nexus/*` route surfaces, the shell overlay/root container, and the nested Nexus navigator background, while the large UI preference now flows through a shared Nexus appearance layer for route spacing, typography, badges, buttons, and inputs instead of requiring per-screen redesign; the theme still stops at the public website boundary, and a future complete dark/light system should move more semantic color decisions into shared tokens instead of growing one-off conditional classes.

### 2026-04-09 - Guest header becomes a compact identity panel with a preference drawer

- Context: the guest header had accumulated the home link and all shell switches in a single always-open stack, which made the top of the primary rail feel more like utility clutter than a usable profile surface.
- Options considered: keep every shell control exposed, move preferences out of the header entirely, or turn the guest header into a small identity panel with progressive disclosure for settings.
- Decision: add an anonymous guest avatar between the `OWA Nexus` label and the guest name, move `Back to Home` beneath `Sign In` / `Sign Up`, and place the navigation/theme/size controls inside a bottom `Preferences` drawer that is toggled from the profile card.
- Why: it keeps the rail visually cleaner while still preserving fast access to shell-level controls and making the identity strip feel more intentional.
- Consequences / follow-ups: the preference drawer state now lives in the shared Nexus shell context so it survives route changes and shell remounts, the profile card now centers its brand line, auth actions, and drawer controls on the same axis as the avatar/name stack, the drawer trigger is now an attached footer row with a chevron and a short height/opacity animation instead of detached `open/hide` text, the profile card now uses the real session-scoped anonymous label plus the current available point balance from the discussion viewer context instead of a generic `Anonymous Guest` placeholder, and future profile-level controls should prefer the same drawer pattern instead of permanently expanding the guest header.

### 2026-04-08 - Rail collapse order and content ownership

- Context: the two-rail shell needed to behave more like a real workspace navigator and less like two static columns.
- Options considered: collapse both rails together, allow independent collapse without ordering, or use ordered collapse and expansion with gesture support.
- Decision: each rail keeps its own saved open or closed state, swipe-left collapses the outer-most visible rail first, swipe-right opens the primary rail first, followed scopes stay with the scope menu, and deferred surfaces stay with the function menu.
- Why: this keeps navigation predictable. Scope-only helpers remain near scope navigation, function-only helpers remain near function navigation, and collapse behavior stays consistent across desktop and responsive nexus use.
- Consequences / follow-ups: future additions to the left shell should declare whether they belong to the scope menu or the function menu rather than living in mixed utility sections.

### 2026-04-08 - Full scope map replaces the indented scope tree

- Context: the earlier scope tree still pushed deeper scopes further to the right, which made labels harder to read and kept the scope summary card from feeling anchored to the scope menu.
- Options considered: keep tuning the indented tree, move to a breadcrumb-only model, use a path-and-connections navigator, or replace the tree with a flatter full scope map.
- Decision: keep the scope menu as a branch-oriented navigator with a current-context card first, then a full visible scope map with a fixed-width connector lane, followed by `Followed scopes`.
- Why: this preserves hierarchy and branch relationships without stealing horizontal space from the lower rows, keeps every scope visible at once, and makes the active scope summary feel like part of the same menu.
- Consequences / follow-ups: future scope affordances should prefer branch and connection patterns over deeper indentation, both rails should keep the normalized `Function menu` and `Scope menu` naming, and the scope summary now lives in its own mirrored card pinned to the top of the secondary rail with lightweight activity/member/trust stats rather than inside the map container or moving with the scope menu.

### 2026-04-08 - NativeWind as the nexus styling boundary

- Context: `nativewind` was installed but not wired correctly, and the new nexus shell needed a faster token-driven styling system than the existing public `StyleSheet.create` pages.
- Options considered: continue the nexus in local `StyleSheet` files, migrate the whole app immediately, or use NativeWind for the nexus slice first.
- Decision: formalize NativeWind with dedicated config files and use it for the nexus layer while leaving the public site on its existing styling pattern for now.
- Why: it keeps the nexus iteration fast and visually cohesive without forcing an immediate rewrite of the public pages.
- Consequences / follow-ups: future nexus work should continue to use shared nexus tokens and NativeWind primitives; public pages can be migrated later if needed.

### 2026-04-08 - NativeWind public-site redesign without touching nexus routes

- Context: the main static public pages were still sparse `StyleSheet.create` placeholders, and the requested redesign needed stronger public storytelling without altering the new nexus shell.
- Options considered: leave the public site minimal, restyle the whole app including nexus, or upgrade only the non-nexus public pages and shell.
- Decision: migrate the public header/footer plus `/`, `/about`, and `/docs` onto a dedicated NativeWind-based public visual system while keeping `/nexus/*` unchanged.
- Why: it creates a more professional public front door, supports richer storytelling on the about page, and preserves the nexus as a separate application surface.
- Consequences / follow-ups: `/docs` now functions as the charter destination route until the actual charter text is written; public header auth links were removed in favor of a single `Nexus` site entry; the landing page now uses a rotating multi-message hero with generated background artwork, slower eased horizontal carousel transitions between slides, and a dedicated control row below a clipped hero viewport so the CTA layout stays stable as slides change; the public footer has been reduced back to a compact navigation strip instead of a large multi-column card block; and future public-site work should reuse the shared public tokens and content structures added in this pass.

### 2026-04-08 - About page sections grounded in canon and workspace language

- Context: the first public about page grouped ideas too loosely and still read partly like implementation notes rather than a crisp public explanation surface.
- Options considered: keep the simpler expandable cards, write new copy from scratch, or derive the public section model from the canon plus the workspace document while improving the interaction model.
- Decision: restructure the public about page around canon/workspace-derived themes and present them as scroll-focused sections with per-section background imagery.
- Why: it keeps the public explanation closer to the project’s actual principles while making the page easier to scan, more visual, and less placeholder-like.
- Consequences / follow-ups: future about-page revisions should continue to source their section set from public-facing canon/workspace language, and the page now behaves like a set of large scroll chapters whose card height, detail density, and parallax treatment are all driven from one measured midpoint focus line rather than a stack of separate assumptions; the page also now uses an explicit section navigator, measured in-layout viewport height so both active-state logic and animation timing stay centered within the public shell rather than drifting toward the full browser window midpoint, a widened focus band with a short center hold so section motion starts earlier and stays open longer through the scroll, a slower detail reveal so the inner highlight blocks fade and expand in with the same shared progress curve instead of popping in abruptly, and stronger blurred edge strips plus increased spacing between chapters rather than a true mask effect so the public page gets softer image boundaries without adding a heavier graphics dependency.

### 2026-04-10 - Claimed Nexus auth now requires passkeys, rotating sessions, and explicit write-approval modes

- Context: the initial cryptographic identity loop already supported guest, saved-guest, and claimed person elements with signed challenge-response sign-in, but it still relied on memory-only rate limits, static refresh tokens, and a thinner claimed-session model than we wanted before packettrust work.
- Options considered: leave claimed sign-in bundle-only, make passkeys optional, or keep the packet-signing bundle while requiring passkeys for app-auth and sensitive-session hardening.
- Decision: keep the current cryptographic person packet and encrypted local signing bundle model, add passkey sign-in and passkey re-auth flows as optional extra protection, rotate refresh tokens on refresh, store session/device metadata server-side, keep remembered login as a separate session convenience, and rename claimed write approval to `standard`, `guarded`, and `every_write`.
- Why: it keeps Nexus identity continuity anchored in the existing signed person packet while moving browser/session auth closer to professional security practice without treating cookies as identity truth. Passkeys strengthen claimed-session access and sensitive account operations when available, while the encrypted local bundle plus passphrase remains enough for normal claimed use and still protects the actual packet-signing key.
- Consequences / follow-ups: claimed graph writes still require a valid claimed session plus CSRF protection, but security-preference changes and other protected actions can now re-approve through passkey or signed-key re-auth depending on what the user has available; `every_write` now means fresh explicit approval per write through the shared auth/signing layer rather than a route-local disabled state; temporary guests are memory-only by default and only survive reloads when the user explicitly chooses session-only browser storage; the auth service now owns passkey records, WebAuthn challenges, single-use re-auth tokens, rotating refresh tokens, DB-backed rate limits, session/device listings, and audit-event rows; and future packettrust or role work should build on these claimed-session guarantees rather than reopening the identity/session model again.

### 2026-04-10 - Identity ceremonies now live inside the Nexus shell

- Context: after the cryptographic identity and passkey/session work landed, the UX still presented sign-in and sign-up like top-level public-site account pages, while the `/nexus/account` surface had become an overloaded catch-all for sign-in, create, claim, restore, export, and security management.
- Options considered: keep public `/login` and `/signup` as the primary entrypoints, move only labels/copy while leaving the route structure alone, or move the ceremonies fully into the Nexus shell and turn the public routes into compatibility redirects.
- Decision: identity creation, sign-in, guest claim, restore, and security management now live under `/nexus/identity/*`, while `/login` and `/signup` only redirect into those Nexus-shell routes. The sidebar profile card now routes into those Nexus identity pages, and the account page is reduced to an overview plus local assembly continuity workspace.
- Why: the underlying model is a Nexus-native cryptographic actor lifecycle, not a public-site account ritual, so the workspace should present those flows inside the same shell and language as the rest of Nexus.
- Consequences / follow-ups: `keep me logged in` is no longer an inline create/sign-in field and instead lives as a remembered-session preference in the sidebar/security surfaces; the sidebar preference drawer now exposes remembered-session preference, write-approval quick controls, and storage/cookie visibility; alias is treated as a mutable display alias backed by the cryptographic actor rather than a permanent username; create/claim forms now validate alias normalization, stronger bundle passphrases, passphrase confirmation, and optional structured location disclosure; and location lookup now goes through a provider-style Nexus search interface backed by canonical scope results so a real geocoder can be swapped in later without rewriting the auth UX.

### 2026-04-10 - Identity cleanup aligns sign-in, shell preferences, and discussion write readiness

- Context: after the shell-route pass, the UX still repeated an `Identity paths` card across multiple routes, the main sign-in ceremony was split across overlapping cards, sidebar preference controls used inconsistent widgets, and the discussions surface let claimed users click vote/reply actions even when their claimed session was authenticated but the local signing bundle stayed locked.
- Options considered: keep the backend behavior and only tweak copy, polish each page independently, or consolidate identity UX around one primary ceremony per route plus one shared preference vocabulary across the shell.
- Decision: the sign-in route now centers one primary bundle sign-in card with Enter-to-submit behavior and moves passkey, guest continuation, claim, create, and restore into a smaller secondary paths card; create and claim now include explicit starting claimed-session preferences at the bottom of the ceremony; the sidebar and identity security page now share the same compact `TEMP/SAVE` and `OFF/MED/MAX` preference controls; and discussions now treat `claimed session active but signing bundle locked` as a first-class blocked-write state with an explicit unlock prompt.
- Why: this makes the identity system read like one coherent Nexus tool, keeps session persistence and write approval legible in the same language everywhere, and stops discussion writes from feeling broken when the real problem is local signing readiness rather than server authentication.
- Consequences / follow-ups: the sidebar no longer shows overflow-prone storage/cookie pills, the strongest write-approval setting is still `every_write` under the hood but is presented as the shell-facing `MAX` option, create/claim can seed non-default write approval after the new claimed session is established, quick restore is no longer duplicated on the sign-in screen, and collapsed discussion replies now render a cleaner meta-plus-body summary instead of a misaligned metadata stub.

### 2026-04-10 - Sign-in now distinguishes saved local identities, passkeys, and bundle import

- Context: the first cleanup pass simplified the route structure, but the sign-in screen still made encrypted-bundle restore feel like the default everyday login path and did not explain passkeys in a way normal users could map to Windows Hello, phones, or security keys.
- Options considered: keep one blended sign-in card with more explanatory copy, split local/passkey/import into separate pages, or keep one route while presenting the three modes as a small internal tab set.
- Decision: `/nexus/identity/sign-in` now uses one connected top-tab rail for `Saved / Find identity`, `Passkey`, and `Import bundle`. The main tab searches the packet graph by alias, packet id, and public-key-related matches while still highlighting identities already saved on this device, `Passkey` explains device/browser authenticators as presence proof rather than file input, and `Import bundle` stays the explicit encrypted-bundle recovery path.
- Why: this matches the intended mental model better: restore/import is recovery, not the normal login path; passkeys are device authenticators, not pasted files; and graph-backed identity discovery belongs inside the same Nexus shell where the rest of the actor lifecycle already lives.
- Consequences / follow-ups: graph-only matches remain discoverable but cannot be unlocked with a passphrase unless the encrypted bundle is already on-device, the location disclosure picker now strips presentation-only fields before writing identity packets so claim/create no longer fail server validation on `label`/`description`, disclosure copy now says `Reveal location as`, and both identity search and location search now use the same collapsible selected-result pattern.

### 2026-04-10 - Sign-out, identity discovery, and optional passkeys now align with the cryptographic actor model

- Context: after the UX cleanup, several auth mismatches still remained: signing out could leave the old claimed identity visible in the sidebar, passkeys still behaved like a hard gate in parts of the security model, and identity discovery only searched local saved bundles instead of the Nexus packet graph.
- Options considered: leave those mismatches in place until a later trust/location pass, patch only the visible UI symptoms, or finish the auth model now by making sign-out restore guest continuity, making passkeys optional everywhere, and moving identity discovery onto the graph while keeping private-key custody local.
- Decision: signing out now tears down the claimed session and immediately restores a preserved guest actor or creates a fresh temporary guest; passkeys are now optional extra protection rather than a mandatory prerequisite for claimed use; protected security actions can re-approve through passkey or signed-key re-auth from the unlocked bundle; WebAuthn challenges now use proper base64url challenges with platform-authenticator preference; and identity search plus location search now read from graph-backed services rather than shell-summary-only state.
- Why: this keeps the web shell aligned with the original architecture. Sessions are still convenience wrappers, the person packet plus signing key remains the identity truth, the encrypted bundle remains the private-key custody boundary, and graph discovery helps users find actors or places without pretending the server can fetch their private keys.
- Consequences / follow-ups: the sign-in screen can now show saved-on-device versus graph-only identities clearly, graph-only matches must flow into bundle import or passkey sign-in rather than passphrase-only unlock, passkey sign-in now fails fast with a clear error when there are no registered passkeys yet, and future discussion/trust/location work can rely on one shared auth/signing layer instead of reintroducing route-local auth gates.

### 2026-04-10 - Final auth cleanup syncs creation choices, selector UX, and deeper discussion enforcement

- Context: after the route and sign-in cleanup, several smaller mismatches remained: the current-actor card still overused status pills, selected locations did not collapse their result list, the selected security mode from create/claim could fail to appear immediately in the security surfaces, and discussions were disabling write actions in the screen instead of letting the deeper verified-write layer enforce signing readiness.
- Options considered: leave the route-level gating in place and only clarify copy, patch each surface independently without changing write gating, or finish the cleanup by making the identity selectors behave like selectors while moving discussion write enforcement back down into shared auth/signing logic.
- Decision: create and claim now refresh the claimed session before applying the selected write-approval mode, successful create/claim flows land on identity security with an export reminder, the sign-in current-actor summary now emphasizes the actor label and collapses saved-identity search back to a selected card, canonical place selection now hides the remaining location results until the query changes again, and discussions no longer disable vote/reply/post controls solely because a claimed local bundle is locked.
- Why: this keeps the UX aligned with the model. The actor label is the thing that matters, selected values should read as chosen state rather than open dropdowns, and packet-write blocking belongs in the shared verified-write path instead of in a route component's disabled-state logic.
- Consequences / follow-ups: users now get an explicit reminder to export and safely store the encrypted bundle after create/claim, selected write-approval choices carry through more reliably to the new claimed session, and discussion write attempts may now surface deeper signing/auth errors instead of appearing inert when the local signing bundle is still locked.

### 2026-04-11 - Claimed-session truth, guest persistence, and signed discussions now align

- Context: the first signed-discussions pass restored reply and vote writes, but testing showed the shell could still present a saved claimed identity as the active actor without a real claimed session, guest `TEMP/SAVE` controls did not actually persist the current guest, guest claim could fail with an orphaned revision error, and passkey re-approval failures could block thread creation or security changes even when an unlocked local signing bundle was available.
- Options considered: keep patching screen-level copy, leave the saved-bundle-versus-session mismatch in place and only improve errors, or finish the cleanup by making session truth authoritative, guest persistence immediate, and the remaining discussion/auth writes flow through the same shared signing rules.
- Decision: the identity shell now treats a claimed session as the source of truth for whether a claimed person is the active Nexus actor; saved claimed bundles remain discoverable on the sign-in route but no longer become the active actor on load when no claimed session restores. Guest `TEMP/SAVE` now creates or clears browser persistence for the current guest immediately, identity security exposes an explicit `Save on this device` action for longer-lived guest persistence, guest claim sends both the current guest packet and the claimed revision so the packet store preserves the revision chain, passkey re-auth now falls back to signed local-bundle re-auth when possible, and signed discussion mutations now use explicit packet-envelope narrowing plus the cleaned packet payload shapes without redesigning the discussions UI.
- Why: this keeps the shell honest about who is actually active, restores the expected value of remembered claimed sessions, makes guest persistence behave the way the visible controls imply, and unblocks the remaining discussion and security writes without weakening the shared auth/signing boundary.
- Consequences / follow-ups: losing or failing to restore a claimed session now drops the shell back to guest instead of leaving a half-active claimed identity visible, the sidebar/account/security buttons route users to sign-in unless a real claimed session is active, sign-in search selection is less jumpy and stays collapsed around the selected identity, discussion posting no longer references points or vote-derived hiding, and future trust work should build on the membership-gated attestation model rather than reintroducing the old point ledger.

### 2026-04-17 - Wrapper route truth, remembered-session reuse, and local-only Library now match product intent

- Context: after the scoped claim and trust refactor landed, several behavioral mismatches still made the app feel less honest than the data model: scope changes from wrapper-level account and identity pages only changed shell state in the background, remembered same-device sign-ins could multiply persistent sessions, refresh-token rotation created extra session rows, and Library still behaved like a broad inherited scope lens instead of a local packet shelf.
- Options considered: leave these as later cleanup, patch only the account page copy, or finish the stabilization pass by making wrapper-route navigation explicit, reusing same-device remembered sessions, and tightening Library to local-only behavior by default.
- Decision: wrapper-level `/nexus/account` and `/nexus/identity/*` surfaces now resolve as hidden account-state routes in shell logic and redirect visible scope changes back into `/nexus/trust`; remembered same-device claimed sign-ins now reuse the existing persistent session by default; refresh-token rotation updates the same persistent session in place instead of inserting a new device row; and Library now requests only packets whose native authority scope matches the active scope.
- Why: these changes keep the shell honest about what page the user is really on, make remembered-session behavior match normal user expectations, and stop the default Library surface from overstating scope visibility.
- Consequences / follow-ups: session lists should no longer grow just because the same device signs in again or refreshes a remembered session, wrapper-level account pages stop masquerading as one of the primary function workspaces, and any future inherited/global/all-visible Library modes should be added explicitly rather than leaking in through the default local Library view.

### 2026-04-18 - Legacy signed identities remain valid after the roles-and-claims refactor

- Context: role and assembly-association writes started failing with `Person element signature verification failed`, and one sign-in path also regressed, because older signed person packets in the store predated the defaulted `claimed_role_refs` field while server verification was hashing the reparsed packet shape instead of the originally signed payload.
- Options considered: trust the client packet for mutation auth, rewrite stored identity packets in place, or keep server-side verification strict while teaching signature verification to accept the older signed packet shape.
- Decision: keep server-side identity verification in place, but let packet signature verification accept both the current canonical `Element` shape and the older pre-`claimed_role_refs` signed shape when the digest and ECDSA signature match; also fix the sign-in challenge write path to use the already loaded `actorPacket` instead of the stray `storedActorPacket` variable.
- Why: this restores sign-in and claim mutations for already-stored identities without weakening the cryptographic check or requiring a packet-database migration.
- Consequences / follow-ups: older saved or claimed identities should once again be able to sign in, claim roles, and claim assembly association from the live UI, while newly written person packets continue to verify against the current packet shape.

### 2026-04-18 - Identity pickers, scoped role projections, and security sessions now report truthfully

- Context: after claim writes started succeeding again, several UX mismatches remained: the sign-in route could visually repeat the same saved identity, account and sign-in copy still implied the wrong next action for locally saved claimed bundles, exact-scope role claims could be hidden by broader association heuristics even after a successful write, and the identity security page could show a blank sessions area with no error or empty-state guidance.
- Options considered: wait for the upcoming location pass, patch only the visible copy, or finish this stabilization slice by making the identity picker, roles projection, and session/security surfaces report the underlying state more directly.
- Decision: dedupe visible sign-in identities by actor packet id and only show the selected-identity card when the list is collapsed; update account and sign-in CTA copy to distinguish resume or unlock from switch-identity flows; make exact-scope `role_association` claims always appear as visible claimants on the `Roles` route; re-fetch the scoped roles payload immediately after claim and attestation mutations; and make identity security show active sessions only, sorted with the current session first, while surfacing explicit empty or error states when session data is unavailable.
- Why: the current product phase is about tightening truthfulness before location work begins. These changes keep the visible Nexus surfaces aligned with the already-written packets and session state instead of making users guess whether a successful mutation really took effect.
- Consequences / follow-ups: the sign-in picker should no longer show the same claimed identity twice just because it is both saved locally and discoverable in the graph; successful role actions should update card buttons, claimant rows, and counts without a manual page reload; trust metrics can explain role posture without hiding exact-scope role claims; and for early-alpha packet-shape churn the project should consider an intentional reset or reseed cutline before accumulating permanent compatibility logic for every transient test-era schema.

### 2026-04-18 - Guest role gating now redirects politely, and personal scope reads like a personal lens

- Context: once role claiming and attestation finally worked end to end for claimed users, two product-truth issues remained: guests could still press protected role actions and hit raw backend identity errors, and the shell still described `You` with generic `... across You` copy plus a scope-map depth graphic that widened and then narrowed again at the personal leaf.
- Options considered: hard-disable role controls for guests, redirect immediately with no local explanation, or keep the controls visible while explaining the requirement locally and preserving return context; for the shell, leave the generic labels alone or finish the personal-scope language and depth treatment now.
- Decision: keep protected role controls visible to guests, but intercept them with a lightweight sign-in-required modal offering `Sign in` or `Go back`; carry `return_to` plus `return_scope_id` through sign-in, claim, create, and restore so successful identity ceremonies can return to the originating workspace and scope; keep clean function titles while moving personal-scope wording into the supporting subtext; label `You` as a `Personal branch`; and make the scope-map connector lane encode semantic breadth so the tree reads from broadest global scopes down to the narrowest personal endpoint.
- Why: this preserves discoverability and intent without leaking low-level auth errors, and it makes the `You` scope feel like a first-class personal lens rather than an awkward exception tacked onto the bottom of a geographic tree.
- Consequences / follow-ups: guests can still browse the Roles page but cannot mutate it without entering an identity ceremony; identity routes entered from that gate should return to the same scope-aware workspace on success; and the current location disclosure/search problems remain intentionally deferred into the dedicated location pass instead of being half-solved inside this quick systems cleanup.

### 2026-04-18 - Home locality now drives mounted scope ancestry, while follows become real shell preferences

- Context: the repo had a location roadmap but the live shell still exposed the seeded test tree by default and used hardcoded followed-scope ids instead of actor-aware mounted-scope truth.
- Options considered: wait for the full location pass, keep the old full-tree shell until search and creation are polished, or land a narrow first phase that establishes home-locality claims plus mounted-scope behavior without redesigning location search or locality creation yet.
- Decision: add `Claim(kind: "home_locality")` as the source of mounted geographic ancestry; keep `Global + You` as the universal default baseline; derive mounted ancestor scopes from one active deepest home-locality claim; keep `assembly_association` separate and non-mounting for now; replace hardcoded followed scopes with cookie-backed shell follow preferences keyed to the current actor; keep the main scope tree focused on the geographic home branch; and surface unmounted known scopes separately as a lightweight explore/follow list under the scope map.
- Why: this makes the shell honest about which scopes are actually mounted for the current actor without prematurely dragging in canonical locality search, locality creation, or deeper trust-rollup semantics.
- Consequences / follow-ups: identity `location_disclosure` remains optional metadata rather than mounted-scope truth; `Trust` now hosts the minimal `Set as home locality` / `Clear home locality` action for eligible geographic scopes; followed scopes are now explicit opt-in shell preferences instead of seeded defaults; and later location phases still need canonical locality search, guided locality creation, and direct-vs-rolled-up locality verification.

### 2026-04-18 - Mounted scope rendering, community posting gates, and role tabs are tightened

- Context: after home-locality mounting landed, the sidebar still rebuilt its own scope map from every known scope, explore results could duplicate mounted scopes, membership-required discussions still used older assembly-association participation assumptions, role claim lists were becoming vertically cramped, and protected claim-return flows could show a false already-claimed dead-end.
- Options considered: fold these into the larger location pass, add broad pagination/map infrastructure now, or apply a focused cleanup that preserves existing routes and packet shapes while fixing truthfulness at the shell and UI boundaries.
- Decision: render the scope map from the geographic home branch supplied by shell context; cap and dedupe explore/follow lists in the sidebar; guard home-locality lookup so null actors cannot inherit another actor's home chain; gate non-visitor discussion writes on the active home-locality branch with a local `Community claim required` modal; move the roles route to one-role-at-a-time tabs; and treat already-claimed return flows as successful identity-ready states.
- Why: this keeps Phase 1 honest without expanding the location ontology, adding new packet families, or prematurely building a full Nexus map/pagination surface.
- Consequences / follow-ups: remote scopes can still be explored or followed without becoming community membership, visitor lobbies remain guest-writeable, role evidence stays inline inside the active tab, and later map/packet-viewer work should absorb large discoverable/followed scope lists instead of growing the sidebar indefinitely.

### 2026-04-18 - Home locality controls become explicit and followed scopes leave the geographic tree

- Context: followed scopes were useful but appeared both in the followed list and the main scope map, while the Trust page hid the home-locality action among general scope controls and still made assembly association feel too close to residency.
- Options considered: make follows packet-native immediately, collapse association into home locality, or keep this as a Phase 1 cleanup that clarifies the current semantics without changing packet schema.
- Decision: keep follows as shell preferences for now, render followed-only scopes only in the followed list, preserve the main tree as the geographic home branch, fix home-locality claim withdrawal revisions to use compact parent revision refs, and promote Home locality into its own Trust card with derived branch explanation.
- Why: the geographic tree should answer “where is my home branch?” while follows answer “what else am I watching?” Keeping those lanes separate prevents remote follows from pretending to be community membership.
- Consequences / follow-ups: one active deepest `home_locality` claim still derives parent-scope membership, descendants are not inferred, assembly association remains relationship/trust evidence rather than posting or voting rights, and packet-native follow/subscription mechanics remain a later core-system pass.

### 2026-04-18 - Identity entry now writes home locality, and Trust relationship controls are rebalanced

- Context: the old create/claim location field had been a partial home-location setup flow, but it still read as profile disclosure and did not write the mounted-scope home-locality claim. At the same time, the Trust page had made home locality too prominent above the actual trust metrics.
- Options considered: leave location setup entirely to Trust, add profile disclosure controls now, or keep this pass focused on optional canonical home selection at identity entry while preserving disclosure as future profile metadata.
- Decision: reframe the create/claim location picker as optional Home locality setup; allow create/claim with no selected location; write one `Claim(kind: "home_locality")` through the existing home-locality mutation after the claimed session is active when a canonical geographic scope is selected; keep `identity.location_disclosure` unset by default and separate from mounting; improve graph-backed locality search normalization for punctuation, spacing, hyphens, case, and simple aliases; and move Trust home/follow/association controls into a compact `Scope relationship` block beneath the primary trust metrics.
- Why: the sign-up ceremony should let people choose their geographic branch early without making location mandatory, leaking profile disclosure, or hiding the core Trust posture behind location controls.
- Consequences / follow-ups: `Global + You` remains the default baseline for anyone who skips location, canonical locality creation remains deferred, follows are still shell preferences until a packet-native follow/subscription pass, and future profile settings can add explicit public location disclosure without affecting mounted-scope truth.

### 2026-04-18 - Locality search repairs legacy geographic subtype compatibility

- Context: `Sunnymead Ranch` existed as a seeded geographic assembly, but it did not appear in locality search because the search service only accepted `nation`, `state/region`, `city`, and `district` subtypes while the seed used the older `neighborhood` subtype.
- Decision: keep this as a surgical search repair: treat legacy `neighborhood` as the current district-level locality equivalent, keep non-geographic subtypes out of home-locality search, and move shared search normalization plus match scoring into a small pure helper so focused tests can cover it without booting packet services.
- Consequences / follow-ups: `Sunnymead Ranch`, `Sunnymead`, hyphen variants, case variants, and odd spacing should resolve through the existing location search API, while canonical locality metadata, duplicate handling, translations, and controlled locality creation remain deferred to the next larger locality phase.

### 2026-04-18 - Canonical locality creation uses full-path review before minting assemblies

- Context: identity entry and Trust could select existing localities, but missing places still required rough generic assembly creation or could not be created from the home-locality journey at all.
- Decision: add optional `Element.body.locality` metadata for geographic assemblies, extend location search with canonical/alias/path/fuzzy result metadata plus create candidates, add a protected `POST /api/nexus/locality` route, and introduce `/nexus/locality/create` as the shared full-path wizard for creating missing nation/region/city/district assemblies under a confirmed parent path.
- Why: locality creation should mint real cryptographic assembly Elements without letting raw free text create ambiguous public geography; exact duplicates should reuse existing packets, while fuzzy duplicates should warn before allowing explicit override.
- Consequences / follow-ups: signup/claim and Trust can hand off into the shared locality journey, existing legacy `subtype` and `locality_label` fields remain readable, no third-party geocoder is involved yet, and later phases still need richer parent-path discovery, merge/moderation tools for mistaken duplicates, translated aliases, and a future Nexus map/browser entry point.

### 2026-04-20 - Locality mutations keep legacy identity signatures strict while the wizard searches each path level

- Context: clearing or changing home locality and submitting the locality creation route could fail for older claimed identities because reparsing legacy person Elements added `locality: null` before signature verification, changing the canonical payload from what was originally signed. The first locality creation wizard also accepted raw path text at each level instead of searching scoped existing localities first.
- Decision: keep stored person-packet self-verification active, but let the verifier try a legacy candidate with additive `Element` defaults such as `claimed_role_refs: []` and `locality: null` removed before comparing the digest and ECDSA signature. Extend `/api/nexus/location-search` with optional `level` and `parent_scope_id` filters, and update `/nexus/locality/create` to use a `Build locality path` flow where each level searches/selects existing localities or is explicitly marked as a new candidate before review.
- Why: older legitimate identity packets should continue to authorize signed locality mutations without bypassing auth, and locality creation should guide users toward existing canonical packets before creating new geographic assembly Elements.
- Consequences / follow-ups: Trust `Clear home locality`, home switching, and locality creation should share the same signature compatibility fix; existing broad locality search callers continue to work; server-side duplicate reuse/warnings remain the safety backstop; future work can still add map/browser entry points, translated aliases, and merge/moderation tooling without changing this route shape.

### 2026-04-20 - Created localities get clean local discussion surfaces

- Context: newly created locality scopes could land the user back on Global Commons after home-locality setup, and their Discussions surface could inherit parent forums and starter threads instead of opening as a local clean slate.
- Decision: when `/nexus/locality/create` sets the selected locality as home, refresh shell state, make that locality the active scope, and route to its dashboard with a success notice. The locality creation API now idempotently ensures one local `DiscussionSpace` plus empty `visitor_lobby`, `general`, and `proposals` forums for the final selected locality, while the discussion service only projects forums and feeds whose authority scope is the active scope.
- Why: creating Perris should feel like entering Perris, and Perris discussions should not appear pre-populated with California threads just because California is an ancestor scope.
- Consequences / follow-ups: forum inheritance is no longer used for the main Discussions feed; scopes without local forums show an explicit empty state; starter threads are not created in this pass; and future work should make discussion spaces/forums dynamic and element-configurable instead of relying on a fixed starter bundle.

### 2026-04-20 - Protected Nexus writes use one auth-gate modal pattern

- Context: protected writes could still surface raw string errors or one-off cards for the same underlying states: signed-in identity required, locked local bundle, fresh write approval, or community/home-branch membership required. Existing localities such as Perris also needed a safe way to add the now-standard empty discussion bundle without recreating the scope.
- Decision: add typed client-side auth gate errors and a shared Nexus auth-gate modal/hook while keeping server-side verification in `verifyActorMutation`. Roles, Trust, Discussions, and locality creation now route protected write attempts through the same modal pattern, and `/api/nexus/scopes/[scopeId]/discussions/surfaces` idempotently backfills empty OWA discussion forums for eligible geographic home-branch scopes.
- Why: the UI should explain auth readiness consistently while the runtime remains the authority for cryptographic actor assertions, sessions, reauth tokens, and membership enforcement.
- Consequences / follow-ups: sign-in/unlock routes preserve `return_to` and `return_scope_id`; write-protection approval still uses the existing reauth path when the user confirms; direct API writes remain protected by server checks; and future auth cleanup should continue deleting route-local auth strings in favor of the shared gate.

### 2026-04-24 - Write-lock proof requirements now finalize through the corridor and reuse one unlock surface

- Context: the first fortress corridor could prepare mutations with `required_proof_level`, but finalize still relied too heavily on route-local heuristics, and write approval plus bundle unlock still felt split between silent client logic and page-specific buttons.
- Decision: prepared mutations now carry accepted proof methods alongside `required_proof_level`, finalize verifies the actor proof bundle against both the prepared level and the accepted method set, and the auth service stamps single-use reauth tokens with an explicit proof method such as `signed_reauth`, `bundle_passphrase_unlock`, or `passkey_confirmation`. On the client side, the shared auth-gate modal now becomes a password-first protected-write popup: it focuses the bundle passphrase immediately, can mint a fresh `bundle_passphrase_unlock` proof without losing the pending draft, offers passkey as a secondary option when available, and reuses the same surface for standalone unlock versus action-bound approval.
- Why: this keeps the corridor's policy decision authoritative, lets `MAX` mean strong proof instead of “some generic reauth happened”, and gives protected writes one reusable approval surface that can resume the original action after fresh proof instead of making the user rebuild packet intent.
- Consequences / follow-ups: actor write-policy updates are now governed by the current effective actor policy rather than a hardcoded raise/lower rule, with first-time create/claim bootstrapping still allowed when no explicit actor write-lock packet exists yet; claimed discussion and packet-signal writes now merge actor write policy with scope write policy before prepare; the sidebar and identity security route surface the same success/error behavior; and future third-party proof methods can plug into the same accepted-method contract without redesigning policy semantics.

### 2026-04-10 - Railway cutover keeps the Expo server app intact and adds a local production-parity Node server

- Context: the repo had been running through Expo's server features, but the Railway move needed a real exported-server runtime, a persistent SQLite path that works outside the repo root, and a safer bootstrap rule that would not destructively reseed hosted data.
- Options considered: split a separate backend immediately, keep using `expo start` as the hosted runtime, or preserve the existing Expo Router server app and add a thin Node host around the exported build.
- Decision: keep `web.output = "server"` and the current `app/api/**` architecture, add a dedicated Node server entry that serves `dist/client` and forwards dynamic requests into the Expo server build, pin the runtime to Node `24.x`, move the SQLite DB plus discussion seed marker onto an env-driven `NEXUS_DATA_DIR`, and restrict destructive discussion reseeds to explicit local/dev conditions instead of every non-matching boot.
- Why: this makes the Railway cutover a hosting/runtime correction instead of a second backend rewrite, preserves the current auth and query contracts, keeps normal Expo local development intact, and adds a production-parity local server path that matches what Railway will actually run.
- Consequences / follow-ups: local development still uses `expo start --web`, local production-parity validation now uses `npm run export:web` plus `npm run serve:web`, Railway can mount a persistent volume without changing app code, and future production hardening can build on the same server entry and env-based storage path without reopening the app shape decision.

## Major tradeoffs

Capture the real tensions explicitly, such as:

- open participation vs sybil resistance friction
- transparency vs safety, privacy exceptions
- fast iteration vs schema stability
- local autonomy vs global coherence
- OWA-native UX vs Nexus-general browser UX

## Current stabilization guidance

Before widening the ontology again, the implementation should treat the current repo state as a catch-up phase.

Working guidance:

- identity/auth and discussions are the strongest reference verticals
- dashboard, trust, votes, roles, and library should be tightened around real workflows before adding more major packet families or broader product surfaces
- blocked-in placeholder surfaces should be made semantically honest before they are made more elaborate

Priority stabilization targets:

- assembly creation and assembly association need hardening and explicit tests before being treated as stable onboarding flows

Role and schema guidance:

- the current roles and trust surfaces now use scoped `Claim` packets for role and assembly association, which resolves the earlier mismatch between global actor-body state and scope-local legitimacy
- the remaining follow-up is not whether to add a claim family, but how far to generalize claim kinds and policy interpretation without reopening working role and trust behavior too early
- long-term direction should continue to favor inspectable relationship packets plus computed posture over duplicating social-state lists on actor bodies

Location guidance:

- home locality now exists as a real scoped claim and drives mounted geographic ancestry
- `identity.location_disclosure` remains optional metadata and should not be reused as mounted-scope truth
- `assembly_association` remains distinct from home locality and should not casually be reused as “I live here”
- canonical locality creation now exists as a protected full-path wizard for geographic assemblies; later location phases still need richer directory governance, duplicate merge/moderation, translated aliases, and locality verification rollups without reopening the mounted-scope foundation

## Open questions

Keep a living list, aggressively pruned:

- exact body depth for the newer first-class families such as `Signal`, `Decision`, `DiscussionThread`, `DiscussionPost`, `Minutes`, and `Artifact`
- exact vote aggregation semantics for OBMS and audit trails
- how proposal lifecycle state machines are represented
- merge/conflict UX and policy
- governance mechanics beyond basic thresholds
- what minimum viable sync looks like in v0

## Change discipline

Two hard rules prevent drift:

- canon changes slowly; implementation guide changes often
- every code change that alters structure, naming, schema, or routing requires a doc update, or an explicit note in the decision log

If you want the next pass to be maximally productive: I can now take all the uploaded docs plus the `nexus-src-06` snapshot and convert this guide into a true scrape, where each section includes:

1. the full inventory of relevant nuggets we already have
2. a normalized, conflict-free current recommendation for OWA
