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

### Current implemented nexus slice

The current repo now has a first blocked-in nexus slice under `/nexus/*`.

Implemented routes in this slice:

- `/nexus/dashboard`
- `/nexus/discussions`
- `/nexus/votes`
- `/nexus/library`
- `/nexus/account`

Implemented shell behavior in this slice:

- dedicated nexus layout separate from the public header/footer shell
- left-heavy desktop shell with a compact guest header, anonymous guest avatar, auth actions, a home link beneath auth, a bottom-mounted preference drawer tab, a primary rail, and a secondary rail
- responsive mobile overlay for the same left-side shell, still opening from the left edge
- function-first vs scope-first as a shell preference rather than separate route systems
- the scope menu uses a full visible scope map instead of an indented tree, so deeper scopes do not lose width as the branch descends and the user does not have to drill into path-only views
- per-rail collapse handles and swipe gestures that collapse the outer-most rail first and expand the primary rail first
- current-scope summary content lives with the active scope menu rather than staying fixed to one rail, it stays above the scope map when the scope menu is visible, and long badge labels are constrained to wrap inside the card
- secondary rail can remain open while the primary rail is collapsed
- `Global Guest` as the default nexus entry state
- visitor-lobby posting as the only enabled guest write interaction
- visitor-lobby posts now flow through local API routes into a local SQLite-backed packet store with session-scoped anonymous guest labels preserved through packet external refs
- local web runs now use Expo `web.output = "server"` so the visitor-lobby API routes can actually execute

Current implementation boundary:

- nexus shell scopes, dashboard cards, vote lanes, discussion forums, and library cards are now loaded from packet-backed API projections instead of local mock arrays
- a packet foundation now exists under `domain/schema`, `domain/core`, `domain/packets`, and `domain/projections`, with a separate top-level `storage` boundary for persistence
- the current codebase now includes a canonical `PacketEnvelope = { header, body }` model, Zod packet-family parsers, packet-store/query-service interfaces, packet label projections, shared browser/nexus query-service implementations, a packet-store schema constant under `storage`, an Expo `SQLitePacketStore`, and a server-side `NodeSQLitePacketStore`
- the visitor-lobby repository, shell payload route, and scope query routes now share one Node SQLite packet-store bootstrap that seeds the personal scope tree and imports the old JSON bundle only as legacy data
- packet detail routes, auth, trust mechanics, and protected spaces remain later phases

## Core entities and data model

The most robust unifying model we have is the packet graph: everything is a typed packet node, relationships are explicit edges, and the system is the evolving graph.

The current repo foundation should treat the packet envelope as:

- `packet_id` = stable logical packet identity
- `revision_id` = immutable exact revision reference
- `parent_revision_refs` = exact revision ancestry, including merge revisions with multiple parents
- `family` = canonical packet family
- `edges` = the single typed relationship collection
- `authority_scope_ref` plus `applicable_scope_refs` = ownership and applicability, separated
- `parent_scope` = the explicit child-to-parent assembly edge for geographic scope trees

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
- Consequences / follow-ups: the preference drawer state now lives in the shared Nexus shell context so it survives route changes and shell remounts, the profile card now centers its brand line, auth actions, and drawer controls on the same axis as the avatar/name stack, and future profile-level controls should prefer the same drawer pattern instead of permanently expanding the guest header.

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
- Consequences / follow-ups: future scope affordances should prefer branch and connection patterns over deeper indentation, and both rails should keep the normalized `Function menu` and `Scope menu` naming.

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
- Consequences / follow-ups: `/docs` now functions as the charter destination route until the actual charter text is written; public header auth links were removed in favor of a single `Nexus` site entry; the landing page now uses a rotating multi-message hero with generated background artwork, slower eased horizontal carousel transitions between slides, and a dedicated control row below a clipped hero viewport so the CTA layout stays stable as slides change; and future public-site work should reuse the shared public tokens and content structures added in this pass.

### 2026-04-08 - About page sections grounded in canon and workspace language

- Context: the first public about page grouped ideas too loosely and still read partly like implementation notes rather than a crisp public explanation surface.
- Options considered: keep the simpler expandable cards, write new copy from scratch, or derive the public section model from the canon plus the workspace document while improving the interaction model.
- Decision: restructure the public about page around canon/workspace-derived themes and present them as scroll-focused sections with per-section background imagery.
- Why: it keeps the public explanation closer to the project’s actual principles while making the page easier to scan, more visual, and less placeholder-like.
- Consequences / follow-ups: future about-page revisions should continue to source their section set from public-facing canon/workspace language, and the page now behaves like a set of large scroll chapters whose card height, detail density, and parallax treatment are all driven from one measured midpoint focus line rather than a stack of separate assumptions; the page also now uses an explicit section navigator, measured in-layout viewport height so both active-state logic and animation timing stay centered within the public shell rather than drifting toward the full browser window midpoint, a widened focus band with a short center hold so section motion starts earlier and stays open longer through the scroll, a slower detail reveal so the inner highlight blocks fade and expand in with the same shared progress curve instead of popping in abruptly, and stronger blurred edge strips plus increased spacing between chapters rather than a true mask effect so the public page gets softer image boundaries without adding a heavier graphics dependency.

## Major tradeoffs

Capture the real tensions explicitly, such as:

- open participation vs sybil resistance friction
- transparency vs safety, privacy exceptions
- fast iteration vs schema stability
- local autonomy vs global coherence
- OWA-native UX vs Nexus-general browser UX

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
