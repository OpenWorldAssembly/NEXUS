# Open World Assembly Implementation Guide

## Purpose and scope

This guide is the “scrape everything” implementation reference for building OWA Nexus as a new, dedicated OWA repo that replaces the current `nexus_app` lineage while preserving and integrating every durable feature, architecture primitive, and implementation idea we’ve accumulated: Nexus core, packet graph, offline-first distribution, trust/identity, governance mechanics, OPSEC/safety options, and the OWA assembly model.

It is intentionally detailed and operational. It should be possible for someone new to the project to open this doc and build the system without needing to hunt through old workspaces, Discord summaries, whitepapers, or prototype code.

The product target is an Expo-based web app, with responsive layouts across desktop, tablet, and mobile, built atop a portable core engine and a local-first data model.

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

Architecturally, a single repository can still host multiple packages:

- `core` (engine)
- `schema` (packet types + validators)
- `storage` (SQLite, file/bundle I/O, indexing)
- `sync` (bundle exchange, merge, replication protocols)
- `ui` (Expo app)
- `adapters` (if we keep optional Discord/CLI later)
- `docs` (this guide + canon + RFCs)

## Route tree and navigation model

The routing model should reflect the user’s mental map of “where am I in the fractal” and “what’s happening here,” while also exposing the underlying packet graph.

A good default is a three-axis navigation:

### Place / Scope axis (where)

- World → Region → Nation → State/Province → County/Metro → City → Neighborhood → Venue/Local Node
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

### Account

- Identity
- Proof tiers
- Privacy
- Devices
- Export keys
- Safety modes

Layout rule: desktop can be multi-pane, with left for scope tree, center for content, and right for context/related graph. Tablet can be partially split. Phone can be stacked. The route tree stays stable; pane density adapts.

### Current implemented portal slice

The current repo now has a first blocked-in portal slice under `/portal/*`.

Implemented routes in this slice:

- `/portal/dashboard`
- `/portal/discussions`
- `/portal/votes`
- `/portal/library`
- `/portal/account`

Implemented shell behavior in this slice:

- dedicated portal layout separate from the public header/footer shell
- left-heavy desktop shell with guest identity, scope tree, followed scopes, and accordion navigation
- responsive mobile overlay for the same left-side shell
- function-first vs scope-first as a shell preference rather than separate route systems
- `Global Guest` as the default portal entry state
- visitor-lobby posting as the only enabled guest write interaction

Current implementation boundary:

- all portal content is mock data for UI blocking and navigation feel
- packet details, persistence, auth, trust mechanics, and protected spaces remain later phases

## Core entities and data model

The most robust unifying model we have is the packet graph: everything is a typed packet node, relationships are explicit edges, and the system is the evolving graph.

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

## Documentation and memory

### Minutes / AAR / Artifact packets

AARs already exist conceptually and in prototype.

We should canonize records as packets, and ensure auditability plus portability.

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

- stable, machine-readable refs, for example namespace + type + name + version
- consistent rules for version bumps and deprecation
- rules for forks, `fork_of`, and derivations

### Schemas and types

- TypeScript types mirror schema names exactly
- Zod validators, or equivalent, are the canonical validators
- display models are views, never the source of truth

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

### 2026-04-08 - Dedicated portal shell under `/portal/*`

- Context: the repo only had a public website shell plus a placeholder portal page.
- Options considered: keep the portal inside the public header/footer shell, create a hybrid shell, or split the portal into its own nested layout.
- Decision: create a dedicated nested portal layout while leaving the outer public website unchanged.
- Why: the portal needs app-like navigation density, persistent scope context, and a responsive left rail that would fight the public-site shell.
- Consequences / follow-ups: public pages remain simple and static, while portal work can now evolve independently through `app/portal/_layout.tsx` and portal-specific components.

### 2026-04-08 - Global guest default with visitor-lobby-only posting

- Context: the portal needed a usable initial state before auth, credentials, locality claiming, or trust progression exist.
- Options considered: force scope selection first, open in a demo locality, or default to a global guest portal.
- Decision: default to `Global Guest` in `Global Commons`, allow public browsing across scopes, and allow posting only in visitor lobby spaces.
- Why: it preserves open browsing and orientation without pretending trust, membership, or vote rights already exist.
- Consequences / follow-ups: join/start-locality flows, identity continuity, and trust-aware permissions can arrive later without rewriting the first portal shell.

### 2026-04-08 - Function-first and scope-first as one system

- Context: the portal needs to support both “go to a function then filter by scope” and “go to a scope then explore its surfaces.”
- Options considered: separate route systems, separate tabs with duplicated screens, or one shared shell preference over the same routes.
- Decision: keep the same portal routes and data in both modes, and change only the navigation emphasis in the left rail.
- Why: it keeps the product mentally coherent and prevents two parallel navigation stacks from drifting out of sync.
- Consequences / follow-ups: future portal sections should remain reachable in both modes without forking route structure.

### 2026-04-08 - NativeWind as the portal styling boundary

- Context: `nativewind` was installed but not wired correctly, and the new portal shell needed a faster token-driven styling system than the existing public `StyleSheet.create` pages.
- Options considered: continue the portal in local `StyleSheet` files, migrate the whole app immediately, or use NativeWind for the portal slice first.
- Decision: formalize NativeWind with dedicated config files and use it for the portal layer while leaving the public site on its existing styling pattern for now.
- Why: it keeps the portal iteration fast and visually cohesive without forcing an immediate rewrite of the public pages.
- Consequences / follow-ups: future portal work should continue to use shared portal tokens and NativeWind primitives; public pages can be migrated later if needed.

## Major tradeoffs

Capture the real tensions explicitly, such as:

- open participation vs sybil resistance friction
- transparency vs safety, privacy exceptions
- fast iteration vs schema stability
- local autonomy vs global coherence
- OWA-native UX vs Nexus-general browser UX

## Open questions

Keep a living list, aggressively pruned:

- final ontology for assemblies + overlays
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
